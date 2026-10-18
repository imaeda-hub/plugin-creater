# 画面と Copilot CLI のつなぎ方

Web管理画面（憲章 第20条〜第22条）と Copilot CLI をつなぐときに使えそうな仕組み。2026年10月時点の公式ドキュメントで調べたもので、実際の動きはまだ試していない。どれを使うかは、Web管理画面の設計で決める。

## フック

- エージェントの動きに合わせて、決まったときに自動で動くコマンド。プラグインでは `com.github.copilot/hooks/hooks.json` に置く。
- 主なイベント：`sessionStart`、`sessionEnd`、`userPromptSubmitted`、`preToolUse`、`postToolUse`、`postToolUseFailure`、`agentStop`、`subagentStart`、`subagentStop`、`errorOccurred`、`notification`。
- エージェントの状態を受け取る：
  - サブエージェントの開始と終了は `subagentStart` と `subagentStop` で分かる。`agentName` が入る。
  - サブエージェントの中で起きたフックには、分かるときは `agentId`、`agentType`、`parentAgentId` が入る。
  - 組み込みの `general-purpose` エージェントは、`subagentStart` と `subagentStop` を出さない。カスタムエージェントは出す。
- 止める：
  - `preToolUse` で `permissionDecision: "deny"` を返すと、そのツールを使わせない。コマンドのフックは、終了コード 2 でも拒める。フックが落ちたときは、拒む側に倒れる。
  - `permissionRequest` で `behavior: "deny"` と `interrupt: true` を返すと、エージェント全体が止まる。
  - `agentStop` と `subagentStop` の `decision: "block"` は、止めるのではなく、もう1ターン続けさせる。8回続くと、Copilot CLI がフックを無視して終える。
- 時間切れ：`timeoutSec`（既定は30秒）。時間切れのときは、どのイベントでもそのまま進む（`preToolUse` も）。画面のサーバーが応答しないと、止める仕組みが素通りになりうるので注意する。
- `notification` のフックだけは、終わるのを待たずに進む。

## MCP サーバー

- Agent Plugins の標準の部品。プラグインでは直下の `mcp.json` に置く。
- stdio の MCP サーバーには、環境変数 `PLUGIN_ROOT` と `PLUGIN_DATA` が渡される。
- プラグインの MCP サーバーがセッションの開始と同時に起動するかは、公式ドキュメントに書かれていない（要確認）。

## エクステンション

- Copilot CLI の横で、別のプロセスとして動く Node.js のモジュール（`extension.mjs` など）。`@github/copilot-sdk/extension` の `joinSession` でセッションにつながる。セッションのあいだ動き続ける。
- できること：ツールとスラッシュコマンドを足す。`session.on(...)` でセッションのイベント（`tool.execution_start` など）を受け取る。`session.log` でチャットに書く。
- 試験的な機能で、`--experimental` を付けて起動するか、`/experimental on` にする必要がある。
- 置き場所は、リポジトリの `.github/extensions/<名前>/`、ユーザーの `~/.copilot/extensions/<名前>/`、インストールしたプラグイン。プラグインにどう入れるかは、公式ドキュメントに書かれていない（要確認）。
- セッションにメッセージを送ったり、処理を止めたりできるかは、エクステンションのドキュメントに書かれていない。Copilot SDK のセッションには `send`（メッセージを送る）と `abort`（処理中のメッセージを止める）があるが、エクステンションから使えるかは要確認。

関連：[ハーネスエンジニアリングの目的と人間の役割](harness-purpose.md)、[プラグイン](plugins.md)

## 出典

- [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-configuration)
- [GitHub Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- [About extensions for GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-cli-extensions)
- [Creating an extension for GitHub Copilot CLI](https://docs.github.com/en/copilot/tutorials/create-an-extension)
- [Copilot SDK for Node.js（README）](https://github.com/github/copilot-sdk/blob/main/nodejs/README.md)
