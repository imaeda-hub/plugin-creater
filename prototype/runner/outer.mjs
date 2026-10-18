// Outer EVAL: run the creator (converted for Claude Code) against a user role that answers from a persona's
// knowledge, then grade the generated plugin with levels 1 and 2, the knowledge it embeds, and the inner EVAL.
// Usage: node outer.mjs CREATOR_DIR PERSONA_JSON [runs]
import fs from 'node:fs';
import path from 'node:path';
import { askUserRole, convert, findPlugins, freshDir, level1, level2, runAgent, score } from './lib.mjs';
import { innerEval } from './inner.mjs';

function knowledgeGrades(plugin, persona) {
  const skills = path.join(plugin, 'skills');
  const text = fs.existsSync(skills)
    ? fs.readdirSync(skills).map((d) => path.join(skills, d, 'SKILL.md')).filter((p) => fs.existsSync(p)).map((p) => fs.readFileSync(p, 'utf8')).join('\n')
    : '';
  return Object.entries(persona.markers).map(([id, patterns]) => ({ id: `knowledge-${id}`, ok: patterns.every((p) => new RegExp(p).test(text)) }));
}

async function outerRun(arm, creatorClaude, persona, model) {
  const cwd = freshDir(`outer-${arm}`);
  const transcript = [];
  let userCost = 0;
  const onQuestion = async (questions) => {
    const answers = {};
    for (const q of questions) {
      const { text, cost } = await askUserRole(persona, q.question, (q.options ?? []).map((o) => o.label));
      userCost += cost;
      answers[q.question] = text;
      transcript.push({ via: 'AskUserQuestion', question: q.question, answer: text });
    }
    return answers;
  };
  const started = Date.now();
  let { record, last } = await runAgent({ prompt: persona.request, cwd, model, maxTurns: 60,
    plugins: arm === 'with' ? [creatorClaude] : [], onQuestion });
  // When the agent asks in plain text and ends its turn, the user role replies and the session continues.
  for (let i = 0; i < 6 && findPlugins(cwd).length === 0 && /[？?]\s*$/.test(last?.result ?? ''); i++) {
    const { text, cost } = await askUserRole(persona, last.result, []);
    userCost += cost;
    transcript.push({ via: 'text', question: last.result.slice(-300), answer: text });
    ({ record, last } = await runAgent({ prompt: text, cwd, model, maxTurns: 60, resume: record.sessionId, record,
      plugins: arm === 'with' ? [creatorClaude] : [], onQuestion }));
  }

  const plugins = findPlugins(cwd);
  const out = { arm, cwd, seconds: Math.round((Date.now() - started) / 1000), agentCost: record.agentCost, userCost,
    questions: transcript, skills: record.tools.filter((t) => t.name === 'Skill').map((t) => t.input.skill),
    generated: plugins, init: record.init, results: record.results };
  if (plugins.length !== 1) {
    out.grades = [{ id: 'one-plugin-generated', ok: false }];
    return out;
  }
  const plugin = plugins[0];
  out.level1 = level1(plugin);
  out.level2 = out.level1.ok ? level2(plugin, freshDir(`outer-${arm}-shots`)) : { ok: false, skipped: 'level 1 failed' };
  out.inner = out.level1.ok ? await innerEval(plugin, persona, { label: `inner-of-${arm}` }) : null;
  out.grades = [
    { id: 'one-plugin-generated', ok: true },
    { id: 'level1', ok: Boolean(out.level1.ok) },
    { id: 'level2', ok: Boolean(out.level2.ok) },
    ...knowledgeGrades(plugin, persona),
    { id: 'inner-deliverable', ok: out.inner ? out.inner.withScore === 1 : false },
  ];
  if (arm === 'with') out.withOnly = [{ id: 'creator-skill-fired', ok: out.skills.some((s) => s.includes('make-plugin')) }];
  return out;
}

const [creator, personaPath, runs] = process.argv.slice(2);
const persona = JSON.parse(fs.readFileSync(personaPath, 'utf8'));
const creatorClaude = convert(path.resolve(creator), path.join(freshDir('creator-converted'), 'proto-creator'));
const report = { persona: persona.id, arms: { with: [], without: [] } };
for (let i = 0; i < Number(runs ?? 1); i++) {
  for (const arm of ['with', 'without']) {
    const r = await outerRun(arm, creatorClaude, persona, 'sonnet');
    r.score = score(r.grades);
    report.arms[arm].push(r);
    console.error(`[outer ${arm}] score=${r.score.toFixed(2)} ${r.grades.map((g) => `${g.id}:${g.ok ? 'o' : 'x'}`).join(' ')}`);
  }
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
report.withScore = mean(report.arms.with.map((r) => r.score));
report.withoutScore = mean(report.arms.without.map((r) => r.score));
report.delta = report.withScore - report.withoutScore;
const file = path.join(freshDir('report'), 'outer-report.json');
fs.writeFileSync(file, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: file, withScore: report.withScore, withoutScore: report.withoutScore, delta: report.delta }));
