// 2段目 部品の試験（クリエイターのエクステンション）：文書をテキストにするツール（plugin-creator_doc_text）。
// 設計書：hearing.md 9章、12章「2段目」。docx・xlsx・pptx の中の文字を、外部のパッケージなしで返す。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

import { EXTENSION_DIR, tempDir, withRun } from './helpers.mjs';
import { makeZip, sampleDocx, samplePptx, sampleXlsx } from './ooxml.mjs';

const { documentText, MAX_TEXT_CHARS, DocTextError } = await import(pathToFileURL(path.join(EXTENSION_DIR, 'doc-text.mjs')).href);

function withFiles(files, fn) {
  const dir = tempDir('doc');
  try {
    for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('文書をテキストにする', () => {
  test('REQ-017 見本の docx の中の文字（本文、表、タブ、改行、ヘッダー、フッター、脚注、コメント）を返す', () => {
    withFiles({ 'sample.docx': sampleDocx() }, (dir) => {
      const { format, text, truncated } = documentText(path.join(dir, 'sample.docx'));
      assert.equal(format, 'docx');
      assert.equal(truncated, false);
      const lines = text.split('\n');
      assert.equal(lines[0], '週報の書き方');
      assert.ok(lines.includes('毎週金曜日の17時までに提出する。'), '複数の run に分かれた文字をつなぐ');
      assert.ok(lines.includes('提出先は 営業部 & 総務部（田中さん）'), '文字参照（&amp;）を戻す');
      assert.ok(lines.includes('項目\t内容'), 'タブ');
      assert.ok(lines.includes('改行の次の行'), '改行');
      assert.ok(lines.includes('日付\t実績 （2段目）'), '表：セルをタブで区切る。セルの中の段落は空白でつなぐ');
      assert.ok(lines.includes('月\t資料作成'), '表：行を改行で区切る');
      assert.equal(lines.filter((l) => l === '枠の中の注意書き').length, 1, 'テキストボックスの文字が重ならない');
      assert.ok(lines.includes('残った文字') && !text.includes('消された文字'), '消された文字（delText）は出さない');
      assert.ok(lines.includes('あい <タグ> "引用"'), '数値の文字参照と名前の文字参照');
      assert.match(text, /--- ヘッダー ---\nヘッダーの会社名/);
      assert.match(text, /--- フッター ---\nフッターのページ/);
      assert.match(text, /--- 脚注 ---\n脚注の文字/);
      assert.match(text, /--- コメント ---\nコメントの文字/);
      assert.ok(!text.includes('\n\n\n'), '空行が続かない');
    });
  });

  test('REQ-017 見本の xlsx の中の文字（シート、共有文字列、数、真偽、式、インライン文字列、列の飛び、非表示のシート）を返す', () => {
    withFiles({ 'sample.xlsx': sampleXlsx() }, (dir) => {
      const { format, text } = documentText(path.join(dir, 'sample.xlsx'));
      assert.equal(format, 'xlsx');
      assert.equal(
        text,
        [
          '注：日付のセルは、日付ではなく数値で出ます。',
          '',
          '## シート：集計 & 明細',
          '項目\t金額\t\t備考（インライン）',
          '交通費 & 宿泊費\t1200\tTRUE',
          '合計\t1200（式：=SUM(B2:B2)）\t計です（式：="計"&"です"）',
          '',
          '## シート：隠し（非表示）',
          '隠しシート',
        ].join('\n'),
      );
      assert.ok(!text.includes('キンガク'), 'ふりがなは出さない');
    });
  });

  test('REQ-017 見本の pptx の中の文字を、スライドの順番どおりに返す（ノート、表つき。マスターの文字は出さない）', () => {
    withFiles({ 'sample.pptx': samplePptx() }, (dir) => {
      const { format, text } = documentText(path.join(dir, 'sample.pptx'));
      assert.equal(format, 'pptx');
      assert.equal(
        text,
        [
          '## スライド 1',
          '一枚目のタイトル',
          '1行目',
          '2行目',
          '（ノート）一枚目のノート',
          '',
          '## スライド 2',
          '二枚目のタイトル',
          '二枚目の本文',
          '見出しA\t見出しB',
          '値A\t値B',
        ].join('\n'),
      );
      assert.ok(!text.includes('マスター'));
    });
  });

  test('REQ-017 圧縮しないで保存された zip の中のファイルも読める。拡張子の大文字小文字は問わない', () => {
    const stored = makeZip(
      {
        'word/document.xml': '<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>無圧縮の本文</w:t></w:r></w:p></w:body></w:document>',
      },
      { stored: ['word/document.xml'] },
    );
    withFiles({ 'STORED.DOCX': stored }, (dir) => {
      assert.equal(documentText(path.join(dir, 'STORED.DOCX')).text, '無圧縮の本文');
    });
  });

  test('REQ-017 長い文書は切り詰めて、切り詰めたことを示す（ツールの返り値に全体の文字数を添える）', async () => {
    const paragraph = `<w:p><w:r><w:t>${'あ'.repeat(99)}。</w:t></w:r></w:p>`;
    const docx = makeZip({ 'word/document.xml': `<w:document xmlns:w="x"><w:body>${paragraph.repeat(400)}</w:body></w:document>` });
    withFiles({ 'long.docx': docx }, (dir) => {
      const result = documentText(path.join(dir, 'long.docx'));
      assert.equal(result.truncated, true);
      assert.equal([...result.text].length, MAX_TEXT_CHARS);
      assert.equal(result.totalChars, 400 * 100 + 399);
    });
    await withRun(async (run) => {
      fs.writeFileSync(path.join(run.cwd, 'long.docx'), docx);
      const text = await run.call('doc_text', { path: 'long.docx' });
      assert.match(text, /^ファイル：long\.docx（docx、全体で40399文字）\n\n/);
      assert.match(text, /（長いため、先頭の16000文字で切りました。全体は40399文字です。残りは読めません）$/);
      assert.ok(Buffer.byteLength(text, 'utf8') < 51_200, 'Copilot CLI の大きな出力の上限（51,200バイト）に収める');
    });
  });

  test('REQ-017 とても長い文書は、途中で読むのをやめ、全体の文字数は「以上」と示す', async () => {
    const paragraph = `<w:p><w:r><w:t>${'い'.repeat(99)}。</w:t></w:r></w:p>`;
    const docx = makeZip({ 'word/document.xml': `<w:document xmlns:w="x"><w:body>${paragraph.repeat(1000)}</w:body></w:document>` });
    await withRun(async (run) => {
      fs.writeFileSync(path.join(run.cwd, 'huge.docx'), docx);
      const text = await run.call('doc_text', { path: 'huge.docx' });
      assert.match(text, /^ファイル：huge\.docx（docx、全体で\d+文字以上）\n\n/);
      assert.match(text, /（長いため、先頭の16000文字で切りました。全体は\d+文字以上です。残りは読めません）$/);
    });
  });

  test('REQ-017 ツールは、作業フォルダからの相対パスでも、絶対パスでも読める。返り値の先頭にファイル名と形式を示す', async () => {
    await withRun(async (run) => {
      fs.mkdirSync(path.join(run.cwd, 'inputs'));
      fs.writeFileSync(path.join(run.cwd, 'inputs', '前回の週報.docx'), sampleDocx());
      const relative = await run.call('doc_text', { path: 'inputs/前回の週報.docx' });
      assert.match(relative, /^ファイル：前回の週報\.docx（docx、全体で\d+文字）\n\n週報の書き方\n/);
      const outside = tempDir('outside');
      try {
        fs.writeFileSync(path.join(outside, '集計.xlsx'), sampleXlsx());
        const absolute = await run.call('doc_text', { path: path.join(outside, '集計.xlsx') });
        assert.match(absolute, /^ファイル：集計\.xlsx（xlsx、全体で\d+文字）/, '作業フォルダの外の文書も読める');
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    });
  });

  test('REQ-017 読めないファイルは、理由を返す（対応していない形式、見つからない、フォルダ、パスワードや古い形式、zip でない、暗号化、壊れている）', async () => {
    const big = Buffer.alloc(70 * 1024 * 1024);
    await withRun(async (run) => {
      const put = (name, content) => fs.writeFileSync(path.join(run.cwd, name), content);
      fs.mkdirSync(path.join(run.cwd, 'folder.docx'));
      put('old.doc', 'x');
      put('doc.pdf', 'x');
      put('legacy.xlsx', Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(600)]));
      put('plain.docx', Buffer.from('これは zip ではありません。'.repeat(10)));
      put('empty.docx', '');
      put('secret.docx', makeZip({ 'word/document.xml': '<w:document/>' }, { encrypted: ['word/document.xml'] }));
      put('noword.docx', makeZip({ 'hello.txt': 'x' }));
      put('noexcel.xlsx', makeZip({ 'hello.txt': 'x' }));
      put('nopoint.pptx', makeZip({ 'hello.txt': 'x' }));
      put('bomb.docx', makeZip({ 'word/document.xml': big }));
      const truncatedZip = sampleDocx().subarray(0, 120);
      put('cut.docx', truncatedZip);

      const read = async (p) => {
        const r = await run.callSafe('doc_text', { path: p });
        assert.equal(r.ok, false, p);
        return r.error;
      };
      assert.match(await read('old.doc'), /対応していない形式です：old\.doc。読めるのは docx・xlsx・pptx だけです（PDF や、古い形式の doc・xls・ppt は読めません）。/);
      assert.match(await read('doc.pdf'), /対応していない形式です/);
      assert.match(await read('missing.docx'), /ファイルが見つかりません：.*missing\.docx/);
      assert.match(await read('folder.docx'), /ファイルではありません/);
      assert.match(await read('legacy.xlsx'), /パスワードで守られているか、古い形式のファイルの可能性があります/);
      assert.match(await read('plain.docx'), /読めません：plain\.docx（zip として読めません（終わりの印がありません））/);
      assert.match(await read('empty.docx'), /読めません：empty\.docx（zip として読めません（小さすぎます））/);
      assert.match(await read('secret.docx'), /暗号化されていて読めません：word\/document\.xml/);
      assert.match(await read('noword.docx'), /Word 文書として読めません（word\/document\.xml がありません）/);
      assert.match(await read('noexcel.xlsx'), /Excel のファイルとして読めません/);
      assert.match(await read('nopoint.pptx'), /PowerPoint として読めません/);
      assert.match(await read('bomb.docx'), /大きすぎて読めません：word\/document\.xml/);
      assert.match(await read('cut.docx'), /読めません：cut\.docx/);
      const noPath = await run.callSafe('doc_text', {});
      assert.match(noPath.error, /文書の場所（path）を渡してください/);
    });
  });

  test('hearing.md 9章 文書をテキストにする部品は、DocTextError で理由を投げ、外部のパッケージを使わない（node:zlib だけ）', () => {
    assert.throws(() => documentText('/no/such/file.docx'), DocTextError);
    const source = fs.readFileSync(path.join(EXTENSION_DIR, 'zip.mjs'), 'utf8') + fs.readFileSync(path.join(EXTENSION_DIR, 'doc-text.mjs'), 'utf8');
    for (const m of source.matchAll(/from\s+'([^']+)'/g)) assert.ok(m[1].startsWith('node:') || m[1].startsWith('./'), m[1]);
    assert.ok(zlib.inflateRawSync, 'node:zlib がある');
  });
});
