// EVAL の道具（@github/copilot-sdk と playwright）を、道具のフォルダから読み込む。
// 道具のフォルダ：<COPILOT_HOME>/plugin-data/plugin-creator/tools/（check_tools.py --install が入れる。package.json の版に固定）
// COPILOT_HOME は、環境変数があればそれ、なければ ~/.copilot。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function copilotHome(env = process.env) {
  return env.COPILOT_HOME || path.join(os.homedir(), '.copilot');
}

export function toolsDir(env = process.env) {
  return path.join(copilotHome(env), 'plugin-data', 'plugin-creator', 'tools');
}

/** 道具が足りないときの誤り。missing は { name, reason } の並び */
export class ToolsMissingError extends Error {
  constructor(dir, missing) {
    super(`EVAL の道具が足りません（${missing.map((m) => (m.reason && m.reason !== '入っていません' ? `${m.name}：${m.reason}` : m.name)).join('、')}）。python3 check_tools.py --plugin <生成プラグインのフォルダ> --scope eval --install で入れてください（入れる場所：${dir}）。`);
    this.name = 'ToolsMissingError';
    this.dir = dir;
    this.missing = missing;
  }
}

/** パッケージの package.json の exports から、ES モジュールの入口を求める */
function entryOf(pkg) {
  let entry = pkg.exports?.['.'];
  if (entry && typeof entry === 'object') entry = entry.import ?? entry.default;
  if (entry && typeof entry === 'object') entry = entry.default ?? entry.import;
  return typeof entry === 'string' ? entry : pkg.module ?? pkg.main ?? 'index.js';
}

/** dir/node_modules の中のパッケージを読み込む。@returns {Promise<{ module: object, version: string }>} */
export async function importFromDir(dir, name) {
  const pkgDir = path.join(dir, 'node_modules', ...name.split('/'));
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  const module = await import(pathToFileURL(path.join(pkgDir, entryOf(pkg))).href);
  return { module, version: pkg.version ?? null };
}

/**
 * EVAL の道具を読み込む。
 * @returns {Promise<{ sdk: object, chromium: object, versions: object, dir: string }>}
 * @throws {ToolsMissingError} 入っていない、または読み込めないとき
 */
export async function loadEvalTools(env = process.env, { dir = toolsDir(env) } = {}) {
  const missing = [];
  const load = async (name) => {
    try {
      return await importFromDir(dir, name);
    } catch (error) {
      missing.push({ name, reason: error?.code === 'ENOENT' ? '入っていません' : String(error?.message ?? error).split('\n')[0] });
      return null;
    }
  };
  const sdk = await load('@github/copilot-sdk');
  const playwright = await load('playwright');
  if (missing.length > 0) throw new ToolsMissingError(dir, missing);
  const chromium = playwright.module.chromium ?? playwright.module.default?.chromium;
  if (!chromium) throw new ToolsMissingError(dir, [{ name: 'playwright', reason: 'chromium が見つかりません' }]);
  if (!sdk.module.CopilotClient || !sdk.module.RuntimeConnection) throw new ToolsMissingError(dir, [{ name: '@github/copilot-sdk', reason: 'CopilotClient が見つかりません' }]);
  return {
    sdk: sdk.module,
    chromium,
    versions: { copilotSdk: sdk.version, playwright: playwright.version, node: process.version },
    dir,
  };
}
