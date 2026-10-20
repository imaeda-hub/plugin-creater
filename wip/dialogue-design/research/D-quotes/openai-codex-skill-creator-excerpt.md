<!-- openai/codex @feadd944 (2026-10-20): codex-rs/skills/src/assets/samples/skill-creator/SKILL.md の 149-165 行 -->
## Create or Update a Skill

Adapt the work to the request. Creating a complex new skill may involve understanding realistic use cases, choosing supporting resources, initializing files, writing instructions, and validating the result. A narrow update to an existing skill may require only a focused edit and validation.

Ask clarifying questions only when the missing information matters and cannot be reasonably inferred. Respect a user-specified location; otherwise create discoverable skills in `$CODEX_HOME/skills`, or `~/.codex/skills` when `CODEX_HOME` is unset.

Keep automatic skill selection enabled unless the user explicitly requests an explicit-only skill. When the intended invocation mode is genuinely unclear and matters to the requested workflow, ask whether the user wants normal automatic discovery or explicit-only invocation; otherwise preserve the default. Do not infer explicit-only invocation from sensitive operations or required approvals: keep the skill discoverable and require authorization immediately before the actual mutation. Preserve an existing skill's invocation policy unless the user asks to change it.

For a new or substantially revised skill, consider the actual requests it should handle and which reusable resources would improve those tasks:

- A repeated PDF transformation may justify a `scripts/rotate_pdf.py` helper.
- An application-building workflow may benefit from an `assets/frontend-template/` starter.
- A data-analysis skill may need a `references/schema.md` guide to avoid rediscovering table relationships.

Create those resources only when their concrete benefit justifies them. If the user has already explained the task clearly, proceed without requesting additional examples.

### Naming

- Use lowercase letters, digits, and hyphens.
- Keep names under 64 characters and prefer short action-oriented names.
