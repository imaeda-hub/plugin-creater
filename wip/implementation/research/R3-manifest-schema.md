# R3 マニフェストとスキーマの調査

- 状態：完了
- 未着手・途中の項目：なし。確かめられなかったことは末尾の「確かめられなかったこと」にまとめた
- 調査日：2026-10-22（Copilot CLI の最新は 1.0.102）
- 凡例：[仕様] Agent Plugins 1.0.0 の仕様書、[docs] GitHub Docs、[更新履歴] Copilot CLI の更新履歴、[コード] 1.0.102 のパッケージの中身を読んで分かったこと、[推奨] 事実から導いた実装上の勧め（事実ではない）

---

## (1) 実装者向けの決まりの一覧

### 1.1 `plugin.json`（クリエイターも生成プラグインも同じ）

- 置き場所はプラグイン直下の `plugin.json` だけ。[仕様 5.1]
- 閉じた形。使える最上位の項目は次の10個だけで、ほかは「スキーマ違反」である（クライアントは報告して無視する）。`skills`、`agents`、`hooks`、`mcpServers` などの場所を指す項目は書けない。[仕様 5.2、docs]

  | 項目 | 型 | 必須 | 決まり |
  | --- | --- | --- | --- |
  | `$schema` | 文字列 | 必須 | 完全に `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` |
  | `name` | 文字列 | 必須 | 1〜64文字。`a-z`、`0-9`、`-`、`.` だけ。最初と最後は英数字。`--` と `..` は不可。正規表現は `^(?!.*(?:--\|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$` |
  | `version` | 文字列 | 任意 | セマンティックバージョニングを推奨（守らなくても拒まれない）。更新の確認とキャッシュの新しさに使われる |
  | `description` | 文字列 | 任意 | 長さの上限は仕様にない |
  | `author` | オブジェクト | 任意 | `name`、`email`、`url`（すべて文字列、すべて任意）だけ。ほかの項目は無効 |
  | `homepage` | 文字列 | 任意 | URL |
  | `repository` | 文字列 | 任意 | ソースの URL。**オブジェクトは不可**（例：`https://github.com/OWNER/REPO`） |
  | `license` | 文字列 | 任意 | SPDX の識別子を推奨 |
  | `keywords` | 文字列の配列 | 任意 | |
  | `extensions` | オブジェクト | 任意 | 逆ドメインの名前空間をキーにし、値はオブジェクト（例：`{"com.github.copilot": {...}}`）。Copilot CLI がこの値に意味を与えるかは、公式の資料にない |

- 書き方の例（検証済み：写したスキーマで合格することを `jsonschema` 4.26.0 で確かめた）：

  ```json
  {
    "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    "name": "weekly-report",
    "version": "0.1.0",
    "description": "週報を作るプラグイン",
    "author": { "name": "Example Author" },
    "repository": "https://github.com/OWNER/weekly-report",
    "license": "MIT",
    "keywords": ["report"]
  }
  ```

  最小は `$schema` と `name` だけ。
- **`$schema` は完全一致でなければならない**。Copilot CLI は、1.0.0 か 1.1.0 の正規の文字列に完全に一致したときだけ Agent Plugins の形式として読み、一致しなければ、何も言わずに以前の形式として読む。つまり、`$schema` を書き間違えると、`com.github.copilot/` の中身が読まれず、直下の `mcp.json` も読まれない。`https://agent-plugins.org/schemas/` で始まるが未対応の版は、プラグインごと拒まれる。[docs、コード]
- `$schema` は 1.0.0 を使う（憲章 第5条）。Copilot CLI は 1.1.0 の `$schema` も受け付けるが、1.1.0 は草案で、スキーマの公開 URL は 404 である。

### 1.2 フォルダの決まり

```text
my-plugin/
├── plugin.json                    必須
├── skills/<スキル名>/SKILL.md      スキル（直下の子フォルダだけ。それより深くは探さない）
├── mcp.json                       MCP サーバー（任意）
├── com.github.copilot/            Copilot CLI 固有の部品（1.5）
├── README.md、LICENSE など         置いてよい。読まれない
```

- 場所は固定で、`plugin.json` では変えられない。場所がなくてもエラーではない。[仕様 6]
- 読み込むパスは、解決した後もプラグインの根の中に収まること。外に出るシンボリックリンクは拒まれる。設定の中のプラグイン相対パスは `./` で始める。[仕様 4.1]
- Agent Plugins の形式では、以前の形式の置き場所（直下の `agents/`、`commands/`、`rules/`、`hooks/`、`hooks.json`、`lsp.json`、`.mcp.json`、`extensions/`）は**読まれない**（Copilot CLI 1.0.80 から。Copilot CLI は置き場所を直すよう警告を出す）。[更新履歴 1.0.80-0、コード]

### 1.3 `mcp.json`

- 直下に置く。最上位は `$schema`（1.0.0 では `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json`。`plugin.json` と同じ版でなければならず、食い違うと MCP だけが無効になる）と `mcpServers`（必須。空でもよい）の2つだけ。
- サーバーは次の3種類のどれか。**すべて閉じた形で、知らない項目があるとそのサーバーだけ無効（読み飛ばし）**。`type` は必須で、以前の形式の `.mcp.json` にある `tools`、`timeout`、`type: "http"` などは書けない。[仕様 7.2、docs]

  | `type` | 必須 | 任意 |
  | --- | --- | --- |
  | `stdio` | `command`（実行ファイル1語。素の名前か、`./` で始まるプラグイン相対パス。シェルのコマンド文字列は不可。`${...}` は展開されない） | `args`、`env`（`PLUGIN_ROOT`・`PLUGIN_DATA` は書けない）、`cwd`（`./`・`${PLUGIN_ROOT}`・`${PLUGIN_DATA}` のどれかで始める） |
  | `streamable-http` | `url`（絶対の HTTP か HTTPS。ループバック以外は HTTPS。ユーザー情報と断片は不可） | `headers` |
  | `sse` | `url`（同上） | `headers` |

- `${PLUGIN_ROOT}` と `${PLUGIN_DATA}` が展開されるのは、`stdio` の `args` の各要素、`env` の値、`cwd` だけ。`url` と `headers` は展開されない。`env` と `headers` に秘密を書かない。[仕様 9.2]
- Copilot CLI は `stdio`、`streamable-http`、`sse` を受け付ける。`stdio` では、`${PLUGIN_DATA}` の別名 `${COPILOT_PLUGIN_DATA}`・`${CLAUDE_PLUGIN_DATA}` も展開する。[docs]
- 例（公式ドキュメントの例。検証済み）：

  ```json
  {
    "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
    "mcpServers": {
      "local-validator": {
        "type": "stdio",
        "command": "node",
        "args": ["${PLUGIN_ROOT}/server/index.js"],
        "cwd": "${PLUGIN_ROOT}",
        "env": { "DATA_DIR": "${PLUGIN_DATA}/validator" }
      }
    }
  }
  ```

### 1.4 スキル（`SKILL.md` のフロントマター）

Agent Plugins のスキルは Agent Skills 仕様に合わなければならず、合わないスキルはクライアントが読み飛ばす（仕様 7.1）。Agent Skills 仕様の決まり：

| 項目 | 必須 | 決まり |
| --- | --- | --- |
| `name` | 必須 | 1〜64文字。小文字の英数字（`a-z`、`0-9`）とハイフンだけ。先頭と末尾はハイフン不可。`--` 不可。**親フォルダの名前と同じ** |
| `description` | 必須 | 1〜1024文字。空は不可。何をするかと、いつ使うかを書く |
| `license` | 任意 | |
| `compatibility` | 任意 | 1〜500文字 |
| `metadata` | 任意 | 文字列から文字列への表 |
| `allowed-tools` | 任意（実験的） | 空白区切りの文字列 |

- 本文の書式に制限はない。500行以下、5000トークン以下を推奨。
- 公式の参照実装 `skills-ref validate` は、上の6項目以外のキーがあると「Unexpected fields in frontmatter」で不合格にする。仕様書の文面は未知のキーを禁じてはいない。
- **Copilot CLI のスキルの決まりは Agent Skills よりゆるい**（`name` に大文字、`_`、`.`、`:`、空白を許す。`allowed-tools` はカンマ区切りか配列）。Copilot 固有の項目 `argument-hint`、`user-invocable`、`disable-model-invocation` は Agent Skills の6項目にない。[docs]
- [推奨] クリエイターのスキルも生成プラグインのスキルも、`name` は `a-z0-9-` だけにしてフォルダ名と一致させ、Agent Skills の6項目だけを使う。Copilot 固有の3項目を使うなら、`skills-ref` が不合格にすることを承知のうえで、使う項目を決めて1段目で許す。`allowed-tools` は書式が食い違うので、使うなら実測する。

### 1.5 `com.github.copilot/`（Copilot CLI 固有の部品）

| 場所 | 中身 | 根拠の強さ |
| --- | --- | --- |
| `com.github.copilot/agents/*.agent.md` | カスタムエージェント | [docs] |
| `com.github.copilot/commands/` | スラッシュコマンド | [docs]。中のファイルの形は plugin reference にない |
| `com.github.copilot/rules/` | ルール（インストラクション） | [docs]。同上 |
| `com.github.copilot/hooks/hooks.json` | フック | [docs] |
| `com.github.copilot/lsp.json` | LSP サーバー | [docs] |
| `com.github.copilot/extensions/<名前>/extension.mjs` | エクステンション | **docs の表にない**。更新履歴 1.0.79（2026-08-10）とコードにある。設計書 11章 #1 で 1.0.98 の実測がある |

- 以前の形式との見分け：直下の `plugin.json` の `$schema` が正規の文字列と完全に一致すれば Agent Plugins の形式。以前の形式は `plugin.json` を `.plugin/`、直下、`.github/plugin/`、`.claude-plugin/` の順に探し、`agents/` などの場所を `plugin.json` の項目で変えられる。Agent Plugins の形式の直下の `plugin.json` は、`.plugin/` と `.claude-plugin/` のものより優先される。[docs]
- docs は、新しいプラグインには Agent Plugins の形式を使い、場所を変えたいときだけ以前の形式を使うよう勧めている。[docs]

### 1.6 `PLUGIN_ROOT` と `PLUGIN_DATA`

- 仕様が定めるのは、`stdio` の MCP サーバーの子プロセスの環境変数と、`mcp.json` の `args`・`env`・`cwd` の展開だけ。`PLUGIN_ROOT` は根の絶対パス、`PLUGIN_DATA` はインストールしたプラグインごとの、書き込めて、更新しても残るフォルダ。同梱のスクリプトは `PLUGIN_ROOT`、依存・キャッシュ・状態は `PLUGIN_DATA`。[仕様 9]
- Copilot CLI の追加分：カスタムエージェントのフロントマターの `mcp-servers` では `${PLUGIN_ROOT}`（別名 `${CLAUDE_PLUGIN_ROOT}`・`${COPILOT_PLUGIN_ROOT}`）だけ展開され、`${PLUGIN_DATA}` は展開されない。LSP の `cwd` などでも `${PLUGIN_ROOT}` が使える。フックは環境変数 `COPILOT_PLUGIN_DATA` を受け取る。[docs]
- エクステンションには渡らない（設計書 11章 #9 の実測。変更なし）。

### 1.7 プラグインの名前が入る場所

| 場所 | 形 | 根拠 |
| --- | --- | --- |
| スキルのコマンド | `/<プラグイン>:<スキル>`。スキルの名前がプラグインの名前と同じときは `/<スキル>` | [コード] `cli-main.js` の組み立て、[更新履歴 1.0.71]。docs は、2つのプラグインに同名のスキルがあるときの名前を `/my-plugin/search` と書いており、食い違う。実際の値はランタイムが決める（SDK の `Skill.commandName`）。1.0.102 を動かして確かめていない |
| カスタムエージェント | `<プラグイン>:<エージェント>`（`--agent` にも使える） | [更新履歴 1.0.81]、設計書 11章 #4（1.0.98 の実測）。docs の「Custom agent locations」には `<plugin>/agents/` としか書かれていない |
| エクステンション | `plugin:<プラグイン>:<フォルダ名>` | SDK の `rpc.d.ts` の例、設計書 11章 #1 |
| 同名の扱い | エージェントとスキルは先に読み込んだものが勝つ。プロジェクトやユーザーの同名のものが、プラグインのものを黙って隠す | [docs] |

- [推奨] 生成プラグインの名前は `a-z0-9-` だけにする（仕様は `.` を許すが、設計書 6.2 はプラグインの名前をエクステンションのツール名の頭に使うため。ツール名に `.` が通るかは確かめていない）。

### 1.8 インストールと試験

- 開発中の読み込み：`copilot --plugin-dir=フォルダ`（インストールせず、その場で読む。何度でも指定できる）。[docs]
- 入れ方：`copilot plugin install 指定`（`plugin@marketplace`、`OWNER/REPO`、`OWNER/REPO:パス`、Git の URL、手元のフォルダ）。**1.0.102 は、マーケットプレイス以外（リポジトリ、URL、手元のフォルダ）のインストールで「廃止予定で、将来は `plugin@marketplace` だけになる」と表示する**。docs はまだ `copilot plugin install ./my-plugin` を載せていて、廃止予定とは書いていない。[コード、docs]
- マーケットプレイス：`copilot plugin marketplace add OWNER/REPO`（`owner/repo#ref`、URL、手元のフォルダも可）→ `copilot plugin install プラグイン@マーケットプレイス`。`marketplace.json` は `.github/plugin/marketplace.json` に置く（直下、`.plugin/`、`.claude-plugin/` にあっても読まれる）。項目は `name`・`owner`・`plugins` が必須で、各プラグインは `name` と `source` が必須。Agent Plugins の形式のプラグインの名前には `.` も使える。[docs]
- インストールしたものはキャッシュされる。直したら入れ直す。ただし、手元のフォルダのマーケットプレイスにあるプラグイン（`source` が相対パス）は、実際のフォルダから「その場で」読まれ、再起動か新しいセッションで反映される（`update` は要らない）。[docs、更新履歴 1.0.81]
- 確認：`copilot plugin list --json`、`copilot skill list --json`、`copilot mcp list --json`、`copilot lsp list`、`copilot instruction list`（設計書・ナレッジの実測のとおり、モデルなしで確かめられる）。
- 入れる場所：`~/.copilot/installed-plugins/<マーケットプレイス>/<プラグイン>` と `_direct/<ID>/`。リポジトリの `.github/copilot/settings.json` の `enabledPlugins` でも有効にできる。[docs]

### 1.9 1段目の検査に足すもの

写したスキーマ（`plugin.schema.json`、`mcp.schema.json`。Draft 2020-12 で、`jsonschema` 4.26.0 で動く）だけでは検査しきれない。次を足す。

1. `mcp.json` があれば、`$schema` の版が `plugin.json` と同じこと。
2. `mcp.json` の各サーバー：`command` が1語で、`./` ならファイルがあって根の中に収まること。`url` が絶対 URL で、ループバック以外は HTTPS で、ユーザー情報と断片がないこと。`cwd` を展開して解決したあとも根（`PLUGIN_DATA` 以下なら `PLUGIN_DATA`）の中に収まること。`headers` の名前が大文字小文字を無視して重ならないこと。（スキーマは `http://example.com`、`"node server.js"`、`${PLUGIN_ROOT}/../x` を通してしまう。実際に確かめた）
3. `skills/*/SKILL.md`：直下の子フォルダにあること。フロントマターが 1.4 の決まりに合うこと（`name` とフォルダ名の一致を含む）。
4. Agent Plugins の形式のプラグインの直下に、以前の形式の置き場所（`agents/`、`commands/`、`rules/`、`hooks/`、`hooks.json`、`lsp.json`、`.mcp.json`、`extensions/`、`.claude-plugin/`、`.github/plugin/plugin.json`）がないこと（あっても読まれない）。
5. `com.github.copilot/` の中が 1.5 の場所だけであること。
6. 根の外に出るシンボリックリンクがないこと。

---

## (2) 設計書やナレッジの前提と違う最新の事実

1. **`com.github.copilot/extensions/` は公式ドキュメントの表にない**（agents、commands、rules、hooks、lsp の5つだけ）。設計書 3.4・7章はこの場所に頼る。ある根拠は、更新履歴 1.0.79（2026-08-10）、1.0.80-0 の「`extensions/` も `com.github.copilot/` の下だけを読む」、`cli-main.js` の分類、設計書 11章 #1 の 1.0.98 の実測。バージョンを上げるたびに 11章 #1 を確かめ直す。ナレッジ plugins.md は agents・hooks・lsp しか書いておらず、commands と rules と extensions が抜けている。
2. **`$schema` は完全一致で形式が決まり、書き間違えると何も言わずに以前の形式になる**。ナレッジの「決まった `$schema`」より厳しい。1.1.0（草案）の `$schema` も受け付けるが、そのスキーマの URL は 404 である。未対応の版は拒まれる。
3. **公式の JSON スキーマで検査できるのは一部だけ**。設計書 testing.md 2章は「公式のスキーマで検査する」とあるが、相対パスの閉じ込め、`mcp.json` と `plugin.json` の版の一致、URL・`command` の決まりはスキーマで検査できない（1.9）。スキルのフロントマター、エージェントのフロントマター、`hooks.json`、`marketplace.json` の JSON スキーマは、仕様リポジトリにも Copilot CLI 1.0.102 のパッケージにもない。
4. **スキルの決まりが2つある**。Agent Plugins のスキルは Agent Skills 仕様（小文字・数字・ハイフンだけ、フォルダ名と一致）に合わなければ読み飛ばされる、と仕様にある。Copilot CLI の docs はもっとゆるい（大文字、`:` などを許す）。ナレッジ skills.md は `name` と `description` が必須としか書いていない。Copilot 固有の `user-invocable` などを使うと、公式の参照実装では不合格になる（1.4）。
5. **`mcp.json` は閉じた形**で、`type` が必須。以前の形式の `.mcp.json` の書き方（`type` なし、`tools`、`timeout` など）は使えない。設計書 3.4 の「作業ごとの部品：`mcp.json`」を作る作業エージェントへの決まりになる。
6. **手元のフォルダなどのインストールは 1.0.102 で廃止予定と表示される**（ナレッジ copilot-cli-testing.md の記述と同じだが、1.0.102 のコードで文言を確かめた）。docs は廃止予定と書いていない。生成プラグインの配布と README は、マーケットプレイス経由を基本にする。
7. **スキルのコマンド名**：ナレッジ・設計書に記述がない。コードでは `/<プラグイン>:<スキル>` だが、docs は `/<プラグイン>/<スキル>` と書く。1.0.102 での実際の値は未確認。
8. （付随）サブエージェントの深さの既定：docs（2026-10-21 の github/docs main）は既定 6、最大 256。更新履歴 1.0.71 は「既定を 4 に下げた、最大 128」。設計書の出典は 1.0.71。どちらが今の実際かは確かめていない。

---

## (3) 詳細と出典

### A. Agent Plugins 仕様

- 出典：https://github.com/agentplugins/agent-plugins-spec を 2026-10-22 に clone。main の最新コミット `ff8ab5e392cc87bd88d87c060815a87490e51003`（2026-08-19、PR #65 のマージ）。タグ `v1.0.0` は `bd383552095128f6effe895b9257cfd580a6d179`（2026-08-06）。「Publish Agent Plugins Specification 1.0.0」のコミットは `1fc1b6270e3cc492ec2d24ad7a34277c6d53b9c1`（2026-07-24）。仕様書は `spec/1.0.0.md`、スキーマは `schemas/1.0.0/`。
- 版の状態：
  - 1.0.0 は公開済み（仕様書に `Status: Published`、タグ `v1.0.0`）。
  - 1.1.0 は作業中の草案（`spec/1.1.0.md` に `Status: Working Draft`）。「Start the 1.1.0 working draft」（2026-08-12）とそのマージ（2026-08-19）が main の最後の2コミットで、2026-10-22 時点でこれより新しいものはない。
  - 1.0.0 と 1.1.0 の違いは、版の数字、`$schema` の値、OAuth の文1か所だけ。1.1.0 のスキーマも、`$id` と `$schema` の値と説明以外は 1.0.0 と同じ。
  - `https://agent-plugins.org/schemas/1.0.0/{plugin,mcp}.schema.json` は 200 で、リポジトリの写しと JSON として同一。`https://agent-plugins.org/schemas/1.1.0/plugin.schema.json` は 404（未公開）。
  - タグ `v1.0.0` から main までに、`spec/1.0.0.md` と `schemas/1.0.0/` の変更はない。
- 写したスキーマ：`/home/user/plugin-creater/wip/implementation/research/schemas/agent-plugins-1.0.0/`（`plugin.schema.json`、`mcp.schema.json`、`README.txt`。出どころのコミットと SHA-256 を `README.txt` に書いた）。スキルのフロントマターのスキーマは、この仕様リポジトリにない。
- 仕様書の節：5（マニフェスト）、6（場所）、7.1（スキル）、7.2（MCP）、8（クライアント固有の拡張とベンダーのフォルダ）、9（`PLUGIN_ROOT`・`PLUGIN_DATA`）、10.1（`$schema` の版の一致）。仕様書とスキーマが食い違うときは仕様書が正しい（5.2、7.2.1）。
- 検証：写したスキーマに、公式ドキュメントの例と、正例・誤例の計26件を `jsonschema` 4.26.0（Draft 2020-12）にかけ、期待どおりになった。スキーマが通してしまうもの：`http://` の `url`、`"node server.js"` の `command`、`${PLUGIN_ROOT}/../x` の `cwd`。
- 拡張の置き場所の一般則：クライアント固有のファイルは、逆ドメインの名前のフォルダ（`com.github.copilot/`）に置く。中身はクライアントが決め、Agent Plugins は検査しない（仕様 8）。

### B. GitHub Copilot CLI の公式のプラグイン仕様

- 出典（2026-10-22 取得。ソースは github/docs の main `5815d11586b0796688963a98c889680e60d72dc4`、2026-10-21）：
  - [CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)（最終更新 2026-10-14、コミット `2d0a7be`）
  - [Plugins（概念。旧 about-plugins）](https://docs.github.com/en/copilot/concepts/customizations/plugins)
  - [Creating a plugin](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating)、[Creating a plugin marketplace](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace)、[Finding and installing plugins](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing)
  - [CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)（Skills reference、Custom agent frontmatter fields、Custom agent locations）
  - [Agent Plugins の作者向け](https://agent-plugins.org/plugin-authors)
- plugin reference の「Agent Plugins 1.0 manifest fields」の要点：
  - 受け付ける `$schema` は 1.0.0 と 1.1.0 の正規の文字列。一致しなければ以前の形式。未対応の Agent Plugins の版は拒まれ、拒まれたプラグインはフック、LSP、MCP、スキル、コマンド、エージェント、ルール、エクステンションのフォルダを何も出さない。
  - 使える項目は仕様のとおり10個。知らない最上位の項目は報告して無視。
  - スキルは `skills/` の直下の子フォルダだけで、直下の `SKILL.md` に戻る動き（以前の形式にはある）はない。MCP は直下の `mcp.json`。`mcp.json` の `$schema` の版は `plugin.json` と同じでなければならない。サーバーごとに検査し、無効なものだけ読み飛ばす。
  - `com.github.copilot/` の5か所（1.5）。以前の形式の置き場所は、Agent Plugins の形式には効かない。
- 以前の形式：`name`（ケバブケース、64文字まで）だけが必須。`agents`・`skills`・`commands`・`hooks`・`extensions`・`mcpServers`・`lspServers` の項目で場所を変えられる。`description` は1024文字まで。`author` は `name` が必須。
- 配置の優先：エージェントとスキルは先に読み込んだものが勝つ（プロジェクト、ユーザー、プラグインの順）。MCP は後に読み込んだものが勝つ。
- マーケットプレイス：`marketplace.json` の場所は `marketplace.json`、`.plugin/`、`.github/plugin/`、`.claude-plugin/` の順に探す。`source` は相対パス（`./` は付けなくてもよい）か、`github`・`url` のオブジェクト（`ref`、`sha`、`path`）。`strict` の既定は `true`。実例：github/copilot-plugins と github/awesome-copilot の `.github/plugin/marketplace.json`。
- Copilot CLI の更新履歴（パッケージの `changelog.json` と https://github.com/github/copilot-cli/blob/main/changelog.md）のうち、プラグインの形式に関わるもの：
  - 1.0.74（2026-07-23）：Agent Plugins（当時の名前は Open Plugin Spec）v1 の `plugin.json` と `mcp.json` に対応。
  - 1.0.79（2026-08-10）：Agent Plugins の形式で `com.github.copilot/extensions/` にエクステンションを置ける。
  - 1.0.80-0（先行版。パッケージの `changelog.json` にだけある。公開の changelog.md の 1.0.80 は「モデル設定の更新」だけ）：破壊的変更として、Agent Plugins の形式は `commands/`・`agents/`・`rules/`・`hooks/hooks.json`・`lsp.json`・`extensions/` を `com.github.copilot/` の下だけから読む。直下に置いたものは、移す場所を警告で示す。
  - 1.0.81：インストール済みのプラグインのエージェント、スキル、MCP が `-p` でも使え、`--agent <プラグイン>:<エージェント>` で選べる。
  - 1.0.85：プラグインのエージェントの `mcp-servers` で `${PLUGIN_ROOT}` を展開。
  - 1.0.97：`--plugin-dir` のスキルとエージェントが補完と呼び出しに出る。

### C. Copilot CLI 1.0.102 の npm パッケージ

- 取得：`npm pack @github/copilot-linux-x64@1.0.102 --ignore-scripts`（npm の `latest`、更新 2026-10-21T22:46Z）。`github-copilot-linux-x64-1.0.102.tgz` の SHA-256 は `450d256c69526c1c30286d21df0f6e1a05412beb37fe4a5b5054905f5f8fbd3d`。単一の実行ファイル `copilot`（197 MB）の中の gzip を探して、埋め込まれた tar（245 個のファイル）を取り出した。取り出したものは動かさず、読むだけにした。
- スキーマは `schemas/` の2つだけ：
  - `api.schema.json`（SDK の JSON-RPC の API。定義が 1,899 個）
  - `session-events.schema.json`（セッションのイベント）
- **`plugin.json`、`mcp.json`、`marketplace.json`、`SKILL.md`、`*.agent.md`、`hooks.json` を検査するスキーマはない**。Agent Plugins のスキーマも同梱していない。実行ファイルには `$schema` の2つの文字列と `https://agent-plugins.org/schemas/` が定数としてあるだけで、仕様どおりスキーマを取りに行かない。
- `api.schema.json` に出てくる関連の型（入力ではなく、SDK が返す形）：
  - `AgentInfo`：`name`、`displayName`、`description`、`id`（プラグインのエージェントでは `name` と違うことがある）、`source`（`plugin` を含む）、`userInvocable`、`disableModelInvocation`、`tools`、`model`、`models`、`modelPolicy`（`preferred`・`required`）、`reasoningEffort`、`mcpServers`、`skills`、`prompt`、`hooks`。
  - `Skill`：`name`、`commandName`（呼び出しのスラッシュコマンドの名前）、`pluginName`、`argumentHint`、`userInvocable`、`source`。
  - `Plugin`・`InstalledPlugin`：`name`、`marketplace`、`version`、`enabled`、`cache_path`、`source`。
  - 組み込みのエージェントの定義 `definitions/*.agent.yaml` は、`model` に優先する順のリストを書き、`reasoningEffort` を使っている（`models` は使っていない）。エージェントの定義ファイルがどの項目を受け付けるかは、このパッケージからは確かめられなかった（ナレッジ custom-agents.md の「実機で確かめる」のまま）。
- 実行ファイルの文字列から分かる、プラグインの検査の中身（メッセージの断片）：`Plugin manifest "…": must contain a top-level object (plugin rejected)`、`unsupported Agent Plugins version "…" (plugin rejected)`、`unknown field "…" (ignored)`、`field "extensions" must be an object (ignored)`、`extensions namespace "…" must be an object`、`field "name" must be 1-64 characters of lowercase [a-z0-9.-], start and end alphanumeric, with no "--" or ".."`、`missing a valid string "name"`、`field "keywords" must be an array of strings`、`author field "…" is not permitted`、`field "author" must be an object`、`Plugin "…" declares the Agent Plugins v1 $schema, so its … are read only from "…" at the plugin root … is no longer read; move it there.`。
- `cli-main.js`：ファイルの種類を調べる関数が、`com.github.copilot/extensions/` を「エクステンションかキャンバスのコード」と扱う。スキルのスラッシュコマンドは `/<プラグイン>:<スキル>`（プラグインの名前とスキルの名前が同じときは `/<スキル>`）を既定にする。
- 「手元のフォルダなどのインストールは廃止予定」の文言（`cli-main.js` の文字列）：`Direct plugin installs (repos, URLs, local paths) are deprecated. Only plugin@marketplace installs will be supported in a future release.`

### D. Agent Skills 仕様

- 出典：https://agentskills.io/specification（2026-10-22 取得）。ソースは https://github.com/agentskills/agentskills の `docs/specification.mdx`（最終変更 `217be548739f21d6008915c29aefe320ea1a90af`、2026-08-04。main の最新は `69ef37e9424c0a7ea9dd2293b559e43ec8176379`、2026-08-09）。参照実装は同リポジトリの `skills-ref/src/skills_ref/validator.py`。
- 決まりは 1.4 のとおり。補足：
  - `name` は「Unicode の小文字の英数字（`a-z`、`0-9`）とハイフン」と書かれ、参照実装は Unicode の文字を許す。実装では `a-z0-9-` に絞るほうが安全（[推奨]）。
  - 参照実装の許す項目は `name`、`description`、`license`、`allowed-tools`、`metadata`、`compatibility` の6つ。
  - クライアント実装の手引き（`docs/client-implementation/adding-skills-support.mdx`）は「寛容に読む」ことを勧める（名前がフォルダ名と違っても、64文字を超えても、警告して読み込む。`description` が空か YAML が壊れているときだけ読み飛ばす）。Agent Plugins 1.0.0 の仕様 7.1 は「合わないスキルは読み飛ばさなければならない」とあり、より厳しい。Copilot CLI がどちらに近いかは確かめていない。
- Copilot CLI のスキルのフロントマター（CLI command reference の Skills reference）：`name`（必須、64文字まで、英数字・ハイフン・アンダースコア・ドット・コロン・空白、先頭は英数字）、`description`（必須、1024文字まで）、`argument-hint`、`allowed-tools`（カンマ区切りか配列、`"*"` 可）、`user-invocable`（既定 true）、`disable-model-invocation`（既定 false）。

### 確かめられなかったこと

- GitHub の Releases・Issues・PR の一覧（この環境の GitHub API は agent-plugins-spec に使えない）。git の clone で見える範囲（ブランチ、タグ、コミット）だけ確かめた。
- 1.0.102 を実際に動かしたときの挙動（スキルのコマンド名の実際の値、マニフェスト違反のときの実際の出力、Agent Skills に合わないスキルを読み飛ばすか）。取り出したものを動かさない方針のため、読んで分かる範囲にとどめた。モデルなしで動く確認の手順は 1.8 のとおり。
- `com.github.copilot/commands/` と `rules/` の中のファイルの形。plugin reference に書かれていない（`copilot instruction list`・`/skills` などで確かめる）。
- マーケットプレイスの `source` に、リポジトリの直下のプラグイン（`./`）を指定できるか。docs に記述がない（`copilot plugin marketplace add 手元のフォルダ` → `marketplace browse` → `plugin install x@m` → `plugin list --json` で、モデルなしで確かめられる見込み）。
- `plugin.json` の `extensions` の `com.github.copilot` に Copilot CLI が意味を与えるか。
- エージェントの定義ファイル（`*.agent.md`）の項目のうち、実装が受け付けるもの（`model` と `models`、`model-policy` と `modelPolicy` の別）。docs の2つの参照も、設計書 11章 #18 のとおり食い違ったまま。
