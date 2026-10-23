// EVAL の結果の置き場所・書き方・集計と、前の EVAL の記録の探し方。
//
// 結果は <生成プラグイン>/tests/results/eval-<日時>/result.json に書く（実行ごとの記録は同じフォルダの runs/ の下）。
// 形は、クリエイターの画面が読む形（com.github.copilot/extensions/plugin-creator/results.mjs）に合わせる：
//   runs[]    実行ごと。task、variant（with か without）、n、criteria[{ id, text, grading, pass, reason }]、score、credits ほか
//   scores    { with, without, difference, byTask }
//   credits   使った AI クレジットの合計（採点にモデルを使った分を含む）
//
// 実行の status（runs[].status）
//   completed   終わりまで動いた（ありは画面に終わった理由が出た。なしは手番が終わった）。採点する
//   incomplete  終わりまで動かなかった（URL が出ない、画面を操作できない、時間切れ、実行が途中で終わったなど）。できていた分を採点する
//   error       試験の仕組みの側の失敗（クライアントやセッションの失敗、モデルの呼び出しの失敗）。採点せず、点数に入れない
//   stopped     試験全体が止まったときに動いていた実行。採点せず、点数に入れない
//   skipped     試験全体が止まったので、始めなかった実行

import fs from 'node:fs';
import path from 'node:path';

export const RESULT_FILE = 'result.json';
const DIR_PATTERN = /^eval-\d{8}-\d{6}(?:-\d+)?$/;
const GRADED = new Set(['completed', 'incomplete']);

const pad = (n, width = 2) => String(n).padStart(width, '0');

/** eval-<日時> の名前（ローカルの時刻） */
export function evalDirName(date = new Date()) {
  return `eval-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/** 結果を置くフォルダを作る。同じ名前があれば -2、-3 を付ける */
export function createResultsDir(pluginDir, date = new Date()) {
  const root = path.join(pluginDir, 'tests', 'results');
  fs.mkdirSync(root, { recursive: true });
  const base = evalDirName(date);
  for (let n = 1; ; n += 1) {
    const dir = path.join(root, n === 1 ? base : `${base}-${n}`);
    try {
      fs.mkdirSync(dir); // すでにあれば EEXIST で失敗する（同じ秒に2つ始めても重ならない）
      return dir;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
}

/** 読む側が書きかけを見ないように、一時ファイルに書いてから名前を変える */
export function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

const round = (n, digits = 6) => (Number.isFinite(n) ? Math.round(n * 10 ** digits) / 10 ** digits : n);
const mean = (values) => (values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length);

/** nano-AIU を AI クレジットにする（1 AI クレジット = 10億 nano-AIU。testing.md 8.2） */
export const nanoAiuToCredits = (nano) => nano / 1_000_000_000;

/**
 * 実行の記録から、あり・なしの点数とその差、使った AI クレジットを集計する。
 * @param {Array} runs 実行ごとの記録
 * @returns {{ scores: object, credits: number, creditDetail: object, counts: object }}
 */
export function summarizeRuns(runs) {
  const graded = runs.filter((r) => GRADED.has(r.status) && Number.isFinite(r.score));
  const scoreOf = (variant, task) => mean(graded.filter((r) => r.variant === variant && (task === undefined || r.task === task)).map((r) => r.score));
  const withScore = scoreOf('with');
  const withoutScore = scoreOf('without');
  const diff = (a, b) => (a === null || b === null ? null : round(a - b));
  const byTask = {};
  for (const task of [...new Set(runs.map((r) => r.task))]) {
    const a = scoreOf('with', task);
    const b = scoreOf('without', task);
    byTask[task] = { with: round(a), without: round(b), difference: diff(a, b) };
  }
  const sum = (list, key) => list.reduce((total, r) => total + (Number.isFinite(r[key]) ? r[key] : 0), 0);
  const withRuns = runs.filter((r) => r.variant === 'with');
  const withoutRuns = runs.filter((r) => r.variant === 'without');
  const grading = sum(runs, 'judgeCredits');
  const detail = {
    with: round(sum(withRuns, 'credits')),
    without: round(sum(withoutRuns, 'credits')),
    grading: round(grading),
    status: runs.every((r) => (r.creditsStatus ?? 'complete') === 'complete' && (r.judgeCreditsStatus ?? 'complete') === 'complete') ? 'complete' : 'partial',
  };
  return {
    scores: { with: round(withScore), without: round(withoutScore), difference: diff(withScore, withoutScore), byTask },
    credits: round(detail.with + detail.without + detail.grading),
    creditDetail: detail,
    counts: {
      runs: runs.length,
      graded: graded.length,
      judgments: runs.reduce((total, r) => total + (r.judgments ?? 0), 0),
      byStatus: runs.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {}),
    },
  };
}

// ---- 前の EVAL の記録 ------------------------------------------------------------------------------

/**
 * 前に EVAL をしたときの結果のうち、最後まで動いたものを、新しい順に返す。
 * @returns {Array<{ name: string, file: string, json: object }>}
 */
export function findPreviousEvals(pluginDir) {
  const root = path.join(pluginDir, 'tests', 'results');
  let names;
  try {
    names = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && DIR_PATTERN.test(e.name)).map((e) => e.name);
  } catch {
    return [];
  }
  names.sort().reverse();
  const found = [];
  for (const name of names) {
    const file = path.join(root, name, RESULT_FILE);
    try {
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (json && json.kind === 'eval' && json.status === 'completed' && Array.isArray(json.runs)) found.push({ name, file, json });
    } catch {
      // 読めない記録は飛ばす
    }
  }
  return found;
}

/**
 * 前の EVAL の記録から、1回分の AI クレジット（ありの1回、なしの1回、モデルの判定1件）の平均を出す。
 * 使える記録がなければ null。
 */
export function perRunCredits(previous) {
  const ran = (r) => GRADED.has(r.status) && Number.isFinite(r.credits);
  const average = (variant) => mean(previous.json.runs.filter((r) => r.variant === variant && ran(r)).map((r) => r.credits));
  const withPer = average('with');
  const withoutPer = average('without');
  if (withPer === null || withoutPer === null) return null;
  const judged = previous.json.runs.filter((r) => ran(r) && (r.judgments ?? 0) > 0);
  const judgments = judged.reduce((total, r) => total + r.judgments, 0);
  const judgmentCredits = judged.reduce((total, r) => total + (Number.isFinite(r.judgeCredits) ? r.judgeCredits : 0), 0);
  return {
    from: previous.name,
    withPlugin: withPer,
    withoutPlugin: withoutPer,
    judgment: judgments > 0 ? judgmentCredits / judgments : null,
    partial: previous.json.creditDetail?.status === 'partial',
    runs: { with: previous.json.runs.filter((r) => r.variant === 'with' && ran(r)).length, without: previous.json.runs.filter((r) => r.variant === 'without' && ran(r)).length },
  };
}
