# スキル（GitHub Copilot CLI）

## 実体

- スキルの実体はただの Markdown ファイルで、作業手順などを自然言語で書く。
- 特徴はヘッダー部のフロントマター。必須フィールドは `name` と `description`。

## 本質は description

- スキルが使われる条件は次の2つ。
  1. スラッシュコマンドで呼ばれたとき
  2. AI が必要と判断したとき
- 2つ目の判断基準は `description` だけである。
- AI は `description` を読み、必要と判断して初めてスキルを使い、本文を読む。
- そのため、不要なスキルの本文は読まれず、コンテキストウィンドウが汚れずに最適化される。これがスキルの本質である。

### description の書き方

- 公式（Agent Skills の仕様、GitHub Docs のスキルの手引きとコマンドリファレンス、Anthropic の手引き）は、「何をするか」と「いつ使うか」の両方を書くよう勧める。1,024文字まで。
- 「呼ばれる場面だけを書き、手順の要約は書かない」は、公式ではなく、obra/superpowers（v7.0.1）の勧めである。要約を書くと、エージェントが本文を読まずに要約に従うため。
- 日本語の description で呼ばれるかについての公式の情報は、見つからなかった（2026年10月）。

## スキルを構成するもの

- スキルは Markdown ファイルだけでなく、次のものを含められる。

  | 構成要素 | 内容 |
  | --- | --- |
  | Markdown（`SKILL.md`） | 作業手順などを自然言語で書く |
  | スクリプト | スキルの中で実行する処理。Python で作られることが多い |
  | アセット | 素材を入れる場所 |
  | リファレンス | 参照資料を入れる場所 |

- スキルは、内部でスクリプトを実行することが多い。

## Markdown とスクリプトの分け方

- 非確率的なアウトプットが必要な処理は、スクリプトで実装することが推奨される。
- これにより、エージェントのアウトプットが安定し、AI クレジットの消費も抑えられる。
- スキルでは、AI による推論が必要な部分と必要でない部分を分け、必要な部分は Markdown の自然言語の指示に、必要でない部分はスクリプトに、適切に振り分ける必要がある。

## フロントマターの決まりは2つある

- Agent Skills の仕様（2026-10-22 取得）：`name`（必須。1〜64文字の英小文字・数字・ハイフン。先頭と末尾はハイフン不可、`--` 不可。親のフォルダの名前と同じ）、`description`（必須）、`license`、`compatibility`、`metadata`、`allowed-tools`（試験的）の6項目。本文は500行以下、5,000トークン以下が推奨。
- Agent Plugins 1.0.0 は、プラグインのスキルが Agent Skills に従うことを求め、従わないものは読み飛ばすと定める（仕様 7.1）。
- Copilot CLI のスキルの決まりはゆるい（`name` に大文字、`_`、`.`、`:`、空白も可）。Copilot 固有の `argument-hint`、`user-invocable`、`disable-model-invocation` は、Agent Skills の6項目にない。公式の参照実装 `skills-ref validate` は、6項目以外の項目を不合格にする（参照実装のソースの読み取り）。Copilot 固有の項目を書くと、Copilot CLI では動いても、参照実装では不合格になり、厳しいクライアントでは飛ばされうる。
- 確かめていない：Copilot CLI 1.0.102 が、Agent Skills に合わないスキルを実際に読み飛ばすか。

## Copilot CLI がスキルを呼ぶとき（1.0.102 で実測）

- スキルのコマンドは `/<プラグイン>:<スキル>`（例：`/plugin-creator:make-plugin`）。`/make` と打つと候補に出る。公式のコマンドリファレンスの例は `/<プラグイン>/<スキル>`（スラッシュ区切り）で食い違う。スラッシュ区切りは、対話モードでは試していない。プラグインの名前とスキルの名前が同じときは `/<スキル>` になる（コードの読み取り。実機では確かめていない）。
- `-p` では、スキルのスラッシュコマンドは展開されず、ただの文字としてモデルに送られた（3通りの書き方で確認）。スキルをコマンドで呼べるのは、対話モードである。
- コマンドで呼ぶと、モデルに次のものが届く：ユーザーのメッセージ「The user explicitly invoked the "/<プラグイン>:<スキル>" skill. Follow its instructions now.」、`<skill-context>`（「Base directory for this skill: <絶対パス>」、「Related files (use view tool to read):」の一覧、`SKILL.md` の本文）、末尾の `ARGUMENTS: <引数>`。モデルが自分で呼ぶときの `skill` ツールの引数は、スキルの名前だけ（プラグインの名前は付かない）。
- **Related files**：スキルを読むと、スキルのフォルダの全ファイルが、1行に1つの絶対パスで届く。読むたびに届き、`SKILL.md` で「読まない」と書いても消せない。実測：ひな形（81ファイル）をスキルのフォルダの中に置くと、一覧は97件・約17.4KB（メッセージ全体で約34.8KB）。スキルのフォルダの外に移すと、16件・約2.3KB（約19.7KB）になった。ひな形のように多くのファイルは、スキルのフォルダの外に置く。パスの長さは環境で変わる（この環境は長い）が、件数は変わらない。移しても、スキル・エージェント・エクステンション・MCP の読み込みは変わらなかった。

## 出典

- [Agent Skills Specification](https://agentskills.io/specification)、[Agent Skills の参照実装 skills-ref](https://github.com/agentskills/agentskills)
- [Agent Plugins 仕様リポジトリ](https://github.com/agentplugins/agent-plugins-spec)（7.1）
- [GitHub Copilot CLI command reference（Skills reference）](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)
- [obra/superpowers](https://github.com/obra/superpowers)（v7.0.1 の writing-skills）
- Copilot CLI 1.0.102 の実機での実測（偽物のモデルにつないだ。Linux x64）
