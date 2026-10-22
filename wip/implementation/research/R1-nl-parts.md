# R1 自然言語の部品の書き方（最新）

- 状態：途中
- 未着手・途中の項目：(1) 決まりの一覧、(2) 設計書の前提と違う事実、(3-4) 更新履歴 1.0.98〜1.0.103-0
- 調べた日：2026-10-22。対象：Copilot CLI 1.0.102（npm、2026-10-21）

## (1) 実装者向けの決まりの一覧

（未着手）

## (2) 設計書の前提と違う最新の事実

（未着手）

## (3) 調べた詳細と出典

出典の略号：

- [CR]：GitHub Copilot CLI command reference（https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference 、2026-10-22 取得）
- [AS]：Adding agent skills for GitHub Copilot CLI（https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills 、2026-10-22 取得）
- [CA]：Creating and using custom agents for GitHub Copilot CLI（https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli 、2026-10-22 取得）
- [CAC]：Custom agents configuration（https://docs.github.com/en/copilot/reference/custom-agents-configuration 、2026-10-22 取得）
- [PR]：GitHub Copilot CLI plugin reference（https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference 、2026-10-22 取得）
- [SPEC]：Agent Skills Specification（https://agentskills.io/specification 。元のリポジトリ agentskills/agentskills の `docs/specification.mdx`、コミット 69ef37e、2026-08-09）
- [BP]：Agent Skills「Best practices for skill creators」「Optimizing skill descriptions」「Using scripts in skills」（同じリポジトリの `docs/skill-creation/*.mdx`）
- [REF]：Agent Skills の検証の参照実装 skills-ref（同じリポジトリの `skills-ref/src/skills_ref/validator.py`）
- [APS]：Agent Plugins 1.0.0（agentplugins/agent-plugins-spec の `spec/1.0.0.md`、コミット ff8ab5e、2026-08-19）
- [ANT]：Anthropic「Skill authoring best practices」（https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices 、2026-10-22 取得）
- [SP]：obra/superpowers v7.0.1（2026-10-21）の `skills/writing-skills/SKILL.md` と `RELEASE-NOTES.md`
- [PKG]：Copilot CLI 1.0.102 の npm パッケージ（`@github/copilot-linux-x64@1.0.102`、2026-10-21 公開）から取り出したもの。`cli-main.js`、`changelog.json`、`definitions/*.agent.yaml`、`prebuilds/linux-x64/runtime.node` の文字列。比べるために 1.0.98 と 1.0.101 も同じように取り出した
- [CL]：[PKG] の `changelog.json`。`[CL 1.0.83]` は、その版の項目

### (3-1) SKILL.md

#### フロントマターの項目

| 項目 | Agent Skills の仕様 [SPEC] | Copilot CLI [CR][AS] | 実装で確かめたこと [PKG] |
| --- | --- | --- | --- |
| `name` | 必須。1〜64文字。小文字の英字・数字・ハイフンだけ。ハイフンで始めない・終えない、`--` を含まない。親のフォルダの名前と同じにする | 必須。英字・数字・ハイフン・下線・点・コロン・空白。64文字まで | 英字以外の文字の名前は誤りとして示す（[CL 1.0.70]「clear validation errors for empty or non-ASCII skill and command names」）。省いたときは補う（[CL 0.0.410]） |
| `description` | 必須。1〜1024文字。何をするかと、いつ使うかを書く。仕事を見分けるキーワードを入れる | 必須。「What the skill does and when to use it」。1024文字まで | — |
| `license` | 任意 | 任意（[AS]） | — |
| `compatibility` | 任意。1〜500文字。環境の条件があるときだけ | 記載なし | 文字列はあるが、読むかは確かめられなかった |
| `metadata` | 任意。文字列から文字列への対応 | 記載なし | 同上 |
| `allowed-tools` | 任意。空白区切り。試験的で、対応はクライアントで違う | 任意。コンマ区切りか YAML の配列。`"*"` で全部。スキルが動いている間、確認なしで使えるツール | スキルが呼ばれたとき（`skill.invoked`）に、その規則をセッションの承認済みの規則に足す（`cli-main.js` の `addApprovedRules`）。知らないツールや、確認の要らないツールに付けた引数は警告になる。[CL 1.0.100]：引数の中のコンマを分けなくなり、構造があいまいな一覧の範囲なしの規則は、許可せずに確認を出す |
| `argument-hint` | なし | 任意。スキルの一覧に出す引数の手がかり | [CL 1.0.64] |
| `user-invocable` | なし | 任意。既定 `true`。`/名前` で呼べるか | — |
| `disable-model-invocation` | なし | 任意。既定 `false`。エージェントが自分で呼べないようにする | [CL 1.0.74]「Fully honor」。スケジュールの実行も、この項目のスキルを呼ばない（`schemas/session-events.schema.json`） |

- Copilot CLI は、知らない項目があっても読み込む（[CL 0.0.403] 警告で読み込む、[CL 1.0.3] 警告も出さない）。
- Agent Skills の検証の参照実装は、仕様の6項目（`name`、`description`、`license`、`allowed-tools`、`metadata`、`compatibility`）以外の項目を誤りにする（[REF] の `ALLOWED_FIELDS` と「Unexpected fields in frontmatter」）。
- Agent Plugins 1.0.0 は、プラグインのスキルが Agent Skills の仕様に従うことを求め（MUST）、従わないスキルをクライアントが飛ばすこと（MUST skip）を定める（[APS] 7.1）。
  - つまり、`user-invocable`、`disable-model-invocation`、`argument-hint` を書いた SKILL.md は、Copilot CLI では動くが、Agent Skills の検証では不合格になり、厳しいクライアントでは飛ばされうる。憲章 第5条2項（両立しないときは Agent Plugins を優先）に照らすと、書かないのが安全である。
- 本文に入るとき、フロントマターは取り除かれる（[CL 1.0.48]「Skill content injected to the model no longer includes YAML frontmatter metadata」）。フロントマターに書いた注意は、モデルに届かない。

#### description の書き方（最新の公式の勧め）

| 出典 | 勧め |
| --- | --- |
| [AS]、[CR] | 何をするかと、いつ使うか。公式の例：「Guide for debugging failing GitHub Actions workflows. Use this when asked to debug failing GitHub Actions workflows.」 |
| [SPEC] | 何をするかと、いつ使うか。仕事を見分けるキーワードを入れる |
| [BP]「Optimizing skill descriptions」 | 命令の形（「Use this skill when...」）。実装ではなくユーザーの意図を書く。ユーザーが分野の名前を言わない場合も含め、使う場面をはっきり並べる（「Err on the side of being pushy」）。数文から短い段落まで。呼ばれるべき問いと、似ているが呼ばれてはいけない問い（near-miss）を約20件用意し、各3回走らせて呼ばれた割合で確かめる |
| [ANT] | 三人称で書く（説明はシステムプロンプトに入るため）。何をするかと、いつ使うか。XML のタグを入れない |
| [SP]（v7.0.1、2026-10-21 も同じ） | 「Use when...」で始め、呼ばれる条件だけを書く。手順の要約は書かない。要約を書くと、エージェントが本文を読まずに要約に従う（v4.0.0 の「The Description Trap」） |
| Copilot CLI の `skill` ツールの説明 [PKG] | 「Before acting on a task, check current or previously listed <available_skills>. If a skill matches, invoking it is mandatory and must be your first action, before any response; never merely announce it.」「Use only listed skills unless the user explicitly requests an unlisted skill by name」「Do not reinvoke a running skill」。1.0.98・1.0.101・1.0.102 で同じ文 |

- 公式（GitHub、Agent Skills、Anthropic）は、そろって「何をするか」と「いつ使うか」の両方を書くよう勧める。手順の要約を書かないことは、superpowers の報告にある（公式の文書にはこの注意はない）。両立させるには、「何をするか」を手順ではなく成果（何ができあがるか）の短い1句にとどめ、残りを呼ばれる場面にあてる。
- 日本語の description で呼ばれるかについての公式の情報は、見つからなかった。手がかりは次の2つで、どちらも呼ばれ方は確かめていない。
  - Copilot CLI には、埋め込み（embeddings）でスキルを選んで載せる仕組みがある（[CL 1.0.5]「experimental embedding-based dynamic retrieval of MCP and skill instructions per turn」、[CL 1.0.66] 設定 `dynamicRetrieval` と `--dynamic-retrieval skills=<on|off>`）。設定の既定は「unset」（設定のリファレンス https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference 、2026-10-22 取得）で、既定で効くかは確かめられなかった。パッケージには `text-embedding-3-small` の文字列がある。効くときは、ユーザーの頼みの文と description の意味の近さで選ばれるので、ユーザーが頼むときの言葉（日本語）を description に入れておくことが効く見込みである（見込み）。
  - スキルの一覧には文字数の上限があるらしい（`skillCharBudget`、「Additional skills available (invoke by name): 」の文字列）。上限を超えたスキルが名前だけで載るのかは、確かめられなかった。名前だけで載っても選ばれるよう、`name` を仕事が分かる英語にしておくのが安全である（見込み）。

#### 本文の長さ、references、ファイルの名指し

- 本文は500行未満、5,000トークン未満を勧める（[SPEC] Progressive disclosure、[BP]）。[ANT] は500行未満だけを書く。
  - 参考：Copilot CLI 1.0.102 に入っている GitHub 自身のスキル生成の指示（Forge、`runtime.node` の文字列）も、フロントマターは約100トークン、本文は5,000トークン未満としている。これは内部の指示で、公開の文書ではない。
- references は SKILL.md から1段で参照する（[SPEC] File references、[ANT]）。参照の先からさらに参照すると、モデルが一部だけ読むことがある（[ANT]）。
- 100行を超える参照ファイルには、先頭に目次を置く（[ANT]）。
- 「いつ読むか」を名指しする。「`references/api-errors.md` を、API が200以外を返したら読む」のほうが「詳しくは references を見る」より役に立つ（[BP]）。
- 環境に特有の落とし穴（gotchas）は、参照ファイルではなく SKILL.md に置く。モデルが、読むべき場面に気づかないことがあるため（[BP]）。
- 20KB の `view` の上限：1.0.102 のシステムプロンプトの文字列にも「Files are truncated at … Always use view_range for targeted reads on large files.」がある。上限の値は文字列からは読めなかった（設計書の 20KB は 1.0.98・1.0.101 の実測）。

#### スキルが呼ばれたときの載り方と、スクリプトの呼び方

- `skill` ツールで呼ぶと、Copilot CLI は本文を `<skill-context name="…">` で囲んで入れ、「Base directory for this skill: <スキルのフォルダ>」と「Related files (use view tool to read):」の一覧を添える。一覧が長いと「...and more files (listing truncated)」「Summarized directories:」になる（[PKG] `runtime.node` の文字列。1.0.98・1.0.101・1.0.102 のどれにも同じ文字列がある）。
- スクリプトの呼び方：
  - [SPEC][BP] は、スキルのフォルダからの相対パスで書き、「エージェントはそこからコマンドを動かす」とする。
  - Copilot CLI の公式の例は「run the `convert-svg-to-png.sh` script from this skill's base directory」と書く（[AS]）。Copilot CLI がシェルの作業フォルダをスキルのフォルダに変えるという記述は、公式の文書にない。
  - したがって、本文では「このスキルのベースのフォルダ（base directory）にある `scripts/x.mjs` を、絶対パスで動かす」と書く。相対パスだけを書くと、ユーザーの作業フォルダから解かれるおそれがある（確かめていない）。
- プラグインのスキルは `/<プラグイン>:<スキル>` で呼ぶ（設計書 2.2 の実測）。[CL 1.0.71]「Display plugin root skills as /plugin instead of /plugin:plugin」も、コロンの形を前提にしている。一方 [CR] は、2つのプラグインに同じ名前のスキルがあるときの名前を「`/my-plugin/search`」と書いていて、形が食い違う。
- 同じ名前のスキルが、プロジェクトや個人のフォルダにあると、プラグインのスキルは黙って無視される（[PR]「the agent or skill in the plugin is silently ignored」）。作り直しで、元のスキルがプロジェクトの `.github/skills/` にあると、クリエイターや生成プラグインの同じ名前のスキルが隠れる。

### (3-2) カスタムエージェント（`com.github.copilot/agents/*.agent.md`）

#### フロントマターの項目

| 項目 | [CR]（CLI のコマンドリファレンス） | [CAC]（設定のリファレンス） | 実装 [PKG] |
| --- | --- | --- | --- |
| `description` | 必須。エージェントの一覧と `task` ツールに出る | 必須 | — |
| `name` | 任意。表示名。`--agent` でも選べる。既定はエージェントの ID | 任意 | 重複の判定には使わない（ID で判定）。プラグインのエージェントの ID は `<プラグイン>:<エージェント>`（設計書 4.3 の実測） |
| `tools` | 任意。既定 `["*"]`。`*` を含めると全部 | 任意。コンマ区切りの文字列か配列。知らない名前は無視 | — |
| `model` | 1つのモデル。省くと外側のエージェントのモデル。セッションが Auto なら、この値に関係なく Auto が決めたモデル | 1つのモデル | 1つか、優先する順のリストを受け付ける（[CL 1.0.83]「Custom agents can list several models in `model`, tried in order until one is available to you」、文字列「Expected a non-empty list of model names」、組み込みの `explore`・`task` が `model: [..]`）。表示名（例：「Claude Sonnet 4.5」）も受け付ける（[CL 1.0.24]） |
| `models` | 優先する順のリスト。`model` より優先 | なし | 確かめられなかった（文字列 `"models"` はモデルの価格表のものだけ） |
| `modelPolicy` | `"preferred"`（既定）か `"required"` | なし | 実装の項目名は `model-policy`（[CL 1.0.83]、文字列「model-policy: required has no effect without a model」「Users may only choose models specified by the agent while the agent's model-policy is set to required.」）。`modelPolicy` を受け付けるかは確かめられなかった |
| `reasoningEffort` | 任意。`"low"`・`"medium"`・`"high"` など | なし | 組み込みの定義は `reasoningEffort: low`（`explore.agent.yaml`）。更新履歴は `reasoning-effort` と書く（[CL 1.0.88]）。`.agent.md` でどちらが効くかは確かめられなかった |
| `include-custom-instructions` | 任意。既定 `false`。サブエージェントとして動くときに、リポジトリの指示ファイル（`copilot-instructions.md`、`AGENTS.md`、`CLAUDE.md`）を読むか | なし | [CL 1.0.86] |
| `infer` | 任意。既定 `true`。メインのエージェントが自分で任せてよいか（退役とは書いていない） | 退役。`disable-model-invocation` と `user-invocable` を使う | 今も読む（フロントマターの項目名の並び「infer disable-model-invocation user-invocable deferred-tool-loading strict-tools-list include-custom-instructions」） |
| `disable-model-invocation` | 表にない | 任意。既定 `false`。`true` で自動で使われない。`infer: false` と同じで、両方あればこちらが優先 | 読む。`true` のエージェントを `task` で起動すると断られる（文字列「custom agent task launch rejected by model-invocation gate」）。[CL 0.0.411] |
| `user-invocable` | 表にない | 任意。既定 `true`。`false` で人が選べない | 読む。`false` は `/agent` の一覧に出ない（[CL 0.0.412]） |
| `mcp-servers` | 任意。`~/.copilot/mcp-config.json` と同じ形 | 任意 | プラグインのエージェントでは、この中の `${PLUGIN_ROOT}` を展開する（[PR]、[CL 1.0.85]）。`${PLUGIN_DATA}` と環境変数は展開しない（[PR]） |
| `skills` | 表にない | なし | 「skill content を起動時にエージェントのコンテキストへ読み込む」項目（[CL 1.0.22]）。文字列「subagent requested skills but the parent session has no loaded skills」「subagent configured skill was not found」がある。書き方は確かめられなかった |
| `deferred-tool-loading` | 表にない | なし | ツールが多いエージェントで、ツールの定義を後回しにして探させる（[CL 1.0.52]、[CL 1.0.79]） |
| `strict-tools-list` | 表にない | なし | 項目名の文字列だけがある。意味は確かめられなかった |
| エージェントごとのフック | 表にない | なし | [CL 1.0.97]「Add agent-scoped declarative hooks for custom agents」。項目名は確かめられなかった |
| `target`、`metadata` | なし | あり（`target` は `vscode` か `github-copilot`。`metadata` は Copilot のクラウドエージェント向け） | — |

- 知らない項目があっても、警告で読み込む（[CL 0.0.402]、[CL 0.0.415]）。
- 本文（指示）は30,000文字まで（[CAC]。[CR] には上限の記載がない）。
- 本文の中の相対リンクは、エージェントのファイルの場所から解く（[CL 1.0.73]）。
- 指示は毎回の手番で重ねて送られなくなった（[CL 1.0.60]）。
- サブエージェントとして動くカスタムエージェントは、環境の情報（作業フォルダなど）を受け取る（[CL 0.0.402]）が、リポジトリの指示ファイルは `include-custom-instructions: true` でないと受け取らない（[CR]、[CA]）。
- 公式の description の勧め：「what expertise this agent has and when it should be used」（[CA]）。

#### `tools` の書き方

- 別名（大文字・小文字を区別しない）[CAC]：

  | 別名 | 互換の別名 | 意味 |
  | --- | --- | --- |
  | `execute` | `shell`、`Bash`、`powershell` | シェルでコマンドを動かす |
  | `read` | `Read`、`NotebookRead` | ファイルを読む（`view`） |
  | `edit` | `Edit`、`MultiEdit`、`Write`、`NotebookEdit` | ファイルを書く・直す |
  | `search` | `Grep`、`Glob` | ファイルや文字を探す |
  | `agent` | `custom-agent`、`Task` | ほかのカスタムエージェントを呼ぶ |
  | `web` | `WebSearch`、`WebFetch` | Web の取得と検索 |
  | `todo` | `TodoWrite` | タスクの一覧 |

- 実装は、VS Code の書き方（`runcommands`、`editfiles`、`search/codebase` など）も別名として受け付ける（文字列の対応表「Custom agent:…runcommands…editfiles…search-codebase…runsubagent」。`runsubagent` は 1.0.101 から）。
- 別名を展開したときに付いてくるツール：シェルの別名には、出力を読む・一覧・止めるシェルのツールも付く（[CL 1.0.71]）。`task`・`agent` の別名には、`task` の付き添いのツール（`read_agent` など）も付く（[CL 1.0.64]）。`search` は grep・ファイル名の検索・意味の検索に展開する見込み（文字列「search-grep search-file search-semantic」）。
- 別名 `search`・`web`・`todo` でツールが渡るよう直ったのは 1.0.100（[CL 1.0.100]）。1.0.101・1.0.102 の更新履歴に、この点の変更はない。今の版で実際に渡るかの実測はしていない。
- MCP のツールは `サーバー名/ツール名`、サーバーのすべては `サーバー名/*`（[CAC]、組み込みの `explore` も `github-mcp-server/get_commit` と書く）。
- エクステンションのツールは、名前のまま書ける（設計書 生成プラグインの構造 11章 #8 の実測）。
- 知らないツールの名前は無視される（[CAC]）。綴りを誤っても誤りにならず、黙ってツールが渡らない。
- `[]` はツールなし（[CAC]）。
- `skill` を外すとスキルを呼べなくなるか：公式の別名の表に `skill` はない。[CAC] は「tools の一覧は、組み込みと MCP のツールを絞る」とするが、`skill` ツールが付き添いとして残るかの記述はない。パッケージには、サブエージェントが親のセッションのスキルを受け取る仕組みの文字列（「subagent_skill_context」「failed to read inherited subagent skill」「subagent_bridge_resolve_skill_content」）がある。外せば呼べなくなるかは、確かめられなかった（生成プラグインの構造 11章 #16 は残る）。
- 1.0.102：サブエージェントが、エクステンションのツールと MCP のツールの承認を引き継ぐようになった（[CL 1.0.102]「Subagents honor custom and MCP tool approvals, avoiding duplicate permission prompts and allowing inherited workflows to run」）。親で「このセッションでは許可」にしたツールを、サブエージェントが呼んでも、もう一度は確認しない見込み。

#### 組み込みのエージェントの定義（手本）

`definitions/*.agent.yaml`（1.0.102）。`.agent.md` とは形が違う（YAML の `prompt:` に指示を書き、`promptParts` で組み込みの指示を足し引きする）が、指示文の組み立てとモデルの書き方の手本になる。

| エージェント | モデル | 指示の長さ | 指示の組み立て |
| --- | --- | --- | --- |
| `task` | `[gpt-5.6-luna, gpt-5.4-mini, claude-haiku-4.5]` | 約1,900字 | 役割を1文 → 使えるツール → 役割（例つき） → 「CRITICAL - Output format」（成功は1行、失敗は全文。直さない、やり直さない） → よいやり方 → 最後に「Remember:」で目的を1文 |
| `explore` | `[gpt-5.6-luna, gpt-5.4-mini]`、`reasoningEffort: low` | 約1,500字 | 役割と「答えたら止まる」→ ファイルのパスは絶対パス → 決まり（網羅しない、短く、並列に呼ぶ） |
| `research` | `claude-sonnet-5` | 約5,000字 | 役割と4つの仕事 → 見出し（`##`）で「自律して進める」「探し方」「報告のしかた（形と引用の形、必須）」 → 最後に「Remember:」 |
| `code-review`・`security-review` | 書かない（親を継ぐ） | 約4,100字・約13,700字 | 役割と高い基準 → 「自分でやり、別のレビューのエージェントに丸ごと渡さない」 → 「CRITICAL: You Must NEVER Modify Code.」 → 出力の型（見出しと欄の雛形）。security-review は分類と判定の基準を `<categories_to_examine>` などの XML のタグで囲む |
| `rubber-duck` | 書かない（実行時に、ユーザーのモデルと違う系統を選ぶ） | 約3,900字 | 役割 → 直さない → 批評のしかた → 避けること |

- 共通の型：最初の1文で役割を言い切る → ファイルのパスは絶対パスで書く（作業フォルダは `<environment_context>` にある） → 太字の見出しで段落を分ける → 出力の形を雛形で示す → 「してはいけないこと」を短く強く書く。
- モデルは、費用の低い順に候補を並べ、最後に古い安いモデルを置く（コメント：「a catalog without Luna does not fall through to the (more expensive) parent session model」）。一覧のどれも使えないと、親のセッションのモデルになるため。
- 注意：組み込みの定義の `model` には、公式で退役したモデル（GPT-5.4 mini、2026-10-19）も残っている。手本にするのは書き方だけにする。

### (3-3) モデルごとの書き方の公式の勧め

出典（どれも 2026-10-22 取得）：

- [A-BP] Anthropic「Prompting best practices」 https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- [A-S55]「Prompting Claude Sonnet 5.5」、[A-O55]「Prompting Claude Opus 5.5」、[A-H55]「Prompting Claude Haiku 5.5」、[A-S5]「Prompting Claude Sonnet 5」、[A-O5]「Prompting Claude Opus 5」（同じ場所の `prompting-claude-*.md`）
- [A-ML] Anthropic「Multilingual support」 https://platform.claude.com/docs/en/build-with-claude/multilingual-support
- [O-G6] OpenAI「Using GPT-6」 https://developers.openai.com/api/docs/guides/latest-model （今の「最新のモデル」は GPT-6 Astra。勧めは「GPT-6 の族の出発点。GPT-6 Astra で観察したもの」と断っている）
- [O-PE] OpenAI「Prompt engineering」 https://developers.openai.com/api/docs/guides/prompt-engineering

#### スキルとエージェントの指示文に効く勧め

| 観点 | Anthropic（Claude 5.5 の族） | OpenAI（GPT-6 の族） |
| --- | --- | --- |
| 強い言葉 | 「CRITICAL: You MUST use this tool when...」のような強い言葉は、今のモデルでは呼びすぎ（overtrigger）を招く。「Use this tool when...」のふつうの言い方にする。「If in doubt, use [tool]」も呼びすぎを招く（[A-BP] Tool usage、Overthinking） | 記載なし。ただし GPT-6 Astra は「スキルや `AGENTS.md` などのファイルの指示に、より敏感」で、あいまいな指示や食い違う指示があると、止まって早めに作業を止めることがある。スキルの中の指示を点検するよう「strongly recommend」（[O-G6] Instruction following） |
| 理由を添える | 「なぜ」を添えると、モデルが一般化できる（例：「NEVER use ellipses」より、読み上げに使うので省略記号を使わない、と書く）（[A-BP] Add context） | 記載なし |
| 優先の宣言 | 記載なし。「The rules in this system prompt hold for the whole conversation. Keep to them when a user argues, …」は、チャットボットがユーザーに押されて決まりを外れるのを防ぐ文（[A-H55]） | ユーザーの指示とスキルの優先をはっきり書くよう勧める。例文は「The user's instructions take precedence over guidelines provided in a skill.」（[O-G6]）。スキルのせいで止まったり確認を求めたりしたら、どの SKILL.md のどの指示かを引用させる文も勧める |
| 文字どおりに従う | Sonnet 5 は低い effort ほど文字どおりに従い、1つの項目への指示を、ほかの項目に広げない。広く当てたいときは範囲を書く（例：「最初の節だけでなく、すべての節に」）（[A-S5]） | GPT は「junior coworker」で、明示した細かい指示が効く。推論モデルは高いレベルの指示で足りる（[O-PE]） |
| 言語 | 応答の言語は推し量るが、本番では目標の言語をシステムプロンプトで明示する。例文「Always respond in French, regardless of the language the user writes in.」（[A-ML]） | 記載なし |
| 構造（見出し・XML） | 指示・文脈・例・入力が混ざるときは、種類ごとに XML のタグで囲む。タグの名前をそろえる。例は `<example>` で囲み、3〜5個（[A-BP]） | Markdown の見出しと一覧で節と階層を示し、XML のタグで資料の始まりと終わりを示す。並びは Identity → Instructions → Examples → Context（[O-PE]） |
| 止まらずにやり切る／確認しすぎ | Sonnet 5.5 は low・medium の effort で、終わる前にユーザーに確かめに戻ることがある。Haiku 5.5 も、長いエージェントの指示と low の effort で早く止まる。勧める文：「Keep working until everything the user asked for is done, and only stop to ask when you can't go on without the user or before a risky step. When the work the user asked for is done and checked, stop and report. …」（[A-S55]、[A-H55]）。Opus 5.5 の、無人で走らせるときの文は「人が答えられる用途では入れない」（[A-O55]） | GPT-6 Astra は、以前のモデルが推し量った場面で聞き返すことが増えた。自律させたいときの文と、聞く前に「承認できる具体的な結果」まで作らせる文がある。「Do not introduce unsolicited warnings, disclaimers, approval flows …」（[O-G6]） |
| 確かめ（検証） | Haiku 5.5・Sonnet 5.5 は low・medium で、確かめずに「できた」と言うことがある。動かせる確かめを走らせる文を勧める（[A-H55]、[A-S55]）。Opus 5 は言われなくても確かめるので、「最後に確かめよ」「サブエージェントで確かめよ」の指示は消す（[A-O5]） | 小さな変更に広すぎる試験をしがち。変更に見合う試験にとどめる文（[O-G6]） |
| サブエージェント | Opus 5 は任せすぎる。任せる場面を書くか、数に上限を設ける（[A-O5]） | 任せる量を指示で調整する。エージェントの間の文は人も読むので、読みやすく書かせる（[O-G6]） |
| ツールの結果の後の差し込み | ユーザーの文を `tool_result` に入れない。仕組みの知らせはユーザーの文と別のかたまりにする。毎回の差し込みは、プロンプトインジェクションと見なされうる。知らせは2〜3回でやめる（[A-S55]、[A-H55]） | 記載なし |
| effort | 指示で「考えるな」と言っても思考は減らない。effort で決める（[A-H55]、[A-S55]） | `reasoning.effort`。Luna・Sol は `none` を受け付け、Astra・6.1 Sol は受け付けない（[O-G6]） |

#### 設計書 hearing.md 10.2 との照らし合わせ

| 10.2 の決まり | 最新の勧め | 判定 |
| --- | --- | --- |
| 1 優先の宣言を「聞くか進めるか」の一点に絞り、一般の指示より優先と書く | OpenAI は、スキルとユーザーの指示の優先をはっきり書くよう勧め、例文は「ユーザーの指示がスキルより優先」。GPT-6 Astra はスキルの指示に敏感 | 食い違いはない（10.2 が上に置くのは Copilot CLI のシステムプロンプトの一般の指示で、ユーザーの指示ではない）。ただし、ユーザーが「聞かずに作って」とはっきり言ったときにどちらを優先するかを、宣言の中で書いていない。OpenAI の勧めに沿うなら、ユーザーの明示の指示との関係も1文で書く（5.6 の「急ぎ」の扱いと合わせて決める） |
| 理由つきで書く | Anthropic の勧めと同じ | 合う |
| 強い禁止の形は4の関門だけ | Anthropic は強い言葉が呼びすぎを招くとする | 合う |
| 6 ユーザーと同じ言語で応答する | Anthropic は、目標の言語を明示する形（「Always respond in French, regardless of …」）を例に挙げる | 大きな食い違いはない。日本語の利用者が主なら「日本語で応答する。ユーザーが別の言語で書いたら、その言語で応答する」のように、具体の言語を書くほうが Anthropic の例に近い |
| 7 決まりは終わりまで有効（Haiku 5.5 の文例） | 今も [A-H55] にある。ただし用途は「ユーザーに押されても決まりを守る」 | 合う |
| 8章 3：差し込みは1回だけ | Sonnet 5.5・Haiku 5.5 の勧めと合う | 合う。出典のうち「OpenAI のプロンプトの手引き、GPT-5.6（指示の繰り返しが不要な確認を増やす）」は、今の [O-G6]（GPT-6 Astra が中心）からは見つからなかった。出典を更新するか、版と時点を書く必要がある（憲章 第5条3項） |
