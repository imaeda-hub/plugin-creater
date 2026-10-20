# Kiro と OpenAI の公式ドキュメントの抜粋（取得日 2026-10-20）

WebFetch（小さなモデルによる要約を通す）で取得したもの。ツールの制約で長い逐語引用は返ってこない。括弧内は WebFetch が返した文言。逐語性は「要約を通した値」として扱うこと。

## Kiro（AWS）

### https://kiro.dev/docs/specs/ （Page updated: October 15, 2026）
- Feature Specs は Requirements-First と Design-First の2種類。`requirements.md` / `design.md` / `tasks.md`。
- 各段階に Review ボタン。"opens Markdown Review, where you can comment on exact passages and send your comments to Kiro at once."

### https://kiro.dev/docs/specs/feature-specs/ （Page updated: August 4, 2026）
- requirements.md は EARS 記法の "structured, testable requirements"。
- パターン: `WHEN [condition/event] THE SYSTEM SHALL [expected behavior]`
- 例: "WHEN a user submits a form with invalid data THE SYSTEM SHALL display validation errors next to the relevant fields"
- 要求から設計に進む前に **Analyze Requirements** を選べる（矛盾・あいまいさ・抜けの確認）。
- Quick Spec は "without approval gates between them"（段階ごとの承認なし）。
- 質問の手順についての記述は **見つからなかった**。

### https://kiro.dev/docs/specs/feature-specs/requirements-first/ （Page updated: September 25, 2026）
- 要求（requirements.md）の中身: user stories with acceptance criteria、EARS 形式の振る舞い、機能要求、エッジケースとエラー処理。
- Review: "Confirm when requirements meet your needs."
- clarifying questions への言及は **ない**。

### https://kiro.dev/docs/specs/best-practices/ （Page updated: September 25, 2026）
- "Kiro's Feature Specs are designed for continuous refinement"
- Analyze Requirements: "run a deep analysis that catches logical inconsistencies, ambiguities, conflicting constraints, and gaps." / "The analysis takes minutes (not seconds)"
- "For small or well-understood specs, you can skip it and proceed directly to design."
- 質問・あいまいな指示の扱いについての記述は **ない**。

### 2025-07-15 の公式ブログ（古い。2025年）https://kiro.dev/blog/from-chat-to-specs-deep-dive/
- Kiro "doesn't immediately start coding" / requirements.md → design.md → tasks.md の順 / 質問の手順の記述は **ない**。

## OpenAI

### Codex のベストプラクティス https://learn.chatgpt.com/guides/best-practices （旧 developers.openai.com/codex/learn/best-practices から 308 転送。日付表示なし）
- "If the task is complex, ambiguous, or hard to describe well, ask Codex to plan before it starts coding."
- "Plan mode lets Codex gather context, ask clarifying questions, and build a stronger plan before implementation." （`/plan` か Shift+Tab）
- "If you have a rough idea of what you want but aren't sure how to describe it well, ask Codex to question you first."
- "Think of `AGENTS.md` as an open-format README for agents."
- "The `/init` slash command in the CLI is the quick-start command to scaffold a starter `AGENTS.md` in the current directory."
- `/init` で作った AGENTS.md は短く保ち、同じ間違いに気づいてから規則を足すよう勧めている。

### GPT Builder / Custom GPTs
- help.openai.com と openai.com/index/introducing-gpts は **HTTP 403 で取得できなかった**（curl でも同じ。Cloudflare）。
- 検索結果の要約（二次情報・低確信）: 現行のヘルプは「conversational builder」と「configuration view」と書く／Custom GPTs は 2026-12-11 に終了予定で plugins/skills に移行する、と報じられている（visualstudiomagazine.com 2026-09-28 ほか。これも 403 で本文未確認）。
- 一次情報で確認できたこと: Agent Builder のガイド（https://developers.openai.com/api/docs/guides/agent-builder）に "OpenAI is deprecating Agent Builder." / "the product is scheduled to shut down on November 30, 2026." とある。キャンバス上でノードをつなぐ手作業の作り方のみで、質問して作る手順の記述はない。
