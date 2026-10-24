// 採点（skills/test-plugin/scripts/grade.mjs）の試験。モデルは使わない（判定の関数は偽物）。
// 確かめる要件：REQ-041（EVAL の採点。基準を壊すと不合格になる、採点は生成プラグインの外）、REQ-038（課題と基準の形）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, test } from 'node:test';

import { sampleDocx, sampleXlsx } from '../extension/ooxml.mjs';
import { cleanupTemp, loadScript, sampleTask, tempWith } from './helpers.mjs';

const grade = await loadScript('grade.mjs');
after(cleanupTemp);

const listOf = (dir, inputs) => grade.listFiles(dir, { inputs });
const program = (check, dir, inputs) => grade.gradeProgram(check, listOf(dir, inputs));

describe('グロブ', () => {
  const m = (pattern, rel) => grade.globToRegExp(pattern).test(rel);

  test('REQ-041 * は / を越えず、** は越える', () => {
    assert.equal(m('out/*.md', 'out/a.md'), true);
    assert.equal(m('out/*.md', 'out/sub/a.md'), false);
    assert.equal(m('out/**', 'out/sub/a.md'), true);
    assert.equal(m('**/*.md', 'a.md'), true, '**/ は0個以上のフォルダ');
    assert.equal(m('**/*.md', 'x/y/a.md'), true);
    assert.equal(m('**/a.md', 'xa.md'), false);
  });

  test('REQ-041 ?・[ ]・{ } が使える。. や ( ) などの記号は文字として扱う', () => {
    assert.equal(m('w?.txt', 'w1.txt'), true);
    assert.equal(m('w?.txt', 'w12.txt'), false);
    assert.equal(m('週報_[0-9][0-9].md', '週報_42.md'), true);
    assert.equal(m('週報_[!0-9].md', '週報_a.md'), true);
    assert.equal(m('週報_[!0-9].md', '週報_4.md'), false);
    assert.equal(m('out/*.{md,txt}', 'out/a.txt'), true);
    assert.equal(m('out/*.{md,txt}', 'out/a.docx'), false);
    assert.equal(m('a.b(1).md', 'a.b(1).md'), true);
    assert.equal(m('a.b(1).md', 'aXb(1).md'), false, '. は任意の1文字ではない');
    assert.equal(m('a+b.md', 'a+b.md'), true);
  });

  test('REQ-041 大文字小文字は区別し、Unicode の正規化形式（NFC と NFD）の違いは吸収する', () => {
    assert.equal(m('Out/A.md', 'out/a.md'), false);
    assert.equal(m('ガ.md', 'ガ.md'.normalize('NFD')), false, '正規表現は NFC で作るので、NFD の相対の場所は先に正規化して渡す');
    assert.equal(m('ガ.md', grade.normalizeRelPath('ガ.md'.normalize('NFD'))), true);
    assert.equal(grade.normalizeRelPath('a\\b/c'), 'a/b/c');
  });
});

describe('課題と基準の確かめ（eval.json）', () => {
  test('REQ-038 BLUEPRINT 4.3 の形の課題は、誤りなしと読まれる', () => {
    assert.deepEqual(grade.validateTask(sampleTask()), []);
    const withModel = sampleTask();
    withModel.criteria.push({ id: 'C-03', text: '読みやすい', grading: 'model' });
    withModel.criteria.push({ id: 'C-04', text: '読みやすい', grading: 'model', check: { files: ['out/*.md'] } });
    assert.deepEqual(grade.validateTask(withModel), []);
  });

  test('REQ-038 program の4種類の check が、それぞれ受け付けられる', () => {
    for (const check of [
      { type: 'file_exists', file: 'out/*.md' },
      { type: 'contains', file: 'out/*.md', text: '52万円' },
      { type: 'not_contains', file: 'out/*.md', text: '個人名' },
      { type: 'regex', file: 'out/*.md', pattern: '\\d+万円', flags: 'iu' },
    ]) {
      assert.deepEqual(grade.validateCheck(check), [], JSON.stringify(check));
    }
    assert.deepEqual(Object.keys(grade.CHECK_TYPES), ['file_exists', 'contains', 'not_contains', 'regex']);
  });

  test('REQ-038 check の誤りが、どこが誤りかの文で返る', () => {
    const problem = (check) => grade.validateCheck(check, 'C').join(' / ');
    assert.match(problem(undefined), /C がない（program の基準には check が要る）/);
    assert.match(problem({ type: 'startsWith', file: 'a' }), /startsWith.*使えない/);
    assert.match(problem({ type: 'contains', file: 'a' }), /text がない/);
    assert.match(problem({ type: 'contains', text: 'x' }), /file がない/);
    assert.match(problem({ type: 'contains', file: 'a', text: '' }), /text は/);
    assert.match(problem({ type: 'contains', file: 'a', text: 'x', pattern: 'y' }), /項目「pattern」/, '知らない項目は誤り（つづりの間違いを見つけるため）');
    assert.match(problem({ type: 'file_exists', file: '/etc/passwd' }), /絶対の場所/);
    assert.match(problem({ type: 'file_exists', file: '../x' }), /\.\. は使えない/);
    assert.match(problem({ type: 'file_exists', file: 'out\\a.md' }), /区切りを \//);
    assert.match(problem({ type: 'regex', file: 'a', pattern: '(' }), /正規表現として読めない/);
    assert.match(problem({ type: 'regex', file: 'a', pattern: 'x', flags: 'g' }), /flags/);
    assert.match(problem({ type: 'regex', file: 'a', pattern: 'x', flags: 'ii' }), /flags/);
  });

  test('REQ-038 課題の誤りが返る（id・prompt・基準・grading・id の重なり・入力・設定）', () => {
    const problems = (task) => grade.validateTask(task, 'T').join('\n');
    assert.match(problems(null), /オブジェクトではない/);
    assert.match(problems({ criteria: [] }), /id がない/);
    assert.match(problems({ id: 'T', criteria: [] }), /prompt/);
    assert.match(problems({ id: 'T', prompt: 'p' }), /criteria/);
    assert.match(problems({ id: 'T', prompt: 'p', criteria: [{ id: 'C', text: 't', grading: 'ai' }] }), /grading は program か model/);
    assert.match(problems({ id: 'T', prompt: 'p', criteria: [{ id: 'C', text: 't', grading: 'program' }] }), /check がない/);
    assert.match(problems({ id: 'T', prompt: 'p', criteria: [{ id: 'C', text: '', grading: 'model' }] }), /text/);
    assert.match(
      problems({ id: 'T', prompt: 'p', criteria: [{ id: 'C', text: 'a', grading: 'model' }, { id: 'C', text: 'b', grading: 'model' }] }),
      /id「C」が重なっている/,
    );
    assert.match(problems({ id: 'T', prompt: 'p', inputs: ['/abs/x.docx'], criteria: [{ id: 'C', text: 'a', grading: 'model' }] }), /inputs\[0\]/);
    assert.match(problems({ id: 'T', prompt: 'p', inputs: ['../x'], criteria: [{ id: 'C', text: 'a', grading: 'model' }] }), /inputs\[0\]/);
    assert.match(problems({ id: 'T', prompt: 'p', settings: { maxIterations: 0 }, criteria: [{ id: 'C', text: 'a', grading: 'model' }] }), /maxIterations/);
    assert.match(problems({ id: 'T', prompt: 'p', settings: { task: { week: { a: 1 } } }, criteria: [{ id: 'C', text: 'a', grading: 'model' }] }), /settings\.task\.week/);
    assert.match(problems({ id: 'T', prompt: 'p', criteria: [{ id: 'C', text: 'a', grading: 'model', check: { type: 'contains' } }] }), /model の基準では使わない/);
  });
});

describe('作業フォルダの中のファイル', () => {
  test('REQ-041 一覧は相対の場所（/ 区切り）で、シンボリックリンクと node_modules・.git の中は数えない', () => {
    const dir = tempWith({ 'out/a.md': 'x', 'out/sub/b.md': 'y', 'node_modules/p/i.js': 'z', '.git/config': 'c', '週報.txt': 'w' });
    const outside = tempWith({ 'secret.md': 'S' });
    fs.symlinkSync(path.join(outside, 'secret.md'), path.join(dir, 'out', 'link.md'));
    fs.symlinkSync(outside, path.join(dir, 'linked-dir'));
    const paths = listOf(dir).map((f) => f.path);
    assert.deepEqual(paths, ['out/a.md', 'out/sub/b.md', '週報.txt']);
  });

  test('REQ-041 中身が変わっていない入力は印が付き、書き換えた入力には付かない', () => {
    const dir = tempWith({ 'inputs/前回.md': '前回の本文', 'inputs/規則.md': '規則', 'out/今回.md': '今回' });
    const inputs = new Map([
      ['inputs/前回.md', grade.sha256OfFile(path.join(dir, 'inputs/前回.md'))],
      ['inputs/規則.md', grade.sha256OfFile(path.join(dir, 'inputs/規則.md'))],
    ]);
    fs.writeFileSync(path.join(dir, 'inputs/規則.md'), '規則を書き換えた');
    const byPath = Object.fromEntries(listOf(dir, inputs).map((f) => [f.path, f.unchangedInput]));
    assert.deepEqual(byPath, { 'inputs/前回.md': true, 'inputs/規則.md': false, 'out/今回.md': false });
  });
});

describe('ファイルの中の文字', () => {
  test('REQ-041 UTF-8（BOM つきを含む）と Shift_JIS は文字として読み、NUL を含むものは文字にしない', async () => {
    const sjis = Buffer.from([0x8f, 0x54, 0x95, 0xf1]); // 週報（Shift_JIS）
    const dir = tempWith({
      'u.txt': '週報です',
      'bom.csv': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('項目,金額\n')]),
      's.csv': sjis,
      'bin.dat': Buffer.from([0x50, 0x4b, 0x00, 0x01, 0x02]),
      'noext': '拡張子のない文字',
    });
    const read = (name) => grade.readArtifactText(path.join(dir, name));
    assert.equal((await read('u.txt')).text, '週報です');
    assert.equal((await read('bom.csv')).text, '項目,金額\n');
    assert.deepEqual(await read('s.csv'), { kind: 'text', text: '週報', truncated: false });
    assert.equal((await read('bin.dat')).kind, 'binary');
    assert.equal((await read('bin.dat')).text, null);
    assert.equal((await read('noext')).text, '拡張子のない文字');
    assert.equal((await read('missing.txt')).kind, 'unreadable');
  });

  test('REQ-041 長い文字は上限で切り、切ったことが分かる', async () => {
    const dir = tempWith({ 'long.txt': 'あ'.repeat(50) });
    const out = await grade.readArtifactText(path.join(dir, 'long.txt'), { maxChars: 10 });
    assert.equal(out.text, 'あ'.repeat(10));
    assert.equal(out.truncated, true);
  });

  test('REQ-041 docx・xlsx の中の文字を取り出せる（複数の run にまたがる文字も）', async () => {
    const dir = tempWith({ '週報.docx': sampleDocx(), '集計.xlsx': sampleXlsx() });
    const docx = await grade.readArtifactText(path.join(dir, '週報.docx'));
    assert.equal(docx.kind, 'office');
    assert.match(docx.text, /毎週金曜日の17時までに提出する。/);
    const xlsx = await grade.readArtifactText(path.join(dir, '集計.xlsx'));
    assert.match(xlsx.text, /交通費 & 宿泊費\t1200/);
  });

  test('REQ-041 壊れた docx は、読めなかった理由つきで unreadable になる', async () => {
    const dir = tempWith({ 'bad.docx': 'zip ではない' });
    const out = await grade.readArtifactText(path.join(dir, 'bad.docx'));
    assert.equal(out.kind, 'unreadable');
    assert.equal(out.text, null);
    assert.ok(out.note);
  });
});

describe('program の採点', () => {
  test('REQ-041 file_exists：空でないファイルがあれば合格。ないとき、空のファイルだけのときは不合格で、理由が違う', async () => {
    const check = { type: 'file_exists', file: 'out/*.md' };
    const ok = await program(check, tempWith({ 'out/週報.md': '本文' }));
    assert.equal(ok.pass, true);
    assert.match(ok.reason, /out\/週報\.md/);
    const none = await program(check, tempWith({ 'out/週報.docx': 'x' }));
    assert.equal(none.pass, false);
    assert.match(none.reason, /当てはまるファイルがない/);
    const empty = await program(check, tempWith({ 'out/週報.md': '' }));
    assert.equal(empty.pass, false);
    assert.match(empty.reason, /中身が空/);
  });

  test('REQ-041 contains：文字があれば合格。なければ不合格で、調べたファイルが理由に出る', async () => {
    const dir = tempWith({ 'out/a.md': '売上は52万円でした', 'out/b.md': '特になし' });
    const hit = await program({ type: 'contains', file: 'out/*.md', text: '52万円' }, dir);
    assert.equal(hit.pass, true);
    assert.match(hit.reason, /out\/a\.md/);
    const miss = await program({ type: 'contains', file: 'out/*.md', text: '60万円' }, dir);
    assert.equal(miss.pass, false);
    assert.match(miss.reason, /60万円/);
    assert.match(miss.reason, /out\/a\.md、out\/b\.md/);
    const noFile = await program({ type: 'contains', file: 'out/*.txt', text: '52万円' }, dir);
    assert.equal(noFile.pass, false);
    assert.match(noFile.reason, /当てはまるファイルがない/);
  });

  test('REQ-041 contains：「52万」と書いた成果物は、「52万円」を求める基準で不合格になる', async () => {
    const dir = tempWith({ 'out/a.md': '売上は52万でした' });
    assert.equal((await program({ type: 'contains', file: 'out/a.md', text: '52万円' }, dir)).pass, false);
    assert.equal((await program({ type: 'contains', file: 'out/a.md', text: '52万' }, dir)).pass, true);
  });

  test('REQ-041 contains：改行の形（CRLF）と Unicode の正規化形式が違っても見つかる', async () => {
    const dir = tempWith({ 'out/a.md': Buffer.from('1行目\r\n2行目 ガ'.replace('ガ', 'ガ'.normalize('NFD'))) });
    assert.equal((await program({ type: 'contains', file: 'out/a.md', text: '1行目\n2行目 ガ' }, dir)).pass, true);
  });

  test('REQ-041 contains：docx の中の文字（複数の run にまたがる）と xlsx の中の文字を調べられる', async () => {
    const dir = tempWith({ 'out/週報.docx': sampleDocx(), 'out/集計.xlsx': sampleXlsx() });
    assert.equal((await program({ type: 'contains', file: 'out/*.docx', text: '金曜日の17時までに' }, dir)).pass, true);
    assert.equal((await program({ type: 'contains', file: 'out/*.xlsx', text: '合計' }, dir)).pass, true);
    assert.equal((await program({ type: 'contains', file: 'out/*.docx', text: '消された文字' }, dir)).pass, false, '消された文字は出ない');
  });

  test('REQ-041 contains：文字にできないファイルしかなければ、見つからない（理由に調べられなかったことが出る）', async () => {
    const dir = tempWith({ 'out/a.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]) });
    const out = await program({ type: 'contains', file: 'out/*.png', text: 'x' }, dir);
    assert.equal(out.pass, false);
    assert.match(out.reason, /調べられなかったファイル：out\/a\.png/);
  });

  test('REQ-041 not_contains：どのファイルにもなければ合格。あれば不合格。当てはまるファイルがなければ不合格（作られていないのに合格にしない）', async () => {
    const dir = tempWith({ 'out/a.md': '山田さんの週報', 'out/b.md': '匿名の週報' });
    assert.equal((await program({ type: 'not_contains', file: 'out/*.md', text: '佐藤' }, dir)).pass, true);
    const bad = await program({ type: 'not_contains', file: 'out/*.md', text: '山田' }, dir);
    assert.equal(bad.pass, false);
    assert.match(bad.reason, /out\/a\.md/);
    const none = await program({ type: 'not_contains', file: 'out/*.txt', text: '山田' }, dir);
    assert.equal(none.pass, false);
    assert.match(none.reason, /当てはまるファイルがない/);
  });

  test('REQ-041 not_contains：文字にできないファイルがあるときは、ないと言い切れないので不合格', async () => {
    const dir = tempWith({ 'out/a.md': '匿名', 'out/b.dat': Buffer.from([0, 1, 2, 3]) });
    const out = await program({ type: 'not_contains', file: 'out/*', text: '山田' }, dir);
    assert.equal(out.pass, false);
    assert.match(out.reason, /確かめきれない/);
  });

  test('REQ-041 regex：合えば合格、合わなければ不合格。flags が効く', async () => {
    const dir = tempWith({ 'out/a.md': '売上: 52万円\nHELLO' });
    assert.equal((await program({ type: 'regex', file: 'out/a.md', pattern: '\\d+万円' }, dir)).pass, true);
    assert.equal((await program({ type: 'regex', file: 'out/a.md', pattern: '^売上: \\d+万円$', flags: 'm' }, dir)).pass, true);
    assert.equal((await program({ type: 'regex', file: 'out/a.md', pattern: '^売上: \\d+万円$' }, dir)).pass, false, 'm がなければ行頭・行末ではない');
    assert.equal((await program({ type: 'regex', file: 'out/a.md', pattern: 'hello' }, dir)).pass, false);
    assert.equal((await program({ type: 'regex', file: 'out/a.md', pattern: 'hello', flags: 'i' }, dir)).pass, true);
    const miss = await program({ type: 'regex', file: 'out/a.md', pattern: '\\d+億円' }, dir);
    assert.equal(miss.pass, false);
    assert.match(miss.reason, /パターン「\\d\+億円」/);
  });

  test('REQ-041 最後の行が決まった文字であることも、regex で採点できる', async () => {
    const check = { type: 'regex', file: 'out/a.md', pattern: '以上\\s*$' };
    assert.equal((await program(check, tempWith({ 'out/a.md': '本文\n以上\n' }))).pass, true);
    assert.equal((await program(check, tempWith({ 'out/a.md': '以上\n本文\n' }))).pass, false);
  });

  test('REQ-041 課題の入力として写して、変わっていないファイルだけでは合格しない', async () => {
    const dir = tempWith({ 'inputs/前回の週報.md': '売上は52万円', 'out/今回.md': '売上は未記入' });
    const inputs = new Map([['inputs/前回の週報.md', grade.sha256OfFile(path.join(dir, 'inputs/前回の週報.md'))]]);
    const check = { type: 'contains', file: '**/*.md', text: '52万円' };
    assert.equal((await program(check, dir, inputs)).pass, false, '入力の「52万円」は数えない');
    assert.equal((await program({ type: 'file_exists', file: 'inputs/*.md' }, dir, inputs)).pass, false);
    fs.writeFileSync(path.join(dir, 'inputs/前回の週報.md'), '売上は52万円（書き換えた）');
    assert.equal((await program(check, dir, inputs)).pass, true, '書き換えた入力は数える');
  });
});

describe('実行1回の採点', () => {
  const good = { 'out/週報.md': '売上は52万円です。\n以上\n' };

  test('REQ-041 基準を満たさないように壊した成果物では、その基準だけが不合格になる', async () => {
    const task = sampleTask();
    const okRun = await grade.gradeRun({ task, workDir: tempWith(good) });
    assert.deepEqual(okRun.results.map((r) => r.pass), [true, true]);
    assert.equal(okRun.score, 1);
    assert.equal(okRun.passed, 2);
    assert.equal(okRun.total, 2);
    assert.equal(okRun.errors, 0);

    const broken = await grade.gradeRun({ task, workDir: tempWith({ 'out/週報.md': '売上は52万でした' }) });
    assert.deepEqual(broken.results.map((r) => [r.id, r.pass]), [['C-01', true], ['C-02', false]]);
    assert.equal(broken.score, 0.5);

    const missing = await grade.gradeRun({ task, workDir: tempWith({}) });
    assert.deepEqual(missing.results.map((r) => r.pass), [false, false]);
    assert.equal(missing.score, 0);
  });

  test('REQ-041 結果は基準の id・文・採点のしかた・合否・理由を持つ', async () => {
    const run = await grade.gradeRun({ task: sampleTask(), workDir: tempWith(good) });
    assert.deepEqual(Object.keys(run.results[0]), ['id', 'text', 'grading', 'pass', 'reason']);
    assert.equal(run.results[1].text, '金額を「52万円」の形で書く');
    assert.equal(run.results[1].grading, 'program');
    assert.ok(run.results[1].reason.length > 0);
  });

  test('REQ-041 採点は成果物と基準だけで決まる（検証エージェントの合否を渡す口がなく、成果物の中の「合格」の文字も効かない）', async () => {
    assert.equal(grade.gradeRun.length, 1, 'gradeRun は引数1つ（オブジェクト）で、その中に合否を受け取る項目はない');
    const dir = tempWith({ 'verdicts.json': JSON.stringify({ 'C-01': 'pass', 'C-02': 'pass' }), 'out/週報.md': '' });
    const run = await grade.gradeRun({ task: sampleTask(), workDir: dir, verdicts: { 'C-01': true, 'C-02': true } });
    assert.deepEqual(run.results.map((r) => r.pass), [false, false]);
  });

  test('REQ-041 得点は、合格の基準の数 ÷ 基準の数。基準がなければ null', () => {
    assert.equal(grade.scoreOf([{ pass: true }, { pass: false }, { pass: true }, { pass: true }]), 0.75);
    assert.equal(grade.scoreOf([]), null);
  });
});

describe('model の判定（判定の関数は偽物）', () => {
  const modelTask = () =>
    sampleTask({
      criteria: [
        { id: 'C-01', text: '読みやすい', grading: 'model' },
        { id: 'C-02', text: '要点が3つ以内', grading: 'model', check: { files: ['out/*.md'] } },
      ],
    });

  test('REQ-041 判定の関数に、基準の文・課題の依頼・成果物の文字が渡り、その返事が合否になる', async () => {
    const calls = [];
    const judge = async (args) => {
      calls.push(args);
      return { pass: args.criterion.id === 'C-01', reason: `${args.criterion.id} の理由` };
    };
    const dir = tempWith({ 'out/週報.md': '本文です', 'notes/memo.txt': 'メモ' });
    const run = await grade.gradeRun({ task: modelTask(), workDir: dir, judge });
    assert.deepEqual(run.results.map((r) => [r.id, r.pass, r.reason]), [['C-01', true, 'C-01 の理由'], ['C-02', false, 'C-02 の理由']]);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0].criterion, { id: 'C-01', text: '読みやすい', check: undefined });
    assert.equal(calls[0].task.prompt, '週報を作ってください。対象は 2026-W42 です。');
    assert.deepEqual(calls[0].artifacts.map((a) => a.path), ['notes/memo.txt', 'out/週報.md'], 'check.files がなければ、すべての成果物');
    assert.deepEqual(calls[1].artifacts.map((a) => a.path), ['out/週報.md'], 'check.files で絞れる');
    assert.equal(calls[1].artifacts[0].text, '本文です');
  });

  test('REQ-041 変わっていない入力のファイルは、判定の関数に渡さない', async () => {
    const seen = [];
    const dir = tempWith({ 'inputs/前回.md': '前回', 'out/今回.md': '今回' });
    const inputs = new Map([['inputs/前回.md', grade.sha256OfFile(path.join(dir, 'inputs/前回.md'))]]);
    await grade.gradeRun({
      task: modelTask(),
      workDir: dir,
      inputs,
      judge: async ({ artifacts }) => {
        seen.push(artifacts.map((a) => a.path));
        return { pass: true, reason: '' };
      },
    });
    assert.deepEqual(seen[0], ['out/今回.md']);
  });

  test('REQ-041 判定の関数が例外を投げても、その基準だけが「採点できなかった」不合格になり、ほかの基準は採点される', async () => {
    const judge = async ({ criterion }) => {
      if (criterion.id === 'C-01') throw new Error('接続が切れた');
      return { pass: true, reason: 'よい' };
    };
    const run = await grade.gradeRun({ task: modelTask(), workDir: tempWith({ 'out/a.md': 'x' }), judge });
    assert.equal(run.results[0].pass, false);
    assert.equal(run.results[0].error, true);
    assert.match(run.results[0].reason, /採点できなかった.*接続が切れた/);
    assert.equal(run.results[1].pass, true);
    assert.equal(run.errors, 1);
  });

  test('REQ-041 判定の関数が { pass, reason } を返さなかったとき、判定の関数がないときは、採点できなかったと示す', async () => {
    const bad = await grade.gradeRun({ task: modelTask(), workDir: tempWith({}), judge: async () => 'はい' });
    assert.equal(bad.results[0].error, true);
    const none = await grade.gradeRun({ task: modelTask(), workDir: tempWith({}) });
    assert.equal(none.results[0].error, true);
    assert.match(none.results[0].reason, /関数が渡されていない/);
  });

  test('REQ-041 成果物が大きいときは、1ファイルの上限・全体の上限・ファイル数の上限で切り、切ったことが分かる', async () => {
    const dir = tempWith({
      'a.txt': 'あ'.repeat(30),
      'b.txt': 'い'.repeat(30),
      'c.txt': 'う'.repeat(30),
      'd.txt': 'え'.repeat(30),
    });
    const files = listOf(dir);
    const artifacts = await grade.collectArtifacts({ check: undefined }, files, { limits: { perFileChars: 20, totalChars: 35, files: 3 } });
    assert.equal(artifacts[0].text, 'あ'.repeat(20));
    assert.equal(artifacts[0].truncated, true);
    assert.equal(artifacts[1].text, 'い'.repeat(15), '全体の上限の残りだけ');
    assert.equal(artifacts[1].truncated, true);
    assert.equal(artifacts[2].text, null);
    assert.equal(artifacts[2].omitted, true);
    assert.equal(artifacts[3].omitted, true);
    assert.match(artifacts[3].path, /ほか1件/);
    assert.equal(artifacts.length, 4);
  });

  test('REQ-041 指示文には、基準の文・依頼・成果物が入り、細かさを求めないことと、返事の形が書いてある', () => {
    const prompt = grade.buildJudgePrompt({
      criterion: { id: 'C-01', text: '要点が3つ以内' },
      task: { prompt: '週報を作って' },
      artifacts: [
        { path: 'out/a.md', size: 12, kind: 'text', text: '本文', truncated: true },
        { path: 'out/b.png', size: 3, kind: 'binary', text: null, note: '文字にできない形式' },
      ],
    });
    assert.match(prompt, /C-01: 要点が3つ以内/);
    assert.match(prompt, /作業の依頼: 週報を作って/);
    assert.match(prompt, /<file path="out\/a\.md" bytes="12">\n本文\n（長いので、ここまでしか渡していません）\n<\/file>/);
    assert.match(prompt, /<file path="out\/b\.png" bytes="3">（文字にできない形式）<\/file>/);
    assert.match(prompt, /細かさ.*求めません/);
    assert.match(prompt, /\{"pass": true か false, "reason": "理由"\}/);
    assert.match(grade.buildJudgePrompt({ criterion: { id: 'C', text: 't' }, task: {}, artifacts: [] }), /成果物のファイルは1つもありません/);
  });

  test('REQ-041 モデルの返事から合否を取り出せる（JSON だけ、コードの囲み、前後に文字）。読めないときは理由つきで失敗する', () => {
    assert.deepEqual(grade.parseJudgeReply('{"pass": true, "reason": "よい"}'), { pass: true, reason: 'よい' });
    assert.deepEqual(grade.parseJudgeReply('```json\n{"pass": false, "reason": "足りない"}\n```'), { pass: false, reason: '足りない' });
    assert.deepEqual(grade.parseJudgeReply('判定します。\n{"pass": true, "reason": "ok"}\n以上です。'), { pass: true, reason: 'ok' });
    assert.deepEqual(grade.parseJudgeReply('{"pass": false}'), { pass: false, reason: '' });
    assert.throws(() => grade.parseJudgeReply('合格です'), /判定の返事を読めなかった（合格です）/);
    assert.throws(() => grade.parseJudgeReply('{"pass": "yes"}'), /読めなかった/);
    assert.throws(() => grade.parseJudgeReply(undefined), /読めなかった/);
  });
});

describe('使うファイルの置き場所', () => {
  test('REQ-041 採点のモジュールは Copilot SDK も Agent SDK も読み込まない（開発の試験からも使える）', () => {
    const source = fs.readFileSync(new URL('../../../skills/test-plugin/scripts/grade.mjs', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /copilot-sdk|claude-agent-sdk|@anthropic-ai/);
    assert.doesNotMatch(source, /\bplaywright\b/);
  });
});
