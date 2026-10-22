import { LIMITS } from './constants.mjs';
import {
  analyzeEntries,
  buildMechanicalSummary,
  iterationsFromEntries,
  numberIssues,
  phaseFromEntries,
} from './analysis.mjs';
import { viewEndReason, viewIssues } from './run.mjs';

// エクステンションが起動したとき（セッションの始めと読み込み直し）の、記録のファイルの読み直し（4.13、6.5）。
//   - 終わっていない実行のうち、途中で切れたものを終わらせる
//   - 拒む一覧を、自分のセッションの終わった実行の木から作り直す
//   - 古い記録を件数で消す
//   - 準備中の画面に出す、前の実行を探す

// ---- 終わっていない実行の扱いの分かれ目（ここ 1 か所） ----------------------------------------
// 起動したときに見つけた「終わっていない実行」を、どうするかを決める。
// 返り値：
//   'cut_off'      すぐ「途中で切れた」として終わらせる
//   'check_later'  生きている印が新しい。決めた時間が過ぎてから、もう一度確かめる
// 設計書 6.5 のとおり、自分のセッション（記録のセッションの番号が今と同じ）の実行は、生きている印を待たずに
// すぐ途中で切れたとする。
// 要確認：/clear なしで同じセッションのまま、エクステンションだけが起動し直されることがある
// （調べもの R2 の (2)#3。`extensions_reload`）。そのときは裏の統括が動き続ける見込みなので、
// ここの扱い（たとえば自分のセッションの実行も生きている印で見分ける、統括を探して取り消す）は
// ユーザーの答え次第で変える。変えるのはこの関数だけにする。
export function classifyUnfinishedRun({ begin, aliveAt, now, sessionId }) {
  if (begin && begin.sessionId === sessionId) return 'cut_off';
  if (aliveAt === null || aliveAt === undefined || now - aliveAt > LIMITS.ALIVE_STALE_MS) return 'cut_off';
  return 'check_later';
}
// ----------------------------------------------------------------------------------------------

function lastTimestamp(entries, fallback) {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(entries[i].at)) return entries[i].at;
  }
  return fallback;
}

// 途中で切れた実行を、記録の上で終了にする（result.json を置く）
export function markCutOff(ctx, runId, entries, begin) {
  const now = ctx.clock.now();
  const userCriteria = begin?.criteria ?? [];
  const iterations = iterationsFromEntries(entries, userCriteria);
  const endReason = { kind: 'aborted', detail: 'cut_off', unstoppable: false };
  const drafts = analyzeEntries(entries, {
    pluginName: ctx.pluginName,
    runId,
    endReason,
    endAt: lastTimestamp(entries, now),
    unstopped: [],
    isAuto: begin?.isAuto ?? false,
    models: begin?.settings?.models ?? {},
  });
  const summary = buildMechanicalSummary({ iterations, phase: phaseFromEntries(entries, ctx.pluginName) });
  const result = {
    runId,
    id: runId,
    sessionId: begin?.sessionId ?? null,
    cwd: begin?.cwd ?? null,
    startedAt: begin?.at ?? null,
    finishedAt: now,
    status: 'finished',
    endReason,
    settings: begin?.settings ?? null,
    isAuto: begin?.isAuto ?? false,
    phase: null,
    iteration: iterations.length > 0 ? iterations[iterations.length - 1].n : 0,
    maxIterations: begin?.settings?.maxIterations ?? null,
    agents: [],
    iterations,
    displays: {},
    summary,
    issues: numberIssues(drafts, 'M', 'mechanical'),
    unstopped: [],
    waits: [],
    cutOff: true,
  };
  try {
    ctx.store.append(runId, { t: 'status', at: now, status: 'finished', endReason });
  } catch {
    // 記録に書けなくても、終了の印は置く
  }
  ctx.store.writeResult(runId, result);
}

// 拒む一覧を作り直す。元にするのは、自分のセッションの終わった実行の log.jsonl にある、木に入れたエージェントの番号。
// ほかのセッションの実行は使わない（4.4、6.5）。
export function rebuildDenyList(ctx) {
  for (const runId of ctx.store.listRuns()) {
    if (!ctx.store.hasResult(runId)) continue;
    const entries = ctx.store.readLog(runId);
    const begin = entries.find((e) => e.t === 'begin');
    if (!begin || begin.sessionId !== ctx.sessionId) continue;
    for (const entry of entries) {
      if (entry.t === 'tree' && Array.isArray(entry.agentIds)) for (const id of entry.agentIds) ctx.deny.add(id);
    }
  }
}

function examine(ctx, runId) {
  const entries = ctx.store.readLog(runId);
  const begin = entries.find((e) => e.t === 'begin') ?? null;
  const action = classifyUnfinishedRun({
    begin,
    aliveAt: ctx.store.readAlive(runId),
    now: ctx.clock.now(),
    sessionId: ctx.sessionId,
  });
  return { entries, begin, action };
}

export function recoverOnStartup(ctx) {
  try {
    ctx.store.ensureRoot();
  } catch {
    return; // 記録の置き場所が使えないときは、読み直すものがない
  }
  const later = [];
  for (const runId of ctx.store.listRuns()) {
    if (ctx.store.hasResult(runId)) continue;
    try {
      const { entries, begin, action } = examine(ctx, runId);
      if (action === 'cut_off') {
        markCutOff(ctx, runId, entries, begin);
        ctx.cutOffRuns.push(runId);
      } else if (action === 'check_later') {
        later.push(runId);
      }
    } catch {
      // 読めない実行は、そのままにする
    }
  }
  try {
    rebuildDenyList(ctx);
    ctx.store.purge(LIMITS.KEEP_RUNS);
  } catch {
    // 拒む一覧と掃除の失敗で、起動は止めない
  }
  if (later.length > 0) {
    ctx.recheckTimer = ctx.clock.setTimeout(() => {
      ctx.recheckTimer = null;
      for (const runId of later) {
        if (ctx.store.hasResult(runId)) continue;
        try {
          const { entries, begin, action } = examine(ctx, runId);
          if (action === 'cut_off') markCutOff(ctx, runId, entries, begin);
        } catch {
          // 読めない実行は、そのままにする
        }
      }
      ctx.bump();
    }, LIMITS.ALIVE_STALE_MS + 1000);
  }
}

// 準備中の画面に出す、前の実行（4.2）。同じセッションの最後の実行。なければ、同じ作業フォルダの最後の実行。
// 返り値：{ runId, result } か null。画面に出す形は viewPrevious() で作る（起票の状態を、見るたびに印から読むため）。
export function loadPrevious(ctx) {
  let sameCwd = null;
  for (const runId of ctx.store.listRuns().reverse()) {
    const result = ctx.store.readResult(runId);
    if (!result || result.startFailed) continue;
    if (result.sessionId === ctx.sessionId) return { runId, result };
    if (!sameCwd && result.cwd === ctx.cwd) sameCwd = { runId, result };
  }
  return sameCwd;
}

export function viewPrevious(ctx, previous) {
  if (!previous) return null;
  const { runId, result } = previous;
  return {
    runId,
    endReason: viewEndReason(result.endReason),
    summary: result.summary ?? null,
    issues: viewIssues(ctx, runId, result.issues ?? []),
    finishedAt: result.finishedAt ?? null,
    canFile: JSON.parse(JSON.stringify(ctx.canFile)),
  };
}
