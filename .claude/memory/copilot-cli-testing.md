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
- フォルダを指定するインストールは、将来廃止されると表示された。マーケットプレイスを通したインストールだけになる。

## Copilot SDK で試す（公式ドキュメントで調べた結果。まだ動かしていない）

- `--plugin-dir` でプラグインを読み込む。フック、MCP サーバー、カスタムエージェントも読み込まれる。環境変数 `COPILOT_PLUGIN_DIR_ONLY=true` で、ユーザーがインストールしているほかのプラグインを外せる。読み込まれたプラグインは `rpc.plugins.list()` で分かる。
  - 形式は、読み込み方ではなく、マニフェストの `$schema` で決まる。Agent Plugins の形式なら、`--plugin-dir` でも `com.github.copilot/` の中が読まれる（Copilot CLI 1.0.98 の実装と更新履歴で確認。スキルが読まれることは実際に動かして確かめた）。
- エージェントの質問には `onUserInputRequest`、許可の求めには `onPermissionRequest` で、プログラムから答えられる。
- 採点と記録に使えるイベント：`skill.invoked`（スキルが呼ばれた）、`subagent.started`・`subagent.completed`（カスタムエージェントとそのモデル）、`tool.execution_*`（使ったツール）、`user_input.requested`（質問）、`assistant.usage`（呼び出しごとのトークンと費用）、`session.idle`（手番の終わり）。
- SDK は、自分に合う版の Copilot CLI を同梱している。手元の Copilot CLI を使うときは `COPILOT_CLI_PATH` で指定する。
- `copilot -p` で使える主な項目：`--allow-tool`、`--deny-tool`、`--no-ask-user`（質問させない）、`--share=PATH`（会話の記録を Markdown に書き出す）。

## 費用と環境

- 2026年6月1日から、Copilot の利用は AI クレジットで数える。1クレジットは 0.01 ドルで、使ったモデルとトークンの量で決まる。個人プランの月の枠は、Pro が 1,500、Pro+ が 7,000、Max が 20,000 クレジット。
  - SDK は CLI と同じランタイムをユーザーのアカウントで動かすので、SDK で動かした分も数えられる。`assistant.usage` の費用（`totalNanoAiu`）は nano-AIU で、1 AI クレジット = 10億 nano-AIU（Copilot SDK 1.0.22 の型定義で確認）。
- Copilot CLI のローカルのサンドボックスは、2026年10月7日に一般提供になった。Linux では、サンドボックスの中のコマンドは専用のネットワークを使う。外から中へ接続を通す仕組みはないので、中で起動した Web の画面にはブラウザーからつながらない。シェルのコマンド、フック、手元で動かす MCP サーバー（既定）が中で動く。サンドボックスは既定ではオフ（`copilot help sandbox` と実装で確認）。

## 出典

- [GitHub Copilot CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)
- [GitHub Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- [Copilot SDK: Streaming events](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/streaming-events)
- [Copilot SDK: Plugin directories](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/plugin-directories)
- [Copilot SDK for Node.js（README）](https://github.com/github/copilot-sdk/blob/main/nodejs/README.md)
- [GitHub Copilot CLI programmatic reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-programmatic-reference)
- [Usage-based billing for individuals](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals)
- [Configuring local sandbox settings](https://docs.github.com/en/copilot/how-tos/cloud-and-local-sandboxes/configuring-local-sandbox-settings)
