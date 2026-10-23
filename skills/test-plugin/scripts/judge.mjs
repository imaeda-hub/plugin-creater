// モデルで判定する関数（ユーザーの試験。testing.md 10.4「採点と記録」、10.5）。
// 基準の文と成果物を渡して、合否と理由を返す。判定には Copilot SDK のセッションを使う（開発の試験は Agent SDK で同じ形の関数を作る）。
// 指示文と返事の読み取りは grade.mjs の buildJudgePrompt と parseJudgeReply で、開発の試験と同じものを使う。
//
// 判定のセッションは、生成プラグインもエクステンションも読み込まず、ツールの許可をすべて拒む（成果物は指示文に入れて渡すので、ツールは要らない）。
// 判定に使った AI クレジットは、返り値の credits に入れる（見込みと使った分に入れるため。testing.md 10.4）。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createTracker, waitUntil } from './events.mjs';
import { buildJudgePrompt, parseJudgeReply } from './grade.mjs';
import { runtimeEnv } from './run.mjs';

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * @param {object} args
 * @param {object} args.sdk Copilot SDK（CopilotClient、RuntimeConnection）
 * @param {object} [args.env] ランタイムに渡す環境
 * @param {string} [args.model] 判定のモデル（省くと Copilot の既定）
 * @param {number} [args.timeoutMs] 1件の判定の上限
 * @param {number} [args.sdkCallMs] 起動とセッションの作成の上限
 * @param {number} [args.closeMs] 閉じるのを待つ上限
 * @returns {Function & { close: () => Promise<void> }} ({ criterion, task, artifacts }) => Promise<{ pass, reason, error?, credits, creditsStatus }>
 */
export function createCopilotJudge({ sdk, env = process.env, model, timeoutMs = 180_000, sdkCallMs = 90_000, closeMs = 15_000 }) {
  let client = null;
  let starting = null;
  let dir = null;

  const ensureClient = () => {
    starting ??= (async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-creator-judge-'));
      client = new sdk.CopilotClient({
        connection: sdk.RuntimeConnection.forStdio({ args: [], env: runtimeEnv(env) }),
        workingDirectory: dir,
        logLevel: 'error',
      });
      await withTimeout(client.start(), sdkCallMs, '判定のためのランタイムを起動できませんでした（時間切れ）');
    })().catch(async (error) => {
      // 起動に失敗したら、次の判定で起動し直せるようにする
      const failed = client;
      client = null;
      starting = null;
      try {
        await failed?.stop?.();
      } catch {
        // 止められなくても、元の失敗を伝える
      }
      throw error;
    });
    return starting;
  };

  const judge = async ({ criterion, task, artifacts }) => {
    await ensureClient();
    const tracker = createTracker();
    let reply = '';
    let session = null;
    try {
      session = await withTimeout(
        client.createSession({
          ...(model ? { model } : {}),
          workingDirectory: dir,
          trustWorkingDirectory: 'session',
          onPermissionRequest: () => ({ kind: 'reject', feedback: 'この判定では、ツールは使えません。渡した文章だけで判定してください。' }),
          onEvent: (event) => {
            tracker.onEvent(event);
            if (event?.type === 'assistant.message' && !event.agentId) reply = event.data?.content ?? reply;
          },
        }),
        sdkCallMs,
        '判定のセッションを作れませんでした（時間切れ）',
      );
      tracker.markSent();
      await session.send({ prompt: buildJudgePrompt({ criterion, task, artifacts }) });
      const outcome = await waitUntil(() => tracker.state.errors.length > 0 || (tracker.state.idleCount > 0 && !tracker.state.busy), { timeoutMs });
      const credits = tracker.credits();
      const spent = { credits: credits.credits, creditsStatus: credits.status };
      if (tracker.state.errors.length > 0) return { pass: false, error: true, reason: `判定のセッションがエラーになりました（${tracker.state.errors[0]}）`, ...spent };
      if (outcome === 'timeout') return { pass: false, error: true, reason: '判定の返事が時間内に返りませんでした', ...spent };
      try {
        return { ...parseJudgeReply(reply), ...spent };
      } catch (error) {
        return { pass: false, error: true, reason: error.message, ...spent };
      }
    } finally {
      if (session) {
        try {
          await withTimeout(Promise.resolve(session.abort?.()).catch(() => {}), closeMs, 'abort の時間切れ');
          await withTimeout(session.disconnect(), closeMs, 'セッションを閉じられませんでした（時間切れ）');
        } catch {
          // 閉じられなくても、判定の結果には影響しない
        }
      }
    }
  };

  judge.close = async () => {
    if (client) {
      try {
        await withTimeout(client.stop(), closeMs, 'クライアントを止められませんでした（時間切れ）');
      } catch {
        try {
          await client.forceStop?.();
        } catch {
          // 止められないものは、そのままにする
        }
      }
    }
    client = null;
    starting = null;
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    dir = null;
  };
  return judge;
}
