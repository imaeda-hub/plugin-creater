// Test of the user role itself: does it hold back, answer, abstain, keep context, not stop at a choice label,
// and keep quiet about its own instructions? With --style, also how the speaking style shows (length, re-asking).
// Usage: node test_user_role.mjs PERSONA_JSON model:version [model:version ...] [--style NAME]   e.g. haiku:1 sonnet:2 sonnet:3
import fs from 'node:fs';
import { askUserRole } from './lib.mjs';

const args = process.argv.slice(2);
const si = args.indexOf('--style');
const styleName = si < 0 ? 'normal' : args.splice(si, 2)[1];
const [personaPath, ...combos] = args;
const persona = JSON.parse(fs.readFileSync(personaPath, 'utf8'));
const style = persona.styles?.[styleName] ?? '';
const T = persona.userRoleTests;
const REPS = { generic: 5, recall: 2, unknown: 2, context: 3, options: 3, reask: 1, compound: 3 };
const REASK = 'もう少し具体的に教えてください。';
// Words from the user role's own instructions. A person would not say them.
const ARTIFACT = /答える条件|自分から話す|答え方の決まり|知っていること|聞かれているので|聞かれたので/;
const hidden = persona.knowledge.filter((k) => !k.volunteer).map((k) => k.id);

async function pool(jobs, size = 4) {
  const out = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < jobs.length) { const i = next++; out[i] = await jobs[i](); }
  }));
  return out;
}

const summary = [];
for (const combo of combos) {
  const [model, v] = combo.split(':');
  const version = Number(v);
  let cost = 0;
  const answers = [];
  const ask = async (q, choices = [], history = []) => {
    const r = await askUserRole(persona, q, choices, { model, version, history, style });
    cost += r.cost;
    answers.push(r.text);
    return r.text;
  };
  const jobs = [];
  const rec = { leak: [], recall: [], unknown: [], context: [], options: [], reask: [], compound: [] };
  for (const q of T.generic) for (let i = 0; i < REPS.generic; i++) {
    jobs.push(async () => {
      const a = await ask(q);
      const leaked = hidden.filter((id) => new RegExp(T.leakMarkers[id]).test(a));
      rec.leak.push({ q, a, leaked });
    });
  }
  for (const [id, { marker, questions }] of Object.entries(T.recall)) for (const q of questions) {
    for (let i = 0; i < REPS.recall; i++) {
      jobs.push(async () => { const a = await ask(q); rec.recall.push({ id, q, a, ok: new RegExp(marker).test(a) }); });
    }
    // Ask once, then ask for details: a vague speaker should answer on the second turn.
    for (let i = 0; i < REPS.reask; i++) {
      jobs.push(async () => {
        const a1 = await ask(q);
        const a = await ask(REASK, [], version === 1 ? [] : [{ question: q, answer: a1 }]);
        rec.reask.push({ id, q, a1, a, ok: new RegExp(marker).test(`${a1}\n${a}`) });
      });
    }
  }
  for (const q of T.unknown) for (let i = 0; i < REPS.unknown; i++) {
    jobs.push(async () => { const a = await ask(q); rec.unknown.push({ q, a, ok: new RegExp(T.abstain).test(a) }); });
  }
  for (const c of T.context) for (let i = 0; i < REPS.context; i++) {
    jobs.push(async () => {
      const history = [];
      let a = '';
      for (const q of c.turns) { a = await ask(q, [], version === 1 ? [] : history); history.push({ question: q, answer: a }); }
      rec.context.push({ turns: c.turns, a, ok: new RegExp(c.expect).test(a) });
    });
  }
  for (const o of T.options) for (let i = 0; i < REPS.options; i++) {
    jobs.push(async () => { const a = await ask(o.question, o.choices); rec.options.push({ q: o.question, a, ok: new RegExp(o.expect).test(a) }); });
  }
  // One question that names several topics, as the creator often asks: every named item should be answered.
  for (const c of T.compound ?? []) for (let i = 0; i < REPS.compound; i++) {
    jobs.push(async () => { const a = await ask(c.question); rec.compound.push({ q: c.question, a, ok: c.expect.every((e) => new RegExp(e).test(a)) }); });
  }
  await pool(jobs);
  const rate = (xs, f) => `${xs.filter(f).length}/${xs.length}`;
  const mean = (xs) => Math.round(xs.reduce((s, x) => s + x, 0) / (xs.length || 1));
  const row = {
    combo, persona: persona.id, style: styleName, cost: Number(cost.toFixed(4)),
    leak: rate(rec.leak, (r) => r.leaked.length > 0),
    leakByItem: Object.fromEntries(hidden.map((id) => [id, rec.leak.filter((r) => r.leaked.includes(id)).length])),
    recall: rate(rec.recall, (r) => r.ok),
    recallByItem: Object.fromEntries(Object.keys(T.recall).map((id) => [id, rate(rec.recall.filter((r) => r.id === id), (r) => r.ok)])),
    reask: rate(rec.reask, (r) => r.ok),
    abstain: rate(rec.unknown, (r) => r.ok),
    context: rate(rec.context, (r) => r.ok),
    options: rate(rec.options, (r) => r.ok),
    compound: rate(rec.compound, (r) => r.ok),
    artifact: rate(answers, (a) => ARTIFACT.test(a)),
    recallChars: mean(rec.recall.map((r) => r.a.length)),
  };
  summary.push(row);
  console.log(JSON.stringify(row));
  const show = (label, xs) => xs.slice(0, 3).forEach((x) => console.log(`  ${label}: Q=${x.q ?? x.turns?.at(-1)} A=${JSON.stringify(x.a).slice(0, 160)}`));
  show('leak', rec.leak.filter((r) => r.leaked.length));
  show('no-recall', rec.recall.filter((r) => !r.ok));
  show('no-reask', rec.reask.filter((r) => !r.ok));
  show('invented?', rec.unknown.filter((r) => !r.ok));
  show('context-miss', rec.context.filter((r) => !r.ok));
  show('option-only', rec.options.filter((r) => !r.ok));
  show('compound-miss', rec.compound.filter((r) => !r.ok));
  answers.filter((a) => ARTIFACT.test(a)).slice(0, 3).forEach((a) => console.log(`  artifact: A=${JSON.stringify(a).slice(0, 160)}`));
}
fs.writeFileSync(new URL(`../user-role-test-${persona.id}-${styleName}.json`, import.meta.url), JSON.stringify(summary, null, 2));
