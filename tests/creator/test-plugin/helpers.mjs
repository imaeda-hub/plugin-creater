// test-plugin のスクリプト（skills/test-plugin/scripts/）の試験で使う道具。
// 本物の Copilot CLI とモデルは使わない（最終確認で人が確かめる。testing.md 9章）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '..', '..', '..');
export const SCRIPTS_DIR = path.join(REPO_ROOT, 'skills', 'test-plugin', 'scripts');
export const TEMPLATE_DIR = path.join(REPO_ROOT, 'skills', 'make-plugin', 'assets', 'template');

/** scripts/ の中の .mjs を読み込む */
export function loadScript(name) {
  return import(pathToFileURL(path.join(SCRIPTS_DIR, name)).href);
}

const made = [];

/** 一時フォルダを作る。cleanupTemp() でまとめて消す（試験の after で呼ぶ） */
export function makeTemp(prefix = 'c3-') {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  made.push(dir);
  return dir;
}

export function cleanupTemp() {
  while (made.length) fs.rmSync(made.pop(), { recursive: true, force: true });
}

/** { 相対の場所: 文字か Buffer } をフォルダに書く */
export function writeFiles(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return dir;
}

/** 一時フォルダに files を書いて、そのフォルダを返す */
export function tempWith(files = {}, prefix) {
  return writeFiles(makeTemp(prefix), files);
}

/** BLUEPRINT 4.3 の形の課題（eval.json）の見本 */
export function sampleTask(overrides = {}) {
  return {
    id: 'T-01',
    prompt: '週報を作ってください。対象は 2026-W42 です。',
    inputs: [],
    settings: { maxIterations: 2, task: { week: '2026-W42' } },
    criteria: [
      { id: 'C-01', text: '週報のファイルがある', grading: 'program', check: { type: 'file_exists', file: 'out/*.md' } },
      { id: 'C-02', text: '金額を「52万円」の形で書く', grading: 'program', check: { type: 'contains', file: 'out/*.md', text: '52万円' } },
    ],
    ...overrides,
  };
}
