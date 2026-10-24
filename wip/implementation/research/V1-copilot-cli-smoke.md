# V1 本物の Copilot CLI での読み込みの確かめ（偽物のモデルで）

状態：途中（1・2 の節まで書いた。3・4・5 はこれから）

担当の指示：`wip/implementation/briefs/V1.md`。作業のメモ：`wip/implementation/tasks/V1.md`。
リポジトリのファイルは変えていない。スクリプトと結果の生データはスクラッチ（`/tmp/claude-0/-home-user-plugin-creater/f6e65e0d-9c94-5351-8ee1-475927b3b43e/scratchpad/v1/`、以下 `v1/`）にある。

## 0. やり方

- Copilot CLI 1.0.102 を `npm pack @github/copilot@1.0.102 @github/copilot-linux-x64@1.0.102` で取り、`v1/cli-bin/package/copilot`（実行ファイル）を直接動かした。動いた版は `copilot --version` の「GitHub Copilot CLI 1.0.102」と、画面の見出し「Copilot v1.0.102」で確かめた。
- 環境変数：`COPILOT_HOME`（確かめごとに空のフォルダ）、`COPILOT_CACHE_HOME=v1/cache`、`COPILOT_AUTO_UPDATE=false`、`--no-auto-update`、`COPILOT_OFFLINE=true`、`COPILOT_PROVIDER_BASE_URL=http://127.0.0.1:18080/v1`、`COPILOT_MODEL=fake-model`。ユーザーの `~/.copilot` は使っていない。
- 偽物のモデル（`v1/fake-model.mjs`）：OpenAI 互換の `/v1/chat/completions`（`stream` は SSE）。届いたリクエストの本文を全部 `v1/requests.jsonl` に書く。最新のユーザーのメッセージに `@@CALL <ツール名> <JSON>` があれば、そのツールを呼ぶ。`@@SLEEP <ms>` で返事を遅らせる。
- 対話モード：`v1/tui.py`（pty と pyte。画面は 150 桁 × 50 行の文字だけ。色や太字は取れない）。
- 画面のサーバーへのつなぎ：`v1/probe.py`（偽物のモデルの記録の、ツールの結果にある URL へつなぐ）。
- 見本のクリエイターは、リポジトリを `v1/creator-copy/` に写して使った。`tests/dev-eval/heldout/` は写していない（読まない決まりのため）。写しの中で `git init` して 1 コミットにした。リポジトリの直下と同じ中身から heldout を除いたものである。

## 1. クリエイターをマーケットプレイスとして入れる、`--plugin-dir`、スキル

### やったこと

1. 空の `COPILOT_HOME` で `copilot plugin marketplace add v1/creator-copy` → `plugin marketplace list` → `plugin marketplace browse plugin-creator` → `plugin install plugin-creator@plugin-creator` → `plugin list --json` → `skill list --json`。
2. 別の空の `COPILOT_HOME` で `copilot --plugin-dir v1/creator-copy plugin list --json` と `skill list --json`。
3. 対話モードで `/` と `/make`、`/plugin-creator` を打って補完を見た。`/plugin-creator:make-plugin 週報を自動化したい` を実行し、偽物のモデルに届いたリクエストを読んだ。
4. `-p` で `/plugin-creator:make-plugin …`、`/plugin-creator/make-plugin …`、`/make-plugin …` を送った。

### 結果

| 確かめること | 結果 |
| --- | --- |
| `marketplace.json` の `source: "./"` | 通った。`marketplace add` は「Marketplace "plugin-creator" added successfully.」。`browse` は「Plugins in "plugin-creator": • plugin-creator」と、「Install with: copilot plugin install <plugin-name>@plugin-creator」を出した |
| `plugin install plugin-creator@plugin-creator` | 通った。「Plugin "plugin-creator" installed successfully. Installed 2 skills.」。続けて「Enabled "plugin-creator@plugin-creator". It is loaded live from <フォルダ>, so edits take effect on the next session — nothing was copied.」と出た |
| `plugin list --json` | `{"name":"plugin-creator","marketplace":"plugin-creator","version":"0.1.0","enabled":true,"source":"live","installedFrom":"<フォルダ>"}`。手元のフォルダのマーケットプレイスから入れたプラグインは、コピーされず、そのフォルダを直接読む（`source: "live"`）。`plugin list`（文字）では「Live Plugins (loaded from a local marketplace directory, never copied)」の見出し |
| `--plugin-dir` | 通った。ただし `--plugin-dir` はトップレベルの選択肢で、`copilot --plugin-dir <フォルダ> plugin list` の順で書く（`copilot plugin list --plugin-dir …` は「unexpected argument」で失敗する）。`plugin list --json` は `"source": "external"`、`"marketplace": ""` |
| `skill list --json` | `make-plugin` と `test-plugin` が出た（`source: "plugin"`、`enabled: true`、`path` はスキルのフォルダ、`description` は SKILL.md のとおり）。マーケットプレイスで入れた場合も `--plugin-dir` の場合も同じ |
| スキルのコマンドの名前 | 対話モードで `/plugin-creator:make-plugin` と `/plugin-creator:test-plugin`（`/<プラグイン>:<スキル>`）。`/make` と打つと `/plugin-creator:make-plugin` が候補に出る。`/plugin-creator` と打つと両方が出る。`/plugin-creator/make-plugin`（docs の形）は試していない（`-p` では、どの形も展開されず、ただの文字としてモデルに送られた。スキルの呼び出しは対話モードの機能である） |
| スキルが読まれたとき、モデルに届くもの | ユーザーのメッセージとして「The user explicitly invoked the "/plugin-creator:make-plugin" skill. Follow its instructions now.」＋`<skill-context name="make-plugin">`（「Base directory for this skill: <絶対パス>」、「Related files (use view tool to read):」の一覧、SKILL.md の本文）＋末尾に `ARGUMENTS: 週報を自動化したい`。モデルが自分で呼ぶときの `skill` ツールの引数は名前だけ（`make-plugin`）。スキルの一覧は `<available_skills>` に `<name>make-plugin</name>`（プラグインの名前は付かない）と `<description>` で載る |

### 設計・実装との食い違い、気づいたこと

- **スキルを読んだときの「Related files」が 97 件、約 17.7KB ある。** スキルのフォルダの下のファイルがすべて（`assets/template/` の 81 件、`references/` の 15 件、`scripts/scaffold.py`）、1 つの絶対パスずつ並ぶ。make-plugin の SKILL.md は「`assets/template/` は自分では読まない（読むとコンテキストウィンドウが早く埋まる）」と書いているが、Copilot CLI はこの一覧を自分で足す。make-plugin を読むたびに（コンパクションの後の読み直しも）届くメッセージの全体が約 25KB で、そのうち約 7 割がこの一覧である（この環境のパスは長い。実際のインストール先のパスはもっと短い）。ひな形のファイルが増えると、一覧も増える。実装の不具合ではないが、ひな形をスキルの外（例：`assets/` を残してもよいが、`template/` をアーカイブ 1 つにする、スキルのフォルダの外に置く）に出す余地がある。要判断（上位の文書で直すことに書く）。
- 手元のフォルダのマーケットプレイスは「live」で入る。設計書やナレッジが書いていた「手元のフォルダからのインストールは将来廃止」は、フォルダを直接指定する `plugin install <フォルダ>` の話で、マーケットプレイスを通した手元のフォルダは廃止の表示なしで入った。README の「マーケットプレイス経由」の案内で問題ない。
- GitHub の公開リポジトリ（`imaeda-hub/plugin-creator`）からの `marketplace add` は、リポジトリがまだ公開されていないので試していない（確かめられない）。

## 2. エクステンション（`--experimental`）

### やったこと

1. 対話モードで `--experimental --plugin-dir v1/creator-copy` を付けて起動し、読み込みのときの確認の画面を写した。Enter（「Yes」）で許可し、偽物のモデルに `@@CALL plugin-creator_open` を送って、このツールを呼ばせた。
2. 偽物のモデルに届いたリクエストの `tools` の名前と説明を読んだ。
3. `plugin-creator_open` の返り値の URL へ、`v1/probe.py` で 127.0.0.1 からつないだ（正しい合言葉、合言葉なし、Host 違い、`localhost`）。
4. `--experimental` なしの起動（ツールの有無）。`-p` と `--experimental`（許可なし、`--allow-all-tools`、`--allow-tool=extension-permission-access…`）。`/experimental`、`/experimental on` を対話モードの中で実行した。
5. `defer: "never"` の効きを見るため、`creator.mjs` から `defer: 'never'` の行を消した写し（`v1/creator-defer-auto/`）と比べた。
6. 終わったあと、画面のサーバーのポートが閉じるか、エクステンションのプロセスが残らないかを見た。

### 結果

| 確かめること | 結果 |
| --- | --- |
| 読み込みのときの確認の文 | 題：`Extension "plugin:plugin-creator:plugin-creator" wants elevated permissions`。本文：`This extension wants to: skip tool permission prompts, register hooks.` と `Denying will prevent this extension from loading.`。選択肢：`1. Yes`、`2. Yes, and always allow "plugin:plugin-creator:plugin-creator" in this directory (<作業フォルダ>)`、`3. No (Esc)`。項目は 2 つだけで、「handle permission requests」は出ない（クリエイターのエクステンションは `onPermissionRequest` を登録しないため）。R2 の 3.10 のとおり |
| エクステンションの名前 | `plugin:plugin-creator:plugin-creator`（`plugin:<プラグイン>:<フォルダ>`）。`/extensions` の画面は「Mode: Load & Augment」「1/1 extension enabled」 |
| 読み込みの条件 | `--experimental` なしでは、ツールは載らない（ツール 17〜18 個、`plugin-creator_*` なし）。`--experimental` ありで載る。`/experimental on` を対話モードの中で打つと、Copilot CLI が再起動し（`COPILOT_HOME/settings.json` に `"experimental": true` が書かれる）、フォルダの信頼の確認がもう一度出て、そのあとエクステンションの確認が出る。`/experimental` は「deprecated」（`copilot help config`：`--experimental` か `/settings experimental on` を使う） |
| `-p` での確認 | `-p --experimental` だけ（許可の指定なし）：「Approval check └ ✗ Denied, no one to approve」。エクステンションは読み込まれず、`plugin-creator_*` のツールは載らない。`--allow-all-tools` を付けるか、`--allow-tool='extension-permission-access'`、`--allow-tool='extension-permission-access(plugin:plugin-creator:plugin-creator)'` のどちらかを付けると、確認なしで読み込まれる（R2 3.10 の「見込み」だった名前の形が確かめられた） |
| モデルに届くツールの名前と説明 | `plugin-creator_open`、`_state`、`_progress`、`_record`、`_confirm`、`_results`、`_doc_text`、`_issue` の 8 つ。名前は、プレフィックスも変換もなく、そのまま（ハイフンを含む名前が通る）。説明は `tool-defs.mjs` の文（68〜192 字）。引数の JSON Schema も届く（`_open` は引数なし、`_confirm` は `knowledgeIds`・`behavior`・`taskPath`・`evalTasks` が必須）。Copilot CLI 自身のツール `extensions_reload`・`extensions_manage` も同時に載る |
| `plugin-creator_open` を呼ばせる | 通った。ツールの結果：「クリエイターの画面の用意ができました。次の URL をブラウザーで開いてください：http://127.0.0.1:<番号>/?k=<合言葉>」。画面（TUI）には `● plugin-creator_open  クリエイターの画面の用意ができました。…` と出た。確認の画面は出ない（`skipPermission`） |
| 127.0.0.1 からつながるか | つながった。合言葉つきの URL：`GET /` は 200 で HTML（題「クリエイターの画面」。`style.css`・`render.js`・`creator.js` への参照に `?k=` が付く）、`GET /api/state?k=…` は 200 で JSON（`title: "クリエイターの画面"`、`sessionId`、`hearing`、`confirmation`、`results` …）。合言葉なし：403（「このアドレスでは開けません。チャットで示された URL を開いてください」）。合言葉ありで Host が違う：403。Host が `localhost:<番号>`：200 |
| 終わったあと | Copilot CLI を終えると、画面のサーバーのポートは閉じた（接続拒否）。エクステンションのプロセスも残らなかった（`-p` の終了、pty の SIGTERM のどちらでも） |
| `defer: "never"` が効くか | **確かめられなかった。** 対話モードで 32 個（しきい値の既定は 30）、`TOOL_SEARCH` の機能の旗（`/experimental` の一覧にある「Enable tool search with deferred loading for MCP and external tools」。`settings.json` の `enabledFeatureFlags.TOOL_SEARCH`）を入れても、`defer: 'never'` の行を消した写しでも、8 つのツールは全部ふつうに載り、ツール検索のツールは出なかった（偽物のモデルが対応していないためと見られるが、確かではない）。つまり、`defer` の有無で差が出る状況を作れなかった |

### 設計・実装との食い違い、気づいたこと

- 設計・実装と食い違うことはなかった（確認の文、名前、ツールの載り方は R2 のとおり）。
- `-p` でクリエイターを動かすには許可の指定が要る。クリエイターは対話モードで使うスキルなので支障はないが、README やスキルが `-p` を案内する場合は、`--allow-tool='extension-permission-access'` が要ることを書く。make-plugin の SKILL.md は `-p` で起動したときの断り（「`-p` と `--no-ask-user` を付けずに、対話モードで起動し直す」）を持っている。
- 画面のサーバーの `GET /` が返す HTML は、静的ファイルの参照に `?k=<合言葉>` を付けて返す（`index.html` の `%%K%%` の置き換え）。ブラウザーでは、画面の読み込みが合言葉つきで通る設計である（実ブラウザーでは確かめていない）。
