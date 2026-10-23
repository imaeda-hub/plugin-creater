// 生成プラグインのつなぎ口（設計書 3.2）。Copilot SDK の joinSession を引数で受け取り、
// 中心の処理（core/）と画面（ui/）を Copilot CLI につなぐ。
//
// - Copilot CLI に依る部分は、このファイルに集める。中心の処理とは、窓口 port と中立のイベントだけでやり取りする（BLUEPRINT 3.1、3.2）。
// - このファイルは、どの生成プラグインでも中身が同じ。プラグインの名前は plugin.json から読み、根は自分の場所から求める。
// - Copilot SDK を読み込むのは入口の extension.mjs だけで、ここは joinSession を引数で受ける。
//   試験は、偽物のセッションを返す joinSession を渡して、startAdapter を直接呼ぶ。
// - 標準出力は Copilot CLI との通信（JSON-RPC）に使われるので、console.log は使わない。調べるための出力は console.error に出す。

import { readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCore } from './core/index.mjs';
import { buildToolDefinitions } from './core/tools.mjs';
import { startApp } from './ui/app.mjs';

const AGENT_FILE_SUFFIX = '.agent.md';
const UNKNOWN_TOOL = '不明なツール';

// ---- プラグインの名前と根 --------------------------------------------------------------------------------

// プラグインの根は、このファイル（extensions/<名前>/adapter.mjs）の3つ上。名前は plugin.json の name。
function readPluginName(pluginRoot) {
  const file = path.join(pluginRoot, 'plugin.json');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (error) {
    throw new Error(`プラグインの設定ファイル（${file}）が読めません：${error.message}`);
  }
  const name = manifest?.name;
  if (typeof name !== 'string' || name === '') throw new Error(`プラグインの設定ファイル（${file}）に name がありません。`);
  return name;
}

// このプラグインのエージェントの名前（agents/<名前>.agent.md の <名前>）
function listOwnAgentNames(pluginRoot) {
  try {
    const files = readdirSync(path.join(pluginRoot, 'com.github.copilot', 'agents'));
    return new Set(files.filter((f) => f.endsWith(AGENT_FILE_SUFFIX)).map((f) => f.slice(0, -AGENT_FILE_SUFFIX.length)));
  } catch {
    return new Set();
  }
}

async function readWorkingDirectory(session) {
  try {
    const cwd = (await session.rpc.workspaces.getWorkspace())?.workspace?.cwd;
    if (typeof cwd === 'string' && cwd !== '') return cwd;
  } catch {
    // 取れなければ、エクステンションの作業フォルダ（Copilot CLI がセッションの作業フォルダで起動する）を使う
  }
  return process.cwd();
}

// ---- 許可の求め → 待ちの中身（BLUEPRINT 3.1 の detail） ----------------------------------------------------

const strings = (list) => (Array.isArray(list) ? list.filter((v) => typeof v === 'string' && v !== '') : []);

// 使おうとしているツール。ツールの名前がある求めは、その名前を添える。
function toolKindOf(request, kind) {
  const named = (...names) => names.filter((name) => typeof name === 'string' && name !== '').join('/');
  if (kind === 'mcp') return named(request.serverName, request.toolName) || kind;
  if (kind === 'custom-tool' || kind === 'hook') return named(request.toolName) || kind;
  return kind;
}

// 画面に出す項目を取り出す。エクステンション自身の権限の求めも、種類が分かるように渡す（出すかどうかは中心の処理が決める。4.14）。
function describePermission(request) {
  const req = request !== null && typeof request === 'object' ? request : {};
  const kind = typeof req.kind === 'string' ? req.kind : '';
  const detail = { permissionKind: kind, toolKind: toolKindOf(req, kind) };
  switch (kind) {
    case 'shell':
      detail.command = String(req.fullCommandText ?? '');
      detail.paths = strings(req.possiblePaths);
      detail.urls = strings((Array.isArray(req.possibleUrls) ? req.possibleUrls : []).map((u) => (typeof u === 'string' ? u : u?.url)));
      if (typeof req.warning === 'string' && req.warning !== '') detail.warning = req.warning;
      break;
    case 'write':
      detail.paths = strings([req.fileName]);
      break;
    case 'read':
      detail.paths = strings([req.path]);
      break;
    case 'url':
      detail.urls = strings([req.url]);
      break;
    default:
      break;
  }
  // requestSandboxPermissive が真の求めは、サンドボックスの外ではなく「記録だけにして中で動かし直す」求め。外とは示さない（R2 の 13）。
  detail.sandboxPermissive = Boolean(req.requestSandboxPermissive);
  detail.sandboxBypass = Boolean(req.requestSandboxBypass) && !detail.sandboxPermissive;
  return detail;
}

// ---- Copilot CLI のイベント → 中立のイベント（BLUEPRINT 3.1） --------------------------------------------------

function timeOf(event) {
  const at = Date.parse(event.timestamp);
  return Number.isFinite(at) ? at : Date.now();
}

const hasRequestId = (data) => typeof data.requestId === 'string' && data.requestId !== '';

function createEventConverter({ pluginName, ownAgentNames }) {
  const prefix = `${pluginName}:`;
  const parents = new Map(); // エージェントの番号 → 親の番号（tasks.list に親の番号がないため、開始のイベントから覚える）
  const toolNames = new Map(); // ツールの呼び出しの番号 → ツールの名前（終わりのイベントに名前がないため、開始から覚える）
  const lastReplies = new Map(); // エージェントの番号 → 最後の返事（フック onSubagentStop で届き、終わりのイベントで使う）

  // このプラグインのエージェントの名前は、'<プラグイン>:<エージェント>' の形にそろえる。ほかのエージェントはそのまま。
  const qualify = (raw) => {
    const name = typeof raw === 'string' ? raw : '';
    return name !== '' && !name.startsWith(prefix) && ownAgentNames.has(name) ? `${prefix}${name}` : name;
  };
  const agentTypeOf = (data) => {
    const candidates = [data.agentType, data.agentName].map(qualify).filter((name) => name !== '');
    return candidates.find((name) => name.startsWith(prefix)) ?? candidates[0] ?? '';
  };

  function convert(event) {
    if (event === null || typeof event !== 'object' || typeof event.type !== 'string') return null;
    const data = event.data !== null && typeof event.data === 'object' ? event.data : {};
    const at = timeOf(event);
    const agentId = typeof event.agentId === 'string' && event.agentId !== '' ? event.agentId : undefined;
    switch (event.type) {
      case 'subagent.started': {
        if (!agentId) return null;
        const parentAgentId = typeof data.parentId === 'string' && data.parentId !== '' ? data.parentId : undefined;
        if (parentAgentId) parents.set(agentId, parentAgentId);
        return {
          type: 'agent.started',
          at,
          agentId,
          parentAgentId,
          agentType: agentTypeOf(data),
          model: data.model,
          executionMode: data.executionMode,
          description: data.agentDescription,
        };
      }
      case 'subagent.configured':
        return agentId ? { type: 'agent.configured', at, agentId, model: data.model } : null;
      case 'subagent.completed': {
        if (!agentId) return null;
        const response = lastReplies.get(agentId);
        lastReplies.delete(agentId);
        return { type: 'agent.completed', at, agentId, cancelled: Boolean(data.cancelled), response };
      }
      case 'subagent.failed':
        return agentId ? { type: 'agent.failed', at, agentId, error: data.error } : null;
      case 'system.notification':
        return data.kind?.type === 'agent_idle' && typeof data.kind.agentId === 'string'
          ? { type: 'agent.idle', at, agentId: data.kind.agentId }
          : null;

      case 'tool.execution_start':
        if (typeof data.toolCallId === 'string') toolNames.set(data.toolCallId, data.toolName);
        return { type: 'tool.started', at, agentId, toolCallId: data.toolCallId, toolName: data.toolName, arguments: data.arguments };
      case 'tool.execution_complete': {
        const toolName = toolNames.get(data.toolCallId) ?? UNKNOWN_TOOL;
        toolNames.delete(data.toolCallId);
        const error = typeof data.error === 'string' ? data.error : data.error?.message;
        return { type: 'tool.completed', at, agentId, toolCallId: data.toolCallId, toolName, success: data.success, error };
      }

      // 確認の待ち。始めと終わりを requestId で結ぶので、requestId がないイベントは渡さない。
      case 'permission.requested':
        return hasRequestId(data)
          ? { type: 'wait.started', at, requestId: data.requestId, agentId, kind: 'permission', detail: describePermission(data.permissionRequest), resolvedByHook: Boolean(data.resolvedByHook) }
          : null;
      case 'user_input.requested':
        return hasRequestId(data)
          ? { type: 'wait.started', at, requestId: data.requestId, agentId, kind: 'question', detail: { question: String(data.question ?? '') }, resolvedByHook: false }
          : null;
      case 'session_limits_exhausted.requested':
        return hasRequestId(data) ? { type: 'wait.started', at, requestId: data.requestId, agentId, kind: 'limit', detail: {}, resolvedByHook: false } : null;
      case 'permission.completed':
        return hasRequestId(data) ? { type: 'wait.ended', at, requestId: data.requestId, kind: 'permission' } : null;
      case 'user_input.completed':
        return hasRequestId(data) ? { type: 'wait.ended', at, requestId: data.requestId, kind: 'question' } : null;
      case 'session_limits_exhausted.completed':
        return hasRequestId(data) ? { type: 'wait.ended', at, requestId: data.requestId, kind: 'limit', action: data.response?.action } : null;
      default:
        return null;
    }
  }

  return {
    convert,
    qualify,
    parentOf: (agentId) => parents.get(agentId) ?? null,
    noteReply(agentId, reply) {
      if (typeof agentId === 'string' && agentId !== '' && typeof reply === 'string') lastReplies.set(agentId, reply);
    },
  };
}

// ---- 窓口 port（BLUEPRINT 3.2）を session.rpc で作る ----------------------------------------------------------

// 選べるモデルの一覧の要素の形は、型で決まっていない（R2 の (2) の 2）。id と name を取り出せる要素だけを使う。
function readModels(list) {
  const models = [];
  for (const item of Array.isArray(list) ? list : []) {
    const id = typeof item === 'string' ? item : item?.id;
    if (typeof id !== 'string' || id === '') continue;
    models.push({ id, name: typeof item?.name === 'string' && item.name !== '' ? item.name : id });
  }
  return models;
}

function createPort(session, converter) {
  return {
    async startAgent({ agentType, name, model, prompt }) {
      const started = await session.rpc.tasks.startAgent({ agentType, name, prompt, ...(model ? { model } : {}) });
      return { agentId: started.agentId };
    },
    async cancelAgent(agentId) {
      await session.rpc.tasks.cancel({ id: agentId });
    },
    // tasks.list にはシェルなどのタスクも入る。エージェントだけを返す（R2 の (2) の 14）。
    async listTasks() {
      const listed = await session.rpc.tasks.list();
      return (Array.isArray(listed?.tasks) ? listed.tasks : [])
        .filter((task) => task?.type === 'agent')
        .map((task) => ({
          agentId: task.id,
          displayName: task.displayName ?? '',
          status: task.status,
          executionMode: task.executionMode,
          agentType: converter.qualify(task.agentType),
          parentAgentId: converter.parentOf(task.id),
        }));
    },
    // map は { '<プラグイン>:worker': '<モデル>', ... }。null で、このセッションの上書きをすべて外す。
    async setSubagentModels(map) {
      const agents = map === null || map === undefined ? null : Object.fromEntries(Object.entries(map).map(([agent, model]) => [agent, { model }]));
      await session.rpc.tools.updateSubagentSettings({ subagents: agents === null ? null : { agents } });
    },
    // Auto の選択は、モデルの番号が 'auto' になる（仮想のモデル auto。CurrentModel の説明）。実機で確かめる（設計書 11章 #7）。
    async getCurrentModel() {
      const current = await session.rpc.model.getCurrent();
      const model = typeof current?.modelId === 'string' ? current.modelId : '';
      return { model, isAuto: model.trim().toLowerCase() === 'auto' };
    },
    // rpc.models.list はクライアントの窓口で、エクステンションからは呼べない。session.rpc.model.list を使う（R2 の (2) の 2）。
    async listModels() {
      const listed = await session.rpc.model.list();
      return readModels(listed?.list);
    },
    async log(text) {
      await session.log(String(text));
    },
  };
}

// ---- 記録のツールの返り値 ------------------------------------------------------------------------------------

// 画面を開くツールの返り値。モデルがそのまま読み、ユーザーに伝える文なので、平易な日本語にする。
function describeOpened({ url, notices }) {
  const lines = [`Web管理画面の URL：${url}`];
  const list = Array.isArray(notices) ? notices.filter((n) => typeof n === 'string' && n !== '') : [];
  if (list.length > 0) lines.push('', 'ユーザーに伝えてください：', ...list.map((notice) => `- ${notice}`));
  return lines.join('\n');
}

// ---- つなぎ口の本体 -----------------------------------------------------------------------------------------

/**
 * Copilot CLI のセッションに加わり、記録のツール・フック・許可の求めの受け口・イベントの受け取りを登録して、
 * 中心の処理（core）と画面を起こす準備をする。画面のサーバーは、画面を開くツールが初めて呼ばれたときに起動する。
 * @param {object} options
 * @param {Function} options.joinSession `@github/copilot-sdk/extension` の joinSession（試験では偽物）
 * @returns {Promise<{ pluginName: string, pluginRoot: string, dataRoot: string, session: object, port: object, core: object, shutdown: () => Promise<void> }>}
 */
export async function startAdapter({ joinSession }) {
  if (typeof joinSession !== 'function') throw new Error('joinSession が渡されていません。');
  const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const pluginName = readPluginName(pluginRoot);
  const copilotHome = process.env.COPILOT_HOME || path.join(os.homedir(), '.copilot');
  const dataRoot = path.join(copilotHome, 'plugin-data', pluginName, 'runs');
  const converter = createEventConverter({ pluginName, ownAgentNames: listOwnAgentNames(pluginRoot) });

  // 中心の処理は、セッションに加わった後でないと作れない（窓口・セッションの番号・作業フォルダが要る）。
  // ツールは加わるときに渡す必要があるので、呼ばれたら中心の処理ができるまで待たせる。
  let core = null;
  let markReady;
  let markFailed;
  const ready = new Promise((resolve, reject) => {
    markReady = resolve;
    markFailed = reject;
  });
  ready.catch(() => {}); // 待つ呼び出しがなくても、未処理の拒否にしない

  async function callTool(shortName, args, invocation) {
    const readyCore = await ready;
    if (shortName === 'open') return describeOpened(await readyCore.open({ requestText: args?.requestText }));
    return readyCore.handleTool(shortName, args, { agentId: invocation?.agentId });
  }

  // ツールを使ってよいかの問い合わせ。同期で答え、例外を投げない（投げると拒まずに進む。設計書 4.4）。
  function onPreToolUse(input) {
    try {
      const verdict = core?.preToolUse(input);
      if (verdict?.deny) return { permissionDecision: 'deny', permissionDecisionReason: String(verdict.reason ?? '') };
    } catch (error) {
      console.error('[つなぎ口] ツールの問い合わせを処理できませんでした：', error);
    }
    return undefined;
  }

  // 子のエージェントが手番を終えるときに、最後の返事が届く。終わりのイベントで中心の処理に渡すため、覚えておく。
  function onSubagentStop(input) {
    try {
      converter.noteReply(input?.agentId, input?.response);
    } catch (error) {
      console.error('[つなぎ口] 子のエージェントの終わりを処理できませんでした：', error);
    }
    return undefined;
  }

  // 許可の求めの受け口は、見るためだけに登録する（設計書 4.14）。中心の処理に渡し、いつも答えない（no-result）。例外を投げない。
  function onPermissionRequest(request) {
    try {
      core?.onPermissionRequest(request);
    } catch (error) {
      console.error('[つなぎ口] 許可の求めを処理できませんでした：', error);
    }
    return { kind: 'no-result' };
  }

  const tools = buildToolDefinitions(pluginName).map((definition) => ({
    name: definition.name,
    description: definition.description,
    parameters: definition.parameters,
    skipPermission: definition.skipPermission,
    handler: (args, invocation) => callTool(definition.shortName, args, invocation),
  }));

  const session = await joinSession({ tools, hooks: { onPreToolUse, onSubagentStop }, onPermissionRequest });

  let port;
  let unsubscribe = () => {};
  try {
    const cwd = await readWorkingDirectory(session);
    port = createPort(session, converter);
    core = createCore({
      port,
      pluginRoot,
      pluginName,
      dataRoot,
      sessionId: session.sessionId,
      cwd,
      startUi: (readyCore) => startApp({ core: readyCore, cwd }),
    });
    unsubscribe = session.on((event) => {
      try {
        const neutral = converter.convert(event);
        if (neutral) core.onEvent(neutral);
      } catch (error) {
        console.error('[つなぎ口] イベントを処理できませんでした：', error);
      }
    });
    markReady(core);
  } catch (error) {
    markFailed(error);
    throw error;
  }

  // Copilot CLI の終了（SIGTERM。5秒後に SIGKILL）で終わる。画面のサーバーは同じプロセスなので、一緒に終わる（設計書 4.2）。
  let stopping = null;
  const shutdown = () => {
    stopping ??= (async () => {
      process.off('SIGTERM', onSignal);
      process.off('SIGINT', onSignal);
      try {
        unsubscribe();
      } catch {
        // セッションがもう切れているときは、受け取りをやめられなくてよい
      }
      try {
        await core.shutdown();
      } catch (error) {
        console.error('[つなぎ口] 終わる処理に失敗しました：', error);
      }
    })();
    return stopping;
  };
  function onSignal() {
    shutdown().finally(() => process.exit(0));
  }
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);

  return { pluginName, pluginRoot, dataRoot, session, port, core, shutdown };
}
