// 偽物のセッション。クリエイターのエクステンションの試験で、Copilot CLI の代わりにつなぐ。
//
// 本物の joinSession（@github/copilot-sdk/extension）と同じ形で、ツールとフックの登録を受ける。
// 試験は、ここからツールを呼び、フックを動かし、セッションのイベントを流す。
//
// 本物の振る舞いに合わせたところ（R2：wip/implementation/research/R2-extension-api.md）
// - ツールの handler は (args, invocation) で呼ばれる。invocation.agentId は、サブエージェントが呼んだときだけ付く。
//   例外を投げると、その message が失敗の文になる（callTool は失敗を { ok: false, error } で返す callToolSafe も持つ）。
// - フックの入力は BaseHookInput（agentId?、sessionId、timestamp、workingDirectory）に toolName などを足したもの。
//   本物の SDK は、フックが例外を投げると握りつぶして undefined を返す。ここでは握りつぶさず、そのまま投げる
//   （「フックの関数は例外を投げない」を試験で確かめるため）。
// - セッションのイベントは { id, timestamp, parentId, agentId?, type, data }。agentId はサブエージェントのときだけ付く。

export function createFakeSession({ sessionId = 'session-test-0001', cwd = process.cwd() } = {}) {
  const listeners = new Map(); // type -> Set<fn>
  let config = null;
  let nextEvent = 1;
  let nextCall = 1;

  const session = {
    sessionId,
    on(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
      return () => listeners.get(type)?.delete(handler);
    },
    rpc: {
      workspaces: {
        getWorkspace: async () => ({ workspace: { cwd } }),
      },
    },
    log: async () => {},
  };

  const fake = {
    session,
    sessionId,

    /** joinSession の代わり。登録された設定を覚える */
    async joinSession(given) {
      config = given;
      return session;
    },

    get config() {
      if (!config) throw new Error('まだ joinSession が呼ばれていません');
      return config;
    },

    /** 登録されたツールの名前の一覧 */
    get toolNames() {
      return fake.config.tools.map((t) => t.name);
    },

    tool(name) {
      const found = fake.config.tools.find((t) => t.name === name);
      if (!found) throw new Error(`ツール ${name} は登録されていません。登録されているもの：${fake.toolNames.join('、')}`);
      return found;
    },

    /** ツールを呼ぶ。成功の文を返す。失敗（例外）はそのまま投げる */
    async callTool(name, args = {}, { agentId } = {}) {
      const tool = fake.tool(name);
      const toolCallId = `call-${nextCall++}`;
      return tool.handler(args, { sessionId, toolCallId, toolName: name, arguments: args, ...(agentId ? { agentId } : {}) });
    },

    /** ツールを呼ぶ。成功か失敗かを { ok, text | error } で返す */
    async callToolSafe(name, args = {}, options = {}) {
      try {
        return { ok: true, text: await fake.callTool(name, args, options) };
      } catch (error) {
        return { ok: false, error: error?.message ?? String(error) };
      }
    },

    /** フックを動かす。input に BaseHookInput の足りない項目を足して渡す */
    async hook(name, input = {}) {
      const fn = fake.config.hooks?.[name];
      if (typeof fn !== 'function') return undefined;
      return fn({ sessionId, timestamp: new Date(), workingDirectory: cwd, ...input }, { sessionId });
    },

    /** ask_user の1回（前のフックと後のフック）を流す。後のフックの返り値を返す */
    async askUser({ message, answer, resultType = 'success', agentId }) {
      const toolArgs = { message, requestedSchema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] } };
      await fake.hook('onPreToolUse', { toolName: 'ask_user', toolArgs, ...(agentId ? { agentId } : {}) });
      return fake.hook('onPostToolUse', {
        toolName: 'ask_user',
        toolArgs,
        toolResult: { textResultForLlm: answer, resultType },
        ...(agentId ? { agentId } : {}),
      });
    },

    /** セッションのイベントを流す */
    emit(type, data = {}, { agentId } = {}) {
      const event = { id: `event-${nextEvent++}`, timestamp: new Date().toISOString(), parentId: null, ...(agentId ? { agentId } : {}), type, data };
      for (const handler of [...(listeners.get(type) ?? [])]) handler(event);
      return event;
    },

    listenerCount: (type) => listeners.get(type)?.size ?? 0,
  };
  return fake;
}
