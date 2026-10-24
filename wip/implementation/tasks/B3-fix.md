# B3 を直す担当のメモ

指示：briefs/fix.md、briefs/common.md、briefs/B3.md。指摘：reviews/B3-design.md（19件）、B3-format.md（7件）、B3-models.md（24件）、B3-language.md（34件）。合わせて 84件。
B3 の後に決まったこと：RESUME.md のユーザーの答え18（直しの上限3回）・19（合格の条件が0件のとき）、EVAL の課題の実物の入力のファイルは組み立てのスクリプトが manifest.json の eval_inputs で写す（統括の決定）、生成の後の直しのコミットとタグの git の名前とメール（tasks/C2.md）。

## 状態

- [x] 読む（指摘4つ、B3 の書いたもの、根拠の文書：憲章、hearing.md、creator-structure.md、generated-plugin-structure.md 4.1・4.7・4.9・6.4・9章、testing.md 8.2・10章、BLUEPRINT 4・7〜9章、RESUME.md、R1、C1 の descriptions.mjs・report.mjs・creator.mjs、C2 の scaffold.py とメモ、C3 の check_tools.py・eval.mjs、ひな形の入口のスキルとひな形の画面の見出し）
- [x] 指摘をまとめる（重なり。下の表の「まとめ」の列）
- [x] 直す（make-plugin の SKILL.md、references 14個と新しい setup.md、test-plugin の SKILL.md、reader・worker、README、説明の文の案、作った者のメモ tasks/B3.md の古くなった4か所）
- [x] 機械的な確かめ（下）
- [x] 指摘の扱いの表

## 直したファイル

- skills/make-plugin/SKILL.md
- skills/make-plugin/references/：start.md、receive.md、read.md、carried.md、last-time.md、deepen.md、rules.md、items.md、assets.md、screen.md、confirm.md（書き直し）、generate.md（書き直し）、improve.md、setup.md（新しく足した）。words.md は変えていない。
- skills/test-plugin/SKILL.md（書き直し）
- com.github.copilot/agents/reader.agent.md、worker.agent.md
- README.md
- wip/implementation/tasks/B3-tool-descriptions.md（説明の文の案。C1 が取り込む）
- wip/implementation/tasks/B3.md（決めたこと・要確認・上位の文書の、決まった後で古くなった4か所に、決まったことを書き添えた）
- plugin.json、.github/plugin/marketplace.json は変えていない。

## 指摘の扱い

まとめ：同じ直しで受けた指摘を、同じ記号でまとめた。
- A：実物と仮の入力のファイル（D-08、D-09、D-18、D-21）
- B：コンパクションと再開の後の続け方（M-02、D-20、M-07、M-03、M-08、M-10）
- C：生成の続け方と終わる条件（D-02、M-13、M-16）
- D：エクステンションのツールがないとき（D-01、D-15、L-21、M-09）
- E：合格の条件が0件のとき（D-07、M-11）
- F：「ほかにありますか？」の出どころ（D-10、M-12）
- G：組み立ての断りと、作業エージェントへの頼み（D-14、M-14、F-1、M-22）

| 指摘 | 重さ | まとめ | 扱い | 直したところ・理由 |
| --- | --- | --- | --- | --- |
| D-09 | high | A | 直した | generate.md 1：manifest.json の形に `eval_inputs`（from＝実物の絶対パス、to＝`tests/eval/<課題の番号>/inputs/<名前>`）を足し、実物をシェルで写す手順を消した。仮のファイルは、確認で示した中身のまま、メインのエージェントが `parts/files/tests/eval/<課題の番号>/inputs/` に書く（C2 の実装と RESUME.md の C2 の報告のとおり。hearing.md 6.5 の「組み立てのスクリプトがファイルに書く」とは違うので上位の文書へ）。2で渡すものを置き場所にし、仮の中身を渡すのをやめた |
| D-18 | high | A | 直した | worker.agent.md：入力のファイルは `files/` に書かず、`inputs` に頼みの置き場所を `inputs/<名前>` で書く。課題のフォルダの名前は頼みの課題の番号にする（メインのエージェントの eval_inputs の to と合わせるため） |
| D-21 | low | A | 直した（案）・依頼 | B3-tool-descriptions.md に `evalTasks.inputs.path` の文を足した。descriptions.mjs への取り込みは C1 に頼む |
| D-08 | medium | A | 直した | confirm.md 2・3：仮のファイルの場所を生成プラグインの中の置き場所にし、確認で「仮」と書いて作った中身をそのまま示す |
| M-02 | high | B | 直した | SKILL.md 始まりの手番3：`plugin-creator_state` を「最後の問答」つきで呼び、記録していない答えを記録してから、最後の問いの次の手順から続ける（hearing.md 7.4 の使い道） |
| D-20 | medium | B | 直した | SKILL.md 先頭の決まり5：`--continue`・`--resume` で戻ったときも make-plugin を読み直して「始まりの手番」から進める。手番の2で画面の URL を示し直す（hearing.md 8章） |
| M-07 | low | B | 直した | 始まりの手番3：「前回の1回」から後の段階なら deepen.md も読み直す。段階の一覧の下の同じ文は消した（2か所に書かない） |
| M-03 | medium | B | 直した | 段階の一覧：段階はファイルの手順を最後まで終えてから「次へ」のとおりに進め、終わる条件を満たしても手順が残れば進めない。表の終わる条件は hearing.md 3.1 のまま |
| M-08 | low | B | 直した | start.md の冒頭：段階「始まり」で読み直したときも読み、記録にあることは記録し直さない |
| M-10 | low | B | 直した（一部） | 選んでもらった後は、新しく「早く」などの発言があるまで出し直さない。選んだ進め方は、最後の問答で拾える範囲にとどめた（記録の欄を足さない。KISS） |
| D-02 | medium | C | 直した | 表の「生成」の終わる条件を、タグ `plugin-creator-generated` が付き、説明と改善案を示した、にした。始まりの手番3の段階「生成」は、ユーザーが別のプラグインを頼んだかで分け、そうでなければ generate.md の続きの決め方で続ける |
| M-13 | medium | C | 直した | generate.md 冒頭：`.plugin-creator-work/` があれば組み立ての前（manifest.json がなければ1、あれば2）、なければ組み立て済みで、生成プラグインのフォルダ（最初のコミットの説明で見分ける）にタグがなければ4、あれば4の8。manifest.json を1の最後に書く。直しの回数が分からなければ残りを1回とする（直すたびのコミットで数える案は、git の操作が増えるので採らない）。2を頼み直すときは state.json から写す |
| M-16 | low | C | 直した | generate.md 4の5：「直すのをやめて7に進む」にした |
| D-01 | medium | D | 直した | 新しい references/setup.md に、入口のスキルと同じ3つの原因と、確認の意味・許可する理由・選び方を書き、本文から名指しした（creator-structure.md 4.3）。本文の3つの箇条は setup.md に移した |
| D-15 | medium | D | 直した | test-plugin も `../make-plugin/references/setup.md` を読む（同じことを2か所に書かない） |
| L-21 | low | D | 直した | setup.md と README を、ひな形の入口のスキルと同じ「Load & Augment か Load Only」にそろえた |
| M-09 | low | D | 直した | 始まりの手番1（と test-plugin の手順1）：「ツールを探すツールがあれば、それでも探す」。ひな形の入口のスキルと同じ書き方 |
| D-07 | medium | E | 直した | confirm.md 2：合格の条件が1つもないときは、confirm を呼ぶ前に聞き出す問いで聞き、種類・項目「合否の決め方」、状態「決まった」、出どころ「ヒアリングの答え」で記録し、項目が「決まりなし」なら「聞いた」にする。自分で決めない・種類を変えて作らないことを理由つきで書いた。3で基準の案を外して0件になったときも同じに聞く（出どころは hearing.md 6.3 のとおり「生成前の確認で足した」） |
| M-11 | medium | E | 直した | confirm.md 3：合格の条件がないと断られたら、2のとおりに聞く |
| D-10 | medium | F | 直した | confirm.md 1の2：出どころを「ユーザーが自分から話した」に決めた（下の「決めたこと」1）。設計書に書くよう上位の文書へ |
| M-12 | low | F | 直した | D-10 と同じ |
| D-14 | medium | G | 直した | generate.md 1：名前は作業フォルダにまだないフォルダの名前（作り直しでは元と別）。3の3：manifest.json・写したファイル・仮の入力・出力先の断りは自分で直し、作業エージェントが書いた slots・files の断りだけ作業エージェントに直させる。この直しは、限りなく続かないよう、4の3回に数える（下の「決めたこと」6） |
| M-14 | medium | G | 直した | D-14 と同じ |
| F-1 | medium | G | 直した | generate.md 1：名前の決まり（1〜64文字、ハイフンで始めず終えず、`--` なし）と、説明と description の決まり（1行、1024文字以内、`<`・`>` なし）を足した。「I can」の決まりは、description を日本語で書くので書かない |
| M-22 | low | G | 直した | confirm.md・generate.md の頼みの初めに仕事の名前を書く。worker.agent.md：頼みの初めにどの仕事かが書かれていること、部品の直しは B で、slots・files の自分のファイルを直すこと |
| D-12 | medium | | 直した | generate.md 4の2：check_tools.py に `--scope stage12` を付けた |
| D-13 | medium | | 直した | generate.md 4の7：`-c commit.gpgsign=false … commit --no-verify`、名前かメールが空なら `-c user.name=plugin-creator -c user.email=plugin-creator@localhost`、タグは軽いタグ `tag -f`（tasks/C2.md と scaffold.py の first_commit と同じ決め方） |
| D-05 | low | | 直した | start.md 3：できていたことの確認を「最近やった1回の流れを聞く」の前に入れる |
| D-06 | medium | | 直した | items.md：聞き直さないのは、決まりの確かめで確かめた元のプラグインの決まりがある項目だけ。できていたことは数に入れず、示して確かめる |
| D-11 | low | | 直した | confirm.md：「ユーザーが言っていなければ 3」。理由は「決めたこと」7 |
| D-16 | low | | 直した | improve.md：ナレッジの番号が見つからない不合格は数えない |
| D-17 | low | | 直した | README と improve.md：許可の確認では今回だけ許可する選択肢を選ぶ（R2 の PermissionDecision に approve-for-session・approve-permanently がある） |
| D-19 | low | | 直した（メモ） | 公式ドキュメントで確かめた。下の「確かめた公式の事実」1。assets.md は変えない |
| M-01 | medium | | 直した | 先頭の決まり4：「生成プラグインのファイルを、自分で書くことも作業エージェントに書かせることも」。generate.md 4の3：自分では直さない（理由つき） |
| M-04 | medium | | 直した | 先頭の決まり8：生成前の確認の一覧と案、区切りの要約、できたことの説明、質問の改善案は、短く答える指示があっても省かずチャットに書く（REQ-020・REQ-022） |
| M-05 | medium | | 直した | make-plugin と test-plugin：`task_complete` を呼ぶ理由と、この場面では説明の文より決まりを優先すること、促されても記録を変えないこと（hearing.md 5.5 の理由） |
| M-06 | low | | 直した | generate.md 4の2：答えが来なければ入れないときと同じ。improve.md：答えが来なかった案は出さない。設計書に扱いがないので上位の文書へ |
| M-15 | medium | | 直した | generate.md 2：補えるのは、よいと答えた内容と1で決めたことだけ。ユーザーにしか分からないことは補わず、できたことの説明で示す |
| M-17 | low | | 直した | confirm.md 3の3：聞いていない初めの値・選択肢・必須かは、AI の案として分けて示す（hearing.md 6.3） |
| M-18 | low | | 直した | rules.md・carried.md：「ほか N件」で切れたら、確かめた後に `plugin-creator_state` を呼び直すと残りが出る（候補から外れた分だけ次が出る。C1 の report.mjs の作り）。state.json を読ませる案と C1 への引数の依頼は採らない |
| M-19 | medium | | 直した | test-plugin の決まり7：生成プラグインのファイルを直さない（理由つき）。手順5の「ここでは」を消した |
| M-20 | low | | 直した | test-plugin の決まり8：コンパクションの後は tests/results/ を見て、EVAL の承認が会話になければ聞き直す（REQ-040） |
| M-21 | medium | | 直した | worker.agent.md：番号は、そのナレッジで動きが変わる指示の文（4つの差し込み口とスクリプト）に入れて添える。仕様書などに書くだけでは入れたことにならない（creator-structure.md 3.5、testing.md 10.3） |
| M-23 | medium | | 直した | reader.agent.md の返す形：短くまとめずにすべて返す（理由つき） |
| M-24 | low | | 直した | reader.agent.md の雛形：資産・できていたこと・部品の行にも、引用つきの出どころを付けた |
| F-2 | medium | | 依頼 | この環境では Copilot CLI を動かさない（testing.md 1章）ので確かめられない。最終確認の手順に入れるよう統括に頼む（下の依頼3）。marketplace.json は変えない |
| F-3 | low | | 直した | SKILL.md「問いの形」：どの段階でも `<pasted_content>` のファイルが答えであることと、文書がそのまま届いたら自分で読むことを置いた。receive.md・read.md は段階に特有の扱いだけを残した。hearing.md 3.1 との食い違いを上位の文書へ |
| F-4 | low | | 直した | SKILL.md：スキルのフォルダのファイル（scripts と assets/template）は Base directory からの絶対パスで扱う。confirm.md のスキーマの場所も同じ言い方にした |
| F-5 | low | | 直した（要確認） | 勧めの (a)：今のままにし、要確認4に書いた。setup.md も同じ読み方をする |
| F-6 | low | | 直した | reader・worker：「返す形」を「してはいけないこと」の前に移した。続ける1文は「してはいけないこと」の末尾に残した |
| F-7 | low | | 直した | worker：mcp.json の決まりに理由（閉じた形で、type のないサーバーや知らない項目のあるサーバーは読み飛ばされる。R3 1.3）。confirm.md：「必ず」を外し、どの課題にも入っていない合格の条件があると1段目が落ちる理由を添えた（check_structure.py で確かめた） |
| L-01 | medium | | 直した | クリエイターの画面は「plugin-creator の画面」と呼ぶ（始まりの手番2、confirm.md、generate.md、test-plugin）。start.md と screen.md の問いの例は「できあがるプラグインの作業の画面」と名指しした。words.md の表は変えない |
| L-02 | low | | 直した | おすすめの理由を、疲れと「質問しないで」の両方に合う文にした |
| L-03 | low | | 直した | 「聞くことごとに1問」 |
| L-04 | low | | 直した | 問いの形：「できあがるプラグインの AI が」。assets.md の例も直した |
| L-05 | low | | 直した | start.md：手元にないときはダウンロードしてもらう1文を足した |
| L-06 | low | | 直した | receive.md の問いの例を書き直した（試験の課題・パス・1回の言い方） |
| L-07 | low | | 直した | receive.md：括弧の並びはファイルを指す言葉で答えの例ではない、と1文。items.md の「使う道具と環境」は例を外した |
| L-08 | medium | | 直した | last-time.md：未経験の作業の問いを、終わるまで順に聞く文にした。hearing.md 3.3 を上位の文書へ |
| L-09 | low | | 直した | last-time.md の3つの問いの例に、なぜ聞くかの1文を足した |
| L-10 | low | | 直した | deepen.md：合格の例とやり直しの例を、別の問いで1つずつ聞く。hearing.md 5.2 を上位の文書へ |
| L-11 | medium | | 直した | rules.md：続けて聞く問いに、確かめた決まりの文を書き直す。「本当はどうか」の問いの例も足した |
| L-12 | low | | 直した | items.md：場面と言い方を2つの問いに分け、「呼ばれない」を「動き出さない」にした |
| L-13 | low | | 直した | items.md：「最後に作るもの（成果物）」 |
| L-14 | low | | 直した（一部） | ひな形の画面の見出しが「繰り返しの上限の回数」「課題と Issue の案」なので、言葉は変えずに説明を括弧で添えた。実行中の問いの理由の文は直した |
| L-15 | low | | 直した | README：最初に出る所で「セッション」を説明し、その後は「セッション」にそろえた。SKILL.md の案内にも「別のセッション（Copilot CLI の別の会話）」 |
| L-16 | low | | 直した | README：1文にまとめた |
| L-17 | low | | 直した | README：「続けるときにもう一度聞かれます」 |
| L-18 | low | | 直した | README の4か所の主語と向き |
| L-19 | low | | 直した | README：「Copilot CLI を起動したフォルダの外」 |
| L-20 | low | | 直した | README：試しに動かして採点する試験でさせる作業と、その合格の条件 |
| L-22 | low | | 直した | 公式のコマンドリファレンスで確かめた（下の「確かめた公式の事実」2）。README と両方のスキルに「Shift+Tab でモードを切り替えて autopilot を切る」 |
| L-23 | low | | 依頼 | 会話例を置く担当（D1）に、置いた後に「あります」に直すよう頼む（依頼4）。B3.md の決まりどおり、今は置き場所だけ |
| L-24 | low | | 直した（一部）・依頼 | SKILL.md の「まだ聞いていない項目を示し」を「まだ聞いていないこと（項目の名前）」にした。返り値と画面の見出しは C1 に頼む（依頼2）。hearing.md 7.5 の例を上位の文書へ |
| L-25 | low | | 直した | confirm.md 3の見出しを、示す言葉で書いた |
| L-26 | low | | 直した | 承認の問いの例を、confirm.md 4、generate.md 4の2、improve.md、test-plugin の手順4・6に書いた |
| L-27 | low | | 直した | generate.md 4の2 と test-plugin の手順4：道具ごとに何に使うかを1句添える |
| L-28 | low | | 直した | generate.md 5：6つを示す言葉で書き、見出しも内部の言葉にしない。不合格の理由は言い直す（test-plugin の手順5も） |
| L-29 | low | | 直した | improve.md：案の前に、どの聞き方が足りなかったかと仕事の中身が入っていないことを伝える。選択肢を README とそろえて「出さない」「出す」 |
| L-30 | low | | 直した | test-plugin の手順6・8：選択肢と結果の言葉、あり・なしで比べることを1文で伝える |
| L-31 | low | | 直した | worker の description：「作業の定義の案〔task.json〕」 |
| L-32 | low | | 直した | README のインストール：マーケットプレイスの説明、@ の前後、ダウンロードしたフォルダと絶対パス |
| L-33 | low | | 採らなかった | 確認の題の「<名前>」に何が入るかは R2・設計書・公式ドキュメントにない（R2 の 3.10 は「<名前>」のまま）。推し量って書かない。要確認5 |
| L-34 | low | | 直した | README：試験の道具の置き場所を「できたプラグインの試験」の節に移した |

数：直した 81件（うち D-21・L-24 は C1 への依頼つき、F-5 は要確認つき）、ほかの担当への依頼にした 2件（F-2、L-23）、採らなかった 1件（L-33）。

## 統括から頼まれた続きの仕事（B2-fix の「ほかの担当への依頼」4）

- [x] worker.agent.md の「書き方の決まり」に1項目を足した：「見出し：`entry-task`・`orchestrator-task`・`worker-task.<agent>`・`verifier-task` の文で見出しを使うときは、`###` 以下にする。これらの文は、ひな形の `##` の節（「作業ごとの指示」「このプラグインがする作業」）の中に入るので、`#` や `##` で書くと節が分かれ、組み立てのスクリプトも断るためである。」
- ひな形で、4つの差し込み口がどれも `##` の節の下にあることを確かめた（worker・orchestrator・verifier の「## 作業ごとの指示」、入口のスキルの「## このプラグインがする作業」）。`task-requirements`（`### REQ-101`）と `task-design`（`### 8.1`）は、もともと `###` で書く決まりなので、対象に入れていない。
- 組み立てのスクリプトが `#`・`##` の行を断るのは、C2 が直す（B2-fix の依頼5）。この文は、その断りを先に知らせるもの。
- 足した後：worker.agent.md の本文 129行、3,604トークン、5,816文字（30,000文字以内）。1段目の構造の検査のカスタムエージェントの項目は合格のまま。

## 統括から頼まれた続きの仕事2（返り値の見出しを、C1 が言葉の置き換えの表を当てた後の文に合わせる。ユーザーの答え22、C1 のメモの要確認0）

C1 の今の返り値の文は、report.mjs の stateText、hearing.mjs の remainingLine と断りの文、creator.mjs の confirm の断りの文、names.mjs の sourceDisplay・knowledgeStatusDisplay で確かめた。引数の値（段階・聞くことの名前、include の「最後の問答」「振り返りの材料」、出どころの「ファイルから読んで確かめた」など）は変わっていない。

| ファイル | 古い名指し | 今の返り値の文に合わせた名指し |
| --- | --- | --- |
| references/items.md 3行目 | 項目の状態と、確かめていない候補 | 返り値の「聞くことの状態」と「確かめたいこと（仕事のやり方や決まりのうち、状態が「候補」のもの）」 |
| references/rules.md 7行目 | `plugin-creator_state` の確かめていない候補 | 返り値の「確かめたいこと（仕事のやり方や決まりのうち、状態が「候補」のもの）」 |
| references/carried.md 7行目 | 同上 | 同上 |
| references/rules.md・carried.md | 「ほか N件」 | 「ほか〇件」（返り値は「ほか12件」のように空白なし） |
| references/improve.md 9行目 | 「質問の改善案の対象のナレッジ」 | 「質問の改善案の対象の仕事のやり方や決まり」 |
| references/generate.md 48行目 | ヒアリングの記録（state.json） | 返り値の「お話を聞くことの記録（state.json）」 |
| references/generate.md 42行目 | `plugin-creator_state` が示す state.json | 返り値の「お話を聞くことの記録（state.json）」のファイル |
| references/confirm.md 9行目 | 未着手の項目がないこと | 返り値が「まだ聞いていないことはありません。」（hearing.mjs の remainingLine） |
| references/confirm.md 3の断り | 未着手の項目は聞く、合格の条件がないと断られたら | 断りの文の頭「まだ聞いていないことがあるので」「種類が「合否の決め方」の仕事のやり方や決まりがありません」「画面と合格の条件の設定の案が決まりに合いません」で名指しした。2つ目の断りの文は「種類を「合否の決め方」にしてください」と求めるので、ほかの決まりの種類を変えて済ませないことも、ここで添えた（M-11） |
| SKILL.md 始まりの手番3 | このセッションの記録がなければ | （段階が「（お話を聞くことの記録はまだありません）」）を添えた |

- そのままにしたもの（返り値と同じ字）：「最後の問答」「振り返りの材料」「問答の記録のすべて」「保留」「AI の判断（ユーザーが任せたこと）」「セッションの番号」「まだ聞いていないこと」、出どころの「ファイルから読んで確かめた」「既存のプラグインから読んで確かめた」。test-plugin の SKILL.md、setup.md、エージェント2つは、返り値の見出しを名指ししていない。
- 確かめ（2026-10-24）：make-plugin の SKILL.md の本文 119行・4,748トークン（5,000未満）、test-plugin 44行・2,038トークン。references は15個とも 20KB 未満（いちばん大きい generate.md が 12,841 バイト・87行、confirm.md 8,570 バイト）。1段目の構造の検査の SKILL.md と references の項目は合格（不合格は会話例がないことの1件だけで、前と同じ）。
- 気づいたこと（C2 へ。直していない）：scaffold.py の断りの文は「ヒアリングの記録」「生成前の確認」など古い言葉のまま。メインのエージェントがユーザーに示すときは words.md で言い換えるので、食い違いの害は小さい。

## 決めたこと

1. 「ほかにありますか？」の答えの出どころは「ユーザーが自分から話した」にした（D-10、M-12）。この問いは特定の項目を聞かないので、そこで出た決まりは、項目を聞いたのに出なかったもので、質問の改善の材料（hearing.md 11章の1つ目の観点）になるため。項目が未着手のまま出た話は、エクステンションが対象から外す。
2. 合格の条件が0件のときの出どころ：確認を示す前に聞いたときは「ヒアリングの答え」（ユーザーの答え19の「生成前の確認に進む前に」）、確認の中で基準の案を外して0件になったときは「生成前の確認で足した」（hearing.md 6.3）。
3. `plugin-creator_open` がないときの直し方は、make-plugin の references/setup.md に1つだけ置き、test-plugin からも読む（creator-structure.md 4.3 の「入口のスキルと同じにする」を、同じことを2か所に書かずに満たすため。make-plugin の本文も短くなる）。
4. 課題には `T-01` から番号を付け、課題のフォルダの名前にする。メインのエージェントが書く eval_inputs の to と、作業エージェントが書く eval.json の置き場所を合わせるため。
5. 仮の入力のファイルは、承認の後にメインのエージェントが、確認で示した中身のまま parts/files/ に書く（C2 の実装。作業エージェントに書き写させると、確かめた中身が変わりうるため）。
6. 組み立ての断りのうち作業エージェントに直させた分も、生成の後の直しの3回（ユーザーの答え18）に数える。数えないと、直しが限りなく続きうるため。
7. 繰り返しの上限の初めの値は、ユーザーが言っていなければ3（BLUEPRINT 4.1 の例の値。画面の開始前の設定で毎回変えられる）。
8. 生成の続け方の手がかりは、`.plugin-creator-work/` の有無、manifest.json の有無（1の最後に書く）、タグの有無。直しの回数が会話から分からなければ、残りを1回とする（直しすぎない側）。
9. 再開（`--continue`・`--resume`）の後は make-plugin を読み直して「始まりの手番」から進める。手番の2で画面の URL をいつも示すので、変わったかを見比べなくてよい。
10. クリエイターの画面をユーザーに示すときの呼び方は「plugin-creator の画面」（README とツールの説明の文がすでにこう呼ぶ）。words.md の表は変えない（ユーザーの答え8の表のため）。
11. 道具を入れる承認に答えが来なかったときと、入れないと答えたときは、試験をせずに4の7（印を付ける）に進む。B3 の初版は5に飛んでいて、印が付かなかった。

## 確かめた公式の事実（2026-10-24 に取得）

1. [Finding and installing plugins](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing)：「Copilot comes with one marketplace already registered by default: `awesome-copilot`.」、コマンド「copilot plugin marketplace browse MARKETPLACE-NAME」（D-19。assets.md の記述と合う）。
2. [GitHub Copilot CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)：キーの表「Shift+Tab：Cycle between standard, plan, and autopilot mode.」（L-22）。

## 要確認

1. EVAL の回数の既定（仮に3回。testing.md 8.2 が未決。B3 の要確認2のまま）。
2. マーケットプレイスの `source: "./"` で入れられるか（F-2。B3 の要確認3、C2 の要確認と同じ）。
3. M-04 の「省かずにチャットに書く」が Claude 5 の族と GPT の族で効くか、M-09 のツールの後回しが起きるか（hearing.md 14章 H4）。外側の EVAL と最終確認で見る。
4. test-plugin が、隣の make-plugin のフォルダの references（words.md、improve.md、setup.md）を確認なしで読めるか（F-5）。最終確認で test-plugin を呼んで見る。読めなければ、test-plugin が使う部分を test-plugin の references に置く。
5. 読み込みの確認の題 `Extension "<名前>" wants elevated permissions` の「<名前>」に何が出るか（L-33）。分かれば README と setup.md に書く。

## ほかの担当への依頼

1. C1（descriptions.mjs）：B3-tool-descriptions.md の `confirm` の `evalTasks.inputs.path` の文（実物は絶対パス、仮のファイルは生成プラグインの中の置き場所 `tests/eval/<課題の番号>/inputs/<名前>`）を取り込む（D-21）。
2. C1（hearing.mjs の返り値、ui/static/creator.js の見出し）：ユーザーに見える「項目」を「聞くこと」にそろえる（例：「まだ聞いていない項目：…」→「まだ聞いていないこと：…」。L-24、B3-tool-descriptions.md の「返り値の文について」）。そろえないときは、words.md に「画面とツールの返り値は『項目』と出る」と書くかをユーザーに確かめる。
3. 統括（最終確認）：モデルを使わない次の確かめを最終確認に入れる（F-2）。`copilot plugin marketplace add <このリポジトリの手元のフォルダ>` → `copilot plugin marketplace browse plugin-creator` → `copilot plugin install plugin-creator@plugin-creator` → `copilot plugin list --json`。ひな形の marketplace.json（C2）も同じ形なので一緒に確かめる。あわせて、要確認4（隣のスキルのフォルダを読めるか）と要確認5（確認の題の名前）も見る。
4. D1（会話例）：examples/ に会話例を置いたら、README の「会話例」の「置きます」を「あります」に直す（L-23）。

## 上位の文書で直すこと

1. hearing.md 3.1・10.1 の段階の表：段階「生成」の行がない。コンパクションの後の生成の続け方（`.plugin-creator-work/`・manifest.json・タグの有無）と、記録で確かめられる終わる条件（タグ）を書く（D-02、M-13）。
2. hearing.md 7.4・8章：フックは段階が「生成」に進むと止まるので、生成の手番の中でコンパクションが起きても差し込みがなく、SKILL.md の本文が残らないと generate.md を読み直す手がかりがない（M-13）。範囲を生成の後まで広げるか、設計で決める。
3. hearing.md 6.5：仮の入力のファイルは、組み立てのスクリプトではなく、承認の後にメインのエージェントが parts/files/ に書く（C2 の実装）。実物は manifest.json の eval_inputs で組み立てのスクリプトが写す（統括の決定）。仮のファイルの中身は記録（state.json）に残らないので、承認の後、書く前にコンパクションが起きると、確かめた中身のとおりには戻せない。
4. hearing.md 6.4：ユーザーの答え19（合格の条件が0件のとき）と、確認の中で基準の案を全部外して0件になったときの扱い（出どころを含む。「決めたこと」2）を書く。
5. hearing.md 5.7・7.3：「ほかにありますか？」の答えの出どころ（「決めたこと」1）を書く。
6. hearing.md 3.1・2.4：`<pasted_content>` と文書がそのまま届いたときの扱いは段階「実物を受け取る」と「読む」に置かれているが、どの段階でも起きうる。R1 の勧め（落とし穴は本文に）に合わせて本文に置いた（F-3）。
7. hearing.md 3.3：未経験の作業の問いの例「初めてやるとしたら、最初に何をしますか？」を、終わるまで順に聞く文にする（L-08）。
8. hearing.md 5.2：判定できない合否の問いの例が2つを1つの問いで聞き、同じ節の「1つの問いで1点」とぶつかる（L-10）。
9. hearing.md 7.5：返り値の例「まだ聞いていない項目：…」が、ユーザーの答え8（項目→聞くこと）の前の書き方のまま（L-24）。
10. hearing.md 5.5・creator-structure.md 4.1・4.5：生成の後の承認（道具を入れる、Issue を起票する）に答えが来なかったときの扱いがない。入れない・出さないと答えたときと同じにした（M-06）。
11. creator-structure.md 4.1：組み立てが断ったときにだれが直すか（メインのエージェントが書いたものは自分、作業エージェントが書いたものは作業エージェント）と、その直しを上限の回数に数えるか（「決めたこと」6）。作業エージェントが足りないと返したときに補える範囲（M-15）。
12. hearing.md 3.2・REQ-034：作り直しで「読み取って確かめた項目」に、できていたことの確認で残しただけのもの（「〇〇と頼むと、〇〇をする」）を含めない、と書く（D-06）。
13. hearing.md 8章：再開の後は「URL が変わったら示す」だが、make-plugin を読み直して始まりの手番から進め、いつも示すことにした（「決めたこと」9）。
14. creator-structure.md 2章（README の行）・hearing.md 5.5：autopilot の切り方（Shift+Tab）を書く（公式のコマンドリファレンス、2026-10-24）。

## 機械的な確かめの結果

数え方：`/tmp/claude-0/-home-user-plugin-creater/f6e65e0d-9c94-5351-8ee1-475927b3b43e/scratchpad/b3/venv/bin/python …/scratchpad/b3/count.py <ファイル>`（tiktoken o200k_base、フロントマターを除いた本文）。点検の担当の measure.py でも同じ数になった。

| ファイル | 本文の行数 | 本文のトークン数 | バイト | 決まり | 判定 |
| --- | --- | --- | --- | --- | --- |
| skills/make-plugin/SKILL.md | 119 | 4,748（続きの仕事2の後） | 17,529 | 500行未満・5,000トークン未満 | 合う |
| skills/test-plugin/SKILL.md | 44 | 2,038 | 7,677 | 同上 | 合う |
| references/generate.md | 87 | 3,665 | 12,841 | 20KB 未満・100行以下 | 合う（いちばん大きい） |
| references/confirm.md | 52 | 2,387 | 8,570 | 同上 | 合う |
| references/setup.md（新） | 12 | 476 | 1,790 | 同上 | 合う |
| ほかの references 12個 | 19〜49 | — | 1,790〜4,640 | 同上 | 合う |
| agents/reader.agent.md | 59 | 1,307 | 5,136（本文 1,802 文字） | 本文 30,000 文字以内 | 合う |
| agents/worker.agent.md | 129 | 3,604 | 12,617（本文 5,816 文字。B2-fix の依頼4を足した後） | 同上 | 合う |

- 1段目の構造の検査 `python -I tests/creator/check_creator.py .`：合格 7、対象外 1（mcp.json がない）、不合格 1（会話例がまだない。直す前と同じ）。references 15個がすべて本文で名指しされている（setup.md を含む）。
- `python -I -m unittest discover -s tests/creator -p "test_check_creator.py"`：25件が通る。
- plugin.json と marketplace.json は変えていない（JSON として読めることを確かめた）。
