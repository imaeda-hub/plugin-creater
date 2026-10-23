// 試験の道具：本物の Copilot SDK（@github/copilot-sdk 1.0.25 の joinSession）につなぐ、偽物の Copilot CLI。
//
// Copilot CLI は、エクステンションを子プロセスとして起動し、標準入出力で JSON-RPC（Content-Length つき）をやり取りする。
// ここでは、その相手（Copilot CLI）の役を、最小限だけ務める。
//   - エクステンションを、本物の SDK を読み込ませて起動する（Copilot CLI と同じく、@github/copilot-sdk/extension を SDK に向ける）。
//   - connect と session.resume に答える（session.resume の中身から、登録されたツールとフックの旗が分かる）。
//   - ツールの呼び出し（external_tool.requested のイベント）と、フックの呼び出し（hooks.invoke）を送り、答えを受ける。
// 目的：extension.mjs と SDK のつなぎ目（引数の形、返り値の形、フックの入力の形）を、偽物のセッションではなく本物の SDK で確かめること。
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** SDK の extension.js の場所。COPILOT_SDK_DIR（そこで npm i @github/copilot-sdk@1.0.25 をしたフォルダ）から探す */
export function sdkExtensionFile(dir = process.env.COPILOT_SDK_DIR) {
  return dir ? path.join(dir, 'node_modules', '@github', 'copilot-sdk', 'dist', 'extension.js') : null;
}

export function startExtensionProcess({ extensionFile, sdkFile, sessionId, home, cwd }) {
  const child = spawn(process.execPath, ['--import', pathToFileURL(path.join(here, 'sdk-register.mjs')).href, extensionFile], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH, SESSION_ID: sessionId, COPILOT_HOME: home, TEST_SDK_EXTENSION: sdkFile },
    cwd,
  });

  let stderr = '';
  child.stderr.on('data', (d) => {
    stderr += d;
  });

  const requests = []; // エクステンションから来た要求（{ method, params }）
  const waiters = [];
  const pending = new Map(); // 私から送った要求の答え待ち
  let nextId = 1;
  let buffer = Buffer.alloc(0);
  const exited = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));

  const send = (message) => {
    const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...message }), 'utf8');
    child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
    child.stdin.write(body);
  };

  const answer = (message) => {
    const { method, id } = message;
    let result = {};
    if (method === 'connect' || method === 'ping') result = { protocolVersion: 3 };
    else if (method === 'session.resume') result = { workspacePath: path.join(home, 'session-state', sessionId), capabilities: {} };
    else if (method === 'session.workspaces.getWorkspace') result = { workspace: { cwd }, path: path.join(home, 'session-state', sessionId) };
    else if (method === 'session.tools.handlePendingToolCall') result = { success: true };
    send({ id, result });
  };

  const handle = (message) => {
    if (message.method && message.id !== undefined) {
      requests.push({ method: message.method, params: message.params });
      answer(message);
      for (const w of [...waiters]) {
        if (w.match(message)) {
          waiters.splice(waiters.indexOf(w), 1);
          w.resolve(message.params);
        }
      }
    } else if (message.id !== undefined && pending.has(message.id)) {
      const resolve = pending.get(message.id);
      pending.delete(message.id);
      resolve(message);
    }
  };

  child.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const length = Number(/Content-Length: (\d+)/i.exec(buffer.subarray(0, headerEnd).toString())?.[1]);
      if (buffer.length < headerEnd + 4 + length) return;
      const message = JSON.parse(buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString('utf8'));
      buffer = buffer.subarray(headerEnd + 4 + length);
      handle(message);
    }
  });

  const request = (method, params) =>
    new Promise((resolve) => {
      const id = 10_000 + nextId++;
      pending.set(id, resolve);
      send({ id, method, params });
    });

  /** エクステンションから、この条件に合う要求が来るまで待つ（もう来ていれば、すぐ返す） */
  const waitForRequest = (predicate, timeoutMs = 15_000) => {
    const existing = requests.find((r) => predicate(r));
    if (existing) return Promise.resolve(existing.params);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`エクステンションからの要求が来ません。標準エラー：\n${stderr}`)), timeoutMs);
      waiters.push({ match: (m) => predicate({ method: m.method, params: m.params }), resolve: (p) => (clearTimeout(timer), resolve(p)) });
    });
  };

  let eventCount = 0;
  const peer = {
    child,
    requests,
    get stderr() {
      return stderr;
    },
    exited,

    /** 始まり：connect と session.resume が終わるまで待つ。session.resume の引数を返す */
    async ready() {
      const resume = await waitForRequest((r) => r.method === 'session.resume');
      await waitForRequest((r) => r.method === 'session.workspaces.getWorkspace');
      return resume;
    },

    /** ツールを呼ぶ（Copilot CLI が external_tool.requested を送る形）。返り値は { result } か { error } */
    async callTool(sessionId, name, args = {}, { agentId } = {}) {
      const requestId = `req-${eventCount++}`;
      send({
        method: 'session.event',
        params: {
          sessionId,
          event: { id: `ev-${requestId}`, timestamp: new Date().toISOString(), parentId: null, ...(agentId ? { agentId } : {}), type: 'external_tool.requested', data: { requestId, toolName: name, toolCallId: `call-${requestId}`, arguments: args } },
        },
      });
      return waitForRequest((r) => r.method === 'session.tools.handlePendingToolCall' && r.params.requestId === requestId);
    },

    /** セッションのイベントを送る（compaction など） */
    sendEvent(sessionId, type, data = {}, { agentId } = {}) {
      eventCount += 1;
      send({ method: 'session.event', params: { sessionId, event: { id: `ev-${eventCount}`, timestamp: new Date().toISOString(), parentId: null, ...(agentId ? { agentId } : {}), type, data } } });
    },

    /** フックを呼ぶ（Copilot CLI が hooks.invoke を送る形）。フックの output を返す */
    async hook(sessionId, hookType, input = {}) {
      const response = await request('hooks.invoke', { sessionId, hookType, input: { timestamp: Date.now(), cwd, sessionId, ...input } });
      if (response.error) throw new Error(`hooks.invoke が失敗：${JSON.stringify(response.error)}`);
      return response.result?.output;
    },

    /** Copilot CLI が終わるとき（SIGTERM）と同じに止める */
    async stop() {
      child.kill('SIGTERM');
      return exited;
    },
  };
  return peer;
}
