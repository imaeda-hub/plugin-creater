// 同じプロセスの MCP サーバー（testing.md 4章）。MCP の本物のクライアントとサーバーを、メモリの中でつないで確かめる。
import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createToolServer, mcpToolName } from './mcp-tools.mjs';

async function connect(config) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await config.instance.connect(serverSide);
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(clientSide);
  return client;
}

const SCHEMA = {
  type: 'object',
  properties: { iteration: { type: 'integer', minimum: 1 }, text: { type: 'string' } },
  required: ['iteration'],
  additionalProperties: false,
};

test('testing.md 4章 引数の決まりは JSON Schema をそのまま出し、いつもプロンプトに載せる印を付ける', async () => {
  const server = createToolServer({ name: 'demo', tools: [{ name: 'plan', description: '計画を記録する', inputSchema: SCHEMA, handler: async () => 'ok' }] });
  assert.equal(server.type, 'sdk');
  assert.equal(server.name, 'demo');
  const client = await connect(server);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, 'plan');
  assert.equal(tools[0].description, '計画を記録する');
  assert.deepEqual(tools[0].inputSchema, SCHEMA);
  assert.equal(tools[0]._meta['anthropic/alwaysLoad'], true);
  await client.close();
});

test('testing.md 4章 ツールを呼ぶと、引数と呼び出しの番号（_meta の claudecode/toolUseId）がハンドラーに届く', async () => {
  const seen = [];
  const events = [];
  const server = createToolServer({
    name: 'demo',
    tools: [{ name: 'plan', description: 'd', inputSchema: SCHEMA, handler: async (args, ctx) => { seen.push({ args, ctx }); return `記録した ${args.iteration}`; } }],
    onCall: (e) => events.push(e),
  });
  const client = await connect(server);
  const result = await client.callTool({ name: 'plan', arguments: { iteration: 2 }, _meta: { 'claudecode/toolUseId': 'toolu_1', 'claudecode/agentId': 'agent-7' } });
  assert.deepEqual(result.content, [{ type: 'text', text: '記録した 2' }]);
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].args, { iteration: 2 });
  assert.equal(seen[0].ctx.toolUseId, 'toolu_1');
  assert.equal(seen[0].ctx.agentId, 'agent-7');
  assert.deepEqual(events.map((e) => e.type), ['call', 'result']);
  assert.equal(events[0].toolUseId, 'toolu_1');
  assert.equal(events[1].isError, false);
  // 番号が付かない呼び出しでも動く
  const plain = await client.callTool({ name: 'plan', arguments: { iteration: 1 } });
  assert.equal(plain.content[0].text, '記録した 1');
  assert.equal(seen[1].ctx.toolUseId, undefined);
  await client.close();
});

test('testing.md 4章 ハンドラーが Error を投げたら、message を isError の結果にして返す（モデルが理由を読んで直せる）', async () => {
  const events = [];
  const server = createToolServer({
    name: 'demo',
    tools: [{ name: 'verdict', description: 'd', inputSchema: SCHEMA, handler: async () => { throw new Error('検証エージェントだけが記録できます。'); } }],
    onCall: (e) => events.push(e),
  });
  const client = await connect(server);
  const result = await client.callTool({ name: 'verdict', arguments: { iteration: 1 } });
  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, '検証エージェントだけが記録できます。');
  assert.equal(events.at(-1).isError, true);
  const unknown = await client.callTool({ name: 'nothing', arguments: {} });
  assert.equal(unknown.isError, true);
  assert.match(unknown.content[0].text, /知らないツール/);
  await client.close();
});

test('testing.md 4章 ハンドラーが content を返したときは、そのまま返す', async () => {
  const server = createToolServer({
    name: 'demo',
    tools: [{ name: 'a', description: 'd', inputSchema: { type: 'object' }, handler: async () => ({ content: [{ type: 'text', text: '画像なし' }], isError: true }) }],
  });
  const client = await connect(server);
  const result = await client.callTool({ name: 'a', arguments: {} });
  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, '画像なし');
  await client.close();
});

test('testing.md 4章 同じ名前のツールは重ねられない。サーバーは実行ごとに別のインスタンス', () => {
  const tool = { name: 'a', description: 'd', inputSchema: { type: 'object' }, handler: async () => 'x' };
  assert.throws(() => createToolServer({ name: 'demo', tools: [tool, tool] }), /重なっています/);
  assert.throws(() => createToolServer({ tools: [] }), /name/);
  const one = createToolServer({ name: 'demo', tools: [tool] });
  const two = createToolServer({ name: 'demo', tools: [tool] });
  assert.notEqual(one.instance, two.instance);
});

test('testing.md 4章 モデルに見える名前は mcp__<サーバー名>__<ツール>', () => {
  assert.equal(mcpToolName('weekly-report', 'plan'), 'mcp__weekly-report__plan');
});
