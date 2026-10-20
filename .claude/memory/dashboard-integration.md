# 画面と Copilot CLI のつなぎ方

Web管理画面（憲章 第20条〜第22条）と Copilot CLI をつなぐときに使えそうな仕組み。2026年10月時点の公式ドキュメントで調べたもので、実際の動きはまだ試していない。設計では、エクステンションでつなぐと決めた（[生成プラグインの構造](../../docs/design/generated-plugin-structure.md)）。

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
- 置き場所は、リポジトリの `.github/extensions/<名前>/`、ユーザーの `~/.copilot/extensions/<名前>/`、インストールしたプラグイン。Agent Plugins の形式のプラグインでは、`com.github.copilot/extensions/` に置く（Copilot CLI の更新履歴 1.0.79）。
- 終わり方：`/clear`（またはセッションの入れ替え）で読み込み直され、Copilot CLI を終えると止められる（SIGTERM、5秒後に SIGKILL）。

### Copilot CLI 1.0.98 のパッケージの中身で分かったこと（実機ではまだ試していない）

- `joinSession` で得たセッションから、次の API を呼べる（Copilot SDK の型定義 `rpc.d.ts`）。エクステンションから呼んで実際に効くかは要確認。
  - エージェントの起動・取り消し・一覧：`tasks.startAgent`、`tasks.cancel`、`tasks.list`。手番を終えたエージェントは、`idle`（次の頼みを待つ）で残りうる。
  - サブエージェントのモデルの上書き：`tools.updateSubagentSettings`。
  - 今のモデルと選べるモデル：`model.getCurrent`、`models.list`。
- `joinSession` には、ツールを使う前のフック（`onPreToolUse`）と、許可の求めに答える仕組み（`onPermissionRequest`）を登録できる。フックが裏のエージェントのツールにも効くかは要確認。
- 読み込みのときの確認：エクステンションが、確認を省くツール（`skipPermission`）、フック、許可の求めに答える仕組みのどれかを登録すると、Copilot CLI は読み込みのときに1回、それを許すかの確認（`kind` が `extension-permission-access`）をチャットに出す。確認に並ぶ項目には「許可の求めを見る」もある。断ると、ツールもフックも登録されず、読み込まれないのと同じになる（`cli-main.js`）。
- Node.js：エクステンションは Copilot CLI 自身の実行ファイルで起動される（`cli-main.js` の `launcherProgram: process.execPath`）。そのため、Node.js を別に入れなくてよい見込み（要確認）。
- 許可の求めのイベント（`permission.requested`）が、`onPermissionRequest` を登録しないエクステンションにも届くかは分からない。手がかりは両方ある（届く：SDK の型定義の説明。届かない：Copilot CLI が「許可の求めを見る」を、読み込みのときの確認で許す権限として扱っていること）。

## サンドボックス

Copilot CLI 1.0.98 の付属の説明（`copilot help sandbox`）、更新履歴、実装で確かめた。

- ユーザーがサンドボックスを有効にすると、シェルのコマンドとフックは、その中で動く。手元で動かす MCP サーバーと LSP サーバーも、既定では中で動く（設定 `sandboxMcpServers`、`sandboxLspServers` を `false` にすると外で動く）。リモートの MCP サーバーは中で動かない。
- Linux では、サンドボックスごとに専用のネットワーク（ネットワーク名前空間）が作られる。外から中へ接続を通す仕組みは、実装に見当たらない。そのため、中で起動した画面のサーバーには、ブラウザーからつながらない。
- macOS では、ローカルネットワークの許可（`allowLocalNetwork`）がオフだと、中で 127.0.0.1 に起動したサーバーも止められる。
- サンドボックスは既定ではオフ。ただし、組織の設定で必ず有効にされることがある。
- Web管理画面の土台を設計するときは、サンドボックスが有効でも画面を開けるようにするか、開けないことをユーザーに伝えるかを決める。

関連：[ハーネスエンジニアリングの目的と人間の役割](harness-purpose.md)、[プラグイン](plugins.md)

## 出典

- [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-configuration)
- [GitHub Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- [About extensions for GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-cli-extensions)
- [Creating an extension for GitHub Copilot CLI](https://docs.github.com/en/copilot/tutorials/create-an-extension)
- [Copilot SDK for Node.js（README）](https://github.com/github/copilot-sdk/blob/main/nodejs/README.md)
- Copilot CLI 1.0.98 の npm パッケージ（`@github/copilot`）の中身：`copilot-sdk/docs/extensions.md`、`copilot-sdk/types.d.ts`、`copilot-sdk/generated/rpc.d.ts`、`cli-main.js`。詳しくは [生成プラグインの構造](../../docs/design/generated-plugin-structure.md) の出典
