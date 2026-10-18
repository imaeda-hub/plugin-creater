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

## 出典

- [GitHub Copilot CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)
- [GitHub Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- [Copilot SDK: Streaming events](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/streaming-events)
