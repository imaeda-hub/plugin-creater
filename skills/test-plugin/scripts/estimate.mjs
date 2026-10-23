// EVAL の回数と AI クレジットの見込み（testing.md 8.2、REQ-040）。EVAL を始める前に示す。
//
//   見込み ＝ （ありの1回分 ＋ なしの1回分）× 課題の数 × 回数 ＋ 採点でモデルを使う分
//   採点でモデルを使う分 ＝ 1件の判定の分 × model の基準の数 × 回数 × 2（あり・なし）
//
// 1回分の出どころ
//   1. 同じ生成プラグインで前に EVAL をしたときの記録（tests/results/eval-*/result.json）から測った値
//   2. なければ、目安（GUIDELINE）。目安は、まだ測っていない（testing.md 8.2）。測ったら GUIDELINE を埋める
//   3. どちらもなければ、見込みは出さない（credits.estimate が null、credits.basis が "none"）
// 見込みは上限ではない。使った分は、EVAL の結果に示す（assistant.usage の totalNanoAiu を足し上げたもの）。

import { findPreviousEvals, perRunCredits } from './results.mjs';
import { countCriteria, loadTasks } from './tasks.mjs';

/**
 * 目安：1回あたりの AI クレジット。まだ測っていないので null。
 * 測るのは、最初の EVAL を人の承認を得て回すとき（実装の波 E）。測った値は、ここに書くか、前の記録として残る。
 */
export const GUIDELINE = Object.freeze({ measured: false, withPlugin: null, withoutPlugin: null, judgment: null });

const round = (n, digits = 2) => (Number.isFinite(n) ? Math.round(n * 10 ** digits) / 10 ** digits : n);
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * 見込みを計算する（計算だけ。ファイルは読まない）。
 * @param {{ tasks: Array, runs: number, previous?: object|null, guideline?: object }} args
 *   tasks は loadTasks の課題、previous は perRunCredits の結果
 */
export function computeEstimate({ tasks, runs, previous = null, guideline = GUIDELINE }) {
  const counts = tasks.map((t) => countCriteria(t));
  const taskCount = tasks.length;
  const modelCriteria = counts.reduce((total, c) => total + c.model, 0);
  const programCriteria = counts.reduce((total, c) => total + c.program, 0);
  const runCount = { with: taskCount * runs, without: taskCount * runs, total: taskCount * runs * 2 };
  const judgments = modelCriteria * runs * 2;

  let basis = 'none';
  let per = null;
  let from = null;
  if (previous && isNumber(previous.withPlugin) && isNumber(previous.withoutPlugin)) {
    basis = 'previous';
    per = previous;
    from = previous.from;
  } else if (guideline && isNumber(guideline.withPlugin) && isNumber(guideline.withoutPlugin)) {
    basis = 'guideline';
    per = guideline;
  }

  const credits = { estimate: null, basis, basisFrom: from, complete: false, perRun: null, isLimit: false };
  const notes = [];
  if (per) {
    const judgmentPer = isNumber(per.judgment) ? per.judgment : null;
    const runCredits = (per.withPlugin + per.withoutPlugin) * taskCount * runs;
    const judgeCredits = judgments === 0 ? 0 : judgmentPer === null ? null : judgmentPer * judgments;
    credits.estimate = round(runCredits + (judgeCredits ?? 0));
    credits.complete = judgeCredits !== null;
    credits.perRun = { with: round(per.withPlugin), without: round(per.withoutPlugin), judgment: judgmentPer === null ? null : round(judgmentPer, 4) };
    credits.parts = { runs: round(runCredits), judging: judgeCredits === null ? null : round(judgeCredits) };
    if (judgeCredits === null) notes.push('採点にモデルを使う分は、1件の判定の費用をまだ測っていないので、見込みに含めていません。');
    if (basis === 'previous' && previous.partial) notes.push('前の記録は、数えきれなかった呼び出しがあるため、実際より少ないかもしれません。');
  } else {
    notes.push('この生成プラグインで EVAL をしたことがなく、1回あたりの AI クレジットの目安もまだ測っていないので、見込みは出せません。');
  }

  const lead = `課題 ${taskCount} 件を、生成プラグインあり・なしのそれぞれで ${runs} 回ずつ、合わせて ${runCount.total} 回動かします。`;
  let message;
  if (credits.estimate === null) {
    message = `${lead}${notes.join('')}使った AI クレジットは、終わった後に示します。`;
  } else {
    const source = basis === 'previous' ? `前に EVAL をしたとき（${from}）に測った 1 回分をもとにした` : '目安をもとにした';
    message = `${lead}${source}見込みは、約 ${Math.round(credits.estimate)} AI クレジットです。${notes.join('')}見込みは上限ではありません。使った分は、終わった後に示します。`;
  }

  return {
    runsPerTask: runs,
    counts: { tasks: taskCount, criteria: programCriteria + modelCriteria, programCriteria, modelCriteria, runs: runCount, judgments },
    credits,
    guideline: { measured: Boolean(guideline?.measured) },
    message,
  };
}

/**
 * 生成プラグインの課題と前の記録を読んで、見込みを出す。
 * @returns {{ ok: true, ...estimate } | { ok: false, problems: string[] }}
 */
export function estimatePlugin({ pluginDir, runs, guideline = GUIDELINE }) {
  const { tasks, problems } = loadTasks(pluginDir);
  if (problems.length > 0) return { ok: false, problems };
  const previous = findPreviousEvals(pluginDir).map(perRunCredits).find(Boolean) ?? null;
  return {
    ok: true,
    tasks: tasks.map((t) => ({ id: t.id, criteria: countCriteria(t).total, modelCriteria: countCriteria(t).model })),
    ...computeEstimate({ tasks, runs, previous, guideline }),
  };
}
