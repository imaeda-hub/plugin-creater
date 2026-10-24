// 内側の EVAL を、本物の Agent SDK と Claude Code の本体、本物の生成プラグイン（組み立てて置き換えたもの）、本物の画面と Playwright で通す。
// 実際のモデルは使わない：Anthropic API の代わりに、ローカルの偽のサーバー（台本）につなぐ。
// 動かし方：cd tests/dev-eval && node --test "runner/inner-e2e.test.mjs"（Python に PyYAML と jsonschema、Playwright のブラウザーが要る。なければ飛ばす）
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import * as sdk from '@anthropic-ai/claude-agent-sdk';

import { createScreen } from '../../../skills/test-plugin/scripts/screen.mjs';
import { startFakeAnthropic } from './fake-anthropic.mjs';
import { createInnerAdapter } from './inner-adapter.mjs';
import { runInnerArm } from './inner-run.mjs';
import { buildSamplePlugin, pythonHasModules, scriptedModel, tmpDir } from './inner-test-support.mjs';

let chromium = null;
try {
  ({ chromium } = await import('playwright'));
} catch {
  chromium = null;
}
const SKIP = !pythonHasModules() ? 'Python に PyYAML と jsonschema がありません' : !chromium ? 'playwright がありません' : false;

const FAKE_ENV = { ANTHROPIC_API_KEY: 'fake-key', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };

// 判定の関数（モデルの判定は偽物）
const judge = async ({ criterion }) => ({ pass: true, reason: `${criterion.id} は満たしている` });

test('REQ-005 REQ-007 REQ-008 REQ-012 ありの実行：画面を開く → 設定して開始 → 統括・作業・検証が動く → 終わりを読む → 採点する', { skip: SKIP, timeout: 240_000 }, async (t) => {
  const fixture = buildSamplePlugin();
  const requests = [];
  const api = await startFakeAnthropic(scriptedModel({ verifierDelayMs: 1500, onRequest: (role, body) => requests.push({ role, model: body.model }) }));
  const screen = createScreen({ chromium, env: { ...process.env, PLUGIN_TEST_BROWSER_CHANNEL: 'chromium' } });
  t.after(async () => {
    await screen.close();
    await api.close();
  });
  const runDir = tmpDir('run-with');
  const result = await runInnerArm({
    arm: 'with', task: fixture.task, runDir, sdk, userRole: async () => 'はい', judge, screen,
    pluginRoot: fixture.pluginRoot, convertedRoot: fixture.convertedRoot, models: { worker: 'gpt-6-luna', verifier: 'claude-opus-5.5' },
    envExtra: { ...FAKE_ENV, ANTHROPIC_BASE_URL: api.url }, timeoutMs: 180_000, pollMs: 300,
  });

  assert.equal(result.status, 'completed', `${result.reason} / ${JSON.stringify(result.mainError)} / ${result.screenError}`);
  assert.match(result.url, /^http:\/\/127\.0\.0\.1:\d+\/\?k=/);
  assert.ok(result.screen.finished);
  assert.equal(result.screen.endReason.kind, 'all_passed');
  // 成果物が作業フォルダにあり、採点できた
  assert.ok(fs.existsSync(path.join(result.workDir, 'out', 'weekly.md')));
  assert.equal(result.grading.total, 2);
  assert.equal(result.grading.passed, 2);
  // 画面で選んだモデルが効いた：作業は gpt-6-luna → claude-haiku-5-5、検証は claude-opus-5.5 → claude-opus-5-5
  const byRole = (role) => requests.filter((r) => r.role === role).map((r) => r.model);
  assert.ok(byRole('worker').length > 0 && byRole('worker').every((m) => m === 'claude-haiku-5-5'), JSON.stringify(byRole('worker')));
  assert.ok(byRole('verifier').length > 0 && byRole('verifier').every((m) => m === 'claude-opus-5-5'), JSON.stringify(byRole('verifier')));
  assert.ok(byRole('orchestrator').every((m) => m === 'claude-sonnet-5-5'));
  const failed = result.checks.filter((c) => !c.ok);
  assert.deepEqual(failed, [], JSON.stringify(failed));
  assert.ok(fs.existsSync(path.join(runDir, 'events.jsonl')));
});

function recordingUserRole() {
  const calls = [];
  const fn = async (request) => {
    calls.push(request);
    return 'はい、お願いします';
  };
  fn.calls = calls;
  return fn;
}

test('REQ-041 なしの実行：メインのエージェントがチャットで質問して手番を終えたら、ユーザー役が返事をして続く。成果物を同じ基準で採点する', { skip: SKIP, timeout: 120_000 }, async (t) => {
  const fixture = buildSamplePlugin();
  const api = await startFakeAnthropic(scriptedModel({ plain: true, askFirst: true }));
  t.after(() => api.close());
  const userRole = recordingUserRole();
  const result = await runInnerArm({
    arm: 'without', task: fixture.task, runDir: tmpDir('run-without'), sdk, userRole, judge,
    envExtra: { ...FAKE_ENV, ANTHROPIC_BASE_URL: api.url }, timeoutMs: 100_000,
  });
  assert.equal(result.status, 'completed', result.reason);
  assert.equal(result.replies, 1);
  assert.equal(userRole.calls.length, 1);
  assert.match(userRole.calls[0].question, /どの週の週報ですか/);
  assert.deepEqual(userRole.calls[0].choices, []);
  assert.equal(result.history[0].via, 'chat');
  assert.equal(result.main.turns, 2);
  assert.ok(fs.existsSync(path.join(result.workDir, 'out', 'weekly.md')));
  assert.equal(result.grading.passed, 2);
  // プラグインは読み込まれず、画面もない
  assert.deepEqual(result.mainInit.plugins.filter((name) => name === 'weekly-report'), []);
  assert.equal(result.url, null);
  assert.deepEqual(result.checks, []);
});

test('REQ-041 なしの実行：質問のツール（AskUserQuestion）の問いにも、ユーザー役が選択肢つきで答える', { skip: SKIP, timeout: 120_000 }, async (t) => {
  const fixture = buildSamplePlugin();
  const seen = [];
  const api = await startFakeAnthropic(scriptedModel({ plain: true, askTool: true, onRequest: (role, body) => seen.push(JSON.stringify(body.messages)) }));
  t.after(() => api.close());
  const userRole = recordingUserRole();
  const result = await runInnerArm({
    arm: 'without', task: fixture.task, runDir: tmpDir('run-without-tool'), sdk, userRole, judge,
    envExtra: { ...FAKE_ENV, ANTHROPIC_BASE_URL: api.url }, timeoutMs: 100_000,
  });
  assert.equal(result.status, 'completed', result.reason);
  assert.equal(userRole.calls.length, 1);
  assert.equal(userRole.calls[0].question, 'どの週の週報ですか？');
  assert.deepEqual(userRole.calls[0].choices, ['今週', '先週']);
  assert.equal(result.history[0].via, 'AskUserQuestion');
  // 答えは、ツールの返り値としてモデルに届いた
  assert.ok(seen.some((messages) => messages.includes('はい、お願いします')));
  assert.equal(result.replies, 0);
});

test('REQ-005 ありの実行：画面の URL が出る前にメインのエージェントが質問して手番を終えたら、ユーザー役が返事をして URL まで進む', { skip: SKIP, timeout: 240_000 }, async (t) => {
  const fixture = buildSamplePlugin();
  const api = await startFakeAnthropic(scriptedModel({ askFirst: true }));
  const screen = createScreen({ chromium, env: { ...process.env, PLUGIN_TEST_BROWSER_CHANNEL: 'chromium' } });
  t.after(async () => {
    await screen.close();
    await api.close();
  });
  const userRole = recordingUserRole();
  const result = await runInnerArm({
    arm: 'with', task: fixture.task, runDir: tmpDir('run-with-ask'), sdk, userRole, judge, screen,
    pluginRoot: fixture.pluginRoot, convertedRoot: fixture.convertedRoot,
    envExtra: { ...FAKE_ENV, ANTHROPIC_BASE_URL: api.url }, timeoutMs: 180_000, pollMs: 300,
  });
  assert.equal(result.status, 'completed', `${result.reason} / ${result.screenError}`);
  assert.equal(result.replies, 1);
  assert.equal(userRole.calls.length, 1);
  assert.ok(result.url);
  assert.equal(result.screen.endReason.kind, 'all_passed');
  assert.equal(result.grading.passed, 2);
});

async function waitFor(check, timeoutMs, label) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > until) throw new Error(`時間内に「${label}」にならなかった`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

test('REQ-009 止める：統括の実行だけが取り消され、10秒のうちに「終了（ユーザーが止めた）」になり、その後は新しい呼び出しが起きない', { skip: SKIP, timeout: 120_000 }, async (t) => {
  const fixture = buildSamplePlugin();
  const requests = [];
  const api = await startFakeAnthropic(scriptedModel({ verifierDelayMs: 60_000, onRequest: (role) => requests.push(role) }));
  const adapter = await createInnerAdapter({
    sdk, pluginRoot: fixture.pluginRoot, convertedRoot: fixture.convertedRoot, workDir: tmpDir('stop-work'), runDir: tmpDir('stop-run'),
    envExtra: { ...FAKE_ENV, ANTHROPIC_BASE_URL: api.url },
  });
  t.after(async () => {
    await adapter.shutdown();
    await api.close();
  });
  await adapter.core.open({ requestText: '週報を作ってください' });
  await adapter.core.start({ models: {}, maxIterations: 1, task: { week: '2026-W42' } });
  const stateOf = async () => adapter.core.getState();
  await waitFor(async () => (await stateOf()).run?.agents.some((a) => a.role === 'verifier' && a.status === 'running'), 60_000, '検証エージェントが実行中');
  const stoppedAt = Date.now();
  await adapter.core.stop();
  const finished = await waitFor(async () => {
    const state = await stateOf();
    return state.run?.status === 'finished' ? state.run : null;
  }, 15_000, '終了');
  assert.ok(Date.now() - stoppedAt < 10_000, `止めてから ${Date.now() - stoppedAt}ms かかった`);
  assert.equal(finished.endReason.kind, 'user_stopped');
  assert.equal(finished.endReason.unstoppable, false);
  assert.deepEqual(finished.unstopped, []);
  // 統括も、その下の作業・検証も、動いていない
  assert.ok(adapter.agents().length >= 3);
  assert.ok(adapter.agents().every((a) => a.status !== 'running'), JSON.stringify(adapter.agents().map((a) => [a.agentType, a.status])));
  // 止めた後は、モデルへの新しい呼び出しがない
  const before = requests.length;
  await new Promise((resolve) => setTimeout(resolve, 2500));
  assert.equal(requests.length, before);
});
