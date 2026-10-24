// 内側の EVAL の入口：引数、点数の出し方、あり・なしを回して比べる流れ。
// 動く試験は、本物の Agent SDK と Claude Code の本体、本物の生成プラグインの画面と Playwright を、偽の API につないで通す（実際のモデルは使わない）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import * as sdk from '@anthropic-ai/claude-agent-sdk';

import { startFakeAnthropic } from './fake-anthropic.mjs';
import { describeFailure, InnerEvalError, innerEval, main, parseArgs, scoresOf, summarizeRun } from './inner.mjs';
import { buildSamplePlugin, pythonHasModules, scriptedModel, tmpDir } from './inner-test-support.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PERSONAS = path.resolve(HERE, '..', 'personas');
let chromium = null;
try {
  ({ chromium } = await import('playwright'));
} catch {
  chromium = null;
}
const SKIP = !pythonHasModules() ? 'Python に PyYAML と jsonschema がありません' : !chromium ? 'playwright がありません' : false;
const FAKE_ENV = { ANTHROPIC_API_KEY: 'fake-key', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
const BROWSER_ENV = { ...process.env, PLUGIN_TEST_BROWSER_CHANNEL: 'chromium' };

test('REQ-041 引数：必須の引数と、値の形を確かめる', () => {
  const ok = parseArgs(['--plugin', '/p', '--persona', '/a', '--persona', '/b', '--runs', '3', '--arms', 'with', '--worker-model', 'gpt-6-luna', '--setting', 'week=2026-W42', '--no-sandbox', '--timeout-minutes', '5', '--pass-env', 'A,B']);
  assert.equal(ok.plugin, '/p');
  assert.deepEqual(ok.personas, ['/a', '/b']);
  assert.equal(ok.runs, 3);
  assert.deepEqual(ok.arms, ['with']);
  assert.deepEqual(ok.models, { worker: 'gpt-6-luna' });
  assert.deepEqual(ok.settings, { week: '2026-W42' });
  assert.equal(ok.sandbox, false);
  assert.equal(ok.timeoutMs, 300_000);
  assert.deepEqual(ok.passEnv, ['A', 'B']);
  const defaults = parseArgs(['--plugin', '/p', '--persona', '/a']);
  assert.equal(defaults.sandbox, true);
  assert.deepEqual(defaults.arms, ['with', 'without']);
  assert.equal(defaults.runs, 1);
  const bad = (argv, pattern) => assert.throws(() => parseArgs(argv), (e) => e instanceof InnerEvalError && pattern.test(e.message));
  bad(['--persona', '/a'], /--plugin/);
  bad(['--plugin', '/p'], /--persona/);
  bad(['--plugin', '/p', '--persona', '/a', '--runs', '0'], /--runs/);
  bad(['--plugin', '/p', '--persona', '/a', '--arms', 'both'], /--arms/);
  bad(['--plugin', '/p', '--persona', '/a', '--setting', 'noequals'], /鍵=値/);
  bad(['--plugin', '/p', '--persona', '/a', '--nothing'], /知らない引数/);
  bad(['--plugin', '/p', '--persona'], /値が要ります/);
  bad(['--plugin', '/p', '--persona', '/a', '--timeout-minutes', '0'], /正の数/);
});

test('REQ-041 点数：採点した実行（score がある）の平均。差は「あり」から「なし」を引く。採点しない実行は平均に入れない', () => {
  const runs = [
    { task: 'T-01', arm: 'with', score: 1 },
    { task: 'T-01', arm: 'with', score: 0.5 },
    { task: 'T-01', arm: 'without', score: 0.25 },
    { task: 'T-01', arm: 'without', score: null }, // error・stopped・skipped
    { task: 'T-02', arm: 'with', score: 0 },
    { task: 'T-02', arm: 'without', score: null },
  ];
  const scores = scoresOf(runs);
  assert.equal(scores.with, 0.5);
  assert.equal(scores.without, 0.25);
  assert.equal(scores.difference, 0.25);
  assert.deepEqual(scores.byTask['T-01'], { with: 0.75, without: 0.25, difference: 0.5 });
  assert.deepEqual(scores.byTask['T-02'], { with: 0, without: null, difference: null });
  assert.deepEqual(scoresOf([]), { with: null, without: null, difference: null, byTask: {} });
});

test('REQ-041 結果の要点：基準ごとの合否と理由、画面の終わった理由、確かめ、費用を残す', () => {
  const run = {
    status: 'completed', reason: null, grading: { score: 0.5, passed: 1, total: 2, results: [{ id: 'C-01', text: 'a', grading: 'program', pass: true, reason: 'ok' }, { id: 'C-02', text: 'b', grading: 'model', pass: false, reason: 'ng', error: true }] },
    replies: 1, url: 'http://127.0.0.1:1/?k=a', screen: { endReason: { kind: 'all_passed' }, endReasonText: '評価基準をすべて満たした' }, checks: [{ id: 'x', ok: true }],
    finalState: { settings: { models: { worker: 'gpt-6-luna' } } }, agents: [{ agentType: 'p:worker', status: 'completed', selectedModel: 'gpt-6-luna', actualClaudeId: 'claude-haiku-5-5', executionMode: 'sync', extra: 1 }],
    skillsUsed: ['p:p'], costUsd: { main: 0.1, orchestrator: 0.2 }, seconds: 12, runDir: '/r', workDir: '/r/work',
  };
  const out = summarizeRun(run, { task: 'T-01', arm: 'with', n: 2 });
  assert.equal(out.score, 0.5);
  assert.deepEqual(out.criteria[1], { id: 'C-02', text: 'b', grading: 'model', pass: false, reason: 'ng', error: true });
  assert.equal(out.endReasonText, '評価基準をすべて満たした');
  assert.deepEqual(out.agents[0], { agentType: 'p:worker', status: 'completed', selectedModel: 'gpt-6-luna', actualClaudeId: 'claude-haiku-5-5', executionMode: 'sync' });
  assert.equal(out.n, 2);
  const stopped = summarizeRun({ status: 'stopped', reason: '上限', grading: null }, { task: 'T-01', arm: 'without', n: 1 });
  assert.equal(stopped.score, null);
  assert.deepEqual(stopped.criteria, []);
});

test('testing.md 11.1 サンドボックスの道具がなければ、実際のモデルを使う前に断る（--no-sandbox で外せる）', async () => {
  const fixture = buildSamplePlugin();
  await assert.rejects(
    innerEval({
      sdk, chromium, pluginRoot: fixture.pluginRoot, convertedRoot: fixture.convertedRoot, tasks: [fixture.task], userRoleFor: () => async () => '', outDir: tmpDir('nosandbox'),
      sandbox: true, sandboxCheck: () => ({ available: false, missing: ['bwrap', 'socat'] }),
    }),
    (error) => error instanceof InnerEvalError && error.code === 'sandbox_missing' && /bwrap、socat/.test(error.message) && /--no-sandbox/.test(error.message),
  );
  await assert.rejects(
    innerEval({ sdk, chromium, pluginRoot: fixture.pluginRoot, convertedRoot: tmpDir('notconverted'), tasks: [fixture.task], userRoleFor: () => async () => '', outDir: tmpDir('x'), sandbox: false }),
    /変換レポートがありません/,
  );
  await assert.rejects(innerEval({ sdk, chromium, pluginRoot: '/p', convertedRoot: '/c', tasks: [], userRoleFor: () => async () => '', outDir: tmpDir('x') }), /課題が1つもありません/);
});

test('REQ-041 あり・なしを回して、点数とその差を出し、実行ごとの記録を残す。利用枠の上限では残りを始めない', { skip: SKIP, timeout: 300_000 }, async (t) => {
  const fixture = buildSamplePlugin();
  // ありは見出しがある週報を作り、なしは見出しがない週報を作る（差が出る）
  const api = await startFakeAnthropic(scriptedModel({ workerDelayMs: 1500, verifierDelayMs: 1500, plainContent: '# 週報\n- 3件\n' }));
  t.after(() => api.close());
  const outDir = tmpDir('inner-eval');
  const progress = [];
  const record = await innerEval({
    sdk, chromium, pluginRoot: fixture.pluginRoot, convertedRoot: fixture.convertedRoot, tasks: [fixture.task], userRoleFor: () => async () => 'はい', outDir, runs: 1,
    envExtra: { ...FAKE_ENV, ANTHROPIC_BASE_URL: api.url }, sandbox: false, timeoutMs: 120_000, pollMs: 300, env: BROWSER_ENV, onProgress: (p) => progress.push(`${p.phase}:${p.arm}`),
  });
  assert.equal(record.status, 'completed');
  assert.equal(record.stopped, null);
  assert.equal(record.kind, 'dev-inner-eval');
  assert.equal(record.plugin, 'weekly-report');
  assert.equal(record.runs.length, 2);
  assert.deepEqual(record.runs.map((r) => [r.arm, r.status]), [['with', 'completed'], ['without', 'completed']]);
  assert.deepEqual(progress, ['start:with', 'end:with', 'start:without', 'end:without']);
  // どちらも基準は2つ。ありは2つ合格、なしは1つ（見出しがない。もう1つは偽の判定が合格にする）合格
  assert.equal(record.scores.with, 1);
  assert.equal(record.scores.without, 0.5);
  assert.equal(record.scores.difference, 0.5);
  assert.deepEqual(record.runs[1].criteria.map((c) => [c.id, c.pass]), [['C-01', false], ['C-02', true]]);
  assert.ok(record.runs[0].checks.every((c) => c.ok), JSON.stringify(record.runs[0].checks.filter((c) => !c.ok)));
  assert.ok(record.warnings.some((w) => /サンドボックスなし/.test(w)));
  assert.equal(record.versions.agentSdk, '0.3.310');
  assert.equal(record.versions.claudeCode, '2.1.310');
  assert.ok(record.costUsd.judge > 0 && record.costUsd.orchestrator > 0);
  // 結果のファイルと、実行ごとの記録
  const saved = JSON.parse(fs.readFileSync(record.resultFile, 'utf8'));
  assert.equal(saved.status, 'completed');
  for (const arm of ['with-1', 'without-1']) {
    assert.ok(fs.existsSync(path.join(outDir, 'inner-runs', 'T-01', arm, 'result.json')), arm);
    assert.ok(fs.existsSync(path.join(outDir, 'inner-runs', 'T-01', arm, 'events.jsonl')), arm);
  }
  assert.ok(fs.existsSync(path.join(outDir, 'inner-runs', 'T-01', 'with-1', 'screen.png')));
});

test('REQ-041 利用枠の上限で止まった実行があれば、残りの実行は始めずに skipped にし、全体を stopped にする', { skip: SKIP, timeout: 120_000 }, async () => {
  const fixture = buildSamplePlugin();
  const fakeSdk = {
    USAGE_LIMIT_ERROR_PREFIXES: ["You've hit your"],
    query: () => (async function* generate() {
      yield { type: 'system', subtype: 'init', session_id: 's', model: 'x', plugins: [], mcp_servers: [] };
      yield { type: 'result', subtype: 'success', is_error: true, result: "You've hit your session limit · resets 3pm", total_cost_usd: 0, num_turns: 1, session_id: 's' };
    })(),
  };
  const record = await innerEval({
    sdk: fakeSdk, chromium, pluginRoot: fixture.pluginRoot, convertedRoot: fixture.convertedRoot, tasks: [fixture.task], userRoleFor: () => async () => '', outDir: tmpDir('limit'), runs: 2,
    arms: ['without'], sandbox: false, judge: async () => ({ pass: true, reason: '' }),
  });
  assert.equal(record.status, 'stopped');
  assert.equal(record.stopped.reason, 'usage_limit');
  assert.deepEqual(record.runs.map((r) => r.status), ['stopped', 'skipped']);
  assert.equal(record.scores.without, null);
});

test('REQ-041 コマンドライン：模擬ユーザーの inner/ の課題を、置き換えた生成プラグインあり・なしで回し、結果を標準出力と inner-result.json に出す', { skip: SKIP, timeout: 300_000 }, async (t) => {
  const fixture = buildSamplePlugin();
  const persona = path.join(PERSONAS, 'weekly-report');
  // 模擬ユーザーの基準（weekly_report.md、見出し2つ、47万円、1万円未満、最後の行が「以上」）を満たす中身を、ありだけが書く
  const good = '■今週の売上\n合計 47万円\n田中 1万円未満\n■来週の予定\n- 訪問\n以上\n';
  const api = await startFakeAnthropic(scriptedModel({ deliverable: 'weekly_report.md', content: good, plainContent: 'できました\n', verifierDelayMs: 300 }));
  t.after(() => api.close());
  const outDir = tmpDir('cli');
  const saved = { env: { ...process.env }, log: console.log };
  Object.assign(process.env, FAKE_ENV, { ANTHROPIC_BASE_URL: api.url, PLUGIN_TEST_BROWSER_CHANNEL: 'chromium' });
  const printed = [];
  console.log = (line) => printed.push(String(line));
  let code;
  try {
    code = await main(['--plugin', fixture.pluginRoot, '--persona', persona, '--out', outDir, '--no-sandbox', '--setting', 'week=2026-W42', '--timeout-minutes', '4', '--pass-env', 'ANTHROPIC_API_KEY,CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC']);
  } finally {
    console.log = saved.log;
    process.env = saved.env;
  }
  assert.equal(code, 0, printed.join('\n'));
  const record = JSON.parse(printed.join('\n'));
  assert.equal(record.status, 'completed');
  assert.equal(record.runs.length, 2);
  assert.deepEqual(record.runs.map((r) => r.status), ['completed', 'completed']);
  assert.equal(record.runs[0].task, 'T-01');
  assert.equal(record.runs[0].total, 7);
  assert.equal(record.runs[0].passed, 7, JSON.stringify(record.runs[0].criteria.filter((c) => !c.pass)));
  assert.ok(record.runs[1].passed < 7);
  assert.ok(record.scores.difference > 0);
  assert.ok(fs.existsSync(path.join(outDir, 'inner-result.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'converted', '.claude-plugin', 'plugin.json')));
});

test('REQ-041 コマンドライン：引数の誤りと、置き換えられない・読めない課題は、始めずに終了コード 2 で理由を示す', async () => {
  const saved = console.log;
  const printed = [];
  console.log = (line) => printed.push(String(line));
  try {
    assert.equal(await main(['--persona', '/a']), 2);
    assert.equal(await main(['--plugin', '/nonexistent', '--persona', '/nonexistent', '--out', tmpDir('bad'), '--no-sandbox']), 2);
  } finally {
    console.log = saved;
  }
  const first = JSON.parse(printed[0]);
  assert.equal(first.ok, false);
  assert.equal(first.error, 'usage');
  assert.equal(JSON.parse(printed[1]).ok, false);
});

test('REQ-041 始められなかった誤り：部品（npm のパッケージ）が入っていないときは、入れ方を示す', () => {
  const missing = Object.assign(new Error("Cannot find package 'playwright' imported from /x/inner.mjs\n  at foo"), { code: 'ERR_MODULE_NOT_FOUND' });
  assert.deepEqual(describeFailure(missing), { error: 'tools_missing', message: "必要な部品が入っていません。tests/dev-eval で npm install を実行してください（Cannot find package 'playwright' imported from /x/inner.mjs）。" });
  assert.deepEqual(describeFailure(new InnerEvalError('sandbox_missing', '足りません')), { error: 'sandbox_missing', message: '足りません' });
  assert.deepEqual(describeFailure(new Error('x')), { error: 'failed', message: 'x' });
});
