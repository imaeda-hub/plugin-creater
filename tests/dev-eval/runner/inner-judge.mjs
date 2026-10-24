// モデルで判定する関数の Agent SDK 版（testing.md 10.5。ユーザーの試験の Copilot SDK 版は skills/test-plugin/scripts/judge.mjs）。
// 基準の文と成果物を渡して、合否と理由を返す。指示文と返事の読み取りは grade.mjs の buildJudgePrompt と parseJudgeReply で、
// ユーザーの試験と同じものを使う。
//
// 判定のセッションは、プラグインも設定も読み込まず、ツールを何も持たない（成果物は指示文に入れて渡す）。1件につき1回の呼び出し。
// 判定に使った費用（USD）は judge.costUsd に足し上げる（Copilot の AI クレジットではなく、Claude の定価での見積もり）。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildJudgePrompt, parseJudgeReply } from '../../../skills/test-plugin/scripts/grade.mjs';
import { agentEnv } from './isolation.mjs';

export const JUDGE_MODEL = 'claude-sonnet-5-5';

/**
 * @param {object} args
 * @param {{ query: Function }} args.sdk Agent SDK
 * @param {string} [args.model] 判定のモデル（Claude Code の ID）
 * @param {object} [args.envExtra]
 * @param {number} [args.timeoutMs] 1件の判定の上限
 * @param {object} [args.base] 環境変数のもと（試験用）
 * @returns {Function & { costUsd: number, calls: number, close: () => void }}
 *   ({ criterion, task, artifacts }) => Promise<{ pass, reason, error?, costUsd }>
 */
export function createAgentSdkJudge({ sdk, model = JUDGE_MODEL, envExtra = {}, timeoutMs = 180_000, base }) {
  let dir = null;
  const ensureDir = () => {
    dir ??= fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-creator-dev-judge-'));
    return dir;
  };
  const judge = async ({ criterion, task, artifacts }) => {
    const root = ensureDir();
    const home = fs.mkdtempSync(path.join(root, 'home-'));
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    judge.calls += 1;
    let text = '';
    let isError = false;
    let detail = '';
    let cost = 0;
    try {
      const options = {
        model, maxTurns: 1, tools: [], settingSources: [], persistSession: false, cwd: root, abortController: abort,
        systemPrompt: 'あなたは、作業の成果物を採点する人です。渡された文章だけで、決まった形で答えます。',
        env: agentEnv({ home, extra: envExtra, ...(base ? { base } : {}) }),
      };
      for await (const m of sdk.query({ prompt: buildJudgePrompt({ criterion, task, artifacts }), options })) {
        if (m.type !== 'result') continue;
        cost = m.total_cost_usd ?? 0;
        isError = m.is_error === true || String(m.subtype).startsWith('error');
        text = typeof m.result === 'string' ? m.result : '';
        detail = text || (m.errors ?? []).join('、') || String(m.subtype);
      }
    } catch (error) {
      isError = true;
      detail = abort.signal.aborted ? '判定の返事が時間内に返りませんでした' : `判定の呼び出しが失敗しました（${error?.message ?? error}）`;
    } finally {
      clearTimeout(timer);
      fs.rmSync(home, { recursive: true, force: true });
    }
    judge.costUsd += cost;
    if (isError || text === '') {
      return { pass: false, error: true, reason: `判定の呼び出しが誤りで終わりました（${detail.slice(0, 200)}）`, costUsd: cost };
    }
    try {
      return { ...parseJudgeReply(text), costUsd: cost };
    } catch (error) {
      return { pass: false, error: true, reason: error.message, costUsd: cost };
    }
  };
  judge.costUsd = 0;
  judge.calls = 0;
  judge.close = () => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    dir = null;
  };
  return judge;
}
