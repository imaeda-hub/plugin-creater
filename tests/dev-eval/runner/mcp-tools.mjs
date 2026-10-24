// 同じプロセスの中で動く MCP サーバー（testing.md 4章）。EVAL の仕組みが、エクステンションのツール
// （画面を開くツール、記録のツール、クリエイターの状態取得ツールなど）を、試すエージェントに MCP のツールとして出すために使う。外側と内側で共通。
//
// - 引数の決まり（inputSchema）は JSON Schema をそのまま MCP に出す。zod に直さない。モデルに見える引数の決まりが、
//   Copilot CLI に登録した版（core/tools.mjs の parameters）と同じになるようにするため。
// - 1つのサーバーのインスタンスは、1つの接続しか持てない。query() 1回ごとに、別のインスタンスを作る。
// - ツールを呼んだ呼び出しの番号（_meta の claudecode/toolUseId）を、ハンドラーの ctx.toolUseId に渡す。
//   呼んだエージェントは、フック PreToolUse の入力（tool_use_id と agent_id）から知る（内側の inner-adapter.mjs）。
// - ツールを、いつもプロンプトに載せる（anthropic/alwaysLoad）。載せないと、モデルはツール検索を経ないと使えない
//   （Copilot CLI の defer: 'never' と同じ）。

import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const TOOL_USE_ID_KEY = 'claudecode/toolUseId';
const AGENT_ID_KEY = 'claudecode/agentId';

function toContent(result) {
  if (typeof result === 'string') return { content: [{ type: 'text', text: result }] };
  if (result !== null && typeof result === 'object' && Array.isArray(result.content)) return result;
  return { content: [{ type: 'text', text: result === undefined ? '' : JSON.stringify(result) }] };
}

/**
 * 同じプロセスの MCP サーバーを作る。mcpServers[name] にそのまま渡せる。
 * @param {object} args
 * @param {string} args.name サーバー名（ツールの名前は mcp__<name>__<ツールの名前> になる）
 * @param {Array<{ name: string, description: string, inputSchema: object, handler: Function }>} args.tools
 *   handler(args, ctx) は文字列か { content, isError } を返す。Error を投げると、message を isError の結果にして返す
 *   ctx は { toolUseId, agentId, signal }。agentId は、Claude Code が _meta に付けたときだけ入る
 * @param {(event: { type: 'call' | 'result', name: string, toolUseId: string | undefined, args?: object, isError?: boolean }) => void} [args.onCall] 呼び出しの記録
 * @returns {{ type: 'sdk', name: string, instance: object }}
 */
export function createToolServer({ name, version = '1.0.0', tools, onCall }) {
  if (typeof name !== 'string' || name === '') throw new Error('createToolServer には name が要ります。');
  const byName = new Map();
  for (const tool of tools ?? []) {
    if (byName.has(tool.name)) throw new Error(`ツール名「${tool.name}」が重なっています。`);
    byName.set(tool.name, tool);
  }
  const server = new Server({ name, version }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...byName.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
      _meta: { 'anthropic/alwaysLoad': true },
    })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const toolName = request.params?.name;
    const meta = extra?._meta ?? request.params?._meta ?? {};
    const toolUseId = typeof meta[TOOL_USE_ID_KEY] === 'string' ? meta[TOOL_USE_ID_KEY] : undefined;
    const agentId = typeof meta[AGENT_ID_KEY] === 'string' ? meta[AGENT_ID_KEY] : undefined;
    const args = request.params?.arguments ?? {};
    const tool = byName.get(toolName);
    if (!tool) return { content: [{ type: 'text', text: `知らないツールです：${toolName}` }], isError: true };
    onCall?.({ type: 'call', name: toolName, toolUseId, args });
    try {
      const result = toContent(await tool.handler(args, { toolUseId, agentId, signal: extra?.signal }));
      onCall?.({ type: 'result', name: toolName, toolUseId, isError: result.isError === true });
      return result;
    } catch (error) {
      onCall?.({ type: 'result', name: toolName, toolUseId, isError: true });
      return { content: [{ type: 'text', text: error instanceof Error && error.message ? error.message : String(error) }], isError: true };
    }
  });
  return { type: 'sdk', name, instance: server };
}

/** サーバー名とツールの名前から、モデルに見える名前（mcp__<サーバー名>__<ツール>）を作る */
export function mcpToolName(serverName, toolName) {
  return `mcp__${serverName}__${toolName}`;
}
