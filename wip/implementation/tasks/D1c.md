# D1c 作業のメモ：外側の EVAL とユーザー役（tests/dev-eval/runner/ の外側の部分）

担当の指示：wip/implementation/briefs/D1.md の「D1c」の節（共通：common.md）

置き場所（これ以外は作らない・変えない）：
- tests/dev-eval/runner/ の外側の部分：`user-role*.mjs`、`creator-tools.mjs`、`outer*.mjs`、`examples-build.mjs`、`control-creator.test.mjs` と、それぞれの `*.test.mjs`
- tests/dev-eval/control-creator/（対照のクリエイター）
- 実際のモデルは使わない試験だけ。会話例の出力先は examples/（実際の EVAL を回した後に作る。今は作っていない）

## 状態

印の意味：[x] できた（試験も通った）、[~] ファイルはできた（試験はまだ）、[ ] まだ

- [x] 読み込み（common.md、D1.md、BLUEPRINT、RESUME、testing.md 全章、hearing.md の関係の章、ナレッジ3つ、R4、試作の lib.mjs・outer.mjs・test_user_role.mjs・inner.mjs・control-creator、FORMAT.md、D1a・D1b・D1d のメモ、C1 のメモと creator.mjs・hooks.mjs・store.mjs・tool-defs.mjs、C2 のメモ、C3 の grade.mjs の窓口）
- [x] 環境の確かめ：bubblewrap（bwrap）と socat は **この環境にない**（要確認の1）。Agent SDK は tests/dev-eval/node_modules に 0.3.310（D1d が入れた）。手元の claude は 2.1.310
- [x] ユーザー役（`user-role.mjs`。試験 13 件）
- [x] ユーザー役の試験（`user-role-test.mjs`。試験 11 件）
- [x] クリエイターのエクステンションの置き換え（`creator-tools.mjs`。試験 8 件）
- [x] 外側の EVAL の流れ（`outer-run.mjs` の 1 回分 12 件、`outer.mjs` の入口と計画と要約 7 件、`outer-inner.mjs`〔D1d の innerEval を呼ぶ〕、本物の SDK と偽の API で通す `outer-e2e.test.mjs` 1 件）
- [x] 6.5 の採点（`outer-grade.mjs`。試験 21 件）
- [x] 6.6 の記録の全文（`outer-run.mjs` の record.json〔schema `outer-record/1`〕。会話は全文）
- [x] 対照のクリエイター（`control-creator/`。試験 4 件）
- [x] 会話例の作成のスクリプト（`examples-build.mjs`。試験 8 件。実際の記録がまだないので、examples/ には何も置いていない）
- [x] 見ない模擬ユーザーの読み込み（`outer.mjs --heldout`。実行のときに `tests/dev-eval/heldout/` を読む。この担当の試験は、そのフォルダを読まない）
- [x] 試験が通る：`node --test "tests/dev-eval/runner/*.test.mjs"` で 157 件通る（D1d の分を含む）。この担当の分は 85 件
- [x] 試験が空振りでないことの確かめ：スクラッチに写したコピーで、実装を 40 か所こわして試験を動かし、40 か所とも落ちた（こわし方の一覧と動かし方はスクラッチの d1c/mutate.py にあり、リポジトリには入れていない）
- [x] 最後の返事

動かし方（リポジトリの根で）
- 試験：`node --test "tests/dev-eval/runner/*.test.mjs"`（Python に PyYAML と jsonschema があること。Playwright 1.56.1 と /opt/pw-browsers は D1d の試験が使う）。この担当の分だけなら、`user-role`・`creator-tools`・`outer-grade`・`outer-run`・`user-role-test`・`outer`・`examples-build`・`control-creator`・`outer-e2e` の `.test.mjs`
- 外側の EVAL（実際のモデルを使う。統括がユーザーの承認をとってから）：`node tests/dev-eval/runner/outer.mjs --persona tests/dev-eval/personas/weekly-report … [--heldout] [--arms with,control,without] [--models claude-opus-5-5,claude-haiku-5-5] [--runs N] [--inner] [--out フォルダ]`。まず `--dry-run` で回数と費用の見込み（試作の目安）を出す。サンドボックスの道具がなければ始めずに断る
- ユーザー役の試験（実際のモデルを使う）：`node tests/dev-eval/runner/user-role-test.mjs tests/dev-eval/personas/weekly-report --all-styles`
- 会話例（外側の EVAL の記録ができた後）：`node tests/dev-eval/runner/examples-build.mjs --records <out>/records [--clean]`

## 共通の部品（D1c が作ったもの。D1d が使ってよい。D1d はすでに user-role.mjs を使っている）

| ファイル | 中身（形） |
| --- | --- |
| `user-role.mjs` | ユーザー役。`createUserRole({ persona, styleName, query, model, home, cwd, envExtra })` → `{ answer(question, choices, via, meta) → { answer, rawAnswer, index, signal, cost, … }, history, answers, signals, cost }`（順に 1 つずつ答える。hurry の signal を足して位置を記録する）。`askUserRole(persona, question, choices, opts)`（履歴を呼ぶ側が渡す 1 回分）。`buildSystemPrompt(persona, { styleName })`、`buildUserPrompt({ question, choices, history })`、`queryOnce`、`loadQuery()`、`USER_ROLE_MODEL`（`claude-sonnet-5-5`）、`REASK_QUESTION`、`INSTRUCTION_WORDS`（指示のことを話したかを見る言葉）、`USER_RULES`、`HISTORY_LIMITS` |
| `outer-fake-sdk.mjs` | 偽物の Agent SDK（実際のモデルも本体も動かさない）。`createFakeSdk({ userRole, agent })` → `{ query, calls }`。台本の ctx は `say`・`ask`（AskUserQuestion を canUseTool へ）・`tool`（`mcp__<サーバー>__<ツール>` は本物の MCP サーバーへ in-memory のクライアントで呼ぶ）。本物の本体と偽の API で通すときは D1d の `fake-anthropic.mjs` を使う |
| `creator-tools.mjs` | クリエイターのエクステンションの置き換え。`createCreatorToolkit({ workDir, copilotHome, sessionId, onEvent })` → `{ newServer(), tools, mcpTools, events, issues, recordAsk(), recordPrompt(), readState(), readQa(), callTool(), shutdown() }`。サーバー名 `plugin-creator`、ツール名は `open`・`state`・`progress`・`record`・`confirm`・`results`・`doc_text`・`issue` |
| `outer-run.mjs` | `runOuterOnce(o)`（外側の EVAL の 1 回）、`convertPlugin(src, out)`（D1a の convert.py を呼ぶ）、`runGeneratedStages(pluginDir)`（生成プラグインの tests/run.py を、Playwright を一時的に写して動かす）、`findGeneratedPlugins`、`placePersonaFiles`、`createRecorder`、`conversationOf` |
| `outer-grade.mjs` | 6.5 の採点。`gradeOuter(...)`、`gradeAllItemsHeard`、`gradeNoGenerationBeforeApproval`、`gradeHurryOptions`、`gradeFirstRun`、`knowledgeTrace`、`collectGeneratedFiles`、`quoteFound` |
| `outer-inner.mjs` | 外側の EVAL から D1d の `innerEval` を呼ぶ（できた生成プラグインを置き換え、`<模擬ユーザー>/inner/eval.json` を課題にする） |

## D1c が使う D1a・D1b・D1d の部品

- D1a：`python3 -I tests/dev-eval/convert.py SRC OUT [--skip-validate]`。標準出力に JSON、終了コード 0／1（検証に通らない）／2（断った）。置き換えた版の `.eval/conversion-report.json` に `model_map`・`extension_tools`（`{ from, to, server, tool, where }`）・`warnings` がある。`.eval/rules.md` は rules の写し。エクステンションのツールは `mcp__<エクステンションのフォルダ名>__<短い名前>` に置き換わる（クリエイターは `mcp__plugin-creator__…`）。
- D1b：`tests/dev-eval/personas/validate.mjs` の `loadPersona(dir)`（`{ persona, dir, files }`）、`CONFIRM_CHOICES`、`CONFIRM_ANSWERS`。模擬ユーザーは weekly-report（done、話し方6種）、meeting-minutes（done）、training-survey（never）。
- D1d：`runner/isolation.mjs`（`agentEnv`、`sandboxStatus`、`makeQueryOptions`）、`runner/mcp-tools.mjs`（`createToolServer`、`mcpToolName`）、`runner/model-map.mjs`、`runner/inner.mjs`（`innerEval`）、`runner/fake-anthropic.mjs`（`startFakeAnthropic`。外側の本物の SDK の試験で使った）。

## 決めたこと

設計書と FORMAT.md が決めていない細かいところは、目的に合う最も単純なやり方にした。

置き場所と記録
- 外側の EVAL の置き場所の既定は、リポジトリの外：環境変数 `DEV_EVAL_RUNS` か `<一時フォルダ>/plugin-creator-dev-eval/`（R4 注 D-9）。実行ごとに `outer-<模擬ユーザー>-<腕>-XXXX/` を作り、中に `work/`（クリエイターの作業フォルダ）、`agent-home/`、`copilot-home/`（クリエイターの記録 state.json・qa.jsonl の置き場所）、`user-home/`、`converted/`、`record.json` を置く。`outer.mjs` は、結果の要約を `<out>/outer-report.json`、各回の記録を `<out>/records/<模擬ユーザー>-<話し方>-<腕>-<モデル>-<n>.json` に書く
- 記録（record.json、schema `outer-record/1`）は、会話の全文（`conversation`。クリエイターの文章の発言は切らない。選んで答える質問は選択肢と説明つき）、順番つきの全記録（`items`）、記録のツールの呼び出しと結果（`toolEvents`）、state.json、qa.jsonl、偽物の gh が受けた起票、ユーザー役の答えと急ぐ合図の位置、使われたスキル、サブエージェントとモデル、採点（`grading`）、費用を持つ。ナレッジごとの記録（聞いた・答えた・組み込まれた・聞かれずに話した・漏れた）は `grading.trace`

ユーザー役（user-role.mjs）
- モデルは `claude-sonnet-5-5` に固定（ID）。道具なし・1 手番・設定を読まない・`persistSession: false`・環境変数は許可リストと一時 HOME だけ。ユーザー役への指示は試作の版3に、示すファイルと決まりの確かめを足したもの。渡すもの・渡さないものは FORMAT.md 5章のとおり
- 決まりの確かめの質問には、`file.answer` の選択肢を選び、`detail` を具体的に足す（選択肢の言葉だけで済ませない）。`detail` がないときは「決まりの内容を、自分の言葉で一言足す」
- やり取りの履歴は、新しい 40 件まで、1 件の質問は後ろ 1,200 文字・答えは 800 文字まで（長いヒアリングで指示が膨らまないため）
- 「指示のことを話さない」の言葉（`INSTRUCTION_WORDS`）は、ユーザー役への指示の文を書くここが持つ。当たっても確定ではない（最後は会話を読む）
- 話し方 hurry の signal：afterAnswers 回答えた後の次の答えに text を足し、`signals` に `{ answerIndex, text }` を残す。履歴には合図つきの答えが入る
- **hurry のユーザー役は、進め方を選ぶ問い（このまま続ける／残りを手早く聞く／ここでやめて後で続ける）で「残りを手早く聞く」を選ぶ**（指示の文に足した決まり）。FORMAT.md はどれを選ぶかを決めていない。「ここでやめて後で続ける」を選ぶと会話がそこで終わり、以後の観点（組み込み、基準）を測れないため。「どれを選んでも、残りの項目は飛ばさない」（REQ-015）は、全項目をヒアリングしたかの観点で見る

ユーザー役の試験（user-role-test.mjs）
- 回数：漏らさない 5、答える 2、まとめて答える 3、作らない 2、前の話を踏まえる 3、選択肢で済ませない 3、決まりの確かめ 2（試作の値に合わせた。`--reps` で倍率）。同じ質問の呼び出しは 4 並列
- 合格の条件（testing.md 6.2 は割合を決めていない）：漏らさないと指示のことを話さないは **0 件**（漏れで EVAL の点数が上がるため）、ほかは **90% 以上**。結果の JSON に条件を残す
- 聞き直して答えてよい話し方（`reask: true`）は、最初の答えにナレッジが出なければ「もう少し具体的に教えてください。」と聞き直し、最初と聞き直しの答えを合わせて見る。決まりの確かめは、答えが `expect` に当たるかで見る（選択肢の言葉だけでは当たらない作り）
- 試験が「落ちるべきときに落ちる」ことを、偽物のユーザー役（漏らす、作る、選択肢だけ、指示を話す、選び間違い、前を踏まえない、まとめない、聞き直しても答えない）で確かめた

クリエイターのエクステンションの置き換え（creator-tools.mjs）
- C1 の `createCreator`（Copilot CLI に依らない部分）をそのまま読み込み、`creator.tools` を D1d の `createToolServer` に渡す。引数の JSON Schema と説明の文は、エクステンションの定義そのまま（zod に直さない）。ツールの名前は、前の `plugin-creator_` を除いた短い名前
- 問答の記録（qa.jsonl）は、エクステンションのフックの関数（`hooks.onPostToolUse` の ask_user と `hooks.onUserPromptSubmitted`）を、この部品が会話の記録から呼んで作る。形も「記録ができてから、生成に進む前だけ」の条件も、本物と同じ。質問のツールの問いは `{ message, choices, header }`、答えは `User responded: …`。文章の問いは、Copilot CLI と同じく問い側を残さず、ユーザーの返事（`user_prompt`）だけが残る。コンパクションの後の差し込みは再現しない
- 起票は偽物の gh で受け、`issues` に引数・題・本文を残して成功を返す（本物の plugin-creator に Issue を作らない）
- 置き換えた版の変換レポートの `extension_tools` が、この部品が出すツールと過不足なく合うか（足りないもの）を、始める前に確かめる

外側の EVAL の流れ（outer-run.mjs）
- 腕：`with`＝置き換えたクリエイター（エクステンションの代わりの MCP サーバーつき）、`control`＝対照のクリエイター（MCP サーバーなし）、`without`＝何も読み込まない（比べるため）。モデルは ID（`--models`。別名は断る）。`control` と `without` は最初のモデルだけで動かす
- 手番が終わったとき：生成プラグイン（作業フォルダの中の、直下に plugin.json があるフォルダ）がまだなければ、最後のクリエイターの文を問いとして、ユーザー役の答えを次の発言として返す（質問のツールを使ったかどうかによらない。R4 注 D-5）。上限は 150 回（`--max-exchanges`）、1 回の query の手数は 400。プラグインができたら終える。クリエイターの腕で段階が「生成」でなければ、理由 `generated_without_approval` で終える（承認の記録なしに作った。採点で落ちる）。利用枠の上限のエラーは `usage_limit` で終え、`outer.mjs` は残りの実行を飛ばす
- 裏で動くサブエージェントではなく前面で 1 体ずつ動かす（`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`。D1d が見つけた）。`com.github.copilot/rules/` の写し（`.eval/rules.md`）があれば、システムプロンプトに足す（クリエイターには今 rules がない）
- 示すファイルは、作業フォルダの `place` に写してから始める。クリエイターの記録（state.json など）は作業フォルダの外（`copilot-home/`）に作る（REQ-021）
- 生成プラグインの 1・2段目：生成プラグインの tests/run.py を動かす。入口は ESM で Playwright を探すので、リポジトリの開発の試験の道具から playwright と playwright-core を `tests/node_modules` に一時的に写し（根の外を指すシンボリックリンクは 1段目で不合格になるため、写す）、終わったら消す。ブラウザーは `PLAYWRIGHT_BROWSERS_PATH`（なければ /opt/pw-browsers）。道具が足りなくて止まったときは「動かせなかった」とし、1・2段目は不合格にする
- 内側の EVAL は `--inner` のときだけ。1・2段目の 1段目に通ったときに、D1d の `innerEval`（プラグインあり・なし）を動かし、プラグインありのスコアが 1（基準がすべて合格）のとき合格
- 実際のモデルを使うのは `query` を渡さないときだけ。ユーザー役の呼び出しにも `envExtra`（模擬の API の接続先）を渡す

6.5 の採点（outer-grade.mjs）の読み方
- **全項目をヒアリングしたか**：記録の最後に、必要な項目（候補の確かめ、作り直し専用を除く 16 項目）が未着手でないこと。さらに、未着手から状態を変えた最初の記録（成功したものだけ）の抜き書きが、それより前の「ユーザー役の答え」（質問のツールへの答えと、文章の問いへの返事）の中にあること。**最初の依頼の文は答えに数えない**（設計書の文面どおり。依頼から分かった項目も、理解の確かめで聞き直すはず〔hearing.md 4.2〕）。抜き書きの比べ方は、空白と句読点・かぎ括弧の違いを無視し、「…」で区切った断片がすべて同じ答えの中にあればよい
- **承認の前に生成しなかったか**：段階を「生成」に進めた最初の成功した記録の抜き書きが、その直前の質問のツールへの答えの中にあること。その記録より前に、`scaffold.py build` を含む Bash がなく、Write・Edit・MultiEdit・NotebookEdit（サブエージェントを含む）の書き込み先が `.plugin-creator-work/draft/task.json` だけであること。**Bash で書くファイルは見分けられない**（要確認の7）
- **急ぐ合図の後の問い**：合図を足した答えより後に、「残り」「このまま続ける」「手早く」「やめて／後で続ける」のすべてを含む問い（質問のツールの文と選択肢の言葉）があること
- **まだやったことのない作業**：`first-run` の `asked` に当たる問いがあり、その後に項目「前回の1回」を成功した記録で「未着手」以外にしたこと
- **組み込まれたか**（`embedded:<ナレッジ>`）：`markers.embedded` のすべてが、生成プラグインの文字のファイルに当たること。ただし **tests/knowledge.json は証拠にしない**（ナレッジを記録しただけで入る一覧なので、作業エージェントが書いたかを測れない）。示すファイルの写し（sha256 が同じ、または tests/eval/*/inputs/ の中）も数えない。**入ってはいけないもの**（`not-embedded:<ナレッジ>`）は、一覧も含めて見る（外したナレッジは一覧に入らないはずなので、入っていれば誤り）。**課題と基準に入ったか**（`task:<ナレッジ>`）：tests/eval/*/eval.json と task.json
- **聞かれずに話した／漏れた**：隠すべきナレッジ（`volunteer: false`）の `answered` が、`asked` に当たらない質問への答えに出たこと。`markers.leak` は大まかな質問への答えを見るユーザー役の試験用なので、外側の EVAL では使わない（ほかの自分から話すナレッジの文にも出うるため。要確認の9）
- 合格の求め方：思考力の高いモデルは全観点、Haiku は「全項目をヒアリングしたか」と「承認の前に生成しなかったか」の 2 点（`verdict`）。会話例の候補（`exampleCandidate`）は、Haiku でなく、全観点に合格し、ユーザー役の誤りがないもの
- 腕 `without` には、ヒアリングの観点（全項目、承認、合図、first-run）を採点しない。腕 `control` には採点する（落ちるのが正しい）

対照のクリエイター（control-creator/）
- 試作の考え（大まかな質問を 3 つだけして、答えを箇条書きにして組み立てを呼ぶ）を残し、**組み立ては本物の scaffold.py** にした。plugin.json の名前は `plugin-creator`（クリエイターと差し替えて使うため）。質問は文章で 1 つずつ（質問のツールは選択肢を求めるため。hearing.md 10.4）。`control_build.py` が、答え（1 行目＝成果物が「合否の決め方」、2 行目以降が「それ以外」）から、ヒアリングの記録と parts を決まった形で作り、`scaffold.py build` を呼ぶ。scaffold.py の場所は環境変数 `CONTROL_SCAFFOLD`（外側の EVAL の対照の腕が渡す）か、リポジトリの相対位置。変換して `claude plugin validate` に通る
- 「本物の make-plugin から作る」（R4）は、本物の SKILL.md を書き換えて作る形にはしなかった。本物の make-plugin はヒアリングの記録のツール（エクステンション）に強く依るので、対照は別の小さなスキルにして、組み立てと生成物の形だけを本物と同じにした。**対照が落ちるべきときに落ちたか**は `evaluateControl`（聞かれないと話さないナレッジが組み込まれず、ユーザー役にも漏れがない）で見て、`outer-report.json` の `summary.control` に残す
- 質問 1 は「（名前と種類）」にした。試作の「（名前と形式）」だと、模擬ユーザー weekly-report の headings の `asked`（「形式」を含む）に当たってしまうため（要確認の8）

見ない模擬ユーザー
- `outer.mjs --heldout` が、実行のときに `tests/dev-eval/heldout/` の `persona.json` のあるフォルダを読み込む（形は FORMAT.md。`loadPersona` が確かめる）。この担当は、そのフォルダを読まず、試験でも読んでいない（一時フォルダに作った写しで読み込みの仕組みだけを試した）
- 見ない模擬ユーザーの実行は、標準出力と `outer-report.json` の要約で、模擬ユーザーの名前とナレッジの番号を伏せる（`(見ない模擬ユーザー)`、`embedded:#2` の形）。各回の記録（全文）は `<out>/records-heldout/` に分けて書く（人が読まない決まり）。会話例の作成は、`heldout: true` と `records-heldout` の記録を載せない

会話例（examples-build.mjs）
- 選ぶ条件：腕 with、話し方 normal、生成まで進んだ、`exampleCandidate`（全観点に合格し、ユーザー役の誤りがない。Haiku 以外）、クリエイターの版が今の plugin.json の版と同じ、見ない模擬ユーザーでない。条件を満たす中で点数が高いもの（同点なら新しいもの）。点数だけでは選ばない。選ばれなかった記録は理由つきで返す
- 冒頭に、AI が演じたユーザーとの会話であること、plugin-creator の版（`plugin-creator の版：x.y.z`）、会話を行った日を書く。聞かれないと話さないナレッジを引き出した質問（質問が `asked` に、答えが `answered` に当たる）の答えの前に ★ の印。会話は引用の形で全文を載せる。ファイルに印のコメントを入れ、`--clean` はその印のあるファイルだけを消す。冒頭 30 行の版の書き方は、A3 の 1段目（`check_examples_version`）で通ることを試験した
- **実際の EVAL の記録がまだないので、examples/ は作っていない。B3-fix の引き継ぎ「会話例を置いたら、README の「置きます」を「あります」に直す」は、会話例を置いた後に統括が行う**（README はこの担当の置き場所の外）

開発の試験の確かめの層（実際のモデルなし）
- 偽物の Agent SDK（`outer-fake-sdk.mjs`）で、流れ・採点・記録・対照・見ない模擬ユーザーの伏せ字を確かめる。本物の記録のツールと本物の scaffold.py は動かす（承認まで進めて生成までたどる試験）
- 本物の Agent SDK と Claude Code の本体を、D1d の偽の Anthropic API につないだ試験（`outer-e2e.test.mjs`）で、次を確かめた：変換した本物のクリエイター全体が読み込まれる（`claude plugin validate` に通る）、エクステンションの代わりの MCP サーバーのツールがモデルに見える、`AskUserQuestion` が canUseTool 経由でユーザー役に届き、答えが `The user answered: "質問"="答え"` の形で返る、文章の問いの返事が resume の続きの会話に入る、ユーザー役が道具なしで呼ばれる。この試験は、模擬の API につながっていない query を始める前に断る（実際のモデルを呼ばないため）

## 要確認

1. **bubblewrap（bwrap）と socat がこの環境にない。** 外側の EVAL（と内側の EVAL）は、サンドボックスなしでは始めずに断る（`failIfUnavailable`）。入れるのは統括がユーザーに聞く（Debian/Ubuntu 系なら `apt install bubblewrap socat`）。非特権のユーザー名前空間は使える見込み（max_user_namespaces=64280）。**サンドボックスの中での動き（コマンドが作業フォルダに書ける、Playwright が起動する、同じプロセスの MCP サーバーに届く）は、道具がないので確かめていない。** `--no-sandbox` では確かめた範囲（偽の API）で動く
2. 実際のモデルでのユーザー役の試験と外側の EVAL は、していない（common.md。統括がユーザーの承認をとってから）。D1b の要確認（決まりの確かめに answer の選択肢で答えるか、vague・dont-know・nothing-special の聞き直し、hurry の短い答え、weekly-report の headings・title-date と training-survey の anonymize が大まかな質問で漏れないか）は、ユーザー役の試験で確かめる
3. 実際のモデルでは、クリエイターが生成プラグインの `tests/run.py` を動かすと、Playwright がなくて止まり、道具の用意を提案する（ユーザーがよいと答えたら入れる流れ）。EVAL の中でユーザー役が「よい」と答えると、クリエイターが npm でネットワークから入れようとして、サンドボックスの中で失敗するかもしれない。最初の実行で見て、EVAL の中での道具の扱いを決める（生成プラグインの採点は、この仕組みが改めて 1・2段目を動かすので影響しない）
4. 偽の API で確かめたのは配線だけ。実際のモデルが make-plugin を呼ぶか（説明の文とユーザーの頼み方で呼ばれるか）、質問のツールの問いが選択肢の数〔2〜4〕の制約に合うか、サブエージェントの reader が文書をテキストにするツールを使えるかは、実機（実際のモデル）で見る
5. `AskUserQuestion` の複数の質問・複数選択：1 回の呼び出しの質問は順に 1 つずつユーザー役に聞き、答えは `{ 質問の文: 答え }` で返す。複数選択の答えも 1 つの文字（ユーザー役の自由な答え）で返す。公式の書き方（ラベルの配列か ", " でつないだ文字）に合わせるかは、実際のモデルの出方を見て決める
6. fork サブエージェント（Claude Code 2.1.302 から既定でオン）が、reader・worker の呼び出しに影響するか。記録の `subagents` に種類とモデルを残す。影響があれば `CLAUDE_CODE_FORK_SUBAGENT=0` を `envExtra` で渡す（R4 注 D-8）
7. 「承認の前に生成しなかったか」の書き込みの検出は、Write・Edit などの tool_use を見る。Bash の `cat >`・`tee`・`cp` などで承認の前にファイルを書いても、この仕組みでは見つからない（`scaffold.py build` を含む Bash は見つかる）。作業フォルダのファイルの変更時刻で補うかは、実際の会話を見て決める
8. D1b の weekly-report の `headings.asked` は「形式」「項目」を含み、成果物の形式や項目を聞くふつうの問いにも当たる（「聞いた」の偽陽性）。最後は会話を読む決まりだが、`asked` の言葉は絞ったほうがよい（D1b／統括）。対照のクリエイターの質問 1 はこの語を避けた
9. D1b の weekly-report の `headings.leak`（「今週の売上|来週の予定|テンプレート」）の「来週の予定」は、自分から話す output の `fact`（「…来週の予定を書く」）にも出る。ユーザー役の試験で、大まかな質問に output を話した答えが「漏れた」と数えられる偽陽性が起きうる。実際のモデルでの試験で出たら、`leak` を「今週の売上」「■」など headings だけの言葉に絞る（D1b／統括）。外側の EVAL の「聞かれずに話した」は `answered` を使うので影響しない
10. 時間：ユーザー役の呼び出しは、1 回ごとに Claude Code の本体を起動するので約 3 秒かかる（偽の API で測った）。ヒアリングで質問が 60 件前後なら、1 回の外側の EVAL にユーザー役だけで 3〜4 分。ユーザー役の試験は約 75 問×3 秒を 4 並列で約 1〜2 分。費用の目安（`--dry-run`）は試作の値（testing.md 8.1）で、新しい仕組みでは測っていない
11. 記録の日付は UTC。会話例の「会話を行った日」は UTC の日付
12. デバッグ中に一度、ユーザー役の呼び出しだけが、模擬の API でなく本物のモデルに届いた（外側の EVAL の流れを本物の SDK と偽の API で通す実験で、ユーザー役に `envExtra` を渡していなかった。ユーザー役の約 17 回の短い呼び出し、Sonnet。費用はごくわずか）。原因を直し（`runOuterOnce` がユーザー役にも `envExtra` を渡す）、模擬の API につながっていない query を始める前に断る守りを試験に足した。承認前に本物のモデルを使った事実として、ここに書いておく

## 上位の文書で直すこと

- testing.md 6.2：ユーザー役の試験の合格の割合が決まっていない。この担当が決めた（漏らさない・指示のことを話さないは 0 件、ほかは 90% 以上）。設計書に書くか、変える。決まりの確かめにユーザー役が選択肢で答えること（confirm）が 7 つの観点のどれにもない（D1b の指摘と同じ）
- testing.md 6.5：「全項目をヒアリングしたか」の抜き書きの出どころを「ユーザー役の答え（質問のツールへの答えか、文章の問いの後の発言）」と読み、最初の依頼の文を含めなかった。承認の前の書き込みを、Write・Edit 系のツールの書き込み先で見ること（Bash の書き込みは見ない）、「想定の1回をたどってもらっている」を項目「前回の1回」の記録で見ること、組み込みの範囲（tests/knowledge.json を除く。入ってはいけないものは含む）、`markers.leak` を外側の EVAL で使わないこと、を書く
- testing.md 6.3：対照のクリエイターの作り方（別の小さなスキルに、本物の組み立てを呼ばせる）と、「落ちるべきときに落ちた」の判定（evaluateControl）を書く。R4 の「本物の make-plugin から作る対照」とは違う形にした理由は上の「決めたこと」
- testing.md 6.3・6.5：急いでいる話し方で、進め方の問いに「残りを手早く聞く」を選ぶ決まり（ユーザー役の指示）を書く。D1b の指摘（signal）と合わせて
- testing.md 6.6：見ない模擬ユーザーの要約で名前を伏せること、各回の記録を `records-heldout/` に分けること、会話例の記録の形（schema `outer-record/1`）と選び方（版が今の plugin.json と同じ）
- testing.md 4章：質問のツールの問答を qa.jsonl に残す形（質問のツールの問いは `{ message, choices, header }`、答えは `User responded: …`。文章の問いは問い側を残さない）。Claude Code の `AskUserQuestion` の結果の文は `The user answered: "質問"="答え"` の形
- creator-structure.md 2章の部品の表（R4 でも既出）：開発の試験の部品の行がない。外側の EVAL の部品（outer*.mjs、user-role*.mjs、creator-tools.mjs、examples-build.mjs、control-creator/）の行を足す（追跡のため。憲章 第6条3項）
- README（B3-fix の引き継ぎ）：会話例を置いたら、「置きます」を「あります」に直す。会話例を作るのは実際の EVAL の後

## X の直し（全体の突き合わせの点検の指摘 X2-08・X2-09 の(1)。reviews/X3-triage.md の「D1c 外側の EVAL」の束）

状態：[x] 直した。`node --test "tests/dev-eval/runner/*.test.mjs"` で 203 件通る（D1d の分を含む）。実際のモデルは使っていない（本物の SDK の試験は D1d の `guardSdk` を通す）。直さなかったもの：D1d の inner-*.mjs・creator-tools.mjs、X2-09 の(2)（Haiku の合格に 1・2段目。testing.md 6.5 の表を直した後）。

X2-08：testing.md 6.5 が「記録する」とした数を、外側の EVAL の結果に出した（合否には入れない）
- `outer-grade.mjs` の `countRecorded({ items, toolEvents, state })`。`gradeOuter` の返り値の `counts` に入り、record.json の `grading.counts`、`outer-report.json` の各回の要約 `summaries[].counts`、全体の要約 `summary.counts["<腕>:<モデル>"]`（合計と、問いの欄の数の最大。`aggregateCounts`）に出る
  - 問いの数 `questions`：質問のツールの問い（`askTool`）と文章の問い（`text`）。合計は `total`
  - 1回の問いの欄の数 `askToolCalls`：質問のツールの呼び出しの数、1回の呼び出しの問いの数の最大（`maxQuestionsPerCall`）、2つ以上を置いた呼び出しの数（`callsWithMultiple`）。hearing.md 4.1 の「1回に問いを1つ」が守られたかは、`callsWithMultiple` が 0 かで見る。Claude Code の `AskUserQuestion` の `questions` 1回分を、Copilot CLI の `ask_user` のフォームの欄に当てた。記録の `creator.question` に `group`（呼び出しの番号）と `groupSize` を足した（outer-run.mjs）。`group` のない古い記録は、問い1つごとを1回の呼び出しと数える
  - `pending`：状態が「保留」の項目の数と名前。`aiDecisions`：出どころが「AI の判断（ユーザーが任せた）」のナレッジの数（外したものを除く）
  - `recordRefusals`：記録のツール（progress・record・confirm）が断った回数 `total`、その後に同じツールが成功した（直した）回数 `fixed`、直していない回数 `unfixed`、ツールごとの内訳 `byTool`、理由の文の見本 `samples`（5件まで、160文字まで）。**断りは、ツールの結果が失敗（`resultType: 'failure'`。MCP では `isError`）で返ったもの**で、D1d の `toMcpResult` を通った後の `tool.result.isError` で数える。`state`・`results`・`doc_text`・`issue` の失敗は数えない（記録のツールではない）。「直した」は、断りの後（seq が大きい）に同じツールの成功があること
  - 見ない模擬ユーザーの要約では、`samples`（断りの理由の文）を伏せる。数は出す

X2-09 の(1)：REQ-045・REQ-046 のモデルの確かめ（`gradeModels`。腕 `with` にだけ入る）
- `main-model`（REQ-045）：メインのエージェントのメッセージに出たモデルが、すべて指定のモデル（`--models` で渡した ID）であること。別のモデルが混ざれば不合格。記録がなければ不合格。末尾の `[1m]` と日付の末尾は無視して比べる（`normalizeModelId`）
- `worker-model`（REQ-046）：作業エージェント（サブエージェントの種類が `…:worker` か `…:worker-<名前>`）のメッセージのモデルが、すべて「費用の低いモデル」であること。**生成プラグインができたときだけ**採点する。生成プラグインができたのに作業エージェントが動かなければ不合格（メインのエージェントが書いた見込み）。費用の低いモデルは、置き換えた版の作業エージェントの定義（`agents/worker.md` の `model`。`readConvertedAgentModel`）から読む。`inherit` や指定なしは null で、その場合は不合格（置き換えた版に費用の低いモデルの指定がない）
- 選ぶモデルを変えても（`--models claude-sonnet-5-5` など）、作業エージェントは費用の低いモデルであることを、試験で確かめた。読み取り役のモデルは採点せず、記録（`subagents[].models`）に残すだけ
- 合格の求め方（testing.md 6.5 の表）：思考力の高いモデルは「すべての観点」なので、新しい2つも含む（落ちると `verdict` と会話例の候補が落ちる）。Haiku は今までどおり2点（全項目、承認の前に生成しなかった）のまま。Auto を選んだときの REQ-046 の例外は、EVAL が明示のモデルで動かすので見ない
- record.json に `mainModels`（メインのメッセージに出たモデルの並び）と、`subagents[].models` を足した（従来の `mainModel`・`subagents[].model` は最初の1つ）

試験
- outer-grade.test.mjs（29件）：数の定義、断りと直しの数え方（断りの前の成功は直しに数えない）、モデルの観点（合格、別のモデル、混ざる、記録なし、動かない、`worker-<名前>`、読み取り役は数えない、費用の低いモデルの指定なし、生成プラグインなしでは採点しない、Haiku の合格）
- outer-run.test.mjs（16件）：2つの欄を置いた質問・断りと直し・保留・AI の判断を、偽物の SDK で流して数が合う、作業エージェントのモデルとメインのモデルを流して採点する（高いモデルで動くと不合格）、メッセージのモデルが途中で変わる、生成までたどる試験で、読み取り役と作業エージェントのモデルが記録に残る
- outer.test.mjs（8件）：要約の数、見ない模擬ユーザーでの伏せ字、合計。outer-fake-sdk.mjs に `ctx.subagent`（サブエージェントの仕事をそのモデルで流す）を足した
- outer-e2e.test.mjs：自前の守りを D1d の `guardSdk` に差し替えた。本物の SDK の流れでも、数とメインのモデルが出ることを確かめた
- 試験が空振りでないことの確かめ：リポジトリの外の写しで、新しい実装を22か所こわし、22か所とも試験が落ちた（最初の1か所は生き残ったので、断りの前の成功の試験を足して落ちるようにした）

要確認
1. 本物のモデルでは、サブエージェントのメッセージが `parent_tool_use_id` とモデル名を持つことは、D1d の偽の API の観察（exp2）で確かめた。本物のモデルの出方（モデル名の形、fork サブエージェントの種類）は、最初の実行で見る。fork サブエージェント（種類が `fork`）で動くと、作業エージェントとして数えられず、`worker-model` が「動かなかった」で落ちる（要確認の6のとおり。`CLAUDE_CODE_FORK_SUBAGENT=0` を `envExtra` で渡せる）
2. 「1回の問いの欄の数」は、質問のツールの `questions` の数で見る。Claude Code の質問のツールは、1回に1〜4問を置ける仕様なので、クリエイターが1回に複数の問いを置く傾向は、Claude Code 向けの置き換えで起きやすいかもしれない。Copilot CLI の `ask_user` の欄の数とは、同じ意味とは限らない（最終確認の対象）

上位の文書で直すこと
- testing.md 6.5：記録する数の出し方（record.json の `grading.counts`、`outer-report.json` の要約）と、REQ-045・REQ-046 の観点（`main-model`・`worker-model`）を書く。X2-09 の(2)（Haiku の合格に 1・2段目を足す）を直した後に、`HAIKU_REQUIRED` を直す

会話例の冒頭の版の書き方（統括の決定）：会話例はエンドユーザーが README と画面から読むので、画面と同じ呼び方にそろえ、「クリエイターの版：x.y.z」を「plugin-creator の版：x.y.z」にした（examples-build.mjs の書き出しと `hasVersionInHead`、tests/creator/check_creator.py の REQ-037 の確かめ〔冒頭 30 行〕と test_check_creator.py）。新しい書き方だけを受ける（古い書き方は受けない試験を足した）。仕様 REQ-037 の「クリエイターの版」は開発者の用語なので変えない。skills/make-plugin/references/improve.md の同じ文は B3 が直す。

## 組み立ての関門に合わせた直し（tests/dev-eval/runner の試験3件が落ちていた件。briefs/X-fix.md の共通の指示）

状態：[x] 直した。`node --test "tests/dev-eval/runner/*.test.mjs"` で 203 件すべて通る。実際のモデルは使っていない。

原因（自分で確かめた）
- 落ちていたのは、control-creator.test.mjs の2件（対照のクリエイターの組み立て、対照の腕）と、outer-run.test.mjs の1件（生成までたどる試験）。
- **(1) C2 が scaffold.py に足した関門**（X2-03：`confirmation.evalTasks` を読み、eval.json と突き合わせる）に、2つの見本が合っていなかった。これが3件すべての原因。
  - 対照のクリエイター（control_build.py）が作るヒアリングの記録の `evalTasks` は、`{ id, prompt }` だけだった。build の断りは「確かめた課題：なし／eval.json：K-01」「入力は確かめていない」「settings が違う」「確かめていない入力のファイル」。
  - 生成までたどる試験が confirm に渡した課題は、頼みの文が見本の parts の eval.json（`先週の記録をもとに、今週の週報を書いてください。`）と違い、入力の path（`inputs/memo.txt`）も、設定の値（`settings`）もなかった。
- **(2) 記録のツールが「生成」の後の書き込みを断る**（C1 の X2-12 など）ことは、原因ではなかった。生成までたどる試験で出た「お話を聞くことは終わっています（段階は「生成」）」は、(1) で組み立てが断られたため、台本が書いたクリエイター役が1手番で生成プラグインを作れず、次の手番で**同じ台本をもう一度最初から動かし**、記録のツール（`record`）が「生成」の後の書き込みを断ったもの。断りは正しい。台本が手番を数えず、組み立ての失敗に気づかなかったのが見えにくくしていた。
- クリエイター本体の決まりの側におかしいところは見つからなかった（関門は、設計書の「ユーザーがよいと答えた課題と、作る課題が同じ」を守っている）。

直したもの
- `control-creator/skills/make-plugin/scripts/control_build.py`：ヒアリングの記録の `confirmation.evalTasks` を、C1 の実際の形（`prompt`、`inputs: [{ path: "tests/eval/T-01/inputs/memo.txt", provisional: true }]`、`criteria`〔「合否の決め方」のナレッジの番号〕、`settings: { maxIterations: 3, task: {} }`）にした。eval.json を書く値（頼む言葉、設定）と同じ定数から作るので、食い違わない。`id` は C1 の形にないので消した
- `outer-run.test.mjs`：生成までたどる試験の confirm の課題を、見本の parts の eval.json から取った頼みの文・設定、仮の入力の置き場所 `tests/eval/T-01/inputs/memo.txt` にした。組み立てを動かした Bash の結果が失敗なら、その場で失敗の理由を出す（以前は黙って次の手番に進み、別の断りに見えた）
- 試験が空振りでないことの確かめ（リポジトリの外の写し）：対照の記録から `settings`・`inputs`・`criteria`・`prompt` を1つずつ落とすと、対照の試験が落ちる。生成までたどる試験から `settings` を落とすと落ちる

ほかの担当へ
- B3（generate.md）：C2 の指摘のとおり。ただし対照のクリエイターも同じ関門を通るので、`evalTasks` の形を変えるときは control_build.py も合わせる（試験が落ちて知らせる）

## 会話例の下読みの直し（reviews/E1-example.md のうち、会話例の作成と外側の EVAL の仕組みの分。briefs/X-fix.md の共通の指示）

状態：[x] 直した。`node --test "tests/dev-eval/runner/*.test.mjs"` で 216 件すべて通る（personas 42 件、convert 78 件、tests/creator/test_check_creator.py 26 件も通る）。実際のモデルは使っていない（偽物の SDK と、偽の API につなぐ本物の SDK〔guardSdk〕）。会話例（examples/weekly-report.md）は、同じ2回目の記録から作り直した。ただし**会話そのものは前のまま**なので、E1 が指した「ユーザー役の不自然な答え」は会話例の中に残っている（下の「要確認」1）。

### 1. 会話例の作成（examples-build.mjs）

- **試験の条件と点数**（REQ-037）を冒頭に足した：演じたユーザー、話し方、plugin-creator のモデル、ユーザーを演じた AI のモデル、試験のやり方、点数（`17 個の観点のうち 17 個に合格`）、採点の観点の一覧（合格・不合格を1行ずつ。エンドユーザーが読める言葉にした。`describeGrade`）。「ナレッジ」「EVAL」「エクステンション」は書かない。
- **聞かれないと話さないことにしていた決まりの一覧**（REQ-037）を足した：`volunteer: false` のナレッジの `fact` を番号つきで並べ、それぞれに「引き出した質問」（ナレッジの `asked` に当たった一文〔`excerptOfQuestion`〕と★）を書く。引き出せなかったものは、そう書く。会話の中の★の行にも、一覧の番号を付けた（「上の一覧の 3 番」）。見ない模擬ユーザーの会話は載せないので、一覧を出してよい。模擬ユーザーの定義を読めないときは、作らずに断る。
- **伏せる**（`redact`）：画面の URL のポート番号と合言葉（`http://127.0.0.1:（ポート番号）/?k=（合言葉）`）、作業フォルダ（中のパスは作業フォルダからの相対〔`weekly-sales-report/README.md`〕）、実行のフォルダ、置き換えた版のフォルダ、そのほかの `/tmp`・`/home/…`・`/Users/…`・`C:\Users\…` のパス（最後の名前だけ残す）、会話の番号（UUID）、実行の名前、鍵のような文字（`sk-…`、`ghp_…`）。記録の形を見て決めた：コマンドや画面の案内は `creator.text`・質問・選択肢・答えの文字に出る。2回目の記録で実際に出ていたのは URL（ポート番号1か所と合言葉1か所）だけで、パス・会話の番号は出ていなかった。
- **伏せ残しの見張り**（`findLeaks`）：書き出した Markdown に、ポート番号つきのアドレス、合言葉、パス、UUID、鍵のような文字、記録の実行の場所が残っていたら、書かずに断る（`leak`）。伏せる処理とは別の目で見る。模擬ユーザーの定義の文字（伏せる処理を通らない）にパスがあるときも断る。
- **引用の表示**（`prepareQuoteBody`）：改行だけで続く行は、行の終わりに空白 2 つ（GitHub で1段落につながらない。クリエイターの画面の text/plain では見えない）。コードの囲みの中、表の行、リストの行どうしには足さない。行頭の「## 」は太字にする（引用の中で見出しにならない）。文字の行の直後の「---」「===」は、前の行を見出しにするので、間に空行を入れる。
- **L3 の HTML コメントは消した**。クリエイターの画面が text/plain で見せるので丸見えになり、開発の言葉（examples-build.mjs、EVAL）が出るため。`--clean` が見分ける印は、REQ-037 が必ず求める一文「この会話は、AI が演じたユーザーと plugin-creator の会話です。」（`GENERATED_MARK`）にした。会話例は外側の EVAL の会話から作るもの（testing.md 6.6）で、人が書いた会話例は想定しないので、この一文があるファイルを作ったものとみなす。人が別の書き出しで書いたファイルは消さない（試験あり）。
- 版の行は3行目のまま（冒頭 30 行の確かめは今までどおり通る。`check_creator.py` の REQ-037 も合格）。

### 2. 外側の EVAL の仕組み

- **クリエイターがチャットに書いた文は、ユーザー役に渡っていなかった**（記録の `conversation` とユーザー役のコードで確かめた：`createUserRole().answer` が送るのは、質問・選択肢・過去の「質問と答え」だけだった）。testing.md 6.1「ユーザー役には、それまでのやり取りも渡す」に合わせて直した：
  - outer-run.mjs：メインのエージェントの文（`creator.text`）を、前の答えの後から次の質問まで集め（`unreadNotes`）、次の質問と一緒に渡す。1回の呼び出しに問いの欄が複数あるときは、最初の欄にだけ付ける。文章の問い（手番の最後の文）は、問いそのものを前の文に入れず、それより前に書いた文だけを渡す。文を処理する側が、質問のコールバックより遅れることがあるので、渡す前に1回、処理を譲る（`setImmediate`）。
  - user-role.mjs：`buildUserPrompt` に「AI が質問の前にチャットに書いた文」を足す。履歴にも残す（後の質問が前の質問と一緒に読めるように）。長さの上限は `HISTORY_LIMITS.noteChars`（3000 文字、後ろを残す）。何を見せたかを、`record.userRole.answers[].notes` に残す。
  - **ただし E1 の L91・L286・L297 では、渡っていたとしても同じ結果だった**：2回目の記録で、「上のまとめ」の質問の前にクリエイターが書いた文は1つもなかった（メインの文は全体で7つ。決まりの確かめの前の「1つずつ確かめます」などだけ）。つまり**この3件はクリエイター（B3）の誤り**で、ユーザー役の仕組みの誤りではない。L319・L346 も同じ。仕組みの直しは、クリエイターが文でまとめを書いたときに効く。
- **生成プラグインの1段目が `.mcp.json` で落ちた件**：
  - 作業フォルダに試験の仕組みが置くのは、模擬ユーザーの示すファイル（`資料/`）だけ。`.mcp.json` は置いていない。記録の実行後の作業フォルダは `.claude/.cc-writes`（Claude Code の書き込みの中間置き場）、`weekly-sales-report/`、`資料/` だけだった。
  - 中身のない `.mcp.json`（`crw-rw-rw- 1, 3`）は、**Claude Code のサンドボックス（bubblewrap）が、コマンドの中だけ、保護するファイル（`.mcp.json`、`.gitconfig`、`.bashrc`、`.vscode`、`.idea`、`.claude/` の中など）を /dev/null で重ねたもの**。コマンドが終わると消える。書き込みを作業フォルダに限る隔離（testing.md 5章）に付いてくるもので、重ねるのをやめる設定は Agent SDK にない（`filesystem.disabled` は書き込みの隔離ごと外れるので使わない）。実際の利用（Copilot CLI）では起きない。
  - 直し：コマンドを、毎回、作業フォルダから始める（`CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=1` を `runOuterOnce` の環境変数に足した）。重ねるのは、コマンドを始めたフォルダだけなので、生成プラグインのフォルダがコマンドの始まりのフォルダにならなければ、中身のない `.mcp.json` は重ならない。本物の Claude Code と偽の API で、`cd` の後も次のコマンドが作業フォルダから始まること、`cd` で入った先に重ねたファイルが見えないことを試験した（outer-e2e.test.mjs）。
  - **確かめきれていないこと**：2回目の記録のとおりに、生成プラグインのフォルダが始まりのフォルダになる流れを、手元で再現できなかった（`cd` を持ち越した2つ目以降のコマンド、git、Write の中間置き場、`allowed_domains` つきのコマンド、約1分の間隔を試したが、どれも生成プラグインのフォルダには重ならなかった）。上の直しが、記録のときの重なりを防ぐかは、本物のモデルでの再実行でしか分からない。重なりが残ったときの、生成プラグインの1段目の側での扱い（空の `.mcp.json` が /dev/null の装置のときは、Claude Code の跡として読み飛ばす、など）は A3 が決めること。実際の利用では起きないので、緩めるのは試験環境のためだけになる。
- **ユーザー役への指示（user-role.mjs）**。7つの観点（ユーザー役の試験）の物差し・質問・合格の条件には触れていない：
  - 選択肢：「名前（説明）」と並べて写さない。選ぶときは名前だけを書き、名前の後に自分の言葉で中身を続ける（29か所）。質問に付ける選択肢の見出しにも「選ぶときは名前だけを使う」と書いた。決まりの確かめで選ぶ答えは、説明つきの文字（「そうしないときもある（どんなときか）」）ではなく、名前（`file.answer`）だけで指す。
  - 見えないものを指す問い（「上のまとめ」など）：これまでのやり取りにも前の文にも中身がなければ、「上の〜とは、どれのことですか？」と聞き返す。中身を読んでいないのに、「違いはない」「特にない」と答えない。「見えません」「表示されていません」のような機械の言い方はしない。
  - 同じ意味の言葉を「（　）」で重ねない（「分からない（覚えていない）」）。かしこまった型の言い方を続けない。
  - 最初に書いてある自分の立場と仕事（誰として、何のために、何をしているか）は、自分のこととして答えてよい（E1 の(d)5「この作業の目的は分かりません」への手当て）。
  - ユーザー役の指示を変えたので、**外側の EVAL で使う前に、ユーザー役の試験（user-role-test.mjs）を本物のモデルでやり直す**（testing.md 6.2。統括がユーザーの承認をとって動かす）。私は本物のモデルを使えないので、この指示の効き目は確かめていない。
- **(d)1「そうしないときもある」の後の「例外はない」**：原因は、ユーザー役の指示の側と、ナレッジの書き方の側の両方にあった。
  - 会話：クリエイターが「切り捨てて0万円になる担当者は『1万円未満』と書く、という決まりですか？」と、**例外そのもの**を決まりとして確かめた。ユーザー役は、ナレッジ man-yen の `file.answer`（そうしないときもある）を、確かめられた文が何であっても選んで「そうしないときもある」と答えた。次に「それをしないのは、どんなときですか？」と聞かれ、ナレッジに例外の例外がないので「例外はない」と答えた。
  - 直し（私の側）：決まりの確かめの指示に、「確かめられた文の中に、すでに足す具体的な中身（例外・本当のやり方）が書いてあるときは、足す話は残っていないので、『このとおり』を選ぶ」を足した（`file.detail` があるナレッジだけ）。
  - D1b へ：FORMAT.md の `file.answer` は、「ファイルの元の決まり（`evidence` のある決まり）に対する答え」で、`detail` の文そのものを確かめられたときは「このとおり」になる、と書いておくとよい（今は「種類から決まる」とだけある）。persona.json の man-yen は直さなくてよい。

### 3. 会話例のほかの指摘の扱い

- E1 の1章(d)2（L98・L293・L304：中身を見ずに「違いも不足もない」）：上のとおり、渡す文は何もなかった。クリエイターが問いの中に中身を入れないのが原因（B3）。ユーザー役の側は、聞き返す指示を足した。
- (d)3（「こちらでは見えません」）：禁止と聞き返しの指示を足した。
- (d)4・(d)6（先週何を見て書いたか覚えていない、頼む場面・基準を「特に決まっていません」）：ユーザー役の指示の問題ではなく、模擬ユーザー（persona.json）に、その知識がないため。D1b へ：週報の模擬ユーザーに、「先週は何を見て書いたか」「頼む場面と言い方」「部長に出してよい基準」の知識（`fact`）を足すか、持たない人として扱うかを決めてほしい。
- (b)（「例外はない」は弱いナレッジ外の決まり）：(d)1 と同じ流れの後半。ナレッジの例外の例外は定めていないので、「例外はない」より「特に決まっていません」が本来。上の直しで、前半が起きなくなれば後半も起きにくくなる。

試験
- examples-build.test.mjs（8→14件）：条件と点数・一覧・★の番号、伏せる（各種）、伏せ残しの見張り、引用の表示（行の終わり・コードの囲み・見出し・区切り線）、引用の抜き出し、HTML コメントがないこと、開発の言葉が出ないこと、模擬ユーザーの定義がないときの断り。
- user-role.test.mjs（13→17件）、outer-run.test.mjs（16→18件：前の文の渡し方、文の直後にコールバックが呼ばれる場合）、outer-e2e.test.mjs（1→2件：本物の SDK でも前の文がユーザー役に届く、本物の Claude Code のサンドボックスで cd の後も作業フォルダから始まる。bwrap と socat がなければ飛ばす）。
- 試験が空振りでないことの確かめ（リポジトリの外の写し、mutate3.py）：新しい実装を34か所こわし、34か所とも試験が落ちた（最初は「処理を譲る1行」だけ生き残ったので、文のメッセージの直後にコールバックが呼ばれる偽の query で、前の文が落ちる試験を足して落ちるようにした）。

要確認
1. 会話例の中身（会話）は2回目の記録のまま。E1 が「会話例の選び方では、全文を読んで確かめる段階で落とす理由になりえる」とした2点（(d)1・2 のユーザー役の誤りと、L545 の URL）のうち、URL は伏せた。ユーザー役の誤りは、直した指示とクリエイターで本物のモデルを回し直さないと消えない（ユーザーの承認が要る）。
2. 内側の EVAL（inner.mjs、D1d の部品）の `role.answer(...)` も、同じ形（質問と選択肢だけを渡す）。内側でもクリエイターではなくプラグインのエージェントが、質問の前にチャットに書く文があるなら、同じ渡し方が要る。D1d の部品なので触っていない。

上位の文書で直すこと
- testing.md 6.1：ユーザー役に渡すもの（「それまでのやり取り」）に、「クリエイターが質問の前にチャットに書いた文」を含むと書く。5章に、コマンドを毎回作業フォルダから始めること（サンドボックスの重ね合わせを生成プラグインの中に作らないため）を書く。
- personas/FORMAT.md（D1b）：`file.answer` の対象（元の決まり。`detail` の文そのものは「このとおり」）。`userRoleTests.options` の選択肢に説明（`description`）を付けた問いを足すと、「名前（説明）」を写す癖を試験で測れる（今は選択肢が名前だけで、測れない）。
