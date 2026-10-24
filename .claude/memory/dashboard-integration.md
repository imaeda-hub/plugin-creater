# 画面と Copilot CLI のつなぎ方

Web管理画面（憲章 第20条〜第22条）と Copilot CLI をつなぐときに使える仕組み。2026年10月時点の公式ドキュメントで調べ、エクステンションとフックの動きは、Copilot CLI 1.0.102（Copilot SDK 1.0.25 が同梱する版）に偽物のモデルをつないで試した（Linux x64）。ログインした本物のアカウント、実ブラウザー、Windows・macOS、サンドボックスを有効にした環境では試していない。設計では、エクステンションでつなぐと決めた（[生成プラグインの構造](../../docs/design/generated-plugin-structure.md)）。

## フック

- エージェントの動きに合わせて、決まったときに自動で動くコマンド。プラグインでは `com.github.copilot/hooks/hooks.json` に置く。
- 主なイベント：`sessionStart`、`sessionEnd`、`userPromptSubmitted`、`preToolUse`、`postToolUse`、`postToolUseFailure`、`agentStop`、`subagentStart`、`subagentStop`、`errorOccurred`、`notification`。
- エージェントの状態を受け取る：
  - サブエージェントの開始と終了は `subagentStart` と `subagentStop` で分かる。`agentName` が入る。
  - サブエージェントの中で起きたフックには、分かるときは `agentId`、`agentType`、`parentAgentId` が入る。
  - 組み込みの `general-purpose` エージェントは、`subagentStart` と `subagentStop` を出さない。カスタムエージェントは出す。
- 止める：
  - `preToolUse` で `permissionDecision: "deny"` を返すと、そのツールを使わせない。コマンドのフックは、終了コード 2 でも拒める。フックが落ちたときは、拒む側に倒れる。`permissionDecisionReason` の文は、「Denied by preToolUse hook: <理由>」としてそのままモデルに届く（1.0.102 の実測）。
  - `permissionRequest` で `behavior: "deny"` と `interrupt: true` を返すと、エージェント全体が止まる。
  - `agentStop` と `subagentStop` の `decision: "block"` は、止めるのではなく、もう1ターン続けさせる。8回続くと、Copilot CLI がフックを無視して終える。
- 時間切れ：`timeoutSec`（既定は30秒）。時間切れのときは、どのイベントでもそのまま進む（`preToolUse` も）。画面のサーバーが応答しないと、止める仕組みが素通りになりうるので注意する。
- `notification` のフックだけは、終わるのを待たずに進む。

## MCP サーバー

- Agent Plugins の標準の部品。プラグインでは直下の `mcp.json` に置く。
- stdio の MCP サーバーには、環境変数 `PLUGIN_ROOT` と `PLUGIN_DATA` が渡される。
- 1.0.102 の実機では、プラグイン直下の `mcp.json` のサーバーに、起動した画面で「MCP Servers reloaded: 1 server connected」と出て、そのツールがモデルに届いた。セッションの開始と同時に起動するかは、公式ドキュメントに書かれておらず、確かめていない。

## エクステンション

- Copilot CLI の横で、別のプロセスとして動く Node.js のモジュール（`extension.mjs` など）。`@github/copilot-sdk/extension` の `joinSession` でセッションにつながる。セッションのあいだ動き続ける。
- できること：ツールとスラッシュコマンドを足す。`session.on(...)` でセッションのイベント（`tool.execution_start` など）を受け取る。`session.log` でチャットに書く。
- 試験的な機能（読み込みの条件は下の節）。
- 置き場所は、リポジトリの `.github/extensions/<名前>/`、ユーザーの `~/.copilot/extensions/<名前>/`、インストールしたプラグイン。Agent Plugins の形式のプラグインでは、`com.github.copilot/extensions/` に置く（Copilot CLI の更新履歴 1.0.79。公式の表にはない。1.0.102 の実機で読み込まれた）。
- 終わり方：`/clear`（またはセッションの入れ替え）で読み込み直され、Copilot CLI を終えると止められる（SIGTERM、5秒後に SIGKILL）。1.0.102 の実機では、Copilot CLI を終えると、エクステンションが起動した画面のサーバーのポートは閉じ、エクステンションのプロセスも残らなかった（`-p` の終了と、端末への SIGTERM の両方）。

### 読み込みの条件と確認（1.0.102 の実測）

- `--experimental` なしでは、エクステンションのツールは載らない。`copilot --experimental` で起動する。一度付けると `settings.json` に `"experimental": true` が残り、次からは付けなくても有効になる（`-p --experimental` でも同じ。公式の説明に「残る」とは書かれていない）。
- 起動したあとは、チャットで `/settings experimental on` と打つ。自動で再起動する（今の会話は終わる）。まだ信頼していないフォルダでは、フォルダの信頼の確認が出て、続けてエクステンションの確認が出る。`/experimental on` も動くが、`copilot help config` が非推奨と書く。無効に戻すのは `/settings experimental off` か `copilot --no-experimental`（どちらも設定に残る）。
- 確認：エクステンションが、確認を省くツール（`skipPermission`）、フック、許可の求めに答える仕組みのどれかを登録すると、Copilot CLI は読み込みのときに、それを許すかの確認（`kind` が `extension-permission-access`）をチャットに出す（`cli-main.js` と実測）。
  - 題は `Extension "plugin:<プラグイン>:<フォルダ>" wants elevated permissions`。本文は `This extension wants to: skip tool permission prompts, register hooks.` のように、登録したものだけが並び（許可の求めに答える仕組みを登録すると `handle permission requests` が加わる）、`Denying will prevent this extension from loading.` が続く。選択肢は `1. Yes`、`2. Yes, and always allow "<名前>" in this directory (<フォルダ>)`、`3. No (Esc)`。断ると、ツールもフックも登録されず、読み込まれない。
  - 作業フォルダが Git のリポジトリのときは、2番目が `in this repo (<場所>)` になる。「always allow」を選ぶと、そのフォルダでは、`/clear` のあとも別のセッションでも、確認が出なかった。`cli-main.js` には、フォルダが分からないときに2番目の代わりに出る `Yes, and don't ask again for "…" this session` もあるが、実機では出せなかった。
  - 再起動の直後は、確認が続けて2回出ることがある（セッションが切り替わるため）。1回目に「always allow」を選ぶと、2回目は出なかった。
  - `-p` では、確認に答える人がおらず、「Approval check ✗ Denied, no one to approve」で読み込まれない。`--allow-tool='extension-permission-access'`（フォルダを絞るなら `extension-permission-access(plugin:<プラグイン>:<フォルダ>)`）か `--allow-all-tools` を付けると読み込まれる。`--allow-all-tools` は、対話モードでも確認を出さずに読み込む。
- 同じセッションのままの起動し直し：`/clear` では「Started a fresh session.」と出て、エクステンションが起動し直され、確認がもう一度出る。エージェントが `extensions_reload` を呼ぶと（`/extensions mode` が既定の Load & Augment のとき。利用者の許可「Copilot wants to reload extensions.」が要る）、セッションは変わらないまま、エクステンションが起動し直され、確認がもう一度出る。`/extensions mode` の切り替えでも起動し直される（公式のコマンドリファレンス。実機では試していない）。起動し直しのあとに裏のエージェントが残るかは、エクステンションが取り消す実装で確かめたため、Copilot CLI だけの動きとしては分からない（取り消すと `/tasks` は空になった）。

### ツールの動き（1.0.102 の実測）

- エクステンションのツールの名前は、前に何も付かず、そのままモデルに届く（ハイフンを含む `plugin-creator_open` が通った）。説明と引数の JSON Schema も届く。Copilot CLI 自身のツール `extensions_reload`・`extensions_manage` も同時に載る。`skipPermission` を付けたツールは、呼んでも確認が出ない。
- `required` の引数が欠けても、Copilot CLI は止めない。`minimum`・`minLength`・`pattern` などは、モデルに届く定義では、説明の末尾の文字（`{minimum: 1}` など）になる。検査はエクステンションの処理でする。
- **ツールの処理が投げた例外の理由は、モデルに届かない。** 届くのは「Failed to execute `<ツール名>` tool with arguments: {…} due to error: Error: Tool execution failed」だけである（SDK 1.0.25 は例外の文を Copilot CLI に渡すが、1.0.102 が一般の文に置き換える）。断るときは、例外でなく `{ textResultForLlm: '<理由>', resultType: 'failure' }` を返す。`failure` と `denied` は、理由の文がそのままモデルに届いた。`rejected` は使わない（理由は画面に出たが、手番が止まり、モデルへの次のリクエストが出なかった）。
- エクステンションが 127.0.0.1 で起動した HTTP サーバーに、同じマシンの別のプロセスから接続できた（サンドボックスなし）。ブラウザーでの表示は確かめていない。

### エクステンションから呼べる API（1.0.98 のパッケージの型定義で調べ、1.0.102 の実機で確かめた）

- `joinSession` で得たセッションから、次の API を呼べた（Copilot SDK の型定義 `rpc.d.ts`）。
  - エージェントの起動・取り消し・一覧：`tasks.startAgent`、`tasks.cancel`、`tasks.list`。`tasks.startAgent({ agentType: "<プラグイン>:<エージェント>", name, prompt, model })` で、定義の本文がシステムプロンプト、`prompt` がユーザーのメッセージとして届き、`model` の指定が効いた。取り消すと、そのエージェントが `task` で起動した同期のエージェントも取り消された。手番を終えたエージェントは、`tasks.list` で `idle`（次の頼みを待つ）で残り、取り消すと `cancelled` になる。このような裏のエージェントには、`subagent.completed` が、手番の終わり（`cancelled` なし）と取り消したあと（`cancelled: true`）の2回届いた。
  - サブエージェントのモデルの上書き：`tools.updateSubagentSettings`。作業と検証のモデルを変えられた。
  - 今のモデル：`model.getCurrent`（動いた）。選べるモデル：エクステンションから呼べるのは `session.rpc.model.list()` で、自前のモデルの窓口では空の一覧を返した。ログインした本物のアカウントでの要素の形と、Auto のときの値は、確かめていない。
- イベント：`subagent.started` の `agentName` と `agentType` は、どちらも `<プラグイン>:<エージェント>`。`agentDisplayName` は短い名前（`worker` など）で、`task` の `description`（呼び出しの説明）ではない。説明は、`tool.execution_start` の `arguments.description` にあり、`toolCallId` で `subagent.started` と結べる。`onSubagentStop` は、`agentId`・`agentName`・`agentType`・`response`（最後の返事）つきで、`subagent.completed` より前に届く。
- `joinSession` には、ツールを使う前のフック（`onPreToolUse`）と、許可の求めに答える仕組み（`onPermissionRequest`）を登録できる。
  - `onPreToolUse` は、メインのエージェントのツールにも、`task` で動くサブエージェント（統括・作業・検証）のツールにも効いた。サブエージェントのときは、`agentId`、`agentType`、`parentAgentId` が付く。`toolName` は実際のツール名で、GPT の族の編集は `apply_patch` になる（このとき `toolArgs` は、JSON でなく、パッチの文字列そのもの）。
  - `onPermissionRequest` は、作業エージェント（サブエージェント）のシェルの許可の求め（コマンドとパス）を受け取れた。`{ kind: 'no-result' }`（答えない）を返すと、チャットに確認が出て、利用者が答えると続行した。
- Node.js：エクステンションは Copilot CLI 自身の実行ファイルで起動される（`cli-main.js` の `launcherProgram: process.execPath`）。そのため、Node.js を別に入れなくてよい見込み（要確認）。
- 許可の求めのイベント（`permission.requested`）が、`onPermissionRequest` を登録しないエクステンションにも届くかは分からない。手がかりは両方ある（届く：SDK の型定義の説明。届かない：Copilot CLI が「許可の求めを見る」を、読み込みのときの確認で許す権限として扱っていること）。

### 確かめていないこと

- ツールが多いときに後回しにされないようにする `defer: "never"` が効くか：ツール検索が働く状況を作れなかった（32個のツールでも、全部ふつうに載った）。
- 本物のログインのアカウントでの動き、実ブラウザーでの画面の表示、Windows・macOS、サンドボックスを有効にした環境。

## サンドボックス

Copilot CLI 1.0.98 の付属の説明（`copilot help sandbox`）、更新履歴、実装で確かめた。実機では試していない。

- ユーザーがサンドボックスを有効にすると、シェルのコマンドとフックは、その中で動く。手元で動かす MCP サーバーと LSP サーバーも、既定では中で動く（設定 `sandboxMcpServers`、`sandboxLspServers` を `false` にすると外で動く）。リモートの MCP サーバーは中で動かない。エクステンションを中に入れる設定は、1.0.102 のパッケージに見当たらず、外で動く見込み。
- Linux では、サンドボックスごとに専用のネットワーク（ネットワーク名前空間）が作られる。外から中へ接続を通す仕組みは、1.0.98 の実装に見当たらなかった。そのため、中で起動した画面のサーバーには、ブラウザーからつながらない。
- ローカルネットワークの許可は、1.0.100 から既定で許す（更新履歴）。1.0.98 の付属の説明では、macOS でローカルネットワークの許可（`allowLocalNetwork`）がオフだと、中で 127.0.0.1 に起動したサーバーも止められる。1.0.101 では、macOS のサンドボックスの中のコマンドが localhost の TCP に直接つながる（ローカルのアクセスが有効で、ホストの絞り込みがないとき）。上の Linux の「外から中へ」が、この変更で変わったかは、確かめていない。
- サンドボックスは既定ではオフ。ただし、組織の設定で必ず有効にされることがある。
- Web管理画面の土台を設計するときは、サンドボックスが有効でも画面を開けるようにするか、開けないことをユーザーに伝えるかを決める。

関連：[ハーネスエンジニアリングの目的と人間の役割](harness-purpose.md)、[プラグイン](plugins.md)

## 出典

- [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-configuration)
- [GitHub Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- [About extensions for GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-cli-extensions)
- [Creating an extension for GitHub Copilot CLI](https://docs.github.com/en/copilot/tutorials/create-an-extension)
- [Copilot SDK for Node.js（README）](https://github.com/github/copilot-sdk/blob/main/nodejs/README.md)
- [Copilot CLI changelog](https://github.com/github/copilot-cli/blob/main/changelog.md)（1.0.79、1.0.100、1.0.101）
- Copilot CLI 1.0.98 と 1.0.102 の npm パッケージ（`@github/copilot`）の中身：`copilot-sdk/docs/extensions.md`、`copilot-sdk/types.d.ts`、`copilot-sdk/generated/rpc.d.ts`、`cli-main.js`。詳しくは [生成プラグインの構造](../../docs/design/generated-plugin-structure.md) の出典
- Copilot CLI 1.0.102 の実機での実測（偽物のモデルにつないだ。Linux x64）
