// 偽物の Copilot SDK（クライアント、セッション、イベント）と、偽物の画面の操作。EVAL の実行（run.mjs）の試験で使う。
// 本物の Copilot CLI とモデルは使わない（最終確認で人が確かめる。testing.md 9章）。
//
// 本物の SDK と同じく、
//   - session.send() はすぐ返り、イベントは後から（createSession の onEvent に）届く
//   - 許可の求めと質問は、createSession の onPermissionRequest・onUserInputRequest が受ける
// 試験は、behavior.onSend(session, options) で「エージェントの動き」を書く（イベントを出す、許可を求める、ファイルを書く）。
import fs from 'node:fs';
import path from 'node:path';

import { loadScript, makeTemp, sampleTask, writeFiles } from './helpers.mjs';

const { ScreenError } = await loadScript('screen.mjs');

export const SCREEN_URL = 'http://127.0.0.1:8731/?k=tok_123-abc';
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let counter = 0;
export function makeEvent(type, data = {}, agentId) {
  counter += 1;
  return { id: `ev-${counter}`, timestamp: new Date().toISOString(), parentId: null, ...(agentId ? { agentId } : {}), type, data };
}

/** assistant.usage の data（費用は nano-AIU。1 AI クレジット = 10億） */
export const usage = (nanoAiu, extra = {}) => ({
  model: 'gpt-6-luna',
  inputTokens: 100,
  outputTokens: 20,
  copilotUsage: { totalNanoAiu: nanoAiu },
  aiCreditsStatus: 'complete',
  ...extra,
});

export class FakeSession {
  constructor(client, config, behavior) {
    this.client = client;
    this.config = config;
    this.behavior = behavior;
    this.workDir = config.workingDirectory;
    this.sessionId = `session-${client.id}`;
    this.sent = [];
    this.abortCalls = 0;
    this.disconnected = false;
    this.limitAnswers = [];
    this.decisions = [];
    this.rpc = {
      plugins: { list: async () => ({ plugins: behavior.plugins ? await behavior.plugins(this) : this.defaultPlugins() }) },
      extensions: { list: async () => ({ extensions: behavior.extensions ? await behavior.extensions(this) : this.defaultExtensions() }) },
      ui: {
        handlePendingSessionLimitsExhausted: async (params) => {
          this.limitAnswers.push(params);
          return { success: true };
        },
      },
    };
  }

  get variant() {
    return this.client.variant;
  }

  get pluginName() {
    return this.behavior.pluginName ?? 'weekly-report';
  }

  defaultPlugins() {
    return this.variant === 'with' ? [{ name: this.pluginName, marketplace: '', version: '1.0.0', enabled: true, installedFrom: this.client.pluginDir }] : [];
  }

  defaultExtensions() {
    return this.variant === 'with' ? [{ id: `plugin:${this.pluginName}:${this.pluginName}`, name: this.pluginName, source: 'plugin', status: 'running' }] : [];
  }

  emit(type, data, agentId) {
    this.config.onEvent?.(makeEvent(type, data, agentId));
  }

  /** 許可の求めを出して、受け口（onPermissionRequest）の答えを返す */
  async askPermission(request, invocation = { sessionId: this.sessionId }) {
    const decision = await this.config.onPermissionRequest(request, invocation);
    this.decisions.push({ request, decision });
    return decision;
  }

  async send(options) {
    this.sent.push(options);
    setTimeout(() => {
      Promise.resolve(this.behavior.onSend?.(this, options)).catch((error) => this.emit('session.error', { message: `偽物のエージェントの失敗：${error.message}` }));
    }, 0);
    return `msg-${this.sent.length}`;
  }

  async abort() {
    this.abortCalls += 1;
    await this.behavior.onAbort?.(this);
  }

  async disconnect() {
    this.disconnected = true;
  }
}

/** 偽物の Copilot SDK。作られたクライアントとセッションは clients、sessions に残る */
export function createFakeSdk(behavior = {}) {
  const clients = [];
  const sessions = [];
  class CopilotClient {
    constructor(options) {
      this.options = options;
      this.id = clients.length + 1;
      const args = options.connection?.args ?? [];
      this.variant = args.includes('--plugin-dir') ? 'with' : 'without';
      this.pluginDir = this.variant === 'with' ? args[args.indexOf('--plugin-dir') + 1] : null;
      this.started = false;
      this.stopped = false;
      this.forceStopped = false;
      clients.push(this);
    }

    async start() {
      await behavior.onStart?.(this);
      this.started = true;
    }

    async createSession(config) {
      await behavior.onCreateSession?.(this, config);
      const session = new FakeSession(this, config, behavior);
      sessions.push(session);
      session.emit('session.start', { copilotVersion: behavior.copilotVersion ?? '1.0.102', selectedModel: config.model ?? 'gpt-6-luna', sessionId: session.sessionId });
      return session;
    }

    async stop() {
      this.stopped = true;
      return [];
    }

    async forceStop() {
      this.forceStopped = true;
    }
  }
  const RuntimeConnection = { forStdio: (opts = {}) => ({ kind: 'stdio', ...opts }) };
  return { CopilotClient, RuntimeConnection, clients, sessions };
}

export const finishedScreen = (extra = {}) => ({
  finished: true,
  timedOut: false,
  endReason: { kind: 'all_passed', detail: null, unstoppable: false },
  endReasonText: '終わった理由：評価基準をすべて満たした',
  resultText: '結果\n終わった理由：評価基準をすべて満たした',
  iterationsText: '試行ごとの評価基準と合否',
  summary: '週報を作成しました。',
  iterations: [],
  snapshots: [{ t: 0, status: 'running', phase: 'do', iteration: 1, agents: ['orchestrator:running'], waits: [] }],
  ...extra,
});

/** 偽物の画面の操作。operate の中身は behavior.operate(args, calls) で決める */
export function createFakeScreen(behavior = {}) {
  const calls = [];
  const screen = {
    calls,
    prepared: 0,
    closed: 0,
    async prepare() {
      screen.prepared += 1;
      if (behavior.prepareError) throw new ScreenError(behavior.prepareError);
      return { channel: 'fake' };
    },
    async operate(args) {
      calls.push(args);
      if (behavior.operate) return behavior.operate(args, calls);
      return finishedScreen();
    },
    async close() {
      screen.closed += 1;
    },
  };
  return screen;
}

export const FAST_TIMING = { timeoutMs: 5000, sdkCallMs: 2000, setupWaitMs: 300, settleMs: 40, idleGraceMs: 800, screenPollMs: 10, closeMs: 500 };

/**
 * 生成プラグインのフォルダ（plugin.json と課題）、偽物の SDK、偽物の画面の操作を、まとめて用意する。
 * @param {object} [options]
 * @param {Array} [options.tasks] eval.json の中身の並び（省くと sampleTask 1つ）
 * @param {Record<string, string|Buffer>} [options.files] プラグインのフォルダに足すファイル（課題の入力のファイルなど）
 * @param {object} [options.behavior] 偽物の SDK の動き
 * @param {object} [options.screen] 偽物の画面の動き
 * @param {Record<string, string>} [options.outputs] あり・なしの実行で、作業フォルダに書くファイル { with: {...}, without: {...} }
 */
export function createWorld(options = {}) {
  const tasks = options.tasks ?? [sampleTask()];
  const pluginName = options.pluginName ?? 'weekly-report';
  const files = { 'plugin.json': JSON.stringify({ name: pluginName, version: '1.2.3', description: '試験用' }), ...(options.files ?? {}) };
  for (const task of tasks) files[`tests/eval/${task.id}/eval.json`] = JSON.stringify(task);
  const pluginDir = writeFiles(makeTemp('c3-world-'), files);
  const outputs = options.outputs ?? {};
  const world = { pluginDir, pluginName, outputs, withWorkDirs: [], url: SCREEN_URL };

  const outputOf = (variant, session) => {
    const spec = outputs[variant] ?? {};
    return typeof spec === 'function' ? spec(session) : spec;
  };

  /** 既定のエージェントの動き。ありは、画面の URL をチャットに示して手番を終える。なしは、成果物を書いて手番を終える */
  const defaultOnSend = async (session) => {
    if (session.variant === 'with') {
      world.withWorkDirs.push(session.workDir);
      session.emit('skill.invoked', { name: `${pluginName}:entry`, pluginName });
      session.emit('assistant.usage', usage(1_000_000_000));
      session.emit('assistant.message', { content: `画面を開いてください：${world.url}` });
      session.emit('session.idle', {});
    } else {
      writeFiles(session.workDir, outputOf('without', session));
      session.emit('assistant.usage', usage(500_000_000));
      session.emit('assistant.message', { content: '作成しました' });
      session.emit('session.idle', {});
    }
  };
  world.defaultOnSend = defaultOnSend;
  const behavior = { pluginName, onSend: defaultOnSend, ...(options.behavior ?? {}) };
  const sdk = createFakeSdk(behavior);
  const screen = createFakeScreen({
    operate: async (args, calls) => {
      const workDir = world.withWorkDirs.at(-1);
      writeFiles(workDir, outputOf('with', { workDir }));
      return finishedScreen();
    },
    ...(options.screen ?? {}),
  });
  Object.assign(world, { sdk, screen });
  return world;
}

/** 作業フォルダの中のファイル（相対の場所）を、並べて返す */
export function filesIn(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else out.push(path.relative(dir, abs).split(path.sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}
