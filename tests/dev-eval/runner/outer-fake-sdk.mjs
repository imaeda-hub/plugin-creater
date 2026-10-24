// 外側の EVAL の試験のための、偽物の Agent SDK（実際のモデルは使わない）。
// query({ prompt, options }) の代わりに使う関数 query を作る。本物と同じ形のメッセージ（system の init、assistant、user、result）を返す。
//
//   const sdk = createFakeSdk({
//     userRole: ({ system, prompt }) => '答え',          // systemPrompt が文字のとき（ユーザー役の呼び出し）の答え
//     agent: async (ctx) => { ... },                     // クリエイター役（systemPrompt が文字でないとき）の台本
//   });
//   sdk.query, sdk.calls（query の呼び出しの記録）
//
// 台本の ctx：
//   ctx.prompt, ctx.turn（このセッションの何回目の query か）, ctx.sessionId, ctx.options
//   await ctx.say(text)                      メインのエージェントの文
//   await ctx.ask(questions)                 AskUserQuestion。canUseTool に渡し、答え（{ 質問の文: 答え }）を返す
//   await ctx.tool(name, input, opts)        ツールの呼び出し。mcp__<サーバー名>__ のツールは、MCP のクライアントで本物のサーバーに呼ぶ
//                                            それ以外は opts.run(input) か、既定の 'ok'。opts.parent で、サブエージェントの中の呼び出しにする
//   台本が文字を返すと、それが result の文。何も返さなければ、最後の ctx.say の文
//
// 本物の Claude Code の本体は動かさない。本物の本体と偽の API でつなぐ試験は、fake-anthropic.mjs を使う。

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

function channel() {
  const queue = [];
  let wake = null;
  let done = false;
  return {
    push(message) {
      queue.push(message);
      const w = wake;
      wake = null;
      w?.();
    },
    close() {
      done = true;
      const w = wake;
      wake = null;
      w?.();
    },
    async *iterate() {
      for (;;) {
        if (queue.length) yield queue.shift();
        else if (done) return;
        else await new Promise((resolve) => { wake = resolve; });
      }
    },
  };
}

let idCounter = 0;
const nextId = (prefix) => `${prefix}_${(idCounter += 1).toString(36)}`;

export function createFakeSdk({ userRole, agent, model = 'claude-sonnet-5-5', costPerCall = 0.001 } = {}) {
  const calls = [];
  const turns = new Map();

  async function* userRoleQuery({ prompt, options }) {
    const text = await userRole({ system: options.systemPrompt, prompt, options });
    calls.push({ kind: 'user-role', prompt, options });
    if (text instanceof Error) {
      yield { type: 'result', subtype: 'error_during_execution', is_error: true, result: text.message, total_cost_usd: 0 };
      return;
    }
    yield { type: 'result', subtype: 'success', is_error: false, result: text, total_cost_usd: costPerCall };
  }

  async function* agentQuery({ prompt, options }) {
    const sessionId = options.resume ?? nextId('fake-session');
    const turn = (turns.get(sessionId) ?? 0) + 1;
    turns.set(sessionId, turn);
    calls.push({ kind: 'agent', prompt, options, sessionId, turn });
    const out = channel();
    const clients = new Map();
    const abort = new AbortController();
    let lastText = '';
    const started = Date.now();

    const emit = (message) => out.push({ session_id: sessionId, ...message });
    const assistant = (content, parent = null) => emit({ type: 'assistant', message: { model: options.model ?? model, content }, parent_tool_use_id: parent });
    const userResult = (toolUseId, text, parent = null, isError = false) =>
      emit({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content: [{ type: 'text', text }], ...(isError ? { is_error: true } : {}) }] }, parent_tool_use_id: parent });

    async function mcpClient(serverName) {
      if (clients.has(serverName)) return clients.get(serverName);
      const config = options.mcpServers?.[serverName];
      if (!config?.instance) throw new Error(`MCP サーバー「${serverName}」が options.mcpServers にありません。`);
      const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
      await config.instance.connect(serverSide);
      const client = new Client({ name: 'fake-agent', version: '1.0.0' }, { capabilities: {} });
      await client.connect(clientSide);
      clients.set(serverName, client);
      return client;
    }

    const ctx = {
      prompt,
      turn,
      sessionId,
      options,
      say(text, parent = null) {
        if (parent === null) lastText = text;
        assistant([{ type: 'text', text }], parent);
      },
      async ask(questions) {
        const id = nextId('toolu');
        assistant([{ type: 'tool_use', id, name: 'AskUserQuestion', input: { questions } }]);
        const decision = await options.canUseTool('AskUserQuestion', { questions }, { signal: abort.signal, toolUseID: id, requestId: nextId('req') });
        if (decision.behavior !== 'allow') {
          userResult(id, decision.message ?? '断られました', null, true);
          throw new Error(`質問が断られました：${decision.message}`);
        }
        const answers = decision.updatedInput?.answers ?? {};
        userResult(id, `User has answered your questions: ${Object.entries(answers).map(([q, a]) => `"${q}"="${a}"`).join(', ')}.`);
        return answers;
      },
      async tool(name, input = {}, { run, parent = null, agentId } = {}) {
        const id = nextId('toolu');
        assistant([{ type: 'tool_use', id, name, input }], parent);
        const mcp = /^mcp__(.+?)__(.+)$/.exec(name);
        let text;
        let isError = false;
        if (mcp && options.mcpServers?.[mcp[1]]) {
          const client = await mcpClient(mcp[1]);
          const result = await client.callTool({ name: mcp[2], arguments: input, _meta: { 'claudecode/toolUseId': id, ...(agentId ? { 'claudecode/agentId': agentId } : {}) } });
          text = (result.content ?? []).map((c) => c.text ?? '').join('\n');
          isError = result.isError === true;
        } else if (run) {
          try {
            text = String((await run(input)) ?? 'ok');
          } catch (error) {
            text = error.message;
            isError = true;
          }
        } else {
          text = 'ok';
        }
        userResult(id, text, parent, isError);
        return { text, isError };
      },
    };

    emit({ type: 'system', subtype: 'init', model: options.model ?? model, plugins: (options.plugins ?? []).map((p) => ({ name: p.path.split('/').pop(), path: p.path })) });
    const finish = (async () => {
      try {
        const returned = await agent(ctx);
        if (typeof returned === 'string') lastText = returned;
        emit({ type: 'result', subtype: 'success', is_error: false, result: lastText, total_cost_usd: costPerCall, num_turns: 1, duration_ms: Date.now() - started });
      } catch (error) {
        emit({ type: 'result', subtype: 'error_during_execution', is_error: true, result: error?.message ?? String(error), total_cost_usd: costPerCall });
      } finally {
        for (const client of clients.values()) await client.close().catch(() => {});
        out.close();
      }
    })();
    try {
      yield* out.iterate();
    } finally {
      abort.abort();
      await finish;
    }
  }

  return {
    calls,
    query(params) {
      const system = params.options?.systemPrompt;
      if (typeof system === 'string') {
        if (!userRole) throw new Error('偽物の SDK に userRole の台本がありません。');
        return userRoleQuery(params);
      }
      if (!agent) throw new Error('偽物の SDK に agent の台本がありません。');
      return agentQuery(params);
    },
  };
}
