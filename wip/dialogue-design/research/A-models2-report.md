# 今の主なモデルと最新の Copilot CLI での再確認（models2）

- 調べた日：2026-10-22
- 対象：`docs/design/hearing.md` 2章（特に 2.4 と 2.7）が頼っている Copilot CLI 1.0.98 の実測を、今の主なモデルと最新の版で確かめ直す。
- 作業フォルダ：`M=/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/models2`（以下 `$M`）。リポジトリは読んだだけで、変えていない。
- 実測は、どれもオフラインのモード（`COPILOT_OFFLINE=true`）で偽物のモデルにつないだ BYOK の経路である。GitHub にログインした経路（CAPI）は確かめていない。

## 0. 要点

1. **npm の最新は 1.0.102（2026-10-21 18:04 UTC 公開）**で、1.0.101 ではなくなっていた。1.0.101 と 1.0.102 の両方を入れて測った。
2. **hearing.md 2.7 の表に出てくる GPT のモデル（gpt-4.1、gpt-5-mini、gpt-5.5、gpt-5.4-mini）は、全部すでに退役している**（GPT-4.1 は 2026-06-01、ほかは 2026-10-19）。
3. **今の主なモデルでも、ヒアリングと逆向きの指示がある。** システムプロンプトは、モデルの ID ごとに4つの族に分かれる。
   - **A（GPT-6.1 Sol、GPT-6 Sol・Luna・Astra、GPT-5.6 の3つ、GPT-5.3-Codex）**：「…then stop—no recap, optional extras, offer to continue, or follow-up question.」に加えて、`<autonomy_and_persistence>` の「Bias to action: … assume they want tools/code used.」「Make reasonable assumptions for missing details; do not stop at analysis or a partial fix.」がある。
   - **B（Claude Haiku 5.5、Sonnet 5.5、Opus 5.5 など Claude 5 系と Opus 4.8、Fable）**：「limit your response to 100 words or less」と「Prioritize brevity. Default to the shortest possible response …」がある。
   - **C（Gemini 4 Argon、Gemini 3.8 Flash、Claude Haiku 4.5、Grok、Kimi K3、MAI-Code、知らない名前、`auto`）**：「try to limit your response to 100 words or less」だけがある。
   - **D（退役した gpt-4.1、gpt-5-mini だけ）**：「Be extremely biased for action.」がある。今のモデルにこの文はない。
   - `<ask_user>` 節は、33 のモデル名の全部で同じだった（「Never ask questions via plain text output.」とおすすめを `default` にする指示を含む）。
4. **プロンプトはモデルの ID の完全一致で分かれ、通信の形式では分かれない。** `COPILOT_PROVIDER_MODEL_ID` を指定すると、送るモデル名が何でもその ID の族になる。大文字が違う名前（`GPT-6-Luna`）は知らない名前になり、C の族になる。分ける処理はネイティブのモジュール `runtime.node` の中にあり、読める対応表はない。
5. **1.0.98 → 1.0.101 → 1.0.102 で、hearing.md 2章の主な事実は変わっていない。** 測り直した `ask_user` の結果の文、フォームの画面、Esc・Ctrl+D、autopilot の継続の発言、同じ手番の自動コンパクションでスキルが消えること、フックの差し込みの場所、`@ファイル`・`view`・文書の送られ方は、どれも 1.0.98 と同じだった。違いは、Claude Haiku 5.5・Sonnet 5.5 のプロンプトに `<shell_descriptions>` 節が足されたことと、コンパクションのイベントの項目が増えたことだけである。
6. **文書がファイルのまま送られるかは、通信の形式で決まる。** モデル名をまたいで入れ替えても、Responses なら4種類とも、Anthropic なら PDF だけ、chat completions ならどれもファイルのまま送られなかった（Claude のモデル名でも Responses なら4種類、GPT-6 のモデル名でも Anthropic なら PDF だけ）。ログインした経路で各モデルがどの形式になるかは、Copilot のサーバーのモデルの一覧（`supported_endpoints`）で決まる見込みで、確かめていない。
7. 実験の道具の落とし穴：Copilot CLI の実行ファイルは、`~/.cache/copilot/pkg/<OS>-<CPU>/` に展開された**いちばん新しい版**を動かす。1.0.101 の実行ファイルを起動しても、1.0.102 が展開済みだと 1.0.102 が動いた。版ごとに `COPILOT_CACHE_HOME` を分け、`--no-auto-update` を付けて測った（2章）。

---

## 1. 今の公式のモデルの一覧

### 結果

**Copilot CLI で選べるモデル**（「Supported AI models per client」表の Copilot CLI 列。ID は `copilot help config` の `model` の一覧）

| モデル | ID | Copilot CLI | Auto の候補（Copilot CLI） | Copilot Pro で使えるか |
| --- | --- | --- | --- | --- |
| GPT-6.1 Sol | `gpt-6.1-sol` | 使える（※1） | 入る | 使えない |
| GPT-6 Sol | `gpt-6-sol` | 使える | 入る | 使えない |
| GPT-6 Luna | `gpt-6-luna` | 使える | 入る | 使える |
| GPT-6 Astra | `gpt-6-astra` | 使える | 入る | 使えない |
| GPT-5.6 Sol | `gpt-5.6-sol` | 使える | 入る | 使えない |
| GPT-5.6 Terra | `gpt-5.6-terra` | 使える | 入る | 使える |
| GPT-5.6 Luna | `gpt-5.6-luna` | 使える | 入る | 使える |
| GPT-5.3-Codex | `gpt-5.3-codex` | 使える | 入らない（Auto の最後の受け皿の LTS モデル） | 使える |
| Claude Haiku 5.5 | `claude-haiku-5.5` | 使える | 入らない | 使える |
| Claude Haiku 4.5 | `claude-haiku-4.5` | 使える | 入る | 使える |
| Claude Sonnet 5.5 | `claude-sonnet-5.5` | 使える | 入る | 使える |
| Claude Sonnet 5 | `claude-sonnet-5` | 使える | 入る | 使える |
| Claude Sonnet 4.6 | `claude-sonnet-4.6` | 使える（2026-09-01 に退役。年額の旧プランだけ残る） | 入らない | 年額の旧プランだけ |
| Claude Opus 5.5 | `claude-opus-5.5` | 使える | 入る | 使えない |
| Claude Opus 5 | `claude-opus-5` | 使える | 入る | 使えない |
| Claude Opus 4.8 | `claude-opus-4.8` | 使える | 入る | 使えない |
| Claude Opus 4.8 (fast mode) (preview) | `claude-opus-4.8-fast` | 使える | 入らない | 使えない |
| Claude Fable 5 | `claude-fable-5` | 使える | 入らない | 使えない |
| Claude Fable 5.1 | `claude-fable-5.1` | 使える | 入らない | 使えない |
| Gemini 4 Argon | `gemini-4-argon` | 使える | 入らない | 使えない |
| Gemini 3.8 Flash | `gemini-3.8-flash` | 使える | 入る | 使える |
| MAI-Code-1.1-Flash | `mai-code-1.1-flash` | 使える | 入る | 使える |
| Grok 4.5／4.6／4.7 | `grok-4.5`／`grok-4.6`／`grok-4.7` | 使える | 入らない | 使える |
| Kimi K3 | `kimi-k3` | 使える | 入らない | 使える |

- ※1 GPT-6.1 Sol は、「Supported AI models per client」表に行がない。一方、モデルの一覧の表、Auto の表、プランの表、コマンドリファレンスの「Supported models」、changelog 1.0.90「Add support for GPT-6.1 Sol in model selection」、`copilot help config` にはある。公式ドキュメントの中で食い違っている。
- **退役したモデル**（「Model retirement history」）：GPT-5 mini、GPT-5.4、GPT-5.4 mini、GPT-5.5、Gemini 3.7 Flash は 2026-10-19。GPT-4.1 は 2026-06-01。Claude Sonnet 4.6 は 2026-09-01（年額の旧プランの個人には残る）。
  - これらは `copilot help config` の一覧にはまだ載っている（`gpt-5.5`、`gpt-5.4`、`gpt-5.4-mini`、`gpt-5-mini`、`gemini-3.7-flash`）。`gpt-4.1` は一覧にないが、組み込みのモデルの一覧（catalog）にはあり、オフラインでは警告なく使えた。
- **既定のモデル**：コマンドリファレンスの「Supported models」表で `claude-sonnet-5.5` が「General-purpose coding (default)」。`gpt-6.1-sol`、`gpt-6-astra`、`gpt-6-luna` は「Recommended, opt-in (not the automatic default)」。1.0.101 で「Model picker marks your administrator-managed model as the default when it is available」（管理者が決めた既定があれば、それが既定として示される）。
- **Auto の扱い**
  - `--model=auto`、`COPILOT_MODEL=auto`、`/model auto [TIER]` で選ぶ。段階（tier）は `efficiency`・`balance`・`intelligence`（設定 `autoTier`、`--auto-tier`）。
  - 頼みごとの難しさとサービスの状態から、サーバーがモデルを選ぶ（「About Copilot auto model selection」）。会話の途中でモデルが変わることがある（changelog 1.0.81「Auto mode now adapts model selection as your task evolves during a conversation」）。どのモデルが答えたかは画面に出る。
  - 有料プランでは 10% の割引（Copilot Max は 2026-10-28 まで 30%）。Copilot Free と Student は Auto しか使えない。
  - Auto のとき、サブエージェントはエージェントの定義の `model` に関係なく、Auto が選んだセッションのモデルになる（コマンドリファレンスの Custom agents の表）。
  - 1.0.102「Prompt mode now honors managed Auto model selection for -p and piped stdin runs」。
- 公式ドキュメントの食い違い（参考）
  - 組み込みの research エージェントのモデル：コマンドリファレンスは `claude-haiku-4.5`、パッケージの `definitions/research.agent.yaml` は 1.0.98〜1.0.102 とも `claude-sonnet-5`。
  - 自動コンパクションの始まり：「Context management」は約80%で始まり約95%で待つ、「About GitHub Copilot CLI」は「approaches 95%」。

### 確かめ方

- 取得したページ（2026-10-22。`https://docs.github.com/api/article/body?pathname=…` で Markdown を取った）
  - Supported AI models in GitHub Copilot：`$M/web/supported-models.md`、表の印を「Y／---」に直したもの `$M/web/supported-models.tables.md`
  - GitHub Copilot CLI command reference：`$M/web/copilot_reference_copilot-cli-reference_cli-command-reference.md`（「Supported models」は 778 行目〜、`/model` は 569 行目、組み込みのエージェントは 1369 行目〜）
  - About Copilot auto model selection：`$M/web/copilot_concepts_models_auto-model-selection.md`
  - Base and LTS models：`$M/web/copilot_concepts_models_fallback-and-lts-models.md`
  - Models and pricing：`$M/web/copilot_reference_copilot-billing_models-and-pricing.md`
  - changelog：`$M/web/changelog.md`（`https://raw.githubusercontent.com/github/copilot-cli/main/changelog.md`）
- 版の一覧と公開日：`npm view @github/copilot versions --json`、`npm view @github/copilot time --json`

### 分からなかったこと

- ユーザーのプランと組織の方針で、実際にどのモデルが選べるか（ログインが要る）。
- Auto が実際にどのモデルを選ぶか。

---

## 2. Copilot CLI 1.0.101 を入れる

### 結果

- `$M/v101/`（1.0.101）と `$M/v102/`（1.0.102）に入れた。npm の dist-tag は `latest: 1.0.102`、`prerelease: 1.0.102-1`。1.0.101 は 2026-10-20 18:49 UTC、1.0.102 は 2026-10-21 18:04 UTC に公開。
- **`copilot help config` の `model` の一覧は、1.0.98・1.0.101・1.0.102 で同じ**だった。今の主なモデル（`gpt-6.1-sol`、`gpt-6-sol`、`gpt-6-luna`、`gpt-6-astra`、`claude-haiku-5.5` など）は、1.0.98 のときから載っている（前の調査は、一覧にあるのに古いモデルを選んで測っていた）。
  - 一覧（31件）：claude-sonnet-5.5、claude-sonnet-5、claude-fable-5.1、claude-fable-5、claude-opus-5.5、claude-opus-5、claude-opus-4.8、claude-opus-4.8-fast、claude-sonnet-4.6、claude-haiku-5.5、claude-haiku-4.5、gpt-6.1-sol、gpt-6-sol、gpt-6-luna、gpt-6-astra、gpt-5.6-sol、gpt-5.6-terra、gpt-5.6-luna、gpt-5.5、gpt-5.4、gpt-5.4-mini、gpt-5.3-codex、gpt-5-mini、mai-code-1.1-flash、gemini-4-argon、gemini-3.8-flash、gemini-3.7-flash、grok-4.7、grok-4.6、grok-4.5、kimi-k3。
  - `help config` の 1.0.98 と 1.0.101 の差は、`permissions` の `"assisted"` の説明の言い回しだけ。`help environment` と `help providers` は同じ。1.0.101 と 1.0.102 は同じ。
- 主なモデルを追加した版（changelog）：GPT-5.6（1.0.70）、Claude Sonnet 5（1.0.67）、claude-fable-5.1（1.0.83）、GPT-6 Astra（1.0.85）、GPT-6 Sol・GPT-6 Luna（1.0.89）、GPT-6.1 Sol（1.0.90）、Claude Haiku 5.5（1.0.94）、Gemini 4 Argon（1.0.98）。
- **落とし穴（実測）**：npm の `@github/copilot-linux-x64/copilot` は、自分の中の版を `~/.cache/copilot/pkg/linux-x64/<版>/` に展開し、そこにある**いちばん新しい版**を動かす。最初の 66 件の実験（1.0.101 のつもり）は、すでに展開されていた 1.0.102 で動いていた（システムプロンプトの「Version number: 1.0.102」とログの「Starting Copilot CLI: 1.0.102」で気づいた）。その分は `m102-*` に名前を変えて、1.0.102 の結果として使った。以降は版ごとに `COPILOT_CACHE_HOME=$M/cache/v<版>`、`COPILOT_AUTO_UPDATE=false`、`--no-auto-update` を付けた。
  - ユーザーの手元でも同じで、ふだんは自動更新で最新の版が動く。設計の前提の版は、npm の最新の版に合わせるのがよい。

### 確かめ方

- `cd $M/v101 && npm i --ignore-scripts @github/copilot@1.0.101`（1.0.102 も同様）
- パッケージの中身：`python3 -I $R/extract.py <実行ファイル> $M/pkg101/copilot.tar`（`R=…/research/cli`）で `$M/pkg101/package/`、`$M/pkg102/package/` に展開。
- `copilot help config|environment|providers` の出力：`$M/help/v98/`、`$M/help/v101/`、`$M/help/v102/`
- 実際に動いた版：`$M/homes/<実験>/logs/process-*.log` の「Starting Copilot CLI: …」、各リクエストのシステムプロンプトの `<version_information>`。

### 分からなかったこと

- 特になし。

---

## 3. 今の主なモデルでのシステムプロンプト

### 結果

対話モード（TUI、`copilot -i hi`）の最初のリクエストを、Copilot CLI で選べる全モデルと退役したモデル（33 のモデル名）について、各モデルの本来の形式と chat completions の2通りで記録した（1.0.101 で 66 件。1.0.98、1.0.102 でも同じ 66 件）。

| モデル ID | 公式の状態（2026-10-22） | 測った形式 | 族 | 「Be extremely biased for action」 | 「…then stop—no recap, …」 | 「Bias to action」「Make reasonable assumptions for missing details」 | 「Prioritize brevity」 | 「100 words or less」 | `<ask_user>` 節 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `gpt-6.1-sol` | GA | Responses、chat completions（同じ） | A | — | あり | あり | — | — | あり（全モデル同じ） |
| `gpt-6-sol` | GA | Responses、chat completions（同じ） | A | — | あり | あり | — | — | あり |
| `gpt-6-luna` | GA | Responses、chat completions（同じ） | A | — | あり | あり | — | — | あり |
| `gpt-6-astra` | GA | Responses、chat completions（同じ） | A | — | あり | あり | — | — | あり |
| `gpt-5.6-sol`／`-terra`／`-luna` | GA | Responses、chat completions（同じ） | A | — | あり | あり | — | — | あり |
| `gpt-5.3-codex` | GA | Responses、chat completions（同じ） | A | — | あり | あり | — | — | あり |
| `claude-haiku-5.5` | GA | Anthropic、chat completions（同じ） | B | — | — | — | あり | 「limit …」 | あり |
| `claude-sonnet-5.5` | GA | Anthropic、chat completions（同じ） | B | — | — | — | あり | 「limit …」 | あり |
| `claude-opus-5.5` | GA | Anthropic、chat completions（同じ） | B | — | — | — | あり | 「limit …」 | あり |
| `claude-sonnet-5`、`claude-opus-5`、`claude-opus-4.8`、`claude-opus-4.8-fast`、`claude-fable-5`、`claude-fable-5.1` | GA | Anthropic、chat completions（同じ） | B | — | — | — | あり | 「limit …」 | あり |
| `gemini-4-argon` | GA | chat completions、Responses（同じ） | C | — | — | — | — | 「try to limit …」 | あり |
| `gemini-3.8-flash` | GA | chat completions、Responses（同じ） | C | — | — | — | — | 「try to limit …」 | あり |
| `claude-haiku-4.5` | GA | Anthropic、chat completions（同じ） | C | — | — | — | — | 「try to limit …」 | あり |
| `grok-4.5`／`4.6`／`4.7`、`kimi-k3`、`mai-code-1.1-flash` | GA | chat completions、Responses（同じ） | C | — | — | — | — | 「try to limit …」 | あり |
| `auto` | オフラインでは知らない名前の扱い | chat completions、Responses（同じ） | C | — | — | — | — | 「try to limit …」 | あり |
| `claude-sonnet-4.6` | 退役（年額の旧プランは継続） | Anthropic、chat completions（同じ） | C | — | — | — | — | 「try to limit …」 | あり |
| `gpt-5.5`、`gpt-5.4`、`gpt-5.4-mini` | 退役 2026-10-19 | Responses、chat completions（同じ） | A | — | あり | あり | — | — | あり |
| `gpt-5-mini` | 退役 2026-10-19 | Responses、chat completions（同じ） | D | あり | — | — | — | 「try to limit …」 | あり |
| `gpt-4.1` | 退役 2026-06-01 | chat completions、Responses（同じ） | D | あり | — | — | — | 「try to limit …」 | あり |
| `gemini-3.7-flash` | 退役 2026-10-19 | chat completions、Responses（同じ） | C | — | — | — | — | 「try to limit …」 | あり |

- **オフラインで受け付けなかったモデル名はない。** 組み込みの一覧にない名前（`auto`、`my-local-model`、`GPT-6-Luna`、`claude-sonnet-5-5`）は、画面に「Model "…" is not in the built-in catalog. Using defaults for: prompt tokens …」と出たうえで動き、C の族のプロンプトになった。
- **全モデルに共通のもの**
  - `<ask_user>` 節は 33 のモデル名の全部で同じ（md5 の先頭 `106054`。原文は `$M/evidence/ask_user-section-1.0.101.txt`）。「**IMPORTANT: Never ask questions via plain text output.**」「Set sensible `default` values when a reasonable default exists — if you recommend a specific option, make it the default」「You want to collect several related preferences at once rather than asking one at a time」を含む。
  - 全モデルに「* Ask for guidance if uncertain; use the ask_user tool to ask clarifying questions」の1行がある。
  - `ask_user` のツールの定義は、通信の形式ごとの包み方が違うだけで、同じ形式のモデルどうしでは同じだった。
- **族ごとの原文**（`$M/evidence/family-texts-1.0.101.txt`）
  - A（GPT-5.6・GPT-6 など）：Tone and style の1行目「Lead with the outcome/main result; then explain the meaningful change and most important supporting detail. Mention a next step only when necessary, then stop—no recap, optional extras, offer to continue, or follow-up question.」と、
    `<autonomy_and_persistence>` の「- Bias to action: unless the user asks for a plan, a code explanation/question, brainstorming, or otherwise clearly signals no implementation, assume they want tools/code used. Implement rather than merely propose, and try to resolve blockers yourself.」「- Deliver working code end-to-end in the current turn when feasible—implementation, verification, and a clear outcome—unless the user pauses or redirects. Make reasonable assumptions for missing details; do not stop at analysis or a partial fix.」。
    「100 words」の行はない。ツールは `edit`・`create`・`grep` の代わりに `apply_patch`・`rg` で、17 個（ほかの族は 18 個）。
  - B（Claude 5 系など）：「* When providing output or explanation to the user, limit your response to 100 words or less.」「* Prioritize brevity. Default to the shortest possible response that satisfies the request. Cut filler, recap, and process narration.」。`<user_progress_updates>`（途中経過を短く知らせる）もある。
  - C（Gemini、Claude Haiku 4.5 など）：「* When providing output or explanation to the user, try to limit your response to 100 words or less.」だけ。Gemini にはさらに `<user_progress_updates>`（Gemini 版）と `<reduce_aggressive_code_changes>`（「Prefer explanations over code changes.」。ヒアリングとは同じ向き）がある。
  - D（gpt-4.1、gpt-5-mini）：`<solution_persistence>` の「Be extremely biased for action. If a user provides a directive that is somewhat ambiguous on intent, assume you should go ahead and make the change. …」と「try to limit …」。
  - 同じ族の中の違いは、`<model_information>`（モデル名）と、Opus・Fable の `<tool_preferences>` の言い回しなど、ヒアリングに関係しないものだけだった。
- **hearing.md 2.7 の表は、1.0.98 の時点でも足りていなかった。** 1.0.98 の同じ測り方で、Claude Opus 5.5 にも「limit your response to 100 words or less」があり、gpt-4.1 だけでなく Gemini、Grok、Kimi、Claude Haiku 4.5、Claude Sonnet 4.6、gpt-5-mini にも「try to limit …」があり、gpt-5.5・gpt-5.4-mini にも `<autonomy_and_persistence>` があった（`$M/analysis-m098.md`）。
- **プロンプトが分かれる仕組み**
  - **モデルの ID で決まる。** ID は `COPILOT_PROVIDER_MODEL_ID`（なければ `COPILOT_MODEL`）。送るモデル名を `my-deploy-name` にして `COPILOT_PROVIDER_MODEL_ID=gpt-6-luna` にすると A の族、送る名前を `claude-haiku-5-5-20261001` にして `COPILOT_PROVIDER_MODEL_ID=claude-haiku-5.5` にすると B の族になった。`copilot help providers` にも「Matching a well-known model ID lets the agent use model-specific configuration such as tool support, token limits, and prompting strategies. Without a recognized model ID, the agent falls back to safe defaults.」とある。
  - **完全一致で、大文字と小文字を区別する。** `GPT-6-Luna` と `claude-sonnet-5-5` は知らない名前になった。
  - **通信の形式は関係しない**（知っている ID なら、Anthropic・Responses・chat completions で、空行1つの違いを除いて同じ）。知らない ID では、`COPILOT_PROVIDER_TYPE=anthropic` のとき `<tool_preferences>` などの小さな節が足された（ヒアリングに関係する文は同じ）。
  - **実装の場所**：分ける処理は JavaScript（`cli-main.js`）ではなく、ネイティブのモジュール `prebuilds/linux-x64/runtime.node`（1.0.101）の中にある。プロンプトの断片は `runtime.node` のファイルの位置 11,826,000〜11,880,000 バイトあたりに並ぶ（`$M/prompt-region101.txt`）。モデルの判定は、機械語の中に埋め込んだ文字列の比較（`claude-s`＋`sonnet-4`、`opus-5.5`、`opus-4.8`、`gpt-6-lu`、`gpt-6.1-`、`-6-astra`、`gpt-5.6-`、`grok-4.7`、`mai-code`、`kimi` など。社内の名前らしい `claude-mythos-5`、`goldeneye`、`oswe-magpie`、`lark-picker`、`codex-max`、`claude-default` も）で、仮想アドレス 0x3401c00 付近の関数にある（`$M/classifier101.asm.ann`）。読める対応表（JSON など）は見つからなかったので、対応は上の実測で決めた。
- **1.0.98・1.0.101・1.0.102 の違い**：上の表の印と族の分かれ方は3つの版で同じ。プロンプトの本文の違いは、1.0.98 → 1.0.101 で Claude Haiku 5.5 と Sonnet 5.5 に `<shell_descriptions>`（bash の `description` 引数を必ず書く）が足されたことだけ。1.0.101 → 1.0.102 は版の番号のほかは同じ。

### 確かめ方

- 道具：`$M/tuirun.sh`（前の調査の `tuirun.sh` を元に、版 `VER`、`MODELID`、キャッシュの分離、`--no-auto-update` を足した）、`$M/tui.py`（キーの送り方を直したもの。4章）、偽物のモデル `$R/logserver.js`、返事 `$M/handlers/text.js`。
- 1件：`VER=101 PTYPE=openai WIRE=responses $M/tuirun.sh <名前> $M/handlers/text.js gpt-6-luna 18501 $M/steps/hello.json -- -i hi`
- 全部：`$M/matrix.sh 101 m101 18520`（`$M/matrix.sh 98 m098 18530` も）。ログは `$M/logs/m101-<モデル>-<resp|comp|anth>/001-*.json`、画面は `…/tui/snap-a.txt`。
- 書き出しと集計：`python3 -I $R/dump.py <ログ> $M/dumps/<名前>`、`python3 -I $M/scripts/analyze.py $M/dumps m101-`（表：`$M/analysis-m101.md`、`$M/analysis-m098.md`、`$M/analysis-m102.md`）、族の分かれ方：`python3 -I $M/scripts/famhash.py $M/dumps m101-`
- ID の指定と大文字の確かめ：`$M/logs/p-modelid-luna`、`p-modelid-haiku55`、`p-upper`、`p-anthdate`、`p-unknown`
- 機械語：`objdump -d -M intel --start-address=… runtime.node`（`$M/classifier101.asm.ann`、`$M/endpoint101.asm.ann`）

### 分からなかったこと

- **ログインした経路（CAPI）でも同じプロンプトか。** 族は手元の `runtime.node` で決まるので同じ見込みだが、確かめていない。
- **Auto のとき、どの族になるか。** オフラインの `auto` は知らない名前の扱い（C）で、本物の Auto ではない。ランタイムには「Auto mode is active. The concrete model is selected dynamically and may change during the conversation.」（`<model_information>` の文）や「Recapturing standalone turn config after the Auto model changed」の文字列があり、選ばれたモデルに合わせて設定を作り直す見込みだが、確かめていない。
- 本物のモデルが、これらの指示とクリエイターの SKILL.md のどちらに従うか。

---

## 4. 1.0.98 と 1.0.101 の違い

### 結果

**changelog（1.0.99-0〜1.0.102）**で hearing.md 2章に関係しそうなものは、次だけだった（全体は `$M/changelog-relevant-99-102.txt`）。`ask_user` のフォームや結果の文、Ctrl+D、autopilot の継続、スキルの扱い、フックの差し込み口、`@ファイル` に触れた項目はない。

| 版 | 項目（原文） | hearing.md への影響 |
| --- | --- | --- |
| 1.0.100 | Avoid false context exhaustion and rollover refusal when tool definitions are deferred | 14章 H4 に関係。挙動の確かめはしていない |
| 1.0.100 | Custom agents that declare the documented `search`, `web` or `todo` tool aliases … now receive the matching tools | 2.6 の最後の項目。今の版では直っている |
| 1.0.100 | Gemini tool calls no longer fail when array parameters define enum values | 14章 H16。今の版では直っている。BYOK のツールの定義は 1.0.98 と同じで、違いは見えなかった |
| 1.0.100 | Path-specific instruction files in the repository root .github/instructions are now applied automatically when the agent reads or edits a matching file | クリエイターがリポジトリの外で動くなら影響は小さい |
| 1.0.101 | Switching only reasoning effort no longer forces compaction in over-budget sessions. | 8章の前提（コンパクション）には影響しない |
| 1.0.101 | Switching to HydraFusion compacts only when the routed model actually needs it | 同上 |
| 1.0.101 | The first prompt no longer hangs silently when no model is selected at startup … | なし |
| 1.0.102 | Prompt mode now honors managed Auto model selection for -p and piped stdin runs | `-p` で Auto が効くようになった。2.7 の「Auto のとき」が `-p` にも関わる |

**パッケージの中の決まった文**（1.0.98・1.0.101・1.0.102 の `runtime.node`＋`cli-main.js` での出現数）：「User cancelled the request.」「The user is not available to respond … stop and call task_complete」「You have not yet marked the task as complete …」「You have open questions or ambiguities - make good decisions and keep working」「Only call this tool when you are confident the task is fully complete.」「Other (type your answer)」「The user included native document attachments in this message.」「Replaced document attachment(s) in conversation history with file references」「<pasted_content」「File too large to read at once」「Retained skill」「<invoked_skills>」「Never ask questions via plain text output.」「Making best guess on autopilot」「max-autopilot-continues」は、3つの版で同じ数だった。「User responded:」だけ 3→4 に増えたが、測り直した結果の文は同じだった（下）。

**測り直し**（同じ道具・同じモデル名 `gpt-4.1` で 1.0.98 と 1.0.101 を並べ、会話の中身をパスや日時をならして比べた。1.0.101 では `claude-haiku-5.5`（Anthropic）でも流した）

| 前の実験 | 確かめたこと | 1.0.98 と 1.0.101 |
| --- | --- | --- |
| i3（`steps/ask2.json`） | 選択肢の欄の「Other (type your answer)」、Enter で選ぶ（`User responded: Slack`）、Ctrl+D（「The user is not available to respond … rather than proceeding on an unfounded assumption.」）、古い形の呼び出しの拒否、複数選択で何も選ばない（`User accepted but provided no values.`）、フォームの画面 | 同じ（会話も画面も一致） |
| i4（`steps/ask3.json`） | 自由入力（`User responded: Custom tool X`）、Esc（`User cancelled the request.`） | 同じ |
| i5（`steps/ask4.json`） | Ctrl+D の文 | 同じ |
| i6（`steps/autopilot.json`、`--autopilot`） | autopilot で `ask_user` に Ctrl+D と同じ文が自動で返る。`task_complete` が加わる（ツール 19 個）。続けるよう促す発言（「You have not yet marked the task as complete … IMPORTANT: Do NOT call task_complete if: - You have open questions or ambiguities - make good decisions and keep working …」）が5回送られる | 同じ |
| g5-auto4（`steps/auto4.json`、`--experimental --plugin-dir gap/plugins/maker`、`COPILOT_PROVIDER_MAX_PROMPT_TOKENS=30000`） | 同じ手番の自動コンパクションの後は、要約と打った発言だけが残り、`<skill-context>` も `<invoked_skills>` もない。次に打った手番でも戻らない。`onPostToolUse` の差し込みはツールの結果の末尾、`onPreToolUse` は別のユーザーのメッセージ、`onUserPromptSubmitted` は発言の末尾の `<system_reminder>`。コンパクションの後もフックは呼ばれる。エクステンションのプロセスは続く | 同じ |
| t3-view／atfile 相当 | `view` は 26KB のファイルを読まず「File too large to read at once (26.0 KB). …」。テキストの `@README.md` は `<tagged_files>` のパスと行数だけ | 1.0.101 で 1.0.98 と同じ結果 |
| 文書（5章） | `@` で示した文書の送られ方 | 1.0.101 で 1.0.98 の報告と同じ結果 |

**変わったこと**

1. Claude Haiku 5.5 と Sonnet 5.5 のシステムプロンプトに `<shell_descriptions>` が足された（3章）。ヒアリングには関係しない。
2. コンパクションのイベントの項目が増えた。`session.compaction_start` に `compactionAttemptId`・`model`、`session.compaction_complete` に `compactionAttemptId`・`outcome`（例 `"applied"`）・`systemTokens`・`conversationTokens`・`toolDefinitionsTokens`・`tokenAccountingBasis`。1.0.98 の項目（`success`、`messagesRemoved`、`summaryContent` など）は残っている。
3. 自動コンパクションの要約のリクエストと本来のリクエストの順番が、1.0.98 と 1.0.101 で入れ替わっていた（中身は同じ）。

### 確かめ方

- `$M/replay.sh 98 gpt-4.1 openai r098 18560`、`$M/replay.sh 101 gpt-4.1 openai r101 18566`、`$M/replay.sh 101 claude-haiku-5.5 anthropic r101h 18572`。i3 は `r98b-i3`、`r101b-i3`（直した `tui.py` で、1件ずつ流した）。
- 比べ方：`diff <(python3 -I $M/scripts/convo.py $M/logs/r098-i4) <(python3 -I $M/scripts/convo.py $M/logs/r101-i4)`。i3〜i6 は差がなかった。g5-auto4 は順番の違いだけ。
- イベント：`$M/homes/r098-auto4/session-state/*/events.jsonl`、`$M/homes/r101-auto4/…`
- `view`・`@`：`$M/logs/v101-view`
- 道具の直し：前の `tui.py` は矢印キー（`ESC [ B`）を1文字ずつ送るので、並べて流すと Esc と「[B」に分かれて、選択肢の欄が取り消された（最初の `r098-i3`・`r101-i3` の Q1）。`$M/tui.py` はキーの並びを一度に送るように直した。直した後は、前の 1.0.98 の結果（`research/cli/logs/i3`）と同じになった。

### 分からなかったこと

- 測り直さなかったこと：Tab で飛ばした欄、`oneOf` で値が返ること、改行の入れ方、約1万字・20KB を超える貼り付け、`/clear`・`--resume`、サブエージェントに `ask_user` がないこと、`-p`・`--no-ask-user`。changelog とパッケージの中の文には、これらの変更の手がかりはなかった。
- r098-auto4 は、最後の打った発言（STEP2）の前に時間切れになった（並べて流した負荷のため。圧縮の前後の比べには影響しない）。r101h-auto4（Claude）は、上限 30,000 に対してシステムプロンプトが大きく、圧縮の前に履歴の切り詰めが起きた（前の g5-auto と同じく参考にとどめる）。

---

## 5. 文書がファイルのまま送られるか

### 結果

**BYOK では、通信の形式で決まる（1.0.101 で実測）。** `@mini.docx and @spec.pdf and @budget.xlsx and @mini.pptx` を打った最初のリクエスト：

| 通信の形式 | 測ったモデル名 | PDF | docx・xlsx・pptx |
| --- | --- | --- | --- |
| Responses（`COPILOT_PROVIDER_WIRE_API=responses`） | gpt-6-luna、gpt-6.1-sol、gpt-6-sol、gpt-6-astra、gemini-4-argon、**claude-sonnet-5.5** | `input_file` | `input_file` |
| Anthropic（`COPILOT_PROVIDER_TYPE=anthropic`） | claude-haiku-5.5、claude-sonnet-5.5、claude-opus-5.5、**gpt-6-luna** | `document`（`application/pdf`） | 送らない（`<tagged_files>` のパスと行数） |
| chat completions（既定） | gpt-6-luna、claude-haiku-5.5、gemini-4-argon、gemini-3.8-flash | 送らない | 送らない |

- Claude のモデル名でも Responses なら4種類とも、GPT-6 のモデル名でも Anthropic なら PDF だけを送った。**モデルの世代や名前ではなく、通信の形式で決まる。**
- ファイルのまま送ったときに足される「The user included native document attachments in this message. …」の文と、`Document file "@spec.pdf" at path "…"` の文は、1.0.98 の報告と同じだった。
- **記録に残る項目（パッケージの中身と実測）**
  - `user.message` のイベントの `supportedNativeDocumentMimeTypes`（「Normalized document MIME types that were sent natively instead of through tagged_files XML」）に、ファイルのまま送った種類が入り、`events.jsonl` に保存される。実測で、Responses は4種類、Anthropic は `application/pdf` だけ、chat completions は空だった。
  - `assistant.usage` のイベントの `apiEndpoint` は「API endpoint used for this model call, matching CAPI supported_endpoints vocabulary」で、値は `/chat/completions`・`/v1/messages`・`/responses`・`ws:/responses`（`schemas/session-events.schema.json`）。このイベントは一時的なもので、`events.jsonl` には残らない（`ephemeral: true`）。SDK か OpenTelemetry で見る。
- **ログインした経路（CAPI）での形式の決まり方（パッケージの手がかり。確定ではない）**
  - CAPI の形式は、ユーザーの設定ではなく、Copilot のサーバーが返すモデルの一覧の `supported_endpoints` で決まる見込みである。根拠：上の `apiEndpoint` の説明、`runtime.node` に並ぶ文字列「supported_endpoints」「capi_auto」「responses」「websocket_responses」「capabilities」「anthropic」、GHES 向けの文「works best with wireApi: "responses". Contact your GHES administrator to serve this model over the Responses API」、文書の種類を決める「CatalogNegotiatedContract」「clientSupportedNativeDocumentMimeTypes」。
  - `runtime.node` の 0x34ce834 付近の関数は、提供元の名前「Anthropic」と `clau…` の比べ、GPT-5.6・GPT-6 の ID の比べ、`/v1/messages`、`ws:/responses` を持つ（`$M/endpoint101.asm.ann`）。Claude を Anthropic の形式、GPT-5.6・GPT-6 を Responses（WebSocket を含む）に振り分けている見込みだが、機械語を全部は読んでいない。
  - BYOK で chat completions を選ぶと「Model "…" works best with wireApi: "responses".」と出たモデル（組み込みの一覧で Responses がよいとされるもの）：GPT-6.1 Sol、GPT-6 Sol・Luna・Astra、GPT-5.6 の3つ、GPT-5.3-Codex、Grok 4.5〜4.7、MAI-Code-1.1-Flash（退役した GPT-5.x も）。出なかったもの：Claude の全部、Gemini の全部、Kimi K3、gpt-4.1。
- **今の主なモデルの送られ方**

  | モデル | BYOK | ログインした経路（見込み。未確認） |
  | --- | --- | --- |
  | GPT-6.1 Sol、GPT-6 Sol・Luna・Astra、GPT-5.6 | ユーザーが選んだ形式。CLI は Responses を勧める。Responses なら文書をファイルのまま送る（1.0.101 では pdf・docx・xlsx・pptx を確かめた。1.0.98 の調べでは doc・xls・ppt・rtf・odt も） | Responses（`/responses` か `ws:/responses`）。ファイルのまま送る見込み |
  | Claude Haiku 5.5、Sonnet 5.5、Opus 5.5 | `COPILOT_PROVIDER_TYPE=anthropic` なら PDF だけ。chat completions なら送らない | Anthropic の形式（`/v1/messages`）で PDF だけ、の見込み |
  | Gemini 4 Argon、Gemini 3.8 Flash | 既定の chat completions なら送らない（Responses を選べば送る） | 分からない（CLI が Responses を勧めないモデルなので、chat completions で送られるなら文書はパスだけになる） |
  | Grok、MAI-Code | CLI は Responses を勧める | Responses の見込み |
  | Kimi K3 | chat completions なら送らない | 分からない |

### 確かめ方

- `WORKDIR=$M/projdoc PTYPE=<openai|anthropic> WIRE=<responses|空> $M/tuirun.sh d101-<モデル>-<形式> $M/handlers/steps.js <モデル> <port> $M/steps/atdoc.json --`（文書は前の調査の `research/verify2/proj` を写した `$M/projdoc`）
- 中身：`python3 -I $M/scripts/showuser.py $M/logs/d101-…/001-*.json`。記録：`$M/homes/d101-…/session-state/*/events.jsonl` の `user.message` の `supportedNativeDocumentMimeTypes`。
- ログ：`$M/logs/d101-*`（12件と、入れ替えの2件 `d101-claude-sonnet-5.5-openai-responses`、`d101-gpt-6-luna-anthropic`）
- スキーマ：`$M/pkg101/package/schemas/session-events.schema.json`（`AssistantUsageApiEndpoint` は 1781 行目、`supportedNativeDocumentMimeTypes` は 25778 行目）

### 分からなかったこと

- **ログインした経路で、各モデルがどの形式で送られ、どの文書がファイルのまま届くか**（hearing.md 14章 H7）。ログインした人が、`@` で PDF と docx を示して1回送り、`~/.copilot/session-state/<セッション>/events.jsonl` の `user.message` の `supportedNativeDocumentMimeTypes` を見れば分かる（空ならパスだけ、`application/pdf` だけなら Anthropic の形式、4種類なら Responses の形式）。形式そのものは、SDK で `assistant.usage` の `apiEndpoint` を見れば分かる。
- 公開の情報（Web 検索）では、Copilot CLI がどのモデルをどの形式で送るかの説明は見つからなかった。

---

## 6. hearing.md の直すべき記述

| 節 | 今の記述 | 直した文の案 |
| --- | --- | --- |
| 2章の見出し | 「## 2. 依って立つ Copilot CLI 1.0.98 の事実」 | 「## 2. 依って立つ Copilot CLI の事実」 |
| 2章の冒頭の1つ目 | 「この章の事実は、断りがない限り、Copilot CLI 1.0.98 で実測した（オフラインのモードで偽物のモデルにつないで確認、2026-10）。」 | 「この章の事実は、断りがない限り、Copilot CLI 1.0.98 で実測し、1.0.101 でも同じであることを確かめた（オフラインのモードで偽物のモデルにつないで確認、2026-10-22）。1.0.101 で測り直したのは、`ask_user` のフォームと結果の文、Esc と Ctrl+D、autopilot、同じ手番の自動コンパクションでスキルが消えること、フックの差し込みの場所、`@ファイル`・`view`・文書の送られ方、2.7 のシステムプロンプトである。npm の最新の 1.0.102（2026-10-21）でも、2.7 のシステムプロンプトは同じだった。」 |
| 2章の冒頭の2つ目（限界） | 「…本物のモデルが指示にどう従うかは確かめていない（14章）。」 | 末尾に足す：「Auto を選んだときのシステムプロンプトも確かめていない（14章）。」 |
| 2.1 の最後から2行目 | 「Copilot CLI のシステムプロンプトは、全モデルで文章での質問を禁じ（「Never ask questions via plain text output.」）、おすすめを `default` にするよう指示する」 | 「Copilot CLI のシステムプロンプトは、Copilot CLI で選べる全モデルで同じ `<ask_user>` 節を持ち、文章での質問を禁じ（「Never ask questions via plain text output.」）、おすすめを `default` にするよう指示する。全モデルに「Ask for guidance if uncertain; use the ask_user tool to ask clarifying questions」もある（1.0.101 で確認）」 |
| 2.4 の文書の行 | 「…OpenAI Responses の形式はこれらすべてを送り、Anthropic の形式は PDF だけを送る。chat completions の形式はどれも送らず、パスだけを入れる」 | 末尾に足す：「どれを送るかはモデルの名前ではなく通信の形式で決まる（Claude のモデル名でも Responses の形式なら全部を送り、GPT-6 のモデル名でも Anthropic の形式なら PDF だけを送った。1.0.101）。ログインした経路で、各モデルがどの形式で送られるかは確かめていない（H7）」 |
| 2.2 のイベントの行 | 「エクステンションのプロセスはコンパクションをまたいで動き続け、`session.compaction_start` と `session.compaction_complete` のイベントを受け取れる」 | 末尾に足す：「1.0.101 では、イベントに `compactionAttemptId`、`outcome` などの項目が足された（1.0.98 の項目は残る）」 |
| 2.6 の組み込みのエージェント | 「組み込みの explore（費用の低いモデル）と research（claude-sonnet-5）は、定義でモデルが決められている（Copilot CLI 1.0.98 の npm パッケージの `definitions/`）。」 | 「…（Copilot CLI 1.0.98〜1.0.102 の npm パッケージの `definitions/`）。公式のコマンドリファレンスの表は research を claude-haiku-4.5 としていて、パッケージと食い違う。」 |
| 2.6 の最後 | 「…1.0.98 で受け取れるかは確かめていない（…11章 #24）。」 | 「…1.0.100 で直った。今の版（1.0.101、1.0.102）での実測はしていない（…11章 #24）。」 |
| 2.7 の全体 | 表（gpt-4.1、gpt-5-mini、gpt-5.5、gpt-5.4-mini、Claude Sonnet 5.5、Claude Opus 5.5） | 次の「2.7 の案」に置き換える |
| 14章 H7 | 「ログインした環境で、`@` で示した PDF と Office の文書が、どのモデルでファイルのまま届くか」 | 「ログインした環境で、`@` で示した PDF と Office の文書が、どのモデルでファイルのまま届くか。確かめ方：文書を示して1回送り、`~/.copilot/session-state/<セッション>/events.jsonl` の `user.message` の `supportedNativeDocumentMimeTypes` を見る（空ならパスだけ、PDF だけなら Anthropic の形式、4種類なら Responses の形式）」 |
| 14章 H16 | 「1.0.98 で、Gemini 系のモデルが `ask_user` を呼んで失敗しないか（更新履歴 1.0.100 の修正 …）」 | 「ログインした環境で、Gemini 系のモデルが `ask_user` を呼んで失敗しないか（1.0.100 で直った不具合「Gemini tool calls no longer fail when array parameters define enum values」。BYOK のツールの定義には違いが見えない）」 |
| 14章に足す | — | 「H21：Auto を選んだとき、システムプロンプトが 2.7 のどの族になるか。会話の途中でモデルが変わったとき、族も変わるか」「H22：ログインした環境でも、システムプロンプトが 2.7 と同じか」 |
| 出典の「実測」 | 「Copilot CLI 1.0.98 で実測（…2026-10）。…」 | 1行足す：「Copilot CLI 1.0.101・1.0.102 で再確認（オフラインのモードで偽物のモデルにつないで確認、2026-10-22）。2.7 は Copilot CLI で選べる全モデル（33 のモデル名）の対話モードの最初のリクエスト」 |
| 出典の「公式ドキュメント」 | — | 足す：「[Supported AI models in GitHub Copilot](https://docs.github.com/en/copilot/reference/ai-models/supported-models)（Copilot CLI で選べるモデル、退役したモデル）」「[About Copilot auto model selection](https://docs.github.com/en/copilot/concepts/models/auto-model-selection)」 |
| 2.2 の自動コンパクションの行（任意） | 「自動コンパクションは、コンテキストウィンドウの約80%を使うと始まる（公式ドキュメント「Context management」と実測）」 | 任意で足す：「「About GitHub Copilot CLI」は「approaches 95%」と書いていて、公式ドキュメントの中で食い違う」 |

**2.7 の案**

```markdown
### 2.7 モデルごとのシステムプロンプト

- Copilot CLI のシステムプロンプトは、モデルの ID ごとに族に分かれる（1.0.101 で、Copilot CLI で選べる全モデルを測った）。
- 族はモデルの ID の完全一致で決まり、通信の形式では変わらない。知らない ID は「その他」の族になる。

| 族 | モデル（2026-10 に Copilot CLI で選べるもの） | ヒアリングと逆向きの指示 |
| --- | --- | --- |
| GPT | GPT-6.1 Sol、GPT-6 Sol、GPT-6 Luna、GPT-6 Astra、GPT-5.6 Sol・Terra・Luna、GPT-5.3-Codex | 「…then stop—no recap, optional extras, offer to continue, or follow-up question.」「Bias to action: … assume they want tools/code used.」「Make reasonable assumptions for missing details; do not stop at analysis or a partial fix.」 |
| Claude 5 | Claude Haiku 5.5、Sonnet 5.5、Sonnet 5、Opus 5.5、Opus 5、Opus 4.8、Fable 5、Fable 5.1 | 「limit your response to 100 words or less」「Prioritize brevity. Default to the shortest possible response that satisfies the request.」 |
| その他 | Gemini 4 Argon、Gemini 3.8 Flash、Claude Haiku 4.5、Grok、Kimi K3、MAI-Code-1.1-Flash | 「try to limit your response to 100 words or less」 |

- どの族にも、同じ `<ask_user>` 節（2.1）がある。
- 「Be extremely biased for action」は、退役した GPT-4.1 と GPT-5 mini にだけあり、今のモデルにはない。
- Auto を選んだときにどの族になるかは、確かめていない（14章）。
```

- 8.x などで 2.7 を引いている 261 行目（「「100 words or less」などの指示（2.7）があっても省かない」）は、そのままでよい。既定のモデル（Claude Sonnet 5.5）にも、Gemini などにも「100 words」の指示があるので、むしろ当てはまる範囲が広い。
- 2.7 の新しい表で、GPT の族に「Make reasonable assumptions for missing details」があることは、ヒアリングの手順（推し量りで埋めずに `ask_user` で聞く）とまともにぶつかる。今の設計がこの族にも効くかは、本物のモデルで確かめる必要がある（14章の H10・H19 と同じく、ログインした環境で）。
