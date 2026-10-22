# R3 マニフェストとスキーマの調査

- 状態：途中
- 未着手・途中の項目：
  - (A) Agent Plugins 仕様 1.0.0 とスキーマ：済み（A節）
  - (B) Copilot CLI の公式プラグイン仕様：未着手
  - (C) Copilot CLI 1.0.102 の npm パッケージ内のスキーマ：未着手
  - (D) Agent Skills 仕様のフロントマターの制約：未着手
  - 上の「実装者向けの決まりの一覧」「設計書やナレッジの前提と違う事実」は、B〜D が済んでから書く
- 調査日：2026-10-22

---

## A. Agent Plugins 仕様 1.0.0（詳細と出典）

出典：https://github.com/agentplugins/agent-plugins-spec を 2026-10-22 に clone。main の最新コミット `ff8ab5e392cc87bd88d87c060815a87490e51003`（2026-08-19）。タグ `v1.0.0` は `bd383552095128f6effe895b9257cfd580a6d179`（2026-08-06）。以下、仕様書は `spec/1.0.0.md` の節番号。

### A.1 版の状態

- 1.0.0 は公開済み（仕様書の冒頭に `Status: Published`、タグ `v1.0.0`、公開 URL のスキーマが 200 で返る）。
- 1.1.0 は作業中の草案（`spec/1.1.0.md` の冒頭に `Status: Working Draft`）。main の最新コミットは「Start the 1.1.0 working draft」（2026-08-12）とそのマージ（2026-08-19、PR #65）。2026-10-22 時点で、これより新しいコミットはない。
- 1.0.0 と 1.1.0 の違いは、版の番号と `$schema` の値、文言1か所（OAuth の文）だけ。1.1.0 のスキーマは、`$id` と `$schema` の `const` と説明以外は 1.0.0 と同じ。
- `https://agent-plugins.org/schemas/1.1.0/plugin.schema.json` は 404（未公開）。`https://agent-plugins.org/schemas/1.0.0/{plugin,mcp}.schema.json` は 200 で、リポジトリの写しと JSON として同一。
- タグ `v1.0.0` から main までに、`spec/1.0.0.md` と `schemas/1.0.0/` の変更はない。
- 確かめられなかったこと：GitHub の Releases・Issues・PR の一覧（この環境の GitHub API はこのリポジトリに使えない）。リモートのブランチ名には 1.1.0 の先の版を示すものはない。

### A.2 plugin.json（5章）

- 置き場所：プラグインの直下の `plugin.json` だけ（5.1）。ほかのファイルは置き換えも上書きもできない。
- 閉じた形：使える最上位の項目は `$schema`、`name`、`version`、`description`、`author`、`homepage`、`repository`、`license`、`keywords`、`extensions` だけ（5.2）。
  - 知らない最上位の項目は、スキーマ違反だが、クライアントは報告して無視し、読み込みは続ける。
  - それ以外のスキーマ違反は致命的で、クライアントはプラグインを拒む。
- 必須：`$schema` と `name`（5.3）。足りない、型が違う、空のときは無効で、拒まれる。
- `$schema` の値は、1.0.0 では `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` と完全に同じ文字列（5.2、スキーマの `const`）。クライアントは読み込みのときにスキーマを取りに行かない。
- `name`（5.5、スキーマの `pattern`）：
  - 長さ 1〜64 文字。使える文字は `a-z`、`0-9`、`-`、`.`。最初と最後は英数字。`--` と `..` は不可。
  - スキーマの正規表現：`^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$`
  - ピリオドを含められる（`acme.tools` は有効）。
- 任意の項目（5.4）：

  | 項目 | 型 | 備考 |
  | --- | --- | --- |
  | `version` | 文字列 | セマンティックバージョニングを推奨。更新の確認とキャッシュの新しさに使われる。セマンティックバージョニングでなくても拒まれない |
  | `description` | 文字列 | 短い説明。長さの上限はない |
  | `author` | オブジェクト | `name`、`email`、`url`（すべて文字列）だけ。ほかの項目は無効 |
  | `homepage` | 文字列 | URL。URL として確かめられない |
  | `repository` | 文字列 | ソースのリポジトリの URL（オブジェクトではなく文字列）。確かめは型だけ |
  | `license` | 文字列 | SPDX の識別子を推奨。確かめは型だけ |
  | `keywords` | 文字列の配列 | |
  | `extensions` | オブジェクト | 逆ドメインの名前空間をキーとし、値はオブジェクト。8章 |

- `extensions` が配列や文字列などオブジェクトでなければ、報告して無視する（致命的ではない。8.1）。知らない名前空間の値は検査しない。
- コンポーネントの場所を `plugin.json` で変えることはできない。`plugin.json` の中に MCP の設定を書くこともできない（6.1、7.2.1）。

### A.3 フォルダの決まり（4.2、6章、7章、8章）

- プラグインは、1つの場所を根とするフォルダ。根の直下に `plugin.json` が要る（4.1）。
- 固定の場所：
  - スキル：`skills/` の直下の子フォルダのうち、`SKILL.md`（この名前そのまま。通常のファイルに解決されること）を含むもの。それより深い場所は探さない（7.1）。
  - MCP サーバー：根の直下の `mcp.json`。
- 場所がなくてもエラーではない。あっても、フォルダやファイルの種類が違うと、その種類のコンポーネントだけ無効（6.2）。
- 知らない種類のコンポーネントは無視する。1.0.0 が定めるのはスキルと MCP サーバーだけ。コマンド、フック、エージェント、ルール、LSP は、1.0.0 の外（7章、設計の決定）。
- ベンダーのフォルダ（8.2）：クライアントごとの部品は、根の直下の、逆ドメインの名前のフォルダに置く（例：`com.example.client/hooks/hooks.json`）。中身はそのクライアントが決める。Agent Plugins は読み込みや検査の決まりを持たない。
- パスの閉じ込め（4.1）：読み取るパスは、解決した後もプラグインの根の中に収まること。シンボリックリンクで外に出るものは拒まれる。設定の中のプラグイン相対パスは `./` で始める。

### A.4 mcp.json（7.2）

- 根の直下の `mcp.json`。最上位は `$schema` と `mcpServers` の2つだけで、どちらも必須。`mcpServers` は空でもよい。
- `$schema`：1.0.0 では `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json`。`plugin.json` の版と同じでなければならない。食い違うと MCP だけが無効になる（10.1、7.2.2）。
- サーバーの形は3つのどれか1つ（閉じた形。知らない項目・型・他の形の項目があると、そのサーバーだけ無効）：

  | `type` | 必須 | 任意 |
  | --- | --- | --- |
  | `stdio` | `command`（実行ファイル1語。素の名前か、`./` で始まるプラグイン相対パス。展開しない） | `args`（文字列の配列）、`env`（文字列の表。`PLUGIN_ROOT`・`PLUGIN_DATA` は書けない）、`cwd`（`./`、`${PLUGIN_ROOT}`、`${PLUGIN_DATA}` のどれかで始める） |
  | `streamable-http` | `url`（絶対の HTTP または HTTPS。非ループバックは HTTPS。ユーザー情報と断片は不可） | `headers`（文字列の表。秘密を書かない） |
  | `sse` | `url`（同上） | `headers` |

- `${PLUGIN_ROOT}` と `${PLUGIN_DATA}` の展開は、`args` の各要素、`env` の値、`cwd` だけ（9.2）。`command`、`url`、`headers`、`env` のキーは展開しない。
- クライアントは `stdio` と `streamable-http` の少なくとも一方に対応すればよい。`sse` は任意（7.2.1）。
- 例（仕様書 7.2.1 より）：

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "local-validator": {
      "type": "stdio",
      "command": "./bin/validator",
      "args": ["--data", "${PLUGIN_DATA}/validator"],
      "env": { "CONFIG": "${PLUGIN_ROOT}/config.json" },
      "cwd": "${PLUGIN_ROOT}"
    }
  }
}
```

### A.5 PLUGIN_ROOT と PLUGIN_DATA（9章）

- 標準入力と標準出力でつながる子プロセス（stdio の MCP サーバー）を起動するクライアントは、子プロセスの環境変数に `PLUGIN_ROOT`（プラグインの根の絶対パス）と `PLUGIN_DATA`（インストールしたプラグインごとの、書き込める永続のフォルダ。更新しても中身が残る）を渡す（9.1）。`PLUGIN_DATA` はクライアントが作る。
- 使い分け：同梱するスクリプトや設定は `PLUGIN_ROOT`。依存、キャッシュ、状態は `PLUGIN_DATA`。
- 仕様が定めるのは MCP サーバーの設定の中での展開だけ。スキルの本文や、ベンダーのフォルダの中での扱いは定めない。

### A.6 スキーマで表せない決まり（検査は別に要る）

- `plugin.json` の `$schema` と `mcp.json` の `$schema` の版が同じこと（10.1）。
- 相対パスが `./` で始まり、根の中に収まること（4.1）。
- `url` が絶対 URL で、ユーザー情報と断片がなく、非ループバックは HTTPS であること。`headers` の名前が大文字小文字を無視して重ならないこと（7.2.1）。
- `cwd` の解決後の閉じ込め（7.2.1）。
- スキルが Agent Skills 仕様に合うこと（7.1。D節）。
- 仕様書とスキーマが食い違うときは、仕様書が正しい（5.2、7.2.1）。

### A.7 写したスキーマ

- `/home/user/plugin-creater/wip/implementation/research/schemas/agent-plugins-1.0.0/plugin.schema.json`、`mcp.schema.json`、`README.txt`（出どころのコミットと SHA-256）。
- スキルのフロントマターの JSON スキーマは、この仕様リポジトリにない。
