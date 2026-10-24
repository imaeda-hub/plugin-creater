// EVAL でできた、生成プラグインの実行の記録を片付ける（ユーザーの答え27）。
//
// 生成プラグインは、実行の記録を `<COPILOT_HOME>/plugin-data/<名前>/runs/<実行の番号>/` に残し、20件を超えると古いものから消す。
// EVAL は、ユーザーのふだんの環境のまま生成プラグインを動かすので、EVAL の実行の記録も、ふだんの作業の記録と同じ場所に入る。
// そこで、ありの実行が終わるたびに、その実行でできた記録だけを消す。生成プラグインには、試験のための機能を足さない（testing.md 10.4）。
//
// 消してよい記録の見分け方（全部に当てはまるものだけを消す。確かめられないものは消さない）
//   1. 実行を始める前に、記録の番号の一覧を控えておき、その一覧にない（実行の間にできた）もの
//   2. 記録の最初の行（begin）の cwd が、この実行の作業フォルダ（EVAL がこの実行のために作った、ほかと重ならないフォルダ）と同じ
//   3. 記録の最初の行（begin）の sessionId が、この実行で EVAL が作ったセッションの番号と同じ
// 消すのは、記録のフォルダ（`<実行の番号>/`）だけ。生成プラグインのフォルダ、その tests/results/ の EVAL の結果、ふだんの作業の記録、
// 記録の置き場所の外は消さない。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** 実行の番号の形（生成プラグインの newRunId：YYYYMMDD-HHMMSS-<16進6桁>）。これに合わないフォルダは、記録として扱わない */
const RUN_ID = /^\d{8}-\d{6}-[0-9a-f]{6}$/;
/** プラグインの名前として、置き場所の部品にしてよいもの（区切りや .. で外に出ないように） */
const PLUGIN_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** 最初の行（begin）を読むために読む長さ */
const HEAD_BYTES = 1024 * 1024;

const homeOf = (env) => (process.platform === 'win32' ? env.USERPROFILE : env.HOME) || os.homedir();

/**
 * 生成プラグインの実行の記録の置き場所（生成プラグインのエクステンションが使う場所と同じ）。決められなければ null
 * @param {string} pluginName plugin.json の name
 * @param {object} env エクステンションに渡す環境
 */
export function pluginRunsRoot(pluginName, env = process.env) {
  if (typeof pluginName !== 'string' || !PLUGIN_NAME.test(pluginName) || pluginName.includes('..')) return null;
  const home = env.COPILOT_HOME || path.join(homeOf(env), '.copilot');
  if (!path.isAbsolute(home)) return null;
  return path.join(home, 'plugin-data', pluginName, 'runs');
}

/** 置き場所にある記録の番号。番号の形で、log.jsonl のある（シンボリックリンクでない）フォルダだけ。なければ空 */
export function listRecordIds(root) {
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const ids = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !RUN_ID.test(entry.name)) continue;
    try {
      if (fs.lstatSync(path.join(root, entry.name, 'log.jsonl')).isFile()) ids.push(entry.name);
    } catch {
      // log.jsonl がないものは、記録ではない
    }
  }
  return ids.sort();
}

/** 記録の最初の行（begin）。読めない、begin でないときは null */
export function readBegin(root, id) {
  let fd;
  try {
    fd = fs.openSync(path.join(root, id, 'log.jsonl'), 'r');
    const buffer = Buffer.alloc(HEAD_BYTES);
    const length = fs.readSync(fd, buffer, 0, HEAD_BYTES, 0);
    const text = buffer.toString('utf8', 0, length);
    const first = text.split('\n', 1)[0];
    const begin = JSON.parse(first);
    return begin && begin.t === 'begin' ? begin : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // 閉じられなくても続ける
      }
    }
  }
}

function sameFolder(a, b) {
  const real = (p) => {
    try {
      return fs.realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  };
  const x = real(a);
  const y = real(b);
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

/** 記録の最初の行が、この実行（作業フォルダとセッションの番号）のものか。作業フォルダとセッションの番号の両方が合うときだけ true */
export function isRecordOfRun(begin, { workDir, sessionId }) {
  if (!begin || begin.t !== 'begin') return false;
  if (typeof workDir !== 'string' || workDir === '' || typeof begin.cwd !== 'string' || begin.cwd === '') return false;
  if (typeof sessionId !== 'string' || sessionId === '' || begin.sessionId !== sessionId) return false;
  return sameFolder(begin.cwd, workDir);
}

/**
 * 実行を始める前に、記録の置き場所と、今ある記録の番号を控える。
 * 置き場所を決められないとき（root が null）は、何も消さない。
 * @returns {{ root: string | null, before: Set<string>, skipped: string | null }}
 */
export function watchPluginRecords({ pluginName, env = process.env }) {
  const root = pluginRunsRoot(pluginName, env);
  if (!root) {
    return { root: null, before: new Set(), skipped: '記録の置き場所を決められませんでした（プラグインの名前が置き場所に使えない形か、COPILOT_HOME が絶対パスでない）' };
  }
  return { root, before: new Set(listRecordIds(root)), skipped: null };
}

/**
 * 実行の間にできた記録のうち、この実行のものと確かめられたものだけを消す。投げない。
 * @param {{ root: string | null, before: Set<string>, skipped: string | null }} watch watchPluginRecords の返り値
 * @param {{ workDir: string | null, sessionId: string | null | undefined }} run
 * @param {{ rmSync?: Function }} [deps] 試験で差し替える
 * @returns {{ root: string | null, removed: string[], failed: { id: string, message: string }[], unidentified: string[], skipped: string | null }}
 */
export function removeEvalRecords(watch, { workDir, sessionId }, deps = {}) {
  const rmSync = deps.rmSync ?? fs.rmSync;
  const result = { root: watch?.root ?? null, removed: [], failed: [], unidentified: [], skipped: watch?.skipped ?? null };
  if (!watch?.root) return result;
  let ids;
  try {
    ids = listRecordIds(watch.root);
  } catch {
    return result;
  }
  for (const id of ids) {
    if (watch.before.has(id)) continue; // 実行の前からあったもの（ふだんの作業の記録）は、中身を見ずに残す
    if (!isRecordOfRun(readBegin(watch.root, id), { workDir, sessionId })) {
      result.unidentified.push(id);
      continue;
    }
    const dir = path.join(watch.root, id);
    try {
      // 生成プラグインのエクステンションが、閉じる間際に書き込むことがあるので、数回やり直す
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      if (fs.existsSync(dir)) result.failed.push({ id, message: '消した後も残っています' });
      else result.removed.push(id);
    } catch (error) {
      result.failed.push({ id, message: String(error?.message ?? error).split('\n')[0] });
    }
  }
  return result;
}
