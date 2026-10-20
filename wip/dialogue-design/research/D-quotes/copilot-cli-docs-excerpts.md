# GitHub Copilot CLI 公式ドキュメントの抜粋（取得日 2026-10-20）

取得元はすべて docs.github.com。HTML を取得し、タグを除いたテキストから行を抜き出した（原文のまま）。変換前の HTML は D-web/ に置いた。

## 1. CLI command reference（https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference）
```text
1661: | /compact [FOCUS-INSTRUCTIONS] | Summarize the conversation history to reduce context window usage. Optionally provide focus instructions to steer the summary—for example, /compact focus on the auth module. See Managing context for GitHub Copilot.
1678: | /init | Initialize Copilot custom instructions and agentic features for this repository. See Project initialization for Copilot.
1692: | /plan [PROMPT] | Create an implementation plan before coding.
1710: | /resume [SESSION-ID], /continue [SESSION-ID] | Switch to a different session by choosing from a list (optionally specify a session ID).
1818: | --mode=MODE | Set the initial agent mode (choices: interactive, plan, autopilot). Combine with --plan (as --plan --mode autopilot) for plan-then-autopilot: the session starts in plan mode and automatically progresses to autopilot mode once the plan is ready, instead of waiting for a human to approve it. Any other --plan --mode MODE pairing is rejected.
1822: | --no-ask-user | Disable the ask_user tool (the agent works autonomously without asking questions).
1833: | --plan | Start in plan mode. Shorthand for --mode plan. Cannot be combined with --autopilot. Can be combined with --mode autopilot for plan-then-autopilot; any other --mode value is rejected.
1947: | ask_user | Ask the user a question
```

### Project initialization for Copilot（同ページ）
```text
Project initialization for Copilot

When you use the command copilot init, or the slash command /init within an interactive session, Copilot analyzes your codebase and writes or updates a .github/copilot-instructions.md file in the repository. This custom instructions file contains project-specific guidance that will improve future CLI sessions.

You will typically use copilot init, or /init, when you start a new project, or when you start using Copilot CLI in an existing repository.

The copilot-instructions.md file that's created or updated typically documents:

- Build, test, and lint commands.

- High-level architecture.

- Codebase-specific conventions.

If the file already exists, Copilot suggests improvements which you can choose to apply or reject.

```

### Plan mode（同ページ、Security 節）
```text
Plan mode

/plan starts a planning session where Copilot CLI can explore and analyze your codebase but is blocked from editing your project files. Specifically:

- Your project files are protected. Any attempt to edit, patch, or run a shell command that would change a file in your workspace is blocked automatically—this isn't just a suggestion to the model, it's enforced directly, so it doesn't depend on the model choosing to behave.

- The plan itself can still be written. Copilot needs somewhere to keep notes and draft the plan, so it's allowed to create and edit files in its own private planning workspace (including the plan file you'll review and approve).

- Delegated sub-tasks are protected too. If Copilot spins up a helper session to research part of your question, that helper inherits the same restrictions and can't edit your project either.

- It's a safety net, not a guarantee. This protection is designed to catch clear, direct attempts to change your files—it's not an airtight lockdown. Some things are intentionally allowed through so research isn't overly restricted: for example, shell commands whose effect can't be clearly determined in advance, and calls to external/MCP tools you've connected. In practice this is rarely an issue, but plan mode should be thought of as "changes require your review before applying," not an absolute guarantee that nothing on disk can change.

Once you're happy with the plan, approve it to exit plan mode and let Copilot make the actual changes.
```

## 2. Best practices for GitHub Copilot CLI（https://docs.github.com/en/copilot/how-tos/copilot-cli/cli-best-practices）
```text
2. Plan before you code

Plan mode

Models achieve higher success rates when given a concrete plan to follow. In plan mode, Copilot will create a structured implementation plan before any code is written.

Press Shift+Tab to toggle between normal mode and plan mode. In plan mode, all prompts you enter will trigger the plan workflow.

Alternatively, you can use the /plan command in normal mode to achieve the same effect.

Example prompt (from normal mode):

/plan Add OAuth2 authentication with Google and GitHub providers

What happens:

- Copilot analyzes your request and codebase.

- Asks clarifying questions to align on requirements and approach.

- Creates a structured implementation plan with checkboxes.

- Saves the plan to plan.md in your session folder.

- Waits for your approval before implementing.

You can press Ctrl+y to view and edit the plan in your default editor for Markdown files.
```

## 3. Using Autopilot mode（https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/use-autopilot-mode）
```text
Comparing Autopilot mode, --allow-all, and --no-ask-user

These controls affect separate aspects of how Copilot CLI works:

- Autopilot mode controls continuation. The agent can work through successive steps that require additional interactions with the AI model without waiting for another prompt.

- --allow-all, and its alias --yolo, control approvals. They allow the agent to use all tools, paths, and URLs without asking for permission, but do not enable autonomous continuation. In Interactive mode, the agent still stops when it needs further direction.

- --no-ask-user suppresses clarifying questions. The agent makes decisions instead of asking for input, but does not continue through successive model interactions unless Autopilot mode is also enabled.

During an interactive session, you can enable all permissions with /allow-all or /yolo.
```

## 4. GitHub Changelog 2026-01-21（WebFetch の要約。原文は https://github.blog/changelog/2026-01-21-github-copilot-cli-plan-before-you-build-steer-as-you-go/）
- plan mode gives you a collaborative planning experience before Copilot starts implementing.
- Copilot uses ask_user to pose follow-up questions, checks its assumptions about feature scope, and asks for input on design decisions.
- 注意: 要約ツールを通した二次的な取り出し。引用の逐語性は未確認。
