# Claude Code 公式ベストプラクティスの抜粋（取得日 2026-10-20）

出典: https://code.claude.com/docs/en/best-practices（WebFetch で全文取得。下は原文の抜粋）

## Let Claude interview you（「インタビューさせる」公式の型）

> For larger features, have Claude interview you first. Start with a minimal prompt and ask Claude to interview you using the `AskUserQuestion` tool.
>
> Claude asks about things you might not have considered yet, including technical implementation, UI/UX, edge cases, and tradeoffs.

公式の例文（原文のまま）:

```text
I want to build [brief description]. Interview me in detail using the AskUserQuestion tool.

Ask about technical implementation, UI/UX, edge cases, concerns, and tradeoffs. Don't ask obvious questions, dig into the hard parts I might not have considered.

Keep interviewing until we've covered everything, then write a complete spec to SPEC.md.
```

> Once the spec is complete, start a fresh session to execute it. The new session has clean context focused entirely on implementation, and you have a written spec to reference.
>
> The most useful specs are self-contained: they name the files and interfaces involved, state what is out of scope, and end with an end-to-end verification step that proves the feature works.

## 文脈と長い対話（クリエイターの設計項目 6 に関係）

> Most best practices are based on one constraint: Claude's context window fills up fast, and performance degrades as it fills.

> When auto compaction triggers, Claude summarizes what matters most, including code patterns, file states, and key decisions

> Customize compaction behavior in CLAUDE.md with instructions like "When compacting, always preserve the full list of modified files and any test commands" to ensure critical context survives summarization

> If you've corrected Claude more than twice on the same issue in one session, the context is cluttered with failed approaches. Run `/clear` and start fresh with a more specific prompt that incorporates what you learned.

> If Claude asks you questions that are answered in CLAUDE.md, the phrasing might be ambiguous.

> If Claude keeps skipping one instruction, add emphasis such as "IMPORTANT" to that line alone. If you emphasize many lines, none of them stands out.

> Claude Code saves conversations locally, so when a task spans multiple sittings you don't have to re-explain the context. Run `claude --continue` to pick up where you left off, or `claude --resume` to choose from a list.

## AskUserQuestion の形（plugin-dev の参照資料）

出典: anthropics/claude-code `plugins/plugin-dev/skills/command-development/references/interactive-commands.md`（commit 49b8c35f, 2026-10-20）

- Users can always choose "Other" to provide custom input (automatic)
- Options should be 2-4 choices (not more)
- Can ask 1-4 questions per tool call
- header: Short label (max 12 chars)
