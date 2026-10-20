# A. Copilot CLI で「長い聞き取りの対話」を支える仕組み（Copilot CLI 1.0.98 の事実）

- 調べた日：2026-10-20。対象：`@github/copilot` 1.0.98（`@github/copilot-linux-x64` 1.0.98、buildMetadata.gitCommit `45ef16251c8`）。
- 調べ方（一次情報）
  1. **実際に動かした結果**：ログインせずにオフラインのモードで偽物のモデルにつなぎ（`COPILOT_OFFLINE=true` ＋ `COPILOT_PROVIDER_BASE_URL`）、Copilot CLI がモデルに送ったリクエスト本文を全部ファイルに記録した。対話モード（TUI）は Python の pty と端末エミュレーター pyte で実際に動かし、画面を文字で取った。Copilot SDK（パッケージ同梱の `copilot-sdk/index.js`）でも動かした。
  2. **パッケージの中身**：実行ファイルに埋め込まれた `copilot.tgz` を取り出した（`changelog.json`、`copilot-sdk/*.d.ts`、`definitions/*.agent.yaml`、`builtin-skills/`、`prebuilds/linux-x64/runtime.node` の文字列）。
  3. **公式ドキュメント**（docs.github.com、2026-10-20 にアクセス。日付の表示なし）と **公式の changelog**（github.com/github/copilot-cli の changelog.md、npm の公開日）。
- 注意（この調べ方の限界）：ログインしていないので、すべて **BYOK（自前のモデルの窓口）経路** での観測である。GitHub の Copilot API（CAPI）経由のときに、送られる本文・キャッシュの方式・メモリ機能などが同じかは確かめていない。プロンプトの組み立ては手元のランタイムで行われているが、CAPI 経路だけの分岐がないことは確認していない。
- 再現用の道具とログ：`/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/cli/`（下の「再開のチェックリスト」に使い方）。
- 原文の付録：
  - `/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/A-appendix-1-ask_user.md`（ask_user の2つの版のスキーマ・説明文・システムプロンプトの節、ツールの結果の原文、TUI の画面）
  - `/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/A-appendix-2-skill-compaction.md`（スキルの載せ方、圧縮のプロンプト全文、圧縮後の履歴、文脈の管理のツール）
  - `/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/A-appendix-3-builtin-prompts.md`（plan モード、autopilot、モデルごとの違い、サブエージェント、カスタムエージェントの入り方）
  - 生のリクエスト本文：`research/cli/logs/<実験名>/NNN-*.json`、抜き出したもの：`research/cli/captures/`

## 状態の一覧

| 問い | 状態 |
| --- | --- |
| 1. ask_user | 確定（未確認の細部あり） |
| 2. スキルの読み込みと持続 | 確定 |
| 3. 会話の圧縮 | 確定（上限の有無など一部途中） |
| 4. 中断と再開 | 確定 |
| 5. 費用と速さ | 途中（BYOK の観測のみ。CAPI 未確認） |
| 6. ファイルの受け渡し | 確定（貼り付けの扱いは未着手） |
| 7. サブエージェント | 確定 |
| 8. モデルによる違い | 確定（BYOK でのモデル名による違い） |
| 9. 組み込みの手本 | 確定 |
| 10. changelog 1.0.98〜1.0.101 | 確定 |

---

## 1. 質問のツール `ask_user`（確定）

### 事実

1. **ask_user には形の違う2つの版があり、どちらを使うかは実行の形で決まる。**
   - 対話モード（TUI）は **elicitation（フォーム）版**：引数は `message`（文字列）と `requestedSchema`（`properties` に項目を並べる JSON Schema）。（実測：`captures/i1-gpt41-tui.tools.json`）
   - Copilot SDK の既定は **legacy 版**：引数は `question`（文字列、必須）と `choices`（文字列の配列、任意）だけ。（実測：`captures/s1-gpt41-sdk-legacy.tools.json`。SDK の型 `AskUserVariant = "legacy" | "elicitation"`、`askUserVariant` の既定は `"legacy"`：`copilot-sdk/types.d.ts` 1.0.98）
   - changelog 1.0.80-0：「Show structured ask_user forms by default in interactive CLI sessions」（`changelog.json`）。
   - TUI で legacy の形（question/choices）で呼ぶと失敗し、`Invalid input: This session uses the structured ask_user format. Call ask_user again with {message, requestedSchema}.` が返る（実測 logs/i3）。
   - **13のモデル名すべてで、TUI の ask_user の定義とシステムプロンプトの `<ask_user>` 節は同じ**（md5 一致。問い8）。
2. **elicitation 版でできること**（スキーマとシステムプロンプトの原文は付録A-1）
   - 1回の呼び出しで **複数の項目（質問）を1つのフォームにまとめられる**。項目の種類：選択肢つき文字列（`enum`、または値と表示名の `oneOf`）、複数選択（`type: array`）、はい／いいえ（`boolean`）、自由入力の文字列、数値。各項目に `title`、`description`、`default`。
   - **自由回答はいつでもできる**：スキーマの説明に「The user can also provide a freeform answer」。画面では選択肢の最後に必ず「Other (type your answer)」が出る（実測 i2、i3）。システムプロンプトは「Do NOT include "Other"…」は legacy 版の文で、elicitation 版の節では enum について「The user can still provide a freeform answer」。
   - **推奨の印**：elicitation 版の指示は「if you recommend a specific option, make it the default」。画面では default の選択肢にカーソルが合うだけで、特別な「推奨」の印は出ない（実測 def）。legacy 版の指示は「make that the first choice and add "(Recommended)" to the label」。
   - 指示の原文の要点：「**IMPORTANT: Never ask questions via plain text output.** When you need input from the user, use this tool instead of asking in your response text.」「Keep forms focused on one topic — don't mix unrelated questions in a single form」「A single-field form is perfectly fine」。legacy 版の指示は「Ask one question at a time - do not batch multiple questions」。
3. **画面での見え方（TUI、実測。画面は付録A-1 4章）**：入力欄の上に「Copilot needs information.」＋ message ＋ 項目のタブ（`[Goal of the job]  Last time you did it`）。選択肢は ↑↓、Enter で確定、Tab で次の項目、Ctrl+D で decline、Esc で cancel。自由入力の項目は入力欄が出る。確定後はタイムラインに `● Asked user <message>` と `goal: Review code` のように答えが残る。message の Markdown（`**…**`）は文字のまま見えた（pyte の画面で見た範囲。色や太字は pyte では分からない）。
4. **モデルに返る結果（原文）**：確定は `User responded: goal=Review code, lastTime=I write it every Monday.`（oneOf は表示名ではなく値が返る）。Esc は `User cancelled the request.`。**Ctrl+D（decline）は `The user is not available to respond and will review your work later. Work autonomously and make good decisions. …`** で、画面には「Making best guess on autopilot」と出る（TUI と SDK の両方で実測：i5、s6）。全体の表は付録A-1 3章。
5. **2つの ask_user を同時に呼ぶと、1つずつ順に聞かれる**（実測 par）。
6. **モードと引数での違い（実測）**

   | 実行の形 | ask_user | 呼んだときの結果 | 出典 |
   | --- | --- | --- | --- |
   | 対話モード（TUI） | あり（elicitation 版） | ユーザーに聞く | i1, i2 |
   | `-p`（非対話） | **ない** | システムプロンプトの1行目が「You are running in non-interactive mode and have no way to communicate with the user. … Do not stop to ask questions」 | t1 |
   | `--no-ask-user`（TUI） | ない。`<ask_user>` 節も消える | `Tool 'ask_user' does not exist.` | i8-noask |
   | autopilot（`--autopilot`） | ある。ただし聞かれない | decline と同じ「The user is not available…」が自動で返る。`task_complete` ツールが加わり、モデルが task_complete を呼ばずに手番を終えると継続の催促が最大5回送られる（`--max-autopilot-continues` 既定5） | i6-autopilot |
   | plan モード（`--plan`） | ある | ユーザーに聞く。plan モードの指示が「use the ask_user tool to confirm understanding」「Before finalizing a plan, use ask_user to confirm any assumptions」と ask_user を使わせる（原文は付録A-3） | i7-plan |
   | SDK で `onUserInputRequest` なし | ない | — | s7 |
   | SDK で `onUserInputRequest` あり | legacy 版 | `User selected: …` / `User responded: …` | s3 |
   | SDK で `askUserVariant: "elicitation"` ＋ `onElicitationRequest` | elicitation 版（TUI と同じ） | TUI と同じ文 | s2, s6 |

7. **サブエージェントからは使えない**：組み込みの explore／task／general-purpose、カスタムエージェント（`tools` に `ask_user` を書いても）のどれでも、ツールの一覧に ask_user が入らず、呼ぶと `Tool 'ask_user' does not exist.`（実測 sub1、sub2）。一方、**カスタムエージェントを `--agent` でメインに選んだ場合は、`tools` に書いた ask_user が使える**（実測 agentmain）。
8. **文章で質問して手番を終えた場合との違い**（実測から言えること）
   - ユーザーの返事は「ユーザーが打ったメッセージ」になる。**圧縮の後も原文で残るのはこちらだけ**で、ask_user の答え（tool の結果）は要約にしか残らない（問い3）。
   - リクエストの見出し `x-initiator` は、ask_user の答えを受けた次の呼び出しが `agent`、ユーザーが打った後の呼び出しが `user`（実測 cache-claude）。費用への影響は確かめていない。
   - システムプロンプトは全モデルで「Never ask questions via plain text output」と文章での質問を禁じている。gpt-5.5 には「then stop—no recap, optional extras, offer to continue, or follow-up question」もある（付録A-3 7-3）。
   - autopilot では文章で手番を終えると継続の催促が送られ、ユーザーには届かない（実測 i6-autopilot）。
9. SDK で EVAL を組むときの注意：SDK の既定（legacy）は TUI（elicitation）と **ツールの形もシステムプロンプトも違う**。ユーザーが実際に使う TUI を模すには `askUserVariant: "elicitation"` と `onElicitationRequest` を指定する必要がある（types.d.ts、実測 s2・s6）。
10. 公式ドキュメント：コマンドリファレンスに「`--no-ask-user` Disable the ask_user tool (the agent works autonomously without asking questions).」「ask_user | Ask the user a question」（https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference、2026-10-20）。elicitation 版や decline の結果の文は、ドキュメントに見つからなかった（同ページを ask_user で検索）。

### 確かめ方（抜粋）

```bash
# TUI を pty で動かし、偽物のモデルに ask_user を呼ばせて画面と次のリクエストを取る
research/cli/tuirun.sh i2 research/cli/handlers/steps.js gpt-4.1 18106 research/cli/steps/ask1.json -- -i '<#STEPS:[{"name":"ask_user",...}]#END を含む文>'
# → logs/i2/002-*.json の messages[3] (role=tool) = "User responded: goal=Review code, lastTime=I write it every Monday."
```

### 分からなかったこと

- elicitation 版で項目を何個まで並べられるか、長い message がどう折り返されるか（試していない）。
- Ctrl+D（decline）が autopilot と同じ文になるのが意図した仕様か不具合か（ドキュメントに記述なし）。
- 画面での Markdown の描画（pyte は色・太字を落とすため、`**` が文字で見えたことしか言えない）。
- Windows や他の端末での見え方。

---

## 2. スキルの読み込みと持続（確定）

### 事実

1. **最初にシステムプロンプトに入るのは一覧だけ**：`<available_skills>` に name・description・location（project／builtin など）。本文は入らない（付録A-2 2章）。
2. **モデルが `skill` ツールを呼ぶと**：tool の結果は定型文 `Skill "interview" loaded successfully. Follow the instructions in the skill context.` で、**SKILL.md の本文（フロントマターを除く）は直後の role=user のメッセージ `<skill-context name="…">` として会話の履歴に入る**。システムプロンプトには入らない（実測 i9-skill。原文は付録A-2 3章）。
   - `<skill-context>` の先頭に「Base directory for this skill: …」と「Related files (use view tool to read):」としてスキルのフォルダ内の別ファイルの **絶対パスだけ** が並ぶ。`references/` の中身は入らず、モデルが `view` で読むと tool の結果として入る（実測）。
   - ユーザーが `/interview 引数` と打った場合は、user メッセージが「The user explicitly invoked the "/interview" skill. Follow its instructions now.」＋ `<skill-context>` ＋末尾に `ARGUMENTS: 引数` になる（実測。付録A-2 4章）。
   - skill ツールの説明文：「If a skill matches, invoking it is mandatory and must be your first action」「Do not reinvoke a running skill」（付録A-2 1章）。
   - 公式ドキュメント：「When Copilot chooses to use a skill, the SKILL.md file will be injected in the agent's context」（https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills、2026-10-20）。
3. **何十往復しても本文は履歴に残る**（履歴は毎回全部送られるため。問い5）。**圧縮の後も「最後に呼ばれたスキル」の本文は残る**（`<invoked_skills>` の「## Most recent skill: …」「Continue to follow these instructions:」。問い3）。ランタイムには「### Retained skill:」という文字列もあり、複数のスキルを残す仕組みがあるとみられるが、複数スキルでは試していない。
4. **本文は呼ばれた時点の写しが使われる**：スキルを読んだ後に SKILL.md を書き換えて圧縮しても、圧縮後の `<invoked_skills>` は古い本文のまま（実測 c1）。再開（`--resume`）でも履歴の中の古い本文がそのまま戻る（実測 r1b、r4）。セッションの記録 `events.jsonl` の `skill.invoked` に本文が保存されている。
5. **長さ**：100KB（1,500行）の本文も切られずにそのまま入った（実測 t4-bigskill、`-p`）。ファイル型スキルの本文の上限は、ランタイムの文字列からも見つからなかった（SDK の skill provider には上限のエラー文があるが、値は不明）。推奨は Agent Skills の仕様に「Instructions (< 5000 tokens recommended)」「Keep your main SKILL.md under 500 lines」「the agent will load this entire file once it's decided to activate a skill」（https://agentskills.io/specification、2026-10-20）。Copilot CLI 独自の推奨はドキュメントに見つからなかった。
6. サブエージェント（task、general-purpose）にも `skill` ツールと同じスキル一覧がある。explore にはない（実測 sub1）。

### 分からなかったこと

- 複数のスキルを順に呼んだとき、圧縮後にいくつ残るか（「Retained skill」の条件）。
- `--dynamic-retrieval skills=on`（埋め込みでスキル一覧を絞る）のときの一覧の変わり方。
- プラグインのスキル（`plugin:skill` の名前）の場合の `<skill-context>`。形は同じと見込まれるが試していない。

---

## 3. 会話の圧縮（compaction）（確定。一部途中）

### 事実

1. **自動の圧縮が始まる条件**：モデルの入力の上限（maxPromptTokens）の **約80%** で裏で始まり、約95%に達すると終わるまで待つ。
   - SDK の型：`backgroundCompactionThreshold` 既定 0.80、`bufferExhaustionThreshold` 既定 0.95（`copilot-sdk/types.d.ts` の `InfiniteSessionConfig`）。
   - 実測（s5）：上限 40,000 で `currentTokens 32199`（80.5%）のときに `trigger: "threshold"` で始まった。
   - 公式：「when your conversation reaches approximately 80% of the context window's capacity」「If the context fills to approximately 95% before compaction finishes」（https://docs.github.com/en/copilot/concepts/agents/copilot-cli/context-management）。一方、別のページは「When your conversation approaches 95% of the token limit, Copilot automatically compresses」（https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli）。**ドキュメントどうしが食い違う**。実測は80%。
   - 上限はモデルで決まる（BYOK の gpt-4.1 は `maxPromptTokens: 128000`：SDK の `assistant.usage` イベント）。
2. **圧縮の仕方**：同じモデルに、システムプロンプト＋全履歴＋要約のお願い（全文は付録A-2 5-1）を `tool_choice: "none"` で送り、返った要約で履歴を置き換える。**要約を書くのはユーザーが選んだモデル**（`behaviorModelId`）で、要約のプロンプトはモデルで変わらない（gpt-4.1 と claude-sonnet-5.5 で一致）。圧縮の費用もクレジットに数えられる（`copilot help limits`：「Hidden model work such as compaction counts toward --max-ai-credits」）。
3. **圧縮の後に残るもの・消えるもの（実測 i10、s5、s8、compact2）**

   | もの | 圧縮の後 |
   | --- | --- |
   | システムプロンプト（カスタムインストラクション、`--agent` で選んだカスタムエージェントの本文を含む） | 毎回作り直されるので残る |
   | ユーザーが打ったメッセージ | **全部、原文で残る**（`<user_message>` で並ぶ） |
   | 最後に呼ばれたスキルの本文 | 残る（`<invoked_skills>`、呼ばれた時点の写し） |
   | todo（セッションの SQL の `todos`） | 残る。以後の user メッセージに `<system_reminder><todo_status>Todos: 1 pending…` が付く |
   | セッションの SQL の自作の表、セッションのフォルダのファイル | ディスクにあるので残る（モデルが読み直す必要あり） |
   | ask_user の答え（tool の結果） | **原文は消える**（要約にだけ残りうる）。実測で目印 `ANSWER-n-MARKER`／`ELICIT-ANSWER-MARKER` が0件 |
   | view などで読んだファイルの中身、ツールの結果、アシスタントの発言 | 消える（直前のアシスタントの発言は残った例あり：s5） |
   | 要約 | `<summary>` として1つ。次の圧縮では前の要約も入力に入り、要約は1つに保たれる |

   公式：「Replaces the old conversation history with the summary, along with any original user instructions and the current state of any plans or to-do lists.」「fine-grained details—such as the exact wording of every message, the full output of every command」は失われる（context-management のページ）。
4. **ユーザーが打ったメッセージは削られずにたまり続ける**：上限 30,000 の試験で4回圧縮すると、圧縮後の大きさが 11,598 → 13,418 → 14,713 → 16,051 トークンと増え、圧縮の間隔が短くなった（実測 s8）。打ったメッセージの数や長さに上限があるかは見つけられなかった（途中）。
5. **圧縮のたびにチェックポイントが保存される**：`session-state/<id>/checkpoints/001-<title>.md` と `index.md`。システムプロンプトに「Checkpoints (read those relevant to your current task): 001-… 」が加わる（付録A-2 6-1）。`/session checkpoints` で見られる（公式）。
6. **`/compact`**：手動で同じ処理（実測 i10）。Esc で取り消せる（公式）。
7. **圧縮の後も手順や決まったことを保つための公式の仕組み**（実測とドキュメントで確認できたもの）
   - セッションのフォルダ（下の問い4）：システムプロンプトに「Session folder: …/session-state/<id>」「files/: Persistent storage for session artifacts … files/ persists across checkpoints」と書かれる。
   - plan モードの `plan.md`（セッションのフォルダに保存。plan モードの指示に明記）。
   - セッションの SQL（`sql` ツール）：`todos`／`todo_deps` は組み込み、ほかの表も作れる。システムプロンプトの例に `session_state` の表。todo の状態は圧縮後も自動で知らされる。
   - カスタムインストラクション（AGENTS.md など）とカスタムエージェントの本文はシステムプロンプトに入る（`<custom_instruction>`、`<agent_instructions>`）。
   - **既定ではオフ**の「文脈の管理のツール」（設定 `contextManagementTools: true`）：`session_artifacts`（`checkpoint.md` に回復用の状態を書く）、`get_context_remaining`、`session_history`、`new_context`。オンにするとシステムプロンプトに `<session_memory_v2>` 節が加わる（実測 cmt。原文は付録A-2 7章）。`copilot help config` には載っていない。changelog 1.0.85「Add /settings options to opt in to context management tools for agents and subagents」。ユーザーの設定であり、プラグインから有効にできるかは確かめていない。
   - Copilot Memory（`store_memory` など、セッションをまたぐ記憶）：ドキュメントに「Only the root agent can call store_memory」とある。オフラインでは道具が出ず、試せなかった。

### 分からなかったこと（途中）

- 打ったメッセージの保存に上限や切り詰めがあるか（ランタイムに「messages omitted ...」の文字列はあるが、どこで使われるか不明）。
- 要約の質（本物のモデルでの要約の中身）。偽物のモデルなので確かめられない。
- CAPI 経路での上限の値（モデルごとの maxPromptTokens）。

---

## 4. 中断と再開（確定）

### 事実

1. **`--resume=<id>`、`--continue`（最後のセッション）で、履歴は全部戻る**：スキルの `<skill-context>`、ask_user の答え、ツールの結果を含めて同じ並びで送られた（実測 r1b）。圧縮済みのセッションは、圧縮後の形（要約＋打ったメッセージ＋`<invoked_skills>`）で戻る（実測 r4）。
2. **セッションのフォルダは同じものが使われる**：システムプロンプトの「Session folder」が再開前後で同じ（実測 r1）。中身は `events.jsonl`（全部の記録）、`workspace.yaml`、`session.db`（セッションの SQL）、`checkpoints/`、`files/`、`plan.md`（作った場合）など。公式の best practices にも同じ構成図（https://docs.github.com/en/copilot/how-tos/copilot-cli/cli-best-practices）。SDK では `session.workspacePath` がこのフォルダ（実測 s3。型の説明「Contains checkpoints/, plan.md, and files/ subdirectories」）。
3. **セッションの SQL は再開しても残る**：自作の表 `interview_state` を翌日の想定で `--continue` して読めた。todo の状態の知らせも付いた（実測 r3）。
4. **`/clear` は新しいセッションになる**：新しい ID・新しいセッションのフォルダ。履歴もスキルも消え、前のセッションの SQL やフォルダも見えなくなる（実測 c1。画面：「Started a fresh session.」）。公式：「Use /clear or /new between unrelated tasks. This resets context」。
5. **ask_user の答えは `events.jsonl` に構造のまま残る**：`human_response.recorded` に `responseKind: "ask_user"`、`content: {"goal": "Write reports"}`、`message`、`requestedSchema`（実測 cache-claude）。`skill.invoked` には本文。
6. 古いセッションは `/session prune --older-than 30` などで消せる（ランタイムの文字列。自動で消えるかは未確認）。
7. **翌日に確実に戻すための置き場所（事実から言える範囲）**：同じセッションを `--continue`／`--resume` すれば履歴・SQL・`files/` は戻る。ただし、ユーザーが `/clear` や新しいセッションで始めると、セッションのフォルダと SQL には届かない（ID を知らなければ）。セッションをまたいで確実に残すには、セッションの外（作業フォルダのファイルや、クリエイターのエクステンションの記録）に置く必要がある。どれを使うかは設計の判断。

### 分からなかったこと

- `/resume` の一覧から別のセッションに切り替えたときの細かい挙動（`--resume`／`--continue` と同じと見込むが未確認）。
- 再開時にプラグインの版が変わっていた場合のスキルの扱い（履歴の古い本文が使われることは確認。新しい本文が足されるかは未確認）。

---

## 5. 長い対話の費用と速さ（途中）

### 事実（BYOK での実測）

1. **毎回、システムプロンプト＋ツール定義＋全履歴が送られる**（chat completions、anthropic、responses の3形式とも）。1往復（ask_user の1問）ごとに、答えを tool の結果として付けた全体がもう一度送られる（実測 s3、cache-claude）。
2. 最初の1回の本文の大きさは、どのモデルでも約59〜63KB（うちツール定義の JSON が約32KB）（実測 model-*）。トークン数の内訳（gpt-4.1、SDK のセッション、ツール16個）：システム 5,297、ツール定義 4,241（圧縮イベントの値、s5）。elicitation 版の ask_user の定義だけで約6,500字、システムプロンプトの `<ask_user>` 節は約3,400字（legacy 版は約830字と約2,300字）。
3. **キャッシュの印**
   - Anthropic 形式（Claude）：システムプロンプトの2つのブロック、最後のツール（task）、**最後のメッセージ** に `cache_control: {"type":"ephemeral"}`。最後のメッセージの印は毎回後ろへ動く（実測 cache-claude）。
   - Responses 形式（gpt-5 系）：`prompt_cache_key` を付け、`store: false`（実測）。WebSocket の場合は `previous_response_id` で差分を送る仕組みがある（SDK の型の説明）が試していない。
   - chat completions 形式（gpt-4.1 など）：キャッシュの印はない（サーバー側の自動キャッシュの有無は確かめられない）。
   - `copilot help billing`：モデルの値段は「input, cached input, and output」の3つで示される。
4. 公式：BYOK では「For best results, use a model with a context window of at least 128k tokens」（best practices）。

### 分からなかったこと

- CAPI 経路（ユーザーの実際の環境）でのキャッシュの方式・ヒット率・実際のクレジット。オフラインでは費用が 0 と記録される（`aiCreditsStatus: "unavailable"`）。
- 1往復あたりのクレジットの目安（本物のモデルが要る）。

---

## 6. ファイルの受け渡し（確定。貼り付けは未着手）

### 事実

1. **`@ファイル` は中身を入れず、パスと行数だけを入れる**：user メッセージの末尾に `<tagged_files>\n* /…/README.md (2 lines)\n* /…/bigfile.txt (300 lines)\n</tagged_files>`。中身はモデルが `view` で読む（実測 atfile）。
   - 公式のショートカット表は「`@ FILENAME` Include file contents in the context.」（コマンドリファレンス）で、**実測と食い違う**（1.0.98 の BYOK の観測）。
2. **画像（`@red.png`）は base64 の画像として user メッセージに入る**（`image_url` の data URL）＋「Image file at path …」の文（実測、gpt-4.1）。`-p` では `--attachment` で画像や文書を付けられる（help）。
3. **大きいファイル**：`view` は20KBを超えるファイルを読まず `File too large to read at once (26.0 KB). Consider using the grep tool …, or view with view_range …` を返す（実測 t3-view）。ツールの説明に「Files over 20KB are truncated; use view_range」「forceReadLargeFiles」。ツールの出力が大きいときは一時ファイルに書いて参照を返す仕組みがあり、既定の上限は 51,200 バイト（SDK の `LargeToolOutputConfig`）。
4. 貼り付け（10行を超える貼り付けは画面では `[Paste #N - X lines]` に畳まれる：`copilot help config` の `compactPaste`）。モデルに全部送られるかは **未着手**。

---

## 7. サブエージェント（`task`）（確定）

### 事実（実測 sub1、sub2、agentmain と task ツールの定義）

1. **渡せるもの**：task ツールの引数は `name`、`description`、`prompt`、`agent_type`（explore／task／general-purpose／code-review／research／security-review と、カスタムエージェント）、任意で `model`（使えるモデルの列挙）、`reasoning_effort`、`context_tier`、`mode`（sync／background）。サブエージェントが受け取るのは **自分のシステムプロンプト＋prompt の1メッセージだけ**で、メインの会話は見えない（実測：サブエージェントの最初の要求は messages が2つ）。メインのシステムプロンプトにも「Give sub-agents comprehensive context」。
2. **返るもの**：サブエージェントの最後の文がそのまま task ツールの結果になる（実測：`SUB-GP-DONE` だけが返った）。
3. **並列**：1つの応答で3つの task を呼ぶと、3つの要求がほぼ同時に送られた（タイムスタンプの差 0.01 秒以内）。`mode: "background"` と `read_agent`／`write_agent` もある。
4. **モデルの指定**：task の `model` 引数、カスタムエージェントの `model`／`models`／`modelPolicy`、`/subagents` の設定。優先順位は公式に「an explicit per-call value, the subagents override in ~/.copilot/settings.json, the agent definition's model / models / reasoningEffort field, then the parent session's value」（コマンドリファレンス）。ただし task の説明文は「Specify a value only when the user's current request or applicable persistent custom instructions … explicitly require」と、モデルが勝手に指定しないよう指示している。
5. **ask_user は入らない**（問い1-7）。サブエージェントのシステムプロンプト（general-purpose）は「You are running in non-interactive mode and have no way to communicate with the user.」で始まる（付録A-3 9章）。research エージェントの定義も「Do NOT ask questions (to user or main agent)」。
6. カスタムエージェントの本文は、サブエージェントとして呼ぶとシステムプロンプトの先頭にそのまま入り、`--agent` でメインにすると `<agent_instructions>`（「treat them as subordinate to the organization, safety, and runtime instructions above」）に入る（付録A-3 8章）。本文の上限は公式に「The prompt can be a maximum of 30,000 characters.」（https://docs.github.com/en/copilot/reference/custom-agents-configuration）。サブエージェントは既定でリポジトリのインストラクションを受け取らない（`include-custom-instructions: true` で受け取る：コマンドリファレンス）。

---

## 8. モデルによる違い（確定。BYOK でのモデル名による違い）

### 事実（実測 model-*、13のモデル名。TUI の最初の要求）

1. **ask_user の定義とシステムプロンプトの `<ask_user>` 節は、全モデルで同じ**（md5 一致）。圧縮のプロンプトも gpt-4.1 と Claude で同じ。
2. **ツールの組み合わせ**：gpt-5.5、gpt-5.4-mini は `edit`／`create`／`grep` の代わりに `apply_patch`／`rg`。ほかは同じ18個。
3. **システムプロンプトの違い（聞き取りに関係するもの）**

   | 節 | ある モデル | 内容の要点 |
   | --- | --- | --- |
   | `<solution_persistence>` | gpt-4.1、gpt-5-mini | 「Be extremely biased for action. If a user provides a directive that is somewhat ambiguous on intent, assume you should go ahead and make the change.」— 聞き取りと逆向き |
   | `<user_progress_updates>` | claude-sonnet-5.5、claude-opus-5.5、gemini-3.8-flash、gemini-4-argon | 作業の途中経過を短く知らせる（Gemini 版は「Never make more than 8 tool calls in a row without providing a user-facing update」） |
   | 「Prioritize brevity…」 | claude-sonnet-5.5、claude-opus-5.5 | 返事を短く |
   | 「…then stop—no recap, optional extras, offer to continue, or follow-up question.」 | gpt-5.5、gpt-5.4-mini | 文章での追加の質問をしない |
   | `<tool_preferences>`、`<file_changes>` など | Claude 系・Gemini 系 | ツールの使い方 |

   claude-haiku-4.5、claude-sonnet-4.6、grok-4.7、kimi-k3 は上の聞き取りに関わる節を持たない（gpt-4.1 との違いはツールの好みなど）。原文は付録A-3 7章。
4. **要求のパラメータ**：Claude は `thinking: {type: "adaptive"}`、`output_config.effort: "medium"`、`temperature: 1`。gpt-5 系は `reasoning.effort: "medium"`。gpt-4.1 は `temperature: 0`。Gemini・grok・kimi・Claude（openai 形式）は `reasoning_effort`。
5. 使ったモデル名（`copilot help config` の一覧から）：gpt-4.1、gpt-5.5、gpt-5-mini、gpt-5.4-mini（responses）、claude-sonnet-4.6・claude-sonnet-5.5・claude-haiku-4.5・claude-opus-5.5（anthropic）、claude-sonnet-4.6（openai 形式）、gemini-3.8-flash、gemini-4-argon、grok-4.7、kimi-k3。`--experimental` ではツールが増える（canvas、manage_schedule、extensions_*）が、システムプロンプトの本文の差は見つからなかった（実測 exp）。

### 分からなかったこと

- CAPI 経路や Auto（モデルの自動選択）のときのプロンプト。モデル名で分岐していることは確認したが、CAPI 側の分岐は未確認。

---

## 9. 組み込みの手本（確定）

原文は付録A-3。要点：

1. **plan モード**：「If this is a new request or requirements are unclear, use the ask_user tool to confirm understanding and resolve ambiguity」「Before finalizing a plan, use ask_user to confirm any assumptions about: Feature scope and boundaries (what's in/out) / Behavioral choices (defaults, limits, error handling) / Implementation approach when multiple valid options exist」「After writing or updating plan.md, your turn must ALWAYS end with one of these tool calls: `ask_user` … `exit_plan_mode`」「Do NOT end your turn with a plain text response」「plan.md is the human-readable source of truth. SQL provides queryable structure for execution.」
2. **システムプロンプトの `<ask_user>` 節**の「When to STOP and ask (do not assume)」：設計の判断、振る舞いの質問、範囲のあいまいさ、複数の妥当な方法がある端のケース。
3. **security review の後の問い**：「use the ask_user tool (if available) to offer follow-up actions with these choices … If the ask_user tool is not available, present the follow-up options as a numbered list and ask the user to reply with their choice.」— ask_user がない場合の代わりの書き方の手本。
4. 組み込みスキル discover-resources：「Present a concise numbered list … Ask the user to choose a candidate explicitly. Stop after presenting the choices」。
5. 公式の説明：plan モードでは「asks clarifying questions to understand scope and requirements, and builds a plan before writing any code」（about-copilot-cli）。

---

## 10. changelog 1.0.98〜1.0.101 で関係するもの（確定）

出典：github.com/github/copilot-cli の changelog.md（2026-10-20 取得）、npm の公開日。**1.0.99 は試験版（1.0.99-0〜-3）だけで正式版はない**（npm の版の一覧）。1.0.98 は 2026-10-14、1.0.100 は 2026-10-19、1.0.101 は 2026-10-20。

| 版 | 変更（原文） | 関係する問い |
| --- | --- | --- |
| 1.0.101 | Switching only reasoning effort no longer forces compaction in over-budget sessions. | 3 |
| 1.0.101 | Resuming a session shows the conversation sooner without waiting for placeholder environment setup | 4 |
| 1.0.101 | Google models now avoid repeated request rewrites when screenshot-heavy sessions exceed image limits, reducing extra token usage. / Google model requests now respect registry image limits | 5, 6, 8 |
| 1.0.101 | Switching from GPT models to Gemini no longer fails when earlier turns include custom tool calls | 8 |
| 1.0.100 | Avoid false context exhaustion and rollover refusal when tool definitions are deferred | 3 |
| 1.0.100 | Custom agents that declare the documented `search`, `web` or `todo` tool aliases … now receive the matching tools | 7 |
| 1.0.100 | Gemini tool calls no longer fail when array parameters define enum values / Gemini chats no longer fail after earlier tool results contain no readable content. | 1, 8（ask_user の複数選択との関係は未確認） |
| 1.0.100 | Path-specific instruction files in the repository root .github/instructions are now applied automatically when the agent reads or edits a matching file | 3（インストラクション） |
| 1.0.100 | Use the unified Sessions browser by default for /sessions, /session, and /resume. | 4 |
| 1.0.100 | A skill `allowed-tools` rule keeps commas inside its arguments instead of being split apart. | 2 |
| 1.0.100 | Add --trust-folder for one-off prompt-mode sessions started with -p or piped stdin | 1（-p） |
| 1.0.100 | Retry image-bearing Responses requests with smaller payload limits when providers reject oversized bodies | 6 |
| 1.0.98 | Resuming a session now respects abandoned pending-permission work and continues only active permission requests. | 4 |

参考（1.0.98 より前で関係が深いもの、`changelog.json`）：1.0.80-0「Show structured ask_user forms by default in interactive CLI sessions」、1.0.71「Switching to autopilot mid-turn now auto-answers questions asked during that same turn」、1.0.64「Autopilot mode now auto-handles elicitation, ask_user, sampling, and permission prompts」、1.0.92「Compaction keeps your latest prompt when requests exceed context limits」、1.0.85「Automatic compaction now saves a checkpoint」、1.0.85「Add /settings options to opt in to context management tools」、1.0.86「Custom agents can opt into repository instruction files … `include-custom-instructions: true`」。

---

## 設計で決めること（00-context の 1〜11）との対応と確信度

| 情報 | 効く設計項目 | 確信度 |
| --- | --- | --- |
| TUI の ask_user はフォーム（複数項目・自由入力つき・default で推奨）。SDK 既定は別の形 | 2, 11, 10（EVAL） | 高 |
| decline は「ユーザーは不在、自律で進めよ」になる／autopilot では聞かれない／-p では ask_user がない | 2, 3, 6 | 高 |
| サブエージェントは ask_user を持たず、prompt しか受け取らず、最後の文だけ返す。並列可 | 8, 7 | 高 |
| スキル本文は履歴の user メッセージとして入り、圧縮後も「最後のスキル」として残る（呼ばれた時点の写し） | 6, 11 | 高 |
| 圧縮後に原文で残るのは打ったメッセージだけ。ask_user の答えは要約にしか残らない | 5, 6, 2 | 高 |
| 打ったメッセージはたまり続け、圧縮後の大きさが増える | 4, 6 | 中（BYOK・小さい上限での観測） |
| todo・セッションの SQL・files/・plan.md は圧縮と再開を越えて残る。/clear で届かなくなる | 6, 5 | 高 |
| events.jsonl に ask_user の問いと答えが構造のまま残る | 10, 5 | 高 |
| @ファイルはパスだけ、20KB 超は view が読まない | 7 | 高（ドキュメントとは食い違い） |
| モデルごとにシステムプロンプトが違い、gpt-4.1／gpt-5-mini は「あいまいでも進めよ」、gpt-5.5 は「追加の質問をしない」 | 11, 2 | 高（BYOK での観測） |
| 毎回全履歴を送る。Claude はキャッシュの印が付く | 4（質問の数の目安）, 8 | 中（CAPI 未確認） |
| plan モードの聞き取りの指示（範囲・振る舞い・方法を ask_user で確かめる、手番は ask_user で終える） | 1, 2, 3 | 高 |
| 文脈の管理のツール（checkpoint.md）は既定でオフ | 6 | 高（存在）／低（プラグインからの利用可否） |

---

## 再開のチェックリスト（残っていること）

道具：`R=/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/cli`

- `$R/logserver.js`：偽物のモデル（全リクエストを `logs/<名前>/` に記録。chat／anthropic／responses に対応）。
- `$R/handlers/steps.js`：最新の user メッセージの `#STEPS:[...]#END`（JSON の配列。`{"text"}`／`{"name","arguments"}`／`{"calls":[...]}`）の順に応答する。tools なしまたは要約のお願いには偽の要約を返す。
- `$R/tuirun.sh <名前> <handler> <モデル> <port> <steps.json> -- <copilot の引数>`：TUI を pty で動かし、画面を `logs/<名前>/tui/snap-*.txt` に保存（環境変数 `PTYPE=anthropic`、`WIRE=responses`、`HOMEDIR=` で設定フォルダを指定）。
- `$R/sdkrun.sh <名前> <handler> <port> '<JSON>'`：SDK で動かす（`variant`: legacy／elicitation／null、`answers`、`elicitAnswers`、`sessionOpts`）。
- `$R/run.sh <名前> <handler> <モデル> <port> -- -p ...`：`-p` で動かす。
- `python3 -I $R/dump.py <logs/.../NNN.json> <出力の接頭辞>`：システムプロンプト・メッセージ・ツールを書き出す。

未着手・途中の項目と、やり直すコマンド：

1. **貼り付け（compactPaste）の中身が全部送られるか**（問い6、未着手）：`tuirun.sh` の steps に11行以上の文字列を `send` して、`logs/<名前>/001-*.json` の user メッセージを見る。
2. **複数のスキルを呼んだ後の圧縮で、いくつ残るか**（問い2・3、途中）：`proj/.github/skills/` に2つ目のスキルを作り、`#STEPS` で skill を2回呼んでから `/compact`（`steps/compact.json` を流用）。`<invoked_skills>` の「Retained skill」を確認。
3. **打ったメッセージの保存の上限**（問い3、途中）：`cfg-s8.json` の turn 数を 40、filler を長くして `TMO=1200 $R/sdkrun.sh s9 $R/handlers/steps.js 18170 "$(cat $R/cfg-s8.json)"`。圧縮後の `<user_message>` の数と「omitted」の有無を確認。
4. **CAPI 経路での確認**（問い5・8、未着手。ログインが要る）：人が手元の Copilot CLI で `COPILOT_OTEL_FILE_EXPORTER_PATH=… OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true copilot` を動かし、送られたプロンプトとキャッシュのトークン数（`cacheReadTokens`）を見る。
5. **プラグインのスキル（`--plugin-dir`）での `<skill-context>` と名前**（問い2、未着手）：Agent Plugins の形式のプラグインを作り `tuirun.sh … -- --plugin-dir <フォルダ> -i '…#STEPS:[{"name":"skill","arguments":{"skill":"<名前>"}}]#END'`。
6. **`contextManagementTools` をプラグイン・リポジトリの設定（`.github/copilot/settings.json`）で有効にできるか**（問い3、未着手）：`copilot config --repo contextManagementTools true` を試し、ツール一覧に `session_artifacts` が出るか。
7. **Gemini で ask_user の複数選択が 1.0.98 で失敗するか**（問い10、未着手。本物のモデルが要る）。

## 出典の一覧

- 実測：上記 `research/cli/logs/<実験名>/`（i1〜i10、s1〜s8、sub1、sub2、agentmain、par、def、atfile、c1、r1〜r4、cache-claude、compact-claude、compact2、cmt、exp、model-*、t1〜t4）。Copilot CLI 1.0.98、Linux x64、2026-10-20。
- パッケージ：`research/cli/pkg/package/`（`changelog.json`、`copilot-sdk/types.d.ts`・`session.d.ts`、`definitions/*.agent.yaml`、`builtin-skills/discover-resources/SKILL.md`、`prebuilds/linux-x64/runtime.node` の文字列 `research/cli/runtime.strings`）。`copilot help <話題>` の出力は `research/cli/help/`。
- 公式ドキュメント（2026-10-20 アクセス、日付の表示なし）：
  - https://docs.github.com/en/copilot/concepts/agents/copilot-cli/context-management
  - https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-copilot-cli
  - https://docs.github.com/en/copilot/how-tos/copilot-cli/cli-best-practices
  - https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills
  - https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference
  - https://docs.github.com/en/copilot/reference/custom-agents-configuration
- 公式の changelog：https://raw.githubusercontent.com/github/copilot-cli/main/changelog.md（`research/cli/web/changelog.md`）、`npm view @github/copilot versions/time`。
- 仕様：https://agentskills.io/specification（2026-10-20 アクセス）。
- 二次情報：使っていない。
