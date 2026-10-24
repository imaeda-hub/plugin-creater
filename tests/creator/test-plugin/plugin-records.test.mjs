// EVAL でできた生成プラグインの実行の記録の片付け（skills/test-plugin/scripts/plugin-records.mjs）の試験。ユーザーの答え27（X1-16）。
// 確かめる要件：REQ-041（生成プラグインありの EVAL を、ユーザーのふだんの環境のまま動かす。EVAL でできた実行の記録だけを消し、ふだんの作業の記録と生成プラグインは消さない）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, test } from 'node:test';

import { cleanupTemp, loadScript, makeTemp } from './helpers.mjs';

const { isRecordOfRun, listRecordIds, pluginRunsRoot, readBegin, removeEvalRecords, watchPluginRecords } = await loadScript('plugin-records.mjs');
after(cleanupTemp);

const NAME = 'weekly-report';
const USER_ID = '20261001-090000-aaaaaa';
const USER_ID_2 = '20261002-090000-bbbbbb';
const EVAL_ID = '20261024-120000-c0ffee';

/** 実行の記録を1つ作る（生成プラグインの store.mjs と同じ置き方：<番号>/log.jsonl の1行目が begin、終わっていれば result.json） */
function writeRecord(root, id, begin, { finished = true, extra = {} } = {}) {
  const dir = path.join(root, id);
  fs.mkdirSync(path.join(dir, 'issues'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'log.jsonl'), `${begin === null ? 'これは begin ではない' : JSON.stringify({ t: 'begin', runId: id, ...begin })}\n{"t":"note"}\n`);
  fs.writeFileSync(path.join(dir, 'alive'), '1');
  if (finished) fs.writeFileSync(path.join(dir, 'result.json'), '{"done":true}');
  for (const [rel, text] of Object.entries(extra)) fs.writeFileSync(path.join(dir, rel), text);
  return dir;
}

/** COPILOT_HOME と、その下の記録の置き場所、EVAL の作業フォルダを用意する */
function setup() {
  const home = makeTemp('c3-home-');
  const env = { PATH: '/usr/bin', COPILOT_HOME: home };
  const root = path.join(home, 'plugin-data', NAME, 'runs');
  const workDir = makeTemp('c3-eval-work-');
  return { home, env, root, workDir };
}

/** フォルダの中身（相対の場所と中身）を、まとめて文字にする。前後の比べ合いに使う */
function treeOf(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        out.push(`${path.relative(dir, abs)}/`);
        walk(abs);
      } else out.push(`${path.relative(dir, abs)}=${fs.readFileSync(abs, 'utf8')}`);
    }
  };
  walk(dir);
  return out;
}

describe('記録の置き場所', () => {
  test('REQ-041 置き場所は、生成プラグインのエクステンションと同じ <COPILOT_HOME>/plugin-data/<名前>/runs。COPILOT_HOME がなければ <ホーム>/.copilot', () => {
    assert.equal(pluginRunsRoot('weekly-report', { COPILOT_HOME: '/h/copilot' }), path.join('/h/copilot', 'plugin-data', 'weekly-report', 'runs'));
    const expected = path.join(process.platform === 'win32' ? 'C:\\Users\\u' : '/home/u', '.copilot', 'plugin-data', 'weekly-report', 'runs');
    assert.equal(pluginRunsRoot('weekly-report', process.platform === 'win32' ? { USERPROFILE: 'C:\\Users\\u' } : { HOME: '/home/u' }), expected);
  });

  test('REQ-041 置き場所を決められないとき（名前が区切りや .. を含む、COPILOT_HOME が絶対パスでない）は null。その実行では何も消さない', () => {
    for (const name of ['../x', 'a/b', 'a\\b', '..', '.', '', 'a..b', '-x', undefined, 42]) assert.equal(pluginRunsRoot(name, { COPILOT_HOME: '/h' }), null, String(name));
    assert.equal(pluginRunsRoot(NAME, { COPILOT_HOME: 'relative/home' }), null);

    const watch = watchPluginRecords({ pluginName: '../escape', env: { COPILOT_HOME: '/h' } });
    assert.equal(watch.root, null);
    assert.match(watch.skipped, /置き場所を決められませんでした/);
    assert.deepEqual(removeEvalRecords(watch, { workDir: '/w', sessionId: 's' }), { root: null, removed: [], failed: [], unidentified: [], skipped: watch.skipped });
  });
});

describe('記録の一覧と最初の行', () => {
  test('REQ-041 記録として数えるのは、番号の形のフォルダで、log.jsonl（ふつうのファイル）があるものだけ', () => {
    const { root } = setup();
    writeRecord(root, USER_ID, { cwd: '/x', sessionId: 's' });
    fs.mkdirSync(path.join(root, 'notes'), { recursive: true }); // 番号の形でない（log.jsonl があっても記録ではない）
    fs.writeFileSync(path.join(root, 'notes', 'log.jsonl'), '{"t":"begin"}\n');
    fs.mkdirSync(path.join(root, '20261003-100000-dddddd'), { recursive: true }); // log.jsonl がない
    fs.writeFileSync(path.join(root, '20261004-100000-eeeeee'), 'file'); // フォルダでない
    const outside = makeTemp('c3-outside-');
    fs.writeFileSync(path.join(outside, 'log.jsonl'), '{"t":"begin"}\n');
    fs.symlinkSync(outside, path.join(root, '20261005-100000-ffffff'), 'dir'); // シンボリックリンクのフォルダ
    assert.deepEqual(listRecordIds(root), [USER_ID]);
    assert.deepEqual(listRecordIds(path.join(root, 'ない')), []);
  });

  test('REQ-041 最初の行が begin の JSON でなければ、読めなかったことにする', () => {
    const { root } = setup();
    writeRecord(root, USER_ID, { cwd: '/x', sessionId: 's' });
    writeRecord(root, USER_ID_2, null);
    assert.equal(readBegin(root, USER_ID).sessionId, 's');
    assert.equal(readBegin(root, USER_ID_2), null);
    assert.equal(readBegin(root, '20260101-000000-000000'), null);
  });

  test('REQ-041 この実行のものと言えるのは、作業フォルダとセッションの番号の両方が合うときだけ', () => {
    const work = makeTemp('c3-w-');
    const run = { workDir: work, sessionId: 'session-1' };
    const begin = (extra) => ({ t: 'begin', cwd: work, sessionId: 'session-1', ...extra });
    assert.equal(isRecordOfRun(begin(), run), true);
    assert.equal(isRecordOfRun(begin({ cwd: '/home/user/work' }), run), false, '作業フォルダが違う');
    assert.equal(isRecordOfRun(begin({ sessionId: 'session-2' }), run), false, 'セッションの番号が違う');
    assert.equal(isRecordOfRun(begin({ sessionId: undefined }), run), false, 'セッションの番号がない');
    assert.equal(isRecordOfRun(begin({ cwd: undefined }), run), false, '作業フォルダがない');
    assert.equal(isRecordOfRun({ ...begin(), t: 'note' }, run), false, 'begin でない');
    assert.equal(isRecordOfRun(null, run), false);
    assert.equal(isRecordOfRun(begin(), { workDir: work, sessionId: undefined }), false, 'こちらがセッションの番号を知らなければ、確かめられない');
    assert.equal(isRecordOfRun(begin(), { workDir: '', sessionId: 'session-1' }), false);
    assert.equal(isRecordOfRun(begin({ cwd: '', sessionId: '' }), { workDir: '', sessionId: '' }), false, '空どうしで合ったことにしない');
  });

  test('REQ-041 作業フォルダは、シンボリックリンクを通した書き方でも、同じフォルダなら合う', () => {
    const work = makeTemp('c3-w-');
    const link = path.join(makeTemp('c3-l-'), 'link');
    fs.symlinkSync(work, link, 'dir');
    assert.equal(isRecordOfRun({ t: 'begin', cwd: link, sessionId: 's' }, { workDir: work, sessionId: 's' }), true);
    assert.equal(isRecordOfRun({ t: 'begin', cwd: work, sessionId: 's' }, { workDir: link, sessionId: 's' }), true);
    assert.equal(isRecordOfRun({ t: 'begin', cwd: path.join(work, 'sub'), sessionId: 's' }, { workDir: work, sessionId: 's' }), false, '中のフォルダは別のフォルダ');
  });
});

describe('EVAL でできた記録だけを消す', () => {
  test('REQ-041 実行の間にできた、この実行の記録だけを消す。ふだんの作業の記録は、中身も含めてそのまま残る', () => {
    const { env, root, workDir } = setup();
    writeRecord(root, USER_ID, { cwd: '/home/user/project', sessionId: 'user-session-1' }, { extra: { 'note.txt': '消さないで' } });
    writeRecord(root, USER_ID_2, { cwd: '/home/user/project', sessionId: 'user-session-2' }, { finished: false });
    const userTree = treeOf(root);

    const watch = watchPluginRecords({ pluginName: NAME, env });
    assert.equal(watch.root, root);
    assert.deepEqual([...watch.before], [USER_ID, USER_ID_2]);

    // 実行の間に、生成プラグインのエクステンションが記録を作る（途中の状態で、issues/ の印もある）
    const dir = writeRecord(root, EVAL_ID, { cwd: workDir, sessionId: 'eval-session' }, { finished: false, extra: { 'extra.txt': 'x' } });
    fs.writeFileSync(path.join(dir, 'issues', 'ISSUE-1.json'), '{}');

    const result = removeEvalRecords(watch, { workDir, sessionId: 'eval-session' });
    assert.deepEqual(result, { root, removed: [EVAL_ID], failed: [], unidentified: [], skipped: null });
    assert.equal(fs.existsSync(dir), false, 'この実行の記録は、終わっていなくても消える');
    assert.deepEqual(treeOf(root), userTree, 'ふだんの作業の記録は、前と同じ（件数も中身も）');
  });

  test('REQ-041 実行の前からあった記録は、中身がこの実行のものに見えても、見ずに残す', () => {
    const { env, root, workDir } = setup();
    writeRecord(root, EVAL_ID, { cwd: workDir, sessionId: 'eval-session' }); // 前からある（前の EVAL の残りなど）
    const watch = watchPluginRecords({ pluginName: NAME, env });
    const result = removeEvalRecords(watch, { workDir, sessionId: 'eval-session' });
    assert.deepEqual(result.removed, []);
    assert.deepEqual(result.unidentified, []);
    assert.equal(fs.existsSync(path.join(root, EVAL_ID)), true);
  });

  test('REQ-041 実行の間にできても、この実行のものと確かめられない記録は、消さずに「確かめられなかった」と示す', () => {
    const { env, root, workDir } = setup();
    const watch = watchPluginRecords({ pluginName: NAME, env });
    // ふだんの作業が同時に動いてできた記録（作業フォルダもセッションも別）
    writeRecord(root, '20261024-120001-000001', { cwd: '/home/user/project', sessionId: 'user-session' });
    // 作業フォルダだけ合う、セッションの番号だけ合う
    writeRecord(root, '20261024-120002-000002', { cwd: workDir, sessionId: 'other-session' });
    writeRecord(root, '20261024-120003-000003', { cwd: '/elsewhere', sessionId: 'eval-session' });
    // 最初の行が読めない
    writeRecord(root, '20261024-120004-000004', null);
    // この実行の記録
    writeRecord(root, EVAL_ID, { cwd: workDir, sessionId: 'eval-session' });

    const result = removeEvalRecords(watch, { workDir, sessionId: 'eval-session' });
    assert.deepEqual(result.removed, [EVAL_ID]);
    assert.deepEqual(result.unidentified, ['20261024-120001-000001', '20261024-120002-000002', '20261024-120003-000003', '20261024-120004-000004']);
    assert.deepEqual(listRecordIds(root), result.unidentified, '確かめられなかったものは、全部残っている');
  });

  test('REQ-041 セッションが作れず番号が分からないときは、何も消さない（作業フォルダが合っていても）', () => {
    const { env, root, workDir } = setup();
    const watch = watchPluginRecords({ pluginName: NAME, env });
    writeRecord(root, EVAL_ID, { cwd: workDir, sessionId: 'eval-session' });
    const result = removeEvalRecords(watch, { workDir, sessionId: undefined });
    assert.deepEqual(result.removed, []);
    assert.deepEqual(result.unidentified, [EVAL_ID]);
    assert.equal(fs.existsSync(path.join(root, EVAL_ID)), true);
  });

  test('REQ-041 置き場所がまだない（初めて使う）ときも、投げずに、何も消さない。実行の間に作られた記録は消す', () => {
    const { env, root, workDir } = setup();
    assert.equal(fs.existsSync(root), false);
    const watch = watchPluginRecords({ pluginName: NAME, env });
    assert.equal(watch.root, root);
    assert.deepEqual([...watch.before], []);
    assert.deepEqual(removeEvalRecords(watch, { workDir, sessionId: 's' }).removed, []);
    writeRecord(root, EVAL_ID, { cwd: workDir, sessionId: 's' });
    assert.deepEqual(removeEvalRecords(watch, { workDir, sessionId: 's' }).removed, [EVAL_ID]);
  });

  test('REQ-041 消せなかった記録は、投げずに failed に残し、ほかの記録は続けて消す', () => {
    const { env, root, workDir } = setup();
    const watch = watchPluginRecords({ pluginName: NAME, env });
    writeRecord(root, '20261024-120000-000001', { cwd: workDir, sessionId: 's' });
    writeRecord(root, '20261024-120000-000002', { cwd: workDir, sessionId: 's' });
    const rmSync = (dir, options) => {
      if (dir.endsWith('000001')) throw new Error('EBUSY: 使用中です\n詳しい説明');
      fs.rmSync(dir, options);
    };
    const result = removeEvalRecords(watch, { workDir, sessionId: 's' }, { rmSync });
    assert.deepEqual(result.removed, ['20261024-120000-000002']);
    assert.deepEqual(result.failed, [{ id: '20261024-120000-000001', message: 'EBUSY: 使用中です' }]);

    // 消したと言っても残っているときも、消せなかったことにする
    const quiet = removeEvalRecords(watch, { workDir, sessionId: 's' }, { rmSync: () => {} });
    assert.deepEqual(quiet.failed, [{ id: '20261024-120000-000001', message: '消した後も残っています' }]);
  });

  test('REQ-041 消すのは記録のフォルダだけ。置き場所の外（生成プラグインのフォルダ、その tests/results/ の EVAL の結果）と、同じ名前の別のプラグインの記録は消さない', () => {
    const { home, env, root, workDir } = setup();
    // 生成プラグインのフォルダ。EVAL の結果もある
    const pluginDir = makeTemp('c3-plugin-');
    fs.mkdirSync(path.join(pluginDir, 'tests', 'results', 'eval-20261024-120000'), { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({ name: NAME }));
    fs.writeFileSync(path.join(pluginDir, 'tests', 'results', 'eval-20261024-120000', 'result.json'), '{}');
    // 別のプラグインの記録（作業フォルダもセッションも同じに見えるもの）
    const otherRoot = path.join(home, 'plugin-data', 'another-plugin', 'runs');
    const watch = watchPluginRecords({ pluginName: NAME, env });
    writeRecord(otherRoot, EVAL_ID, { cwd: workDir, sessionId: 's' });
    writeRecord(root, EVAL_ID, { cwd: workDir, sessionId: 's' });
    const before = [treeOf(pluginDir), treeOf(otherRoot), treeOf(workDir)];

    assert.deepEqual(removeEvalRecords(watch, { workDir, sessionId: 's' }).removed, [EVAL_ID]);
    assert.deepEqual([treeOf(pluginDir), treeOf(otherRoot), treeOf(workDir)], before);
    assert.equal(fs.existsSync(root), true, '置き場所そのものも残る');
  });

  test('REQ-041 begin の cwd が作業フォルダの親や、置き場所自身を指していても、消すのは番号のフォルダだけ', () => {
    const { env, root, workDir } = setup();
    const watch = watchPluginRecords({ pluginName: NAME, env });
    writeRecord(root, EVAL_ID, { cwd: workDir, sessionId: 's' });
    writeRecord(root, '20261024-120000-000009', { cwd: path.dirname(workDir), sessionId: 's' });
    const result = removeEvalRecords(watch, { workDir, sessionId: 's' });
    assert.deepEqual(result.removed, [EVAL_ID]);
    assert.deepEqual(result.unidentified, ['20261024-120000-000009']);
    assert.equal(fs.existsSync(workDir), true);
  });
});
