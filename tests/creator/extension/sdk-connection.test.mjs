// 2段目 部品の試験（クリエイターのエクステンション）：本物の Copilot SDK（joinSession）とのつなぎ目。
// 設計書：generated-plugin-structure.md 4.1・9章、hearing.md 7.4・8章、R2（エクステンションと SDK の API）。
//
// 偽物のセッション（fake-session.mjs）は、SDK の使い方を私たちが写したもの。この試験は、本物の SDK につないで、写しが合っていることを確かめる。
// 本物の Copilot CLI の代わりに、偽物の Copilot CLI（sdk-peer.mjs）が JSON-RPC で、ツールの呼び出しとフックの呼び出しを送る。
//
// 動かし方：SDK を入れたフォルダを、環境変数 COPILOT_SDK_DIR に指定する（リポジトリには node_modules を置かない）。
//   別のフォルダで：npm i @github/copilot-sdk@1.0.25 --ignore-scripts
//   例：COPILOT_SDK_DIR=/path/to/folder node --test "tests/creator/extension/sdk-connection.test.mjs"
// 指定がないときは、この試験を飛ばす（理由を表示する）。本物の Copilot CLI との実機の確かめは、設計書 14章と generated-plugin-structure.md 11章にある。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { EXTENSION_DIR, tempDir } from './helpers.mjs';
import { sdkExtensionFile, startExtensionProcess } from './sdk-peer.mjs';

const sdkFile = sdkExtensionFile();
const skipReason = !sdkFile
  ? '環境変数 COPILOT_SDK_DIR（そこで npm i @github/copilot-sdk@1.0.25 --ignore-scripts をしたフォルダ）を指定すると、本物の SDK につなぐ試験を動かします。'
  : !fs.existsSync(sdkFile)
    ? `${sdkFile} が見つかりません。COPILOT_SDK_DIR のフォルダで npm i @github/copilot-sdk@1.0.25 --ignore-scripts をしてください。`
    : false;

const { TOOL_DEFS } = await import(pathToFileURL(path.join(EXTENSION_DIR, 'tool-defs.mjs')).href);

async function withProcess(fn, sessionId = 'session-sdk-0001') {
  const home = tempDir('sdk-home');
  const cwd = tempDir('sdk-cwd');
  const peer = startExtensionProcess({ extensionFile: path.join(EXTENSION_DIR, 'extension.mjs'), sdkFile, sessionId, home, cwd });
  try {
    await peer.ready();
    return await fn({ peer, home, cwd, sessionId });
  } finally {
    peer.child.kill('SIGKILL');
    await peer.exited;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

describe('本物の Copilot SDK とのつなぎ目', { skip: skipReason }, () => {
  test('REQ-023 joinSession で登録するもの：8つのツール（確認を省くのは起票以外）、フック。許可の求めの受け口と環境変数の求めはない', async () => {
    await withProcess(async ({ peer }) => {
      const resume = await peer.ready();
      assert.deepEqual(
        resume.tools.map((t) => t.name),
        TOOL_DEFS.map((d) => d.fullName),
      );
      for (const tool of resume.tools) {
        const def = TOOL_DEFS.find((d) => d.fullName === tool.name);
        assert.equal(Boolean(tool.skipPermission), def.skipPermission, `${tool.name} の skipPermission`);
        assert.equal(tool.defer, 'never', `${tool.name} の defer`);
        assert.equal(tool.description, def.description);
        assert.deepEqual(tool.parameters, JSON.parse(JSON.stringify(def.parameters)), `${tool.name} の引数の JSON Schema`);
      }
      assert.equal(resume.hooks, true, 'フックが登録されていない');
      assert.equal(resume.requestPermission, false, '許可の求めの受け口を登録している（答えない決まり）');
      assert.equal(resume.requestUserInput, false);
      assert.equal(resume.requestedEnvironmentVariables, undefined, '環境変数を求めている（断られるとエクステンションごと読み込まれない）');
      assert.equal(resume.sessionId, 'session-sdk-0001', 'セッションの番号は環境変数 SESSION_ID から');
      assert.equal(peer.stderr, '', `標準エラーに出力がある：${peer.stderr}`);
    });
  });

  test('REQ-015 本物の SDK 経由でツールを呼べる：記録のツールの返り値、断る文、状態取得ツール。記録は COPILOT_HOME の下にできる', async () => {
    await withProcess(async ({ peer, home, sessionId }) => {
      const progress = await peer.callTool(sessionId, 'plugin-creator_progress', { stage: '始まり' });
      assert.match(progress.result, /^記録しました（段階：始まり）。まだ聞いていない項目：作業の目的、/);
      assert.equal(progress.error, undefined);
      assert.ok(fs.existsSync(path.join(home, 'plugin-data', 'plugin-creator', 'hearings', sessionId, 'state.json')));

      const refused = await peer.callTool(sessionId, 'plugin-creator_progress', { items: [{ item: '成果', status: '聞いた', quote: 'x' }] });
      assert.equal(refused.result, undefined);
      assert.match(refused.error, /^項目の名前が違います：「成果」。使える名前：作業の目的、/);

      const state = await peer.callTool(sessionId, 'plugin-creator_state', {});
      assert.match(state.result, /^段階：始まり$/m);
      assert.match(state.result, /画面：http:\/\/127\.0\.0\.1:\d+\/\?k=/);
      assert.match(state.result, new RegExp(`セッションの番号：${sessionId}`));

      // サブエージェント（読み取り役）から呼ばれても動く
      const reader = await peer.callTool(sessionId, 'plugin-creator_doc_text', { path: 'no-such.docx' }, { agentId: 'agent-reader-1' });
      assert.match(reader.error, /ファイルが見つかりません/);
      assert.equal(peer.stderr, '', `標準エラーに出力がある：${peer.stderr}`);
    });
  });

  test('REQ-049 本物の SDK 経由でフックが動く：問答と打った発言の記録（差し込みは返さない）、コンパクションの後の1回だけの差し込み', async () => {
    await withProcess(async ({ peer, home, sessionId }) => {
      await peer.callTool(sessionId, 'plugin-creator_progress', { stage: '始まり' });
      const qaFile = path.join(home, 'plugin-data', 'plugin-creator', 'hearings', sessionId, 'qa.jsonl');

      const post = await peer.hook(sessionId, 'postToolUse', {
        toolName: 'ask_user',
        toolArgs: { message: '提出はいつまでですか？', requestedSchema: { type: 'object', properties: { answer: { type: 'string' } } } },
        toolResult: { textResultForLlm: 'User responded: 金曜です', resultType: 'success' },
      });
      assert.equal(post, undefined, 'onPostToolUse が差し込みを返した');
      const prompt = await peer.hook(sessionId, 'userPromptSubmitted', { prompt: '早くしてください' });
      assert.equal(prompt, undefined, 'onUserPromptSubmitted が差し込みを返した');
      const cancelled = await peer.hook(sessionId, 'postToolUse', { toolName: 'ask_user', toolArgs: { message: '2つ目' }, toolResult: { textResultForLlm: 'User cancelled the request.', resultType: 'success' } });
      assert.equal(cancelled, undefined);

      const qa = fs
        .readFileSync(qaFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l));
      assert.deepEqual(qa.map((e) => [e.type, e.outcome]), [['ask_user', 'answered'], ['user_prompt', undefined], ['ask_user', 'cancelled']]);
      assert.equal(qa[0].question.message, '提出はいつまでですか？');
      assert.equal(qa[0].answer, 'User responded: 金曜です');
      assert.equal(qa[1].text, '早くしてください');

      // コンパクションの後：サブエージェントの呼び出しには差し込まず、次のメインのエージェントの呼び出しで1回だけ
      peer.sendEvent(sessionId, 'session.compaction_complete', { success: true });
      // イベントの通知は、SDK が非同期に処理する。サブエージェントのフックの答えが先に来ても、差し込みは取っておく
      const sub = await peer.hook(sessionId, 'preToolUse', { toolName: 'view', toolArgs: {}, agentId: 'agent-reader-1', agentType: 'plugin-creator:reader' });
      assert.equal(sub, undefined);
      const main = await peer.hook(sessionId, 'preToolUse', { toolName: 'view', toolArgs: {} });
      assert.ok(main?.additionalContext, '差し込みが返らない');
      assert.ok(Buffer.byteLength(main.additionalContext, 'utf8') < 1000);
      assert.match(main.additionalContext, /make-plugin/);
      const again = await peer.hook(sessionId, 'preToolUse', { toolName: 'view', toolArgs: {} });
      assert.equal(again, undefined, '1回だけ');
      assert.equal(peer.stderr, '', `標準エラーに出力がある：${peer.stderr}`);
    });
  });

  test('REQ-043 画面を開くツールが返した URL を開け、Copilot CLI がエクステンションを止める（SIGTERM）と、プロセスも画面のサーバーも終わる', async () => {
    await withProcess(async ({ peer, sessionId }) => {
      const opened = await peer.callTool(sessionId, 'plugin-creator_open', {});
      const url = /(http:\/\/127\.0\.0\.1:\d+\/\?k=\S+)/.exec(opened.result)[1];
      const u = new URL(url);
      const state = await fetch(`${u.origin}/api/state?k=${u.searchParams.get('k')}`);
      assert.equal(state.status, 200);
      assert.equal((await state.json()).hearing.exists, false);

      const { code, signal } = await peer.stop();
      assert.ok(code === 0 || signal === 'SIGTERM', `終わり方：${code}、${signal}`);
      await assert.rejects(fetch(`${u.origin}/api/state?k=${u.searchParams.get('k')}`), /fetch failed/);
    });
  });
});
