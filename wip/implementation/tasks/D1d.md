# D1d 作業のメモ：内側の EVAL（tests/dev-eval/runner/ の内側の部分）

担当の指示：wip/implementation/briefs/D1.md の「D1d」の節（共通：common.md）

置き場所（これ以外は作らない・変えない）：
- tests/dev-eval/runner/ の内側の部分（ファイル名は `inner-*.mjs`）と、D1c と分け合う共通の部品（下の表）
- tests/dev-eval/package.json（Node.js の部品の版の固定。D1c・D1a・D1b も使う）
- 試験は tests/dev-eval/runner/ の中（実際のモデルは使わない）

## 状態

印の意味：[x] できた（試験も通った）、[~] ファイルはできた（試験はまだ）、[ ] まだ

- [x] 読み込み（testing.md 1〜9章・11.1、ナレッジ3つ、R4、BLUEPRINT、B1 の adapter.mjs、A1 の core、C3 の screen.mjs・grade.mjs・tasks.mjs・judge.mjs、D1a の convert.py、D1b の FORMAT.md、D1c の user-role.mjs・outer-inner.mjs）
- [x] 偽の API で、本物の Agent SDK 0.3.310 の Claude Code を動かして、つなぎ方を確かめた（分かったことは下の節）
- [x] 共通の部品：package.json、model-map.mjs、isolation.mjs、mcp-tools.mjs、fake-anthropic.mjs と、それぞれの試験
- [x] inner-adapter.mjs（内側のつなぎ口）と試験 inner-adapter.test.mjs（17 件）
- [x] inner-run.mjs（実行1回。あり・なし）と試験 inner-run.test.mjs（19 件）
- [x] inner-judge.mjs（モデルで判定する関数の Agent SDK 版）と試験 inner-judge.test.mjs（5 件）
- [x] inner.mjs（入口。コマンドラインと innerEval）と試験 inner.test.mjs（10 件）
- [x] inner-e2e.test.mjs（7 件）：本物の Agent SDK と Claude Code の本体、本物の生成プラグイン〔C2 の見本を組み立てて D1a の変換スクリプトで置き換えたもの〕の画面と Playwright を、偽の Anthropic API につないで、ありの実行・なしの実行・チャットの返事・質問のツール・止める・設定の欄をユーザー役が決めること（決められたとき、決められなかったとき）を通した
- [x] 通しの確認：tests/dev-eval/runner/ の試験すべて（D1c の分を含む）172 件が通った。D1d の分は 87 件（共通の部品 21 件を含む）。D1d の分を続けて動かしても通った
- [x] 変異試験（わざと壊す検査）：下の「変異試験」
- [x] 最後の返事（1回目）
- [x] 続きの仕事（統括の決定）：画面の開始前の設定の欄を、ユーザー役が読んで決める（inner-settings.mjs）。下の「画面の設定の欄を決める」

動かし方（リポジトリの根から。事前に `cd tests/dev-eval && npm install`）：

```text
node --test "tests/dev-eval/runner/*.test.mjs"                        # 全部（約35秒）
node --test "tests/dev-eval/runner/inner*.test.mjs"                   # D1d の分
```

Python に PyYAML と jsonschema、Playwright のブラウザー（この環境は PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers）が要る。なければ、その試験は飛ばす。

内側の EVAL の使い方（実際のモデルを使う。統括がユーザーの承認をとってから）：

```text
node tests/dev-eval/runner/inner.mjs --plugin <生成プラグインのフォルダ> --persona tests/dev-eval/personas/<id> [--persona …] \
     [--runs 1] [--arms with,without] [--out <結果のフォルダ>] [--setting 鍵=値] [--worker-model gpt-6-luna …] [--no-sandbox]
```

結果は `<結果のフォルダ>/inner-result.json`（あり・なしの点数とその差、実行ごとの基準ごとの合否、動きの確かめ、費用）。実行ごとの記録は `inner-runs/<課題>/<with|without>-<回>/`（result.json、events.jsonl、screen.png、work/〔作業フォルダ。成果物〕）。外側の EVAL（D1c の outer-inner.mjs）は `innerEval()` を直接呼ぶ。

## 作ったファイル（tests/dev-eval/ の下）

| ファイル | 中身 |
| --- | --- |
| `package.json` | 版の固定（下の表） |
| `runner/model-map.mjs`、`isolation.mjs`、`mcp-tools.mjs`、`fake-anthropic.mjs` | 共通の部品（下の表）。試験は `*.test.mjs`（model-map 5、isolation 10、mcp-tools 6） |
| `runner/inner-adapter.mjs` | 内側のつなぎ口。`createInnerAdapter({ sdk, pluginRoot, convertedRoot, workDir, runDir, ... })`。中心の処理（core/）と画面（ui/）を生成プラグインの場所から読み込み、窓口 port と中立のイベントで動かす。`mainParts()`（メインの query に足す MCP サーバー）、`port`、`core`、`agents()`、`runs()`、`checkToolNames()`、`limitHit()`、`shutdown()` |
| `runner/inner-run.mjs` | 実行1回 `runInnerArm({ arm, task, runDir, sdk, userRole, judge, screen, ... })`。流れは先頭のコメント。`asksForReply`（返事を求めているかの見分け）、`buildChecks`（動きの確かめ） |
| `runner/inner-judge.mjs` | `createAgentSdkJudge({ sdk, model })`。grade.mjs の buildJudgePrompt と parseJudgeReply を使う |
| `runner/inner.mjs` | `innerEval(...)`（課題 × 回数 × あり・なし。点数とその差。利用枠の上限で止まったら残りを skipped）、`main(argv)`、`parseArgs`、`scoresOf`、`summarizeRun` |
| `runner/inner-settings.mjs` | 画面の開始前の設定の欄を、ユーザー役が決める。`decideSettings`（値を決める順と記録）、`describeSetting`（ユーザー役に聞く文）、`normalizeSettingAnswer`（答えを欄の値にする）、`previewInputs`（渡したファイルの先頭）。試験は `inner-settings.test.mjs`（8 件） |
| `runner/inner-test-support.mjs` | 試験の道具。`buildSamplePlugin()`（C2 の見本から組み立てて、D1a の convert.py で置き換える）、`scriptedModel(scenario)`（偽の API の台本。メイン・統括・作業・検証・ユーザー役・判定を見分けて、決まった順にツールを呼ぶ） |

## 共通の部品（D1c と分け合うもの。置き場所と形）

D1c は、次の部品を使っている（isolation・mcp-tools・model-map・fake-anthropic を D1c のメモが挙げている）。形を変えるときは D1c に知らせること。

| ファイル | 中身（形） |
| --- | --- |
| `tests/dev-eval/package.json` | Node.js の部品の版の固定。`@anthropic-ai/claude-agent-sdk` 0.3.310（Claude Code 2.1.310 と同梱で同じ版。手元の `claude --version` も 2.1.310）、その peer の `@anthropic-ai/sdk` 1.3.0・`@modelcontextprotocol/sdk` 1.32.2・`zod` 4.6.7、`playwright` 1.56.1。`type: module`。`cd tests/dev-eval && npm install`（約 350MB。node_modules は git に入らない）。lock のファイルは置かない（C3 と同じ） |
| `model-map.mjs` | モデルの名前の対応。表は D1a の convert.py だけが持ち、変換レポート（`<置き換えた版>/.eval/conversion-report.json` の `model_map`）から読む。`readConversionReport(root)`、`modelMapOf(report)`、`toClaudeModelId(map, name)`（未知の名前は Error）、`toCopilotName(map, id)`、`copilotModelList(map)`（`[{ id, name }]`。画面の選択肢） |
| `isolation.mjs` | Agent SDK の隔離（testing.md 5章）。`ENV_ALLOW`、`agentEnv({ home, extra })`、`sandboxStatus()`（Linux は bwrap・socat が PATH にあるか。`{ available, missing }`）、`makeSandboxOptions({ enabled })`、`isInsideDir(cwd, p)`、`makeCanUseTool({ cwd, onQuestion, refused })`（AskUserQuestion は `onQuestion(questions)` の `{ 質問の文: 答え }` で答える。作業フォルダの外への Write/Edit は断る）、`allowedToolsFor({ mcpTools })`、`usageLimitPrefixes(sdk)`（利用枠の上限の書き出し。sdk が持っていなければ本物から読む）、`makeQueryOptions({ cwd, home, model, plugins, mcpServers, mcpTools, hooks, agent, systemPromptAppend, sandbox, onQuestion, refused, envExtra, maxTurns, resume, abortController })`（上をまとめた `query()` の options。`settingSources: []`、システムプロンプトは `claude_code` のプリセット〔`agent` の本文を効かせるのに要る〕、本体は SDK 同梱のもの） |
| `mcp-tools.mjs` | 同じプロセスの MCP サーバー。`createToolServer({ name, tools, onCall })` が `{ type: 'sdk', name, instance }` を返す（`mcpServers[name]` に渡す）。`tools` は `[{ name, description, inputSchema(JSON Schema そのまま), handler(args, ctx) }]`。`ctx` は `{ toolUseId, agentId, signal }`。`query()` 1回ごとに別のインスタンスを作ること。ツールは `anthropic/alwaysLoad` で、いつもプロンプトに載る。`mcpToolName(server, tool)` |
| `fake-anthropic.mjs` | 偽の Anthropic API。`startFakeAnthropic(handler)`。本物の Agent SDK と Claude Code の本体を、実際のモデルなしで動かす試験に使う。`systemText`、`firstUserText`、`lastToolResults`、`lastUserMessage` |

## 確かめて分かったこと（本物の Agent SDK 0.3.310 の Claude Code を、偽の Anthropic API につないで確かめた）

- `ANTHROPIC_BASE_URL` に偽のサーバー、`ANTHROPIC_API_KEY` に適当な文字、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` を env で渡せば、本物の Claude Code の本体が動く。ストリーミング（SSE）で返せばよい。
- MCP のツールは、既定でツール検索の裏に回される（モデルの道具の一覧に載らない）。ツールに `_meta: { "anthropic/alwaysLoad": true }` を付けると載る（Copilot CLI の `defer: 'never'` に当たる）。
- MCP のツールの呼び出しの `_meta` に `claudecode/toolUseId` が入る。フックの `tool_use_id` と同じ値。フック PreToolUse の入力には、サブエージェントの中なら `agent_id`、統括自身（メインのスレッド）なら `agent_id` がなく `agent_type` だけが付く。これで「記録のツールを呼んだエージェント」を結び付けられる（testing.md 4章の要確認が解けた）。`_meta` に `claudecode/agentId` は付かなかった（使わない）。
- `agent: '<プラグイン>:<エージェント>'` は、`systemPrompt: { type: 'preset', preset: 'claude_code' }` のときだけ、エージェントの本文が効く。既定の最小のシステムプロンプトでは本文が入らない。`tools` の制限とモデルは、どちらでも効く。
- `Agent` の呼び出しは、既定で裏で動く（`is_backgrounded: true`、すぐ「launched」が返り、終わりは後の通知で届く）。入力で `run_in_background: false` を指定すると前面で動き、サブエージェントの最後の返事が返る（`is_backgrounded: false`）。D1a の変換は、統括の本文の `mode: "sync"` を `run_in_background: false` にしてある。環境変数で強制はしない（統括の指示に従うかも試すため）。
- フックの入力：サブエージェントの始まり（SubagentStart）は `agent_id`・`agent_type`（`<プラグイン>:worker`）。終わり（SubagentStop）は `last_assistant_message`。Agent の呼び出し（PreToolUse の `tool_name` が `Agent`）の入力に `description`・`subagent_type`・`run_in_background` が入る。サブエージェントの assistant メッセージには `agent_id` と `message.model` が付く（実際のモデルが分かる）。
- 止める：`query.close()` で、ループが静かに終わり、Claude Code の本体のプロセスも消える（`ps` で確かめた）。サブエージェントの終わりのフックは届かない（Copilot CLI で統括を取り消したときと同じ）。
- フックが `permissionDecision: 'deny'` を返すと、ツールは「PreToolUse:… hook error: <理由>」の誤りの結果になり、事後のフック（PostToolUse）は呼ばれない。
- `allowedTools` にツールを書くと、SDK が「canUseTool は呼ばれない」という警告を毎回出す（ねらいどおりなので放っておく。ナレッジ agent-sdk-eval.md のとおり）。

## 決めたこと

設計書にない細かいところを、目的に合う最も単純な形に決めた。

1. **つなぎ口の作り**：B1 の adapter.mjs のように Copilot の部品の形に合わせず、Agent SDK のフックとメッセージから、窓口 port と中立のイベントを直接作る。Copilot CLI でしか起きないもの（`wait.started`・`wait.ended`〔確認の待ち〕、`agent.idle`、`/clear`）は作らない（testing.md 4章、9章。普段のツールはあらかじめ許可するので確認の待ちは起きない）。
2. **統括の起動**：統括を、置き換えた版のコピー（`runDir/plugin-<統括の番号>/`）で、`agent: '<プラグイン>:orchestrator'` として別の query() で始める。作業・検証のモデルの上書き（`setSubagentModels`）は、コピーの `agents/<名前>.md` の `model:` を、変換の表で Claude Code の ID にして書き換えて効かせる（元の置き換えた版は変えない）。統括のモデルは、統括の定義の `model:` と query の `model` の両方に入れる。
3. **統括の番号**：`orch-<連番>` を作って返す。統括の中のフックには `agent_id` が付かないので、`agent_id` がないものは統括のものとする。
4. **実際のモデルの名前**：画面は選んだ Copilot の名前（例：gpt-6-luna）と実際のモデルを比べる。実際の Claude の ID が、選んだ名前を変換した ID と同じなら選んだ名前のまま、違えば ID に当たる Copilot の名前（claude- で始まる名前を先に）を `agent.configured` で届ける。違いが画面に出る。
5. **取り消されたか**：Agent SDK の側にはその情報がないので、試験の仕組みが止めたかどうかだけで決める（testing.md 4章の「取れないとき」）。止めると、統括の終わり（`cancelled: true`）だけを届け、下のエージェントは `listTasks` で `cancelled` にする。
6. **サブエージェントの親**：Agent の呼び出し（PreToolUse）を覚えておき、サブエージェントの始まりのフックで、`subagent_type` が合う最も古い呼び出しと結び付ける。親は呼んだエージェント、説明は `description`、実行のしかたは `run_in_background === false` なら `sync`、それ以外は `background`。
7. **ツール名**：中心の処理に届けるツール名は、Copilot CLI のときと同じ `<エクステンション>_<ツール>` に戻す（課題の洗い出しが、名前の終わりで記録のツールを見分けるため）。ほかのツールはそのまま。
8. **画面を開くツールの返り値**：adapter.mjs の `describeOpened` と同じ形を、inner-adapter.mjs に写した（adapter.mjs は export していないので。上位の文書で直すこと）。
9. **偽の gh**：中心の処理に渡す `gh` を、いつも失敗する短いスクリプトにする（`runDir/bin/gh`）。起票できるかの確かめが、本物の GitHub に触れないようにする。EVAL は起票を承認しない。
10. **画面の操作**：C3 の `screen.mjs`（`createScreen`、`findScreenUrl`）をそのまま使う。モデルの選択は、画面の欄 `#setting-model-<役割>` に入れる必要があるが、screen.mjs は設定の欄の `key` を `setting-<key>` に入れるので、`settings.task` に `model-<役割>` を足して渡す（`modelFields`）。screen.mjs は変えない。
11. **チャットの返事**：メインのエージェントが手番を終えたとき、最後の文が返事を求めていたら（文の終わりが「？」か、「教えてください」などの依頼）、ユーザー役が答え、同じセッションに続ける（最大 8 回）。ありでは、画面の URL が出た後は返事をしない（人が画面を操作するため）。質問のツール（AskUserQuestion）の問いにも、ユーザー役が選択肢つきで答える（答えは質問の文をキーにした辞書）。
12. **状態の決め方**（C3 と同じ言葉）：`completed`（終わりまで動いた）、`incomplete`（URL が出ない・画面が終わらない・誤りで終わった・時間切れ。できていた分を採点する）、`error`（仕組みの側の失敗：プラグインが読み込まれない、MCP サーバーにつながらない、エージェントの定義が使うツールを中心の処理が出していない、メインの実行の例外。採点しない）、`stopped`（利用枠の上限、中断。採点しない。残りの実行は始めない）。
13. **点数**：実行ごとに「合格の基準の数 ÷ 基準の数」（grade.mjs の gradeRun）。あり・なしの点数は、採点した実行の平均。差は、ありからなしを引く。動きの確かめ（`checks`）は点数に入れない。
14. **作業フォルダ**：`runDir/work/` に作り、記録の置き場所（`runDir` の直下）とは分ける。`runDir` の既定は OS の一時フォルダの下（CLI は `--out`）。
15. **サンドボックス**：CLI の既定は有効。bubblewrap と socat がなければ、実際のモデルを使う前に断る。`--no-sandbox` で外せる（結果に警告を残す）。この環境にはどちらもない（D1c も確かめた）ので、試験はサンドボックスなしで動かしている。
16. **環境変数**：試されるエージェントに渡すのは `ENV_ALLOW` だけ。認証が要る環境では `--pass-env NAME,…` で明示する。
17. **出力のフォルダ名**：`inner-runs/`（D1c の outer-inner.mjs が同じ outDir を使うので、`runs/` のような一般的な名前を避けた）。
18. **ユーザー役**：D1c の `createUserRole` を、コマンドラインの入口から使う。`innerEval` 自体は、`userRoleFor(task, arm, n)` が返す関数 `({ question, choices }) => 答えの文字` を受け取るだけ（試験は偽物を渡す）。
19. **画面の作業ごとの設定の欄**（統括の決定どおり。下の節）：ユーザー役が決める。`--setting 鍵=値` は、決めた値を上書きするために残した。

## 画面の設定の欄を決める（統括の決定。D1d の続きの仕事）

生成プラグインの作業ごとの設定の欄は、クリエイターが作るときに決まるので、模擬ユーザーの `inner/eval.json` の `settings.task` の鍵と合わないのが普通である。testing.md 7章の「人と同じ流れ（設定 → 開始 → 監視 → 結果）」に合わせ、ユーザー役が欄を読んで値を決める。

- **いつ**：チャットに画面の URL が出て、画面を開く前（`inner-run.mjs` の `resolveScreenSettings`）。画面を開くツールが呼ばれた後なので、中心の処理の状態の `setup.taskSettings`（見出し・説明・種類・選択肢・必須か・初めの値）が読める。画面に出ている欄と同じ元の値を、画面の描画の前に読む（画面の見た目を読み取らない。画面の欄は `taskSettings` を描くだけなので、同じ内容）。
- **値を使う順**：`--setting 鍵=値`（補い）＞ 課題の `settings.task` に同じ鍵があればそれ ＞ ユーザー役が決めた値。ユーザー役に聞くのは、前の2つにない欄だけ。役割ごとのモデルと繰り返しの上限は、今までどおり試験の仕組み（課題の `settings.maxIterations`、`models` の引数）が決める。
- **聞く文**（`describeSetting`）：欄の見出し・説明・種類・必須か・初めの値・選べるもの、ユーザーが頼んだこと（課題の `prompt`）、渡したファイル（`inputs` の場所と、先頭の最大 3 件・各 800 文字までの中身）。「入れる値だけを答えてください。決められないときは『決まっていません』と答えてください」で終わる。欄ごとに1回聞く。選択の欄は選択肢、チェックの欄は「はい／いいえ」を選択肢として付ける。
- **答えを値にする**（`normalizeSettingAnswer`）：文字と場所は最初の行（「」や引用符、文末の「。」を除く）。数は答えの中の最初の数（全角、コンマも読む）。選択は選択肢に当てる（答えの中に選択肢の言葉があればそれ）。チェックは「いいえ・入れない・オフ」を先に、「はい・入れる・オン」を次に見る。短い答え（40 文字以内）が「決まっていません」「分かりません」「そのまま」「初期値」などなら、決められなかったものとする。
- **決められなかった欄**：値を入れず、画面の初めの値のままにする。必須の欄で値がなければ、画面が開始を断り、実行は `incomplete`（理由に、入れなかった欄の見出しが入る）。ユーザー役の呼び出しが失敗したときは、画面を開始せず、`error`（理由：ユーザー役の呼び出しに失敗しました）にする。
- **記録**：`result.settings`（結果の `inner-result.json` の実行ごとの `settings`、`events.jsonl` の `settings`）に、欄ごとに `{ key, label, type, required, source, value, question, answer, note }`。`source` は `cli`・`eval-json`・`user-role`（ユーザー役が決めた）・`default`（決められず、初めの値のまま。`note` に abstain・not_a_number・no_such_option・unclear）。ユーザー役に聞いたものだけ `question` と `answer` が付く。
- **ユーザー役の関数の形**：`userRole({ question, choices, history, via, meta })`。設定の欄の質問は `via: 'setting'`、`meta: { setting: <鍵> }`。`inner.mjs` の入口は、これを D1c の `role.answer(question, choices, via, meta)` に渡す。D1c の `outer-inner.mjs` の関数は `via` と `meta` を渡していないので、そのままでも動くが、`via`・`meta` を渡すと、ユーザー役の記録に設定の質問と分かる印が付く（D1c への頼み、任意）。
- **ユーザー役の答え方への注意**：D1c のユーザー役の決まりは「選択肢の言葉だけで済ませない」。選択の欄でも、答えの中に選択肢の言葉があれば拾う作りにした。本物のモデルで、値だけを答えるか（長い文で答えて値を取り損なわないか）は、最初の EVAL の記録（`settings` の `answer` と `value`）で確かめる。

## 要確認（本物のモデル・手元の環境でしか確かめられないこと）

1. **本物のモデルでの動き**：入口のスキルが `mcp__<名前>__open` を呼ぶか、URL をチャットに書くか、統括が `run_in_background: false` で作業・検証を呼ぶか、モデルが `Skill` を呼ぶときの名前。この試験は偽のモデルなので見ていない。最初の EVAL（統括がユーザーの承認をとってから）で確かめる。
2. **サンドボックスを有効にしたときの動き**：この環境に bubblewrap・socat がなく、確かめていない。ナレッジ agent-sdk-eval.md のとおり、画面とブラウザーは試験の仕組みの側で動くので影響を受けない見込み。MCP のサーバーも同じプロセスなので影響を受けない見込み。SDK 同梱の本体でサンドボックスが動くか（R4 注 D-1）は未確認。
3. **返事を求めているかの見分け**（`asksForReply`）は、日本語の文末の見分け（「？」と、依頼の言い方の一覧）。本物のモデルの言い回しに合うかは、最初の EVAL の会話の記録で確かめる。外れたときは、一覧を直す。
4. **画面の取り直しの間隔**：screen.mjs は 2 秒ごとに状態を読む。短いフェーズ（作業が数秒で終わるなど）は取りこぼしうる。動きの確かめの `phases-shown`・`worker-shown-running` が、本物の EVAL で短い実行のときに不合格になるかは、最初の EVAL で見る（偽のモデルの試験では、返事を遅らせて拾えるようにした）。
5. **fork のサブエージェント**：Claude Code 2.1.302 から fork が既定でオン（R4 注 D-8）。統括が `subagent_type` を省くか `fork` にすると、fork が動き、`agent_type` が `fork` で届く。そのときの画面の枠・採点への影響は、本物の EVAL で見る（強制では切らない）。
6. **利用枠の上限**：結果の文が `USAGE_LIMIT_ERROR_PREFIXES`（SDK の一覧）で始まるかで見分ける。本物の上限の文は偽の API では出せないので、偽の Agent SDK の応答で試験した。
7. **`AskUserQuestion` の複数選択の答えの形**：ユーザー役の文章をそのまま答えにしている（公式の説明では、ラベルの配列か `, ` でつないだ文字列、自由な答えも可）。本物のモデルが複数選択を使ったときの動きは未確認。
8. **ユーザー役が設定の欄を決める答え方**：上の節の最後のとおり。本物のモデルの答えが、値だけか、文章かを、最初の EVAL の `settings`（`answer`・`value`）で見る。外れが多ければ、`normalizeSettingAnswer` を直すか、質問の終わりの文言を直す。
9. **ブラウザーの手元の Chrome・Edge**：screen.mjs が Chrome、Edge、Chromium の順に試す。この環境は `PLUGIN_TEST_BROWSER_CHANNEL=chromium` で試験した。

## 上位の文書で直すこと

1. **testing.md 4章（Agent SDK 用のつなぎ口の段落）**：
   - 「記録のツールを呼んだエージェントは……結び付け方は要確認である」→ 解けた。フック PreToolUse の `tool_use_id`（と `agent_id`）を覚え、MCP の呼び出しの `_meta['claudecode/toolUseId']` で引く。
   - 「エージェントの終わりが取り消されたものかも、ここから作る。取れるかは要確認」→ 取れない。試験の仕組みが止めたかどうかだけで決める。
   - 「エージェントの定義の `tools` に書いたエクステンションのツール名……を MCP のツール名に置き換える」の補足として、MCP のツールは既定でツール検索の裏に回るので、`_meta['anthropic/alwaysLoad']` を付けて出す（Copilot CLI の `defer: 'never'` に当たる）。
   - 「統括のエージェントの定義（指示とモデル）で、Agent SDK の別の実行を始める」の補足として、`agent: '<プラグイン>:orchestrator'` と、システムプロンプトを `claude_code` のプリセットにすることが要る（既定の最小のシステムプロンプトでは本文が効かない）。
   - `Agent` は既定で裏で動く。統括の本文が `run_in_background: false` を指定することが、設計書 4.8 の「sync で1体ずつ」に当たる。4章の表（カスタムエージェントの行）か、task の引数の扱いの段落に書く。
2. **BLUEPRINT 3.1 / generated-plugin-structure.md 3.2 の中立のイベント**：`agent.started` の `model` は、Agent SDK では始まりの時点で分からない（実際のモデルは最初の assistant メッセージで分かる）ので、始まりに `model` を付けず、`agent.configured` で届ける。Copilot CLI の `subagent.started` には `model` が付く。core は `model` がなくても動く（確かめた）が、設計書に「始まりの `model` は省かれることがある」と書く。
3. **生成プラグインの adapter.mjs**：`describeOpened`（画面を開くツールの返り値の文）を export するか、core/tools.mjs に移すと、内側の EVAL のつなぎ口が写さずに済む（今は inner-adapter.mjs に同じ形を写した。二重管理になる）。
4. **C3 の screen.mjs（A2 の画面の欄の id の決まりも）**：画面で選ぶモデルの欄（`#setting-model-<役割>`）を操作する窓口が screen.mjs にない。今は `settings.task` に `model-<役割>` を足して渡している（欄の id の規則に頼る）。`operate({ settings: { models } })` を足すと、規則に頼らずに済む。
5. **D1b の FORMAT.md 3章 / testing.md 7章**：統括の決定で、作業ごとの設定の欄はユーザー役が決めることにした（上の「画面の設定の欄を決める」）。FORMAT.md 3章に「`inner/eval.json` の `settings.task` は、生成プラグインの設定の欄の鍵と合うときだけ使う。ふつうは書かない。欄の値はユーザー役が、頼みの文と入力のファイルとナレッジから決める」と足す。testing.md 7章にも、設定の値をユーザー役が決めることを足す。
6. **creator-structure.md 2章の部品の表**：R4 が挙げたとおり、開発の試験の部品（変換スクリプト、EVAL の実行の仕組み〔内側：tests/dev-eval/runner/inner*.mjs と共通の部品〕、模擬ユーザー、ユーザー役の試験）の行がない。追跡のため足す。
7. **testing.md 11.1**：Agent SDK の版を 0.3.307 から 0.3.310（Claude Code 2.1.310）に上げた。npm の最新で、手元の `claude` も 2.1.310。peer の `@anthropic-ai/sdk`・`@modelcontextprotocol/sdk`・`zod` も固定が要る。
8. **ナレッジ agent-sdk-eval.md**：上の「確かめて分かったこと」のうち、MCP のツールの `alwaysLoad`、`agent` とシステムプロンプトのプリセット、`Agent` の既定が裏であること、`run_in_background: false`、`claudecode/toolUseId` を足す価値がある（ナレッジの追加は PR の前に統括がユーザーに提案する。CLAUDE.md 7章）。

## 憲章の確かめ

作業の終わりに、クリエイター憲章（版 0.25.0）を通して読んだ。反する点はない。
- 第5条3項（最新の公式の情報にもとづく）：Agent SDK は npm の最新 0.3.310 に上げ、動かして確かめた（古い版の情報は R4 の 0.3.307 で、版と時点を書いた）。
- 第6条3項（要件の追跡）：試験の名前に、確かめる要件の番号（REQ-005 など）を入れた。開発の試験の仕組みに固有のもの（共通の部品など）は testing.md の章を入れた。
- 第9条（分かりやすさ）：画面に出る文、結果の理由は平易な日本語にした。
- 第10条（KISS）：生成プラグインにも C3 の screen.mjs・grade.mjs にも手を入れず、薄いつなぎ口だけを足した。使っていない export は消した。

## 変異試験（わざと壊す検査）

D1d の本体と共通の部品の 28 か所を1つずつ壊した写し（tests/dev-eval/runner-mut/ に写して動かし、終わりに消した）を、関係する試験にかけた。壊す箇所：ツールの拒み、ツール名の戻し、モデルの書き換え、取り消しのイベント、query の閉じ、親の結び付け、実行のしかた、呼んだエージェントの結び付け、利用枠の上限、実際のモデルの名前、先に届いたモデル、返事を求めているかの見分け、URL が出た後の返事、プラグインが読み込まれたかの確かめ、なしにプラグインを渡さないこと、返事の上限、インストラクションの追加、点数の差の向き、利用枠の上限で止まった後の扱い、採点しない実行を平均に入れないこと、判定の誤りの印、判定に道具を渡さないこと、alwaysLoad、ハンドラーの例外、設定を読ませないこと、作業フォルダの外への書き込み、環境変数の絞り込み、表にないモデル。
- 最初は 23 か所を試験が見つけ、5 か所を見逃した（親の結び付け：統括が親でない場合、先に届いたモデルの反映、URL が出た後の返事、インストラクションの追加、判定の誤りの印）。見逃した分に試験を足して、28 か所すべて見つけられるようになった。
- 続きの仕事（設定の欄をユーザー役が決める）の分は、別に 15 か所（値を使う順、決められない答えの扱い、チェックの読み方、聞く文に入れるもの、記録、ユーザー役の失敗、via の受け渡しなど）を壊した。2 か所を見逃したので、試験を足した（チェックの「いいえ」を先に見ること、ユーザー役の関数の via の受け渡し）。また 1 か所は、選択肢の完全一致の分岐が、そのあとの「答えの中の選択肢の言葉」の分岐と同じ結果になる無駄だったので、分岐を消した。
