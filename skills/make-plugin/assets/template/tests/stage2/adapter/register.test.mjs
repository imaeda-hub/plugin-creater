// 2段目 部品の試験（つなぎ口）：登録するものと、記録のツールの呼び出し。
// つなぎ口（adapter.mjs）が、セッションに加わるときに何を登録するか、記録のツールの呼び出しが中心の処理に届くかを、
// 偽物の SDK（fake-sdk.mjs）で確かめる。Copilot CLI は要らない。
// 設計書：generated-plugin-structure.md 3.2、4.1、4.11、4.14、6.2、10章。
// 実行：node --test "tests/stage2/adapter/*.test.mjs"（外部の npm パッケージは要らない）
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';

import {
  CONSTANTS,
  PLUGIN,
  TASK,
  TOOLS,
  beginRun,
  cleanupAll,
  createFakeSdk,
  delay,
  holdAfterJoin,
  importAdapter,
  makePlugin,
  prepareStart,
  readRunLog,
  sdkEvent,
  startChild,
  startPlugin,
  tempDir,
  until,
} from './harness.mjs';

after(cleanupAll);

const SHORT_NAMES = TOOLS.TOOL_DEFS.map((t) => t.name);

describe('セッションに加わるときに登録するもの（REQ-005）', () => {
  test('REQ-005 記録のツールを <プラグインの名前>_<短い名前> で登録する。定義は中心の処理のものと同じで、確認を省く', async () => {
    const p = await startPlugin();
    const registered = p.fake.config.tools;
    const pick = ({ name, description, parameters, skipPermission }) => ({ name, description, parameters, skipPermission });
    assert.deepEqual(registered.map(pick), p.core.toolDefinitions.map(pick));
    assert.deepEqual(
      registered.map((t) => t.name),
      SHORT_NAMES.map((name) => `${PLUGIN}_${name}`),
    );
    assert.ok(registered.some((t) => t.name === `${PLUGIN}_open`));
    for (const tool of registered) {
      assert.equal(tool.skipPermission, true, `${tool.name} は確認を省いて登録する`);
      assert.equal(typeof tool.handler, 'function', `${tool.name} にハンドラーがある`);
    }
  });

  test('REQ-005 プラグインの名前は plugin.json の name から読む。同じ土台のファイルで、名前だけが変わる', async () => {
    const a = await startPlugin();
    const b = await startPlugin({ name: 'minutes-taker' });
    assert.ok(b.fake.config.tools.every((t) => t.name.startsWith('minutes-taker_')));
    assert.equal(b.handle.pluginName, 'minutes-taker');
    assert.equal(b.handle.dataRoot, join(b.copilotHome, 'plugin-data', 'minutes-taker', 'runs'));
    for (const file of ['adapter.mjs', 'extension.mjs']) {
      const source = readFileSync(join(a.extensionDir, file), 'utf8');
      assert.equal(readFileSync(join(b.extensionDir, file), 'utf8'), source, `${file} はどのプラグインでも同じ中身`);
      assert.ok(!source.includes(PLUGIN) && !source.includes('minutes-taker'), `${file} にプラグインの名前を書かない`);
    }
  });

  test('REQ-005 plugin.json が読めないか、name がないと、わかる文で失敗し、セッションには加わらない', async () => {
    const before = process.listenerCount('SIGTERM');
    const cases = [
      ['plugin.json がない', null],
      ['name がない', {}],
      ['name が空', { name: '' }],
      ['name が文字でない', { name: 5 }],
    ];
    for (const [label, manifest] of cases) {
      const plugin = makePlugin({ manifest });
      const fake = createFakeSdk();
      const { startAdapter } = await importAdapter(plugin);
      await assert.rejects(startAdapter({ joinSession: fake.joinSession }), /プラグインの設定ファイル/, label);
      assert.equal(fake.joinCount, 0, `${label}：セッションに加わらない`);
    }
    const broken = makePlugin();
    writeFileSync(join(broken.root, 'plugin.json'), '{ 壊れている');
    const fake = createFakeSdk();
    const { startAdapter } = await importAdapter(broken);
    await assert.rejects(startAdapter({ joinSession: fake.joinSession }), /プラグインの設定ファイル/);
    assert.equal(fake.joinCount, 0);
    assert.equal(process.listenerCount('SIGTERM'), before, '失敗したときに終了の合図の受け口を残さない');
  });

  test('REQ-005 joinSession が渡されていないと、すぐ失敗する', async () => {
    const { startAdapter } = await importAdapter(makePlugin());
    await assert.rejects(startAdapter({}), /joinSession/);
  });

  test('REQ-005 セッションに加わるのは1回。フック（onPreToolUse、onSubagentStop）と、許可の求めの受け口を登録し、機微な環境変数は求めない', async () => {
    const p = await startPlugin();
    assert.equal(p.fake.joinCount, 1);
    assert.deepEqual(Object.keys(p.fake.config.hooks).sort(), ['onPreToolUse', 'onSubagentStop']);
    for (const hook of Object.values(p.fake.config.hooks)) assert.equal(typeof hook, 'function');
    assert.equal(typeof p.fake.config.onPermissionRequest, 'function');
    // 求めると、ユーザーが断ったときにエクステンションごと読み込まれない（設計書 4.11）
    assert.equal(p.fake.config.requestedEnvironmentVariables, undefined);
    assert.equal(p.fake.config.onUserInputRequest, undefined, '質問には答えない（チャットで答える。設計書 4.14）');
  });

  test('REQ-005 joinSession が断られたら（読み込みのときの確認を断った）、そのまま失敗し、終了の合図の受け口も残さない', async () => {
    const before = process.listenerCount('SIGTERM');
    const plugin = makePlugin();
    const fake = createFakeSdk();
    fake.behave('joinSession', { error: new Error('確認が断られた') });
    const { startAdapter } = await importAdapter(plugin);
    await assert.rejects(startAdapter({ joinSession: fake.joinSession }), /確認が断られた/);
    assert.equal(process.listenerCount('SIGTERM'), before);
  });
});

describe('画面を開くツール（REQ-005、REQ-029）', () => {
  test('REQ-005 画面を開くツールは、URL と、ユーザーに伝えることを返す。作業の文は画面の状態に入る', async () => {
    const p = await startPlugin();
    const opened = await p.fake.callTool(`${PLUGIN}_open`, { requestText: '先週の週報を作って' });
    assert.equal(opened.ok, true, opened.error);
    assert.match(opened.text, /^Web管理画面の URL：http:\/\/127\.0\.0\.1:\d+\/\?k=[\w-]+$/m);
    assert.ok(opened.text.includes('ユーザーに伝えてください'));
    assert.ok(opened.text.includes(CONSTANTS.CLEAR_NOTICE), '実行中は /clear しないこと');
    assert.ok(opened.text.includes(CONSTANTS.CHAT_CONFIRM_NOTICE), '実行中の確認にはチャットで答えること');
    assert.equal(p.core.getState().setup.requestText, '先週の週報を作って');
  });

  test('REQ-005 実行中にもう一度呼ばれても、新しく始めず、同じ URL を返す', async () => {
    const p = await startPlugin();
    const first = await p.fake.callTool(`${PLUGIN}_open`, { requestText: '週報を作る' });
    const url = first.text.match(/http:\/\/\S+/)[0];
    await beginRun(p);
    const again = await p.fake.callTool(`${PLUGIN}_open`, { requestText: 'もう一度' });
    assert.equal(again.ok, true, again.error);
    assert.ok(again.text.includes(url), '同じ URL');
    assert.equal(p.fake.callsOf('tasks.startAgent').length, 1, '統括は1体だけ');
    assert.equal(p.core.getState().run.status, 'running');
  });

  test('REQ-029 画面のサーバーは、画面を開くツールが初めて呼ばれたときに起動し、示した URL で状態が取れる', async () => {
    const p = await startPlugin();
    // 加わっただけでは、サーバーは起動しない（設計書 3.3）
    assert.equal(p.core.getState().run, null);
    const opened = await p.fake.callTool(`${PLUGIN}_open`, { requestText: '週報を作る' });
    const url = new URL(opened.text.match(/http:\/\/\S+/)[0]);
    const response = await fetch(`${url.origin}/api/state?k=${url.searchParams.get('k')}`);
    assert.equal(response.status, 200);
    const state = await response.json();
    assert.equal(state.plugin.name, PLUGIN);
    assert.equal(state.plugin.title, TASK.name);
    assert.deepEqual(state.taskDisplays, TASK.displays, '作業ごとの表示の定義は、中心の処理の状態から画面に届く');
    assert.equal((await fetch(`${url.origin}/api/state`)).status, 403, '合言葉がなければ断る');
  });
});

describe('記録のツールの呼び出し（REQ-005、REQ-010）', () => {
  test('REQ-005 記録のツールの呼び出しは、名前の後ろの部分と引数と、呼んだエージェントの番号をつけて、中心の処理に渡す', async () => {
    const p = await startPlugin();
    const seen = [];
    p.core.handleTool = async (shortName, args, context) => {
      seen.push([shortName, args, context.agentId]);
      return `記録：${shortName}`;
    };
    const recording = SHORT_NAMES.filter((name) => name !== 'open');
    for (const name of recording) {
      const result = await p.fake.callTool(`${PLUGIN}_${name}`, { k: name }, { agentId: `ag-${name}` });
      assert.deepEqual(result, { ok: true, text: `記録：${name}` });
    }
    assert.deepEqual(
      seen,
      recording.map((name) => [name, { k: name }, `ag-${name}`]),
    );
    await p.fake.callTool(`${PLUGIN}_review`, {});
    assert.equal(seen.at(-1)[2], undefined, 'メインのエージェントからの呼び出しには、番号がない');
  });

  test('REQ-005 中心の処理が断った呼び出しは、モデルに返る失敗の文（平易な日本語）になる', async () => {
    const p = await startPlugin();
    const result = await p.fake.callTool(`${PLUGIN}_plan`, { iteration: 1, criteria: [{ id: 'C-01', text: 'x' }], plan: 'x' }, { agentId: 'ag-1' });
    assert.equal(result.ok, false);
    assert.match(result.error, /[ぁ-ん]/, '日本語の文');
    assert.doesNotMatch(result.error, /RecordRefusal|Error:|at .*\.mjs/, '内部の名前や追跡を出さない');
  });

  test('REQ-010 合否の記録は、呼んだエージェントの番号で確かめられる（検証エージェント以外は断られる）', async () => {
    const p = await startPlugin();
    const root = await beginRun(p);
    const plan = { iteration: 1, criteria: TASK.criteria.map(({ id, text }) => ({ id, text })), plan: '下書きを書く' };
    const planned = await p.fake.callTool(`${PLUGIN}_plan`, plan, { agentId: root });
    assert.equal(planned.ok, true, planned.error);
    await startChild(p, { agentId: 'ag-w', parentAgentId: root, agent: 'worker' });
    p.fake.emit(sdkEvent.subagentCompleted('ag-w'));
    await startChild(p, { agentId: 'ag-v', parentAgentId: root, agent: 'verifier' });
    const verdict = { iteration: 1, verdicts: TASK.criteria.map((c) => ({ criterionId: c.id, pass: true })) };

    const byWorker = await p.fake.callTool(`${PLUGIN}_verdict`, verdict, { agentId: 'ag-w' });
    assert.equal(byWorker.ok, false);
    assert.match(byWorker.error, /検証エージェントだけ/);
    const byMain = await p.fake.callTool(`${PLUGIN}_verdict`, verdict);
    assert.equal(byMain.ok, false, '番号がない呼び出し（メインのエージェント）も断る');
    const byVerifier = await p.fake.callTool(`${PLUGIN}_verdict`, verdict, { agentId: 'ag-v' });
    assert.equal(byVerifier.ok, true, byVerifier.error);
    assert.equal(p.core.getState().run.status, 'summarizing', 'すべて合格なので、まとめ中に移る');
  });
});

describe('セッションに加わった直後の動き（REQ-005）', () => {
  test('REQ-005 加わった直後（中心の処理ができる前）に呼ばれたツールは、できるまで待ってから動く', async () => {
    const { prepared, release } = await holdAfterJoin();
    const starting = prepared.launch();
    await until(() => prepared.fake.config !== null);
    const call = prepared.fake.callTool(`${PLUGIN}_open`, { requestText: '週報を作る' });
    assert.equal(await Promise.race([call, delay(150).then(() => 'まだ返らない')]), 'まだ返らない');
    release();
    prepared.finish(await starting);
    const result = await call;
    assert.equal(result.ok, true, result.error);
    assert.match(result.text, /Web管理画面の URL：http:\/\/127\.0\.0\.1:/);
  });

  test('REQ-005 中心の処理を作れなかったとき（作業の定義が壊れている）は、起動が失敗し、待っていた呼び出しも失敗する', async () => {
    const { prepared, release } = await holdAfterJoin();
    writeFileSync(join(prepared.plugin.extensionDir, 'task.json'), '{ 壊れている');
    const before = process.listenerCount('SIGTERM');
    const starting = prepared.launch();
    const failed = assert.rejects(starting, /作業の定義/);
    await until(() => prepared.fake.config !== null);
    const call = prepared.fake.callTool(`${PLUGIN}_open`, { requestText: '週報を作る' });
    release();
    await failed;
    const result = await call;
    assert.equal(result.ok, false);
    assert.match(result.error, /作業の定義/);
    assert.equal(process.listenerCount('SIGTERM'), before, '失敗したときに終了の合図の受け口を残さない');
  });
});

describe('中心の処理に渡すもの（REQ-008、REQ-029）', () => {
  test('REQ-008 記録は <COPILOT_HOME>/plugin-data/<名前>/runs/ の下に、セッションの番号と作業フォルダつきで書く', async () => {
    const p = await startPlugin({ sessionId: 'session-xyz' });
    await beginRun(p);
    const runId = p.core.getState().run.id;
    assert.equal(p.handle.dataRoot, join(p.copilotHome, 'plugin-data', PLUGIN, 'runs'));
    assert.ok(existsSync(join(p.handle.dataRoot, runId, 'log.jsonl')));
    const begin = readRunLog(p).find((entry) => entry.t === 'begin');
    assert.equal(begin.sessionId, 'session-xyz');
    assert.equal(begin.cwd, p.work);
    assert.equal(begin.pluginName, PLUGIN);
  });

  test('REQ-008 作業フォルダが聞けないときは、エクステンションの作業フォルダ（process.cwd()）を使う', async () => {
    for (const prepare of [
      (fake) => fake.behave('workspaces.getWorkspace', { error: new Error('聞けない') }),
      (fake) => {
        fake.workspace = { workspace: null };
      },
      (fake) => {
        fake.workspace = { workspace: { id: 'w' } };
      },
    ]) {
      const p = await startPlugin({ prepare });
      await beginRun(p);
      assert.equal(readRunLog(p).find((entry) => entry.t === 'begin').cwd, process.cwd());
    }
  });

  test('REQ-008 COPILOT_HOME がなければ、ホームフォルダの .copilot の下に書く', async () => {
    const prepared = await prepareStart();
    const fakeHome = tempDir('adapter-userhome-');
    const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, COPILOT_HOME: process.env.COPILOT_HOME };
    process.env.HOME = fakeHome;
    process.env.USERPROFILE = fakeHome;
    delete process.env.COPILOT_HOME;
    let handle;
    try {
      handle = await prepared.startAdapter({ joinSession: prepared.fake.joinSession });
      assert.equal(handle.dataRoot, join(os.homedir(), '.copilot', 'plugin-data', PLUGIN, 'runs'));
      assert.ok(handle.dataRoot.startsWith(fakeHome), '試験用のホームフォルダの下');
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      await handle?.shutdown();
    }
  });

  test('REQ-007 選べるモデルの一覧は session.rpc.model.list から、今のモデルは model.getCurrent から、画面の準備に届く', async () => {
    const p = await startPlugin({
      prepare: (fake) => {
        fake.models = [{ id: 'm-a', name: 'モデル A' }, 'm-b', { id: 'm-c' }];
        fake.currentModel = { modelId: 'm-b' };
      },
    });
    await p.fake.callTool(`${PLUGIN}_open`, { requestText: '週報を作る' });
    const setup = p.core.getState().setup;
    assert.deepEqual(setup.models, [
      { id: 'm-a', name: 'モデル A' },
      { id: 'm-b', name: 'm-b' },
      { id: 'm-c', name: 'm-c' },
    ]);
    assert.equal(setup.currentModel, 'm-b');
    assert.equal(setup.isAuto, false);
    assert.equal(p.fake.callsOf('model.list').length > 0, true);
  });

  test('REQ-007 Copilot CLI のモデルが Auto のとき、画面の準備に Auto の注意が出る', async () => {
    const p = await startPlugin({
      prepare: (fake) => {
        fake.currentModel = { modelId: 'auto', autoTier: 'balanced' };
      },
    });
    await p.fake.callTool(`${PLUGIN}_open`, { requestText: '週報を作る' });
    const setup = p.core.getState().setup;
    assert.equal(setup.isAuto, true);
    assert.equal(setup.autoNotice, CONSTANTS.AUTO_NOTICE);
  });
});
