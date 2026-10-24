# V1 本物の Copilot CLI での読み込みの確かめ（偽物のモデルで）

状態：完了（1〜7 の節まで書いた。7 節は 2026-10-24 の追加の確かめ）

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

- **スキルを読んだときの「Related files」が 97 件、約 17.7KB ある。** スキルのフォルダの下のファイルがすべて（`assets/template/` の 81 件、`references/` の 15 件、`scripts/scaffold.py`）、1 つの絶対パスずつ並ぶ。make-plugin の SKILL.md は「`assets/template/` は自分では読まない（読むとコンテキストウィンドウが早く埋まる）」と書いているが、Copilot CLI はこの一覧を自分で足す。make-plugin を読むたびに（コンパクションの後の読み直しも）届くメッセージの全体が約 25KB で、そのうち約 7 割がこの一覧である（この環境のパスは長い。実際のインストール先のパスはもっと短い）。ひな形のファイルが増えると、一覧も増える。実装の不具合ではない。実害は、一覧の分のコンテキストウィンドウだけである。ひな形の置き場所（スキルのフォルダの中）を変えるかは、設計者の判断になる。
- 手元のフォルダのマーケットプレイスは「live」で入る。設計書やナレッジが書いていた「手元のフォルダからのインストールは将来廃止」は、フォルダを直接指定する `plugin install <フォルダ>` の話で、マーケットプレイスを通した手元のフォルダは廃止の表示なしで入った。README の「マーケットプレイス経由」の案内で問題ない。
- フォルダを直接指定する `copilot plugin install <フォルダ>` は、入るが「Warning: Direct plugin installs (repos, URLs, local paths) are deprecated. Only plugin@marketplace installs will be supported in a future release.」と出た（空の `COPILOT_HOME` で確かめた）。マーケットプレイスを通した手元のフォルダ（`marketplace add <フォルダ>` → `install <名前>@<マーケットプレイス>`）では、この警告は出なかった。
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

## 3. 見本の生成プラグイン（組み立てのスクリプトで作ったもの）

### やったこと

1. `tests/creator/scaffold/sample/`（見本のヒアリングの記録 `state.json` と作業エージェントが書いた部分 `parts/`）から、本物のひな形で `python3 skills/make-plugin/scripts/scaffold.py build --hearing <state.json> --work <作業フォルダ>/.plugin-creator-work --out <作業フォルダ>/weekly-report` を動かして、`weekly-report` を作った（`v1/gen/folder/weekly-report/`）。結果は `ok: true`、`warnings: []`、最初のコミット付き、`.plugin-creator-work/` は消えた。
2. 1 節と同じ手順で、手元のフォルダのマーケットプレイスとして入れた（`marketplace add` → `browse` → `install weekly-report@weekly-report` → `plugin list --json` → `skill list --json`）。
3. 対話モードで `--experimental` を付けて起動し、確認に答え、偽物のモデルに `@@CALL weekly-report_open` を送った。
4. 返った URL に `probe.py` でつなぎ、`GET /api/state` を読み、`POST /api/start`（`{"models":{…},"maxIterations":1,"task":{"week":"2026-W42"}}`）を送った。統括・作業・検証の通しの台本（`v1/behavior.mjs`）で、統括が `plan` → `task`（作業）→ `task`（検証）→ `review` → `finish` を呼ぶようにした。
5. 作業の途中で `POST /api/stop` を送った（統括が計画中のとき、作業エージェントが動いているとき）。

### 結果

| 確かめること | 結果 |
| --- | --- |
| マーケットプレイスから入れる | 通った。「Installed 1 skill.」（クリエイターは 2）。`source: "live"`。入口のスキル `weekly-report` が `skill list --json` に出た |
| 読み込みのときの確認 | 題：`Extension "plugin:weekly-report:weekly-report" wants elevated permissions`。本文：`This extension wants to: skip tool permission prompts, register hooks, handle permission requests.`（3 項目。クリエイターは 2 項目）。選択肢は同じ 3 つ |
| `<名前>_open` | 通った。ツールの結果：「Web管理画面の URL：http://127.0.0.1:8731/?k=<合言葉>」＋「ユーザーに伝えてください：」の 2 項目（`/clear` を使わない、確認はチャットで答える）。番号は、既定の 8731 が空いていたのでそのまま 8731（ふさがっていれば OS に選ばせる設計） |
| 127.0.0.1 からつながるか | つながった。`GET /api/state` は 200（`plugin.name: "weekly-report"`、`setup.taskSettings`、`run: null`）。 |
| 選べるモデルの一覧 | 空だった（`session.rpc.model.list()` が `{"list":[],"modelPriceCategories":[],"quotaSnapshots":{}}` を返した。偽物のモデル〔自前のモデルの窓口〕のため）。そのため、画面のモデルの選択肢は、エージェントの定義の先頭のモデルと今のモデルだけの代わりの一覧（`claude-sonnet-5.5`、`gpt-6-luna`、`fake-model`）になり、一覧にないモデルを指定した開始は「統括エージェントのモデル「gpt-6.1-sol」は、選べるモデルにありません。」で断られた。`session.rpc.model.getCurrent()` は `{"modelId":"fake-model"}`。本物のログインでの一覧の要素の形は確かめられなかった |
| `POST /api/start` → 統括が起動するか | 起動した。`tasks.startAgent({ agentType: "weekly-report:orchestrator", name: "統括 <実行番号>", prompt, model })` で、偽物のモデルに統括の定義の本文がシステムプロンプトとして、指示文（実行の番号、頼まれた作業、繰り返しの上限、作業ごとの設定の値、基準）がユーザーのメッセージとして届いた。リクエストの `model` は開始に渡したモデル（`claude-sonnet-5.5`）。対話モードの `/tasks` に `◎ 統括 20261024-044657-3fad78 [background] (8s)  model claude-sonnet-5.5` と出た |
| 統括だけ話した場合（台本なし） | 統括が文だけで答えて終わると、実行は `aborted`／`orchestrator_ended`、まとめは「計画が記録される前に終わりました。」、課題 `M1` が自動で足された（設計どおり） |
| 通しの台本（統括 → 作業 → 検証） | 作業・検証の定義が読み込まれ、`task` で `weekly-report:worker`／`weekly-report:verifier` が起動し、作業のモデルは `gpt-6-luna`、検証は `claude-sonnet-5.5`（`updateSubagentSettings` の上書きが効いた。統括のシステムプロンプトに `<subagent_model_preferences>` として載る）。作業の `show` の値が画面の状態の `displays.draft` に入った。**ただし、そのままでは検証が `<名前>_verdict` を使えず、実行は途中で終わった（5 節の不具合 1）。** 統括の `tools` に `<名前>_verdict`・`edit`・`execute` を足した写しでは、`all_passed` で終わった（まとめ「1回の試行で、2つの基準を満たしました。」、3 体とも `completed`、最後の返事が各枠に入った） |
| `POST /api/stop` → 取り消されるか | 取り消された。統括が計画中のとき：実行は `finished`、`endReason: user_stopped`、統括 `stopped`、`/tasks` は「No subagents」。作業エージェントが動いている途中：統括も作業も `tasks.list` で `cancelled`、状態は統括 `stopped`・作業 `stopped`・検証 `standby`、`unstopped` は空、`/tasks` は「No subagents」（統括を取り消すと、`task` で起動した同期の作業エージェントも取り消された） |
| 作業エージェントが許可の求めを出したとき | 通った（統括の `tools:` を消した写し `gen-d/` で確かめた。不具合 1 のため、そのままの統括では作業が `execute` を受け取れない）。作業エージェントが `bash`（`echo hello > v1-out.txt`）を呼ぶと、チャットに「ファイルに書く / echo hello > v1-out.txt / Do you want to run this command? 1. Yes 2. No, and tell Copilot what to do differently」が出て、画面の状態は `waits: [{ slot: "worker", kind: "permission", detail: { permissionKind: "shell", command: "echo hello > v1-out.txt", paths: ["v1-out.txt"], sandboxPermissive: false, sandboxBypass: false } }]`、作業の枠は `waiting`。チャットで Yes を答えると `waits` が空になり、実行が `all_passed` で終わった |
| `/clear` を実行中に打つ | `/clear` のあと「Started a fresh session.」、エクステンションが起動し直され、読み込みのときの確認がもう一度出た。`/tasks` は「No subagents」（Copilot CLI が古いセッションのエージェントを終えた）。新しいエクステンションは、古い実行を、生きている印の古さが 30 秒を超えたあとの再確認で「途中で終わった（途中で切れた）」（`aborted`／`cut_off`）にし、準備中の画面の `previous` に出した。それまでの間は `previous: null` |
| 読み込みの確認で「Yes, and always allow … in this directory」を選ぶ | README の説明のとおり。そのフォルダでは、`/clear` のあとも、別のセッションを始めても、確認が出なかった（空の `COPILOT_HOME` で、フォルダの信頼の確認と合わせて確かめた） |
| 同じセッションで `extensions_reload`（実行中） | 利用者の許可（「Reload extensions / Copilot wants to reload extensions.」）のあと、エクステンションが起動し直され、読み込みのときの確認がもう一度出た。古い実行は、すぐ「途中で終わった（エクステンションが再起動した）」（`aborted`／`extension_restarted`）になり、`/tasks` は「No subagents」。ユーザーの答え 14 のとおり |
| 終わったあと | Copilot CLI を終えると、画面のサーバーは閉じ、エクステンションのプロセスは残らなかった |

実行中の `/tasks` の見え方：統括は `◎ 統括 <実行番号> [background]`、その下に作業が `◎ 週報を書く [sync]`（`task` の `description` の文字）で出た。

### 設計・実装との食い違い、気づいたこと

- **イベントの届き方（B1 の要確認 1〜3、10 が解決）**
  - `subagent.started` の `agentName` と `agentType` は、どちらも `<プラグイン>:<エージェント>`（`weekly-report:orchestrator` など）で届く。B1 の「そろえ方」は不要だったが、害はない。`agentDisplayName` は短い名前（`orchestrator`、`worker`、`verifier`）で、`agentDescription` はエージェントの定義の説明の文。
  - `onSubagentStop` は、`agentId`・`agentName`・`agentType`・`response`（最後の返事）つきで、`subagent.completed` より前に届く。作業・検証・統括のすべてで、そうだった。
  - `onPreToolUse` は、メインのエージェントのツール（`agentId` なし）、統括、作業、検証のすべてのツール呼び出しで呼ばれ、`agentId`・`agentType`（`<プラグイン>:<エージェント>`）・`parentAgentId` が付く。
  - 統括は `tasks.list` で `status: idle`（手番が終わった後。多手番の裏のエージェント）→ 取り消しで `cancelled`。`subagent.completed` が統括に 2 回届く（手番が終わったとき：`cancelled` なし。取り消した後：`cancelled: true`）。実行は `all_passed` で正しく終わったので、中心の処理は 2 回目を問題なく扱っている。
- **画面の枠の「担当」（`task` 欄）が、呼び出しの説明ではなく、エージェントの短い名前になる。** B1 は、`subagent.started` の `agentDisplayName` に `task` の `description`（例：「週報を書く」）が入ると想定して作ったが、実機では `agentDisplayName` は `worker`・`verifier` だった（状態の `agents[].task` が `worker`、`verifier`）。`task` の `description` は、`tool.execution_start`（統括の `task` 呼び出し。`arguments.description`、`toolCallId`）にあり、`subagent.started.data.toolCallId` と同じ番号で結べる。`/tasks` の画面にも同じ文字が出る。ユーザーへの影響は、画面の「担当」の欄の見え方だけ。
- **`weekly-report_open` の引数 `requestText` は必須と宣言されているが、`{}` で呼んでも通った**（Copilot CLI は必須の引数を検査しない。エクステンションの中が受け付ける）。ツールの引数の `minimum`・`minLength`・`minItems` は、モデルに届く定義では説明の末尾の `{minimum: 1}` のような文字になる（検査は Copilot CLI ではなく、エクステンションの `handleTool` がする設計のままで足りる）。
- サブエージェントの システムプロンプトには、Copilot CLI が定義の本文の後ろに、`<tool_calling>`、「**CRITICAL: Ensure a response is returned to your caller.** … Do NOT use output redirection (`>`, `>>`, `tee`) to save results to files. Do NOT use `cat > /path` or heredocs to create output files.」、`<subagent_usage>`（「Default to doing the work yourself. … Use custom agents sparingly」）、`<environment_context>` を足す。作業エージェントの仕事はファイルを作ることなので、編集のツールがないと、この「シェルでファイルを作るな」と衝突する（5 節の不具合 1 に関係）。統括は `<subagent_usage>` を受けるが、統括の定義が `task` で頼む手順を明示しているので、台本どおりに `task` が使われた。

## 4. カスタムエージェントの定義

### やったこと

- 生成プラグインの 3 体（統括・作業・検証）は、3 節の通しで動かした。クリエイターの読み取り役（`reader`）と作業エージェント（`worker`）は、メインのセッションから `task` ツールで起動した（`@@CALL task {"agent_type":"plugin-creator:reader",…}`）。
- 偽物のモデルに届いたリクエストの `model` と `tools`、システムプロンプトを読んだ。

### 結果

| 確かめること | 結果 |
| --- | --- |
| 定義が読み込まれるか | 読み込まれた。生成プラグインの 3 体は、メインの `task` ツールの `agent_type` の選択肢に `weekly-report:orchestrator`・`verifier`・`worker` が、定義の `description` つきで並んだ。クリエイターの 2 体（`plugin-creator:reader`、`plugin-creator:worker`）は、`task` で起動できた。起動した子のシステムプロンプトは定義の本文 |
| 統括・作業・検証の定義の `description` が「チャットの頼みでは呼ばない」でも | メインの `task` の選択肢には載る（呼べる状態）。`disable-model-invocation` は使っていない（R1 のとおり、使うと `task` で起動できなくなる） |
| `model` のリスト | `tasks.startAgent` や `updateSubagentSettings` の指定がないとき、クリエイターの作業エージェント（`model: [gpt-6-luna, claude-haiku-5.5]`）は、リストの先頭の `gpt-6-luna` で動いた。`model` のない読み取り役は、メインのセッションのモデル（`fake-model`）で動いた。リストの 2 番目への切り替わり（先頭が使えないとき）は、自前のモデルの窓口では確かめられない。開始の指定（`tasks.startAgent` の `model`）と `updateSubagentSettings` の上書きは、リストより優先して効いた |
| `tools` の別名 `read`・`search` | 子のモデルの族で名前が変わる。Claude の族：`read` → `view`、`search` → `grep`・`glob`。GPT の族（`gpt-6-luna`、`gpt-6.1-sol`）：`read` → `view`、`search` → `rg`・`glob`、`edit` → `apply_patch`（`type: "custom"` のツール）。`execute` → `bash`・`read_bash`・`stop_bash`・`list_bash`。`agent` → `task`・`read_agent`・`list_agents`・`write_agent` |
| `tools` の別名 `web`（読み取り役） | **確かめられなかった。** 読み取り役のツールは `view`、`grep`、`glob`、`plugin-creator_doc_text` で、`web` に当たるツールは載らなかった。メインのセッションにも Web のツール（`web_fetch` など）がない（`fetch_copilot_cli_documentation` だけ）ので、`web` が解決されない理由が別名の扱いか、この環境（自前のモデルの窓口）にないためかは分からない |
| `skill` を外したとき | 統括・作業・検証・読み取り役・作業エージェントのどれにも、`skill` ツールは載らなかった（`tools` に書かない限り載らない）。`ask_user` も載らない（サブエージェントは質問できない。ナレッジのとおり） |
| 拡張のツール（`<名前>_*`）を `tools` に書く | 書いたツールだけが載る（統括：`plan`・`review`・`issue`・`finish`・`show`。作業：`show`。検証：`verdict`。読み取り役：`plugin-creator_doc_text`）。ただし**親が持つツールの範囲内**（5 節の不具合 1） |
| 内蔵の指示ファイル | 子のシステムプロンプトに AGENTS.md 等の中身が入るかは、この環境の作業フォルダに指示ファイルを置いていないので確かめていない（R1 の「`include-custom-instructions` を付けない限り受け取らない」の確認は未実施） |

### 設計・実装との食い違い、気づいたこと

- 5 節の不具合 1（子のツールは親のツールの範囲内）。
- 読み取り役の `web` が解決されるかは、ログインした本物のアカウントで見る必要がある（6 節）。

## 5. 見つかった不具合（実装を直す必要があるもの）

どれも、偽物のモデルでも起きる Copilot CLI 側の動き（モデルに依らない）で確かめた。実機の再現の道具は `v1/`（`e2e.sh`、`fake-model.mjs`、`behavior.mjs`、写し `gen/`・`gen-a/`・`gen-c/`・`gen-d/`、`creator-ret/`）にある。

### 不具合 1【重大】サブエージェントのツールは、親（統括エージェント）が持つツールの範囲に絞られる

- **起きること：** 生成プラグインの統括エージェントの `tools` は `agent, read, search, <名前>_plan, _review, _issue, _finish, _show` で、`<名前>_verdict`・`edit`・`execute` を持たない。そのため、`task` で起動した検証エージェント（`tools: read, search, <名前>_verdict`）のツールは `view, grep, glob` だけになり、`<名前>_verdict` が使えない。偽物のモデルに呼ばせると「Tool 'weekly-report_verdict' does not exist. Available tools that can be called are view, grep, glob.」が返った。合否が記録されないので、どの実行も「繰り返しを終えないまま統括エージェントが終わった」で終わる（`all_passed` に決してならない）。作業エージェント（`tools: read, edit, execute, search, <名前>_show`）も、`edit`・`execute` が落ち、`view, rg, glob, <名前>_show` だけになる（ファイルを作る手段がない）。
- **根拠：** 更新履歴 1.0.67「Subagent sessions keep parent tool restrictions」、1.0.68「Custom agents keep their tool filters in nested subagents」。実機で、統括の `tools` に `<名前>_verdict`・`edit`・`execute` を足した写し（`gen-a/`）では、検証が `<名前>_verdict` を使え（`view, grep, glob, weekly-report_verdict`）、作業が `bash` を使え、実行が `all_passed` で終わった。統括の `tools:` の行を丸ごと消した写し（`gen-d/`）でも、同じく通った（統括は全ツールを持つ）。
- **混ぜたモデルの族の注意：** `edit` の別名は、子のモデルの族で別のツールになる（Claude の族：`create`・`edit`、GPT の族：`apply_patch`＝`type: "custom"`）。統括が Claude の族（既定は `claude-sonnet-5.5`）、作業が GPT の族（既定は `gpt-6-luna`）の組み合わせでは、統括の `tools` に `edit` を足しても、作業は `apply_patch` を受け取れなかった（`bash` は受け取れた）。統括も GPT の族（`gpt-6.1-sol`）にした写し（`gen-b/`）では、作業が `apply_patch` を受け取った。統括の `tools:` を消した写し（`gen-d/`）では、統括が Claude の族でも作業が `apply_patch` を受け取った。
- **直し方の案（決めるのは設計者）：** 統括の `tools` を、作業と検証が要るツールの和にする。`<名前>_verdict` は「検証エージェント以外からの記録は断る」が決まりなので、統括が持っていても記録できない（`caller` の確かめ）。統括が `edit`・`execute` を使わないようにするには、`onPreToolUse`（統括の `agentType` で、拒む。拒むと「Denied by preToolUse hook: <理由>」がモデルに届く）を使う案と、そもそも統括の `tools:` を書かない案（`gen-d/` のように全ツールになるので、拒む一覧を持つ）がある。どちらも、統括の定義（`orchestrator.agent.md`）と、設計書 4.4・4.7・4.8（統括・作業・検証のツール）、`tests/stage1`（定義の `tools` の検査）に効く。ひな形の試験（偽物の SDK）では、この絞り込みは再現できない。
- 同じ絞り込みは、クリエイターの読み取り役・作業エージェントには起きない（親がメインのエージェントで、全ツールを持つ）。

### 不具合 2【重大】ツールの処理が投げた例外の文は、モデルに届かない

- **起きること：** ツールの処理（handler）が `throw new Error('平易な日本語の理由')` で断ると、モデルが受け取るのは「Failed to execute `<ツール名>` tool with arguments: {…} due to error: Error: Tool execution failed」だけで、理由の文は消える。クリエイターの `plugin-creator_progress`（段階を「生成」に進める前に確認がない）でも、生成プラグインの `<名前>_plan`（メインのエージェントが呼んだ）でも、同じ文になった。ツールの説明は「決まりに合わない記録は、理由を返して断る。返った理由に従い、直せるときは直して呼び直す。『作業を終えてください』と返ったら、呼び直さない」と書いてあるが、実機では理由が返らない。統括・作業・検証の定義の「`<名前>_show` が『作業を終えてください』と返ったら、やめる」も、この文が届かないと働かない。
- **根拠：** SDK 1.0.25 の `session.js` の `_executeToolAndRespond` は、例外の文を `error` として Copilot CLI に渡す（`handlePendingToolCall({ requestId, error: message })`）が、Copilot CLI 1.0.102 はモデルに「Tool execution failed」と一般の文を返す。R2 の 3.3「関数が例外を投げると、その文がエラーとしてモデルに返る」は、実機では成り立たない。
- **確かめた直し方：** 断るときは、例外ではなく `{ textResultForLlm: '<理由>', resultType: 'failure' }` を返す。クリエイターの写し（`creator-ret/`）で、`failure` と `denied` は理由の文がそのままモデルに届いた（`rejected` は、画面に理由は出たが、手番が止まり、モデルへの次のリクエストが出なかった）。`onPreToolUse` が拒む場合（`permissionDecision: "deny"` と `permissionDecisionReason`）は、「Denied by preToolUse hook: <理由>」としてそのまま届く（確かめた）。
- **直す場所：** 生成プラグインのひな形の `adapter.mjs` の `callTool`（`core.handleTool` が投げる断りを、文で返す形に包む）と、クリエイターの `creator.mjs` の `guard`。それぞれの偽物の SDK の試験（`tests/stage2/adapter/`、`tests/creator/extension/`）は、例外が理由として届く前提になっているので、「理由の文がツールの結果として返る」確かめに直す。設計書（generated-plugin-structure.md の記録のツールの断り、R2 の 3.3）も直す。

### 不具合 3【軽】画面の枠の「担当」が、呼び出しの説明ではなく、エージェントの短い名前になる

- 3 節の「設計・実装との食い違い」のとおり。`subagent.started` の `agentDisplayName` は `worker`・`verifier`で、`task` の `description`（「週報を書く」）ではない。`description` は統括の `task` 呼び出しの `tool.execution_start.arguments.description` にあり、`subagent.started.data.toolCallId` と同じ `toolCallId` で結べる。
- 直す場所：`adapter.mjs` のイベントの直し（B1 の「担当」の決め方）。ユーザーに見えるのは「担当」の欄だけで、実行は止まらない。

## 6. 確かめられなかったこと、気づいたこと

### 確かめられなかったこと

- **`defer: "never"` が効くか。** ツール検索が働く状況を作れなかった（2 節）。ツールの総数が 32（しきい値の既定は 30）でも、`TOOL_SEARCH` の機能の旗を入れても、`defer` の行を消しても、8 つのツールは全部ふつうに載った。ログインした本物のモデルで、`/tools` などを見る必要がある。
- **選べるモデルの一覧の要素の形、Auto の見分け。** 偽物のモデル（自前のモデルの窓口）では `session.rpc.model.list()` の `list` が空で、`model.getCurrent()` は `{"modelId":"fake-model"}` だけだった。Auto のときの `modelId` が `auto` になるかは分からない。
- **`model` のリストの 2 番目への切り替わり**（先頭のモデルが使えないとき）。自前のモデルの窓口では、先頭の名前がそのまま使われ、「使えるか」の判断が働かない。
- **読み取り役の `web` の別名**（`web_fetch` など）。この環境ではメインのセッションにも Web のツールがない。
- **ログインが要るもの：** `assistant.usage` の `copilotUsage`・`aiCreditsStatus`、`session_limits_exhausted.requested`、GitHub の MCP サーバー、組織の管理の設定。
- **サブエージェントがユーザーのリポジトリの指示ファイル（AGENTS.md など）を受け取らないこと**（R1）。指示ファイルのある作業フォルダでは動かしていない。
- **GitHub に公開したあとの `marketplace add imaeda-hub/plugin-creator`**。
- **実ブラウザーでの画面の表示**（このスクリプトの範囲外。サーバーの応答だけ確かめた）。
- **Windows、macOS、サンドボックス有効での動作**（Linux x64 だけ）。

### 気づいたこと（実装の不具合ではないが、文書の更新や判断が要る）

1. **make-plugin を読むたびに、`assets/template/` の全ファイルの一覧が届く。** Copilot CLI は、スキルを読んだとき、スキルのフォルダのファイルを全部「Related files」として並べる（make-plugin は 97 件、約 17.7KB。この環境のパスは長い）。SKILL.md の本文（約 7KB）より大きい。SKILL.md は「`assets/template/` は自分では読まない」と書いているが、一覧は消せない。コンパクションの後に make-plugin を読み直すたびに届く。ひな形のファイルが増えるほど増える。実害は一覧の分のコンテキストウィンドウだけ。
2. **`--experimental` は、付けると `settings.json` に `"experimental": true` が残り、次からは付けなくても有効になる**（`-p --experimental` でも残った）。`/experimental on` は動くが、`copilot help config` が「`/experimental` (deprecated)」と書く（今の案内は `--experimental` か `/settings experimental on`）。`/experimental on` を案内している場所：README（2 か所）、`skills/make-plugin/references/setup.md`、ひな形の入口のスキル・README・設計書・仕様書、`docs/specs/creation-requirements.md`、`docs/specs/output-requirements.md`、`docs/design/generated-plugin-structure.md`、`docs/design/creator-structure.md`。
3. **`-p` で動かすと、エクステンションの読み込みのときの確認に答える人がおらず、「Approval check ✗ Denied, no one to approve」で、エクステンションが読み込まれない。** `--allow-all-tools` か `--allow-tool='extension-permission-access'`（または `extension-permission-access(plugin:<プラグイン>:<フォルダ>)`）を付けると読み込まれる。
4. **生成プラグインの入口のスキルのコマンドは、スキルの名前がプラグインの名前と同じなので `/weekly-report`（`/weekly-report:weekly-report` ではない）。** クリエイターは `/plugin-creator:make-plugin`、`/plugin-creator:test-plugin`。ひな形の README は「チャットで作業を頼みます」とだけ書いていて、スキルのコマンドは書いていないので、食い違いはない。クリエイターの README の `/plugin-creator:make-plugin` は実機のとおり。
5. **サブエージェントのシステムプロンプトに、Copilot CLI が「Do NOT use output redirection (`>`, `>>`, `tee`) to save results to files. Do NOT use `cat > /path` or heredocs to create output files.」を足す。** 作業エージェントが編集のツールを持たず `bash` でファイルを作る場合（不具合 1 の途中の形）と衝突する。不具合 1 を直して、編集のツールを持たせれば問題にならない。
6. **ツールの引数の `minimum`・`minLength`・`minItems`・`pattern` は、モデルに届く定義では説明の末尾の `{minimum: 1}` のような文字になる。** 検査は、エクステンションの中の `handleTool` がする設計のままで足りる。`required` の引数が欠けても Copilot CLI は止めない（`weekly-report_open` を `{}` で呼べた）。
7. **許可の求めの流れは設計どおり動いた**（作業エージェントのシェルの求め → 画面に「チャットで確認を待っています」の元になる `waits` → チャットで許可 → 続行）。
8. **`/clear` と `extensions_reload` の扱いは、ユーザーの答え 14 と設計どおり動いた**（3 節）。
9. 偽物のモデルの確かめの限界：自前のモデルの窓口（BYOK）の経路だけを見ている。ツールの名前の族（`rg`・`apply_patch`）の分かれ方は、モデルの名前で決まるので、本物のモデルでも同じ見込みだが、確かめていない。
10. 作業の途中で、`COPILOT_HOME` に空の変数を渡して、ファイルシステムの根に `/home-gen-a/`（Copilot CLI の設定とログ、約 600KB）ができてしまった。消そうとしたが、安全の検査に止められたので、残っている。中身はこの確かめのものだけで、消してよい。
11. 作業のはじめに、写しのフォルダの `git status` を見て、`tests/dev-eval/heldout/h1/` の 3 つのファイル名（`NOTES.md`、`files/a.docx`、`files/b.xlsx`）が出力に出てしまった（読まない決まりの「ファイルの一覧を見ること」に当たる）。中身は読んでいない。以後は `heldout` を写さず、写しで `git init` し直して見ていない。

## 7. 追加の確かめ（2026-10-24）

統括の依頼で、リポジトリのファイルを変えずに、スクラッチの写しで確かめた。Copilot CLI 1.0.102、偽物のモデル、1 節と同じ道具（`v1/`）。`COPILOT_HOME` は、`v1/home-*` の絶対パスだけを受け付ける関数（`sethome`。空の変数や `v1/` の外を断る）で必ず渡した。

### 7.1 ひな形（`skills/make-plugin/assets/template/`）をクリエイターの直下の `template/` に移してよいか

#### やったこと

1. `git fetch` で、ローカルのブランチが `origin/claude/multi-agent-implementation-rules-7pfoww` と同じ（遅れなし）ことを確かめた。
2. 今の作業ツリーを、`tests/dev-eval/heldout/`・`.git`・`node_modules`・`__pycache__`・`*.mutbak` を除いて、2 つ写した。`v1/cp-before/`（今の配置）、`v1/cp-after/`（`skills/make-plugin/assets/template/` を `template/` に移しただけ。スクリプトの参照は直していない）。
3. 2 つを、それぞれ「手元のフォルダのマーケットプレイス」（`marketplace add` → `install plugin-creator@plugin-creator`）と `--plugin-dir` で動かし、`plugin list --json`、`marketplace list`・`browse`、`skill list --json`、対話モード（`--experimental`）での読み込みの確認、`extensions_manage` の `list`、メインの `task` の `agent_type` の選択肢、`<available_skills>`、「MCP Servers reloaded: N server(s) connected」の行を見た。`/plugin-creator:make-plugin 週報を自動化したい` を実行して、偽物のモデルに届いた「Related files」を測った（`v1/chk.sh`）。
4. 読み込まれないことの確かめを強めるため、`cp-after` に「見つかったら分かる」ファイルを `template/` の中に足した写し 2 つを作った。`cp-canary`：`.mcp.json`・`mcp.json`・`.github/mcp.json`（MCP）、`.github/agents/*.agent.md`・`agents/*.agent.md`、`.github/skills/*/SKILL.md`・`skills/*/SKILL.md`、`hooks/hooks.json`、`AGENTS.md`。`cp-canary2`：本物に動く最小の MCP サーバー（`v1/mini-mcp.mjs`）を指す `template/mcp.json`（Agent Plugins の形）・`template/.mcp.json`・`template/.github/mcp.json`（以前の形）。陽性対照として、`cp-mcp`（同じ MCP サーバーをクリエイターの直下の `mcp.json` に置いたもの）も動かした。

#### 結果

| 確かめること | 移す前（`cp-before`） | 移した後（`cp-after`） |
| --- | --- | --- |
| `skill list --json`（組み込みを除く）。マーケットプレイスでも `--plugin-dir` でも | `make-plugin`、`test-plugin` だけ | 同じ。ひな形の `skills/_entry_/` は出ない |
| `plugin list --json` | マーケットプレイス：`plugin-creator`（`live`）だけ。`--plugin-dir`：`plugin-creator`（`external`）だけ | 同じ |
| `marketplace list` と `browse plugin-creator` | 登録は `plugin-creator` 1 つ、プラグインも `plugin-creator` 1 つ。ひな形の `.github/plugin/marketplace.json` や `plugin.json` は読まれない | 同じ |
| `--experimental` で読み込まれるエクステンション | `plugin-creator:plugin-creator` だけ（`extensions_manage` の `list`：「Discovered extensions (1)」）。ひな形の `_plugin_` は読み込まれない | 同じ |
| 読み込みの確認の画面 | 1 つだけ（題：`Extension "plugin:plugin-creator:plugin-creator" wants elevated permissions`）。2 つ目は 8 秒待っても出ない | 同じ |
| メインの `task` の `agent_type` の選択肢 | `explore, task, general-purpose, code-review, research, security-review, plugin-creator:reader, plugin-creator:worker` | 同じ。ひな形の統括・作業・検証は出ない |
| `<available_skills>` | `make-plugin`、`test-plugin`（と組み込みの 2 つ）。ひな形の入口のスキルは出ない | 同じ |
| MCP | 「MCP Servers reloaded: 0 servers connected」 | 同じ |
| **make-plugin を読んだときの「Related files」** | **97 件**（`assets/template/` 81、`references/` 15、`scripts/` 1）、一覧 **17,432 バイト**、メッセージ全体 **34,797 バイト** | **16 件**（`references/` 15、`scripts/` 1）、一覧 **2,343 バイト**、メッセージ全体 **19,707 バイト** |

- 「Related files」の減り：81 件、一覧 15,089 バイト、メッセージ全体 15,090 バイト（約 43%）。マーケットプレイスでも `--plugin-dir` でも同じ数だった。この環境のパスは長く（1 行あたり約 180 バイト）、実際のインストール先のパスはもっと短いので、バイト数の減りはこれより小さい。件数の減り（81 件）は、パスの長さに依らない。
- **`template/` は、何としても読み込まれなかった。** `cp-canary`（`template/` の中の MCP の設定 3 つ、エージェント 2 つ、スキル 2 つ、フック、`AGENTS.md`）でも、`cp-canary2`（本物に動く MCP サーバーを指す `template/mcp.json`・`.mcp.json`・`.github/mcp.json`）でも、`skill list`、`task` の選択肢、エクステンションの一覧、MCP の行、`plugin list` は `cp-after` と同じで、足したものは 1 つも現れなかった（`cp-canary2` のリクエストに `v1-` で始まるツールは 0 件）。ほかの名前の候補（`assets/` の下など）を試す必要はなかった。
- 陽性対照：クリエイターの直下に `mcp.json`（`$schema` つき、`type: "stdio"`、`${PLUGIN_ROOT}/mini-mcp.mjs`）を置いた写しでは、「MCP Servers reloaded: 1 server connected」と出て、ツール `v1-root-mcp-v1_ping` がモデルに届いた。つまり、上の読み込みの見分け方は働いている。なお、`copilot mcp list --json` はプラグインの MCP サーバーを出さない（この陽性対照でも `{"mcpServers": {}}`）。プラグインの MCP は、起動した画面の「MCP Servers reloaded: N server(s) connected」の行と、モデルに届くツールの一覧で見る。
- 移す前の配置でも、ひな形は何としても読み込まれていなかった。移しても読み込みの結果は変わらず、変わるのは「Related files」だけである。

#### 結論

`template/` を直下に移してよい。読み込みに影響はなく（ひな形の入口のスキル、エージェント、エクステンション、MCP、`plugin.json`、`marketplace.json` のどれも、クリエイターの設定として読まれない）、make-plugin を読むたびに届く「Related files」が 97 件から 16 件になり、メッセージが約 15KB（約 4 割）減る。移すと、`skills/make-plugin/assets/template` を指している次の場所を直す必要がある（この確かめでは直していない。`grep` で見つけたもの）：`com.github.copilot/extensions/plugin-creator/screen.mjs`、`skills/make-plugin/SKILL.md`、`skills/make-plugin/references/confirm.md`・`generate.md`、`skills/make-plugin/scripts/scaffold.py`（`DEFAULT_TEMPLATE`）、`tests/creator/check_creator.py`、`tests/creator/extension/helpers.mjs`、`tests/creator/scaffold/test_scaffold.py`、`tests/creator/test-plugin/helpers.mjs`・`test_run_tools.py`、`tests/dev-eval/convert.py`（`assets/` を置き換えない決まり）・`test_convert.py`。ほかに、設計書（creator-structure.md など）と README の配置の説明がある。

### 7.2 `/experimental` が非推奨なので、案内を直すための確かめ

#### やったこと

`v1/home-set-*`・`home-flag2` の空の `COPILOT_HOME` で、対話モードの `/settings`、`/settings experimental on`、`/settings experimental off`、`copilot --experimental`、`copilot --no-experimental` を動かし、画面の文、`settings.json`、再起動、エクステンションの確認、そのあとの起動での有効・無効を見た。

#### 結果

| 確かめること | 結果 |
| --- | --- |
| `/settings`（引数なし） | 設定の画面が開く。題「Settings」、タブ「[User]  Repo  Repo (local)  Problems」、「Configure your Copilot CLI preferences.」、見出し「General」の下に設定が 178 件（「Allowed URLs  (default)」「Ask user」…「Experimental  (default)」…）。下の説明：「1 of 178」「allowedUrls · URLs or domains allowed without prompting. (list of strings)」「/ search · ↑/↓ navigate · tab switch scope · enter edit · ctrl+r reset · ctrl+e editor · esc close」。`/` で検索できる |
| `/settings experimental`（`on` なし） | 同じ画面が開き、カーソルが「Experimental」に合う（「33 of 178」「experimental · Enable experimental features. (boolean)」「enter toggle」）。画面を開いたまま `/settings experimental on` と打つと、検索の欄に入ってしまい、「No settings match」になる |
| **`/settings experimental on`**（チャットの入力から） | 動く。チャットに「**Set experimental = true. Restarting...**」と出て、Copilot CLI がすぐ再起動する（`COPILOT_HOME` に `restart` というファイルができる）。再起動のあと、ロゴの横に「/experimental」と出る。フォルダの信頼の確認がもう一度出る（そのフォルダを覚えさせていないとき）。続いて、エクステンションの読み込みの確認が出る（題・本文・選択肢は 2 節と同じ）。**この確認は、再起動のあと続けて 2 回出た**（1 回目に Yes と答えても、同じ確認がもう一度出て、2 回目に答えると読み込まれる。Copilot CLI のログに「Session changed (A → B), reloading extensions」があり、再起動のあとでセッションが切り替わるため）。`settings.json` は、なければ作られ、`{ "experimental": true }` だけが書かれる。答えたあと、`extensions_manage` の `list` に `plugin-creator:plugin-creator — running` が出た |
| `/settings experimental off` | 「Set experimental = false. Restarting...」と出て再起動し、`settings.json` は `{ "experimental": false }` になる |
| `copilot --experimental` で一度起動したあと、付けずに起動 | **有効のまま。** 空の `COPILOT_HOME` で、`--experimental` で起動 → 確認に答えて読み込まれる → 終了 → 付けずに起動 → 読み込みの確認が出て、読み込まれた（`extensions_manage` の `list` に `running`）。`settings.json` は `{ "experimental": true }`（`-p --experimental` でも同じ）。前回の確かめのとおり |
| `copilot --no-experimental` | その起動はエクステンションが読み込まれず（確認も出ない）、`settings.json` が `{ "experimental": false }` になり、そのあと付けずに起動しても無効のまま。`--experimental` と同じく、設定に残る |
| `/experimental on`（前の確かめ） | 動く（再起動し、`settings.json` に `"experimental": true`）が、`copilot help config` が「`/experimental` (deprecated)」と書く。`copilot help config` は、有効にする方法として「Can be enabled with --experimental flag, /settings experimental on, or /experimental (deprecated)」を挙げる |

#### 見立て（利用者への案内の書き方）

- **`copilot --experimental` を第一にするのが、確かで短い。** 理由：（1）起動の引数を 1 つ足すだけで、再起動もやり直しもない。（2）一度付けると `settings.json` に残り、次からは付けなくても有効になる（実機で 2 回確かめた。ただし公式の説明に「残る」とは書かれていない。`copilot help config` が書くのは「Can be enabled with --experimental flag」まで）。（3）`-p` でも同じ。（4）`/settings experimental on` は、再起動のたびにフォルダの信頼の確認とエクステンションの確認（2 回続くことがある）が出て、手数が多い。
- 起動してしまったあとで切り替えるときは、`/settings experimental on`（Copilot CLI が自動で再起動する）。公式の `copilot help config` にある書き方で、非推奨の `/experimental on` より確か。再起動で今の会話は終わるので、「有効にしたら、Copilot CLI を起動し直します」とは書かず、「自動で再起動します」と書く。
- 案内の文の例：「Copilot CLI を `copilot --experimental` で起動します（一度付けると設定に残るので、次からは付けなくても有効です）。すでに起動しているときは、チャットで `/settings experimental on` と打つと、自動で再起動して有効になります。」
- 再起動のあとは、読み込みの確認が続けて 2 回出ることがある、と添えるとよい（README の「この確認が 2 回出ることがあります」の記述と合う）。「always allow」を選べば、2 回目は出ない見込み（この再起動の流れでは確かめていない）。
- 無効に戻すときは `/settings experimental off` か `copilot --no-experimental`（どちらも設定に残る）。

## 8. 追記（統括、2026-10-24）：シェルのツールの定義

- X3 が V1 の生データ（`scratchpad/v1/out/gen-a/requests.jsonl` の `bash` の定義）で確かめた。Copilot CLI 1.0.102 のシェルのツール `bash` は `initial_wait`（30〜600秒）を持つ。それまでに終わらないコマンドは、途中の出力を返して動き続け、終わると知らせが来る。
- test-plugin の EVAL のように数十分かかるコマンドは、この知らせを待ち、同じコマンドを動かし直さない（B3 が test-plugin の手順7に入れた。X2-05）。
