// 試験の結果のファイルを読んで、画面に出す形にする（REQ-044）。
// 結果のファイルの場所は、メインのエージェントが plugin-creator_results で知らせる。画面は、そのファイルを読んで出す。
//
// 読み分け
// - stages あり：1・2段目の入口（tests/run.py）が書く結果（tests/results/latest.json）。段階ごとの合否と、不合格の試験とその理由。
// - runs か scores あり：EVAL の結果。実行ごとの基準ごとの合否、あり・なしの点数とその差、使った AI クレジット（REQ-041）。
//   形はまだ決まっていないので、あるものだけを出す。読み取れないものは、整えた JSON をそのまま出す。
// - どれでもない：整えた JSON をそのまま出す。

import fs from 'node:fs';
import path from 'node:path';

export const MAX_RESULT_BYTES = 5 * 1024 * 1024;
const RAW_MAX_CHARS = 20_000;

const STATUS_JA = { passed: '合格', failed: '不合格', none: '試験なし', stopped: '止まった', skipped: '対象外' };
const statusJa = (s) => STATUS_JA[s] ?? (s == null ? '' : String(s));
// 試験の入口（tests/run.py）が書く段階の名前を、ユーザーに話す言葉に直す（words.md）。ほかの名前は、そのまま出す
const STAGE_NAME_DISPLAY = { 構造の検査: 'ファイルの形の検査', 部品の試験: '動きの試験' };
const stageNameJa = (name) => STAGE_NAME_DISPLAY[name] ?? name;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** 知らされたファイルとして受け付けてよいかを確かめる。だめなら理由の文を返す。よければ null */
export function checkResultFile(file) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return `見つかりません：${file}`;
  }
  if (!stat.isFile()) return `ファイルではありません：${file}（結果のファイルの場所を渡してください）`;
  if (path.extname(file).toLowerCase() !== '.json') return `JSON のファイルではありません：${file}`;
  if (stat.size > MAX_RESULT_BYTES) return `大きすぎて読めません：${file}`;
  return null;
}

function stagesView(json) {
  return {
    kind: 'stages',
    overall: statusJa(json.status),
    overallStatus: json.status ?? null,
    stages: json.stages.map((s) => ({
      name: stageNameJa(String(s?.name ?? s?.id ?? '')),
      status: statusJa(s?.status),
      statusKey: s?.status ?? null,
      counts: isObject(s?.counts) ? s.counts : null,
      failures: (Array.isArray(s?.failures) ? s.failures : []).map((f) => ({ test: String(f?.test ?? ''), reason: String(f?.reason ?? '') })),
      warnings: (Array.isArray(s?.warnings) ? s.warnings : []).map((w) => (typeof w === 'string' ? w : String(w?.reason ?? w?.message ?? JSON.stringify(w)))),
    })),
  };
}

function evalView(json) {
  const scores = isObject(json.scores) ? json.scores : {};
  const withScore = num(scores.with ?? scores.withPlugin ?? json.withScore);
  const withoutScore = num(scores.without ?? scores.withoutPlugin ?? json.withoutScore);
  const diff = num(scores.difference ?? scores.diff ?? json.difference) ?? (withScore !== null && withoutScore !== null ? withScore - withoutScore : null);
  const runs = (Array.isArray(json.runs) ? json.runs : []).map((r) => ({
    task: String(r?.task ?? r?.taskId ?? r?.id ?? ''),
    variant: r?.variant === 'with' || r?.withPlugin === true ? 'あり' : r?.variant === 'without' || r?.withPlugin === false ? 'なし' : '',
    criteria: (Array.isArray(r?.criteria) ? r.criteria : []).map((c) => ({ id: String(c?.id ?? ''), text: String(c?.text ?? ''), pass: c?.pass === true })),
    score: num(r?.score),
  }));
  return {
    kind: 'eval',
    withScore,
    withoutScore,
    difference: diff,
    credits: num(json.credits ?? json.aiCredits ?? json.usedAiCredits),
    runs,
  };
}

/**
 * 結果のファイル1つを読む。読めなくても例外は投げず、理由を返す（画面を壊さないため）。
 * @returns {{ path: string, name: string, error?: string, view?: object }}
 */
export function readResult(file) {
  const out = { path: file, name: path.basename(file) };
  const problem = checkResultFile(file);
  if (problem) return { ...out, error: problem };
  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return { ...out, error: `JSON として読めません：${file}（${error.message}）` };
  }
  if (isObject(json) && Array.isArray(json.stages)) return { ...out, view: stagesView(json) };
  if (isObject(json) && (Array.isArray(json.runs) || isObject(json.scores))) return { ...out, view: evalView(json) };
  let raw = JSON.stringify(json, null, 2) ?? '';
  if (raw.length > RAW_MAX_CHARS) raw = `${raw.slice(0, RAW_MAX_CHARS)}\n…（長いので、ここまでです）`;
  return { ...out, view: { kind: 'unknown', raw } };
}

/** 画面の1秒ごとの取り直しで、同じファイルを何度も読み直さないための入れ物 */
export function createResultReader() {
  const cache = new Map(); // path -> { key, value }
  return (file) => {
    let key = 'missing';
    try {
      const st = fs.statSync(file);
      key = `${st.mtimeMs}:${st.size}`;
    } catch {
      // 見つからない状態も、そのまま読む（理由が出る）
    }
    const hit = cache.get(file);
    if (hit && hit.key === key) return hit.value;
    const value = readResult(file);
    cache.set(file, { key, value });
    return value;
  };
}
