# プラグイン

## プラグインとは

- ハーネス群を配布・インストールするための、標準化された仕様。

## Agent Plugins 1.0.0

- スキルと MCP のパッケージ化を定める。
- 現時点で標準化されているのは、スキルと MCP だけである。
- 1.0.0 は公開済みの正式版である。1.1.0 は作業中の草案である（2026年10月時点）。

## GitHub Copilot CLI のプラグイン

- カスタムエージェント、フック、エクステンション、インストラクションなどは、GitHub Copilot CLI の公式仕様によってプラグインに同梱できる。
- 同梱したプラグインを Copilot CLI でインストールすると、スキルと MCP だけでなく、カスタムエージェント、フック、インストラクションなども適切な場所に配置され、すぐに使える。
- Copilot CLI は、Agent Plugins 1.0.0 の形式のプラグインも読み込める。Agent Plugins が定めていない部品は、プラグイン直下の `com.github.copilot/` フォルダから読み込む。
  - カスタムエージェント：`com.github.copilot/agents/`
  - コマンド（スラッシュコマンド）：`com.github.copilot/commands/`
  - ルール（インストラクション）：`com.github.copilot/rules/`
  - フック：`com.github.copilot/hooks/hooks.json`
  - LSP サーバー：`com.github.copilot/lsp.json`
  - エクステンション：`com.github.copilot/extensions/<名前>/extension.mjs`
- つまり、Agent Plugins の形式を守ったまま、カスタムエージェントなども同梱できる。
- 公式の plugin reference の表（2026-10-22 取得）に、`extensions/` は載っていない。置き場所の根拠は、更新履歴（1.0.79 で追加。1.0.80-0 で直下からは読まなくなった）と、実機（1.0.98 と 1.0.102 で、エクステンションが読み込まれた）である。`commands/` と `rules/` の中のファイルの形は、plugin reference に書かれておらず、確かめていない。Copilot CLI の版を上げるたびに、置き場所を確かめ直す。

### Copilot CLI が読み込める2つの形式

| 形式 | 見分け方 | 部品の置き場所 |
| --- | --- | --- |
| Agent Plugins の形式 | 直下の `plugin.json` の `$schema` が、Agent Plugins の正規の文字列（`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`。1.1.0 の同じ形も受け付ける）と完全に一致する | スキルは `skills/<名前>/SKILL.md`、MCP サーバーは直下の `mcp.json`。Copilot CLI 固有の部品（エージェント、コマンド、フック、LSP、ルール、エクステンション）は `com.github.copilot/` の中 |
| 以前の形式 | `plugin.json` を `.plugin/`、直下、`.github/plugin/`、`.claude-plugin/` の順に探す | `agents/`（`.agent.md`）、`skills/`、`hooks.json` または `hooks/hooks.json`、`.mcp.json` など。`plugin.json` の項目で場所を変えられる |

- 以前の形式では、Claude Code と同じ `.claude-plugin/plugin.json` もマニフェストとして探す。
- 既存のプラグインを作り直すとき（憲章 第13条）は、どちらの形式かを見分けてから部品を読む。
- `$schema` は完全一致で形式が決まる。書き間違えると、何も言われずに以前の形式として読まれ、`com.github.copilot/` の中も直下の `mcp.json` も読まれない。`https://agent-plugins.org/schemas/` で始まるが未対応の版は、プラグインごと拒まれる（公式ドキュメントと 1.0.102 のコードの読み取り。書き間違えたときの実際の出力は試していない）。
- Agent Plugins の形式では、以前の形式の置き場所（直下の `agents/`、`commands/`、`rules/`、`hooks/`、`hooks.json`、`lsp.json`、`.mcp.json`、`extensions/`）は読まれない（1.0.80 から。更新履歴）。
- 仕様にない場所は読まれない。プラグインの根に仕様にないフォルダ（例：`template/`）を置いても、中のスキル・エージェント・エクステンション・MCP・フック・`plugin.json`・`marketplace.json` は、プラグインの部品として読み込まれなかった（1.0.102 で実測。同じ MCP サーバーを根の `mcp.json` に置くと読み込まれることを対照にした）。

### mcp.json（Agent Plugins の形式）

- 直下に置く。閉じた形で、最上位は `$schema`（`plugin.json` と同じ版。食い違うと MCP だけが無効になる）と `mcpServers` の2つだけ。
- サーバーは `type` が必須（`stdio`、`streamable-http`、`sse`）。以前の形式の `.mcp.json` にある `tools`、`timeout`、`type: "http"` などは書けない。知らない項目があると、そのサーバーだけ読み飛ばされる。
- `stdio` の `args`・`env`・`cwd` では、`${PLUGIN_ROOT}` と `${PLUGIN_DATA}` が展開される。
- 公式ドキュメントと Agent Plugins 1.0.0 の仕様で確かめた。実機（1.0.102）では、`$schema` つき、`type: "stdio"`、`${PLUGIN_ROOT}` を使った `mcp.json` の MCP サーバーが接続され、そのツールがモデルに届いた。

## マーケットプレイス

- マーケットプレイスを作り、その中に複数のプラグインを入れることができる。
- ユーザーがマーケットプレイスを Copilot CLI などに登録すると、そのマーケットプレイス内のプラグインをいつでもインストールできる。
- マーケットプレイスは Agent Plugins 1.0.0 の仕様にはなく、Copilot CLI の仕様である。`marketplace.json` を `.github/plugin/` フォルダに置く。

### インストールのしかた（Copilot CLI 1.0.102 で実測）

- 手元のフォルダを直接指定する `copilot plugin install <フォルダ>` は、入るが、「Direct plugin installs (repos, URLs, local paths) are deprecated. Only plugin@marketplace installs will be supported in a future release.」と表示される（廃止予定）。公式ドキュメントは、廃止予定とは書いていない（2026-10-22 取得）。
- マーケットプレイスを通した手元のフォルダ（`copilot plugin marketplace add <フォルダ>` → `copilot plugin install <プラグイン>@<マーケットプレイス>`）は、この表示なしで入る。コピーされず、そのフォルダを直接読む（`copilot plugin list --json` で `"source": "live"`）。フォルダを直すと、次のセッションで反映される。
- `marketplace.json` の `source: "./"`（リポジトリの直下がプラグイン）で入れられた。
- 確かめていない：GitHub の公開リポジトリからの `marketplace add`（まだ公開していなかった）。

## 出典

- [Agent Plugins 仕様リポジトリ](https://github.com/agentplugins/agent-plugins-spec)
- [GitHub Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- [Copilot CLI changelog](https://github.com/github/copilot-cli/blob/main/changelog.md)（1.0.79、1.0.80-0）
- Copilot CLI 1.0.102 の npm パッケージの中身（`cli-main.js`）と、実機での実測（偽物のモデルにつないだ。Linux x64。ログインした本物のアカウントでは試していない）
