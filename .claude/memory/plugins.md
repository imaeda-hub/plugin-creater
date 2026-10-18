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
  - フック：`com.github.copilot/hooks/hooks.json`
  - LSP サーバー：`com.github.copilot/lsp.json`
- つまり、Agent Plugins の形式を守ったまま、カスタムエージェントなども同梱できる。

## マーケットプレイス

- マーケットプレイスを作り、その中に複数のプラグインを入れることができる。
- ユーザーがマーケットプレイスを Copilot CLI などに登録すると、そのマーケットプレイス内のプラグインをいつでもインストールできる。
- マーケットプレイスは Agent Plugins 1.0.0 の仕様にはなく、Copilot CLI の仕様である。`marketplace.json` を `.github/plugin/` フォルダに置く。

## 出典

- [Agent Plugins 仕様リポジトリ](https://github.com/agentplugins/agent-plugins-spec)
- [GitHub Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
