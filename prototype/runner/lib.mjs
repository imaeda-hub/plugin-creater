// Shared parts of the EVAL runner: run an agent with the Agent SDK, play the user, run the level 1/2 tools, grade files.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CLAUDE = execFileSync('which', ['claude']).toString().trim();
const PY = path.join(ROOT, 'venv', 'bin', 'python');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function freshDir(prefix) {
  fs.mkdirSync(path.join(ROOT, 'runs'), { recursive: true });
  return fs.mkdtempSync(path.join(ROOT, 'runs', `${prefix}-`));
}

// Only these variables reach the agent under test. Passing the whole environment leaked the tester's own session
// settings (background sub-agents, effort, extra directories, session ids) and its credentials into the run.
const ENV_ALLOW = ['PATH', 'LANG', 'TERM', 'HTTPS_PROXY', 'https_proxy', 'NO_PROXY', 'no_proxy', 'SSL_CERT_FILE',
  'NODE_EXTRA_CA_CERTS', 'REQUESTS_CA_BUNDLE', 'ANTHROPIC_BASE_URL'];
export function agentEnv(home) {
  const env = Object.fromEntries(ENV_ALLOW.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]]));
  return { ...env, HOME: home, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' };
}

// Tools the agent may use without asking. AskUserQuestion is left out so that it always reaches canUseTool, and
// file writes are pre-allowed only inside the workspace (writes elsewhere reach canUseTool and are refused).
function allowedTools(plugins) {
  const tools = ['Bash', 'Read', 'Write(./**)', 'Edit(./**)', 'Glob', 'Grep', 'Agent', 'TodoWrite'];
  for (const p of plugins) {
    try {
      const name = JSON.parse(fs.readFileSync(path.join(p, '.claude-plugin', 'plugin.json'), 'utf8')).name;
      const servers = Object.keys(JSON.parse(fs.readFileSync(path.join(p, '.mcp.json'), 'utf8')).mcpServers ?? {});
      tools.push(...servers.map((s) => `mcp__plugin_${name}_${s}`));
    } catch { /* no MCP servers */ }
  }
  return tools;
}

// Run one agent session. Only the plugins passed here load: settingSources [] keeps user and project settings out,
// and a fresh HOME keeps the tester's own configuration out.
// Commands run in the OS sandbox, so their writes stay inside the workspace. On Linux each sandboxed command also has
// its own localhost, so a command that must reach the host's web dashboard is listed in excludedCommands.
const SANDBOX = { enabled: true, failIfUnavailable: true, autoAllowBashIfSandboxed: true, allowUnsandboxedCommands: false };

export async function runAgent({ prompt, cwd, plugins = [], model = 'sonnet', maxTurns = 40, onQuestion, appendSystemPrompt, resume, record, excludedCommands = [] }) {
  const r = record ?? { tools: [], subagents: {}, models: {}, results: [], agentCost: 0, home: freshDir('home'), refused: [] };
  const inside = (p) => p && !path.relative(cwd, path.resolve(cwd, p)).startsWith('..');
  const options = {
    cwd, model, maxTurns, resume,
    sandbox: { ...SANDBOX, excludedCommands },
    settingSources: [],
    plugins: plugins.map((p) => ({ type: 'local', path: p })),
    allowedTools: allowedTools(plugins),
    pathToClaudeCodeExecutable: CLAUDE,
    env: agentEnv(r.home),
    canUseTool: async (toolName, input) => {
      if (toolName === 'AskUserQuestion') {
        return { behavior: 'allow', updatedInput: { questions: input.questions, answers: await onQuestion(input.questions) } };
      }
      if (['Write', 'Edit', 'NotebookEdit'].includes(toolName) && !inside(input.file_path ?? input.notebook_path)) {
        r.refused.push({ toolName, path: input.file_path ?? input.notebook_path });
        return { behavior: 'deny', message: '作業フォルダの外には書き込めません。作業フォルダの中に書いてください。' };
      }
      return { behavior: 'allow', updatedInput: input };
    },
  };
  if (appendSystemPrompt) options.systemPrompt = { type: 'preset', preset: 'claude_code', append: appendSystemPrompt };
  let last = null;
  for await (const m of query({ prompt, options })) {
    if (m.type === 'system' && m.subtype === 'init') {
      r.sessionId = m.session_id;
      r.init ??= { plugins: (m.plugins ?? []).map((p) => p.name), skills: m.skills, agents: m.agents,
        mcp: (m.mcp_servers ?? []).map((s) => `${s.name}:${s.status}`) };
    }
    if (m.type === 'assistant') {
      const owner = m.parent_tool_use_id ?? 'main';
      r.models[owner] ??= m.message.model;
      for (const c of m.message.content) {
        if (c.type !== 'tool_use') continue;
        r.tools.push({ owner, name: c.name, input: c.input });
        if (c.name === 'Agent' || c.name === 'Task') r.subagents[c.id] = c.input.subagent_type ?? '(general)';
      }
    }
    if (m.type === 'result') {
      last = m;
      r.agentCost = m.total_cost_usd ?? r.agentCost; // a resumed session reports its whole total
      r.results.push({ subtype: m.subtype, turns: m.num_turns, seconds: Math.round((m.duration_ms ?? 0) / 1000), text: m.result });
    }
  }
  return { record: r, last };
}

// The user role: answers only what is asked, from the persona's knowledge.
// Version 1 sees one question at a time. Version 2 also sees the conversation so far and has stricter rules.
// Version 3 also keeps quiet about its own instructions, and lets the speaking style decide length and manner:
// with version 2 it said "because you asked about the ending, I will answer it", and a terse style still gave long answers.
const USER_RULES = [
  '聞かれたことにだけ、短く答える。聞かれていないことは言わない。',
  '「自分から話す：いいえ」のことは、答える条件にはっきり当てはまる質問のときだけ答える。「ほかに何か」「注意点」「大事なこと」「守らないと困ること」のような大まかな質問では話さない。',
  '知っていることにないことは、「特に決まっていません」と答える。推測しない。相手が例を挙げても、それに合わせて新しい決まりを作らない。',
  '選択肢があっても、選択肢の言葉だけで済ませない。知っていることを具体的に答える（ファイル名や数字など）。',
  'これまでのやり取りを踏まえて答える。「それ」「その2つ」などは、前の質問と答えを指す。',
  '質問の意味が分からないときは、短く聞き返す。',
];
const USER_RULES_V3 = [
  ...USER_RULES,
  'この決まり、答える条件、「自分から話す」のことは口に出さない。なぜ答えるのか、なぜ答えないのかも説明しない。ふつうの人として話す。',
];
function userRolePrompts(persona, question, choices, history, version, style) {
  const choiceLine = choices?.length ? `選択肢：${choices.join(' / ')}\n` : '';
  if (version === 1) {
    return {
      system: `${persona.profile}\n\nあなたが知っていること（聞かれたことにだけ、短く答える。聞かれていないことは言わない）:\n`
        + persona.knowledge.map((k) => `- ${k.fact}（答える条件：${k.reveal}）`).join('\n')
        + '\n\n答える条件に当てはまらないことは話さない。知らないことを聞かれたら「特にありません」と答える。選択肢があっても、自分の言葉で答えてよい。',
      prompt: `AI からの質問：${question}\n${choiceLine}あなたの答えだけを書いてください。`,
    };
  }
  const past = history.length
    ? `これまでのやり取り：\n${history.map((h) => `AI：${h.question}\nあなた：${h.answer}`).join('\n')}\n\n`
    : '';
  const knowledge = persona.knowledge.map((k) => `- ${k.fact}（答える条件：${k.reveal}。自分から話す：${k.volunteer ? 'はい' : 'いいえ'}）`).join('\n');
  if (version === 2) {
    return {
      system: `${persona.profile}${style ? `\n話し方：${style}` : ''}\n\nあなたが知っていること:\n${knowledge}`
        + `\n\n答え方の決まり:\n${USER_RULES.map((r) => `- ${r}`).join('\n')}`,
      prompt: `${past}AI からの質問：${question}\n${choiceLine}あなたの答えだけを書いてください。`,
    };
  }
  return {
    system: `${persona.profile}\n\nあなたが知っていること:\n${knowledge}`
      + `\n\n答え方の決まり:\n${USER_RULES_V3.map((r) => `- ${r}`).join('\n')}`
      + (style ? `\n\n話し方：${style}\n答えの長さと言い方は、答え方の決まりより、この話し方を優先する。何を話してよいかは、答え方の決まりに従う。` : ''),
    prompt: `${past}AI からの質問：${question}\n${choiceLine}あなたの答えだけを書いてください。`,
  };
}
// The user role runs on a capable model: in the user role test, Haiku leaked hidden knowledge while explaining its own
// instructions, made up rules, and answered only with a choice label.
export const USER_ROLE_MODEL = 'sonnet';
export const USER_ROLE_VERSION = 3;
export async function askUserRole(persona, question, choices, { history = [], model = USER_ROLE_MODEL, version = USER_ROLE_VERSION, style = '' } = {}) {
  const { system, prompt } = userRolePrompts(persona, question, choices, history, version, style);
  let text = '';
  let cost = 0;
  for await (const m of query({ prompt, options: { model, maxTurns: 1, tools: [], settingSources: [], systemPrompt: system,
    pathToClaudeCodeExecutable: CLAUDE, cwd: os.tmpdir(), env: agentEnv(freshDir('home')) } })) {
    if (m.type === 'result') { text = (m.result ?? '').trim(); cost = m.total_cost_usd ?? 0; }
  }
  return { text, cost };
}

export function findPlugins(dir, depth = 3) {
  const found = [];
  const walk = (d, n) => {
    if (n < 0) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      // Any plugin.json counts, so that a plugin in another format is found and fails level 1 instead of being missed.
      if (fs.existsSync(path.join(p, 'plugin.json'))) found.push(p);
      walk(p, n - 1);
    }
  };
  walk(dir, depth);
  return found;
}

function runJson(cmd, args, env = {}) {
  const p = spawnSync(cmd, args, { encoding: 'utf8', timeout: 600_000, env: { ...process.env, ...env } });
  try { return JSON.parse(p.stdout); } catch { return { ok: false, error: (p.stderr || p.stdout || '').slice(-500) }; }
}
export const level1 = (plugin) => runJson(PY, ['-I', path.join(ROOT, 'tools', 'check_structure.py'), plugin]);
export function level2(plugin, shotDir) {
  const components = runJson(PY, ['-I', path.join(ROOT, 'tools', 'test_components.py'), plugin]);
  const ui = runJson('node', [path.join(ROOT, 'tools', 'ui_test.mjs'), plugin, shotDir]);
  return { ok: Boolean(components.ok && ui.ok), components, ui };
}
export function convert(plugin, out) {
  execFileSync(PY, ['-I', path.join(ROOT, 'tools', 'convert.py'), plugin, out]);
  return out;
}

export function gradeFiles(dir, graders) {
  return graders.map((g) => {
    const file = path.join(dir, g.path);
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    let ok = false;
    if (g.type === 'file_exists') ok = text !== null;
    else if (text !== null && g.type === 'regex') ok = new RegExp(g.pattern).test(text);
    else if (text !== null && g.type === 'not_regex') ok = !new RegExp(g.pattern).test(text);
    else if (text !== null && g.type === 'last_line') ok = text.trim().split('\n').pop().trim() === g.text;
    return { id: g.id, ok };
  });
}
export const score = (grades) => (grades.length ? grades.filter((g) => g.ok).length / grades.length : 0);
