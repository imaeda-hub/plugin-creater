// 外側の EVAL から、内側の EVAL（inner.mjs。D1d）を呼ぶ。できた生成プラグインを置き換え、模擬ユーザーの内側の課題
// （<模擬ユーザー>/inner/eval.json）で、プラグインあり・なしを動かして採点する（testing.md 3章の手順4、7章）。
// 実際のモデルと画面のブラウザー（Playwright）を使う。試験では outer-run.mjs の引数 inner に関数を渡して差し替える。

import fs from 'node:fs';
import path from 'node:path';

import { createUserRole } from './user-role.mjs';

/**
 * @param {object} o
 * @param {string} o.pluginDir できた生成プラグイン（Copilot CLI 向け）
 * @param {{ persona: object, dir: string }} o.loaded 模擬ユーザー
 * @param {string} o.styleName
 * @param {Function} o.query Agent SDK の query()
 * @param {Function} [o.userRoleQuery]
 * @param {string} o.outDir
 * @param {boolean} o.sandbox
 * @param {Function} o.convert 置き換える関数（convertPlugin）
 * @param {number} [o.runs]
 * @param {Function} [o.innerEval] inner.mjs の innerEval（試験で差し替える）
 * @param {object} [o.chromium] Playwright の chromium（試験で差し替える）
 */
export async function runInnerForGenerated(o) {
  const { pluginDir, loaded, styleName, query, userRoleQuery = query, outDir, sandbox, convert, envExtra = {}, signal, onProgress = () => {}, runs = 1 } = o;
  const innerEval = o.innerEval ?? (await import('./inner.mjs')).innerEval;
  const chromium = o.chromium ?? (await import('playwright')).chromium;
  fs.mkdirSync(outDir, { recursive: true });
  const convertedRoot = path.join(outDir, 'converted');
  convert(pluginDir, convertedRoot);
  const evalDir = path.join(loaded.dir, 'inner');
  const json = JSON.parse(fs.readFileSync(path.join(evalDir, 'eval.json'), 'utf8'));
  const task = { id: json.id, dir: evalDir, json, personaId: loaded.persona.id };
  const userRoleFor = (_task, arm, n) => {
    const home = fs.mkdtempSync(path.join(outDir, `user-${arm}-${n}-`));
    const role = createUserRole({ persona: loaded.persona, styleName, query: userRoleQuery, home, envExtra });
    const fn = async ({ question, choices }) => (await role.answer(question, choices ?? [], (choices ?? []).length > 0 ? 'AskUserQuestion' : 'text')).answer;
    fn.cost = () => role.cost;
    return fn;
  };
  return innerEval({
    sdk: { query },
    chromium,
    pluginRoot: pluginDir,
    convertedRoot,
    tasks: [task],
    userRoleFor,
    outDir,
    runs,
    arms: ['with', 'without'],
    sandbox,
    envExtra,
    signal,
    onProgress: (p) => onProgress({ ...p, phase: `inner-${p.phase}` }),
  });
}
