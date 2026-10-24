// 偽物のセッション。クリエイターのエクステンションの試験で、Copilot CLI の代わりにつなぐ。
//
// 本物の joinSession（@github/copilot-sdk/extension）と同じ形で、ツールとフックの登録を受ける。
// 試験は、ここからツールを呼び、フックを動かし、セッションのイベントを流す。
//
// 本物の振る舞いに合わせたところ（R2：wip/implementation/research/R2-extension-api.md）
// - ツールの handler は (args, invocation) で呼ばれる。invocation.agentId は、サブエージェントが呼んだときだけ付く。
//   処理が例外を投げると、実機の Copilot CLI 1.0.102 はモデルに「Tool execution failed」だけを返し、理由の文を捨てる（V1 不具合 2）。
//   そのため、このエクステンションは断りも失敗も例外にせず、`{ textResultForLlm, resultType: 'failure' }` を返す。
//   callToolRaw はその返り値をそのまま返し、例外はそのまま投げる（例外が出たら不具合として試験が落ちる）。
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

    /**
     * ツールを呼ぶ。SDK に渡る返り値（文字列か ToolResultObject）を、そのまま返す。
     * 処理が例外を投げたら、そのまま投げる。断りも失敗も、例外にしない決まり（実機の Copilot CLI 1.0.102 は、例外の理由の文をモデルに返さない。V1 不具合 2）なので、
     * 例外が出たら不具合として試験が落ちる。
     */
    async callToolRaw(name, args = {}, { agentId } = {}) {
      const tool = fake.tool(name);
      const toolCallId = `call-${nextCall++}`;
      return tool.handler(args, { sessionId, toolCallId, toolName: name, arguments: args, ...(agentId ? { agentId } : {}) });
    },

    /** ツールを呼ぶ。成功の文を返す。失敗（resultType が failure の結果）は、理由の文を持つ Error として投げる（成功を期待する呼び出し用） */
    async callTool(name, args = {}, options = {}) {
      const result = await fake.callToolRaw(name, args, options);
      if (typeof result === 'string') return result;
      if (result?.resultType === 'failure') throw new Error(result.textResultForLlm);
      return result?.textResultForLlm ?? result;
    },

    /** ツールを呼ぶ。成功か失敗かを { ok, text | error } で返す（失敗は resultType が failure の結果。理由の文が error になる） */
    async callToolSafe(name, args = {}, options = {}) {
      const result = await fake.callToolRaw(name, args, options);
      if (typeof result === 'string') return { ok: true, text: result };
      if (result?.resultType === 'failure') return { ok: false, error: result.textResultForLlm };
      return { ok: true, text: result?.textResultForLlm ?? result };
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
