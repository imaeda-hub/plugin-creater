# カスタムエージェント（GitHub Copilot CLI）

## 役割

- 主にマルチエージェント構成を作るために使う。
- マルチエージェント構成の中の1つのエージェントを定義する。
- 定義したエージェントを組み合わせて、マルチエージェント構成を作る。

## フロントマター

- ヘッダー部にフロントマターを書く。本文（エージェントへの指示）は 30,000 文字まで。
- 必須の項目は `description` だけ。`name` は任意で、省くとファイル名から作った ID になる。
- 主な任意の項目：
  - `model`：使うモデル（特に有効）。優先する順のリストでも書ける。
  - `tools`：使えるツール。省くと、すべてのツールを使える。
  - `mcp-servers`：そのエージェントだけが使う MCP サーバー。
  - `disable-model-invocation`、`user-invocable`：自動で呼ばれるか、人が選べるか。`infer` は退役扱い。
- 項目の一覧は、Copilot CLI のコマンドリファレンスと、カスタムエージェントの設定リファレンスとで一部違う。
- 書き込みや読み取りの権限を決める専用の項目はない。`tools` で使えるツールを絞って決める。例：検証エージェントは `read` と `search` だけにして、成果物を直せないようにする。
- 呼び出せるサブエージェントを決める専用の項目は見当たらない。`tools` に `agent` を入れるかどうかで、ほかのカスタムエージェントを呼べるかが決まる。

## tools の書き方

- 別名で書く。大文字と小文字は区別しない。

  | 別名 | 意味 |
  | --- | --- |
  | `execute` | コマンドを実行する |
  | `read` | ファイルを読む |
  | `edit` | ファイルを書く・直す |
  | `search` | ファイルや文字を探す |
  | `agent` | ほかのカスタムエージェントを呼ぶ |
  | `web` | Web を検索する・取得する |
  | `todo` | タスクの一覧を作る |

- Claude Code のツール名（`Read`、`Edit`、`Write`、`Bash`、`Grep`、`Glob` など）も、互換の別名として受け付ける。
- MCP のツールは `サーバー名/ツール名`、サーバーのツールすべては `サーバー名/*` と書く。

## モデルの指定（2026年10月時点の公式ドキュメント）

- `model` に1つ、または優先する順のリスト（例：`model: [gpt-6-luna, claude-haiku-5.5]`）を書く。ユーザーのプランで使える最初の候補が使われ、どれも使えなければセッションのモデルになる。`model-policy` が `preferred`（既定）なら `/subagents` で上書きでき、`required` なら上書きできない。
  - 公式ドキュメントと実装が食い違う。今のコマンドリファレンスのフロントマターの表（Custom agent frontmatter fields）は、`model` を1つのモデル、優先する順のリストを `models`、方針を `modelPolicy` としている。一方、Copilot CLI 1.0.98 の実装と組み込みのエージェントの定義は、`model` にリストを書き、方針を `model-policy` と書く。どちらの書き方が効くかは、実機で確かめる（要確認）。
- モデルが決まる順は、呼び出しごとの指定 → ユーザーの設定 → エージェントの定義 → 親のセッション。
- ユーザーがモデルを Auto にしていると、サブエージェントも `model` に関係なく Auto が選んだモデルになる。
- プラグインからは、ユーザーと話すメインのエージェントのモデルを決められない。マニフェストにモデルの項目がない。決めるのは、ユーザーの `/model`、`--model`、設定である。
- サブエージェントは、ユーザーに質問できない。Copilot CLI 1.0.98 で実測すると、組み込みのサブエージェントにも、カスタムエージェント（`tools` に `ask_user` を書いても）にも、`ask_user` は渡らなかった。`--agent` でメインのエージェントに選んだカスタムエージェントは使える。Claude Code でも、質問のツールはすべてのサブエージェントから取り除かれる。ユーザーとの対話は、メインのエージェントに残す。
- サブエージェントが受け取るのは、自分のシステムプロンプトと、渡した prompt だけで、返るのは最後の文だけである（実測）。
- 別名 `search`・`web` を書いたカスタムエージェントにツールが渡るよう直ったのは、更新履歴では 1.0.100 からである。

## モデルとシステムプロンプト（2026年10月）

- Copilot CLI のシステムプロンプトは、モデルの ID ごとに族に分かれる。今の GPT の族（GPT-6 系など）には「Bias to action」「Make reasonable assumptions for missing details」、Claude 5 の族には「limit your response to 100 words or less」「Prioritize brevity」が入る。聞き取りの手順とぶつかるので、スキルの側で優先を書く（[ヒアリングの設計](../../docs/design/hearing.md) 2.7、10.2）。
- 退役したモデル：GPT-4.1（2026-06-01）、GPT-5 mini・GPT-5.5・GPT-5.4 mini など（2026-10-19）。既定のモデルは Claude Sonnet 5.5。古いモデルの事実に頼らない（憲章 第5条3項）。
- 費用（100万トークンあたり、入力・出力）：GPT-6 Luna と Claude Haiku 5.5 は 0.10・0.50 ドル、GPT-6.1 Sol と Claude Sonnet 5.5 は 2.00・10.00 ドルで、20倍違う。GPT-6.1 Sol は Pro プランでは使えない。年額の旧プランは、プロンプトの数とセッションのモデルで数えるので、作業エージェントを安いモデルにしても費用は変わらない。

## サブエージェントとスキル

- サブエージェントにも、プラグインのスキルが見える。スキルの description に合う仕事を頼むと、サブエージェントがそのスキルを呼び、統括エージェント向けの手順を最初から自分で始めてしまうことがあった（Claude Code で確認）。
- 作業や検証のエージェントは `tools` を絞って、スキルを呼べないようにする。Claude Code では、これで防げた。
  - 要確認：Copilot CLI でも同じように防げるかは、未確認。

## 出典

- [GitHub Copilot CLI command reference（Custom agents reference）](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)
- [Custom agents configuration](https://docs.github.com/en/copilot/reference/custom-agents-configuration)
- [GitHub Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- [Models and pricing for GitHub Copilot](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)
- [Supported AI models in GitHub Copilot](https://docs.github.com/en/copilot/reference/ai-models/supported-models)
- [Copilot requests（年額の旧プラン）](https://docs.github.com/en/copilot/concepts/billing/copilot-requests)
- [Copilot CLI changelog](https://github.com/github/copilot-cli/blob/main/changelog.md)
- [Claude Code: Create custom subagents](https://code.claude.com/docs/en/sub-agents)
