# Copilot CLI の試験機能

2026年10月時点の公式ドキュメントと、Copilot CLI 1.0.98 で実際に試した結果。このリポジトリでは、クリエイターを開発するための試験は Claude Code で行い、最終確認だけ人が手元の Copilot CLI で行う。ユーザーが生成プラグインに行う試験は、Copilot SDK で手元の Copilot CLI を動かして行う（[試験の設計](../../docs/design/testing.md)）。

## 試験のための専用コマンドはない

- Claude Code の `claude plugin eval` に当たる、EVAL 専用のコマンドはない。
- Claude Code の `claude plugin validate` に当たる、プラグインの検証コマンドもない。

## 試験に使える公式機能

| 機能 | 内容 |
| --- | --- |
| `copilot -p "依頼"` | 対話せずに、最後まで自動で実行する |
| `--plugin-dir=フォルダ` | インストールせずに、プラグインを読み込む |
| `COPILOT_HOME` | 設定フォルダを切り替えて、ほかの設定を混ぜない |
| `--output-format=json` | 実行の経過を JSON で出す |
| OpenTelemetry のファイル出力 | スキルが呼ばれたか（`github.copilot.skill.invoked`）、使ったツール、AI クレジットの消費量が分かる |
| Copilot SDK | プログラムから Copilot CLI を動かす。エージェントの質問に、プログラムで答えられる |

## トークンなしでできること（実際に試した結果）

- できる：プラグインのインストール、`copilot plugin list --json`、`copilot skill list --json`、`copilot mcp list --json`。スキルと MCP サーバーが読み込まれたかを、モデルを使わずに確かめられる。
- できない：カスタムエージェントは、モデルが使えないと読み込み自体が省かれる。フックが読み込まれたかも、確かめられなかった。
- `plugin list` と `skill list` は `--plugin-dir` のプラグインも出すが、`lsp list` と `instruction list` は出さない。
- Agent Plugins の形式のプラグインをインストールすると、`com.github.copilot/lsp.json` の LSP サーバーが読み込まれた（`copilot lsp list`）。
- `-p` での実行は、ログインしないと始まらない。`--agent` で指定したエージェントがあるかも、確かめられない。
- フォルダを指定するインストールは、将来廃止されると表示された。マーケットプレイスを通したインストールだけになる。

## Copilot SDK で試す（公式ドキュメントとパッケージの中身で調べた結果。モデルを使う動きは、まだ試していない）

- `--plugin-dir` でプラグインを読み込む。フック、MCP サーバー、カスタムエージェントも読み込まれる。環境変数 `COPILOT_PLUGIN_DIR_ONLY=true` で、ユーザーがインストールしているほかのプラグインを外せる。読み込まれたプラグインは `rpc.plugins.list()` で分かる。
  - 形式は、読み込み方ではなく、マニフェストの `$schema` で決まる。Agent Plugins の形式なら、`--plugin-dir` でも `com.github.copilot/` の中が読まれる（Copilot CLI 1.0.98 の実装と更新履歴で確認。スキルが読まれることは実際に動かして確かめた）。
- エージェントの質問には `onUserInputRequest`、許可の求めには `onPermissionRequest` で、プログラムから答えられる。
- 採点と記録に使えるイベント：`skill.invoked`（スキルが呼ばれた）、`subagent.started`・`subagent.completed`（カスタムエージェントとそのモデル）、`tool.execution_*`（使ったツール）、`user_input.requested`（質問）、`assistant.usage`（呼び出しごとのトークンと費用）、`session.idle`（手番の終わり）。
- SDK は、対応する版の Copilot のランタイムを同梱している（SDK 1.0.22 は 1.0.98）。手元の Copilot CLI を使うときは `COPILOT_CLI_PATH` で指定する。
- `copilot -p` で使える主な項目：`--allow-tool`、`--deny-tool`、`--no-ask-user`（質問させない）、`--share=PATH`（会話の記録を Markdown に書き出す）。

## 費用と環境

- 2026年6月1日から、Copilot の利用は AI クレジットで数える。1クレジットは 0.01 ドルで、使ったモデルとトークンの量で決まる。個人プランの月の枠は、Pro が 1,500、Pro+ が 7,000、Max が 20,000 クレジット。
  - SDK は CLI と同じランタイムをユーザーのアカウントで動かすので、SDK で動かした分も数えられる。`assistant.usage` の費用（`totalNanoAiu`）は nano-AIU で、1 AI クレジット = 10億 nano-AIU（Copilot SDK 1.0.22 の型定義で確認）。
- Copilot CLI のローカルのサンドボックスは、2026年10月7日に一般提供になった。有効にすると、中で起動した画面にブラウザーからつながらないことがある（[画面と Copilot CLI のつなぎ方](dashboard-integration.md)）。

## 公式ドキュメントで分からないときは、パッケージの中身を読む

公式ドキュメントにないことや、ドキュメントどうしが食い違うことは、npm パッケージの中身で確かめられる。`npm pack` で取ってくれば、パッケージのスクリプトは動かない。

- Copilot CLI（`@github/copilot-<OS>-<CPU>`）は、Node.js の単一の実行ファイルである。プログラムは、資産 `copilot.tgz` として gzip で埋め込まれている。ファイルの中から gzip の始まりを探して展開すると、取り出せる。
- 取り出したものの中で役に立つもの：

  | もの | 分かること |
  | --- | --- |
  | `changelog.json` | 版ごとの変更点。ドキュメントより新しく、細かい |
  | `schemas/api.schema.json`、`schemas/session-events.schema.json` | SDK の API とイベントの項目と、その説明 |
  | `definitions/*.agent.yaml` | 組み込みのエージェントの定義。カスタムエージェントの書き方の手本になる |
  | `prebuilds/<OS>/runtime.node` | 中心の処理（ネイティブのモジュール）。`strings` で、エラーメッセージや項目名を探せる |

- `copilot help <話題>`（例：`copilot help sandbox`）は、ドキュメントにない詳しい説明を出す。ログインは要らない。
- Copilot SDK（`@github/copilot-sdk`）は、README と型定義（`dist/generated/rpc.d.ts`、`dist/generated/session-events.d.ts`）を読める。
- 中身は版で変わる。確かめた版を、書いたものに残す。

## 出典

- [GitHub Copilot CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)
- [GitHub Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- Copilot CLI 1.0.98（`@github/copilot`）と Copilot SDK 1.0.22（`@github/copilot-sdk`）の npm パッケージの中身
- [Copilot SDK: Streaming events](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/streaming-events)
- [Copilot SDK: Plugin directories](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/plugin-directories)
- [Copilot SDK for Node.js（README）](https://github.com/github/copilot-sdk/blob/main/nodejs/README.md)
- [GitHub Copilot CLI programmatic reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-programmatic-reference)
- [Usage-based billing for individuals](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals)
- [Configuring local sandbox settings](https://docs.github.com/en/copilot/how-tos/cloud-and-local-sandboxes/configuring-local-sandbox-settings)
