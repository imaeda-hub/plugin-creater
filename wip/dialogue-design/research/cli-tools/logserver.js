// Logging fake model server for Copilot CLI offline/BYOK experiments.
// Usage: node logserver.js <port> <logdir> <handler.js>
// - Logs every request (url, headers, body) to <logdir>/NNN-<path>.json
// - Response decided by handler module (reloaded per request):
//     module.exports = (ctx) => ({ content: 'text' } | { tool_calls: [{name, arguments(obj)}] })
//   ctx = { body, n (request index), url, kind: 'chat'|'anthropic'|'responses' , lastUser, msgs }
// Supports OpenAI chat/completions (stream + non-stream) and Anthropic /v1/messages (stream + non-stream).
const http = require('http');
const fs = require('fs');
const path = require('path');
const [port, logdir, handlerPath] = process.argv.slice(2);
fs.mkdirSync(logdir, { recursive: true });
let n = 0;

function loadHandler() {
  const p = path.resolve(handlerPath);
  delete require.cache[p];
  return require(p);
}

function sse(r, obj, event) {
  if (event) r.write('event: ' + event + '\n');
  r.write('data: ' + JSON.stringify(obj) + '\n\n');
}

http.createServer((q, r) => {
  let b = '';
  q.on('data', (d) => (b += d));
  q.on('end', () => {
    const idx = ++n;
    let body = {};
    try { body = b ? JSON.parse(b) : {}; } catch (e) { body = { _raw: b }; }
    const slug = q.url.replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
    fs.writeFileSync(path.join(logdir, String(idx).padStart(3, '0') + '-' + slug + '.json'),
      JSON.stringify({ method: q.method, url: q.url, headers: q.headers, body }, null, 2));
    let kind = null;
    if (q.url.includes('chat/completions')) kind = 'chat';
    else if (q.url.includes('/messages')) kind = 'anthropic';
    else if (q.url.includes('/responses')) kind = 'responses';
    if (!kind) {
      r.writeHead(200, { 'content-type': 'application/json' });
      return r.end(JSON.stringify({ data: [{ id: 'fake', object: 'model' }] }));
    }
    let out;
    try {
      out = loadHandler()({ body, n: idx, url: q.url, kind });
    } catch (e) {
      out = { content: 'handler error: ' + e.message };
    }
    if (out && out.delayMs) {
      return setTimeout(() => respond(kind, body, out, r), out.delayMs);
    }
    respond(kind, body, out, r);
  });
}).listen(Number(port), '127.0.0.1', () => console.log('listening', port));

function respond(kind, body, out, r) {
  const toolCalls = (out.tool_calls || []).map((t, i) => ({
    id: t.id || 'call_' + Math.random().toString(36).slice(2, 10),
    name: t.name,
    arguments: typeof t.arguments === 'string' ? t.arguments : JSON.stringify(t.arguments || {}),
  }));
  const est = Math.round(JSON.stringify(body).length / 4);
  const usage = out.usage || { prompt_tokens: est, completion_tokens: 10, total_tokens: est + 10 };
  if (kind === 'chat') {
    const msg = { role: 'assistant', content: out.content || null };
    if (toolCalls.length) msg.tool_calls = toolCalls.map((t) => ({ id: t.id, type: 'function', function: { name: t.name, arguments: t.arguments } }));
    const finish = toolCalls.length ? 'tool_calls' : 'stop';
    if (body.stream) {
      r.writeHead(200, { 'content-type': 'text/event-stream' });
      const delta = { role: 'assistant' };
      if (msg.content) delta.content = msg.content;
      if (msg.tool_calls) delta.tool_calls = msg.tool_calls.map((t, i) => ({ index: i, ...t }));
      sse(r, { id: '1', object: 'chat.completion.chunk', model: body.model, choices: [{ index: 0, delta, finish_reason: null }] });
      sse(r, { id: '1', object: 'chat.completion.chunk', model: body.model, choices: [{ index: 0, delta: {}, finish_reason: finish }], usage });
      r.end('data: [DONE]\n\n');
    } else {
      r.writeHead(200, { 'content-type': 'application/json' });
      r.end(JSON.stringify({ id: '1', object: 'chat.completion', model: body.model, choices: [{ index: 0, message: msg, finish_reason: finish }], usage }));
    }
    return;
  }
  if (kind === 'anthropic') {
    const content = [];
    if (out.content) content.push({ type: 'text', text: out.content });
    for (const t of toolCalls) content.push({ type: 'tool_use', id: 'toolu_' + t.id, name: t.name, input: JSON.parse(t.arguments) });
    const stop = toolCalls.length ? 'tool_use' : 'end_turn';
    const au = { input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens };
    if (body.stream) {
      r.writeHead(200, { 'content-type': 'text/event-stream' });
      sse(r, { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, usage: { input_tokens: au.input_tokens, output_tokens: 1 } } }, 'message_start');
      content.forEach((c, i) => {
        if (c.type === 'text') {
          sse(r, { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } }, 'content_block_start');
          sse(r, { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: c.text } }, 'content_block_delta');
        } else {
          sse(r, { type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: c.id, name: c.name, input: {} } }, 'content_block_start');
          sse(r, { type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: JSON.stringify(c.input) } }, 'content_block_delta');
        }
        sse(r, { type: 'content_block_stop', index: i }, 'content_block_stop');
      });
      sse(r, { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: au.output_tokens } }, 'message_delta');
      sse(r, { type: 'message_stop' }, 'message_stop');
      r.end();
    } else {
      r.writeHead(200, { 'content-type': 'application/json' });
      r.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: body.model, content, stop_reason: stop, usage: au }));
    }
    return;
  }
  // responses API (minimal, non-stream + stream)
  const output = [];
  if (out.content) output.push({ type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: out.content, annotations: [] }] });
  for (const t of toolCalls) output.push({ type: 'function_call', id: 'fc_' + t.id, call_id: t.id, name: t.name, arguments: t.arguments, status: 'completed' });
  const resp = { id: 'resp_1', object: 'response', status: 'completed', model: body.model, output, usage: { input_tokens: usage.prompt_tokens, output_tokens: usage.completion_tokens, total_tokens: usage.total_tokens } };
  if (body.stream) {
    r.writeHead(200, { 'content-type': 'text/event-stream' });
    sse(r, { type: 'response.created', response: { ...resp, status: 'in_progress', output: [] } }, 'response.created');
    output.forEach((o, i) => {
      sse(r, { type: 'response.output_item.added', output_index: i, item: o }, 'response.output_item.added');
      sse(r, { type: 'response.output_item.done', output_index: i, item: o }, 'response.output_item.done');
    });
    sse(r, { type: 'response.completed', response: resp }, 'response.completed');
    r.end();
  } else {
    r.writeHead(200, { 'content-type': 'application/json' });
    r.end(JSON.stringify(resp));
  }
}
