// 2段目 部品の試験（つなぎ口）：フック（onPreToolUse）と、許可の求めの受け口（onPermissionRequest）。
// どちらも、例外を投げないこと、すぐ答えることが決まりである（設計書 4.4、4.14）。
// 偽物の SDK は本物の SDK と同じく、フックの例外を「拒まずに進む」にし、許可の求めの受け口の例外を user-not-available の答えにする。
// そのため、例外を投げないことは、登録された関数を直接呼んで確かめる。
// 設計書：generated-plugin-structure.md 4.4、4.14、6.1、10章。
// 実行：node --test "tests/stage2/adapter/*.test.mjs"
import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';

import { PLUGIN, beginRun, cleanupAll, delay, holdAfterJoin, sdkEvent, startChild, startPlugin, until } from './harness.mjs';

after(cleanupAll);

// 標準エラーへの出力を捕まえる（わざと失敗させる試験で、出力を散らかさず、残ったことも確かめるため）
async function captureErrors(fn) {
  const lines = [];
  const original = console.error;
  console.error = (...args) => lines.push(args.map(String).join(' '));
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return lines;
}

async function stoppedRun() {
  const p = await startPlugin();
  const root = await beginRun(p);
  await startChild(p, { agentId: 'ag-w', parentAgentId: root, agent: 'worker' });
  await startChild(p, { agentId: 'ag-v', parentAgentId: root, agent: 'verifier' });
  await p.core.stop();
  await p.core.whenIdle();
  return { p, root };
}

describe('ツールを使ってよいかの問い合わせ（onPreToolUse。REQ-009）', () => {
  test('REQ-009 実行がないとき、動いている実行のエージェント、メインのエージェントのツールは、通す（何も返さない）', async () => {
    const p = await startPlugin();
    const hook = p.fake.config.hooks.onPreToolUse;
    assert.equal(hook({ toolName: 'bash', agentId: 'ag-1' }), undefined);
    assert.equal(hook({ toolName: 'bash' }), undefined);
    const root = await beginRun(p);
    await startChild(p, { agentId: 'ag-w', parentAgentId: root, agent: 'worker' });
    for (const input of [{ toolName: 'view', agentId: root }, { toolName: 'edit', agentId: 'ag-w', parentAgentId: root }, { toolName: 'bash' }]) {
      assert.equal(hook(input), undefined, JSON.stringify(input));
    }
  });

  test('REQ-009 止めた実行の統括・作業・検証のツールだけを、deny と理由で拒む。メインのエージェントとほかの作業は巻き込まない', async () => {
    const { p, root } = await stoppedRun();
    const hook = p.fake.config.hooks.onPreToolUse;
    for (const agentId of [root, 'ag-w', 'ag-v']) {
      const result = hook({ toolName: 'edit', agentId });
      assert.deepEqual(Object.keys(result).sort(), ['permissionDecision', 'permissionDecisionReason']);
      assert.equal(result.permissionDecision, 'deny');
      assert.match(result.permissionDecisionReason, /止められ/);
      assert.match(result.permissionDecisionReason, /edit/, '理由にツールの名前が入る');
    }
    assert.equal(hook({ toolName: 'edit' }), undefined, 'メインのエージェントのツールは通す');
    assert.equal(hook({ toolName: 'edit', agentId: 'ag-other' }), undefined, 'ユーザーがチャットでしているほかの作業は通す');
    // 拒む一覧のエージェントの子は、新しく現れても拒む
    assert.equal(hook({ toolName: 'edit', agentId: 'ag-late', parentAgentId: 'ag-w' }).permissionDecision, 'deny');
    assert.equal(hook({ toolName: 'edit', agentId: 'ag-late' })?.permissionDecision, 'deny', '一度拒んだ番号は、その後も拒む');
  });

  test('REQ-009 偽物の SDK のフックの呼び方（例外は拒まずに進む）でも、止めた実行のツールは拒まれる', async () => {
    const { p, root } = await stoppedRun();
    assert.deepEqual(await p.fake.callHook('onPreToolUse', { toolName: 'bash', agentId: root }), {
      permissionDecision: 'deny',
      permissionDecisionReason: `この実行は止められたため、ツール「bash」は使えません。`,
    });
    assert.equal(await p.fake.callHook('onPreToolUse', { toolName: 'bash', agentId: 'ag-other' }), undefined);
  });

  test('REQ-009 止めるを押した時点で、同期で答え、すぐ拒む（止める処理が終わるのを待たない）', async () => {
    const p = await startPlugin();
    const root = await beginRun(p);
    const stopping = p.core.stop();
    const result = p.fake.config.hooks.onPreToolUse({ toolName: 'edit', agentId: root });
    assert.ok(!(result instanceof Promise), 'Promise を返さない');
    assert.equal(result.permissionDecision, 'deny');
    await stopping;
    await p.core.whenIdle();
  });

  test('REQ-009 入力が壊れていても、例外を投げない。中で失敗しても、拒む一覧のエージェントは拒む', async () => {
    const { p, root } = await stoppedRun();
    const hook = p.fake.config.hooks.onPreToolUse;
    const hostile = { agentId: root, get toolName() { throw new Error('壊れた入力'); } };
    const verdict = hook(hostile);
    assert.equal(verdict.permissionDecision, 'deny', '中で失敗しても、拒む一覧のエージェントは拒む');
    for (const input of [undefined, null, 5, 'x', [], {}, { agentId: 5 }, { agentId: {}, toolName: {} }, { toolName: 5, agentId: 'ag-other' }]) {
      assert.doesNotThrow(() => hook(input), JSON.stringify(input));
      assert.equal(hook(input), undefined, `拒む一覧にないものは通す：${JSON.stringify(input)}`);
    }
  });

  test('REQ-009 中心の処理がフックの中で失敗しても、フックは例外を投げず、通す。失敗は標準エラーに残す', async () => {
    const p = await startPlugin();
    const hook = p.fake.config.hooks.onPreToolUse;
    p.core.preToolUse = () => {
      throw new Error('中心の処理の失敗');
    };
    const lines = await captureErrors(async () => {
      assert.doesNotThrow(() => hook({ toolName: 'bash', agentId: 'ag-1' }));
      assert.equal(hook({ toolName: 'bash', agentId: 'ag-1' }), undefined);
    });
    assert.equal(lines.length, 2);
    assert.match(lines[0], /つなぎ口/);
    p.core.preToolUse = () => ({ deny: true });
    assert.deepEqual(hook({ toolName: 'bash', agentId: 'ag-1' }), { permissionDecision: 'deny', permissionDecisionReason: '' }, '理由がなくても、形は崩さない');
  });

  test('REQ-009 中心の処理ができる前の問い合わせは通す（実行はまだない）。子のエージェントの終わりのフックも、何もしない', async () => {
    const { prepared, release } = await holdAfterJoin();
    const starting = prepared.launch();
    await until(() => prepared.fake.config !== null);
    const { hooks } = prepared.fake.config;
    assert.equal(hooks.onPreToolUse({ toolName: 'bash', agentId: 'ag-1' }), undefined);
    assert.equal(hooks.onSubagentStop({ agentId: 'ag-1', response: '返事' }), undefined);
    release();
    prepared.finish(await starting);
  });
});

describe('許可の求めの受け口（onPermissionRequest。REQ-005）', () => {
  test('REQ-005 いつも { kind: no-result } を返す（答えない）。すぐ返し、求めは中心の処理に渡す', async () => {
    const p = await startPlugin();
    const seen = [];
    p.core.onPermissionRequest = (request) => seen.push(request);
    const handler = p.fake.config.onPermissionRequest;
    const requests = [{ kind: 'shell', fullCommandText: 'ls' }, { kind: 'write', fileName: 'a.md' }, { kind: 'extension-permission-access' }, {}, null, undefined, 'x', 5];
    for (const request of requests) {
      const result = handler(request, { sessionId: 's', managedSettingsEnabled: false });
      assert.deepEqual(result, { kind: 'no-result' });
      assert.ok(!(result instanceof Promise), 'Promise を返さない');
    }
    assert.deepEqual(seen, requests);
  });

  test('REQ-005 中心の処理が例外を投げても、no-result を返す（投げると SDK が user-not-available で答えてしまう）', async () => {
    const p = await startPlugin();
    p.core.onPermissionRequest = () => {
      throw new Error('中心の処理の失敗');
    };
    const handler = p.fake.config.onPermissionRequest;
    const lines = await captureErrors(async () => {
      assert.doesNotThrow(() => handler({ kind: 'shell' }, { sessionId: 's' }));
      assert.deepEqual(handler({ kind: 'shell' }, { sessionId: 's' }), { kind: 'no-result' });
      // SDK の動きで見る：求めのイベントが届いても、Copilot CLI に返す答えはない
      p.fake.emit(sdkEvent.permissionRequested('ag-1', 'req-1', { kind: 'shell', fullCommandText: 'ls' }));
      await delay(10);
    });
    assert.deepEqual(p.fake.answers, []);
    assert.equal(lines.length, 3);
  });

  test('REQ-005 本物の中心の処理につなぐと、求めのイベントに答えず、待ちが画面の状態に出て、答えが出ると消える', async () => {
    const p = await startPlugin();
    const root = await beginRun(p);
    await startChild(p, { agentId: 'ag-w', parentAgentId: root, agent: 'worker' });
    p.fake.emit(sdkEvent.permissionRequested('ag-w', 'req-1', { kind: 'shell', fullCommandText: 'npm test', possiblePaths: ['/work/out'], possibleUrls: [], warning: '時間がかかります' }));
    await delay(10);
    await p.core.whenIdle();
    assert.deepEqual(p.fake.answers, [], '答えを返さない。答えはチャットで行う');
    const waits = p.core.getState().run.waits;
    assert.equal(waits.length, 1);
    assert.equal(waits[0].requestId, 'req-1');
    assert.equal(waits[0].slot, 'worker');
    assert.equal(waits[0].kind, 'permission');
    assert.equal(waits[0].detail.command, 'npm test');
    assert.equal(waits[0].detail.warning, '時間がかかります');
    p.fake.emit(sdkEvent.permissionCompleted('req-1'));
    await p.core.whenIdle();
    assert.deepEqual(p.core.getState().run.waits, []);
    assert.equal(p.core.getState().run.agents.find((a) => a.slot === 'worker').status, 'running');
  });

  test('REQ-005 中心の処理ができる前の求めには、答えない', async () => {
    const { prepared, release } = await holdAfterJoin();
    const starting = prepared.launch();
    await until(() => prepared.fake.config !== null);
    assert.deepEqual(prepared.fake.config.onPermissionRequest({ kind: 'shell' }, { sessionId: 's' }), { kind: 'no-result' });
    release();
    prepared.finish(await starting);
  });
});
