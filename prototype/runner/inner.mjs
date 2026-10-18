// Inner EVAL: run a generated plugin (converted for Claude Code) on the persona's task, and operate its web
// dashboard in a browser the way a person would (settings -> start -> watch -> result). Compare with no plugin.
// Usage: node inner.mjs GENERATED_PLUGIN_DIR PERSONA_JSON [runs]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { askUserRole, convert, freshDir, gradeFiles, runAgent, score, sleep } from './lib.mjs';

async function driveDashboard(cwd, settings, shotDir, isDone, onStarted) {
  const seen = new Set();
  const phases = [];
  let url = null;
  const deadline = Date.now() + 15 * 60_000;
  while (!url && !isDone() && Date.now() < deadline) {
    try { url = JSON.parse(fs.readFileSync(path.join(cwd, '.dashboard.json'), 'utf8')).url; } catch { await sleep(500); }
  }
  if (!url) return { opened: false, seen: [], phases, result: '' };
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let result = '';
  try {
    await page.goto(url);
    await page.selectOption('#model', settings.model);
    await page.fill('#limit', String(settings.limit));
    await page.click('#start');
    onStarted();
    let shot = false;
    while (Date.now() < deadline) {
      const states = await page.$$eval('#agents li', (els) => els.map((e) => [e.dataset.agent, e.dataset.state]));
      states.forEach(([a, s]) => seen.add(`${a}:${s}`));
      const phase = await page.textContent('#phase');
      if (phases.at(-1) !== phase) phases.push(phase);
      if (!shot && states.some(([a, s]) => a !== '統括' && s === '実行中')) {
        await page.screenshot({ path: path.join(shotDir, 'inner-running.png'), fullPage: true });
        shot = true;
      }
      result = (await page.textContent('#result')).trim();
      if (result) break;
      if (isDone()) { await sleep(1500); result = (await page.textContent('#result')).trim(); break; }
      await sleep(300);
    }
    await page.screenshot({ path: path.join(shotDir, 'inner-result.png'), fullPage: true });
  } finally {
    await browser.close();
  }
  return { opened: true, seen: [...seen], phases, result };
}

async function innerRun(arm, pluginClaude, persona, model, shotDir) {
  const cwd = freshDir(`inner-${arm}`);
  for (const [name, content] of Object.entries(persona.inner.fixtures)) fs.writeFileSync(path.join(cwd, name), content);
  const rules = arm === 'with' ? fs.readFileSync(path.join(pluginClaude, '.eval', 'rules.md'), 'utf8') : '';
  let done = false;
  let browserStarted = false;
  const replies = [];
  const started = Date.now();
  const deliverable0 = persona.inner.graders.find((g) => g.type === 'file_exists').path;
  const options = {
    cwd, model, maxTurns: 80,
    plugins: arm === 'with' ? [pluginClaude] : [],
    // The dashboard must be reachable from the browser, so only its control script runs outside the sandbox.
    excludedCommands: arm === 'with' ? [`python3 ${pluginClaude}/skills/*/scripts/dashboard.py *`] : [],
    appendSystemPrompt: rules || undefined,
    onQuestion: async (qs) => {
      const answers = {};
      for (const q of qs) {
        answers[q.question] = (await askUserRole(persona, q.question, (q.options ?? []).map((o) => o.label))).text;
        replies.push({ via: 'AskUserQuestion', question: q.question, answer: answers[q.question] });
      }
      return answers;
    },
  };
  // The person using the plugin also replies in chat: when the agent ends its turn with a request or question,
  // the user role answers, saying that 開始 was pressed once the browser has pressed it.
  const agent = (async () => {
    let { record, last } = await runAgent({ prompt: persona.inner.prompt, ...options });
    for (let i = 0; i < 4 && !fs.existsSync(path.join(cwd, deliverable0)) && /[？?]|ください|お知らせ/.test((last?.result ?? '').slice(-200)); i++) {
      const { text } = await askUserRole(persona, last.result, []);
      const reply = (browserStarted ? 'Web管理画面で設定して「開始」を押しました。\n' : '') + text;
      replies.push({ via: 'chat', question: last.result.slice(-200), answer: reply });
      ({ record, last } = await runAgent({ prompt: reply, resume: record.sessionId, record, ...options }));
    }
    return { record };
  })().finally(() => { done = true; });
  const ui = arm === 'with'
    ? driveDashboard(cwd, persona.inner.settings, shotDir, () => done, () => { browserStarted = true; })
    : Promise.resolve(null);
  const [{ record }, dashboard] = await Promise.all([agent, ui]);
  try { process.kill(JSON.parse(fs.readFileSync(path.join(cwd, '.dashboard.json'), 'utf8')).pid); } catch { /* not started */ }

  const deliverable = gradeFiles(cwd, persona.inner.graders);
  const out = { arm, cwd, seconds: Math.round((Date.now() - started) / 1000), cost: record.agentCost, replies,
    deliverable, deliverableScore: score(deliverable), skills: record.tools.filter((t) => t.name === 'Skill').map((t) => t.input.skill),
    subagents: Object.entries(record.subagents).map(([id, type]) => ({ type, model: record.models[id] ?? null })), init: record.init };
  if (arm === 'with') {
    const has = (x) => dashboard.seen.includes(x);
    const s = persona.inner.settings;
    out.withOnly = [
      { id: 'skill-fired', ok: out.skills.some((k) => k.endsWith(path.basename(pluginClaude).replace(/-claude$/, ''))) || out.skills.length > 0 },
      { id: 'dashboard-opened', ok: dashboard.opened },
      { id: 'phases-shown', ok: ['計画', '作業', '検証'].every((p) => dashboard.phases.includes(p)) },
      { id: 'worker-shown-running', ok: has('worker:実行中') },
      { id: 'verifier-shown-running', ok: has('verifier:実行中') },
      { id: 'result-shows-settings', ok: dashboard.result.includes(`作業のモデル=${s.model}`) && dashboard.result.includes(`繰り返しの上限=${s.limit}`) },
      { id: 'worker-used', ok: out.subagents.some((a) => /worker/.test(a.type)) },
      { id: 'verifier-used', ok: out.subagents.some((a) => /verifier/.test(a.type)) },
    ];
    out.dashboard = dashboard;
  }
  return out;
}

export async function innerEval(pluginCopilot, persona, { runs = 1, model = 'sonnet', label = 'inner' } = {}) {
  const pluginClaude = convert(pluginCopilot, path.join(freshDir(`${label}-converted`), path.basename(pluginCopilot)));
  const shotDir = freshDir(`${label}-shots`);
  const arms = { with: [], without: [] };
  for (let i = 0; i < runs; i++) {
    arms.with.push(await innerRun('with', pluginClaude, persona, model, shotDir));
    arms.without.push(await innerRun('without', pluginClaude, persona, model, shotDir));
  }
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const withScore = mean(arms.with.map((r) => r.deliverableScore));
  const withoutScore = mean(arms.without.map((r) => r.deliverableScore));
  return { pluginClaude, shotDir, withScore, withoutScore, delta: withScore - withoutScore, arms };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [plugin, personaPath, runs] = process.argv.slice(2);
  const persona = JSON.parse(fs.readFileSync(personaPath, 'utf8'));
  const res = await innerEval(path.resolve(plugin), persona, { runs: Number(runs ?? 1) });
  console.log(JSON.stringify(res, null, 2));
}
