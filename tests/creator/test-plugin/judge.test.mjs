// モデルで判定する関数の Copilot SDK 版（skills/test-plugin/scripts/judge.mjs）と、道具の読み込み（tools.mjs）の試験。偽物の SDK を使う。
// 確かめる要件：REQ-041（モデルが判定する分も、見込みと使った AI クレジットに入る）、REQ-048（道具の置き場所）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';

import { createFakeSdk, usage } from './fake-sdk.mjs';
import { cleanupTemp, loadScript, makeTemp, sampleTask, tempWith, writeFiles } from './helpers.mjs';

const { createCopilotJudge } = await loadScript('judge.mjs');
const { copilotHome, toolsDir, loadEvalTools, importFromDir, ToolsMissingError } = await loadScript('tools.mjs');
const grade = await loadScript('grade.mjs');
after(cleanupTemp);

const ARGS = {
  criterion: { id: 'C-01', text: '要点が3つ以内' },
  task: { id: 'T-01', prompt: '週報を作って' },
  artifacts: [{ path: 'out/週報.md', size: 12, kind: 'text', text: '要点は3つです', truncated: false }],
};
const reply = (text, nano = 2_000_000_000) => ({
  onSend: async (session) => {
    session.emit('assistant.usage', usage(nano));
    session.emit('assistant.message', { content: text });
    session.emit('session.idle', {});
  },
});

describe('モデルで判定する関数', () => {
  test('REQ-041 判定のセッションに基準の文と成果物を渡し、返事から合否と理由を取り出し、使った AI クレジットを返す', async () => {
    const sdk = createFakeSdk(reply('```json\n{"pass": true, "reason": "要点は3つで、基準を満たしています"}\n```'));
    const judge = createCopilotJudge({ sdk, env: { PATH: '/bin', COPILOT_CLI_PATH: '/x' }, model: 'gpt-6-luna', timeoutMs: 2000 });
    const out = await judge(ARGS);
    await judge.close();
    assert.deepEqual(out, { pass: true, reason: '要点は3つで、基準を満たしています', credits: 2, creditsStatus: 'complete' });
    const [client] = sdk.clients;
    const [session] = sdk.sessions;
    assert.deepEqual(client.options.connection.args, [], '生成プラグインは読み込まない');
    assert.equal(client.options.connection.env.COPILOT_PLUGIN_DIR_ONLY, 'true');
    assert.equal('COPILOT_CLI_PATH' in client.options.connection.env, false);
    assert.equal('requestExtensions' in session.config, false, 'エクステンションは読み込まない');
    assert.equal(session.config.model, 'gpt-6-luna');
    assert.equal(session.config.trustWorkingDirectory, 'session');
    assert.equal(session.disconnected, true);
    assert.match(session.sent[0].prompt, /C-01: 要点が3つ以内/);
    assert.match(session.sent[0].prompt, /<file path="out\/週報\.md" bytes="12">\n要点は3つです\n<\/file>/);
    assert.match(session.sent[0].prompt, /作業の依頼: 週報を作って/);
  });

  test('REQ-041 ツールの許可の求めはすべて拒む（成果物は指示文に入れて渡すので、ツールは要らない）', async () => {
    const sdk = createFakeSdk({
      onSend: async (session) => {
        const answers = [await session.askPermission({ kind: 'shell', fullCommandText: 'cat /etc/passwd' }), await session.askPermission({ kind: 'read', path: '/etc/hosts' })];
        session.emit('assistant.message', { content: JSON.stringify({ pass: answers.every((a) => a.kind === 'reject'), reason: 'ok' }) });
        session.emit('session.idle', {});
      },
    });
    const judge = createCopilotJudge({ sdk, timeoutMs: 2000 });
    const out = await judge(ARGS);
    await judge.close();
    assert.equal(out.pass, true, '2つとも拒まれた');
    assert.match(sdk.sessions[0].decisions[0].decision.feedback, /ツールは使えません/);
  });

  test('REQ-041 ランタイムは1つを使い回し、判定ごとに新しいセッションを作る。close で止めて、作業用のフォルダを消す', async () => {
    const sdk = createFakeSdk(reply('{"pass": false, "reason": "多い"}', 1_000_000_000));
    const judge = createCopilotJudge({ sdk, timeoutMs: 2000 });
    const a = await judge(ARGS);
    const b = await judge(ARGS);
    assert.deepEqual([a.pass, b.pass], [false, false]);
    assert.equal(sdk.clients.length, 1);
    assert.equal(sdk.sessions.length, 2);
    const dir = sdk.clients[0].options.workingDirectory;
    assert.equal(fs.existsSync(dir), true);
    assert.deepEqual(fs.readdirSync(dir), [], '判定の作業フォルダは空');
    await judge.close();
    assert.equal(sdk.clients[0].stopped, true);
    assert.equal(fs.existsSync(dir), false);
    await judge(ARGS);
    assert.equal(sdk.clients.length, 2, 'close の後に判定すると、起動し直す');
    await judge.close();
  });

  test('REQ-041 返事を読めないとき、セッションがエラーのとき、時間切れのときは、不合格に error の印を付け、使ったクレジットは数える', async () => {
    const unreadable = createCopilotJudge({ sdk: createFakeSdk(reply('合格だと思います')), timeoutMs: 2000 });
    const a = await unreadable(ARGS);
    await unreadable.close();
    assert.equal(a.pass, false);
    assert.equal(a.error, true);
    assert.match(a.reason, /判定の返事を読めなかった（合格だと思います）/);
    assert.equal(a.credits, 2);

    const failing = createCopilotJudge({
      sdk: createFakeSdk({ onSend: async (s) => { s.emit('assistant.usage', usage(500_000_000)); s.emit('session.error', { message: 'レート制限' }); s.emit('session.idle', {}); } }),
      timeoutMs: 2000,
    });
    const b = await failing(ARGS);
    await failing.close();
    assert.deepEqual([b.pass, b.error, b.credits], [false, true, 0.5]);
    assert.match(b.reason, /判定のセッションがエラーになりました（レート制限）/);

    const silent = createCopilotJudge({ sdk: createFakeSdk({ onSend: async () => {} }), timeoutMs: 100 });
    const c = await silent(ARGS);
    await silent.close();
    assert.deepEqual([c.pass, c.error], [false, true]);
    assert.match(c.reason, /時間内に返りませんでした/);
  });

  test('REQ-041 起動に失敗したときは、その理由で失敗し、次の判定で起動し直せる', async () => {
    const sdk = createFakeSdk({
      ...reply('{"pass": true, "reason": "ok"}'),
      onStart: async (client) => {
        if (client.id === 1) throw new Error('ランタイムが起動しない');
      },
    });
    const judge = createCopilotJudge({ sdk, timeoutMs: 2000 });
    await assert.rejects(judge(ARGS), /ランタイムが起動しない/);
    assert.equal(sdk.clients[0].stopped, true);
    assert.equal((await judge(ARGS)).pass, true);
    assert.equal(sdk.clients.length, 2);
    await judge.close();
  });

  test('REQ-041 gradeRun に渡すと、model の基準の合否と判定に使った AI クレジットが、実行の採点に入る', async () => {
    const sdk = createFakeSdk(reply('{"pass": true, "reason": "よい"}', 1_500_000_000));
    const judge = createCopilotJudge({ sdk, timeoutMs: 2000 });
    const task = sampleTask({ criteria: [{ id: 'C-01', text: '読みやすい', grading: 'model' }, { id: 'C-02', text: '文末が「以上」', grading: 'program', check: { type: 'regex', file: 'out/*.md', pattern: '以上\\s*$' } }] });
    const run = await grade.gradeRun({ task, workDir: tempWith({ 'out/週報.md': '本文\n以上\n' }), judge });
    await judge.close();
    assert.deepEqual(run.results.map((r) => [r.id, r.pass]), [['C-01', true], ['C-02', true]]);
    assert.equal(run.judgments, 1);
    assert.equal(run.judgeCredits, 1.5);
    assert.equal(run.judgeCreditsStatus, 'complete');
    assert.match(sdk.sessions[0].sent[0].prompt, /out\/週報\.md/);
  });
});

describe('道具の置き場所と読み込み', () => {
  /** パッケージの入った道具のフォルダを作る（実物の package.json の exports と同じ形） */
  function fakeTools({ sdk = true, playwright = true, chromium = true, extension = true } = {}) {
    const dir = makeTemp('c3-tools-');
    if (sdk) {
      writeFiles(dir, {
        'node_modules/@github/copilot-sdk/package.json': JSON.stringify({ name: '@github/copilot-sdk', version: '1.0.25', type: 'module', exports: { '.': { import: { types: './dist/index.d.ts', default: './dist/index.js' }, require: { default: './dist/cjs/index.js' } } } }),
        'node_modules/@github/copilot-sdk/dist/index.js': 'export class CopilotClient {}\nexport const RuntimeConnection = {};\n',
        ...(extension ? { 'node_modules/@github/copilot-sdk/dist/extension.js': 'export const joinSession = () => {};\n' } : {}),
      });
    }
    if (playwright) {
      writeFiles(dir, {
        'node_modules/playwright/package.json': JSON.stringify({ name: 'playwright', version: '1.56.1', exports: { '.': { types: './index.d.ts', import: './index.mjs', require: './index.js', default: './index.js' } } }),
        'node_modules/playwright/index.mjs': chromium ? 'export const chromium = { launch() {} };\nexport default { chromium };\n' : 'export default {};\n',
      });
    }
    return dir;
  }

  test('REQ-048 EVAL の道具は <COPILOT_HOME>/plugin-data/plugin-creator/tools/ に置く（COPILOT_HOME がなければ ~/.copilot）', () => {
    assert.equal(toolsDir({ COPILOT_HOME: '/h/.copilot' }), path.join('/h/.copilot', 'plugin-data', 'plugin-creator', 'tools'));
    assert.equal(copilotHome({ COPILOT_HOME: '/x' }), '/x');
    assert.equal(copilotHome({}), path.join(os.homedir(), '.copilot'));
    assert.match(toolsDir({}), /\.copilot[\\/]plugin-data[\\/]plugin-creator[\\/]tools$/);
  });

  test('REQ-048 道具のフォルダから SDK と Playwright を読み込み、版を返す（exports の書き方が違っても入口を見つける）', async () => {
    const dir = fakeTools();
    const tools = await loadEvalTools({}, { dir });
    assert.equal(typeof tools.sdk.CopilotClient, 'function');
    assert.equal(typeof tools.chromium.launch, 'function');
    assert.deepEqual(tools.versions, { copilotSdk: '1.0.25', playwright: '1.56.1', node: process.version });
    assert.equal(tools.dir, dir);
    assert.equal(tools.extensionSdkPath, path.join(dir, 'node_modules', '@github', 'copilot-sdk', 'dist'), 'セッションの extensionSdkPath に渡す、SDK のフォルダ');
    const { module } = await importFromDir(dir, 'playwright');
    assert.equal(typeof module.chromium.launch, 'function');
  });

  test('REQ-048 道具が足りないときは、足りないものと入れ方と入れる場所を伝える', async () => {
    const dir = makeTemp('c3-tools-empty-');
    await assert.rejects(loadEvalTools({}, { dir }), (error) => {
      assert.ok(error instanceof ToolsMissingError);
      assert.deepEqual(error.missing.map((m) => m.name), ['@github/copilot-sdk', 'playwright']);
      assert.equal(error.missing[0].reason, '入っていません');
      assert.match(error.message, /check_tools\.py .*--scope eval --install/);
      assert.ok(error.message.includes(dir));
      return true;
    });
    await assert.rejects(loadEvalTools({}, { dir: fakeTools({ playwright: false }) }), (error) => error.missing.length === 1 && error.missing[0].name === 'playwright');
    await assert.rejects(loadEvalTools({}, { dir: fakeTools({ chromium: false }) }), /chromium が見つかりません/);
    await assert.rejects(loadEvalTools({}, { dir: fakeTools({ extension: false }) }), /extension\.js がありません/);
  });
});
