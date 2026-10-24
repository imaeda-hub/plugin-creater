// 偽の Anthropic API（ローカルの HTTP サーバー）。実際のモデルを使わずに、本物の Agent SDK と Claude Code の本体を動かして試験するために使う。
// Claude Code の本体に ANTHROPIC_BASE_URL でつなぐ（ANTHROPIC_API_KEY は適当な文字でよい）。応答は試験が台本で決める。
//
//   const api = await startFakeAnthropic(async (request) => ({ blocks: [{ type: 'text', text: 'こんにちは' }] }));
//   // request: { index, body, system, who }。body は /v1/messages の入力（model、system、tools、messages）
//   // 返り値: { blocks, model?, delayMs? } の blocks は text か tool_use（{ type: 'tool_use', name, input }）の並び
//   //         { status, error } を返すと、その HTTP の誤りを返す（利用枠の上限などの試験用）
//   api.url, api.requests, await api.close()
//
// ストリーミング（SSE）で返す。tool_use を含めると stop_reason は tool_use、なければ end_turn。

import http from 'node:http';
import zlib from 'node:zlib';

const randomId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 12)}`;

/** body.system（文字か、text ブロックの並び）を1つの文字にする */
export function systemText(body) {
  const system = body?.system;
  if (typeof system === 'string') return system;
  return Array.isArray(system) ? system.map((b) => b?.text ?? '').join('\n') : '';
}

/** messages のうち、最後の user のメッセージ（role が system のものは飛ばす） */
export function lastUserMessage(body) {
  return [...(body?.messages ?? [])].reverse().find((m) => m.role === 'user') ?? null;
}

/** 最後の user のメッセージにある tool_result の文字の並び（ツールの返り値） */
export function lastToolResults(body) {
  const content = lastUserMessage(body)?.content;
  if (!Array.isArray(content)) return [];
  return content
    .filter((c) => c.type === 'tool_result')
    .map((c) => (typeof c.content === 'string' ? c.content : (c.content ?? []).map((x) => x.text ?? '').join('\n')));
}

/** 最後の user のメッセージの文字（text ブロックをつなぐ） */
export function lastUserText(body) {
  const content = lastUserMessage(body)?.content;
  if (typeof content === 'string') return content;
  return Array.isArray(content) ? content.filter((c) => c.type === 'text').map((c) => c.text).join('\n') : '';
}

/** 会話の最初の user のメッセージの文字（統括や作業への最初の指示） */
export function firstUserText(body) {
  const first = (body?.messages ?? []).find((m) => m.role === 'user');
  const content = first?.content;
  if (typeof content === 'string') return content;
  return Array.isArray(content) ? content.filter((c) => c.type === 'text').map((c) => c.text).join('\n') : '';
}

function writeSse(res, body, out) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const blocks = out.blocks ?? [];
  const hasTool = blocks.some((b) => b.type === 'tool_use');
  send('message_start', {
    type: 'message_start',
    message: {
      id: randomId('msg'), type: 'message', role: 'assistant', model: out.model ?? body?.model ?? 'fake', content: [],
      stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 },
    },
  });
  blocks.forEach((block, index) => {
    if (block.type === 'text') {
      send('content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
      send('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text } });
    } else {
      send('content_block_start', { type: 'content_block_start', index, content_block: { type: 'tool_use', id: block.id ?? randomId('toolu'), name: block.name, input: {} } });
      send('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input ?? {}) } });
    }
    send('content_block_stop', { type: 'content_block_stop', index });
  });
  send('message_delta', { type: 'message_delta', delta: { stop_reason: hasTool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } });
  send('message_stop', { type: 'message_stop' });
  res.end();
}

/**
 * @param {(request: { index: number, body: object, system: string }) => object | Promise<object>} handler
 * @returns {Promise<{ url: string, requests: Array<{ index: number, body: object }>, close: () => Promise<void> }>}
 */
export async function startFakeAnthropic(handler) {
  const requests = [];
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      let raw = Buffer.concat(chunks);
      try {
        if (req.headers['content-encoding'] === 'gzip') raw = zlib.gunzipSync(raw);
      } catch {
        // 読めなければ、そのまま扱う
      }
      let body = null;
      try {
        body = JSON.parse(raw.toString('utf8'));
      } catch {
        body = null;
      }
      const isMessages = req.method === 'POST' && req.url.startsWith('/v1/messages') && !req.url.includes('count_tokens');
      if (!isMessages) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(req.url.includes('count_tokens') ? JSON.stringify({ input_tokens: 10 }) : '{}');
        return;
      }
      const index = requests.length;
      requests.push({ index, body });
      try {
        const out = (await handler({ index, body, system: systemText(body) })) ?? { blocks: [{ type: 'text', text: 'ok' }] };
        if (out.delayMs) await new Promise((resolve) => setTimeout(resolve, out.delayMs));
        if (out.status) {
          res.writeHead(out.status, { 'content-type': 'application/json' });
          res.end(JSON.stringify(out.error ?? { type: 'error', error: { type: 'api_error', message: 'fake error' } }));
          return;
        }
        writeSse(res, body, out);
      } catch (error) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: `fake handler failed: ${error?.message}` } }));
      }
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    close: () =>
      new Promise((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}
