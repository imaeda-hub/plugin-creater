# X3 突き合わせの指摘の仕分け

状態：完了

担当：X3（指示：briefs/common.md、briefs/X-triage.md）。指摘（reviews/X1.md 19件、reviews/X2.md 22件）を、根拠に挙がった文書と実装を読んで確かめ、仕分けた。ファイルは直していない。tests/dev-eval/heldout/ は読んでいない。

仕分けの印：A＝すでに決まっている・進んでいることに含まれる／B＝実装を直す／C＝上位の文書を直す（実装は今のまま）／D＝ユーザーの判断が要る／E＝採らない。1件に2つの印があるときは「B＋C」のように書く（実装を直し、あわせて上位の文書も直す）。

モデル：高い思考力が要る→Opus／決まった直し→Sonnet／機械的→Haiku。「移した後」は、ひな形（skills/make-plugin/assets/template/）のファイルなので、ひな形をクリエイターの直下に移した後に直すもの（ユーザーの答え25）。

## 1. 指摘ごとの表

### 1.1 X1（生成プラグインの側）

| 番号 | 仕分け | 理由（確かめたこと） | 直し方・担当・モデル |
| --- | --- | --- | --- |
| X1-01 統括の tools が作業・検証のツールを含まない | A | V1 の不具合1と同じ。ユーザーの答え24の形（統括の `tools:` を消し、許す一覧を onPreToolUse で拒む）で B1 が直している（tasks/B1.md の「V1 不具合1の直し」）。 | B1 が進めている。残り：ひな形の docs/design/design.md 3.5 の表（統括の「使えるツール」が `agent`・`read`・`search`・記録のツールのまま）は B1 の直しの範囲にないので、ひな形の文書の束（A4、移した後）に入れる。設計書 4.4・4.7・4.8 と testing.md の1段目は C（既出：答え24）。 |
| X1-02 「担当」に短い名前が出る | A | V1 の不具合3と同じ。adapter.mjs は `tool.execution_start` の `arguments.description` を `toolCallId` で引く形に直って push 済み（`taskDescriptionOf`、`calledTasks`）。統括の定義の「画面に担当として出る」も、直った後は事実と合う。 | なし。 |
| X1-03 設計書のひな形の「起動し直したとき」が答え14と実装に反する | B＋C | 確かめた：design.md 236行「自分のセッションの終わっていない実行は、すぐ途中で切れたとする」、188行・151行は「途中で切れた」だけ。core/recovery.mjs の `classifyUnfinishedRun` は自分のセッションを `cancel_and_end`（取り消して `extension_restarted`）にする。生成プラグインの中で設計書と実装が矛盾する。 | design.md 5.1・3.7・3.3 の表を、答え14と recovery.mjs のとおりに直す。担当 A4（元はひな形の文書）、Sonnet、移した後。C：generated-plugin-structure.md 4.13・6.5・10章（既出：A1）。 |
| X1-04 設計書のひな形に adapter.mjs とその試験がない | B＋C | 確かめた：design.md 7行・16行・83行・292行・297行・329〜340行は `extension.mjs` と `fake-port.mjs` だけ。実際のつなぎの関数は adapter.mjs、試験は tests/stage2/adapter/（偽物の SDK）。追跡の表から adapter.mjs をたどれない（REQ-003）。 | design.md 1章・2.2・7章・9章に adapter.mjs と tests/stage2/adapter/ を足す。担当 A4、Sonnet、移した後。C：generated-plugin-structure.md 3.4・7章、creator-structure.md 2章・4.1（既出：B1、C2）。 |
| X1-05 画面の文に「生成プラグイン」が出る | B | 確かめた：ui/static/app.js 70・71行（DEFAULT_FILE_STEPS）と 718行（Issue の説明）。core/github.mjs の STEP_* は「このプラグイン」。ひな形の仕様書 REQ-025（説明のない専門用語がない）に反する。tests/stage2/ui/screen.test.mjs 908・909行が同じ文を期待している。 | 3か所を「このプラグイン」にし、screen.test.mjs の期待の文も合わせる。担当 A2、Haiku（機械的）、移した後。 |
| X1-06 起票の手順の「インストールはコピー」が事実と合わない | B＋C | 確かめた：core/github.mjs 69行と design.md 259行。V1 1節で、手元のフォルダのマーケットプレイスから入れたものは `source: "live"`（コピーされず、次のセッションで反映）。ただし、実装は設計書 generated-plugin-structure.md 4.11（428行・431行）の文のとおりなので、上位の文書も誤っている。 | STEP_REPOSITORY の括弧を、入れ方で反映のしかたが違うことが分かる文にする（例：「手元のフォルダから入れたときは次のセッションで、GitHub から入れたときは入れ直すと反映されます」）。担当 A1（github.mjs）、Sonnet、移した後。design.md 5.3 の理由は A4（ひな形の文書の束）。C：generated-plugin-structure.md 4.11 と 292行の「インストールしたプラグインはコピー」。 |
| X1-07 設定の key に `maxIterations` を書ける | B＋C | 確かめた：task.schema.json の settings.key は `^[A-Za-z][A-Za-z0-9_]*$` だけ。app.js 514行が繰り返しの上限の欄を key `maxIterations` で作り、render.js と test-plugin の screen.mjs は `setting-<key>` で欄を探すので、同じ id が2つになる。モデルの欄の key は `model-<役割>`（ハイフンつき）なので、作業ごとの key とはぶつからない。 | task.schema.json の settings.key に `maxIterations` を除く決まりを足し、1段目の自己試験に1件足す。担当 A3、Sonnet、移した後（自己試験は B1 も直しているので、B1 の後）。C：generated-plugin-structure.md 6.4 に「key に maxIterations を使わない」。 |
| X1-08 断りの理由がモデルに届かない | A | V1 の不具合2と同じ。adapter.mjs の `callTool` は `RecordRefusal` を `{ textResultForLlm, resultType: 'failure' }` で返す形に直って push 済み（347〜357行）。クリエイターの creator.mjs の `guard` も `failure()` で返す（C1、push 済み）。 | なし。設計書 4.8 と R2 3.3 は C（既出：B1）。 |
| X1-09 EVAL の課題の check の誤りを1段目が見ない | B＋C | 確かめた：check_structure.py の `check_eval` は program の基準に `check.type` の文字があることだけを見る（756行）。grade.mjs の `CHECK_TYPES`・`validateCheck`・`validateTask` はもっと細かく見て、誤りがあると EVAL を始めない。生成の後の直し（REQ-039、上限3回）の間に見つからず、ユーザーが試験を頼んだときに初めて止まる。C3→A3 の引き継ぎ（RESUME）にもある。 | `check_eval` に grade.mjs の先頭の表と同じ決まり（check.type の4種類、種類ごとの必須の項目と知らない項目、file のグロブ、regex、model の check、settings.maxIterations、settings.task の値の型と、key が作業の定義の settings にあること）を足し、自己試験に grade.mjs の試験と同じ誤りの例を足す。担当 A3、Sonnet、移した後・B1 の後（check_structure.py は B1 が直している）。C：testing.md 2章・10.1 に、1段目が eval.json の採点のしかたの形まで見ることを書く。 |
| X1-10 初めての EVAL で AI クレジットの見込みが出ない（X2-04 と同じ） | B＋C | 確かめた：estimate.mjs の `GUIDELINE` は値がすべて null で、前の記録がなければ `credits.estimate` が null。REQ-040 の受け入れ基準「EVAL の前に…AI クレジットの見込みが示される」を、初めての EVAL では満たさない。test-plugin の SKILL.md 手順6は、見込みがないときの扱いを書かず、選択肢も「この回数と見込みで始める」である（X2-04）。開発の環境では Copilot CLI を動かさないので、目安は AI クレジットとしては測れず、トークン数で測ることになる（testing.md 1章・8.2）。 | (1) SKILL.md 手順6に、`credits.estimate` が null のときは返り値の `message` のとおりに伝え、見込みを推し量らず、選択肢を「この回数で始める」にすることを足す。担当 B3、Opus（自然言語）、今すぐ。(2) 波 E の EVAL で測った1回あたりのトークン数に、既定のモデル（統括と検証は claude-sonnet-5.5、作業は gpt-6-luna）の Copilot の価格をかけて GUIDELINE を埋め、estimate.test.mjs に「前の記録がなくても見込みが数になる」試験を足す。担当 C3、Sonnet、波 E の後（価格は公式の Models and pricing で確かめる。要確認）。C：testing.md 8.2 の目安の形（下の C-06）。最終の報告の「残り」に、波 E までは REQ-040 の見込みが初めての EVAL で出ないことを入れる。 |
| X1-11 Windows で2段目の一部が誤って落ちるおそれ | B＋C | 確かめた：tests/stage2/core/harness.mjs の `createFakeGh` は拡張子のない shebang のファイル `gh` を作り、core の `runCommand` は `spawn(command, args, { shell: false })` で動かす。Windows では、このファイルは `spawn` で動かせない。shutdown.test.mjs には `win32` の扱いがなく、Windows の Node.js では `child.kill(signal)` が強制終了になる（Node.js の説明）。run.py と check_tools.py は Windows の場所を持ち、Windows でも使う前提である。仕様書と設計書は、対象の OS を書いていない。core に試験のためだけの引数を足すのは、設計書の「プラグイン本体には試験のためだけの機能を入れない」（ひな形 design.md 83行、testing.md 10.4）に反するので採らない。 | 偽物の `gh` を使う試験と、シグナルの試験は、`process.platform === 'win32'` のときに理由を書いて飛ばす（Windows で残る確かめ〔終わった後にサーバーが残らない〕は別に置く）。担当 A1（tests/stage2/core/）と B1（tests/stage2/adapter/shutdown.test.mjs）、Sonnet、移した後。Windows で `python3 tests/run.py` を動かすのは最終確認。C：testing.md 10.2・11.2 に、生成プラグインの1・2段目を動かす OS（Linux・macOS・Windows）と、Windows で飛ばす試験を書く。 |
| X1-12 文書のひな形に実装の決まりがない | B＋C | 確かめた：(1) orchestrator.agent.md 35行・64行は「基準と食い違う頼みの部分は使わず、計画とまとめに書く」（答え23）、ひな形の requirements.md・design.md にない。(2) constants.mjs の `INSTRUCTION_HEAD`、(3) `BUSY_NOTICE` が design.md 3.1・2.4 にない。(4) design.md 2.3 の直し方は2つの原因だけ（README 131行は3つ目の `/extensions mode` Disabled を持つ）。(5) README 56〜58行は選択肢が3つと「don't ask again … this session」、design.md 2.3 は3つ。 | ひな形の requirements.md の REQ-011 に (1)、design.md 3.1 に (2)、2.4 に (3)、2.3 に (4) と README と同じ選択肢を足す。担当 A4、Sonnet、移した後。C：output-requirements.md REQ-011 と generated-plugin-structure.md 4.3・4.8（答え23）、4.7（3つ目の原因。既出：A4・B3）、6.2・4.2（既出：A1）、4.1（選択肢）。 |
| X1-13 1段目の自己試験が生成プラグインに写り、そこでは動かない | B（一部 A） | 確かめた：scaffold.py の `SKIP_NAMES` に selftest がなく、tests/stage1/selftest/（試験2つと見本19ファイル）がそのまま写る。自己試験は `_plugin_` のパスを直書きしている（C2→A3 の引き継ぎ）。「Related files」が増える点は、ひな形を移すこと（答え25）で消えるので A。 | 自己試験と見本を、ひな形の外（例：tests/creator/stage1/）に移し、ひな形の check_structure.py をその場所から試す。担当 A3、Sonnet、移した後・B1 の後（B1 が自己試験を直している）。ひな形を移す担当と同じ頼みにしてもよい。C：creator-structure.md 2章の部品の表に、自己試験の置き場所を書く。 |
| X1-14 生成プラグインの試験の名前に、生成プラグインの仕様書にない番号 | B | 確かめた：check_structure.py 62行の `knowledge` が REQ-039、screen.test.mjs 1627・1628行と server.test.mjs 392行が REQ-043（クリエイターの「決まったことの一覧」）。ひな形の仕様書は REQ-001〜014・025・029〜031・REQ-101〜。 | knowledge の試験は、生成プラグインの要件ではないことが分かる印（例：「設計書 7章」）にする。REQ-043 の2件は、クリエイターの試験（tests/creator/ の下の新しいファイル。C1 のファイルと名前を分ける）に移す。担当 A3（check_structure.py。B1 の後）と A2（ui の試験）、Sonnet、移した後。 |
| X1-15 ほかの作業フォルダの途中で切れた実行でも「前の実行が途中で終わっていました」と出る | B＋C | 確かめた：recovery.mjs 95行の `finishRecoveredRun` は、どの実行でも `ctx.endedAtStartup` に入れ、index.mjs 146行の `open` は空でなければ知らせを足す。`loadPrevious`（248行）は同じセッションか同じ作業フォルダの実行しか出さない。 | `endedAtStartup` に入れるのを、`begin.sessionId` が今のセッションか、`begin.cwd` が今の作業フォルダの実行だけにし、restart.test.mjs に1件足す。担当 A1、Sonnet、移した後。C：generated-plugin-structure.md 4.13 の「次に画面を開いたときにそのことを示し」を、4.2 と同じ範囲に限る。 |
| X1-16 EVAL の実行の記録が利用者の記録と同じ場所に入り、上限で前の記録を消す | D | 確かめた：run.mjs の `runtimeEnv` は COPILOT_HOME を替えず、EVAL の作業フォルダ（OS の一時フォルダの下）は消さない。store.mjs の `purge` は作業フォルダやセッションで分けず、20件を超えると終わった実行を古いものから消す。EVAL の記録の置き場所を生成プラグインの側で替えるのは、testing.md 10.4「生成プラグインには、試験のためだけの機能を足さない」に反する。どう扱うかで、ユーザーに見える振る舞い（前の結果と承認していない Issue の案が残るか）が変わり、設計書 6.5 と testing.md 10.4 も直すことになる。 | 下の D-2 で聞く。おすすめの「EVAL の後に、EVAL でできた実行の記録を test-plugin が消す」なら、担当 C3（run.mjs と試験）、Sonnet、今すぐ。C：generated-plugin-structure.md 6.5 と testing.md 10.4（答えに合わせて書く）。 |
| X1-17 設計図の差し込み口 `readme-task` がひな形にない | B | 確かめた：BLUEPRINT 8章に `readme-task` があり、ひな形の README に `{{slot:readme-task}}` がない。仕様（REQ-004・REQ-005）と設計書（generated-plugin-structure.md 3.4 の表）は、README に作業ごとの使い方を求めていない。憲章 第10条（KISS）から、設計図のほうを直す。 | BLUEPRINT 8章から `readme-task` を消す。担当 統括（BLUEPRINT は統括のファイル）、Haiku 相当（1行）。 |
| X1-18 `/experimental on` が非推奨（X2-14 の一部と同じ） | A | 進んでいること：V1 が `/settings experimental on` を確かめた（V1 7.2。2026-10-24 に追記）。`/settings experimental on` は動き、「Set experimental = true. Restarting...」で自動で再起動する。`copilot --experimental` は一度付けると settings.json に残る。V1 の見立ては「`copilot --experimental` を第一に、起動後は `/settings experimental on`」。 | 案内の直しの束（下の 2.4）。V1 の結果が出たので、仕様 REQ-004・REQ-023 の言葉を変えるかをユーザーに確かめた後に頼める。 |
| X1-19 画面の試験の Playwright の入れ方の案内が食い違う | B | 確かめた：screen.test.mjs 4〜7行の注釈と 43・44行の止まるときの文は「リポジトリの外で npm i、NODE_PATH」。run.py 76行と check_tools.py は tests/node_modules に入れる（ユーザーの答え16）。tests/node_modules に入れれば、ES モジュールの探索で見つかる。 | 注釈と止まるときの文を、run.py の HOWTO と同じ入れ方（生成プラグインのフォルダで `npm install --prefix tests --no-save --no-package-lock playwright@1.56.1`）にし、NODE_PATH は開発の環境の補いとして残す。担当 A2、Haiku（機械的）、移した後。 |

### 1.2 X2（クリエイターの側と開発の試験）

| 番号 | 仕分け | 理由（確かめたこと） | 直し方・担当・モデル |
| --- | --- | --- | --- |
| X2-01 段階「画面」の抜き書きの例が、ユーザーの言葉でない字を足させる | B＋C | 確かめた：references/screen.md 39行の例「〇〇を毎回選ぶ（選ぶ欄）」は、自由入力の答えと決める問いの答え（とメインのエージェントの言葉）を1つの抜き書きに混ぜる。outer-grade.mjs の `normalizeQuote` は丸括弧を消さず、`quoteFound` は断片がすべて同じ1つの答えの中にあることを求めるので、例のとおりに書くと「全項目をヒアリングしたか」で落ちる。 | screen.md の例を1つの答えの言葉だけにし、決めた部品は抜き書きに足さず、問答の記録と作業の定義の案に残ることを書く。担当 B3、Opus（自然言語）、今すぐ。C：hearing.md 7.3 に画面の3項目で決めた設定と表示を残す欄がない（既出：B3）。 |
| X2-02 EVAL の課題の「作業の画面に入れる設定の値」が、確認で示されず記録にも残らない | B＋C | 確かめた：confirm.md 2の「作業の画面に入れる設定の値も決める」に対し、3で示す3つにも、tool-defs.mjs の `confirm` の `evalTasks`（`prompt`・`inputs`・`criteria`）にも設定の値がない。generate.md 38行は作業エージェントに設定の値を渡すよう求めるので、コンパクションの後は state.json から写せない。testing.md 10.1 の表は EVAL の課題に「Web管理画面の設定」を含める。 | `plugin-creator_confirm` の `evalTasks` に `settings`（`maxIterations` と `task` の値）を足し、state.json とクリエイターの画面に出す（担当 C1、Sonnet、今すぐ。引数の説明の文は【仮】で置く）。confirm.md の3の2で示し、generate.md の渡すものを state.json の値から写す形にし、descriptions.mjs の説明を仕上げる（担当 B3、Opus、C1 の後）。C：hearing.md 7.1・6.5 の確認の記録の欄に、課題の設定の値を足す。 |
| X2-03 作業エージェントが書く eval.json が、確かめた課題と同じかを見ない | B＋C | 確かめた：scaffold.py に `confirmation.evalTasks` を読む箇所がない（`grep` で0件）。eval.json の `criteria` に id と文を入れるだけで、`prompt`・`inputs`・課題ごとの基準の組は作業エージェントが書いたまま。1段目も、基準の文の写しと、どの基準もどれかの課題に入っていることまでしか見ない。REQ-038「よいと答えたものを、生成プラグインのリポジトリに入れる」を確かめる手段がない。 | 組み立てのスクリプトが、`confirmation.evalTasks` と eval.json を突き合わせる（課題の番号と数、`prompt` が同じ、基準のナレッジの番号の組が同じ、`inputs` の置き場所、X2-02 で足す設定の値）。違えば断り、今の「組み立てが断ったら作業エージェントに直させる」流れで直す。課題の番号（T-01）を confirm の引数に足すかは C1 と合わせる。担当 C2、Sonnet、B1 の後（scaffold.py と test_scaffold.py は B1 が直している）・C1 の X2-02 の後。もう1つの案（組み立てのスクリプトが prompt・inputs・settings を state.json から書き、作業エージェントは grading と check だけを書く）は、作業エージェントの頼みと worker.agent.md も変わるので採らない。C：creator-structure.md 3.5・4.1（組み立てが確かめること）と BLUEPRINT 8章。 |
| X2-04 初めての EVAL で見込みが出ない、スキルに扱いがない | B＋C | X1-10 と同じ。1つにまとめた（X1-10 の行）。 | X1-10 の行。 |
| X2-05 EVAL が長くかかることへの備えがスキルの手順にない | B | 確かめた：test-plugin の SKILL.md 手順7は、動かすことだけを書く。C3 の引き継ぎ4（数十分かかる、裏で動かす、途中は `status: "running"`）が入っていない。シェルのツールの事実（R1〜R3 にない）は、V1 の生の記録（scratchpad/v1/out/gen-a/requests.jsonl の `bash` の定義。1.0.102）で確かめた：`initial_wait` は 30〜600 秒で、それまでに終わらなければ途中の出力を返して動き続け、終わると知らせが来る。`mode: "async"` と `read_bash` がある。シェルのツールが時間切れで止めるのではないので、X2 の心配のうち「止まったと判断する」「もう一度動かす」が残る。 | 手順7に、長くかかること（課題×回数×2回、1回の上限は既定30分）をユーザーに先に伝えること、終わりの知らせが来るまで待ち、もう一度動かさないこと、`result.json` の `status` が `running` の間は終わっていないことを足す。シェルのツールの名前や引数（`bash`・`initial_wait`）は、モデルの族と OS で名前が変わる（V1 4節、Windows は別のシェル）ので、手順には書かず、待つことだけを書く。担当 B3、Opus（自然言語）、今すぐ。V1 の報告か R1 に、`bash` の定義の事実を足しておく（統括）。 |
| X2-06 EVAL の道具を入れないと答えると、1・2段目もせずに止まる | B＋C | 確かめた：SKILL.md 手順4は `--scope` なし（既定の `all`）で、1・2段目と EVAL の道具をまとめて確かめ、入れないと答えると止まる。check_tools.py には `--scope`（stage12・eval・all） がある。REQ-040「試験を頼むと、構造の検査と部品の試験の合否が示される」「断ると、EVAL は行われない」を、EVAL の道具だけが足りないときに満たさない。 | 手順4を `--scope stage12` にし、EVAL の道具は手順6で始めてよいと答えた後に `--scope eval` で確かめて、足りなければそこで入れてよいかを聞く。入れないと答えたら、EVAL をせずに手順8へ進む。担当 B3、Opus（自然言語）、今すぐ。C：testing.md 10.1 の手順1（道具の確かめ）を、1・2段目の前と、EVAL を始めてよいと答えた後の2回に分ける。 |
| X2-07 流用すると決めたファイルを、作業エージェントが書き換えない決まりがない | B＋C | 確かめた：worker.agent.md 42行は、書き換えてはいけないものに manifest.json と task.json だけを挙げる。generate.md 25行は流用のファイルを `parts/files/` に写し、39行で「流用する資産と写した場所」を渡すが、書き換えさせないとは書かない。REQ-035「流用すると示した部品は、作り直されていない」。 | worker.agent.md の B と C に、頼みに「流用する資産と写した場所」として書かれたファイルは書き換えず、合わないときは「足りなかったこと」に書いて返すことを理由つきで足し、generate.md の2にも書く。担当 B3、Opus（自然言語）、今すぐ。ハッシュで比べる確かめは、決まりを足した後の外側の EVAL（資産のある週報の模擬ユーザー）で書き換えが見つかってから足す（今は採らない。KISS）。C：creator-structure.md 3.5 に、作業エージェントは流用のファイルを書き換えないことを書く。 |
| X2-08 外側の EVAL が「記録する」とした数を出していない | B | 確かめた：testing.md 6.5（181行）は、問いの数、1回の問いの欄の数、保留の項目と AI の判断の数、記録のツールが断った回数とその後に直したかを「記録する」とする。outer-grade.mjs と outer-run.mjs には、断った書き込み（`refused`）のほかに数がない。hearing.md 4.1 の「1回に1つ」を確かめる手段がこの数である。 | outer-grade.mjs に記録から数える関数を足し、record.json と outer-report.json の要約に出す（合否には入れない）。担当 D1c、Sonnet、D1d が tests/dev-eval/runner/ の今の直しを終えた後。 |
| X2-09 確かめる試験・EVAL・人の確かめがない要件がある | B＋C＋D | 確かめた：tests/creator と tests/dev-eval/runner の試験の名前に、REQ-019・022・026・028・032・034・045・046・047 がない。testing.md 9章の人の確かめは README の REQ-023 の分だけ。REQ-045・046（モデル）は、testing.md 5章 115行「サブエージェントとそのモデルは…採点に使う」とあるので、設計どおりに採点を足せる。REQ-028 は、受け入れ基準が「費用の低いモデルでも画面が REQ-005〜009 などを満たす」なのに、testing.md 6.5 の表は Claude Haiku 5.5 に2点しか求めない。作り直し（REQ-032〜036）は、模擬ユーザーの範囲（ユーザーの答え20）にない。 | (1) outer-grade.mjs に、作業エージェントのサブエージェントが費用の低いモデルで動いたか（REQ-046）と、メインのモデルが指定のモデルか（REQ-045）を足す。担当 D1c、Sonnet（X2-08 と同じ束）。(2) Haiku のときの合格に1・2段目を足す（C：testing.md 6.5 の表を先に直す。直した後に D1c）。(3) 作り直しをどこで確かめるかは D-3 で聞く。(4) REQ-019・022・047 と、REQ-020・024・026・027 の残りの受け入れ基準は、最終確認の人の確かめの一覧に入れる（C：testing.md 9章）。外側の EVAL に新しい観点として足すのは、設計書にないので採らない。 |
| X2-10 試験の名前の番号がないもの、中身と合わないもの | B | 確かめた：tests/creator/scaffold/test_scaffold.py は 122件中 74件に番号がない。record-tools.test.mjs 245〜383行の REQ-049 はナレッジの欄の確かめ、tools.test.mjs 109・123行の REQ-049 は設計の決まり（説明の文の置き場所）で、REQ-049（質問の改善案）ではない。doc-text.test.mjs の REQ-033 は REQ-017（ファイルを読んで確かめる）に当たる。 | 確かめる中身の要件の番号に直し、要件でない設計の決まりの試験は、設計書の節の印（D1d と同じ形）にそろえる。担当は試験のファイルの元の担当ごと：C2（test_scaffold.py。B1 の後）、C1（tests/creator/extension/）、C3（tests/creator/test-plugin/ の番号のないもの）。Sonnet（どの要件を確かめるかの判断が要る）。 |
| X2-11 出どころ「ユーザーが自分から話した」をいつ使うかがない | B＋C | 確かめた：SKILL.md 88行は出どころの種類を並べるだけ。「自分から話した」を使う場面は start.md 16行と confirm.md 10行だけ。hearing.md 11章・REQ-049 の観点1は「記録したときに項目が未着手でなかった」かつ出どころが「自分から話した」を拾うので、ヒアリングの途中に別の項目の話が出たときに「ヒアリングの答え」にされると、改善案の対象から落ちる。設計書 hearing.md 7.3（477行）も決め方を書いていない。 | SKILL.md の「記録のしかた」に、その項目を聞いた問いへの答えなら「ヒアリングの答え」、聞いた問いとは別の項目のことなら「ユーザーが自分から話した」と1行ずつ足し、items.md・assets.md・screen.md の記録の文はそれを指す。担当 B3、Opus（自然言語）、今すぐ。C：hearing.md 7.3 の出どころの欄に、決め方を書く。 |
| X2-12 生成前の確認の後に作業の定義の案だけを直しても、「生成」へ進める | B＋C | 確かめた：hearing.mjs の `changesSinceConfirmation`（404行）は「決まった」ナレッジだけを比べ、creator.mjs の `confirm` は `taskPath` だけを残す。画面の直しの後に `plugin-creator_confirm` を呼び直し忘れると、ユーザーが見た見本と違う作業の定義で作られる（REQ-020・REQ-027）。 | `confirm` で draft/task.json の中身のハッシュを `confirmation` に残し、段階を「生成」に進めるときに今の中身と比べ、違えば「示し直してください」で断る。試験を足す。担当 C1、Sonnet、今すぐ。組み立てのスクリプトでの二重の確かめは採らない（generate.md は draft をそのまま写すので、C1 の確かめで足りる。KISS）。C：hearing.md 6.3 に、確認の後に作業の定義の案が変わったら示し直すまで生成に進めないことを書く（C1 が足したナレッジの確かめと同じ扱い）。 |
| X2-13 作業エージェントへの「`{{plugin_name}}` と書いてよい」が、そのまま足すファイルでは効かない | B | 確かめた：worker.agent.md 71行は区別なく「書いてよい」。scaffold.py は `parts/files/` の中の `{{…}}` を置き換えない（tasks/C2.md）。 | 71行を「差し込み口の文（`slots/`）では書いてよい。`files/` の下のファイルでは置き換わらないので、manifest.json の `plugin_name` の名前をそのまま書く」にする。担当 B3、Opus（自然言語）、今すぐ。 |
| X2-14 試験的機能の有効にし方と、読み込みの確認の題が、本物と違う | A＋B | `/experimental on` の部分は X1-18 と同じ（A）。題の名前の部分：README 38・57・58行、setup.md 6・9行、ひな形の README 37・57・58行と入口のスキル 48・54行が「<名前>」「…」のまま。V1 2節・3節で、題は `Extension "plugin:plugin-creator:plugin-creator" wants elevated permissions`（生成プラグインは `plugin:<名前>:<名前>`）と分かった。 | 題の名前を、クリエイターは `plugin:plugin-creator:plugin-creator`、ひな形は `plugin:{{plugin_name}}:{{plugin_name}}` にする。同じ節を `/settings experimental on` の案内で直すので、案内の直しの束（下の 2.4）と同じ頼みにする。担当 B3（README・setup.md、Opus）、A4（ひな形の README、Sonnet、移した後）、B2（入口のスキル、Opus、移した後）。 |
| X2-15 make-plugin を読むたびに、ひな形のファイルのパスが届く | A | ユーザーの答え25（ひな形をスキルのフォルダの外に移す）。V1 が確かめた（V1 7.1）：クリエイターの直下の `template/` に移しても、ひな形のスキル・エージェント・エクステンション・MCP・マニフェストはどれも読み込まれず、「Related files」は 97 件から 16 件になる。 | ひな形を移す担当（下の 2.2）。 |
| X2-16 結果のファイルの場所を相対パスで渡すと、作業フォルダから探される | B | 確かめた：creator.mjs 278行は `path.resolve(workDir, p)`。test-plugin の手順8と descriptions.mjs 16行・73行は `tests/results/latest.json` と相対の形で書き、EVAL の結果のファイルの名前（`result.json`）も書かない。generate.md 70行も場所の形を書かない。 | 手順8と generate.md の4の8を「`<生成プラグインのフォルダ>/tests/results/latest.json` と、`eval.mjs run` の出力の `resultFile`（絶対パス）を渡す」にし、descriptions.mjs の `results` と `results.paths` に「絶対パス」と足す。担当 B3、Opus（自然言語。descriptions.mjs の文は BLUEPRINT 7章で B3 が仕上げる）、今すぐ（descriptions.mjs は C1 の X2-02 の後）。 |
| X2-17 EVAL の頼むときの言葉に、入力のファイルの場所を書く決まりがない | B＋C | 確かめた：tasks.mjs の `prepareWorkDir` は、eval.json の `inputs`（`inputs/<名前>`）を作業フォルダの同じ相対の場所に写す。confirm.md 2は「作業に要る情報をすべて書く」だけで、場所を書くとは言わない。見つけられるかは最初の EVAL の記録で分かる（X2 の確かさは「たぶん」）が、書いておけばあり・なしの差がファイル探しの差にならない。 | confirm.md の2に、入力のファイルは試験のときに作業フォルダの `inputs/<名前>` に置かれるので、頼むときの言葉にその場所を書くこと（例：「inputs/〇〇 をもとに…」）を足す。担当 B3、Opus（自然言語）、今すぐ。C：testing.md 10.4 の「頼むときの言葉には、作業に要る情報をすべて書く」に、入力のファイルの場所を含むと書く。 |
| X2-18 同じ画面を「クリエイターの画面」と「plugin-creator の画面」と呼ぶ | B | 確かめた：creator.mjs 96・232・239・283行、ui/static/creator.js 65・303・330行、index.html 6行が「クリエイター」。SKILL.md・README・descriptions.mjs は「plugin-creator の画面」（B3-fix の決めたこと10）。「クリエイター」はユーザーに説明されていない言葉（REQ-024）。V1 2節の実機の返り値にも「クリエイターの画面」が出た。 | 返り値・画面の題・creator.js の文の「クリエイター」を「plugin-creator」にそろえ、試験の期待を直す。担当 C1、Sonnet、今すぐ。words.md の表と見張りに「クリエイター」を足すのは、ユーザーの答え8・22の表を変えることになるので採らない（文をそろえれば足りる）。 |
| X2-19 クリエイター自身の1・2段目を1つの入口で動かせない | B | 確かめた：testing.md 51行「1・2段目の仕組みは、外側と内側で同じものを使う」、BLUEPRINT 1章「tests/creator/ … ひな形の試験の仕組みを使い」。実際は check_creator.py と、node の3か所、unittest の3か所、dev-eval の3か所を別々に動かす（briefs/T1.md がコマンドを並べている）。ひな形の run.py の Python の試験の探し方は `<stage2-dir>/task/test_*.py` だけ。 | tests/creator/ に、ひな形の run.py を `--stage1-script tests/creator/check_creator.py` などで呼び、2段目の node と unittest の場所を並べて動かす入口を置き、段階ごとの合否をファイルに書く。run.py に場所を足す引数が要るなら、ひな形の run.py も直す。担当 A3、Sonnet、移した後（run.py はひな形のファイル。入口の中のひな形の場所も移した先にする）。 |
| X2-20 生成の段階で答えが来なかったときの扱いが、本文と generate.md で食い違う | B＋C | 確かめた：SKILL.md 116〜119行は「このスキルの終わりまで」有効の決まりとして、答えが来なければ止まる。generate.md 62行と improve.md 32行は、入れない・出さないとして先へ進む（B3-fix の決めたこと11）。 | SKILL.md の「答えが来ないとき」の対象をヒアリングの問い（生成前の承認まで）にし、生成の段階の承認は generate.md と improve.md のとおりに進めると1行足す。担当 B3、Opus（自然言語）、今すぐ。C：hearing.md 5.5（既出：B3-fix）。 |
| X2-21 議事録の模擬ユーザーに話し方の5種がない | D | 確かめた：weekly-report の persona.json の `styles` は normal・terse・vague・dont-know・nothing-special・hurry、meeting-minutes と training-survey は normal だけ。ユーザーの答え20の括弧（docx・xlsx のファイル、例外のある決まり、たまたまの書き方、話し方の5種を足す）が、週報だけか2人ともにかかるかが、文からは決まらない。 | 下の D-1 で聞く。足すなら担当 D1b、Sonnet（ユーザー役の試験も通す）。 |
| X2-22 生成プラグインの名前が plugin-creator と同じでも断らない | B＋C | 確かめた：generate.md 14行の名前の決まりと scaffold.py の `load_manifest`（326〜329行。NAME_RE と長さだけ）は `plugin-creator` を断らない。同じ名前だと、エクステンションのツール（`plugin-creator_open` など）とマーケットプレイスの名前が、クリエイターのものと重なる。tasks/C2.md の要確認のまま。 | generate.md の名前の決まりに「`plugin-creator` にしない」を足し（担当 B3、Opus、今すぐ）、scaffold.py の `load_manifest` でも断って試験を足す（担当 C2、Sonnet、B1 の後）。C：creator-structure.md（組み立てが断ること）と hearing.md（生成プラグインの名前の決まり）。 |

## 2. 担当ごとの直しの束（B）

同じファイルを2つの担当が同時に直さないよう、3つの段に分けた。段の中の束は並べて動かせる。1つのファイルを2つの束が直すときは、矢印の順にする。

### 2.1 段1：今すぐ動かせる（B1 の今の直しと、ひな形の移動を待たない）

| 束 | モデル | 直すファイル | 指摘 | 自然言語の部分 |
| --- | --- | --- | --- | --- |
| C1 クリエイターのエクステンション | Sonnet | com.github.copilot/extensions/plugin-creator/tool-defs.mjs、creator.mjs、hearing.mjs、descriptions.mjs（足す引数の説明は【仮】だけ）、ui/static/creator.js、ui/static/index.html、tests/creator/extension/*.test.mjs | X2-02（confirm の evalTasks に設定の値、記録と画面）、X2-12（作業の定義の案のハッシュ）、X2-18（「クリエイター」→「plugin-creator」）、X2-10（tests/creator/extension の試験の名前） | ツールの返り値の文（モデルが読む）。説明の文は B3 が仕上げる |
| B3 クリエイターの自然言語の部品 | Opus | skills/test-plugin/SKILL.md、skills/make-plugin/SKILL.md、references/screen.md・confirm.md・generate.md・items.md・assets.md、com.github.copilot/agents/worker.agent.md、descriptions.mjs（C1 の後） | X1-10/X2-04（手順6）、X2-05（手順7）、X2-06（手順4）、X2-16（手順8・generate.md・descriptions.mjs）、X2-01、X2-02（C1 の後：confirm.md 3 の2、generate.md、説明の文）、X2-07、X2-11、X2-13、X2-17、X2-20、X2-22（generate.md） | すべて（SKILL.md、references、エージェントの定義、ツールの説明）。R1 の書き方で書き、点検を立てる |
| C3 test-plugin のスクリプト | Sonnet | skills/test-plugin/scripts/run.mjs（D-2 の答えが1なら）、tests/creator/test-plugin/*（試験の名前） | X2-10（tests/creator/test-plugin の番号のない試験）、X1-16（D-2 の答えしだい） | なし |
| D1c 外側の EVAL | Sonnet | tests/dev-eval/runner/outer-grade.mjs、outer-run.mjs、outer-grade.test.mjs | X2-08（記録する数）、X2-09 の(1)（REQ-045・046 のモデル）。(2)（Haiku の合格に1・2段目）は testing.md 6.5 を直した後 | なし |
| D1b 模擬ユーザー | Sonnet | tests/dev-eval/personas/meeting-minutes/ | X2-21（D-1 で「足す」と答えたときだけ） | 模擬ユーザーの話し方（ユーザー役に渡る文） |
| 統括 | — | wip/implementation/BLUEPRINT.md、research/V1-copilot-cli-smoke.md か R1（事実の追記） | X1-17（`readme-task` を消す）、X2-05 の事実（`bash` の `initial_wait`・`mode`・終わりの知らせ）を報告に残す | なし |

- 順番：C1（descriptions.mjs に【仮】）→ B3（descriptions.mjs を仕上げる）。B3 は X2-02 の分を最後にし、ほかを先に進める。
- D1c が直す outer-grade.mjs・outer-run.mjs・outer-grade.test.mjs は、D1d が今直している inner-*.mjs・fake-anthropic.mjs・test_convert.py と別のファイルなので、並べてよい。D1d がこの後に頼まれる統括のツールの絞り方の合わせ（RESUME の D1d の行）が outer-*.mjs に及ぶなら、その後にする。
- C3 の X1-10 の GUIDELINE を埋める仕事は、波 E の EVAL の後（下の 2.4）。

### 2.2 段2：B1 の今の直し（統括の tools）が終わった後

| 束 | モデル | 直すファイル | 指摘 | 自然言語の部分 |
| --- | --- | --- | --- | --- |
| ひな形を移す担当（答え25） | Sonnet | skills/make-plugin/assets/template/ → クリエイターの直下の `template/`（V1 7.1 で確かめた名前）。パスを書いている skills/make-plugin/SKILL.md・references/confirm.md・generate.md、scripts/scaffold.py、com.github.copilot/extensions/plugin-creator/screen.mjs、tests/creator/check_creator.py・scaffold/test_scaffold.py、tests/dev-eval/test_convert.py | X2-15、X1-13 の「Related files」の部分 | SKILL.md と references のパスの書き換え（中身は変えない） |
| C2 組み立てのスクリプト | Sonnet | skills/make-plugin/scripts/scaffold.py、tests/creator/scaffold/test_scaffold.py | X2-03（eval.json と確かめた課題の突き合わせ。C1 の X2-02 の後）、X2-22（名前 plugin-creator を断る）、X2-10（test_scaffold.py の試験の名前） | なし |

- 順番：B1 → ひな形を移す担当 → C2。ひな形を移す担当は、段1の B3 と C1 が SKILL.md・confirm.md・generate.md・screen.mjs を直し終えてから始める（同じファイルのパスを書き換えるため）。

### 2.3 段3：ひな形を移した後（ひな形のファイル）

| 束 | モデル | 直すファイル（ひな形の中） | 指摘 | 自然言語の部分 |
| --- | --- | --- | --- | --- |
| A1 中心の処理 | Sonnet | extensions/_plugin_/core/github.mjs・recovery.mjs、tests/stage2/core/harness.mjs・restart.test.mjs・filing.test.mjs（ほか偽物の gh を使う試験） | X1-06（STEP_REPOSITORY の文）、X1-15（途中で切れた知らせの範囲）、X1-11（偽物の gh の試験を Windows で飛ばす） | 画面に出る手順の文（STEP_REPOSITORY） |
| A2 画面 | Sonnet | extensions/_plugin_/ui/static/app.js、tests/stage2/ui/screen.test.mjs・server.test.mjs、クリエイターの試験の新しいファイル（例：tests/creator/ui-reuse/*.test.mjs。C1 のファイルと分ける） | X1-05（「生成プラグイン」の文）、X1-19（Playwright の入れ方）、X1-14（REQ-043 の2件を tests/creator/ へ） | 画面の文 |
| A3 1段目と試験の入口 | Sonnet | extensions/_plugin_/core/task.schema.json、tests/stage1/check_structure.py、tests/stage1/selftest/（ひな形の外の tests/creator/stage1/ へ移す）、tests/run.py、クリエイターの試験の入口（tests/creator/ の新しいファイル） | X1-13（自己試験を移す。最初にする）、X1-07（key に maxIterations を除く）、X1-09（eval.json の採点のしかたの形）、X1-14（knowledge の試験の印）、X2-19（クリエイター自身の1・2段目の入口） | なし |
| A4 文書のひな形 | Sonnet | docs/design/design.md、docs/specs/requirements.md | X1-03、X1-04、X1-06（5.3 の理由）、X1-12、X1-01 に伴う 3.5 の表（答え24） | なし（文書） |
| B1 つなぎ口の試験 | Sonnet | tests/stage2/adapter/shutdown.test.mjs | X1-11（シグナルの試験を Windows で飛ばす） | なし |

- A3 の中の順番：自己試験を移す（X1-13）→ 自己試験に試験を足す（X1-07、X1-09）。
- A1 と A3 は core/ の中の別のファイルを直すので、並べてよい（A3 は task.schema.json だけ）。
- A3 のクリエイターの試験の入口（X2-19）は、A2 と A3 が tests/creator/ に足す試験（ui-reuse、stage1）も動かす。A2 の後に入口を仕上げるか、入口がフォルダを探す形にする。
- A4 は、2.4 の案内の直しのうち、ひな形の README・requirements.md・design.md 2.3 の分も受け持つ。同じ design.md を直すので、段3の束と同じ頼みにする。

### 2.4 ほかの結果を待って頼むもの

| 束 | モデル | 待つもの | 直すファイル | 指摘 |
| --- | --- | --- | --- | --- |
| 案内の直し（`/settings experimental on` と確認の題の名前） | Opus（B3・B2）、Sonnet（A4） | V1 の確かめは済んだ（V1 7.2）。仕様 REQ-004・REQ-023 の `/experimental on` の言葉を変えるかのユーザーの答え。ひな形の分は、ひな形の移動の後。クリエイターの分（B3）は、段1の B3 の束と同じ頼みにしてよい | B3：README.md、skills/make-plugin/references/setup.md。A4：ひな形の README.md、docs/specs/requirements.md の REQ-004、docs/design/design.md 2.3。B2：ひな形の skills/_entry_/SKILL.md | X1-18、X2-14（確認の題を `plugin:plugin-creator:plugin-creator`／`plugin:{{plugin_name}}:{{plugin_name}}` に） |
| C3 の GUIDELINE | Sonnet | 波 E の EVAL（1回あたりのトークン数）と、Copilot の価格表の確かめ | skills/test-plugin/scripts/estimate.mjs、tests/creator/test-plugin/estimate.test.mjs | X1-10/X2-04 の(2) |

## 3. D の問いの案

ユーザーと話すときの決まり（RESUME の節）に合わせ、前提はチャットの文で先に短く示し、選択肢には選ぶと何が起きるかだけを書く。

### D-1 議事録の模擬ユーザーの話し方（X2-21）

前提（チャットで先に示す）：
- ユーザーの答え20は「試作の2人（週報、議事録）を直して使い（docx・xlsx のファイル、例外のある決まり、たまたまの書き方、話し方の5種を足す）」だった。
- 今は、週報の模擬ユーザーだけが話し方の5種（短く答える、あいまいに答える、分からないと答える、特にないと答える、急ぐ）を持ち、議事録の模擬ユーザーはふつうの話し方だけである。

問い：議事録の模擬ユーザーにも、話し方の5種を足しますか？

- 議事録にも足す（おすすめ）：外側の EVAL で、話し方を変えたときのヒアリングを、週報と議事録の2つの作業で確かめられる。回す回数は、今までどおり EVAL を回す前の確認で決める。
- 週報だけでよい：今のまま。話し方を変えたときのヒアリングは、週報の作業だけで確かめる。

おすすめの理由：答え20の文は2人ともにかかると読むのが自然で、話し方による違いが作業の分野によるものかを、1つの分野だけでは見分けられないため。足しても、回す回数は EVAL の前の確認で決めるので、費用が勝手に増えることはない。

### D-2 EVAL でできた実行の記録（X1-16）

前提（チャットで先に示す）：
- 生成プラグインは、実行の記録（Web管理画面の準備中の画面で開ける前の結果と、承認していない Issue の案を含む）を `<COPILOT_HOME>/plugin-data/<名前>/runs/` に残し、20件を超えると古いものから消す（generated-plugin-structure.md 6.5）。
- test-plugin の EVAL は、ユーザーの COPILOT_HOME のまま生成プラグインを動かすので、EVAL の実行の記録も同じ場所に、課題の数×回数の分だけ入る。
- 生成プラグインには、試験のためだけの機能を足さない決まりである（testing.md 10.4）。

問い：EVAL でできた生成プラグインの実行の記録を、どう扱いますか？

- EVAL が終わったら、test-plugin が EVAL でできた実行の記録を消す（おすすめ）：ユーザーがふだんの作業でした実行の記録は、EVAL で消えない。EVAL の結果は、今までどおり生成プラグインの tests/results/ に残る。
- 今のままにし、README に注意を書く：EVAL の後に、ふだんの作業の古い記録（承認していない Issue の案を含む）が消えることがある。
- 古い記録を消す数え方を、作業フォルダごとにする：ふだんの作業の記録は EVAL で消えなくなるが、EVAL の記録は消えずにたまり続ける（EVAL は1回ごとに別の一時フォルダで動くため）。

おすすめの理由：生成プラグインを変えずに（試験のための機能を足さずに）、ふだんの記録を守れるのは、この選択肢だけであるため。

### D-3 作り直しの流れの確かめ（X2-09 の(3)）

前提（チャットで先に示す）：
- 既存のプラグインを作り直す流れ（仕様 REQ-032〜REQ-036）を、開発の試験で通して動かすものがない。外側の EVAL の模擬ユーザー（ユーザーの答え20の4人）に、作り直しを頼む人がいないためである。
- 最終確認で人が確かめる一覧（testing.md 9章）にも、作り直しは入っていない（以前の形式のプラグインを受け取れるかだけは、hearing.md 14章で最終確認に回っている）。

問い：作り直しの流れを、どこで確かめますか？

- 最終確認で、人が手元の Copilot CLI で作り直しを1回頼んで確かめる（おすすめ）：模擬ユーザーは今の4人のまま。testing.md 9章の一覧に足す。
- 作り直しを頼む模擬ユーザーを1人足し、外側の EVAL でも確かめる：開発の試験で繰り返し確かめられるが、模擬ユーザーを作る作業と、EVAL の回数と費用が増える。

おすすめの理由：作り直しは、既存のプラグインを受け取って読み取る部分のほかは、新しく作るときと同じ流れ（仕様 creation-requirements.md 6章の冒頭）なので、違う部分は1回の通しで確かめられ、答え20で決めた模擬ユーザーの範囲を変えずに済むため。

## 4. C の文の一覧（最後の報告に入れる）

「既出」は、RESUME の「報告すること」にすでにあるもの（重ねて足さない）。

| 番号 | 指摘 | 文書と節 | 直すこと |
| --- | --- | --- | --- |
| C-01 | X1-03 | generated-plugin-structure.md 4.13・6.5・10章 | 既出（A1、答え14）。 |
| C-02 | X1-04 | generated-plugin-structure.md 3.4・7章・10章、creator-structure.md 2章・4.1 | 既出（B1、C2）。土台に adapter.mjs、試験は偽物の SDK のセッション。 |
| C-03 | X1-06 | generated-plugin-structure.md 4.11（428行・431行）、表の 292行 | 「インストールしたプラグインはコピー」は、GitHub のマーケットプレイスから入れたときだけである。手元のフォルダのマーケットプレイスから入れると、コピーされずにそのフォルダを読み、編集は次のセッションで反映される（V1 1節）。起票の手順の理由と、定義のファイルを書き換えない理由を、この2つの入れ方に合わせて書き直す。 |
| C-04 | X1-07 | generated-plugin-structure.md 6.4 | 作業ごとの設定の key に `maxIterations` を使わない（画面の繰り返しの上限の欄と id がぶつかる）。 |
| C-05 | X1-09 | testing.md 2章・10.1 | 生成プラグインの1段目は、eval.json の採点のしかたの形（check の種類と項目、settings の値の型、key が作業の定義の settings にあること）まで、EVAL の採点のスクリプトと同じ決まりで確かめる。 |
| C-06 | X1-10/X2-04 | testing.md 8.2 | 目安は、開発の試験で測った1回あたりのトークン数に、既定のモデルの Copilot の価格をかけた、1回あたりの AI クレジット（あり・なし・採点）として test-plugin に持たせる（実装の形）。測るまでは、初めての EVAL で見込みを示せず、REQ-040 の受け入れ基準を満たさない（最後の報告の「残り」）。 |
| C-07 | X1-11 | testing.md 10.2・11.2 | 生成プラグインの1・2段目を動かす OS（Linux・macOS・Windows）と、Windows で飛ばす試験（偽物の gh、終了の合図）を書く。仕様書と設計書は対象の OS を書いていない。 |
| C-08 | X1-12 | output-requirements.md REQ-011、generated-plugin-structure.md 4.1・4.3・4.7・4.8・6.2 | REQ-011・4.3・4.8 の頼みの文と基準の食い違い（既出：答え23）。4.3 の指示文の始めの1文と、6.2・4.2 の実行中に呼ばれたときの知らせ（既出：A1）。4.7 の3つ目の原因（既出：A4・B3）。4.1 の読み込みの確認の選択肢に「Yes, and don't ask again … this session」がある（README と合わせる）。 |
| C-09 | X1-13 | creator-structure.md 2章 | 部品の表に、ひな形の1段目の自己試験の置き場所（ひな形の外）を書く。 |
| C-10 | X1-15 | generated-plugin-structure.md 4.13 | 途中で切れた実行を「次に画面を開いたときに示す」のは、4.2 の前の実行と同じ範囲（同じセッション、なければ同じ作業フォルダ）に限る。 |
| C-11 | X1-16 | generated-plugin-structure.md 6.5、testing.md 10.4 | D-2 の答えに合わせて、EVAL の実行の記録の扱いを書く。 |
| C-12 | X1-01 | generated-plugin-structure.md 4.4・4.7・4.8、testing.md の1段目 | 既出（答え24）。ひな形の design.md 3.5 の表も同じ形に直す（A4 の束）。 |
| C-13 | X2-01 | hearing.md 7.2・7.3 | 7.3 に画面の3項目で決めた設定と表示を残す欄がない（既出：B3）。7.2 に、抜き書きは1つの答えの中の言葉だけにすることを足す（testing.md 6.5 の採点と合わせる）。 |
| C-14 | X2-02/X2-03 | hearing.md 6.5・7.1、creator-structure.md 3.5・4.1、BLUEPRINT 8章 | 生成前の確認の記録に、EVAL の課題の設定の値（繰り返しの上限と作業ごとの設定）を入れる。組み立てのスクリプトは、eval.json が確認でよいと答えた課題（頼むときの言葉、入力のファイル、基準の組、設定の値）と同じかを確かめ、違えば断る。 |
| C-15 | X2-06 | testing.md 10.1 の手順1 | 道具の確かめを、1・2段目の前（1・2段目の道具）と、EVAL を始めてよいと答えた後（EVAL の道具）の2回に分ける。EVAL の道具を入れないと答えても、1・2段目の結果は示す。 |
| C-16 | X2-07 | creator-structure.md 3.5 | 作業エージェントは、流用すると決めたファイルを書き換えない（合わないときは足りなかったこととして返す）。REQ-035 のため。 |
| C-17 | X2-09 | testing.md 6.5・9章 | 6.5 の表の Claude Haiku 5.5 の合格に、1・2段目に通ることを足す（REQ-028 の受け入れ基準のため）。9章の人の確かめに、REQ-019・REQ-022・REQ-047 と、REQ-020・REQ-024・REQ-026・REQ-027 の自動で見ていない受け入れ基準を足す。作り直し（REQ-032〜036）は D-3 の答えに合わせて書く。 |
| C-18 | X2-11 | hearing.md 7.3 | 出どころの欄に決め方を書く：その項目を聞いた問いへの答えは「ヒアリングの答え」、聞いた問いとは別の項目のことを話したときは「ユーザーが自分から話した」。 |
| C-19 | X2-12 | hearing.md 6.3 | 生成前の確認の後に作業の定義の案が変わったら、示し直すまで生成に進めない（ナレッジの確かめと同じ。C1 が足したナレッジの確かめも設計書にまだない：既出）。 |
| C-20 | X2-14/X1-18 | output-requirements.md REQ-004、creation-requirements.md REQ-023、generated-plugin-structure.md 4.1・4.7、creator-structure.md | `/experimental on` の案内（既出：V1。V1 の確かめの結果で書き直す）。読み込みの確認の題の名前は `plugin:<プラグイン>:<フォルダ>` の形（V1 2節・3節）。 |
| C-21 | X2-17 | testing.md 10.4 | 「頼むときの言葉には、作業に要る情報をすべて書く」に、入力のファイルの場所（作業フォルダの `inputs/<名前>`）を含むことを書く。 |
| C-22 | X2-20 | hearing.md 5.5 | 既出（B3-fix：生成の後の承認に答えが来なかったときの扱い）。 |
| C-23 | X2-22 | hearing.md（生成プラグインの名前の決まり）、creator-structure.md 4.1 | 生成プラグインの名前を `plugin-creator` にしない（ツールとマーケットプレイスの名前が重なる）。組み立てのスクリプトも断る。 |
| C-24 | X1-08 | generated-plugin-structure.md 4.8・6.2・4.13、R2 3.3 | 既出（V1、B1）。断りは失敗の結果（理由の文つき）で返す。 |

## 5. 仕分けの数

X1 の19件と X2 の22件のうち、X1-10 と X2-04 を1つにまとめ、X2-14 の `/experimental on` の部分は X1-18 に含めた。行は40。

| 仕分け | 件数 | 指摘 |
| --- | --- | --- |
| A（決まっている・進んでいる） | 5 | X1-01、X1-02、X1-08、X1-18、X2-15（ほかに X1-13・X2-14 の一部） |
| B（実装を直す） | 33 | うち C もつくもの 21（X1-03・04・06・07・09・10・11・12・13・15、X2-01・02・03・06・07・09・11・12・17・20・22）。X2-09 は D もつく |
| C だけ（実装は今のまま） | 0 | 上位の文書を直すものは、どれも実装の直しと組になった（4章の24の文） |
| D（ユーザーの判断） | 2 | X1-16（D-2）、X2-21（D-1）。ほかに X2-09 の作り直し（D-3） |
| E（採らない） | 0 | 行ごとには0。行の中で採らなかった案：X1-11 の core に試験のための引数を足す案、X2-03 の組み立てが課題を書く案、X2-07 のハッシュの確かめ、X2-09 の外側の EVAL に新しい観点を足す案、X2-12 の組み立てでの二重の確かめ、X2-18 の words.md の表を変える案 |
