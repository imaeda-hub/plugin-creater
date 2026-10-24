// 外側の EVAL の入口（testing.md 3章の手順2〜3、6章）。クリエイターを置き換えて、模擬ユーザー（ユーザー役）と話させ、できた生成プラグインを採点する。
// 実際のモデルを使う。統括がユーザーの承認をとってから動かすこと（RESUME.md、common.md）。回数と費用の見込みは --dry-run で出す。
//
// 使い方（リポジトリの根から。事前に cd tests/dev-eval && npm install）:
//   node tests/dev-eval/runner/outer.mjs --persona <模擬ユーザーのフォルダ>… [--heldout] [--style 名前]… [--all-styles]
//        [--arms with,control,without] [--models claude-opus-5-5,claude-haiku-5-5] [--runs 1]
//        [--creator <クリエイター（Copilot CLI 向け）のフォルダ。既定はこのリポジトリの直下>] [--control <対照のクリエイターのフォルダ>]
//        [--converted <置き換えた版>] [--inner] [--out <結果のフォルダ>] [--no-sandbox] [--dry-run]
//        [--max-exchanges 150] [--user-model <ID>] [--timeout-minutes 60]
//   --heldout            tests/dev-eval/heldout/ の中の見ない模擬ユーザーを、実行のときに読み込んで足す（中身は人が読まない決まり。結果の要約は伏せ字にする）
//   --arms               with＝クリエイター、control＝対照のクリエイター（大まかな質問しかしない）、without＝何も読み込まない（比べるため）。既定は with
//   --models             クリエイターのモデル。既定は claude-opus-5-5（思考力の高いモデル）。Claude Haiku 5.5 でも回すなら、コンマで足す
//   --inner              できた生成プラグインに内側の EVAL（inner.mjs）も動かす（プラグインあり・なしの比べ合い。時間と費用が増える）
//   サンドボックス（bubblewrap、socat）が既定で要る。ないときは始めずに断る。--no-sandbox で外せる（結果に警告が残る）。
//   終了コード：0 最後まで動いた（点数が低くても 0）、1 途中で止まった（利用枠の上限、中断）、2 始められなかった。
//   標準出力は結果の要約の JSON、進み具合は標準エラー出力。結果は <out>/outer-report.json に、実行が 1 つ終わるたびに書き直す。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPersona } from '../personas/validate.mjs';
import { sandboxStatus } from './isolation.mjs';
import { REPO_ROOT } from './creator-tools.mjs';
import { DEFAULTS, convertPlugin, defaultRunRoot, runOuterOnce } from './outer-run.mjs';
import { USER_ROLE_MODEL, loadQuery } from './user-role.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEV_EVAL = path.resolve(HERE, '..');
export const PERSONAS_DIR = path.join(DEV_EVAL, 'personas');
/** 見ない模擬ユーザーの置き場所。中身は、実行のときにだけ読み込む（人は読まない） */
export const HELDOUT_DIR = path.join(DEV_EVAL, 'heldout');
export const CONTROL_DIR = path.join(DEV_EVAL, 'control-creator');

/** 費用の目安（ドル。testing.md 8.1 の試作の値。Claude の定価での見積もり）。実行のたびに変わるので、目安にとどめる */
export const COST_GUIDE_USD = Object.freeze({ withoutInner: 0.1, withInner: 0.4, control: 0.05, without: 0.05 });

export class OuterEvalError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OuterEvalError';
    this.code = code;
  }
}

// ---- 引数 ----------------------------------------------------------------------------------------------------

export function parseArgs(argv) {
  const out = { personas: [], heldout: false, styles: [], allStyles: false, arms: ['with'], models: [DEFAULTS.model], runs: 1, inner: false, sandbox: true, dryRun: false };
  const need = (i, flag) => {
    if (i + 1 >= argv.length) throw new OuterEvalError('usage', `${flag} には値が要ります。`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    switch (flag) {
      case '--persona': out.personas.push(need(i, flag)); i += 1; break;
      case '--heldout': out.heldout = true; break;
      case '--style': out.styles.push(need(i, flag)); i += 1; break;
      case '--all-styles': out.allStyles = true; break;
      case '--arms': out.arms = need(i, flag).split(',').map((s) => s.trim()).filter(Boolean); i += 1; break;
      case '--models': out.models = need(i, flag).split(',').map((s) => s.trim()).filter(Boolean); i += 1; break;
      case '--runs': out.runs = Number(need(i, flag)); i += 1; break;
      case '--creator': out.creator = need(i, flag); i += 1; break;
      case '--control': out.control = need(i, flag); i += 1; break;
      case '--converted': out.converted = need(i, flag); i += 1; break;
      case '--inner': out.inner = true; break;
      case '--out': out.out = need(i, flag); i += 1; break;
      case '--user-model': out.userModel = need(i, flag); i += 1; break;
      case '--max-exchanges': out.maxExchanges = Number(need(i, flag)); i += 1; break;
      case '--timeout-minutes': out.timeoutMs = Number(need(i, flag)) * 60_000; i += 1; break;
      case '--no-sandbox': out.sandbox = false; break;
      case '--sandbox': out.sandbox = true; break;
      case '--dry-run': out.dryRun = true; break;
      default: throw new OuterEvalError('usage', `知らない引数です：${flag}`);
    }
  }
  if (out.personas.length === 0 && !out.heldout) throw new OuterEvalError('usage', '--persona（模擬ユーザーのフォルダ）か --heldout が要ります。');
  if (!Number.isInteger(out.runs) || out.runs < 1) throw new OuterEvalError('usage', '--runs は 1 以上の整数にしてください。');
  if (out.arms.length === 0 || !out.arms.every((a) => ['with', 'control', 'without'].includes(a))) throw new OuterEvalError('usage', '--arms は with・control・without（コンマ区切り）にしてください。');
  if (out.models.length === 0 || !out.models.every((m) => /^claude-[a-z]+-\d+-\d+$/.test(m))) throw new OuterEvalError('usage', '--models は Claude Code のモデルの ID（例：claude-opus-5-5）で書いてください。別名は使えません。');
  if (out.maxExchanges !== undefined && !(Number.isInteger(out.maxExchanges) && out.maxExchanges > 0)) throw new OuterEvalError('usage', '--max-exchanges は 1 以上の整数にしてください。');
  if (out.timeoutMs !== undefined && !(out.timeoutMs > 0)) throw new OuterEvalError('usage', '--timeout-minutes は正の数にしてください。');
  return out;
}

// ---- 模擬ユーザーの読み込み --------------------------------------------------------------------------------------

/** フォルダの中の、persona.json のある子フォルダ（見ない模擬ユーザーの探し方）。ないフォルダは空 */
export function discoverPersonaDirs(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'persona.json')))
      .map((e) => path.join(dir, e.name))
      .sort();
  } catch {
    return [];
  }
}

/**
 * 模擬ユーザーを読み込む。見ない模擬ユーザー（heldout）は、実行のときにここで読み込む。形が決まりに合わなければ断る。
 * @returns {Promise<Array<{ loaded: object, heldout: boolean }>>}
 */
export async function loadPersonas({ dirs, heldout, heldoutDir = HELDOUT_DIR }) {
  const out = [];
  for (const dir of dirs) out.push({ loaded: await loadPersona(path.resolve(dir)), heldout: false });
  if (heldout) {
    const found = discoverPersonaDirs(heldoutDir);
    if (found.length === 0) throw new OuterEvalError('no_heldout', `見ない模擬ユーザーが見つかりません（${heldoutDir}）。`);
    for (const dir of found) out.push({ loaded: await loadPersona(dir), heldout: true });
  }
  const ids = out.map((p) => p.loaded.persona.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new OuterEvalError('duplicate_persona', `模擬ユーザーの id が重なっています：${dup}`);
  return out;
}

// ---- 計画 --------------------------------------------------------------------------------------------------------

/** 動かす実行の一覧。模擬ユーザー × 話し方 × 腕 × モデル × 回数 */
export function planRuns({ personas, styles = [], allStyles = false, arms, models, runs, inner = false }) {
  const plan = [];
  for (const { loaded, heldout } of personas) {
    const styleNames = allStyles ? Object.keys(loaded.persona.styles) : styles.length ? styles : ['normal'];
    for (const style of styleNames) {
      if (!loaded.persona.styles[style]) throw new OuterEvalError('usage', `話し方「${style}」は、模擬ユーザー ${loaded.persona.id} にありません。`);
      for (const arm of arms) {
        // 対照とプラグインなしは、クリエイターのモデルを替えても意味が薄いので、最初のモデルだけで動かす
        const armModels = arm === 'with' ? models : models.slice(0, 1);
        for (const model of armModels) {
          for (let n = 1; n <= runs; n += 1) plan.push({ persona: loaded.persona.id, heldout, style, arm, model, n, inner: inner && arm === 'with' });
        }
      }
    }
  }
  return plan;
}

export function estimateUsd(plan) {
  return Number(plan.reduce((sum, p) => sum + (p.arm === 'with' ? (p.inner ? COST_GUIDE_USD.withInner : COST_GUIDE_USD.withoutInner) : p.arm === 'control' ? COST_GUIDE_USD.control : COST_GUIDE_USD.without), 0).toFixed(2));
}

// ---- 結果の要約 --------------------------------------------------------------------------------------------------

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** 見ない模擬ユーザーの要約では、ナレッジの id を伏せる（人が中身を推測できないように） */
const redactGrade = (g, redact, order) => (redact ? { ...g, id: g.id.replace(/:(.+)$/, (_, k) => `:#${order.indexOf(k) + 1}`), detail: '' } : g);

/** 1 回の記録の要約 */
export function summarizeRecord(record, { heldout = false } = {}) {
  const order = record.grading.trace.map((t) => t.id);
  return {
    persona: heldout ? `heldout-${record.persona.id.length}` : record.persona.id,
    heldout,
    style: record.style,
    arm: record.arm,
    model: record.models.creator,
    stopped: record.stopped?.reason ?? null,
    score: record.grading.score,
    verdictOk: record.grading.verdict.ok,
    failed: record.grading.grades.filter((g) => !g.ok).map((g) => redactGrade(g, heldout, order).id),
    exampleCandidate: heldout ? false : record.grading.exampleCandidate,
    faults: heldout ? record.grading.faults.length : record.grading.faults,
    costUsd: Number(((record.costUsd?.creator ?? 0) + (record.costUsd?.userRole ?? 0)).toFixed(4)),
    ...(heldout
      ? {}
      : {
          trace: record.grading.trace.map((t) => ({ id: t.id, volunteer: t.volunteer, asked: t.asked, answered: t.answered, embedded: t.embedded, excludedHit: t.excludedHit, verdict: t.verdict })),
        }),
  };
}

/**
 * 対照のクリエイターの確かめ（testing.md 6.3）：聞かれないと話さないナレッジが組み込まれず、ユーザー役にも漏れがない。
 * 対照で、聞かれないと話さないナレッジが組み込まれたら、試験が落ちるべきときに落ちていない（試験を疑う）。
 */
export function evaluateControl(records) {
  const controls = records.filter((r) => r.arm === 'control');
  if (controls.length === 0) return null;
  const problems = [];
  for (const r of controls) {
    for (const t of r.grading.trace) {
      if (t.volunteer || t.id === 'first-run') continue;
      if (t.embedded === true) problems.push(`${r.persona.id}：対照のクリエイターが、聞かれないと話さないナレッジ ${t.id} を組み込んだ`);
      if (t.leaked) problems.push(`${r.persona.id}：ユーザー役が、聞かれていないのにナレッジ ${t.id} を話した`);
    }
  }
  return { ok: problems.length === 0, runs: controls.length, problems };
}

/** 全体の要約。腕・モデルごとの平均点と、あり・なしの差 */
export function summarizeAll(records, summaries) {
  const key = (s) => `${s.arm}:${s.model}`;
  const groups = {};
  for (const s of summaries) (groups[key(s)] ??= []).push(s);
  const scores = Object.fromEntries(Object.entries(groups).map(([k, xs]) => [k, { runs: xs.length, score: mean(xs.map((x) => x.score)), verdictOk: xs.filter((x) => x.verdictOk).length }]));
  const withScores = summaries.filter((s) => s.arm === 'with').map((s) => s.score);
  const withoutScores = summaries.filter((s) => s.arm === 'without').map((s) => s.score);
  return {
    scores,
    delta: withScores.length && withoutScores.length ? mean(withScores) - mean(withoutScores) : null,
    control: evaluateControl(records),
    costUsd: Number(summaries.reduce((a, s) => a + s.costUsd, 0).toFixed(4)),
  };
}

// ---- 実行 ----------------------------------------------------------------------------------------------------------

/**
 * 計画どおりに動かす。実行が 1 つ終わるたびに、結果のファイルを書き直す。利用枠の上限で止まったら、残りは飛ばす。
 * @param {object} o
 * @param {Array} o.plan
 * @param {Map<string, { loaded: object, heldout: boolean }>} o.personaById
 * @param {string} o.outDir
 * @param {Function} [o.runOne] 1 回を動かす関数（既定は runOuterOnce。試験で差し替える）
 */
export async function runPlan({ plan, personaById, outDir, creatorRoot, controlRoot, convertedCreator, convertedControl, runOne = runOuterOnce, common = {}, signal, onProgress = () => {} }) {
  fs.mkdirSync(outDir, { recursive: true });
  const reportFile = path.join(outDir, 'outer-report.json');
  const records = [];
  const summaries = [];
  const report = { kind: 'dev-outer-eval', status: 'running', stopped: null, startedAt: new Date().toISOString(), finishedAt: null, plan, summaries, summary: null, warnings: [], reportFile, heldoutRecordsDir: null };
  if (common.sandbox === false) report.warnings.push('OS のサンドボックスなしで動かした（コマンドが作業フォルダの外に書ける）');
  const save = () => {
    report.summary = summarizeAll(records, summaries);
    fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  };
  save();
  let stopped = null;
  for (const [index, item] of plan.entries()) {
    const { loaded, heldout } = personaById.get(item.persona);
    if (stopped || signal?.aborted) {
      summaries.push({ persona: heldout ? 'heldout' : item.persona, heldout, style: item.style, arm: item.arm, model: item.model, stopped: stopped ? 'skipped' : 'interrupted', score: 0, verdictOk: false, failed: [], exampleCandidate: false, faults: [], costUsd: 0 });
      continue;
    }
    onProgress({ phase: 'start', index: index + 1, total: plan.length, ...item, persona: heldout ? '(見ない模擬ユーザー)' : item.persona });
    const recordsDir = path.join(outDir, heldout ? 'records-heldout' : 'records');
    if (heldout) report.heldoutRecordsDir = recordsDir;
    const record = await runOne({
      ...common,
      loaded,
      arm: item.arm,
      styleName: item.style,
      model: item.model,
      creatorRoot: item.arm === 'control' ? controlRoot : creatorRoot,
      convertedCreator: item.arm === 'control' ? convertedControl : item.arm === 'with' ? convertedCreator : undefined,
      runRoot: path.join(outDir, 'runs'),
      inner: item.inner,
      signal,
      onProgress: (p) => onProgress({ ...p, persona: heldout ? '(見ない模擬ユーザー)' : item.persona }),
    });
    record.heldout = heldout;
    fs.mkdirSync(recordsDir, { recursive: true });
    const recordName = `${item.persona}-${item.style}-${item.arm}-${item.model}-${item.n}.json`;
    fs.writeFileSync(path.join(recordsDir, recordName), `${JSON.stringify(record, null, 2)}\n`);
    records.push(record);
    summaries.push(summarizeRecord(record, { heldout }));
    save();
    onProgress({ phase: 'end', index: index + 1, total: plan.length, ...item, persona: heldout ? '(見ない模擬ユーザー)' : item.persona, score: record.grading.score, stopped: record.stopped?.reason });
    if (record.stopped?.reason === 'usage_limit') stopped = { reason: 'usage_limit', message: record.stopped.message ?? '', at: `${item.persona}/${item.arm}/${item.model}/${item.n}` };
    if (record.stopped?.reason === 'interrupted') stopped = { reason: 'interrupted', at: `${item.persona}/${item.arm}/${item.model}/${item.n}` };
  }
  report.stopped = stopped;
  report.status = stopped ? 'stopped' : 'completed';
  report.finishedAt = new Date().toISOString();
  save();
  return report;
}

export async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: error.code ?? 'usage', message: error.message }));
    return 2;
  }
  const abort = new AbortController();
  process.once('SIGINT', () => abort.abort());
  try {
    const personas = await loadPersonas({ dirs: args.personas, heldout: args.heldout });
    const plan = planRuns({ personas, styles: args.styles, allStyles: args.allStyles, arms: args.arms, models: args.models, runs: args.runs, inner: args.inner });
    if (args.dryRun) {
      console.log(JSON.stringify({ ok: true, dryRun: true, runs: plan.length, estimateUsd: estimateUsd(plan), note: '費用は試作（Claude の定価）の目安。実行のたびに変わる。利用枠も使う。', plan: plan.map((p) => ({ ...p, persona: p.heldout ? '(見ない模擬ユーザー)' : p.persona })) }, null, 2));
      return 0;
    }
    if (args.sandbox) {
      const status = sandboxStatus();
      if (!status.available) throw new OuterEvalError('sandbox_missing', `OS のサンドボックスの道具が足りません（${status.missing.join('、')}）。入れるか、--no-sandbox で外してください（外すと、コマンドが作業フォルダの外に書けます）。`);
    }
    const outDir = path.resolve(args.out ?? fs.mkdtempSync(path.join(defaultRunRootEnsured(), 'outer-')));
    fs.mkdirSync(outDir, { recursive: true });
    const creatorRoot = path.resolve(args.creator ?? REPO_ROOT);
    const controlRoot = path.resolve(args.control ?? CONTROL_DIR);
    let convertedCreator;
    let convertedControl;
    if (args.arms.includes('with')) convertedCreator = args.converted ? path.resolve(args.converted) : convertPlugin(creatorRoot, path.join(outDir, 'converted', 'creator')).root;
    if (args.arms.includes('control')) convertedControl = convertPlugin(controlRoot, path.join(outDir, 'converted', 'control')).root;
    const query = await loadQuery();
    const personaById = new Map(personas.map((p) => [p.loaded.persona.id, p]));
    const report = await runPlan({
      plan, personaById, outDir, creatorRoot, controlRoot, convertedCreator, convertedControl, signal: abort.signal,
      common: { query, sandbox: args.sandbox, userRoleModel: args.userModel, maxExchanges: args.maxExchanges },
      onProgress: (p) => {
        if (p.phase === 'start') console.error(`[外側の EVAL] ${p.index}/${p.total} ${p.persona} ${p.style} ${p.arm} ${p.model} ${p.n} 回目を始める`);
        else if (p.phase === 'end') console.error(`[外側の EVAL] ${p.index}/${p.total} 終わり：点数 ${p.score.toFixed(2)}${p.stopped ? `（${p.stopped}）` : ''}`);
      },
    });
    console.log(JSON.stringify({ ok: true, status: report.status, stopped: report.stopped, reportFile: report.reportFile, heldoutRecordsDir: report.heldoutRecordsDir, summary: report.summary, userRoleModel: args.userModel ?? USER_ROLE_MODEL }, null, 2));
    return report.status === 'stopped' ? 1 : 0;
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: error.code ?? 'failed', message: error.message }));
    return 2;
  }
}

function defaultRunRootEnsured() {
  const root = defaultRunRoot();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main();
}
