<!-- BMAD-METHOD @61e01f82 (2026-10-18): skills/bmad-toolsmith/discover.md, canon.md (全文), ship.md -->
## discover.md
# Discover

Every new skill starts here. The outcome is a read-back the user approves before any file exists: what the skill is for, who uses it, what it produces and for whom, when it fires, what shape it takes and by which approach it gets built.

## Mine before you ask

Read what the user already gave you: the request, the conversation so far (tools used, the order of steps, corrections they made, inputs and outputs they showed), files or skills they pointed at. When the conversation itself is the workflow ("turn this into a skill"), most answers are in it. Ask only for the gaps.

## What you need to learn

One or two questions at a time, in whatever order the gaps call for, each with the answer you would infer so the user can just confirm. A user who arrives with a hardened idea or says they want to move fast gets a confirmation and a read-back, not an interview. Five things settle a skill: what it gets done and for whom (two purposes are two skills); who or what consumes the output and what must be true of it for them to act without this conversation in the room, the one line that sets every bar; the phrases a user would type to reach it and the nearby requests it must stay quiet on; what it runs on and where the know-how lives that a model would not already have (a runbook, an incident, a transcript of doing it by hand, the corrections the user keeps making); and whether the output can be checked objectively, which decides how much the build leans on evals. Ask too how it registers with BMad, with a guess from `uv run {skill-root}/scripts/registry.py --project-root {project-root}`, which lists the installed module records with their prefixes, whether `bmad` is set up, whether the project is a skills repository, and the skills already wired to BMad but registered nowhere: no `_bmad/` and nothing said about BMad, a plain skill outside the registry, which help and update checks never see; `_bmad/` present and a skill that reads config, maintains a project file, has a path a team would set, or that the user wants `bmad` to recommend, a single-skill module with its own record; a skills repository with a record, a module the user named, or a name carrying an installed module's prefix, a member of that module; several skills described, a new module. Say the guess and its one-line consequence. And ask where it will run, with the inferred answer offered: the user's own agent and model, an organisation whose harness and model are known, or distributed to people whose model is unknown. That last answer decides whether anything can be measured against the model in the room.

The shape surfaces on its own from those answers: a persona with a menu of things it does is an agent; a persona whose capabilities teams must change without forking is a rendered agent; memory across sessions is a memory agent; teams swapping steps without forking is a rendered skill; mostly deterministic work is a script-backed utility; shipping with other skills or needing its own config questions is a module. Each `shapes/<shape>/shape.md` says how to recognise that the conversation has reached it; do not offer the list.

Push back where the idea is thin: is this a skill at all or a one-off the user could ask for directly; a project convention, which belongs in the project's instructions file; a constraint a script could check, which belongs in a script; what input would break it; what it should require or recommend from the skills already installed. A skill whose job is to hold what the user would otherwise type every time, a format, a preference, a convention, a persona, is warranted by that alone; do not test whether the model can follow the instruction when given it, since nobody doubts that. Where the skill instead claims to teach the model something, the target model is fixed (the user's own, or their organisation's), and the user has not asked to move fast or run on their own, ask for one real input and run its trigger phrase alone, not the specification, through a subagent with no skill. If that already gives what the user wants, say so and propose no skill, or one for only the part it got wrong; if it fails, the trace is the first evidence of what the skill has to teach. For a distributed skill the model is unknown and the question belongs to a baseline eval on the user's cases, offered at ship. Offer what the outcome implies but nobody named: the sibling intent (update beside create), the input nobody mentioned. One line each; the user picks, and a decline is not re-proposed.

## The read-back

Present, and wait for a yes or changes:

- Name, kebab-case, asked rather than assumed, with a proposal. Suggest a prefix of the user's own, their org or module code (`acme-release-notes`), and say why in a line: it tells custom from core BMad at a glance in listings, logs and traces, and a module's skills then sort together. Do not propose `bmad-`; it belongs to modules shipped by the bmad-code-org, whose skills are `bmad-<code>-<skill>`, agents `bmad-<code>-agent-<name>`, the code dropped for core. A skill joining a module takes the module's prefix.
- One line on what it is for.
- The description draft, as it will ship, written to the canon's description rule: a five-to-eight-word summary, then `Use when` with the quoted phrases a user would type. For a skill only ever called by name, a one-line description with model invocation disabled where the host supports it.
- Shape, with one line on why the conversation landed there.
- Registration, one of: plain skill outside the registry; single-skill module, its own `bmod.toml` and `help/help.md`, visible to `bmad` setup, help and updates; member of `bmod-<code>`, its `bmod.toml` naming the record, whose skill list, help and, for an agent, roster change; first skill of a new module. One line on why.
- Approach, with one line on why: lean (default) when the user wants the skill; eval-first when the output is checkable and the user wants proof; the skill-creator loop when they want to iterate on measured results; scaffold when they will write it themselves.
- Where it will live, proposed from what is there rather than asked: `{workflow.skills_folder}/<name>` when that is set; inside the module it joins; else `skills/<name>` at `{project-root}` when that folder holds `*/SKILL.md` (a skill repo, whose source is what to edit); else the folder the user's agent reads skills from (`.agents/skills/`, `.claude/skills/` or the like, writing at the symlink's target when one links to the other), where it is live the moment it is written; else `~/.claude/skills/<name>` or `~/.agents/skills/<name>` when the skill is for the user everywhere or there is no project.
- The files it will have, one line each, and any script worth writing because the work is deterministic or would be rewritten every run.

Approval sets `{target}` and fixes the read-back; later files work from it, not from a re-asked user. The user can change it at any point afterwards; a change redoes only what it touches. Then load `approaches/<approach>.md`: `approaches/lean.md`, `approaches/eval-first.md`, `approaches/skill-creator-loop.md` or `approaches/scaffold.md`.

## canon.md
# Outcome-Driven Prompt Quality

Every line you write competes with the version of itself that was never written. State the destination, then make every remaining line survive the tests.

## Write the destination, not the route

Asked to build a prompt, you will script the path: phases, question banks, mandatory sections. It feels like diligence; it is the central defect. A script is your imagined transcript of one good session; real sessions diverge, and a model holding one spends its intelligence on compliance.

Write the destination instead. A goal-stated prompt holds five things: the **stance** (who the model is to the user), the **outcome** (what must exist), the **consumer** (who acts on it without the conversation in the room), the **bar** (what they need true of it), and the **non-inferables** (persona, posture, institutional knowledge, wiring, rules with consequences). Then stop; the outcome and its consumer imply the process. The consumer is the highest-leverage line: completeness, rigor and tone derive from it.

The shape in miniature, a complete facilitation skill:

```text
Act as the user's product-thinking partner: they hold the product knowledge;
you hold the craft of drawing it out, pressure-testing it, and structuring it.
You are not an interviewer with a form and not a ghostwriter.

The outcome is a PRD at {output_folder}/prd.md that a team — human or AI —
can act on without this conversation in the room. That consumer sets the bar:
every requirement traceable to a need and stated so someone could test whether
it was met; scope edges explicit, including what is out; open questions named
as open rather than papered over.

Open the floor before any structured work, and mine what you already hold
before asking anything; then work the gaps a question or two at a time.
Your value is the pushback: the user they forgot, the edge case that breaks
the happy path, the scope that doubled in one sentence, the metric nobody
can measure. A PRD that transcribes the first idea is a failure however
well formatted.

Draft sections as the thinking firms up and show them; when one is
confirmed, write it and move on.
```

A script would subtract adaptivity: a user with a full brief gets gap analysis, not a question bank.

When a line exists because of a failure you saw, decide what kind of failure it was before writing the line, since each kind takes a different form. A rule the model skipped takes the rule with its reason. Output in the wrong shape takes a contract that says what the output is. A piece left out takes a slot in the template where it goes. A wrong move under some condition takes that condition, stated as something the model can observe. A fix in the wrong form patches nothing.

## The tests

They apply to every file a model reads: the entry, each reference, each route or capability file, each template whose text a model will read. A skill judged by its entry alone has most of its text unjudged.

1. **The core test.** Would a capable model do this correctly without being told? If yes, cut. A line earns its place only by preventing a failure. It stays when you can name the different action the model takes without it.
2. **Truncate before you delete.** Most long lines hide a needed nudge wrapped in explanation. Keep the instruction and the one clause of why.
3. **Keep the why behind a non-obvious goal.** Without its reason a rule cannot reach the case you did not foresee. A stripped why is under-writing, not leanness.
4. **Write what survives as a goal.** State intent and let the model find the path. Exact procedure only where a wrong move costs something.
5. **Number only true sequences.** Numbering says order matters, so the model marches. Number steps that feed each other; bullet independent ones; steps that were never separate are one goal sentence.
6. **Carve by relevance, not size.** The entry is paid on every invocation; a reference only when its branch fires. Carve what only some branches need and keep a routing map in the entry; leave what is too small to repay the indirection. A small skill is one file; a reference exists only when a branch has earned it. The budget is for what one run loads, not for the skill as a whole: a complex workflow is the right size when each branch sits in its own file and loads only when reached, whatever the total comes to. A carved file stands alone, because the entry can drop from context, and references stay one level deep.
7. **Close every step on a condition the model can check.** A step that ends on "once it is clear" or "when ready" lets the model declare itself done early. Name what has to be true at the end, covering everything the step touched, and make it something the model can verify from what is in front of it.
8. **An example earns its place only by fixing a shape.** A format line beats a worked artifact. Delete the example and run the rule alone on a fresh model: if the output conforms, the example was explanation; if it diverges in a way one more clause cannot fix, keep the smallest fragment that shows the divergence, beside the rule it fixes. General knowledge, such as what a good bug report looks like, needs no example. Where the project will hold its own instances after the first run, point at those rather than ship a sample.

## Explain the why, not the MUST

ALL-CAPS MUST, ALWAYS and NEVER mean the prompt is patching a symptom the author once saw. A model braces against a command and applies it literally; a rule with its reason survives the case the author did not foresee. Write the failure the rule prevents, once.

Say what to do rather than what to avoid. A sentence about the wrong behaviour puts that behaviour in front of the model; a sentence about the right one leaves it out. Keep a prohibition only where no positive form says the same thing, and put the right behaviour beside it.

## Use words the model already holds

A term the model met in training arrives with its meaning attached: idempotent, read-back, dry run. Choose it over a coined term, which costs its definition on every use, and over a run of adjectives that circle it. Having chosen the word, reuse it as it is; each paraphrase spends tokens and loosens the meaning. A term only this skill uses is a sign the plain word was not looked for.

## The description is the trigger

The description is all the model sees when deciding whether to load the skill, so it is the whole trigger, and every character of it is paid on every session whether the skill fires or not. Two parts: a five-to-eight-word summary of what the skill does, in the third person, then `Use when the user says 'phrase' or 'phrase'.` with the quoted phrases a user types. Most BMad skills are asked for explicitly, so default to those phrases; describe a context ("when code imports the anthropic SDK") only for a skill that must fire unasked. Anchors beat adjectives: file types, tool names, artifact names. Each phrase covers a different situation; two wordings of one situation are one phrase. Name the user's problem rather than a tool's symptom, unless the skill is about that tool. Add `Not for ...`, naming the sibling skill, only when a trigger eval or a known sibling shows the skill taking its neighbour's requests. An agent's `Use when` opens with the user asking to talk to it by name, then carries the phrases and concepts of every capability that lives inside it, because the agent's description is the only trigger those capabilities have; a menu item that invokes an installed skill needs none, since that skill triggers itself. The summary stays short; the phrase list grows with the agent's internal capabilities and is not cut to a length. 1024 characters is the ceiling the validator enforces, never a target. All "when to use" lives here, none in the body, which is read only after the choice. A description that explains the procedure lets the model skip the body and improvise. A skill only ever invoked by its name, as a slash command, needs no trigger at all: where the host honours `disable-model-invocation: true`, set it and let the description be one line for the human.

## Who reads this

Your reader is a model whose whole world is what you wrote. Every test asks: does the line change how it acts or judges? Cut meta-explanation, negative space, restated facts, and mechanics belonging in the file that performs them. A point made in two places is the surest sign the text was never run against real input; keep it in the one place it belongs. What the model can find by looking, a file's contents, a command's help, a flag, stays in the environment, where it cannot go stale. The skill carries what looking does not reveal: the convention nobody wrote down, the reason behind a choice, the trap a config file does not confess.

## The two-version comparison

You cannot judge structure from inside one run. Write the smallest version, around five lines: role, outcome, consumer, and any rule whose absence has done damage. Run both on the same input.

| What you see | What it means |
| --- | --- |
| Small one wins | The structure was a straitjacket. Cut it. |
| They tie | The structure is decoration. Defend each line or kill it. |
| Small one rougher but recoverable in a turn or two | You bought convenience, not quality. Allowed, if you are honest about it. |
| Small one materially worse and stays worse | The structure earned its keep, for now. |

Cheaper signals: one input five times (identical means over-determined, scattered means under-specified); different inputs (alike outputs mean the template out-shouts the input); steps marched in order.

## The deeper floor

Below your small version sits the bare model, and it rises with every release. What survives is what the model cannot do for itself: paths, downstream contracts, wiring between systems, knowledge that lives nowhere else. When a capability stops beating the bare model, retire it.

## The habit

For each section: what single outcome do you want? What does the model already know there, usually most of it? What does it need that it cannot infer: persona, posture, wiring, schemas, rules with consequences? Whatever remains is structure you impose; if you cannot say what it buys, it is over-structure.

## ship.md
# Ship

The tail every build and every file-writing mode ends with. Its outcome: the skill at `{target}` has been through the lenses and improved from them, is valid, installable, measured for cost, offered a trigger eval, and the user knows where it is and what to do next.

`{target}` is the skill folder, or the module folder after package or migrate: then the per-skill checks and the cost run for each member skill, and the manifest check for the record. `{reports_folder}` was set at activation; if this session no longer holds it, run that step again.

## Manifest

The pre-pass reports `bmod_kind`. It must match the read-back's registration line: `skill` for a member, `record+skill` for a single-skill module, `none` for a plain skill. A mismatch is fixed here, not noted: write the missing `bmod.toml`, help and record edits from the shape the line names, `shapes/single-skill-module/shape.md` or `shapes/multi-skill-module/shape.md`. `ecosystem.md` fills the dependency lists below. Never write `module.yaml`, `module-help.csv` or a setup skill; those are the old format.

## Refine

For a skill Smithy wrote or rewrote this session (a build, a conversion), not a scaffold with `[TODO:` markers and not a skill the user owns after edit, package or migrate, where the review is offered instead. Copy `{target}` to `{reports_folder}/<YYYYMMDD-HHMMSS>-<skill>-before/` as the old version, then `uv run {skill-root}/scripts/prepass.py {target}`, then one subagent per lens in parallel: `lenses/lens-architecture.md`, `lenses/lens-determinism.md`, `lenses/lens-leanness.md`, `lenses/lens-customization.md`, `lenses/lens-trigger.md`, each given the pre-pass JSON, `{target}`, its lens file, `lenses/lens-contract.md` and `lenses/standards.md`. Inline, one at a time, when subagents are unavailable; say so.

Apply what is a defect against the standards or the canon's tests: a path that does not resolve, a description without its `Use when` or past its two parts, a declared customization value the body never reads, prose doing a script's work, a line a capable model follows unasked. Apply every leanness finding too, its `proposed_smallest` included: the lean version is the default, and the check below guards it. Leave what is a judgment call: a persona line, a split into two skills. Never apply a finding that undoes the approved read-back (name, purpose, shape, location) without asking. When a high or critical finding was fixed, run the lenses once more; stop after two rounds. Then run `uv run {skill-root}/scripts/cut_check.py <copy> {target}` and restore, from the copy, each item under `lost` that no finding meant to remove. One subagent per changed prose file runs the Checker from `modes/cut-roles.md`, with what the read-back fixed as its protected passages; restore each loss and meaning change it lists as the shortest sentence that states it. Last, say in chat what changed, by file in one line each, the tokens before and after from `count_tokens.py` on the copy and on `{target}`, and what was left for the user with its why.

## Checks

Run and fix until clean; after three failed fixes on one finding, stop and show it.

- `uv run {skill-root}/scripts/init_skill.py --check {target}` (`--any-name` outside the BMAD-METHOD repo)
- `uv run {skill-root}/scripts/scan_paths.py {target}`
- `uv run {skill-root}/scripts/scan_scripts.py {target}` and the skill's tests, when it has scripts
- `uv run {project-root}/_bmad/scripts/validate_manifests.py --project-root <repo root>` in a repository with `skills/*/bmod.toml`

`modes/validate.md` says what each covers; it is not needed here.

## Cost

`uv run {skill-root}/scripts/count_tokens.py {target}`. Tell the user what `SKILL.md` costs per load and how long the description is; the description is paid on every session whether the skill fires or not. Over about 800 tokens in a plain skill's `SKILL.md`, or 1,200 in an agent's, name what could move to a reference; the measure is what a run loads, not the skill's total. A description past its two parts, or with a phrase that is not an anchor, names what to cut.

## Trigger eval

Offer it once; run it on a yes. If `{target}/evals/triggers.json` is absent, write it from the discovery: 8 to 10 queries that should fire, varied in wording and buried in larger requests, and 8 to 10 near misses that share vocabulary but should not. Then invoke the `bmad-eval` skill in trigger mode on `{target}`. When the description is revised from failures, change its contexts and anchors, never paste a failed query's words into it.

## Dependencies and install

Load `ecosystem.md`: it settles what the skill requires or recommends, writes that into `bmod.toml`, and gives the install command for anything missing.

## Handoff

Tell the user: where the skill is; that it is live now when it was written where their agent reads skills (the skills CLI will not track it, so updates are theirs to make), or how to make it live otherwise (a symlink into that folder, or `npx skills add <repo> --skill <name>` once it is pushed); one request to try first; how it is registered: for its own record, ask `bmad setup <code>`, which creates the module's scripts folder and asks its questions; for a member, the record files that changed; for a plain skill, once, that `bmad` help, setup and update checks will not see it. Offer, not run: a review (`modes/review.md`) and a baseline eval with the `bmad-eval` skill, which measures the skill against the bare model on the user's own cases; this is where that question is answered, with numbers rather than one run, and for a skill that will be distributed it is the only place it can be.
