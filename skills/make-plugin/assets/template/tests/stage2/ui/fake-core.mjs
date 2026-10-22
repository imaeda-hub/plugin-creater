// 画面の試験で使う偽物の中心の処理（core）。
// 状態の全体（BLUEPRINT 3.5 の形）を試験から決め、画面から呼ばれた操作を記録する。
// 本物の core は使わない（画面とサーバーだけを試験する）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** 試験の対象の画面（ui/）の場所。ひな形でも生成プラグインでも、extensions/<名前>/ui/ を探す。 */
export function locateUi() {
  const root = path.resolve(here, '..', '..', '..');
  const extensions = path.join(root, 'com.github.copilot', 'extensions');
  for (const name of fs.readdirSync(extensions)) {
    const ui = path.join(extensions, name, 'ui');
    if (fs.existsSync(path.join(ui, 'app.mjs'))) return { root, extensionDir: path.join(extensions, name), uiDir: ui };
  }
  throw new Error(`画面（${extensions}/<名前>/ui/app.mjs）が見つかりません`);
}

export const MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5' },
  { id: 'gpt-6-luna', name: 'GPT-6 Luna' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5' },
];

/** 作業の定義（task.json）の見本。設定の5種類と、表示の6種類を使う。 */
export const SAMPLE_TASK = {
  name: '週報の作成',
  maxIterationsDefault: 3,
  criteria: [
    { id: 'C-01', text: '先週の実績が3行以内にまとまっている', knowledge: 'K-03' },
    { id: 'C-02', text: '来週の予定に担当者が書いてある', knowledge: 'K-04' },
  ],
  workers: [{ agent: 'worker', label: '週報を書く係' }],
  settings: [
    { key: 'week', label: '対象の週', type: 'text', default: '', required: true, help: '例：2026-W42', options: [] },
    { key: 'items', label: '項目の数', type: 'number', default: 5, required: false, help: '週報に書く項目の数です。', options: [] },
    { key: 'tone', label: '文体', type: 'select', default: 'です・ます調', required: false, help: '', options: ['です・ます調', 'だ・である調'] },
    { key: 'attach', label: '前回の週報をつける', type: 'checkbox', default: false, required: false, help: '', options: [] },
    { key: 'folder', label: '保存先のフォルダ', type: 'path', default: '', required: false, help: '空なら作業フォルダに保存します。', options: [] },
  ],
  displays: [
    { key: 'draft', label: '下書き', type: 'text', when: 'running' },
    { key: 'meta', label: '概要', type: 'kv', when: 'both' },
    { key: 'stats', label: '集計', type: 'table', when: 'finished' },
    { key: 'progress', label: '進み具合', type: 'progress', when: 'running' },
    { key: 'chart', label: 'グラフ', type: 'image', when: 'both' },
    { key: 'report', label: 'できあがった週報', type: 'file', when: 'finished' },
  ],
};

export function prepState(overrides = {}) {
  return {
    version: 1,
    plugin: { name: 'weekly-report', title: SAMPLE_TASK.name },
    setup: {
      models: MODELS,
      defaults: { orchestrator: 'claude-opus-5-5', worker: 'claude-haiku-5-5', verifier: 'claude-opus-5-5' },
      maxIterationsDefault: 3,
      taskSettings: SAMPLE_TASK.settings,
      isAuto: false,
      autoNotice: null,
      overrideNotice: null,
    },
    run: null,
    previous: null,
    notices: [],
    ...overrides,
  };
}

const agent = (slot, role, label, status, extra = {}) => ({
  slot,
  role,
  label,
  status,
  task: null,
  selectedModel: null,
  actualModel: null,
  lastActiveAt: null,
  replySummary: null,
  agentId: null,
  ...extra,
});

/** 実行中の状態の見本。phase：plan、do、study。 */
export function runState(phase = 'do', overrides = {}) {
  const running = (role) => (phase === { orchestrator: 'plan', worker: 'do', verifier: 'study' }[role] ? 'running' : 'standby');
  return prepState({
    run: {
      id: 'run-1',
      status: 'running',
      endReason: null,
      settings: { models: { orchestrator: 'claude-opus-5-5', worker: 'claude-haiku-5-5', verifier: 'claude-opus-5-5' }, maxIterations: 3, task: { week: '2026-W42' } },
      isAuto: false,
      phase,
      iteration: 1,
      maxIterations: 3,
      agents: [
        agent('orchestrator', 'orchestrator', '統括', running('orchestrator'), { task: '計画を立てる', selectedModel: 'claude-opus-5-5', actualModel: 'claude-opus-5-5', lastActiveAt: Date.UTC(2026, 9, 22, 3, 4, 5), agentId: 'ag-orch', replySummary: '計画を記録しました。' }),
        agent('worker', 'worker', '週報を書く係', running('worker'), { task: '週報の下書きを書く', selectedModel: 'claude-haiku-5-5', actualModel: 'claude-haiku-5-5', lastActiveAt: Date.UTC(2026, 9, 22, 3, 4, 9), agentId: 'ag-work' }),
        agent('verifier', 'verifier', '検証', running('verifier'), { selectedModel: 'claude-opus-5-5', agentId: null }),
      ],
      iterations: [
        {
          n: 1,
          criteria: [
            { id: 'C-01', text: SAMPLE_TASK.criteria[0].text, fromUser: true },
            { id: 'C-02', text: SAMPLE_TASK.criteria[1].text, fromUser: true },
            { id: 'C-03', text: '誤字がない', fromUser: false },
          ],
          plan: '先週の記録を読み、3行にまとめる。',
          verdicts: [],
          agentIds: ['ag-work'],
        },
      ],
      displays: {},
      summary: null,
      issues: [],
      canFile: { ok: true, reason: null, steps: [] },
      unstopped: [],
      waits: [],
    },
    ...overrides,
  });
}

/** 終わった状態の見本。 */
export function finishedState(endReason = { kind: 'all_passed', detail: null, unstoppable: false }, overrides = {}) {
  const base = runState('study');
  base.run = {
    ...base.run,
    status: 'finished',
    endReason,
    phase: null,
    agents: base.run.agents.map((a) => ({ ...a, status: 'completed' })),
    summary: '週報を1回で作成しました。',
    ...overrides,
  };
  return base;
}

/**
 * 偽物の core。
 * - set(関数 か 部分): 状態を変えて版の番号を上げる。setSilently は版の番号を上げない。
 * - calls: 呼ばれた操作の記録 [{ name, args }]。
 * - replies / files: getReply / getFile が返すもの。
 * - refusals: { start, stop, fileIssue } に Error を入れると、その操作を断る。
 * - hooks: { start, stop, fileIssue } に関数を入れると、呼ばれたときに状態を変えられる。
 */
export function createFakeCore(initial = prepState()) {
  let state = structuredClone(initial);
  let version = 1;
  const calls = [];
  const core = {
    calls,
    replies: {},
    files: {},
    refusals: {},
    hooks: {},
    callsOf: (name) => calls.filter((call) => call.name === name),
    set(next) {
      state = typeof next === 'function' ? (next(structuredClone(state)) ?? state) : { ...state, ...next };
      version += 1;
    },
    setSilently(next) {
      state = typeof next === 'function' ? (next(structuredClone(state)) ?? state) : { ...state, ...next };
    },
    getState: () => ({ ...structuredClone(state), version }),
    async start(settings) {
      calls.push({ name: 'start', args: [settings] });
      if (core.refusals.start) throw core.refusals.start;
      await core.hooks.start?.(settings, core);
    },
    async stop() {
      calls.push({ name: 'stop', args: [] });
      if (core.refusals.stop) throw core.refusals.stop;
      await core.hooks.stop?.(core);
    },
    async fileIssue(issueId) {
      calls.push({ name: 'fileIssue', args: [issueId] });
      if (core.refusals.fileIssue) throw core.refusals.fileIssue;
      await core.hooks.fileIssue?.(issueId, core);
    },
    async getReply(agentId) {
      calls.push({ name: 'getReply', args: [agentId] });
      return core.replies[agentId] ?? null;
    },
    async getFile(fileId) {
      calls.push({ name: 'getFile', args: [fileId] });
      return core.files[fileId] ?? null;
    },
  };
  return core;
}
