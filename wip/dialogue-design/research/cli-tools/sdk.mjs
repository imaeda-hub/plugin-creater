// SDK driver: node sdk.mjs <configJson>
// config: { port, home, model, ptype, wire, prompts:[...], variant:'legacy'|'elicitation'|null,
//           answers:[...], cwd, sessionOpts:{}, resumeId, eventsFile, mode }
import fs from 'node:fs';
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const SDK = '/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/cli/pkg/package/copilot-sdk/index.js';
const BIN = '/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/cp/node_modules/@github/copilot-linux-x64/copilot';
const { CopilotClient, RuntimeConnection, approveAll } = await import(SDK);

const env = { ...process.env };
delete env.GH_TOKEN; delete env.GITHUB_TOKEN; delete env.COPILOT_GITHUB_TOKEN;
Object.assign(env, {
  COPILOT_HOME: cfg.home,
  COPILOT_OFFLINE: 'true',
  COPILOT_PROVIDER_BASE_URL: cfg.ptype === 'anthropic' ? `http://127.0.0.1:${cfg.port}` : `http://127.0.0.1:${cfg.port}/v1`,
  COPILOT_MODEL: cfg.model,
  ...(cfg.ptype ? { COPILOT_PROVIDER_TYPE: cfg.ptype } : {}),
  ...(cfg.wire ? { COPILOT_PROVIDER_WIRE_API: cfg.wire } : {}),
  ...(cfg.env || {}),
});
const events = [];
const client = new CopilotClient({
  connection: RuntimeConnection.forStdio({ path: BIN, args: cfg.args || [] }),
  env,
  baseDirectory: cfg.home,
  workingDirectory: cfg.cwd,
  logLevel: 'debug',
});
await client.start();
let answerIdx = 0;
const sessOpts = {
  model: cfg.model,
  workingDirectory: cfg.cwd,
  onPermissionRequest: approveAll,
  provider: { type: cfg.ptype || 'openai', baseUrl: env.COPILOT_PROVIDER_BASE_URL, ...(cfg.wire ? { wireApi: cfg.wire } : {}) },
  ...(cfg.sessionOpts || {}),
};
if (cfg.variant !== null) {
  sessOpts.onUserInputRequest = async (req) => {
    events.push({ type: 'HANDLER.onUserInputRequest', req });
    const a = (cfg.answers || [])[answerIdx++] || { answer: 'default answer', wasFreeform: true };
    return a;
  };
}
if (cfg.variant === 'elicitation') {
  sessOpts.askUserVariant = 'elicitation';
  sessOpts.onElicitationRequest = async (req) => {
    events.push({ type: 'HANDLER.onElicitationRequest', req });
    const a = (cfg.elicitAnswers || [])[answerIdx++] || { action: 'accept', content: {} };
    return a;
  };
}
let session;
if (cfg.resumeId) session = await client.resumeSession(cfg.resumeId, sessOpts);
else session = await client.createSession(sessOpts);
session.on((ev) => { events.push(ev); });
for (const p of cfg.prompts || []) {
  if (typeof p === 'string' && p.startsWith('@@MODE:')) {
    try { await session.rpc.mode.set({ mode: p.slice(7) }); events.push({ type: 'SET_MODE', mode: p.slice(7) }); } catch (e) { events.push({ type: 'SET_MODE_ERR', err: String(e) }); }
    continue;
  }
  if (typeof p === 'string' && p.startsWith('@@RPC:')) {
    const [m, arg] = p.slice(6).split('|');
    try { const parts = m.split('.'); let o = session.rpc; for (const k of parts.slice(0, -1)) o = o[k]; const r = await o[parts.at(-1)](arg ? JSON.parse(arg) : {}); events.push({ type: 'RPC_RESULT', m, r }); } catch (e) { events.push({ type: 'RPC_ERR', m, err: String(e) }); }
    continue;
  }
  const msg = typeof p === 'string' ? { prompt: p } : p;
  try {
    const r = await session.sendAndWait(msg, cfg.timeoutMs || 60000);
    events.push({ type: 'SEND_RESULT', r });
  } catch (e) { events.push({ type: 'SEND_ERR', err: String(e) }); }
}
events.push({ type: 'SESSION_ID', id: session.sessionId, workspacePath: session.workspacePath });
fs.writeFileSync(cfg.eventsFile, JSON.stringify(events, null, 1));
try { await session.disconnect?.(); } catch {}
try { await client.stop(); } catch {}
console.log('done', session.sessionId);
process.exit(0);
