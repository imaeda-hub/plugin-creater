// 画面の開始前の設定（作業ごとの設定の欄）を、ユーザー役が決める（testing.md 7章の「人と同じ流れ：設定 → 開始 → 監視 → 結果」）。
//
// 生成プラグインの作業ごとの設定の欄は、クリエイターが作るときに決まるので、模擬ユーザーの内側の課題（eval.json）の settings.task の鍵と
// 合わないのが普通である。人なら、画面の欄の見出しと説明を読み、自分がしたい作業（頼みの文と渡したファイル）から値を決めて入れる。
// ここでは、ユーザー役が欄ごとに値を決める。
//   使う順：コマンドラインの補い（--setting）＞ 課題の settings.task に同じ鍵があればそれ ＞ ユーザー役が決めた値。
//   ユーザー役に聞くのは、上の2つにない欄だけ。ユーザー役が決められなかった欄は、画面の初めの値のままにする。
//   役割ごとのモデルと繰り返しの上限は、試験の仕組みが決める（ここでは扱わない）。
// 決めた値と、聞いた文・答えは、実行の記録（decisions）に残す。

import path from 'node:path';

import { readArtifactText } from '../../../skills/test-plugin/scripts/grade.mjs';
import { joinNotes } from './user-role.mjs';

const TYPE_NAMES = { text: '文字', number: '数', select: '選択', checkbox: 'チェック', path: 'ファイルやフォルダの場所' };
/** 入力のファイルの中身を、質問に付ける長さ（文字） */
export const INPUT_PREVIEW = Object.freeze({ files: 3, chars: 800 });
/** 短い答えが「決められない・そのままでよい」の意味か（長い答えは値として扱う） */
const ABSTAIN = /決まっていません|決まってません|分かりません|わかりません|未定|そのまま|初期値|既定|デフォルト|空欄|入れません|入力しません|特にありません|特にない/;
const ABSTAIN_MAX_CHARS = 40;

/** ユーザー役に見せた、メインのエージェントが質問の前にチャットに書いた文を、記録の項目にする（なければ項目なし）。見せた文を使う側が確かめられるように */
export function notesField(notes) {
  const text = joinNotes(notes);
  return text === '' ? {} : { notes: text };
}

const optionOf = (option) =>
  typeof option === 'object' && option !== null
    ? { value: String(option.value ?? option.id ?? ''), label: String(option.label ?? option.name ?? option.value ?? option.id ?? '') }
    : { value: String(option), label: String(option) };

const firstLine = (text) => String(text ?? '').split(/\r?\n/).map((l) => l.trim()).find((l) => l !== '') ?? '';
const unwrap = (text) => text.replace(/^[「『"'`]+/, '').replace(/[」』"'`]+$/, '').replace(/[。．.]+$/, '').trim();

/** 選択肢（欄の選択肢の言葉）。チェックは「はい」「いいえ」 */
export function choicesOf(def) {
  if (def.type === 'select') return (def.options ?? []).map((o) => optionOf(o).label);
  if (def.type === 'checkbox') return ['はい（チェックを入れる）', 'いいえ（チェックを入れない）'];
  return [];
}

/**
 * 欄 1 つについて、ユーザー役に聞く文。画面で人が見るもの（見出し、説明、種類、選択肢、必須か、初めの値）と、
 * 自分が頼んだこと・渡したファイルを示す。
 * @param {object} def 作業の定義の settings の 1 件（key、label、type、default、required、help、options）
 * @param {{ prompt: string, inputs?: Array<{ path: string, preview: string | null }> }} context
 */
export function describeSetting(def, { prompt, inputs = [] }) {
  const lines = [`作業の画面を開きました。開始する前に、設定の欄「${def.label ?? def.key}」に入れる値を決めてください。`, ''];
  lines.push(`あなたが頼んだこと：${prompt}`);
  if (inputs.length > 0) {
    lines.push('あなたが渡したファイル：');
    for (const input of inputs) {
      lines.push(`- ${input.path}`);
      if (input.preview) lines.push(...input.preview.split(/\r?\n/).map((l) => `    ${l}`));
    }
  }
  lines.push('', `欄の種類：${TYPE_NAMES[def.type] ?? def.type}`);
  if (def.help) lines.push(`欄の説明：${def.help}`);
  lines.push(def.required ? 'この欄は必ず入れます。' : 'この欄は入れなくてもかまいません。');
  if (def.default !== undefined && def.default !== '' && def.default !== null) lines.push(`初めに入っている値：${def.default}`);
  const choices = choicesOf(def);
  if (choices.length > 0) lines.push(`選べるもの：${choices.join('、')}`);
  lines.push('', '入れる値だけを答えてください（説明は要りません）。決められないときは「決まっていません」と答えてください。');
  return lines.join('\n');
}

/**
 * ユーザー役の答えを、欄に入れる値にする。
 * @returns {{ ok: true, value: string | number | boolean } | { ok: false, reason: 'abstain' | 'not_a_number' | 'no_such_option' | 'unclear' }}
 */
export function normalizeSettingAnswer(def, answer) {
  const line = firstLine(answer);
  if (line === '') return { ok: false, reason: 'abstain' };
  const plain = unwrap(line);
  if (plain.length <= ABSTAIN_MAX_CHARS && ABSTAIN.test(plain)) return { ok: false, reason: 'abstain' };
  switch (def.type) {
    case 'number': {
      const match = /[-+]?\d+(?:\.\d+)?/.exec(plain.normalize('NFKC').replace(/,/g, ''));
      return match ? { ok: true, value: Number(match[0]) } : { ok: false, reason: 'not_a_number' };
    }
    case 'select': {
      const options = (def.options ?? []).map(optionOf);
      const text = plain.normalize('NFKC');
      // 答えが選択肢の言葉そのもの、または答えの中に選択肢の言葉がある（長い言葉を先に見る）
      const inside = [...options].sort((a, b) => b.label.length - a.label.length).find((o) => (o.label !== '' && text.includes(o.label.normalize('NFKC'))) || (o.value !== '' && text.includes(o.value.normalize('NFKC'))));
      return inside ? { ok: true, value: inside.value } : { ok: false, reason: 'no_such_option' };
    }
    case 'checkbox': {
      const text = plain.normalize('NFKC').toLowerCase();
      // 「いいえ」「入れない」などを先に見る（「入れる」を含まない言い方のため）
      if (/^(いいえ|オフ|入れない|しない|チェックしない|チェックを入れない|違う|false|no)/.test(text) || /(入れない|外す|オフ)/.test(text)) return { ok: true, value: false };
      if (/^(はい|オン|入れる|する|チェックする|チェックを入れる|true|yes)/.test(text) || /(入れる|オン)/.test(text)) return { ok: true, value: true };
      return { ok: false, reason: 'unclear' };
    }
    default:
      return plain === '' ? { ok: false, reason: 'abstain' } : { ok: true, value: plain };
  }
}

/** 渡したファイルの場所と、中身の先頭（質問に付ける）。読めない・文字にできないものは中身なし */
export async function previewInputs(inputs, workDir) {
  const out = [];
  for (const rel of [...inputs.keys()].sort().slice(0, INPUT_PREVIEW.files)) {
    const read = await readArtifactText(path.join(workDir, ...rel.split('/')), { maxChars: INPUT_PREVIEW.chars });
    out.push({ path: rel, preview: read.text === null ? null : `${read.text.trim()}${read.truncated ? '\n…' : ''}` });
  }
  return out;
}

/**
 * 開始前の設定の値を決める。
 * @param {object} o
 * @param {Array} o.definitions 画面の開始前の設定の欄（core の状態の setup.taskSettings）
 * @param {object} [o.fromEval] 課題の settings.task
 * @param {object} [o.fromCli] コマンドラインの補い（--setting）
 * @param {Function} o.userRole ({ question, choices, history, via, meta }) => Promise<string>
 * @param {string} o.prompt 課題の頼みの文
 * @param {Array} [o.inputs] previewInputs の結果
 * @param {Array} [o.history]
 * @param {() => string[]} [o.takeNotes] メインのエージェントがチャットに書いた文のうち、まだユーザー役に渡していないものを取り出す（取り出したものは、次からは出ない）。
 *   最初にユーザー役に聞く欄にだけ付く（画面を開いたと伝える文などを、人は設定の前に読む）
 * @returns {Promise<{ values: object, decisions: Array }>}
 *   values は画面の欄に入れる { 鍵: 値 }（決めた分と、課題・補いの分）。decisions は欄ごとの記録
 *   decisions[].source：cli、eval-json、user-role（ユーザー役が決めた）、default（ユーザー役が決められず、初めの値のまま）
 */
export async function decideSettings({ definitions, fromEval = {}, fromCli = {}, userRole, prompt, inputs = [], history = [], takeNotes = () => [] }) {
  const values = {};
  const decisions = [];
  for (const def of definitions ?? []) {
    const base = { key: def.key, label: def.label ?? def.key, type: def.type, required: Boolean(def.required) };
    if (Object.hasOwn(fromCli, def.key)) {
      values[def.key] = fromCli[def.key];
      decisions.push({ ...base, source: 'cli', value: fromCli[def.key] });
      continue;
    }
    if (Object.hasOwn(fromEval, def.key)) {
      values[def.key] = fromEval[def.key];
      decisions.push({ ...base, source: 'eval-json', value: fromEval[def.key] });
      continue;
    }
    const question = describeSetting(def, { prompt, inputs });
    const choices = choicesOf(def);
    const notes = takeNotes();
    const answer = String(await userRole({ question, choices, history: [...history], via: 'setting', meta: { setting: def.key }, notes }) ?? '');
    history.push({ via: 'setting', question, choices, answer, ...notesField(notes) });
    const parsed = normalizeSettingAnswer(def, answer);
    if (parsed.ok) {
      values[def.key] = parsed.value;
      decisions.push({ ...base, source: 'user-role', value: parsed.value, question, answer, ...notesField(notes) });
    } else {
      decisions.push({ ...base, source: 'default', value: def.default ?? null, question, answer, ...notesField(notes), note: parsed.reason });
    }
  }
  // 欄にない鍵も、課題の settings.task と補いにあれば入れる（画面が受けない鍵は screen.mjs が断る）
  for (const source of [fromEval, fromCli]) {
    for (const [key, value] of Object.entries(source)) if (!Object.hasOwn(values, key)) values[key] = value;
  }
  return { values, decisions };
}
