# D1b 作業のメモ：模擬ユーザーと、模擬ユーザーの形の決まり

担当の指示：wip/implementation/briefs/D1.md の「D1b」の節（共通：common.md）

置き場所（これ以外は作らない・変えない）：
- tests/dev-eval/personas/（FORMAT.md、requirements.txt、validate.mjs、validate.test.mjs、模擬ユーザー 3 人のフォルダ）

## 状態

印の意味：[x] できた（試験も通った）、[~] ファイルはできた（試験はまだ）、[ ] まだ

- [x] 読み込み（憲章、CLAUDE.md、RESUME、BLUEPRINT、testing.md、hearing.md、ナレッジ、R4、試作の personas と lib.mjs・outer.mjs・test_user_role.mjs・inner.mjs、C3 の grade.mjs・tasks.mjs、doc-text.mjs）
- [x] FORMAT.md（最初に書き上げた。統括に SendMessage で知らせた。その後の直し：CONFIRM_CHOICES の追記、recall・confirm・compound の質問が asked に当たること、コード名の削除。形の大きな変更はない）
- [x] validate.mjs（loadPersona、validatePersona、CONFIRM_ANSWERS、CONFIRM_CHOICES、KIND_ANSWER、STYLE_KEYS を export。コマンドは `node validate.mjs <フォルダ>… [--all-styles]`）
- [x] 週報 weekly-report/（示すファイル 3 つ〔docx、xlsx、csv〕、ナレッジ 5 件、話し方 6 種、内側の EVAL の基準 7 件）
- [x] 議事録 meeting-minutes/（示すファイル 2 つ〔docx、txt〕、ナレッジ 5 件、話し方は normal だけ、内側の EVAL の基準 5 件。試作にはなかった内側の EVAL を足した）
- [x] 研修アンケート training-survey/（まだやったことのない作業。ファイルなし、ナレッジ 5 件、内側の EVAL の基準 5 件）
- [x] docx・xlsx を作る make_files.py（weekly-report、meeting-minutes）。仮想環境は <スクラッチ>/d1b-venv（python-docx 1.2.0、openpyxl 3.1.5）
- [x] 試験 validate.test.mjs：40 件通った（`PERSONA_PYTHON=<venv>/bin/python node --test "tests/dev-eval/personas/*.test.mjs"`。python-docx と openpyxl が入った Python がなければ make_files.py の 2 件は skip）

## 決めたこと

- 置き場所：tests/dev-eval/personas/<id>/（persona.json、files/、make_files.py、inner/）。見ない模擬ユーザーも同じ形で tests/dev-eval/heldout/<id>/ に置く（H1）。
- 試作の 1 ファイル（JSON）から、1 人 1 フォルダに変えた。理由：docx・xlsx と、内側の EVAL の入力と見本を一緒に置くため。
- 内側の EVAL の課題は、C3 の eval.json の形（BLUEPRINT 4.3）をそのまま使う（inner/eval.json）。grade.mjs の validateTask・gradeProgram と、tasks.mjs の prepareWorkDir がそのまま使える。基準に `knowledge`（ナレッジの id）を必ず付ける。画面で選ぶモデルは書かない（画面の既定）。
- 内側の EVAL の見本（inner/golden/）を必須にした。program の基準が厳しすぎないか、書き間違っていないかを validate.mjs が確かめる。
- 形を確かめるスクリプトは Node（validate.mjs）。D1c が import できる。外部の npm パッケージなし。docx・xlsx の中の文字は、クリエイターの doc-text.mjs（documentText）で読む。
- ナレッジの言葉による見分けを、ナレッジごとにまとめた（試作は markers、userRoleTests.askedMarkers・leakMarkers・recall.marker に散っていた）：asked（聞いたか）、answered（答えたか）、leak（漏れ）、embedded（組み込まれたか）、excluded（入ってはいけないもの）、task（課題と基準に入ったか）。
- ファイルの中の決まりの種類：rule（このとおり）、exception（そうしないときもある）、incidental（決まりではなく、たまたま）、wrong（違う）。testing.md 6.1 は 3 種類を 1 つずつと書くが、決まりの確かめの 4 つ目の答え「違う」を確かめる材料が要るので、4 種目 wrong を足した（議事録の文体：代わりの人が「です・ます」で書いた）。
- 決まりの確かめに答える質問（confirm）を userRoleTests に足した。6.2 の 7 つの観点の「答える」の一部とした。選択肢は CONFIRM_CHOICES（hearing.md 6.1 の順）。
- 「指示のことを話さない」の言葉の一覧（試作の ARTIFACT）は、模擬ユーザー側ではなく、ユーザー役を動かす側が持つ。理由：言葉はユーザー役への指示の文に依るので、その文を書く側が持つのが自然。R4 は「模擬ユーザー側に持たせる」と書いたが、FORMAT.md に「ユーザー役を動かす側が持つ」と書いた。
- 急いでいる話し方の合図：話し方に signal（afterAnswers、text）を持たせ、ユーザー役を動かす側が決まった回数の後の答えに text を足して位置を記録する。理由：testing.md 6.5 の「急ぐ合図の後に」を機械的に見るには、合図の位置が決まっていないといけない。R4 の「話し方の 1 文だけで足りるかは、ユーザー役の試験で確かめる」は、instruction（答えを短くする）で併用する。
- 週報の内側の EVAL の採点を、試作の「52万」「520,000 がない」から変えた。試作の基準は、行ごとに切り捨てて足した合計（50万）を落とす曖昧さがあった（testing.md 7章の「ナレッジにない細かさまで求めると、正しい成果物を落とす」）。ナレッジ man-yen に「合計は円のまま足してから万円にする」を書き、入力を 4 行（田中 8,000 円の行を足した）にして、合計「47万円」と「1万円未満」を基準にした。
- 3 人目（まだやったことのない作業でファイルのない 1 人）の分野は、新人研修のアンケート集計（人事部の研修担当）にした。守らないと困ること（氏名を出さない）と並べ方（満足度の低い順）を聞かれないと話さないナレッジにした。想定の 1 回は id `first-run` のナレッジ。
- 示すファイルのうち role が input のものは、生成プラグインのリポジトリに入るかを外側の EVAL が見る（REQ-038。sha256 が同じ）。週報は先週の売上.csv、議事録は先週の文字起こし.txt。
- 内側の EVAL の課題の settings は maxIterations: 2 だけ（試作の limit 2 と同じ）。課題の設定の名前は生成プラグインごとに違うので task は書かない。
- 模擬ユーザーの名前・数・日付は架空。docx・xlsx の作成日時は固定（作るたびに中身が変わらないように）。

## 要確認

- 実際のモデルでのユーザー役の試験は、していない（common.md：本物のモデルは統括の承認の後）。次を、D1c のユーザー役の試験で確かめる：決まりの確かめ（confirm）に answer の選択肢で答えるか、vague・dont-know・nothing-special の聞き直しで答えが出るか、hurry の短い答え、`reveal` を広く書いた週報の headings・title-date と、narrow にした training-survey の anonymize が、大まかな質問で漏れないか。
- excluded の言葉は、生成プラグインが「〜はしない」と書いたときにも当たりうる（偽陽性）。最後は人が読んで確かめる（testing.md 6.3 と同じ扱い）。
- hurry の signal を D1c が実装すること。しないなら、FORMAT.md の signal を直す。
- 週報の docx・xlsx、議事録の docx は、python-docx・openpyxl で作ったもので、Word・Excel では開いて確かめていない（クリエイターの doc-text.mjs では読めて、validate.mjs の evidence の突き合わせが通っている）。xlsx の数式は値を持たない（openpyxl は計算しない）ので、doc-text.mjs の出力は「（式：=…）」だけになる。
- 人名（佐藤、鈴木、田中など）は一般的な名字で、実在の人を指さない。

## 上位の文書で直すこと

- creator-structure.md 2章の部品の表に、模擬ユーザー（tests/dev-eval/personas/、validate.mjs）の行がない（R4 でも既出）。追跡（憲章 第6条3項）のため足す。
- testing.md 6.1：ファイルに入れる決まりに、決まりの確かめの 4 つ目の答え「違う」に当たるもの（ファイルのとおりではない決まり）を足す。足さないと、「違う」の答えを外側の EVAL で確かめられない。
- testing.md 6.2：決まりの確かめにユーザー役が選択肢で答えること（confirm）が、7 つの観点のどれにも書かれていない。「答える」に含めるか、観点を足す。
- testing.md 6.3・6.5：急いでいる話し方の合図を、話し方の指示の 1 文でなく、試験の仕組みが決まった回数の後に足す形にした（signal）。設計書は R4 の注の「1 文で足りるかは試験で確かめる」までしか書いていない。
- testing.md 6.5：「課題の入力のファイルが、生成プラグインのリポジトリに入っている」を、模擬ユーザーの示すファイルのうち role が input のものが、同じ中身で入っていること、と読んだ。
