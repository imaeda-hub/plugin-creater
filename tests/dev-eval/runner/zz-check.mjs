import * as sdk from '@anthropic-ai/claude-agent-sdk';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createScreen } from '../../../skills/test-plugin/scripts/screen.mjs';
import { startFakeAnthropic } from './fake-anthropic.mjs';
import { runInnerArm } from './inner-run.mjs';
import { buildSamplePlugin, scriptedModel, tmpDir } from './inner-test-support.mjs';
const fixture = buildSamplePlugin();
const api = await startFakeAnthropic(scriptedModel({ workerDelayMs: 500, verifierDelayMs: 500 }));
const screen = createScreen({ chromium, env: { ...process.env, PLUGIN_TEST_BROWSER_CHANNEL: 'chromium' } });
const runDir = tmpDir('zz');
const result = await runInnerArm({ arm: 'with', task: fixture.task, runDir, sdk, userRole: async () => 'はい', judge: async () => ({ pass: true, reason: '' }), screen, pluginRoot: fixture.pluginRoot, convertedRoot: fixture.convertedRoot, envExtra: { ANTHROPIC_API_KEY: 'k', ANTHROPIC_BASE_URL: api.url, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' }, timeoutMs: 120000, pollMs: 300 });
console.log(result.status, result.reason);
const lines = fs.readFileSync(path.join(runDir, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
for (const l of lines) {
  if (l.t === 'sdk' && l.m.subtype === 'task_started') console.log('task_started', JSON.stringify(l.m));
  if (l.t === 'sdk' && l.m.subtype === 'init') console.log('init', l.run, JSON.stringify({ plugins: l.m.plugins, plugin_errors: l.m.plugin_errors, mcp: l.m.mcp_servers, agents: l.m.agents, tools: l.m.tools }).slice(0, 600));
}
console.log(JSON.stringify(result.finalState?.agents));
console.log(JSON.stringify(result.checks.map((c) => [c.id, c.ok])));
await screen.close(); await api.close();
