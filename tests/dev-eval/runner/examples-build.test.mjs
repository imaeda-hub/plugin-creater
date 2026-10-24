// 会話例の作成（examples-build.mjs）の試験。記録は、試験の中で組み立てる。実際のモデルは使わない。
// 動かし方（リポジトリの根で）：node --test "tests/dev-eval/runner/*.test.mjs"

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadPersona } from '../personas/validate.mjs';
import { GENERATED_MARK, ExamplesError, buildExamples, hasVersionInHead, markedAnswers, parseArgs, readRecords, renderExample, selectRecords } from './examples-build.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..', '..', '..');
const PERSONAS = path.join(here, '..', 'personas');
const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), `examples-${prefix}-`));
const weekly = (await loadPersona(path.join(PERSONAS, 'weekly-report'), { allStyles: true })).persona;

/** 外側の EVAL の記録（outer-record/1）の見本 */
function record(overrides = {}) {
  const items = [
    { seq: 1, kind: 'user.request', text: '週報を作るプラグインを作ってください' },
    { seq: 2, kind: 'creator.text', text: 'お話を聞かせてください。\n\n- まず成果物から' },
    { seq: 3, kind: 'creator.question', header: '成果物', question: '成果物はどんなファイルですか？', options: [{ label: 'Markdown', description: 'md' }], multiSelect: false },
    { seq: 4, kind: 'user.answer', index: 0, via: 'AskUserQuestion', question: '成果物はどんなファイルですか？', header: '成果物', answer: '成果物は weekly_report.md です' },
    { seq: 5, kind: 'creator.question', header: '見出し', question: '先週の週報の見出しは決まりですか？', options: [], multiSelect: false },
    { seq: 6, kind: 'user.answer', index: 1, via: 'AskUserQuestion', question: '先週の週報の見出しは決まりですか？', header: '見出し', answer: 'このとおり。「■今週の売上」と「■来週の予定」の2つです' },
    { seq: 7, kind: 'creator.text', text: '作りました。', turn: 2 },
  ];
  return {
    schema: 'outer-record/1',
    persona: { id: 'weekly-report', title: '週報（営業チームのリーダー）', experience: 'done' },
    style: 'normal',
    arm: 'with',
    models: { creator: 'claude-opus-5-5', userRole: 'claude-sonnet-5-5' },
    creator: { version: '0.1.0' },
    startedAt: '2026-10-25T01:00:00.000Z',
    finishedAt: '2026-10-25T01:05:00.000Z',
    stopped: { reason: 'generated' },
    heldout: false,
    items,
    conversation: [
      { role: 'user', via: 'request', text: items[0].text },
      { role: 'creator', via: 'text', text: items[1].text },
      { role: 'creator', via: 'AskUserQuestion', header: '成果物', question: items[2].question, options: items[2].options },
      { role: 'user', via: 'AskUserQuestion', text: items[3].answer, index: 0 },
      { role: 'creator', via: 'AskUserQuestion', header: '見出し', question: items[4].question, options: [] },
      { role: 'user', via: 'AskUserQuestion', text: items[5].answer, index: 1 },
      { role: 'creator', via: 'text', text: items[6].text },
    ],
    grading: { score: 0.9, exampleCandidate: true, faults: [], verdict: { ok: true, failed: [] } },
    ...overrides,
  };
}

function writeRecords(dir, list) {
  fs.mkdirSync(dir, { recursive: true });
  list.forEach((r, i) => fs.writeFileSync(path.join(dir, `r${i}.json`), JSON.stringify(r)));
}

test('REQ-037 記録の読み込み：外側の EVAL の記録（schema が outer-record/1）だけを読む。ほかの JSON は飛ばす', () => {
  const dir = tmp('read');
  writeRecords(dir, [record()]);
  fs.writeFileSync(path.join(dir, 'outer-report.json'), JSON.stringify({ kind: 'dev-outer-eval' }));
  fs.writeFileSync(path.join(dir, 'broken.json'), '{');
  assert.equal(readRecords([dir]).length, 1);
  assert.throws(() => readRecords([path.join(dir, 'ない')]), ExamplesError);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('REQ-037 会話の選び方：すべての観点に合格し、ユーザー役の誤りがなく、今の版の、生成まで進んだ、normal の、クリエイターの会話だけを選ぶ', () => {
  const item = (overrides, file = 'a.json') => ({ file, record: record(overrides) });
  const items = [
    item({}, 'good.json'),
    item({ heldout: true }, 'heldout.json'),
    item({}, path.join('x', 'records-heldout', 'h.json')),
    item({ arm: 'control' }, 'control.json'),
    item({ style: 'hurry' }, 'hurry.json'),
    item({ stopped: { reason: 'max_exchanges' } }, 'unfinished.json'),
    item({ grading: { score: 1, exampleCandidate: false, faults: [{ kind: 'leaked' }], verdict: { failed: [] } } }, 'leak.json'),
    item({ grading: { score: 1, exampleCandidate: false, faults: [], verdict: { failed: ['stage1'] } } }, 'failed.json'),
    item({ creator: { version: '0.0.9' } }, 'old.json'),
  ];
  const { selected, skipped } = selectRecords(items, { pluginVersion: '0.1.0' });
  assert.deepEqual([...selected.keys()], ['weekly-report']);
  assert.equal(selected.get('weekly-report').file, 'good.json');
  const reasons = Object.fromEntries(skipped.map((s) => [path.basename(s.file), s.reason]));
  assert.match(reasons['heldout.json'], /見ない模擬ユーザー/);
  assert.match(reasons['h.json'], /見ない模擬ユーザー/);
  assert.match(reasons['control.json'], /クリエイターの会話ではない/);
  assert.match(reasons['hurry.json'], /話し方が normal ではない/);
  assert.match(reasons['unfinished.json'], /生成まで進んでいない/);
  assert.match(reasons['leak.json'], /ユーザー役の誤り/);
  assert.match(reasons['failed.json'], /不合格がある（stage1）/);
  assert.match(reasons['old.json'], /クリエイターの版が違う/);
});

test('REQ-037 点数の高さだけでは選ばない：条件を満たさない高得点より、条件を満たす低得点を選ぶ。条件を満たす中では点数が高い方', () => {
  const high = { file: 'high.json', record: record({ grading: { score: 1, exampleCandidate: false, faults: [{ kind: 'leaked' }], verdict: { failed: [] } } }) };
  const low = { file: 'low.json', record: record({ grading: { score: 0.7, exampleCandidate: true, faults: [], verdict: { failed: [] } } }) };
  const mid = { file: 'mid.json', record: record({ grading: { score: 0.8, exampleCandidate: true, faults: [], verdict: { failed: [] } } }) };
  assert.equal(selectRecords([high, low], { pluginVersion: '0.1.0' }).selected.get('weekly-report').file, 'low.json');
  assert.equal(selectRecords([high, low, mid], { pluginVersion: '0.1.0' }).selected.get('weekly-report').file, 'mid.json');
});

test('REQ-037 聞かれないと話さないナレッジを引き出した質問に、印を付ける（6.3 の記録：質問が asked に、答えが answered に当たる）', () => {
  const r = record();
  assert.deepEqual([...markedAnswers(r, weekly)], [1], '見出しの質問と答えに印。成果物は自分から話すナレッジなので印なし');
  assert.deepEqual([...markedAnswers(r, null)], []);
});

test('REQ-037 会話例の Markdown：冒頭に、AI が演じた会話であること・plugin-creator の版・日付。会話は全文', () => {
  const r = record();
  const md = renderExample({ record: r, persona: weekly, pluginVersion: '0.1.0', date: '2026-10-25' });
  const head = md.split('\n').slice(0, 30).join('\n');
  assert.match(head, /^# 会話例：週報（営業チームのリーダー）/);
  assert.match(head, /plugin-creator の版：0\.1\.0/);
  assert.ok(!md.includes('クリエイターの版'), 'エンドユーザーが読む言葉は、画面と同じ plugin-creator にそろえる');
  assert.match(head, /会話を行った日：2026-10-25/);
  assert.match(head, /AI が演じたユーザー/);
  assert.match(head, /人と話すと、質問の数や順番が変わります/);
  assert.ok(md.includes(GENERATED_MARK));
  assert.ok(md.includes('> お話を聞かせてください。'));
  assert.ok(md.includes('> - まず成果物から'));
  assert.ok(md.includes('> 成果物はどんなファイルですか？'));
  assert.ok(md.includes('> - Markdown：md'));
  assert.ok(md.includes('> このとおり。「■今週の売上」と「■来週の予定」の2つです'));
  assert.equal(md.match(/★/g).length, 2, '説明の 1 か所と、印の 1 か所');
  assert.ok(md.indexOf('★ この質問で') < md.indexOf('このとおり。「■今週の売上」'));
  assert.ok(md.endsWith('\n') && !md.endsWith('\n\n'));
  assert.ok(hasVersionInHead(md, '0.1.0'));
  assert.ok(!hasVersionInHead(md, '0.2.0'));
  // 「クリエイターの版」の古い書き方は受けない
  assert.ok(!hasVersionInHead('# 会話例\n\nクリエイターの版：0.1.0\n'));
  assert.ok(hasVersionInHead('# 会話例\n\nplugin-creator の版: v0.1.0\n', '0.1.0'));
  assert.ok(!hasVersionInHead(`${'行\n'.repeat(40)}plugin-creator の版：0.1.0\n`));
  assert.throws(() => renderExample({ record: { ...r, creator: {} }, persona: weekly }), /版が分かりません/);
});

test('REQ-037 作る：模擬ユーザーごとに 1 つのファイル。選ばれなかった記録は理由つきで返す。--clean は、印のあるファイルだけを消す', async () => {
  const records = tmp('records');
  const out = tmp('out');
  writeRecords(records, [record(), record({ arm: 'control' })]);
  fs.writeFileSync(path.join(out, 'human.md'), '# 人が書いた会話例\n');
  fs.writeFileSync(path.join(out, 'old-persona.md'), `# 古い\n${GENERATED_MARK}\nplugin-creator の版：0.0.1\n`);
  const dry = await buildExamples({ recordInputs: [records], outDir: out, pluginVersion: '0.1.0', dryRun: true, clean: true });
  assert.equal(dry.written.length, 1);
  assert.ok(!fs.existsSync(path.join(out, 'weekly-report.md')), '--dry-run は書かない');
  assert.ok(fs.existsSync(path.join(out, 'old-persona.md')));
  const result = await buildExamples({ recordInputs: [records], outDir: out, pluginVersion: '0.1.0', clean: true });
  assert.deepEqual(result.written.map((w) => path.basename(w.file)), ['weekly-report.md']);
  assert.equal(result.written[0].marked, 1);
  assert.equal(result.skipped.length, 1);
  assert.deepEqual(result.removed.map((f) => path.basename(f)), ['old-persona.md']);
  assert.ok(fs.existsSync(path.join(out, 'human.md')), '人が書いたファイルは消さない');
  assert.match(fs.readFileSync(path.join(out, 'weekly-report.md'), 'utf8'), /plugin-creator の版：0\.1\.0/);
  await assert.rejects(() => buildExamples({ recordInputs: [out], outDir: out, pluginVersion: '0.1.0' }), /記録（schema が outer-record\/1 の JSON）が見つかりません/);
  fs.rmSync(records, { recursive: true, force: true });
  fs.rmSync(out, { recursive: true, force: true });
});

test('REQ-037 クリエイター自身の 1段目（A3）が、作った会話例の版を plugin.json の版と突き合わせて通す。版が違えば落ちる', async () => {
  const root = tmp('creator');
  const records = tmp('records2');
  writeRecords(records, [record()]);
  await buildExamples({ recordInputs: [records], outDir: path.join(root, 'examples'), pluginVersion: '0.1.0' });
  const check = (version) => {
    fs.writeFileSync(path.join(root, 'plugin.json'), JSON.stringify({ name: 'plugin-creator', version }));
    const script = [
      'import importlib.util, json, sys',
      `spec = importlib.util.spec_from_file_location("cc", ${JSON.stringify(path.join(REPO, 'tests', 'creator', 'check_creator.py'))})`,
      'm = importlib.util.module_from_spec(spec); sys.modules["cc"] = m; spec.loader.exec_module(m)',
      'class C:',
      '    def __init__(self): self.errors = []',
      '    def error(self, message): self.errors.append(message)',
      'c = C()',
      `m.check_examples_version(None, ${JSON.stringify(root)}, c)`,
      'print(json.dumps(c.errors, ensure_ascii=False))',
    ].join('\n');
    const r = spawnSync('python3', ['-I', '-c', script], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  };
  assert.deepEqual(check('0.1.0'), []);
  assert.match(check('0.2.0')[0], /0\.1\.0 が plugin\.json の版 0\.2\.0 と違う/);
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(records, { recursive: true, force: true });
});

test('REQ-037 コマンドの引数', () => {
  const a = parseArgs(['--records', 'a', '--records', 'b', '--out', 'x', '--style', 'normal', '--version', '1.2.3', '--clean', '--dry-run']);
  assert.deepEqual(a.records, ['a', 'b']);
  assert.equal(a.out, 'x');
  assert.equal(a.version, '1.2.3');
  assert.equal(a.clean && a.dryRun, true);
  assert.throws(() => parseArgs([]), /--records/);
  assert.throws(() => parseArgs(['--records']), /値が要ります/);
  assert.throws(() => parseArgs(['--records', 'a', '--wat']), ExamplesError);
});
