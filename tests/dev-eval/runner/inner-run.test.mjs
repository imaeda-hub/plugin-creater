// 内側の EVAL の実行1回の、状態の決め方。偽の Agent SDK（決まったメッセージを返す）で確かめる。実際のモデルも、ブラウザーも使わない。
import assert from 'node:assert/strict';
import test from 'node:test';

import { asksForReply, buildChecks, modelFields, runInnerArm } from './inner-run.mjs';
import { buildSamplePlugin, pythonHasModules, tmpDir } from './inner-test-support.mjs';

const SKIP = !pythonHasModules() ? 'Python に PyYAML と jsonschema がありません' : false;
const judge = async () => ({ pass: true, reason: '満たしている' });

/** 決まったメッセージを返す偽の Agent SDK。turns は query() 1回ごとのメッセージの並び */
function fakeSdk(turns, extra = {}) {
  const calls = [];
  const sdk = {
    USAGE_LIMIT_ERROR_PREFIXES: ["You've hit your", "You're out of usage credits"],
    query: ({ prompt, options }) => {
      calls.push({ prompt, options });
      const messages = turns[Math.min(calls.length - 1, turns.length - 1)];
      return (async function* generate() {
        for (const m of messages) yield { session_id: 'session-1', ...m };
      })();
    },
    calls,
    ...extra,
  };
  return sdk;
}
const init = (plugins = [], mcp = []) => ({ type: 'system', subtype: 'init', model: 'claude-sonnet-5-5', plugins: plugins.map((name) => ({ name })), mcp_servers: mcp, skills: [], agents: [], tools: [] });
const say = (text) => ({ type: 'assistant', message: { model: 'claude-sonnet-5-5', content: [{ type: 'text', text }] }, parent_tool_use_id: null });
const done = (text = '', extra = {}) => ({ type: 'result', subtype: 'success', is_error: false, result: text, total_cost_usd: 0.01, num_turns: 1, ...extra });

test('testing.md 7章 チャットで返事や答えを求めているかは、文の終わりの「？」か、依頼の言い方で見る', () => {
  for (const asks of ['どの週の週報ですか？', 'どの週ですか?', '対象の週を教えてください。', '対象の週をお知らせください', '週を指定してください！', 'お願いします。', 'これでよろしいでしょうか。']) {
    assert.equal(asksForReply(asks), true, asks);
  }
  for (const done of ['週報を作りました。ご確認ください。', '完了しました。', '', '3件の問い合わせがあります。', undefined]) {
    assert.equal(asksForReply(done), false, String(done));
  }
  // 長い文でも、終わりの200文字で見る
  assert.equal(asksForReply(`${'あ'.repeat(500)}どれにしますか？`), true);
});

test('REQ-007 画面で選ぶモデルは、画面の欄 model-<役割> に入れる形にする', () => {
  assert.deepEqual(modelFields({ worker: 'gpt-6-luna', verifier: 'claude-opus-5.5' }), { 'model-worker': 'gpt-6-luna', 'model-verifier': 'claude-opus-5.5' });
  assert.deepEqual(modelFields(undefined), {});
  assert.deepEqual(modelFields({ orchestrator: '' }), {});
});

test('REQ-007 REQ-008 動きの確かめ：画面で選んだモデルと実際のモデルが違うと、そのモデルの確かめが不合格になる', () => {
  const map = { 'gpt-6-luna': 'claude-haiku-5-5', 'claude-sonnet-5.5': 'claude-sonnet-5-5' };
  const agents = [
    { agentType: 'p:orchestrator', parentAgentId: null, actualClaudeId: 'claude-sonnet-5-5' },
    { agentType: 'p:worker', parentAgentId: 'orch-1', actualClaudeId: 'claude-sonnet-5-5' },
    { agentType: 'p:verifier', parentAgentId: 'orch-1', actualClaudeId: 'claude-sonnet-5-5' },
  ];
  const screen = { finished: true, endReasonText: '評価基準をすべて満たした', snapshots: [{ phase: 'plan', agents: [] }, { phase: 'do', agents: ['worker:running'] }, { phase: 'study', agents: ['verifier:running'] }] };
  const checks = buildChecks({
    pluginName: 'p', urlShown: true, mainTools: ['Skill', 'mcp__p__open'], skillsUsed: ['p:p'], screen, serverName: 'p', modelMap: map, agents,
    finalState: { settings: { models: { orchestrator: 'claude-sonnet-5.5', worker: 'gpt-6-luna', verifier: 'claude-sonnet-5.5' } } },
  });
  const by = Object.fromEntries(checks.map((c) => [c.id, c.ok]));
  assert.equal(by['skill-used'], true);
  assert.equal(by['screen-opener-called'], true);
  assert.equal(by['url-shown'], true);
  assert.equal(by['phases-shown'], true);
  assert.equal(by['worker-shown-running'], true);
  assert.equal(by['verifier-used'], true);
  assert.equal(by['model-orchestrator'], true);
  assert.equal(by['model-worker'], false, '作業は gpt-6-luna（claude-haiku-5-5）を選んだのに、sonnet で動いた');
  assert.equal(by['model-verifier'], true);
  // 選んでいない役割は確かめない
  const none = buildChecks({ pluginName: 'p', urlShown: false, mainTools: [], skillsUsed: [], screen: null, serverName: 'p', modelMap: map, agents: [], finalState: null });
  assert.ok(!none.some((c) => c.id.startsWith('model-')));
  assert.equal(none.find((c) => c.id === 'url-shown').ok, false);
  assert.equal(none.find((c) => c.id === 'screen-finished').ok, false);
});

test('REQ-041 なしの実行：モデルの利用枠の上限に達したら stopped にして、採点しない（残りを続けない合図）', async () => {
  const fixture = buildSamplePlugin();
  const sdk = fakeSdk([[init(), done("You've hit your session limit · resets 3pm", { is_error: true })]]);
  const run = await runInnerArm({ arm: 'without', task: fixture.task, runDir: tmpDir('limit'), sdk, userRole: async () => '', judge });
  assert.equal(run.status, 'stopped');
  assert.match(run.reason, /利用枠の上限/);
  assert.equal(run.grading, null);
  assert.equal(run.limitHit.where, 'main');
});

test('REQ-041 なしの実行：エージェントが誤りで終わったら incomplete にして、できていた分を採点する', async () => {
  const fixture = buildSamplePlugin();
  const sdk = fakeSdk([[init(), say('途中です'), { type: 'result', subtype: 'error_max_turns', is_error: true, errors: ['手番の上限'], total_cost_usd: 0, num_turns: 80 }]]);
  const run = await runInnerArm({ arm: 'without', task: fixture.task, runDir: tmpDir('maxturns'), sdk, userRole: async () => '', judge });
  assert.equal(run.status, 'incomplete');
  assert.match(run.reason, /誤りで終わりました/);
  assert.equal(run.grading.total, 2);
  assert.equal(run.grading.passed, 1); // program の基準は成果物がなく不合格。model の基準は偽の判定で合格
});

test('REQ-041 なしの実行：返事を求め続けても、返事の上限（maxReplies）で打ち切る', async () => {
  const fixture = buildSamplePlugin();
  const sdk = fakeSdk([[init(), say('どの週ですか？'), done('どの週ですか？')]]);
  const answers = [];
  const run = await runInnerArm({
    arm: 'without', task: fixture.task, runDir: tmpDir('replies'), sdk, userRole: async ({ question }) => { answers.push(question); return '今週です'; }, judge, maxReplies: 3,
  });
  assert.equal(run.status, 'completed');
  assert.equal(run.replies, 3);
  assert.equal(answers.length, 3);
  assert.equal(sdk.calls.length, 4);
  // 2回目からは、前のセッションに続ける
  assert.equal(sdk.calls[0].options.resume, undefined);
  assert.equal(sdk.calls[1].options.resume, 'session-1');
  assert.equal(sdk.calls[1].prompt, '今週です');
  // 隔離：設定は読ませず、プラグインは何も読み込まない
  assert.deepEqual(sdk.calls[0].options.settingSources, []);
  assert.deepEqual(sdk.calls[0].options.plugins, []);
});

test('REQ-004 REQ-005 ありの実行：プラグインが読み込まれなかったら error にする（なしと同じ結果を、ありの結果にしない）', { skip: SKIP }, async () => {
  const fixture = buildSamplePlugin();
  const sdk = fakeSdk([[init([], []), say('こんにちは'), done('こんにちは')]]);
  const run = await runInnerArm({
    arm: 'with', task: fixture.task, runDir: tmpDir('noplugin'), sdk, userRole: async () => '', judge, screen: {}, pluginRoot: fixture.pluginRoot, convertedRoot: fixture.convertedRoot,
  });
  assert.equal(run.status, 'error');
  assert.match(run.reason, /weekly-report が読み込まれませんでした/);
  assert.equal(run.grading, null);
});

test('REQ-005 ありの実行：画面を開くツールの MCP サーバーにつながらなかったら error にする', { skip: SKIP }, async () => {
  const fixture = buildSamplePlugin();
  const sdk = fakeSdk([[init(['weekly-report'], [{ name: 'weekly-report', status: 'failed' }]), say('こんにちは'), done('こんにちは')]]);
  const run = await runInnerArm({
    arm: 'with', task: fixture.task, runDir: tmpDir('nomcp'), sdk, userRole: async () => '', judge, screen: {}, pluginRoot: fixture.pluginRoot, convertedRoot: fixture.convertedRoot,
  });
  assert.equal(run.status, 'error');
  assert.match(run.reason, /MCP サーバー（weekly-report）につながりませんでした/);
});

test('REQ-005 ありの実行：チャットに画面の URL が出なければ incomplete にして、成果物がなければ不合格として採点する', { skip: SKIP }, async () => {
  const fixture = buildSamplePlugin();
  const sdk = fakeSdk([[init(['weekly-report'], [{ name: 'weekly-report', status: 'connected' }]), say('作業を始めます。'), done('作業を始めます。')]]);
  const run = await runInnerArm({
    arm: 'with', task: fixture.task, runDir: tmpDir('nourl'), sdk, userRole: async () => '', judge, screen: {}, pluginRoot: fixture.pluginRoot, convertedRoot: fixture.convertedRoot,
  });
  assert.equal(run.status, 'incomplete');
  assert.match(run.reason, /URL が出ませんでした/);
  assert.equal(run.url, null);
  assert.equal(run.grading.total, 2);
  assert.equal(run.checks.find((c) => c.id === 'url-shown').ok, false);
  // 隔離：置き換えた版だけを読み込み、画面を開くツールを渡す
  const options = sdk.calls[0].options;
  assert.deepEqual(options.plugins, [{ type: 'local', path: fixture.convertedRoot }]);
  assert.deepEqual(Object.keys(options.mcpServers), ['weekly-report']);
  assert.ok(options.allowedTools.includes('mcp__weekly-report__open'));
});

test('REQ-008 動きの確かめ：エージェントの定義が使うツールを、中心の処理が出していなければ、始めずに error にする', { skip: SKIP }, async () => {
  const fixture = buildSamplePlugin();
  const fs = await import('node:fs');
  const path = await import('node:path');
  const reportFile = path.join(fixture.convertedRoot, '.eval', 'conversion-report.json');
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  report.extension_tools.push({ from: 'weekly-report_ghost', to: 'mcp__weekly-report__ghost', extension: 'weekly-report', server: 'weekly-report', tool: 'ghost', where: ['agents/worker.agent.md'] });
  fs.writeFileSync(reportFile, JSON.stringify(report));
  const sdk = fakeSdk([[init()]]);
  const run = await runInnerArm({
    arm: 'with', task: fixture.task, runDir: tmpDir('ghost'), sdk, userRole: async () => '', judge, screen: {}, pluginRoot: fixture.pluginRoot, convertedRoot: fixture.convertedRoot,
  });
  assert.equal(run.status, 'error');
  assert.match(run.reason, /ghost/);
  assert.equal(sdk.calls.length, 0);
});

test('REQ-041 ユーザー役が答えられないとき（チャットの返事）は、答えなしで進めず、error にして理由を示す', async () => {
  const fixture = buildSamplePlugin();
  const sdk = fakeSdk([[init(), say('どの週ですか？'), done('どの週ですか？')]]);
  const run = await runInnerArm({
    arm: 'without', task: fixture.task, runDir: tmpDir('userrole-chat'), sdk, userRole: async () => { throw new Error('ユーザー役の呼び出しに失敗しました（error_during_execution）'); }, judge,
  });
  assert.equal(run.status, 'error');
  assert.match(run.reason, /ユーザー役の呼び出しに失敗しました/);
  assert.equal(run.grading, null);
});

test('REQ-041 ユーザー役が答えられないとき（質問のツール）は、その実行を止めて error にして理由を示す', async () => {
  const fixture = buildSamplePlugin();
  const sdk = {
    query: ({ options }) => (async function* generate() {
      yield { type: 'system', subtype: 'init', session_id: 's', model: 'x', plugins: [], mcp_servers: [] };
      await options.canUseTool('AskUserQuestion', { questions: [{ question: 'どの週？', options: [{ label: '今週' }, { label: '先週' }] }] });
      yield { type: 'result', subtype: 'success', is_error: false, result: '続けた', total_cost_usd: 0, num_turns: 1, session_id: 's' };
    })(),
  };
  const run = await runInnerArm({
    arm: 'without', task: fixture.task, runDir: tmpDir('userrole-tool'), sdk, userRole: async () => { throw new Error('API が応答しません'); }, judge,
  });
  assert.equal(run.status, 'error');
  assert.match(run.reason, /ユーザー役の呼び出しに失敗しました：API が応答しません/);
});

test('REQ-005 ありの実行：画面の URL が出たあとにメインの実行が誤りで終わっても、画面が最後まで動いていれば、状態を下げない', { skip: SKIP }, async () => {
  const fixture = buildSamplePlugin();
  const url = 'http://127.0.0.1:8731/?k=abc123';
  const sdk = fakeSdk([[init(['weekly-report'], [{ name: 'weekly-report', status: 'connected' }]), say(`画面を開きました：${url}`), { type: 'result', subtype: 'success', is_error: true, result: 'API Error: 500', total_cost_usd: 0, num_turns: 1 }]]);
  const operated = [];
  const screen = {
    operate: async (args) => {
      operated.push(args);
      return { finished: true, timedOut: false, endReason: { kind: 'all_passed' }, endReasonText: '評価基準をすべて満たした', summary: null, snapshots: [] };
    },
  };
  const run = await runInnerArm({
    arm: 'with', task: fixture.task, runDir: tmpDir('after-url'), sdk, userRole: async () => '', judge, screen, pluginRoot: fixture.pluginRoot, convertedRoot: fixture.convertedRoot,
    models: { worker: 'gpt-6-luna' }, taskSettings: { week: '2026-W42' },
  });
  assert.equal(run.status, 'completed', run.reason);
  assert.equal(run.mainError, 'API Error: 500');
  assert.equal(operated.length, 1);
  assert.equal(operated[0].url, url);
  // 画面の欄に入れるもの：課題の上限の回数、画面で選ぶモデル、足した設定
  assert.deepEqual(operated[0].settings, { maxIterations: 3, task: { 'model-worker': 'gpt-6-luna', week: '2026-W42' } });
});

test('REQ-005 ありの実行：画面の URL が出たあとは、メインの最後の文が返事を求めていても、ユーザー役は返事をしない（人は画面を操作する）', { skip: SKIP }, async () => {
  const fixture = buildSamplePlugin();
  const url = 'http://127.0.0.1:8731/?k=abc123';
  const text = `画面を開きました：${url}\nほかに知りたいことを教えてください。`;
  const sdk = fakeSdk([[init(['weekly-report'], [{ name: 'weekly-report', status: 'connected' }]), say(text), done(text)]]);
  const answers = [];
  const screen = { operate: async () => ({ finished: true, timedOut: false, endReason: { kind: 'all_passed' }, endReasonText: 'ok', summary: null, snapshots: [] }) };
  const run = await runInnerArm({
    arm: 'with', task: fixture.task, runDir: tmpDir('no-reply-after-url'), sdk, userRole: async ({ question }) => { answers.push(question); return 'x'; }, judge, screen,
    pluginRoot: fixture.pluginRoot, convertedRoot: fixture.convertedRoot,
  });
  assert.equal(run.status, 'completed', run.reason);
  assert.equal(run.replies, 0);
  assert.deepEqual(answers, []);
  assert.equal(sdk.calls.length, 1);
});

test('REQ-004 変換した版の .eval/rules.md（インストラクション）は、ありの実行のシステムプロンプトに足し、なしには足さない', { skip: SKIP }, async () => {
  const fixture = buildSamplePlugin();
  const fs = await import('node:fs');
  const path = await import('node:path');
  fs.writeFileSync(path.join(fixture.convertedRoot, '.eval', 'rules.md'), '返事は日本語で書く。\n');
  const screen = { operate: async () => null };
  const withSdk = fakeSdk([[init(['weekly-report'], [{ name: 'weekly-report', status: 'connected' }]), say('こんにちは'), done('こんにちは')]]);
  await runInnerArm({ arm: 'with', task: fixture.task, runDir: tmpDir('rules-with'), sdk: withSdk, userRole: async () => '', judge, screen, pluginRoot: fixture.pluginRoot, convertedRoot: fixture.convertedRoot });
  assert.equal(withSdk.calls[0].options.systemPrompt.append, '返事は日本語で書く。');
  const withoutSdk = fakeSdk([[init(), say('こんにちは'), done('こんにちは')]]);
  await runInnerArm({ arm: 'without', task: fixture.task, runDir: tmpDir('rules-without'), sdk: withoutSdk, userRole: async () => '', judge });
  assert.equal(withoutSdk.calls[0].options.systemPrompt.append, undefined);
});
