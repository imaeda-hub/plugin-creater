# E. 長い聞き取りをいろいろなモデルに守らせる：スキルの書き方と状態の残し方（各社の公式指針）

調査担当：E（プロンプト／コンテキストエンジニアリング）。取得日はすべて 2026-10-20。

## 0. 調べ方と読み方の注意

- 取得方法：公式ページは `curl`（エージェント用プロキシ経由）で HTML を取り、本文テキストに変換して原文を確かめた（作業用ファイルは `/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/E-raw/`）。WebFetch の要約は引用の根拠にしていない（原文との突き合わせに使っただけ）。WebSearch は出典を探すために使い、検索結果の要約は二次情報として扱った。
- 実際にモデルを動かした実験は **していない**。以下の主張はすべて、文書・論文・パッケージの文字列を読んだ結果である。
- Copilot CLI 1.0.98 のパッケージの中身（システムプロンプトやツール定義の文字列）は、別の担当が取り出した次のファイルを私が読んで確かめた。私が再取得したものではない。モデルごとに内容が違う可能性があるので、「要確認」を付ける。
  - `/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/cli/runtime.strings`（`@github/copilot` 1.0.98 の実行ファイルから抽出した文字列。以下「1.0.98 の runtime 文字列」）
  - `.../research/cli/captures/i1-gpt41-tui.system.txt` と `i1-gpt41-tui.tools.json`（CLI 1.0.98 が gpt-4.1 を指定して送った実際の要求の記録。以下「1.0.98 の送信記録」）
- 「一次」＝公式ドキュメント・公式リポジトリ・論文本文・パッケージの中身。「二次」＝ブログ・検索結果の要約。
- 「示唆」は私の考察であり、出典が言っていることではない。引用とは分けて書く。
- 日付のない公式ページは「日付表示なし」と書く。2024年以前の情報には「古い」を付ける。

## 1. 要点（先に結論）

1. **各社がそろって言っていること**：スキル本体は短く（500行／約5,000トークン以内）、詳細は別ファイルに分けて「いつ読むか」を書く。複数段階の手順は、番号付きの手順とチェックリストで書く。壊れやすい決まった処理はスクリプトと検証に任せる。
2. **長い作業の状態は、会話の外のファイルに残す**（Anthropic、OpenAI、GitHub が共通）。会話の圧縮は、細部を落とす要約である（GitHub の文書にも「細部は失われる」とある）。圧縮の後に手順と途中の結果を保つ公式の勧めは「ファイルに書いておき、始めに読み直す」である。
3. **スキル本文が圧縮の後も残るかは、基盤によって違う**。Claude Code は各スキルの先頭 5,000 トークンまでを入れ直す。agentskills.io は「ハーネスは圧縮からスキルを守れ」と勧める。Copilot CLI は更新履歴に「Skills remain effective after conversation history is compacted」（0.0.399）とだけあり、文書に仕組みの説明がない。1.0.98 の runtime 文字列には「使ったスキルは、保持されていなければ再度有効にせよ」という文があった。**スキルの先頭に最重要の規則を置き、再読込の手順を書く**必要がある。
4. **「質問するか進めるか」の既定の癖は、モデルごとに逆向き**。OpenAI の GPT-5.1 は「行動に偏れ」（GPT-5 は聞かせない向きと控えさせる向きの両方の文例を載せる）、GPT-6 Astra は「質問して止まりやすい」。Anthropic の最新 Claude は「実質的に違う読み方がある時だけ聞け」で、Sonnet 5.5 と Haiku 5.5 は低い effort で途中で止まって確認しやすい。Copilot CLI 自身のシステムプロンプトにも「Be extremely biased for action」と、自律モードの「Decide; don't ask」がある。**聞き取りスキルは「質問することが仕事であり、先へ進む前にユーザーの答えを待つ」と明示的に宣言し、ホストの指示より優先させる書き方が要る**。
5. **質問のツール**：Claude の AskUserQuestion は1回に1〜4問・各2〜4択・自由入力あり・サブエージェントでは使えない。Copilot CLI の ask_user は1.0.98 でフォーム（複数項目、選択肢＋自由回答）で、`--no-ask-user` と自律モード（autopilot）では使えないか、自動で答えが入る。**質問のツールが使えない場合の代替の書き方が要る**。
6. **長い会話で指示が守られなくなることは、研究で確かめられている**（Lost in Conversation：複数回のやり取りで平均 39% 低下、など）。緩和は「繰り返しの確認（recap／reinstruct）」と「状態を明示的に持たせる」（SKILL.state）。ただし OpenAI は GPT-5.6 で「同じ指示を繰り返すと不要な確認が増える」と言い、**繰り返しは「全面の復唱」でなく「状態に基づく要所の再確認」にするのが両立する書き方**（考察）。
7. **費用の低いモデル**：Anthropic は「Haiku には Opus より詳しい指示が要る。使う全モデルで試せ」と明記。SkillsBench は「3モジュール以内の絞ったスキルが、網羅的なものより良く、小さいモデル＋スキルが大きいモデル単独に並ぶ」。Skill-Use は「手順を途中までしか守らないと、スキルなしより悪い」と報告する。**途中で半端に終わらない小さな手順に分け、状態の更新をスクリプトで検証させる**のが共通の方向。

## 2. 出典別の整理

### A. スキルの書き方（公式の指針）

#### A1. Anthropic「Skill authoring best practices」
- URL：https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices （一次。日付表示なし。対象：Claude Skills。Haiku／Sonnet／Opus での検証を勧める）
- 何と言っているか（原文）：
  - 「文脈は共有財産」：`The context window is a public good.`
  - 長さ：`Keep SKILL.md body under 500 lines for optimal performance`
  - 自由度の決め方：`Match the level of specificity to the task's fragility and variability.` 低い自由度（決まった手順）にするのは `Operations are fragile and error-prone` / `Consistency is critical` / `A specific sequence must be followed` のとき。
  - モデルごと：`Test your Skill with all the models you plan to use it with.` / `What works perfectly for Opus might need more detail for Haiku.` / 確認項目に `Claude Haiku (fast, economical): Does the Skill provide enough guidance?`
  - 複数段階の手順：`For particularly complex workflows, provide a checklist that Claude can copy into its response and check off as it progresses.` / `Clear steps prevent Claude from skipping critical validation. The checklist helps both Claude and you track progress through multistep workflows.`
  - 検証の輪：`Common pattern: Run validator → fix errors → repeat` / `This pattern greatly improves output quality.` / 「計画→検証→実行」：`Make validation scripts verbose with specific error messages`（使える値の一覧まで返す例）
  - 参照ファイル：`Keep references one level deep from SKILL.md.`（深い参照では `Claude might use commands like head -100 to preview content rather than reading entire files` と、途中までしか読まれない）
  - スクリプト：`Even if Claude could write a script, pre-made scripts offer advantages:` に続けて `More reliable than generated code` / `Save tokens` / `Ensure consistency across uses`
  - 選択肢：`Don't present multiple approaches unless necessary` ／ 既定を示して逃げ道を添える。
  - 用語：`Choose one term and use it throughout the Skill` / `Consistency helps Claude parse and follow instructions.`
  - 出力の型：厳格なら `ALWAYS use this exact template structure:`、柔軟なら `Here is a sensible default format, but use your best judgment`
  - 評価を先に：`Create evaluations BEFORE writing extensive documentation.`
  - 強い言葉：Claude A（作る側）が、Claude B が規則を忘れたときの直し方として `using stronger language such as "MUST filter" instead of "always filter,"` を挙げる（A8 と緊張関係。第3章）。
- 示唆（考察）：
  - 聞き取りの「質問の中身」は自由度が高く、「状態の更新・網羅の確認・生成前の関門」は自由度を低くしてスクリプトに寄せる、と分けられる。
  - 「チェックリストを応答にコピーして進める」は、会話が圧縮されると消える。クリエイターではチェックリストの本体をファイルに置き、会話には写しを出す形にする。
  - 「全モデルで試せ」は、外側の EVAL（ユーザー役の AI で模擬）を、安いモデルを含む複数モデルで回す根拠になる。

#### A2. agentskills.io「Specification」
- URL：https://agentskills.io/specification （一次。日付表示なし。対象：Agent Skills 標準。GitHub・OpenAI・Anthropic が採用）
- 何と言っているか（原文）：
  - `Instructions (< 5000 tokens recommended): The full SKILL.md body is loaded when the skill is activated`
  - `Keep your main SKILL.md under 500 lines. Move detailed reference material to separate files.`
  - `Keep file references one level deep from SKILL.md. Avoid deeply nested reference chains.`
  - `Note that the agent will load this entire file once it's decided to activate a skill.`
  - 本文：`There are no format restrictions. Write whatever helps agents perform the task effectively.`（推奨：手順、入出力の例、よくある例外）
- 示唆：SKILL.md の本文は「約5,000トークン以内」を設計の上限にできる（Claude Code の圧縮後の再投入の上限とも一致。A7）。

#### A3. agentskills.io「Best practices for skill creators」
- URL：https://agentskills.io/skill-creation/best-practices.md （一次。日付表示なし）
- 何と言っているか（原文）：
  - クリエイターの前提そのもの：`A common pitfall in skill creation is asking an LLM to generate a skill without providing domain-specific context — relying solely on the LLM's general training knowledge. The result is vague, generic procedures ("handle errors appropriately," "follow best practices for authentication")`
  - 詳しすぎるのも害：`Overly comprehensive skills can hurt more than they help — the agent struggles to extract what's relevant and may pursue unproductive paths triggered by instructions that don't apply to the current task.`
  - 理由を書く：`For flexible instructions, explaining why can be more effective than rigid directives`
  - 既定を示す：`Provide defaults, not menus.`
  - チェックリスト：`An explicit checklist helps the agent track progress and avoid skipping steps, especially when steps have dependencies or validation gates.`
  - 型（テンプレート）：`This is more reliable than describing the format in prose, because agents pattern-match well against concrete structures.`
  - 落とし穴の置き場：`Keep gotchas in SKILL.md where the agent reads them before encountering the situation.`
  - 参照の読ませ方：`The key is telling the agent when to load each file.`
  - 検証の輪と「計画→検証→実行」：`Instruct the agent to validate its own work before moving on.`
  - 試行の見方：`Read agent execution traces, not just final outputs.`
  - 繰り返す処理：`If you notice the agent independently reinventing the same logic each run ... that's a signal to write a tested script once and bundle it in scripts/.`
- 示唆：「ユーザーの実際の仕事から取り出す」（`Extract from a hands-on task`）は、ファイルを読んで決まりを推し量る（REQ-017）の公式の裏づけになる。「実行の記録を読む」は、どの質問が効いたかの記録（REQ-049）の根拠になる。

#### A4. agentskills.io「How to add skills support to your agent」（実装する側への指針）
- URL：https://agentskills.io/client-implementation/adding-skills-support.md （一次。日付表示なし）
- 何と言っているか（原文）：`If your agent truncates or summarizes older messages when the context window fills up, exempt skill content from pruning. Skill instructions are durable behavioral guidance — losing them mid-conversation silently degrades the agent's performance without any visible error.`
- 示唆：これは**ハーネス側への勧め**で、守られている保証ではない。Copilot CLI が守っているかは A5／B8 の通り不明な点が残る。スキル側の防御（先頭に重要事項、再読込の手順）が要る。

#### A5. GitHub Docs「About agent skills」「Adding agent skills for GitHub Copilot CLI」
- URL：https://docs.github.com/en/copilot/concepts/agents/about-agent-skills 、https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-skills （一次。日付表示なし。対象：Copilot CLI など）
- 何と言っているか（原文）：
  - `When Copilot chooses to use a skill, the SKILL.md file will be injected in the agent's context, giving the agent access to your instructions.`
  - `When a skill is invoked, Copilot automatically discovers all of the files in the skill's directory and makes them available alongside the skill's instructions.`
  - `In the Markdown body of SKILL.md, describe when and how to run the script.`
  - `We recommend using custom instructions for simple instructions relevant to almost every task ..., and skills for more detailed instructions that Copilot should only access when relevant.`
  - 例は番号付きの短い手順（5項目）のみ。
- 見つからなかったこと：長い手順の書き方、長さの目安、圧縮の後にスキル本文が残るか、の記述は **GitHub の文書には見つからなかった**（上の2ページ全文を確認）。
- 示唆：Copilot 向けの書き方の勧めは、実質 agentskills.io と Anthropic の文書に頼ることになる。

#### A6. OpenAI「Build skills」（ChatGPT／Codex）
- URL：https://developers.openai.com/codex/skills （一次。日付表示なし。対象：ChatGPT と Codex。ページに GPT-6.1 Sol のモデル選択が見える）
- 何と言っているか（原文）：
  - `Keep each skill focused on one job.` / `Prefer instructions over scripts unless you need deterministic behavior or external tooling.` / `Write imperative steps with explicit inputs and outputs.` / `Test prompts against the skill description to confirm the right trigger behavior.`
  - `Front-load the key use case and trigger words so a host can still match the skill if descriptions are shortened.`（Codex は説明文の一覧に文脈の 2%（不明なら 8,000 文字）までの予算を使い、足りないと説明を縮める）
  - 作成の聞き取り：`The creator asks what the skill does, when it should trigger, and whether it should stay instruction-only or include scripts. Instruction-only is the default.`
- 示唆：「スクリプトより指示を既定にし、決まった動きが要る所だけスクリプトにする」は、Anthropic の「壊れやすい所は低い自由度」と整合する。クリエイターの状態更新はまさに「決まった動きが要る所」。

#### A7. Anthropic（Claude Code）「Skills」の運用の説明
- URL：https://code.claude.com/docs/en/skills 、https://code.claude.com/docs/en/context-window （一次。日付表示なし。Claude Code v2.1.198〜v2.1.304 への言及がある）
- 何と言っているか（原文）：
  - `Claude Code does not re-read the skill file on later turns, so write guidance that should apply throughout a task as standing instructions rather than one-time steps.`
  - `Auto-compaction carries invoked skills forward within a token budget. ... re-attaches the most recent invocation of each skill after the summary, keeping the first 5,000 tokens of each. Re-attached skills share a combined budget of 25,000 tokens.`
  - `After compaction, Claude Code can keep only the start of an invoked skill, so put the most important instructions near the top of SKILL.md.`
  - `Claude skipped a rule that must hold every time: move the rule into a hook. Claude Code runs a hook every time its event occurs ... whether or not Claude is following the skill.`
  - `word the guidance so it applies to the whole task, for example "Run the tests after every edit" rather than "Run the tests".`
  - 圧縮で残るもの（表）：プロジェクトのルートの CLAUDE.md は `Re-injected from disk`、プランモードの計画は `Re-injected from disk`、呼ばれたスキルの本文は `capped at 5,000 tokens per skill and 25,000 tokens total; oldest dropped first`、フックが前に足した文脈は `Summarized with the rest of the conversation`。
  - メモリの文書：`If an instruction disappeared after compaction, it was given only in conversation ... Add conversation-only instructions to CLAUDE.md to make them persist.`
- 示唆：Copilot CLI は別の基盤だが、「先頭に最重要」「常時の規則は"毎回〜する"と書く」「会話だけで伝えた事は圧縮で消える→ファイルに」は、どの基盤でも当てはまる設計規則として使える。決定的に守らせたい規則は、フック（Copilot CLI にもある。B8）に出す選択肢がある。

#### A8. anthropics/skills の skill-creator の SKILL.md（一次。リポジトリ main、取得 2026-10-20）
- URL：https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md
- 何と言っているか（原文）：`Try to explain to the model why things are important in lieu of heavy-handed musty MUSTs.` / `Prefer using the imperative form in instructions.` / `Keep the prompt lean.`
- 示唆：A1 の「MUST filter」と食い違う。第3章に載せる。

### B. 長い対話・長い作業での状態の残し方

#### B1. Anthropic「Effective context engineering for AI agents」
- URL：https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents （一次。公開 2025-09-29）
- 原文：
  - `as the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases.`（context rot）
  - `The right altitude is the Goldilocks zone between two common failure modes.`（複雑で壊れやすい論理を書き込むことと、あいまいな高水準の指示の間）
  - `Structured note-taking, or agentic memory, is a technique where the agent regularly writes notes persisted to memory outside of the context window. These notes get pulled back into the context window at later times.`
  - 圧縮：`Compaction is the practice of taking a conversation nearing the context window limit, summarizing its contents, and reinitiating a new context window with the summary.` / `The art of compaction lies in the selection of what to keep versus what to discard, as overly aggressive compaction can result in the loss of subtle but critical context whose importance only becomes apparent later.`
  - 使い分け：`Compaction maintains conversational flow for tasks requiring extensive back-and-forth; Note-taking excels for iterative development with clear milestones; Multi-agent architectures handle complex research and analysis where parallel exploration pays dividends.`
  - サブエージェント：`returns only a condensed, distilled summary of its work (often 1,000-2,000 tokens).`
  - 例：`We do not recommend this. Instead, we recommend working to curate a set of diverse, canonical examples` （エッジケースの羅列ではなく、典型例を少数）
- 示唆：「やり取りの往復が多い仕事は圧縮が向く」と書いてある点は、聞き取り（往復が多い）では圧縮に頼れる、という解釈もできる。ただし「後で重要と分かる細部が落ちる」ので、ユーザーの言葉は圧縮に頼らずファイルに書く方が安全（考察）。

#### B2. Anthropic「Effective harnesses for long-running agents」
- URL：https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents （一次。公開 2025-11-26。対象：Claude Agent SDK、Opus 4.5）
- 原文：
  - `The core challenge of long-running agents is that they must work in discrete sessions, and each new session begins with no memory of what came before.`
  - `However, compaction isn't sufficient.` / `This happens even with compaction, which doesn't always pass perfectly clear instructions to the next agent.`
  - 失敗の型：`the agent tended to try to do too much at once`、`a later agent instance would look around, see that progress had been made, and declare the job done.`
  - 対策：最初の会話だけ別の指示（初期化）で、`an init.sh script, a claude-progress.txt file that keeps a log of what agents have done, and an initial git commit`。以後は `make incremental progress, then leave structured updates.`
  - 機能一覧：200超の項目を最初はすべて "failing" で書き、`We prompt coding agents to edit this file only by changing the status of a passes field, and we use strongly-worded instructions like "It is unacceptable to remove or edit tests because this could lead to missing or buggy functionality."` / `we landed on using JSON for this, as the model is less likely to inappropriately change or overwrite JSON files compared to Markdown files.`
  - 1回に1項目：`the next iteration of the coding agent was then asked to work on only one feature at a time.`
  - 表の1行：`Claude declares victory on the entire project too early.` → 対策 `Read the feature list file at the beginning of a session.`
- 示唆：聞き取りの「聞き漏らし」は、この「早すぎる完了宣言」と同じ形の失敗になりうる。**聞く項目の一覧を、最初は全部「未確認」で作り、確認できた項目だけを状態の変更で「済」にする**、という写し方ができる（考察）。「状態ファイルは JSON、Markdown だと勝手に書き換わりやすい」は、状態の形の選択に効く（第3章の食い違いも参照）。

#### B3. Anthropic「Harness design for long-running application development」
- URL：https://www.anthropic.com/engineering/harness-design-long-running-apps （一次。公開 2026-03-24）
- 原文：
  - `Some models also exhibit "context anxiety," in which they begin wrapping up work prematurely as they approach what they believe is their context limit. Context resets—clearing the context window entirely and starting a fresh agent, combined with a structured handoff that carries the previous agent's state and the next steps—addresses both these issues.`
  - `While compaction preserves continuity, it doesn't give the agent a clean slate, which means context anxiety can still persist.`
  - `every component in a harness encodes an assumption about what the model can't do on its own, and those assumptions are worth stress testing, both because they may be incorrect, and because they can quickly go stale as models improve.`
  - `Before each sprint, the generator and evaluator negotiated a sprint contract: agreeing on what "done" looked like for that chunk of work before any code was written.`
- 示唆：「各段階の始めに"何をもって済とするか"を決める」は、クリエイターの各段階（項目ごとの質問、実際の1回、確認…）の終了条件の書き方の参考になる。「モデルが良くなると不要になる部品がある」ので、スキルの手順も外側の EVAL で定期的に削れるか試す前提にできる。

#### B4. Anthropic「Memory tool」
- URL：https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool （一次。日付表示なし）
- 原文：API が自動で足すシステムプロンプトとして `IMPORTANT: ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE.` / `As you make progress, record status / progress / thoughts etc in your memory.` / `ASSUME INTERRUPTION: Your context window might be reset at any moment, so you risk losing any progress that is not recorded in your memory directory.`。圧縮との併用：`compaction keeps the active context small without client-side bookkeeping, and memory preserves the information that must survive summarization.` 複数回にわたる作業の型：`Initializer session` が進捗ログと機能チェックリストを作り、`End-of-session update` で進捗を更新する。
- 示唆：「中断はいつでも起きると仮定して、進みを記録する」「始めに記録を読む」という二つの文が、クリエイターの SKILL.md の冒頭の2規則（始めに状態を読む／答えを受けるたびに状態へ書く）の言い回しの手本になる。

#### B5. Anthropic「Claude prompting best practices」（複数の会話窓にまたがる作業）
- URL：https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices （一次。日付表示なし。Claude Fable 5.1／Mythos 5.1／Fable 5 などが対象）
- 原文：
  - `Use structured formats for state data: When tracking structured information (like test results or task status), use JSON or other structured formats to help Claude understand schema requirements.`
  - `Use unstructured text for progress notes: Freeform progress notes work well for tracking general progress and context.`
  - `Use git for state tracking`、`Emphasize incremental progress: Explicitly ask Claude to keep track of its progress and focus on incremental work.`
  - `Starting fresh versus compacting: When a context window is cleared, consider starting with a brand new context window rather than using compaction. Claude's latest models are extremely effective at discovering state from the local filesystem.` 始め方は具体的に：`Review progress.txt, tests.json, and the git logs.`
  - `Use a different prompt for the very first context window`
  - 基本：`Claude responds well to clear, explicit instructions.` / `Golden rule: Show your prompt to a colleague with minimal context on the task and ask them to follow it. If they'd be confused, Claude will be too.`
  - 例：`Include 3–5 examples for best results.`、`Wrap examples in <example> tags`
  - 長い文書：`Put longform data at the top ... above your query, instructions, and examples.`
- 示唆：状態は「構造のあるもの（チェックリスト）は JSON、自由な経過は文章」と二つに分けるのが Anthropic の勧め。クリエイターの「引き出したナレッジの一覧」は前者、「ユーザーの言い回し・経過」は後者に当たる（考察）。

#### B6. Anthropic（Claude Code）「Best practices」：聞き取り（インタビュー）の型
- URL：https://code.claude.com/docs/en/best-practices （一次。日付表示なし）
- 原文：
  - `Most best practices are based on one constraint: Claude's context window fills up fast, and performance degrades as it fills.` / `Claude may start "forgetting" earlier instructions or making more mistakes.`
  - `For larger features, have Claude interview you first. Start with a minimal prompt and ask Claude to interview you using the AskUserQuestion tool.`
  - 例の指示文：`Interview me in detail using the AskUserQuestion tool. Ask about technical implementation, UI/UX, edge cases, concerns, and tradeoffs. Don't ask obvious questions, dig into the hard parts I might not have considered. Keep interviewing until we've covered everything, then write a complete spec to SPEC.md.`
  - `Once the spec is complete, start a fresh session to execute it. The new session has clean context focused entirely on implementation, and you have a written spec to reference.`
  - `If you've corrected Claude more than twice on the same issue in one session, the context is cluttered with failed approaches. Run /clear and start fresh`
- 示唆：**公式が勧める聞き取りの型は「質問のツールで聞く → 仕様をファイルに書く → 新しい会話で実行する」**。クリエイターの「聞き取り → ナレッジの一覧をファイルに → 生成は別の窓（サブエージェントまたは新しい会話）で」と同じ形。Copilot CLI でも `/clear`・`/new` と、plan.md の仕組みで同じことができる（B8）。

#### B7. OpenAI の勧め（計画書・計画ツール・圧縮・セッション・目標）
- ExecPlan（PLANS.md）：https://developers.openai.com/cookbook/articles/codex_exec_plans （一次。公開 2025-10-07。「アーカイブ済み。古いモデル／API に言及しうる」と表示）
  - 原文：`ExecPlans are living documents, and it should always be possible to restart from _only_ the ExecPlan and no other work.` / `Every stopping point must be documented here, even if it requires splitting a partially completed task into two ("done" vs. "remaining"). This section must always reflect the actual current state of the work.` / `record decisions in a log in the spec for posterity; it should be unambiguously clear why any change to the specification was made.` / 必須の節：`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective`。実装中は `do not prompt the user for "next steps"; simply proceed to the next milestone.`
- GPT-5.1 の prompting guide：https://developers.openai.com/cookbook/examples/gpt-5/gpt-5-1_prompting_guide （一次。公開 2025-11-13。アーカイブ表示あり）
  - 原文：`One tool we recommend implementing for long-running tasks is a planning tool.` / `it may be difficult to keep track of where the model is relative to the execution of the query.` / `exactly one item in_progress at a time` / `Do not batch-complete multiple items after the fact.` / `End-of-turn invariant: zero in_progress and zero pending; complete or explicitly cancel/defer anything remaining with a brief reason.` / `Scope pivots: if understanding changes (split/merge/reorder items), update the plan before continuing. Do not let the plan go stale while coding.`
- 圧縮（OpenAI API）：https://developers.openai.com/api/docs/guides/compaction （一次。日付表示なし）
  - 原文：`The returned compaction item carries forward key prior state and reasoning into the next run using fewer tokens. It is opaque and not intended to be human-interpretable.`
- Agents SDK のセッションとメモリ：https://openai.github.io/openai-agents-python/sessions/ 、https://openai.github.io/openai-agents-python/sandbox/memory/ （一次。日付表示なし）
  - 原文：`Sessions store conversation history for a specific session`（会話履歴の保存）。メモリは別物：`It is separate from the SDK's conversational Session memory, which stores message history. Memory distills lessons from prior runs into files in the sandbox workspace.` 読み方は段階的：`Memory reads use progressive disclosure. At the start of a run, the SDK injects a small summary ... When prior work looks relevant, the agent searches the configured memory index ... It opens the corresponding prior rollout summaries ... only when the task needs more detail.` 古くなる：`Agents are instructed to treat memories as guidance only and trust the current environment.`
- Codex の「目標」：https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex （一次。公開 2026-05-09。Codex 0.128.0 以降）
  - 原文：`Those tasks do not need a bigger prompt. They need a persistent objective.` / `A Goal gives Codex a completion condition: what should be true, how success should be checked, and what constraints must stay intact.` 長い仕事のページ https://developers.openai.com/codex/long-running-work には `If the outcome is still unclear, start with /plan. Ask ChatGPT to interview you, identify constraints, and turn the result into a goal with measurable success criteria.`
- 示唆：OpenAI の圧縮は中身を読めない（opaque）ので、**人が読める状態は自前のファイルにしかない**。計画ツールの「同時に進行中は1つだけ」「終わる時点の不変条件」は、聞き取りの「いま聞いている項目は1つ」「終える時に未確認の項目がゼロか、理由つきで保留」という書き方に写せる（考察）。

#### B8. GitHub Copilot CLI の文書（圧縮・セッション・plan.md・再開・フック）と、1.0.98 のパッケージの中身
- 一次（GitHub Docs。日付表示なし）：
  - Context management：https://docs.github.com/en/copilot/concepts/prompting-and-context/context-management
  - CLI best practices：https://docs.github.com/en/copilot/how-tos/copilot-cli/cli-best-practices
  - 再開（chronicle）：https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/chronicle
  - 自律モード：https://docs.github.com/en/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/autopilot
  - フック：https://docs.github.com/en/copilot/reference/hooks-configuration
  - コマンド一覧：https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference
  - 更新履歴：https://github.com/github/copilot-cli/blob/main/changelog.md （raw で取得）
- 原文（Docs）：
  - 圧縮の中身：`Sends the full conversation to the AI model with a special prompt that asks it to generate a structured summary. The summary captures the goals of the conversation, what was done, key technical details, important files, and planned next steps.` / `Replaces the old conversation history with the summary, along with any original user instructions and the current state of any plans or to-do lists.`
  - 失うもの：`Compaction is a summarization process, so some detail is inevitably lost. ... such as the exact wording of every message, the full output of every command, or minor decisions made early in a long conversation—may not be included.` / `You can't reverse a completed compaction.`
  - 起きる時期：Context management と best practices は `approximately 80% of the context window's capacity`（静的な文脈が多いと 90% まで遅らせる）。同じ Docs の別ページ（CLI の概念）は `approaches 95% of the token limit`。**食い違い**（第3章）。
  - 新しい会話を勧める時：`The conversation has gone through many compactions, and you feel that important context is being lost in the summarization process.`
  - 計画：`Models achieve higher success rates when given a concrete plan to follow.` / プランモードは `Asks clarifying questions to align on requirements and approach.` `Saves the plan to plan.md in your session folder.` `Waits for your approval before implementing.`
  - 保存場所：`~/.copilot/session-state/{session-id}/` の下に `events.jsonl`（全履歴）、`plan.md`、`checkpoints/`（圧縮の履歴）、`files/`（`Persistent artifacts`）。
  - 再開：`When you resume a session, Copilot loads the full conversation history, so you can continue exactly where you left off.`
  - 自律モード：`Vague, exploratory, or open-ended tasks are more likely to require your guidance`、`Use Interactive mode when you are still exploring the problem or expect to make frequent decisions.`
  - フック：`sessionStart`（`source: "startup" | "resume" | "new"`、`additionalContext` を返せる）、`postToolUse`（`additionalContext` を足せる）、`agentStop`（`decision: "block"` で `forces another agent turn`）、`preCompact`（`No — notification only.`）。圧縮の後に呼ばれるフックは **見つからなかった**。
- 原文（更新履歴 changelog.md）：
  - 0.0.399（2026-01-29）`Skills remain effective after conversation history is compacted`
  - 0.0.387（2026-01-20）`Add ask_user tool for interactive clarification questions`
  - 0.0.407（2026-02-11）`ask_user tool asks one question at a time for clearer interaction`
  - 0.0.421（2026-03-03）`Add structured form input for the ask_user tool using MCP Elicitations (experimental)`
  - 1.0.64（2026-06-23）`Autopilot mode now auto-handles elicitation, ask_user, sampling, and permission prompts ... instead of surfacing dialogs to the user`
  - 1.0.71（2026-07-16）`Always offer a custom answer in ask_user choice prompts`
  - 1.0.85（2026-09-16）`Automatic compaction now saves a checkpoint that appears in /session checkpoints`
  - 1.0.22（2026-04-09）`Custom agents can now declare a skills field to eagerly load skill content into agent context at startup`
  - 1.0.48（2026-05-14）`Skill content injected to the model no longer includes YAML frontmatter metadata`
- 1.0.98 の runtime 文字列・送信記録（別担当の抽出物を私が読んだ。一次。モデルごとの差は要確認）：
  - 圧縮の要約の指示：`The history is being compacted so moving forward, all conversation history will be removed and you'll only have this summary to work from. Be sure to make note of the user's explicit requests, your actions, and any key technical details.` 要約の節は `<overview>` `<history>` `<work_done>` `<technical_details>` `<important_files>` `<next_steps>`。`Tools are unavailable in this step`（要約中は道具を使えない）。要約は**会話しているモデル自身が書く**ので、安いモデルでは落ちる内容が増えうる（考察）。
  - 圧縮の後の注意書き：`## Previously used skills`／`These skills were used earlier in the session. Reactivate one before relying on its instructions unless its instructions are retained below`。文脈（圧縮の後か、再開か）は文字列からは特定できない（**要確認**）。一方、`skill` ツールの説明には `Do not reinvoke a running skill` がある。この二つの兼ね合いは未確認。
  - セッションの作業場：`files/ persists across checkpoints for artifacts that shouldn't be committed (e.g., architecture diagrams, task breakdowns, user preferences).` 同じ記録には `Session folder:` のパスが入る。
  - セッションの SQLite：`persists for this session and is isolated from other sessions. Use it for structured operational data such as todos, test cases, batches, and state.` `todos`・`todo_deps` の表が既にある。
  - ホスト側の別の指示：`Do not create markdown files for planning, notes, or tracking unless explicitly requested; session artifacts may go in the session workspace.`（**状態を Markdown で作らせたい場合は、スキルが明示する必要がある**）／ `When providing output or explanation to the user, try to limit your response to 100 words or less.`（2か所に出現。モデルごとの版の違いは要確認）／ `<solution_persistence> Be extremely biased for action. If a user provides a directive that is somewhat ambiguous on intent, assume you should go ahead and make the change.`（これは GPT-5.1 の prompting guide の文と同じ。C2）／ 自律モード `Decide; don't ask - resolve ambiguity by making reasonable assumptions, stating those assumptions to the user, and continue executing`。
  - plan.md：`Consider updating plan.md to reflect current progress and next steps.`（`<system_reminder>` の中。出る条件は不明）／プランモードでは `Do NOT ask for permission to create or update plan.md in the session workspace`。
- 示唆（考察）：
  - Copilot CLI の圧縮は「モデルが書く要約」で、公式にも細部が落ちると書いてある。**ユーザーの言葉と確認済みの項目は、会話ではなくファイル（session の `files/` や SQLite、または作業ディレクトリ）に書く**のが各社の勧めと整合する。どこが最適かは別担当の調査と実機で決める。
  - 要約の指示は「ユーザーの明示の依頼・やったこと・技術的な細部」を拾う作りで、聞き取りの途中経過（どの項目が済でどれが未か）が `work_done` と `next_steps` に入るかはモデル任せ。**状態ファイルの場所を会話の中で何度か言及しておく**と、`important_files` に入りやすい（推測。実機で要確認）。
  - 再開は全履歴を読み込むので、長い聞き取りは再開直後に圧縮が走りうる。状態の再読込を「再開の最初の動作」に決めておく。

#### B9. Manus「Context Engineering for AI Agents: Lessons from Building Manus」
- URL：https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus （二次。企業の技術ブログ。公開 2025-07-18）
- 原文：`when handling complex tasks, it tends to create a todo.md file—and update it step-by-step as the task progresses` / `By constantly rewriting the todo list, Manus is reciting its objectives into the end of the context. This pushes the global plan into the model's recent attention span, avoiding "lost-in-the-middle" issues and reducing goal misalignment.`
- 示唆：「状態を書き直すこと自体が、目標を文脈の末尾に置き直す効果を持つ」という報告。状態ファイルを毎回「読む→更新する」ことは、保存と再確認を兼ねる（考察）。査読された研究ではなく、経験則。

### C. モデルごとの指示の守り方の違い

#### C1. OpenAI「Using GPT-6」（Astra／6.1 Sol／Luna）と GPT-5.6 の勧め
- URL：https://developers.openai.com/api/docs/guides/prompt-guidance （一次。ページに日付表示なし。クックブックの一覧が 2026-09-29 までなので 2026年9〜10月の版。二次の検索結果 kocpc.com.tw も 2026年9月と記す）
- 原文（GPT-6 Astra）：
  - `The model is designed to be a more effective collaborator and is thus more likely to ask the user a question when additional input could materially change the result. This can cause it to stop when the user may expect it to make reasonable assumptions and persist.`
  - `GPT-6 Astra is better able to follow longer instructions, but can also be more sensitive to information in context. For example, unclear or conflicting guidance in a skill file may cause the model to pause and block work early. Make the priority of user instructions and skills explicit.`
  - `It can be more sensitive to instructions contained in skills and other files, such as AGENTS.md. We strongly recommend auditing skills and other files accessible to your model for instructions that could influence its behavior.`
  - `The user's instructions take precedence over guidelines provided in a skill. If explicit user instructions conflict with a skill's instructions, prioritize the user's instructions.`
  - `Prompt the model to ask for approval only after preparing a concrete, reviewable result.`
  - 平易さ：`Use plain language over jargon, and reference technical details only to the degree that it helps illustrate an idea or your work to the user.`（「専門用語を避ける」を指示する文面の例）
  - モデル選択の注意：`They address behavior observed with GPT-6 Astra; evaluate them with your chosen model and workload.`
- 原文（GPT-5.6 の節）：
  - `Removing repeated instructions and examples and simplifying tool descriptions can improve task performance and token efficiency.` / `State each instruction once.` / `configurations with leaner system prompts improved evaluation scores by roughly 10–15% while reducing total tokens by 41–66%`（社内のコーディングエージェントの評価の一部で、「方向を示す数字」と注記）
  - `Repeating instructions such as "ask first," "do not mutate," or "wait for approval" can cause unnecessary approval requests for safe, expected actions.`
  - `Tell the model when an important ambiguity should trigger a question.`
  - `Long sessions can amplify repeated prompt and tool content.`
  - 方針は短く1か所に：`A compact policy is usually sufficient`（回答・説明・計画の依頼では調べて報告するだけ、変更の依頼ではやる、外部への書き込み・破壊的な操作・費用・範囲の拡大では確認する）
- 示唆：**GPT-6 系のモデルでは、スキルの中の「迷ったら止まる」風の文言が、止まりすぎを招く**。聞き取りでは止まることが目的だが、「止まってよい場所（ユーザーの答えが要る所）」と「止まらず進めてよい場所（記録・整理・確認前の下準備）」を一か所にまとめて書く（考察）。

#### C2. OpenAI の GPT-5／5.1／5.2 の prompting guide
- GPT-5：https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide （一次。公開 2025-08-07。アーカイブ表示あり。**古い（2025年前半の世代）**）
  - 原文：`Controlling agentic eagerness` の節。`its careful instruction-following behavior means that poorly-constructed prompts containing contradictory or vague instructions can be more damaging to GPT-5 than to other models, as it expends reasoning tokens searching for a way to reconcile the contradictions rather than picking one instruction at random.` / `it can be helpful to clearly state the stop conditions of the agentic tasks, outline safe versus unsafe actions, and define when, if ever, it's acceptable for the model to hand back to the user.` / 行動に偏らせる文：`Do not ask the human to confirm or clarify assumptions, as you can always adjust later` / 低い reasoning では `Disambiguating tool instructions to the maximum extent possible and inserting agentic persistence reminders ... are particularly critical at minimal reasoning to maximize agentic ability in long-running rollout and prevent premature termination.` / `You must be prepared to answer multiple queries and only finish the call once the user has confirmed they're done.` / 動作の逃げ道：`it's helpful to explicitly provide the model with an escape hatch`
- GPT-5.1：上の B7 の URL（公開 2025-11-13）。原文：`On long agentic tasks, we've noticed that GPT-5.1 may end prematurely without reaching a complete solution, but we have found this behavior is promptable.` 同じページの `<solution_persistence>` は `Be extremely biased for action.` を含み、**Copilot CLI 1.0.98 のシステムプロンプトにほぼ同じ文がある**（B8）。
- GPT-5.2：https://developers.openai.com/cookbook/examples/gpt-5/gpt-5-2_prompting_guide （一次。公開 2025-12-11）
  - 原文：`For long-context tasks, the prompt may benefit from force summarization and re-grounding. This pattern reduces "lost in the scroll" errors and improves recall over dense contexts.` / `Re-state the user's constraints explicitly` / 曖昧なときは `Ask up to 1–3 precise clarifying questions, OR Present 2–3 plausible interpretations with clearly labeled assumptions.` / 圧縮：`Compaction performs a loss-aware compression pass over prior conversation state, returning encrypted, opaque items`
- 示唆：GPT-5 系は「矛盾した指示に推論を使い果たす」。**ホストの「行動に偏れ」とスキルの「答えを待て」が同時に見えると衝突する**ので、スキルの冒頭で優先順位を宣言する（考察）。「ユーザーが"もう終わり"と確認するまで終えない」（GPT-5 の文）は、聞き取りの終了条件の書き方の参考になる。

#### C3. Anthropic の Claude（最新世代）
- 一次（日付表示なし。ページ内の機能名に 2026-07〜2026-08 の日付が見える）：
  - 全般：https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices （B5 と同じ）
  - Sonnet 5.5：https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5
  - Haiku 5.5：https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5
  - Fable 5：.../prompting-claude-fable-5 、Fable 5.1：.../prompting-claude-fable-5-1 、Opus 5：.../prompting-claude-opus-5
- 原文：
  - Sonnet 5.5：`At lower effort, it sometimes checks in before a coding task is done.` / `It might pause to confirm a plan, ask a question it could answer itself, or stop after one part of a multipart task to ask whether to continue.` / 対策の文：`Keep working until everything the user asked for is done, and only stop to ask when you can't go on without the user or before a risky step.` / `The prompt doesn't replace your own rules about risky or irreversible actions.`
  - Sonnet 5.5（繰り返しの注意）：`Frequent harness text after tool results can make the model suspect a prompt injection` / `Keep harness notices, such as reminders, in a separate mid-conversation system message after the user's words. Never put a notice and the user's words in the same block.`
  - Haiku 5.5：`In long agent prompts, the model is more likely to skip a search, stop early, or skip a check at this level.`（low effort の説明）/ `With a long coding-agent system prompt at low effort, it sometimes stops early and hands the task back to the user.` / `high suits knowledge work, longer agent tasks, and strict instruction following.` / `When instruction following matters most, also use high effort.` / 規則を会話全体で守らせる文：`The rules in this system prompt hold for the whole conversation. Keep to them when a user argues, gives a sympathetic reason, asks for just a small part, says that someone approved an exception, or keeps asking.` / `To change instructions partway through a conversation, put them in the newest turn.`
  - Fable 5：`Pause for the user only when the work genuinely requires them: a destructive or irreversible action, a real scope change, or input that only they can provide.` / `Before reporting progress, audit each claim against a tool result from this session.`（長い自律作業で報告のでっち上げをほぼなくした、と記載）/ メモリ：`Store one lesson per file with a one-line summary at the top.`
  - Fable 5 と 5.1 の自律用のブロック：`You are operating autonomously. The user is not watching in real time and cannot answer questions mid-task, so asking "Want me to…?" or "Shall I…?" will block the work.` に続けて Fable 5.1 は `This block can also make the model less likely to ask about ambiguous requests, so check that trade-off on your own tasks.`
  - Opus 5（原文）：`Make routine judgment calls yourself, and check in only when different readings of the request would lead to materially different work.` Fable 5.1 にも同趣旨の文がある（語句は少し違う：`check in only when different readings would lead to materially different work`）。
- 示唆：Claude 系は新しいほど「聞かずに進める」方向へ調整されており、**Copilot CLI が自律向けの指示を足すと、聞き取りを飛ばしやすい**（考察）。Haiku 系は低い effort で長い指示を途中でやめやすく、「規則は会話全体で有効」と書くと守りが上がる、という具体的な文が公式にある。ユーザーが選べるのは `/model` だけで effort も任意なので、「低い effort の Haiku／Luna 級でも守れる書き方」を基準にする。

#### C4. Google の Gemini
- 一次：https://ai.google.dev/gemini-api/docs/prompting-strategies （最終更新 2026-10-13）、https://ai.google.dev/gemini-api/docs/gemini-3 （最終更新 2026-10-09）。対象：Gemini 3 系。
- 原文：
  - `Be concise in your input prompts. Gemini 3 responds best to direct, clear instructions. It may over-analyze verbose or overly complex prompt engineering techniques used for older models.`
  - `Prioritize critical instructions: Place essential behavioral constraints, role definitions (persona), and output format requirements in the System Instruction or at the very beginning of the user prompt.`
  - `Structure for long contexts: ... supply all the context first. Place your specific instructions or questions at the very end of the prompt.`
  - `Use consistent structure: ... Choose one format and use it consistently within a single prompt.`
  - 自律の調整軸として `Ambiguity and permission handling: Defines when the model is permitted to make assumptions versus when it must pause execution to ask the user for clarification or permission.`
  - 公式の自律向け指示の見本：`Prefer calling the tool with the available information over asking the user, unless your Rule 1 (Logical Dependencies) reasoning determines that optional information is required for a later step in your plan.` と `You may need to consult the user to even know whether something is applicable. Do not assume it is not applicable without checking.`
  - `Persistence and patience: ... On transient errors ... you must retry unless an explicit retry limit (e.g., max x tries) has been reached.`
- 見つからなかったこと：Gemini の文書に「ユーザーに1つずつ質問する」「質問のツールを使う」を直接扱う記述は見つからなかった（上の2ページ全文と検索）。Gemini CLI の skill の文書は調べていない（Copilot CLI が対象のため）。
- 示唆：Gemini 3 は「短く直接的に」「重要な制約は先頭」。Claude／GPT 向けに長く書いた SKILL.md は、Gemini 系でよけいに考え込む恐れがある（Gemini の文）。**短い本文＋先頭に重要事項**は3社に共通して無理がない。

### D. 質問のツール

#### D1. Claude の AskUserQuestion
- URL：https://code.claude.com/docs/en/agent-sdk/user-input 、https://code.claude.com/docs/en/tools-reference （一次。日付表示なし）
- 原文：
  - `When Claude needs more direction on a task with multiple valid approaches, it calls the AskUserQuestion tool.`
  - `Clarifying questions are especially common in plan mode, where Claude explores the codebase and asks questions before proposing a plan.`
  - 制限：`Question limits: each AskUserQuestion call supports 1-4 questions with 2-4 options each` / `Subagents: AskUserQuestion is not currently available in subagents spawned via the Agent tool`
  - 自由回答：`Display an additional "Other" choice after Claude's options that accepts text input` / ツール一覧：`Answer by picking an option, or type your own text through the Other row or the notes field.`
  - 自由回答の扱い：`When you answer by typing your own text, Claude Code relays the answer with neutral wording so Claude follows what you wrote, including a request to wait or explain first.`
  - 待ち：`Questions stay open until you answer them.`（既定。`askUserQuestionTimeout` で無人でも進める設定がある）
  - 使わせ方：`If you specify a tools array ... include AskUserQuestion ... Otherwise, Claude won't be able to ask clarifying questions`
- 示唆：Anthropic 側の仕様は「複数質問をまとめられるが、選択肢は2〜4個、いつでも自由回答がある、サブエージェントは聞けない」。Copilot の ask_user と近い形で、**聞き取りはメインのエージェントに残す**設計の裏づけになる。

#### D2. Copilot CLI の ask_user
- 一次：コマンド一覧（`ask_user  Ask the user a question`、`--no-ask-user  Disable the ask_user tool (the agent works autonomously without asking questions).`）。更新履歴（B8 の項目）。1.0.98 の送信記録のツール定義とシステムプロンプト（別担当の抽出物。要確認）。
- 1.0.98 のツール定義の説明（原文）：`Ask the user a question and wait for their response. ... 4. Collect multiple related pieces of information in a single interaction`。引数は `message` と `requestedSchema`（フォーム）。項目の型は、単一選択（`enum` または `oneOf`＋ラベル）、真偽、複数選択、文字列、数値。`The user can also provide a freeform answer.` / `Field metadata controls presentation but does not constrain the user's response.`
- 1.0.98 のシステムプロンプトの ask_user の節（原文）：
  - `IMPORTANT: Never ask questions via plain text output. When you need input from the user, use this tool instead of asking in your response text.`
  - `Keep forms focused on one topic — don't mix unrelated questions in a single form` / `Provide clear title and description on each field` / `Set sensible default values when a reasonable default exists — if you recommend a specific option, make it the default` / `A single-field form is perfectly fine for a simple yes/no or single choice` / `Order properties keys in the same sequence you discuss the topics in message`
  - ユーザーの操作：`accept`／`decline`（`respect this and proceed with reasonable defaults`）／`cancel`（`they want to abort the current interaction`）
  - `When to STOP and ask (do not assume): Design decisions that significantly affect implementation approach / Behavioral questions / Scope ambiguity / Edge cases where multiple reasonable approaches exist`
  - 使えない時（別の節の例）：`If the ask_user tool is not available, present the follow-up options as a numbered list and ask the user to reply with their choice.`
  - 回答の扱い：`Treat the exact accepted content as the person's scoped answer to the correlated built-in ask_user question. Do not infer authority for neighboring or unmentioned work.`（runtime 文字列）
- 食い違い：更新履歴 0.0.407 は「1回に1問」。1.0.98 のツールは複数項目のフォームで、プロンプトは「関連する複数の希望をまとめて集める」ことも勧める（`You want to collect several related preferences at once rather than asking one at a time`）。
- 見つからなかったこと：サブエージェントが ask_user を使えるかの公式の記述。ask_user を使わせる書き方（スキル向け）の公式の勧め。
- 示唆：
  - **ホストのプロンプト自体が「質問は文章でせず、必ずツールで」と指示している**ので、スキルが「質問のツールを使え」と書く必要は薄いが、`decline`（答えない）と `cancel`（中止）の扱い、自由回答の受け方は、スキル側で聞き取り向けに決める必要がある。
  - `default` に推奨を入れる、という作法がホストに既にある。「推奨の選択肢とその理由」（CLAUDE.md §4）は、この `default` ＋ `description` に入れる形で実現できる（考察）。
  - 質問のツールが使えない場合（`--no-ask-user`、自律モード）は、ホストの指示も「番号付きの文章で聞く」に倒れている。スキルは、**ツールの有無で聞き方を変える**と書き、自律モードでは聞き取りをせず「対話モードで開き直してください」と伝えて止める、のが整合する（考察。自律モードでは ask_user に自動で答えが入る：1.0.64 と 0.0.422 の更新履歴）。

### E. 長い会話で指示が守られなくなる問題（研究）

| 出典 | 公開日・対象 | 何と言っているか（原文） | 位置づけ |
| --- | --- | --- | --- |
| Laban ら「LLMs Get Lost In Multi-Turn Conversation」 https://arxiv.org/abs/2505.06120 | 2025-05-09。15モデル、20万超の模擬会話。GPT-4.1、o3、DeepSeek-R1 など | `an average drop of 39% across six generation tasks` / `when LLMs take a wrong turn in a conversation, they get lost and do not recover` / 原因：`LLMs often make assumptions in early turns and prematurely attempt to generate final solutions, on which they overly rely.` / 緩和：Snowball（毎回、これまでの要点を言い直す）は `can mitigate the Full-to-Sharded performance deterioration by 15-20%` / 推論モデルも同じ：`Additional test-time compute (reasoning tokens) does not help` / 勧め：`consolidating instruction requirements into a single instruction is an effective strategy` | 一次（論文）。ユーザーが情報を小出しにする向き（逆向き）の実験。クリエイターは AI が聞く側なので、そのまま当てはまるとは限らない。ただし「早い段階の思い込みと、早すぎる最終案」は、聞き取りを終える前に生成へ進む失敗と同じ型 |
| Li ら「Measuring and Controlling Instruction (In)Stability in Language Model Dialogs」 https://arxiv.org/abs/2402.10962 | 2024-02（COLM 2024）。LLaMA2-chat-70B、GPT-3.5。**古い** | `a significant instruction drift within eight rounds of conversations` / `the transformer attention mechanism plays a role, due to attention decay over long exchanges` | 一次。古い世代。傾向の根拠としてのみ使う |
| Liu ら「Lost in the Middle」 https://arxiv.org/abs/2307.03172 | 2023-07（TACL）。**古い** | `performance is often highest when relevant information occurs at the beginning or end of the input context, and significantly degrades when models must access relevant information in the middle` | 一次。古い。Anthropic の context rot、Gemini の「指示は先頭か末尾」と整合 |
| Jaroslawicz ら「How Many Instructions Can LLMs Follow at Once?」 https://arxiv.org/abs/2507.11538 | 2025-07-15。20モデル | `even the best frontier models only achieve 68% accuracy at the max density of 500 instructions` / `bias towards earlier instructions` | 一次。指示が多いほど守れない。スキルの規則を絞る根拠 |
| Chroma「Context Rot」 https://research.trychroma.com/context-rot | 2025-07-14。18モデル | `models do not use their context uniformly; instead, their performance grows increasingly unreliable as input length grows.` | 二次寄り（企業の技術報告）。Anthropic が引く |
| Sirdeshmukh ら「MultiChallenge」 https://arxiv.org/abs/2501.17399 | 2025-01（v2 2025-03）。Claude 3.5 Sonnet など。**古い** | `all frontier models have less than 50% accuracy on MultiChallenge` | 一次。当時のモデル。今の数字としては使わない |
| Robinette ら「We Are What We Repeatedly Do: Improving Long Context Instruction Following（VerIFY）」 https://aclanthology.org/2026.findings-eacl.254/ | EACL 2026 Findings。Gemma 2 27B、Llama 3 70B など（オープンなモデル） | `longer contexts also pose challenges to system instruction adherence` / 六つの緩和を試し `achieving an improvement up to 79%`。五つはプロンプトで、うち Reinstruct は「守っていない応答を検出したら、次のユーザーの発話で指示を繰り返す」 | 一次（論文）。対象は古めのオープンなモデルで、現行の商用モデルに当てはまるかは未確認。**検出して再指示する**形である点が重要（全面の復唱ではない） |
| Jia ら「One Battle After Another（EvolIF）」 https://aclanthology.org/2026.acl-long.433/ | ACL 2026。GPT-5、Gemini-3-Pro など | `deficiencies in failure recovery and fine-grained instruction following, with performance stratification becoming evident as conversational depth increases` / `GPT-5 demonstrates the most sustained resilience, maintaining a 66.40% stability score` | 一次（論文）。会話が深いほどモデル間の差が開く |
| Han ら「Skill-Use: Can LLMs Actually Use Skills in Agentic Harnesses?」 https://arxiv.org/abs/2608.04828 | 2026-08-05。8モデル×2つのハーネス（Claude Code と Codex）、79のスキル、177の課題。**査読済みかは未確認（プレプリント）** | `reliable skill use remains out of reach, as the strongest configuration reaches an SU of only 0.613` / `Triggering and procedural compliance fail as independent bottlenecks, and both scores and model rankings shift with the harness` / `models avoid forbidden actions more reliably than they complete the full prescribed workflow` / 手順が自由な計画を含む分野は守られにくい：`Business analysis and software architecture score lower because their workflows involve open-ended planning.` / `A partial procedure is worse than none because the model commits to a prescribed toolchain or format without carrying it through` | 一次（プレプリント）。**スキルの手順を最後まで守れるかは、モデルだけでなくハーネスにも左右される**。禁止事項は守られやすく、必須の手順は守られにくい |
| Li ら「SkillsBench」 https://arxiv.org/abs/2602.12670 | 2026-02-13（v4 2026-06-14）。87の課題、18の組み合わせ | `Curated Skills raise the average pass rate from 33.9% to 50.5%` / `Focused Skills with at most three modules outperform larger or exhaustive bundles, and smaller models with Skills can match larger models without them.`（検索結果の要約には「自分で作ったスキルは効かない」ともあったが、v4 の要旨にはなく、本文で確認していないので採用しない） | 一次（プレプリント）。絞ったスキルが良い。小さいモデルに向く根拠 |
| Badhe ら「SKILL.state: Scalable Long-Horizon Agent Skills」 https://arxiv.org/abs/2608.26263 | 2026-08-26（EMNLP 採択と表示）。Gemini-3-Flash、Gemma-4-31B、Qwen-3-8B | `replaces append-only conversational history with an explicit, mutable execution state` / 毎段階、モデルに渡すのは `the immutable skill specification, the current structured execution state, and the latest observation` / 表2：ノイズが増えると通常のプロンプトは 0.68 から 0.53 に下がり、状態方式は 0.97 以上を保つ（本文で確認） / 小さいモデルの失敗は `small-model degradation stems from structured output adherence rather than reasoning capacity` | 一次（論文）。**ランタイムを作り替える方式で、プラグインにはできない**。ただし「状態を明示的に持ち、更新は検証してから反映する」は、スクリプトによる検証で近づけられる（考察） |

- 示唆：
  - 長い会話の劣化は、ほぼすべての研究で確認されている。**「聞き終えないうちに最終案へ進む」「早い段階の思い込みに引きずられる」**が主な原因という点は、聞き取りの設計に直接効く（生成前の関門を置く、早い段階の推測を「仮」と明記してファイルに残す）。
  - 緩和は二系統。(a) 要点の言い直し／指示の再提示（Snowball、Reinstruct、Manus の復唱）、(b) 状態の明示（SKILL.state、Anthropic の進捗ファイル）。研究は (a) を「検出して必要な時だけ」で効果ありとし、全面の毎回の復唱は OpenAI の GPT-5.6 の勧めと緊張する（第3章）。
  - Skill-Use の「必須の手順は守られにくく、禁止は守られやすい」は、「勝手に先へ進まない」を禁止の形（「答えが来るまで〜しない」）で書き、必須の手順は短く・状態の検査で縛る、という書き分けの根拠になりうる（考察。この論文は聞き取りを対象にしていない）。

### F. 費用の低いモデルでも同じ品質を出す工夫（まとめ）

| 工夫 | 公式・研究の根拠（原文は上の各節） |
| --- | --- |
| 使う全モデルで試す。弱いモデルほど詳しく | Anthropic A1：`What works perfectly for Opus might need more detail for Haiku.` OpenAI C1：`evaluate them with your chosen model and workload.` Skill-Use：順位がハーネスで入れ替わる |
| 決まった処理はスクリプトに | Anthropic A1：`More reliable than generated code`。agentskills A3：`write a tested script once and bundle it in scripts/`。OpenAI A6：決まった動きが要る所だけスクリプト |
| 状態の更新を検証する（計画→検証→実行） | A1・A3：検証スクリプトは `specific error messages`（使える値の一覧まで）。SKILL.state：小さいモデルの失敗は出力の形式の守りで、検証と再試行で防ぐ |
| 出力の形を決める（型） | A1・A3：型は文章の説明より確実。Gemini：`We recommend to always include few-shot examples in your prompts.`（Gemini 全般向けの節の文）。Anthropic B1：典型例を少数 |
| 手順を小さく、1回に1つ | Anthropic B2：`only one feature at a time`。OpenAI GPT-5.1：`exactly one item in_progress`。SkillsBench：3モジュール以内 |
| 既定を示し、選択肢を絞る | A1：`Provide a default (with escape hatch)`。A3：`Provide defaults, not menus.` |
| 低い effort では途中でやめやすいので、止まる条件と続ける条件を書く | Haiku 5.5：低い effort で `stops early`、`skip a check`。Sonnet 5.5：`checks in before ... done`。対策の文が公式に載っている。GPT-5：低い reasoning では `persistence reminders` が `particularly critical` |
| 最低限の確認を機械にさせる | Claude Code A7：`move the rule into a hook`。Copilot のフック（`agentStop` の `block`、`sessionStart`）は文書にあるが、プラグインから使えるかと 1.0.98 での動作は別担当・実機で要確認 |
| 評価で測る | A1：3つ以上の評価を先に作り Haiku／Sonnet／Opus で。Skill-Use：途中までしか守れないとスキルなしより悪い（SU が 0.5 を境に逆転） |

## 3. 各社の勧めで一致していることと、食い違っていること

### 3.1 一致していること

| 項目 | 一致している内容 | 出典 |
| --- | --- | --- |
| 本体を短く | 500行以内（Anthropic、agentskills）、約5,000トークン以内（agentskills）。Claude Code は圧縮の後は先頭 5,000 トークンまで | A1、A2、A7 |
| 段階的な開示 | 説明だけを常に載せ、本文は起動時、詳細は必要な時。参照は1段まで。「いつ読むか」を書く | A1〜A3、A6、A5 |
| 複数段階は番号とチェックリスト | 飛ばさせない。各段階に検証の関門 | A1、A3、A6、B7（計画ツール）、B8（plan.md） |
| 状態は会話の外のファイルへ | 進捗・決定・次の一手をファイルに。新しい窓は始めにそれを読む | B1、B2、B4、B5、B7、B8、E（SKILL.state） |
| 圧縮は細部を落とす | 「後で重要と分かる細部が落ちる」「正確な言い回しは失われる」「中身は読めない」 | B1、B7、B8 |
| 長い会話で守りが落ちる | 研究でも公式の文書でも確認 | E の全行、B6、C2（GPT-5.2） |
| 止まる条件・聞く条件を明示 | 「いつ聞き、いつ止まり、いつ続けるか」を指示で決める。一か所に書く | C1、C2、C3、C4 |
| 矛盾・重複を避ける | 矛盾した指示は推論を浪費させる（OpenAI）、用語を統一（Anthropic）、一つの形式で統一（Gemini）、同じ指示は1回（OpenAI GPT-5.6） | C1、C2、A1、C4 |
| 決まった処理はスクリプト＋検証 | 壊れやすい所は自由度を下げる | A1、A3、A6 |
| 使うモデルで試す | 全モデルで評価し、実行の記録を読む | A1、A3、C1、E（Skill-Use） |
| 聞き取りの型 | 質問のツールで聞く→仕様をファイルに→新しい窓で実行 | B6（Anthropic）、B7（Codex の /plan で聞き取り→/goal）、B8（Copilot のプランモード） |

### 3.2 食い違い・緊張があること

| 項目 | 一方 | 他方 | 見立て（考察） |
| --- | --- | --- | --- |
| 強い言葉の是非 | 理由を説明し、強い MUST を避ける（agentskills A3、skill-creator A8）。Gemini も「説得調を避ける」 | 規則を忘れる時は `MUST` を使う（Anthropic A1 の Claude A の例）。状態ファイルを守らせるのに `It is unacceptable to remove or edit tests` と強く書いて効いた（Anthropic B2） | 一般の手順は理由つきで、**壊してはならない少数の不変条件だけ強く**書く、が両立する |
| 繰り返し | 「指示は1回だけ」「繰り返しの"先に聞け"は不要な確認を増やす」（OpenAI GPT-5.6） | 指示の繰り返し・言い直し・復唱が守りを上げる（Reinstruct、Snowball、Manus、GPT-5.2 の re-state、GPT-5 の persistence reminder）。ただし Claude Sonnet 5.5 は、ハーネスの頻繁な注意書きを「注入攻撃では」と疑うことがあると警告 | 全面の毎回の復唱ではなく、**状態ファイルを読み直す動作で要所に再提示**する（状態から再構成する）形が両方に近い |
| 聞くか進めるかの既定 | GPT-5／5.1：行動に偏れ（`Be extremely biased for action`）。Copilot CLI のプロンプトも同じ。Claude 最新：実質違う読み方がある時だけ聞く。Sonnet 5.5 の自律ブロックは聞かなくなる | GPT-6 Astra：質問して止まりやすい（`stop when the user may expect it to make reasonable assumptions`）。Sonnet 5.5／Haiku 5.5：低い effort で確認しに止まる。Gemini：聞くより先に調べるが、判断できないなら聞く | **モデルの既定に頼れない**。スキルが「聞き取りの間は、答えが要る所では必ず止まって聞く。止まらず進めてよい所はここ」と明示する |
| 状態の形 | 構造のある状態は JSON。Markdown は書き換わりやすい（Anthropic B2、B5） | 計画書は散文優先で、チェックリストは Progress 節だけ（OpenAI ExecPlan B7）。Copilot は plan.md（Markdown）と SQLite の todos | 用途で分ける。チェックリスト・網羅の確認は構造化（JSON か SQL）、経過・ユーザーの言い回しは文章 |
| 圧縮か、新しい窓か | 圧縮で続ける（OpenAI／Copilot の「ほぼ無限のセッション」、Anthropic B1 の「往復の多い仕事は圧縮」） | 新しい窓＋引き継ぎのファイルを勧める（Anthropic B5、B3、B6）。Copilot も「何度も圧縮されたら新しい会話」 | 聞き取りが終わった所（ナレッジの一覧ができた所）で、生成は別の窓にする区切りを置ける。聞き取りの途中は圧縮に耐える状態ファイルで支える |
| 圧縮後のスキル本文 | Claude Code は先頭 5,000 トークンを再投入。agentskills は「守れ」と勧める | Copilot は更新履歴に1行のみ。1.0.98 の文字列は「使ったスキルは、保持されていなければ再度有効にせよ」（ただし `skill` ツールは「走っているスキルを再呼び出しするな」） | **Copilot では保証がない**として、先頭に最重要・再読込の手順を書く。実機で確認が要る |
| 質問の数 | Copilot 0.0.407：1回に1問。ホストのプロンプト：1つの話題に絞る | 1.0.98 のツールは複数項目のフォーム、プロンプトは「関連する複数をまとめて」も可。Claude：1〜4問。OpenAI GPT-5.2：1〜3問 | 「1回に1つの話題」まではほぼ一致。何問が良いかの公式の勧めは **見つからなかった**（利用者の負担の研究は別担当） |
| 圧縮の始まる割合 | Copilot Docs（Context management、best practices）：約80%（動的に75%以上なら90%まで遅らせる） | Copilot Docs（CLI の概念）と更新履歴の古い項目：95% | 文書内の食い違い。実機で確認 |
| サブエージェントの質問 | Claude Agent SDK の文書：AskUserQuestion はサブエージェントで使えない | 検索結果に、Claude Code の文書の記述と食い違うという GitHub の Issue があった（本文は未確認）。Copilot の文書は記述なし | 設計の前提（サブエージェントは質問できない）は安全側。未確認として扱う |
| スキルを呼ばせる難しさ | Skill-Use：スキルの検索（トリガー）が最大のボトルネック。説明文だけだと取りこぼす | Anthropic：説明文を「やや押しの強い」書き方に。Copilot：ユーザーは `/スキル名` で明示的に呼べる | クリエイターの聞き取りはユーザーが呼ぶ想定なので、トリガーの問題は小さい。ただし圧縮の後の再読込では「自分で呼び直す」必要が出る |

## 4. 考察のまとめ：クリエイターの SKILL.md の書き方への示唆

出典が直接言っていることではなく、上の出典を合わせた私の推論である。実機（Copilot CLI 1.0.98 ＋複数のモデル）での確認が要るものには「要確認」を付ける。

1. **本文は短く、先頭に最重要の規則を置く**。約5,000トークン以内、先頭に「聞き取りの間のふるまい」「始めの動作」「状態の場所」を置く（A2、A7、C4）。詳細（各段階の聞き方、深掘りの型、例）は参照ファイルに分け、「いつ読むか」を書く（A3）。
2. **「聞き取りのスキルは質問が仕事」と最初に宣言し、ホストの「行動に偏れ」「100語以内」「Decide; don't ask」より優先すると明記する**（C1：スキルとユーザーの指示の優先順位を明示せよ、B8：ホストの指示）。止まる場所と止まらず進める場所を、一か所にまとめて書く（C1）。要確認：ホストの版がモデルごとにどう違うか。
3. **始めの動作を固定する**：スキルが読み込まれたら、まず状態ファイルを探して読み、あれば続きから、なければ新規で始める（B4：`ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE`、B5：`Review progress.txt, tests.json`）。圧縮や再開の後に手順が見えなければ、スキルを呼び直し、状態を読み直す（B8の runtime 文字列。要確認）。
4. **「ユーザーが答えるたびに、状態へ書く」を標準の動作にする**（B4：`ASSUME INTERRUPTION`）。質問を出す前に状態を更新し、答えを受けたらすぐ更新する。会話の記憶に頼らない。
5. **状態は二つに分ける**：(a) 聞く項目の一覧と進み（項目→未確認／確認済／保留、いまの項目は1つだけ）は構造化（JSON か SQL の表）。(b) ユーザーの言葉・経過・仮の推測は文章（B5：構造は JSON、経過は文章。B2：Markdown は書き換わりやすい）。**仮の推測は「仮」と印を付けて残す**（E：早い段階の思い込みが原因）。
6. **状態の更新はスクリプトで検証する**：項目名の綴り、状態の遷移（未確認→確認済は、ユーザーの答えの引用がある時だけ）、残りの項目数を、スクリプトが検査して、誤りには「使える値の一覧」を返す（A1、A3、SKILL.state）。安いモデルが形式を崩しても直るようにする。要確認：Copilot でスクリプト実行が許可される範囲、実行の費用。
7. **終える判断は「残りゼロ」の検査＋ユーザーの確認**：生成へ進む関門を置き、未確認の項目が残るか、ユーザーが「これでよい」と答えるまで先へ進まない（B2：`declare the job done`、C2：`only finish ... once the user has confirmed`、E：早すぎる最終案）。
8. **再提示は要所だけ、状態から再構成する**：全面の復唱を毎回せず、(a) 段階の切り替わり、(b) 再開・圧縮の直後、(c) 生成の直前、に状態を読み直して要約し、ユーザーに「ここまでを確認します」と見せる（E の VerIFY／Snowball の効果と、C1 の「繰り返しは不要な確認を増やす」の両立。要確認：効果と費用は外側の EVAL で測る）。
9. **「勝手に先へ進まない」は、禁止の形と必須の手順の形に分けて書く**。禁止（「答えを受け取るまで次の段階へ進まない」）は守られやすい（Skill-Use）。必須の手順は短く・状態の検査で縛る。一般の指示は理由つきで書き、**壊してはならない少数の不変条件だけ強い言葉にする**（A3、A8、B2、A1 のバランス）。
10. **質問の形はホストの作法に合わせる**：1回に1つの話題、`default` に推奨、`description` に理由、いつでも自由回答（D2）。答えが `decline`（答えない）や `cancel`（中止）の時の動作を決める。ツールが使えない時は番号付きの文章で聞く。**自律モードや `--no-ask-user` では聞き取りを始めず、対話モードで開き直すよう伝える**（D2。要確認：実機で自律モードのときに何が起きるか）。
11. **ユーザーに見せる言葉は、スキルの内部用語を使わない**：専門用語を避ける指示は、そのまま文面として書ける（C1：`Use plain language over jargon` の例）。「100語以内」というホストの指示と衝突するので、聞き取りの質問では「背景と目的を先に書く」を優先すると明記する（CLAUDE.md の質問の規則との整合は設計側で判断）。
12. **仕事の分け方**：ユーザーに聞くのはメインのエージェントだけ（D1、D2）。サブエージェントは「ナレッジの一覧の整形」「ファイルの読み取り」「生成」のような、質問が要らない仕事を、短い要約を返す形で担う（B1：サブエージェントは `condensed, distilled summary` を返す）。聞き取りが終わった所で、生成を別の窓に分ける（B6）。
13. **スキルの手順の更新は、外側の EVAL で、複数のモデル（最も安いものを含む）で測る**（A1：全モデルで試す、B3：不要な部品は削れる）。実行の記録を読み、守られなかった規則をスキルの「落とし穴」に足す（A3）。
14. **ホスト側の不確かさへの備え**：圧縮の後にスキル本文が残るか（Copilot は不明）、`todos` の SQLite と plan.md と `files/` のどれが圧縮・再開に最も強いか、を実機で確かめる（第6章）。常に守りたい規則は、フック（`sessionStart` の `additionalContext`、`agentStop` の `block`）に出す選択肢がある（A7、B8。プラグインから使えるかは要確認）。

## 5. 設計で決めること 1〜11 への対応と確信度

| # | 決めること | 効く情報 | 確信度 | 理由 |
| --- | --- | --- | --- | --- |
| 1 | 対話の段階と順番 | B6（聞き取り→仕様→新しい窓）、B8（プランモードは聞く→計画→承認）、C1（承認は具体的な結果ができてから）、E（早すぎる最終案の失敗）、B3（段階ごとに"済"の定義） | 中 | 型は公式にあるが、クリエイター固有の順番は他の担当の調査と設計判断による |
| 2 | 質問の形 | D1、D2（ツールの仕様）、C2（1〜3問）、ホストのプロンプトの ask_user の作法 | 高（ツールの仕様）／中（何問が良いか） | ツールの仕様は実物で確認。最適な問数の公式の勧めは見つからなかった |
| 3 | あいまいな答えの見分け方・聞き直し・「分からない」 | C2（`Present 2–3 plausible interpretations with clearly labeled assumptions`）、C3（Fable 5.1：仮定を明示するか、進捗と一緒に質問を末尾に置く）、C4（`consult the user to even know whether something is applicable`） | 低 | 深掘りの型・回数の上限・「分からない」への対応に当たる公式の勧めは、ほとんど見つからなかった（他の担当の領域） |
| 4 | 聞き漏らし・聞き終える判断・疲れ | B2（一覧を未達で作り、検査で"済"にする）、C2（ユーザーが確認するまで終えない）、B6（`Keep interviewing until we've covered everything`）、Copilot 自律モードの文書（相談が多い仕事は対話モード） | 中 | 網羅の確認の型は公式にあるが、飽和・疲れ・質問数の目安は見つからなかった |
| 5 | ナレッジの残し方 | B2・B5（構造化＋文章）、B7（決定のログ、いつでも再開できる）、B4、B9、SKILL.state | 高（仕組み）／低（ユーザーの言葉をどこまで残すか） | 仕組みの勧めは多い。残す範囲は公式にない |
| 6 | 長い対話の状態の保ち方（圧縮・中断・再開） | B1〜B8、A4、A7、E 全体、1.0.98 の文字列 | 高（方針）／中（Copilot での細部） | 方針は各社一致。Copilot の圧縮後のスキル本文の扱いと、再開時の挙動は実機未確認 |
| 7 | ファイルを読んで決まりを推し量る | A3（`Synthesize from existing project artifacts`、`Extract from a hands-on task`） | 低 | 直接の勧めはスキル作成の文脈のみ |
| 8 | 仕事の分け方とモデル | B1（サブエージェントは要約を返す）、D1（サブエージェントでは質問できない）、B6、B8 | 高 | 質問をメインに残す設計の裏づけは強い |
| 9 | 分かりやすい伝え方 | C1（平易な言葉を指示する文例）、C3（Fable 5：`Lead with the outcome`）、ホストの「100語以内」との衝突 | 中 | 文例はあるが、日本語の非専門家向けの検証はない |
| 10 | どの質問が効いたかの記録 | A3（`Read agent execution traces`）、A1（評価を先に）、Skill-Use（軌跡の採点基準）、B2（進捗ファイル） | 中 | 記録の形そのものの勧めは見つからなかった |
| 11 | 安いモデルでも守られる書き方 | A1、A3、A6、C3（Haiku 5.5／Sonnet 5.5）、C2、E（SkillsBench、Skill-Use、SKILL.state）、第2章F | 高（方向）／中（個別の効果） | 方向は各社一致。Luna 級の GPT 系の小さいモデル向けの公式の勧めは、GPT-6 の文書に「評価して選べ」しか見つからなかった |

## 6. 見つからなかったこと・未確認（探した場所つき）

- **GitHub Docs に、スキル本文が圧縮の後も保たれる仕組みの説明**：A5 の2ページ、Context management、CLI best practices、Hooks reference を読んだ。更新履歴 0.0.399 の1行のみ。1.0.98 の runtime 文字列に「Previously used skills」の注意書きがあるが、出る条件は文字列から特定できなかった。
- **Copilot CLI でサブエージェントが ask_user を使えるか**：コマンド一覧、カスタムエージェントの文書、更新履歴を検索（`ask_user`／subagent）。記述なし。
- **「質問は1つずつ」「何問まで」の公式の勧め**：Anthropic・OpenAI・Google の文書にない。ツールの上限（Claude 1〜4問）と、OpenAI GPT-5.2 の「1〜3問」、Copilot の「1つの話題」のみ。
- **聞く側の AI が長い聞き取りで指示を守る度合いを測った研究**：検索（multi-turn、skill adherence、2026）で、聞かれる側／情報を小出しにされる側の研究（Lost in Conversation など）と、スキルの遵守（Skill-Use）しか見つからなかった。聞き取り（AI が質問する側）の長い会話を直接測った研究は見つからなかった。聞き取りの手法そのものは他の担当の領域。
- **Gemini 向けの「質問のツール」「スキル」の公式の勧め**：ai.google.dev の2ページと検索のみ。Gemini CLI は調べていない。
- **OpenAI の Codex で、圧縮の後にスキル本文が残るか**：Codex のスキルの文書、長い仕事の文書、圧縮の文書に記述なし。
- **公開日の分からない公式ページ**：A1〜A7、B4〜B6、C1、C3、D1 は日付表示なし。内容（モデル名、ベータ版のヘッダーの日付）から 2026年7〜10月の版と推定できるものがあるが、確定ではない。
- **実機での確認が要ること**（私はモデルを動かしていない）：
  1. Copilot CLI 1.0.98 で、スキルを呼んだ後に `/compact` し、次の要求にスキル本文が残るか（`events.jsonl` と送信記録で確認）。「Previously used skills」の文が出る条件。
  2. 圧縮の要約に、状態ファイルのパスと「どの項目が済か」が入るか（安いモデルで）。
  3. 自律モード・`--no-ask-user` での ask_user の挙動と、聞き取りスキルの止まり方。
  4. 使うモデルごとの、ホストのシステムプロンプトの差（「100語以内」「行動に偏れ」の有無）。
  5. 状態の置き場所（session の `files/`、SQLite の `todos`、作業ディレクトリ）ごとの、圧縮・再開・`/new` への強さ。
  6. 低い effort の Haiku 級・Luna 級で、本文の長さ（短い版と長い版）による守りの差。

## 7. 出典一覧（取得日 2026-10-20）

一次（公式ドキュメント・公式リポジトリ・論文・パッケージ）：
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices （＋ prompting-claude-sonnet-5-5、-haiku-5-5、-fable-5、-fable-5-1、-opus-5）
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- https://code.claude.com/docs/en/skills 、/memory 、/context-window 、/best-practices 、/agent-sdk/user-input 、/tools-reference
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents （2025-09-29）
- https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents （2025-11-26）
- https://www.anthropic.com/engineering/harness-design-long-running-apps （2026-03-24）
- https://www.anthropic.com/engineering/building-effective-agents （2024-12-19。**古い**。「Workflows are systems where LLMs and tools are orchestrated through predefined code paths.」「we recommend finding the simplest solution possible」。補足としてのみ使用）
- https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md
- https://agentskills.io/specification 、/skill-creation/best-practices.md 、/client-implementation/adding-skills-support.md 、/skill-creation/using-scripts.md
- https://docs.github.com/en/copilot/concepts/agents/about-agent-skills 、…/how-tos/copilot-cli/customize-copilot/create-skills 、…/concepts/prompting-and-context/context-management 、…/how-tos/copilot-cli/cli-best-practices 、…/how-tos/copilot-cli/use-copilot-cli/chronicle 、…/concepts/agent-capabilities/agent-powered-workflows-and-operations/autopilot 、…/reference/hooks-configuration 、…/reference/copilot-cli-reference/cli-command-reference 、…/concepts/security-governance-and-network-settings/session-data 、…/concepts/prompting-and-context/copilot-memory
- https://github.com/github/copilot-cli/blob/main/changelog.md
- パッケージ `@github/copilot` 1.0.98：別担当の抽出物 `/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/cli/runtime.strings` と `…/cli/captures/i1-gpt41-tui.system.txt`、`i1-gpt41-tui.tools.json`
- https://developers.openai.com/api/docs/guides/prompt-guidance （Using GPT-6／GPT-5.6）、https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide 、…/gpt-5-1_prompting_guide 、…/gpt-5-2_prompting_guide 、https://developers.openai.com/cookbook/articles/codex_exec_plans 、https://developers.openai.com/api/docs/guides/compaction 、https://developers.openai.com/codex/skills 、https://developers.openai.com/codex/long-running-work 、https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex 、https://developers.openai.com/api/docs/guides/model-selection 、https://openai.github.io/openai-agents-python/sessions/ 、…/sandbox/memory/
- https://ai.google.dev/gemini-api/docs/prompting-strategies 、https://ai.google.dev/gemini-api/docs/gemini-3
- arXiv：2505.06120、2402.10962、2307.03172、2507.11538、2501.17399、2602.12670、2608.04828、2608.26263、2606.30306（参照のみ）。ACL Anthology：2026.findings-eacl.254、2026.acl-long.433。Chroma：https://research.trychroma.com/context-rot

二次（ブログ・検索結果の要約）：
- Manus：https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus （2025-07-18）
- WebSearch の要約（kocpc.com.tw の GPT-6 Astra の紹介、Atlabs の GPT-5.2 の紹介など）：一次で確かめられた事項のみ採用し、それ以外は採用していない。
