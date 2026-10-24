// 文書をテキストにする（hearing.md 9章。docx・xlsx・pptx の中の文字を返す）。モデルを使わない。
// view は文書を文字にせず、変換のコマンドがパソコンにあるとは限らないので、エクステンションの中で変換する。
// 外部のパッケージを使わない。zip は zip.mjs（node:zlib）で読み、XML から文字を取り出す。
//
// 返す文字
//   docx：本文の段落（表は、セルをタブ、行を改行で区切る）。ヘッダー、フッター、脚注、文末脚注、コメントは、見出しを付けて後ろに足す。
//   xlsx：シートごとに、行を改行、セルをタブで区切る。数式のあるセルは「値（式：=…）」。日付のセルは日付ではなく数値で出る。
//   pptx：スライドごとに、文字。ノートは「（ノート）」を付けて足す。

import fs from 'node:fs';
import path from 'node:path';

import { ZipError, readZipEntry, readZipIndex } from './zip.mjs';

/** 返す文字数の上限。超えたら切って、切ったことを示す（Copilot CLI の大きな出力の上限 51,200 バイトに収まる程度） */
export const MAX_TEXT_CHARS = 16_000;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const FORMATS = { '.docx': 'docx', '.xlsx': 'xlsx', '.pptx': 'pptx' };

export class DocTextError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DocTextError';
  }
}

// ---- XML から文字を取り出す -------------------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return ENTITIES[body] ?? whole;
  });
}

/** 1つのタグ・文字を順に返す。<?xml ?>、<!-- -->、<![CDATA[ ]]> も扱う */
function* tokens(xml) {
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<([^>]+)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (m[1] !== undefined) yield { text: m[1] };
    else if (m[2] !== undefined) {
      const raw = m[2];
      const closing = raw.startsWith('/');
      const selfClosing = raw.endsWith('/');
      const name = /^\/?\s*([^\s/>]+)/.exec(raw)?.[1] ?? '';
      yield { tag: name, closing, selfClosing, raw };
    } else if (m[3] !== undefined) yield { text: decodeEntities(m[3]) };
  }
}

const attr = (raw, name) => {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`).exec(raw);
  return m ? decodeEntities(m[2] ?? m[3] ?? '') : null;
};

const localName = (name) => (typeof name === 'string' ? name.replace(/^[^:]*:/, '') : '');

/** 余分な空白と空行を整える */
function tidy(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Word（w:）と PowerPoint（a:）の XML から、文字を取り出す。
 * 段落の終わりで改行（表の中では空白）、タブと改行の印、表のセルの終わりでタブ、行の終わりで改行。
 * mc:Fallback の中は、mc:Choice と同じ文字が重なるので読み飛ばす。
 */
export function ooxmlText(xml, stopAt = Infinity) {
  let out = '';
  let inText = false;
  let tableDepth = 0;
  let fallbackDepth = 0;
  for (const t of tokens(xml)) {
    if (out.length > stopAt) break;
    if (t.text !== undefined) {
      if (inText && fallbackDepth === 0) out += t.text;
      continue;
    }
    switch (t.tag) {
      case 'mc:Fallback':
        if (!t.selfClosing) fallbackDepth += t.closing ? -1 : 1;
        break;
      case 'w:t':
      case 'a:t':
        inText = !t.closing && !t.selfClosing;
        break;
      case 'w:tab':
        if (fallbackDepth === 0) out += '\t';
        break;
      case 'w:br':
      case 'w:cr':
      case 'a:br':
        if (fallbackDepth === 0) out += '\n';
        break;
      case 'w:p':
      case 'a:p':
        if (t.closing && fallbackDepth === 0) {
          if (tableDepth > 0) out += ' ';
          else if (out !== '' && !out.endsWith('\n')) out += '\n'; // 入れ子の段落（テキストボックスなど）で、空行が重ならないように
        }
        break;
      case 'w:tbl':
      case 'a:tbl':
        if (!t.selfClosing) tableDepth = Math.max(0, tableDepth + (t.closing ? -1 : 1));
        break;
      case 'w:tc':
      case 'a:tc':
        if (t.closing && fallbackDepth === 0) out = `${out.replace(/ +$/, '')}\t`;
        break;
      case 'w:tr':
      case 'a:tr':
        if (t.closing && fallbackDepth === 0) out = `${out.replace(/[ \t]+$/, '')}\n`;
        break;
      default:
        break;
    }
  }
  return tidy(out);
}

// ---- zip の中のファイル ---------------------------------------------------------------------------

function opener(buffer) {
  const index = readZipIndex(buffer);
  return {
    names: [...index.keys()],
    has: (name) => index.has(name),
    text(name) {
      const entry = index.get(name);
      return entry ? readZipEntry(buffer, entry).toString('utf8').replace(/^﻿/, '') : null;
    },
  };
}

/** 関係の定義（.rels）から { Id: 絶対の場所 } を作る。Target は、定義のあるフォルダの 1 つ上（_rels の親）からの場所 */
function relations(zip, relsName, baseDir) {
  const xml = zip.text(relsName);
  const map = new Map();
  if (!xml) return map;
  for (const t of tokens(xml)) {
    if (t.tag !== 'Relationship' || t.closing) continue;
    const id = attr(t.raw, 'Id');
    const target = attr(t.raw, 'Target');
    if (id === null || target === null) continue;
    const resolved = target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join(baseDir, target));
    map.set(id, resolved);
  }
  return map;
}

// ---- docx ---------------------------------------------------------------------------------------

function docxText(zip, stopAt) {
  if (!zip.has('word/document.xml')) throw new DocTextError('Word 文書として読めません（word/document.xml がありません）。');
  const parts = [ooxmlText(zip.text('word/document.xml'), stopAt)];
  const extra = [
    [/^word\/header\d*\.xml$/, 'ヘッダー'],
    [/^word\/footer\d*\.xml$/, 'フッター'],
    [/^word\/footnotes\.xml$/, '脚注'],
    [/^word\/endnotes\.xml$/, '文末脚注'],
    [/^word\/comments\.xml$/, 'コメント'],
  ];
  for (const [pattern, label] of extra) {
    for (const name of zip.names.filter((n) => pattern.test(n)).sort()) {
      const text = ooxmlText(zip.text(name), stopAt);
      if (text) parts.push(`--- ${label} ---\n${text}`);
    }
  }
  return parts.filter(Boolean).join('\n\n');
}

// ---- pptx ---------------------------------------------------------------------------------------

function pptxText(zip, stopAt) {
  if (!zip.has('ppt/presentation.xml')) throw new DocTextError('PowerPoint として読めません（ppt/presentation.xml がありません）。');
  const rels = relations(zip, 'ppt/_rels/presentation.xml.rels', 'ppt');
  let slides = [];
  for (const t of tokens(zip.text('ppt/presentation.xml'))) {
    if (t.tag === 'p:sldId' && !t.closing) {
      const target = rels.get(attr(t.raw, 'r:id') ?? '');
      if (target) slides.push(target);
    }
  }
  if (slides.length === 0) {
    // 順番の定義が読めないときは、ファイル名の番号の順
    slides = zip.names
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)[1]) - Number(/(\d+)\.xml$/.exec(b)[1]));
  }
  const parts = [];
  slides.forEach((name, i) => {
    const xml = zip.text(name);
    if (xml === null) return;
    const lines = [`## スライド ${i + 1}`, ooxmlText(xml, stopAt)];
    const slideRels = relations(zip, `${path.posix.dirname(name)}/_rels/${path.posix.basename(name)}.rels`, path.posix.dirname(name));
    for (const target of slideRels.values()) {
      if (!/\/notesSlides\/[^/]+\.xml$/.test(target)) continue;
      const notes = zip.text(target);
      const text = notes ? ooxmlText(notes, stopAt) : '';
      if (text) lines.push(`（ノート）${text}`);
    }
    parts.push(lines.filter(Boolean).join('\n'));
  });
  return parts.join('\n\n');
}

// ---- xlsx ---------------------------------------------------------------------------------------

/** 共有文字列（xl/sharedStrings.xml）。<si> ごとに、<t> の文字をつなぐ（ふりがな <rPh> は除く） */
function sharedStrings(zip) {
  const xml = zip.text('xl/sharedStrings.xml');
  const list = [];
  if (!xml) return list;
  let current = null;
  let inT = false;
  let phonetic = 0;
  for (const t of tokens(xml)) {
    if (t.text !== undefined) {
      if (current !== null && inT && phonetic === 0) current += t.text;
      continue;
    }
    const name = localName(t.tag);
    if (name === 'si') {
      if (t.closing) {
        list.push(current ?? '');
        current = null;
      } else if (t.selfClosing) list.push('');
      else current = '';
    } else if (name === 'rPh') phonetic += t.closing ? -1 : t.selfClosing ? 0 : 1;
    else if (name === 't') inT = !t.closing && !t.selfClosing;
  }
  return list;
}

/** 列の記号（A、B、…、AA）から 0 始まりの番号 */
function columnIndex(ref) {
  const letters = /^[A-Za-z]+/.exec(ref ?? '')?.[0] ?? '';
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return Math.max(0, n - 1);
}

function sheetText(xml, strings, stopAt) {
  const rows = [];
  let cells = null; // 行の中のセル（列の番号 → 文字）
  let cell = null; // { col, type, value, inline, formula }
  let field = null; // 'v' | 'f' | 't'
  let inInline = false;
  let length = 0;
  for (const t of tokens(xml)) {
    if (length > stopAt) break;
    if (t.text !== undefined) {
      if (cell && field === 'v') cell.value += t.text;
      else if (cell && field === 'f') cell.formula += t.text;
      else if (cell && inInline && field === 't') cell.inline += t.text;
      continue;
    }
    const name = localName(t.tag);
    if (name === 'row') {
      if (t.closing || t.selfClosing) {
        if (cells && cells.size) {
          const max = Math.max(...cells.keys());
          const line = Array.from({ length: max + 1 }, (_, i) => cells.get(i) ?? '').join('\t');
          rows.push(line);
          length += line.length;
        }
        cells = null;
      } else cells = new Map();
    } else if (name === 'c' && cells) {
      if (t.closing) {
        let value = '';
        if (cell.type === 's') value = strings[Number(cell.value)] ?? '';
        else if (cell.type === 'inlineStr') value = cell.inline;
        else if (cell.type === 'b') value = cell.value === '1' ? 'TRUE' : cell.value === '0' ? 'FALSE' : cell.value;
        else value = cell.value;
        const formula = cell.formula.trim();
        if (formula) value = `${value}（式：=${formula}）`;
        if (value !== '') cells.set(cell.col, value);
        cell = null;
        field = null;
        inInline = false;
      } else if (t.selfClosing) {
        // 値のないセル
      } else {
        cell = { col: columnIndex(attr(t.raw, 'r')), type: attr(t.raw, 't'), value: '', inline: '', formula: '' };
      }
    } else if (cell) {
      if (name === 'v') field = t.closing || t.selfClosing ? null : 'v';
      else if (name === 'f') field = t.closing || t.selfClosing ? null : 'f';
      else if (name === 'is') inInline = !t.closing && !t.selfClosing;
      else if (name === 't') field = inInline && !t.closing && !t.selfClosing ? 't' : null;
    }
  }
  return rows.join('\n');
}

function xlsxText(zip, stopAt) {
  if (!zip.has('xl/workbook.xml')) throw new DocTextError('Excel のファイルとして読めません（xl/workbook.xml がありません）。');
  const rels = relations(zip, 'xl/_rels/workbook.xml.rels', 'xl');
  const strings = sharedStrings(zip);
  const sheets = [];
  for (const t of tokens(zip.text('xl/workbook.xml'))) {
    if (localName(t.tag) !== 'sheet' || t.closing) continue;
    sheets.push({ name: attr(t.raw, 'name') ?? '', target: rels.get(attr(t.raw, 'r:id') ?? '') ?? null, hidden: attr(t.raw, 'state') === 'hidden' });
  }
  const parts = ['注：日付のセルは、日付ではなく数値で出ます。'];
  let length = 0;
  for (const sheet of sheets) {
    if (length > stopAt) break;
    const xml = sheet.target ? zip.text(sheet.target) : null;
    const body = xml ? sheetText(xml, strings, stopAt) : '';
    const part = `## シート：${sheet.name}${sheet.hidden ? '（非表示）' : ''}\n${body || '（空）'}`;
    parts.push(part);
    length += part.length;
  }
  return parts.join('\n\n');
}

// ---- 入口 -----------------------------------------------------------------------------------------

/**
 * 文書の中の文字を返す。
 * @param {string} file 文書の場所（docx・xlsx・pptx）
 * @param {{ maxChars?: number }} [options]
 * @returns {{ format: string, text: string, totalChars: number, atLeast: boolean, truncated: boolean }}
 * @throws {DocTextError} 読めない理由（message は平易な日本語）
 */
export function documentText(file, { maxChars = MAX_TEXT_CHARS } = {}) {
  const format = FORMATS[path.extname(file).toLowerCase()];
  if (!format) {
    throw new DocTextError(
      `対応していない形式です：${path.basename(file)}。読めるのは docx・xlsx・pptx だけです（PDF や、古い形式の doc・xls・ppt は読めません）。`,
    );
  }
  let stat;
  try {
    stat = fs.statSync(file);
  } catch (error) {
    throw new DocTextError(error.code === 'ENOENT' ? `ファイルが見つかりません：${file}` : `ファイルを開けません：${file}（${error.message}）`);
  }
  if (!stat.isFile()) throw new DocTextError(`ファイルではありません：${file}`);
  if (stat.size > MAX_FILE_BYTES) throw new DocTextError(`ファイルが大きすぎて読めません（${Math.round(stat.size / 1024 / 1024)}MB）：${path.basename(file)}`);

  let buffer;
  try {
    buffer = fs.readFileSync(file);
  } catch (error) {
    throw new DocTextError(`ファイルを開けません：${file}（${error.message}）`);
  }
  if (buffer.length >= 4 && buffer.readUInt32BE(0) === 0xd0cf11e0) {
    throw new DocTextError(`読めません：${path.basename(file)}。パスワードで守られているか、古い形式のファイルの可能性があります。`);
  }

  // 途中で読むのをやめる大きさ。これを超えたときは、全体の文字数は「以上」としか分からない
  const stopAt = maxChars * 4;
  let text;
  try {
    const zip = opener(buffer);
    text = format === 'docx' ? docxText(zip, stopAt) : format === 'xlsx' ? xlsxText(zip, stopAt) : pptxText(zip, stopAt);
  } catch (error) {
    if (error instanceof DocTextError) throw error;
    if (error instanceof ZipError) throw new DocTextError(`読めません：${path.basename(file)}（${error.message}）`);
    throw new DocTextError(`読めません：${path.basename(file)}（${error.message}）`);
  }

  const chars = [...text];
  const truncated = chars.length > maxChars;
  return {
    format,
    text: truncated ? chars.slice(0, maxChars).join('') : text,
    totalChars: chars.length,
    atLeast: chars.length > stopAt, // 全体の文字数は、この数以上（途中で読むのをやめた）
    truncated,
  };
}
