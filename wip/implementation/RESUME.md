# 実装：中断に備えたメモ（再開用）

クリエイターの実装の途中経過である。憲章・仕様書・設計書・実装資産のどれでもない。実装が終わったら、このフォルダは消す（残すべきことはナレッジ `.claude/memory/` に移す）。

## ユーザーの指示（2026-10-22、原文の要旨）

1. マルチエージェント構成で実装する。モデルは Opus 5.5・Sonnet 5.5・Haiku 5.5 のどれか。統括（メインのセッション）がタスクを分解し、サブエージェントに振る。高い思考力が要る仕事は Opus、言われたとおりに手を動かすだけの仕事は Haiku。
   - Agent ツールの別名は、opus＝claude-opus-5-5、sonnet＝claude-sonnet-5-5、haiku＝claude-haiku-5-5 であることを確かめた（2026-10-22）。
2. クレジットの上限で強制中断されることがある。チェックポイントを残し、手戻りを少なくする（このファイルと、こまめなコミットと push）。
3. 実装の途中で気づいたこと、上位の文書で直すべきことは、最後にまとめて報告する（下の「報告すること」に溜める）。
4. SKILL.md やカスタムエージェントなど、自然言語で書く部品には細心の注意を払う。学習データは古いので、常に最新で信頼できる情報（公式の仕様・ドキュメント・最新版の実装）で書き方を調べてから書く。これらの部品が全体の振る舞いを大きく変えることを重視する。
5. 不明点は、進める前にユーザーに質問する（CLAUDE.md 4章の形で）。
6. 一番大事なのは憲章。

## 進め方（段階）

| 段階 | 中身 | 状態 |
| --- | --- | --- |
| 0 | 準備（このファイル、ユーザーへの質問） | 進行中 |
| 1 | 調べる：R1 自然言語の部品の書き方（Opus）、R2 エクステンションと SDK の API（Opus）、R3 マニフェストとスキーマ（Sonnet）、R4 試作の流用（Sonnet） | 進行中。2026-10-22 02:23 に利用枠の上限で4つとも止まり、06:18 に再開。R1〜R4 すべて完了 |
| 2 | 実装の設計図（ファイルの配置、部品の間の窓口、データの形） | 完了：`BLUEPRINT.md` |
| 3 | 実装（部品ごとにサブエージェントへ。分担は BLUEPRINT 5章） | 進行中：波 A（A1〜A4、Sonnet）。A4 は完了。C1（Sonnet）と B3（Opus のワークフロー：書く→5つの観点で点検→確かめて直す→最後の確かめ）を 12:10 ごろ始めた。各自のメモは `tasks/<番号>.md` |
| 4 | 点検（作った者と別のエージェントが、仕様・設計と照らす）と1・2段目の試験 | B2・B3 は点検して直した。残り：V1（本物の Copilot CLI での読み込み）、全体の突き合わせの点検、すべての試験の通し |
| 5 | EVAL と会話例（範囲はユーザーの答え次第） | 未着手 |
| 6 | 報告 | 未着手 |

## ユーザーと話すときの決まり（このセッションで指摘された）

- ユーザー（開発者）への質問と説明では、憲章と設計書の用語（統括エージェント、作業エージェント、検証エージェント、エクステンション、Web管理画面、ツール名、イベント名など）を、そのまま正確に使う。言い換えや比喩（「部品」「まとめ役」など）を使わない。置き換えの表（答え8）は、クリエイターがエンドユーザーと話すためのもので、ユーザーとの会話には使わない。
- 分かりにくい問いは憲章 第9条に反する。前提は事実の短い箇条にし、問いは1文にする。
- 2026-10-24：ひな形の置き場所の問いが「憲章違反。何言ってるか伝わらない」と言われた。選択肢の説明に前提・数字・内部の仕組み（Related files、トークン、コンパクション）を詰め込んだのが原因。前提はチャットの文で先に短く示し、選択肢には「選ぶと何が起きるか」だけを書く。

## ユーザーの答え

1. クリエイターの名前：`plugin-creator`。リポジトリの名前の綴りの誤り（plugin-creater）に気づいたので、この機会に plugin-creator にそろえる（憲章 第3条も直して 0.25.0 にした。ユーザーの指示による改訂）。GitHub のリポジトリの名前の変更はユーザーが行う（時期は確認中）。
2. 範囲：①クリエイター本体、②ひな形、③1・2段目、④開発の EVAL と会話例をすべて作り、EVAL も回す（回す前に回数と費用の見込みを示して確認をとる）。
3. 疲れ・急ぎの問いのおすすめ：「ここでやめて後で続ける」（hearing.md 5.6 の未決が決まった）。
4. 合否の基準を作業の定義に写すのは、組み立てのスクリプト（hearing.md 6.4 の未決が決まった）。画面の見本にも、スクリプトが基準を差し込む。
5. GitHub のリポジトリの名前の変更は、実装を main に取り込んだ後にユーザーが行う。コードの中の URL は新しい名前（imaeda-hub/plugin-creator）で書く。
6. ヒアリングの記録を消す条件：自動では消さない。README に置き場所と消し方を書く（hearing.md 7.1 の未決が決まった）。
7. 作業の定義の案（画面の見本のための task.json の下書き）の置き場所：作業フォルダの中の一時フォルダに書き、生成のときに消す（testing.md 6.5 の未決が決まった。外側の EVAL は、この置き場所で案を見分ける）。
8. 内部の言葉の置き換えの表：統括が示した案でよい（hearing.md 4.3 の未決が決まった）。案の中身は下。
   - ナレッジ→仕事のやり方や決まり／ヒアリング→お話を聞くこと／生成プラグイン→できあがるプラグイン（この作業を任せる Copilot CLI のプラグイン）／統括・作業・検証エージェント→まとめ役・作業役・確認役の AI／合否の基準・評価基準→合格の条件／作業の定義→画面と合格の条件の設定／Web管理画面→作業の画面（ブラウザーで開く）／EVAL→試しに動かして採点する試験／構造の検査・部品の試験→ファイルの形の検査・動きの試験／候補→確かめたいこと／項目→聞くこと／生成前の確認→作る前の確認／試行→1回の試し／コンパクション→会話の自動の要約／スキル・フック・MCP・エクステンション・記録のツール→話さない。要るときは「プラグインの中の部品」と言い、名前を括弧で添える

9. 生成プラグインの憲章の中身：クリエイター憲章の第2章（共通条項）と第4章（生成プラグインの条項）を、生成プラグイン自身の決まりとして入れる（REQ-002 の2つは第2章に含まれる）。
10. SKILL.md の本文のトークンの数え方：OpenAI の tiktoken で数える（hearing.md 12章の未決が決まった。Python の部品を1つ足す）。
11. スキルの description：公式に合わせる。「何ができあがるか」を手順でない短い1句で書き、続けて呼ばれる場面と、呼ばれてはいけない似た頼みを書く。手順の要約は書かない（hearing.md 10.1 を直す必要がある）。クリエイターのスキルにも、クリエイターが書く生成プラグインのスキルにも効く。
12. description の言語：日本語。ユーザーが頼むときの言い方を入れる。
14. エクステンションが同じセッションのまま再起動したとき（/clear なし。extensions_reload、/extensions mode の切り替え）：前の実行の統括・作業・検証エージェントがまだ動いていれば、tasks.list で探して tasks.cancel で取り消し、実行を「途中で終わった（エクステンションが再起動した）」にする（generated-plugin-structure.md 4.13・6.5 を直す必要がある。今の設計のままだと、動き続けるエージェントが画面に出ず止められず、憲章 第21条に反する）。
15. 文書をテキストにするツール（plugin-creator_doc_text）は skipPermission で登録する（hearing.md 9章の未決が決まった。作業フォルダの外の文書も確認なしで読める）。
16. 試験の道具の置き場所：1・2段目の道具（Python の仮想環境と PyYAML・jsonschema、Node.js の playwright）は生成プラグインの tests/.venv と tests/node_modules（git に入れない）。EVAL の @github/copilot-sdk と playwright は <COPILOT_HOME>/plugin-data/plugin-creator/tools/ に1つ。ブラウザーは手元の Chrome・Edge、なければ Playwright の共通の場所（testing.md 11.2 の要確認が決まった）。
17. 生成プラグインの統括と検証の既定のモデル：`model: [claude-sonnet-5.5, gpt-6.1-sol]`（Sonnet 5.5 はすべてのプランで使え、Copilot CLI の既定。設計書は「思考力の高いモデル」としか書いていなかった）。作業は `model: [gpt-6-luna, claude-haiku-5.5]`。
18. 生成の後の構造の検査と部品の試験が不合格のときに、作業エージェントに直させる上限：3回（REQ-039。仕様と設計書に数がなかった）。
19. 「合否の決め方」が決まりなしで、基準の案も残らなかったとき：生成前の確認に進む前に、合格の条件を1つ以上、自由入力で聞いて「合否の決め方」のナレッジにする（hearing.md 6.4 に扱いがなかった。REQ-011・REQ-038 のため）。
20. 外側の EVAL の模擬ユーザー：試作の2人（週報、議事録）を直して使い（docx・xlsx のファイル、例外のある決まり、たまたまの書き方、話し方の5種を足す）、新しく2人を作る（まだやったことのない作業でファイルのない1人と、クリエイターを直すときに見ない別の分野の1人）。
21. 見ない模擬ユーザー：作るだけの別のエージェント（Sonnet）が分野も中身も決め、tests/dev-eval/heldout/ に置く。統括と、クリエイターを直すエージェントは、そのフォルダを読まない（EVAL の仕組みだけが読む）。読まないことは決まりで守る。
22. 言葉の置き換えの表（words.md）を当てる範囲：クリエイターのエクステンションのツールの返り値と、クリエイターの画面の文（見出し、説明、断る文）に当てる。段階と項目の名前（ツールの引数の値。SKILL.md と references もこの名前で書かれている）は変えない。
23. 生成プラグインの実行で、頼みの文と生成前に確かめた合否の基準が食い違うとき：基準を優先する。統括エージェントは、頼みの文の食い違う部分を使わないことを、計画とまとめに書いて画面で見せる（REQ-011 のまま。基準を変えたいときは、ユーザーが生成プラグインを直す）。仕様 REQ-011 と設計書 4.3・4.8 に足す必要がある。
24. V1 の不具合1（統括の tools）：統括エージェントの定義から `tools:` を消し、統括が使ってよいツールの一覧をエクステンションに持たせて、一覧にないツールは onPreToolUse で統括の agentType のときに拒む（2026-10-24。B1 に頼んだ）。設計書 4.4・4.7・4.8 と testing.md の1段目を直す必要がある。
25. ひな形（skills/make-plugin/assets/template/）を make-plugin スキルのフォルダの外（クリエイターの直下）に移す（2026-10-24。Copilot CLI がスキルを読むたびにフォルダの全ファイル名を足すため）。V1 が移した先が読み込まれないかを確かめてから、B1 の直しの後に移す。creator-structure.md・generated-plugin-structure.md・BLUEPRINT の置き場所の記述を直す必要がある。
26. 議事録の模擬ユーザーにも、話し方の5種を足す（2026-10-24。答え20は2人ともにかかる。X2-21）。
27. EVAL でできた生成プラグインの実行の記録は、EVAL の後に test-plugin が消す。ただし、EVAL で作った生成プラグインそのものは消さない（2026-10-24。ユーザーの言葉「作業記録は消してもいいけど作った生成プラグインは消さないで欲しい」。X1-16）。
28. 既存のプラグインの作り直しの流れ（REQ-032〜036）は、最終確認で人が手元の Copilot CLI で1回確かめる。testing.md 9章の一覧に足す（2026-10-24。X2-09 の(3)）。
29. 試験的機能の案内は「初めて使うときに `copilot --experimental` で起動する（次からは付けなくてよい）。起動した後なら `/settings experimental on`」にする。仕様書 REQ-023（creation-requirements.md）と REQ-004（output-requirements.md）の書き方は、ユーザーの承認を得て統括が直した（2026-10-24）。設計書（creator-structure.md、generated-plugin-structure.md）の `/experimental on` は最後の報告で示す。ユーザーは「セッションモードで使う予定」と言った（Copilot CLI の試験的機能の新しい画面の Session の画面のことなら、同じ切り替えで有効になる）。
13. ユーザーが「質問しないで作って」とはっきり頼んだとき：聞かないと仕事の決まりが入らない理由を1文で伝え、急ぎのときと同じ3つ（ここでやめて後で続ける〔おすすめ〕／残りを手早く聞く／このまま続ける）から選ばせる。推測で埋めて作らない（仕様 REQ-015 に足す必要がある）。

## 報告すること（最後にまとめて示す）

- R3：公式ドキュメントの `com.github.copilot/` の表に `extensions/` がない（更新履歴とコードにはある）。版を上げるたびに確かめ直す。ナレッジ plugins.md に commands・rules・extensions が抜けている。
- R3：`$schema` は完全一致で形式が決まり、書き間違えると黙って以前の形式になる。ナレッジの書き方より厳しい。
- R3：testing.md 2章の「公式のスキーマで検査する」だけでは足りない（相対パスの閉じ込め、mcp.json と plugin.json の版の一致、URL と command の決まり）。1段目に足す。
- R3：スキルの決まりが2つある（Agent Skills：小文字・数字・ハイフン、フォルダ名と一致。Copilot CLI はもっとゆるい）。Copilot 固有の項目は公式の参照実装 skills-ref で不合格になる。ナレッジ skills.md に足す。
- R3：mcp.json は閉じた形で type が必須。作業エージェントへの決まりにする。
- R3：手元のフォルダからのインストールは 1.0.102 で廃止予定と表示される。README のインストールはマーケットプレイス経由にする（手元のフォルダのマーケットプレイスなら、その場で読まれる）。仕様 REQ-004・REQ-023 の受け入れ基準の読み方に効く。
- R3：スキルのコマンド名は、コードでは `/<プラグイン>:<スキル>`、docs は `/<プラグイン>/<スキル>` と食い違う。
- R3：サブエージェントの深さの既定が docs（6）と更新履歴 1.0.71（4）で食い違う。
- R4：creator-structure.md 2章の部品の表に、開発の試験の部品（変換スクリプト、EVAL の実行の仕組み、模擬ユーザー、ユーザー役の試験）の行がない。追跡（憲章 第6条3項）のため足す必要がある。
- R4：試作の模擬ユーザー（週報・議事録）は、調べものでエージェントが読んだので、「クリエイターを直すときに見ない模擬ユーザー」には使えない。
- R4：開発の環境の Playwright は 1.56.1 に固定する（環境のブラウザーが 1.56.1 用。1.64.1 は起動に失敗）。
- R1：SKILL.md のフロントマターは Agent Skills の項目（name、description など）だけにする。allowed-tools・user-invocable・disable-model-invocation・argument-hint は、Agent Plugins 1.0.0 で飛ばされるおそれがある。設計書に書かれていない。
- R1：description の書き方を公式に合わせた（ユーザーの答え11）。hearing.md 10.1 を直す。
- R1：エージェントの model の書き方の食い違い（公式 models・modelPolicy、実装 model のリスト・model-policy）は 1.0.102 でも残る。公式に reasoningEffort と include-custom-instructions が載った。
- R1：サブエージェントとして動くカスタムエージェントは、include-custom-instructions を付けない限り AGENTS.md・copilot-instructions.md・CLAUDE.md を受け取らない。生成プラグインの統括・作業・検証が、ユーザーのリポジトリの指示を受け取らないことを、設計書に書く必要がある。
- R1：disable-model-invocation: true のエージェントは task で起動できない。
- R1・R2：1.0.102 で、サブエージェントが親のセッションで承認したエクステンションと MCP のツールの許可を引き継ぐようになった。generated-plugin-structure.md 4.14 と 11章 #21 の前提が変わりうる。
- R1：プロジェクトや個人のフォルダに同じ名前のスキル・エージェントがあると、プラグインのものは黙って無視される。作り直し（H12）と EVAL に効く。
- R1：hearing.md 8章が引く「OpenAI の手引き（GPT-5.6）：指示の繰り返しが不要な確認を増やす」の記述が、今のページに見つからない。出典を確かめ直す。
- R1：ユーザーが「質問しないで作って」と頼んだときの振る舞いが、仕様にも設計にもなかった（ユーザーの答え13）。
- R1：応答の言語は、具体の言語名で書くのが Anthropic の勧め（hearing.md 10.2 の6）。
- R2：選べるモデルの一覧の取り方：エクステンションから `rpc.models.list` は呼べない（クライアントの窓口）。`session.rpc.model.list()` を使う（返り値の型が決まっていない）。generated-plugin-structure.md 3.2、4.6、11章 #10 を直す。
- R2：`/clear` をしなくても、同じセッションのままエクステンションが起動し直すことがある（エージェントの extensions_reload、`/extensions mode` の切り替え）。6.5 の「自分のセッションの終わっていない実行は、すぐ途中で切れたとする」が成り立たない（扱いはユーザーに確認中）。
- R2：EVAL の隔離：requestExtensions: true の SDK のセッションは、すべての場所のエクステンションを読み込む。COPILOT_PLUGIN_DIR_ONLY はプラグインの探索しか止めないので、ユーザーの ~/.copilot/extensions/ も読み込まれる見込み（testing.md 10.4）。
- R2：許可の求めの受け口の第2引数に promptRequest が足され、人の承認が要るかは `invocation.promptRequest?.managedApprovalRequired` を先に見る（testing.md 10.4 の EVAL に効く）。
- R2：公式ドキュメントのエクステンションの入口のファイル名（.mjs・.cjs・.js）と、パッケージの説明（.mjs だけ）が食い違う。設計どおり .mjs にする。
- R2：サンドボックスが既定でローカルネットワークを許すようになった（1.0.100）。ナレッジ dashboard-integration.md のサンドボックスの節が古い。
- A4：生成プラグインの憲章のひな形は、クリエイター憲章の第2章・第4章を写したので、条番号に欠番がある。クリエイター憲章の第2章・第4章を改訂したら、ひな形も直す必要がある（追跡の仕組みはない）。
- A4：REQ-042（直した後の試験）は生成プラグインの仕様書に入れていない（内容は README と REQ-001 で受ける）。入れるかは判断が要る。
- A4：入口のスキルの「エクステンションのツールがないときの直し方」に、3つ目の原因（/extensions mode が Disabled）を足すよう、generated-plugin-structure.md 4.7 と creator-structure.md 4.3 に足す提案。
- A1：窓口の tasks.list はエージェントだけで、シェルの処理を課題にできない。generated-plugin-structure.md 4.10 の表と 11章 #14 に効く。
- A1：設計書 4.13・6.5・10章の「自分のセッションの終わっていない実行はすぐ途中で切れた」を、ユーザーの答え14に合わせて直す。
- B3：上位の文書で直すこと（tasks/B3.md の同じ節）。エクステンションのツールがないときの3つ目の原因（/extensions mode が Disabled）を creator-structure.md 4.3 と generated-plugin-structure.md 4.7 に足す。hearing.md 7.3 に画面の3項目で決めた設定と表示を残す欄がない。hearing.md 6.4 に基準が0件のときの扱いがない（ユーザーの答え19）。hearing.md 10.2 の7の決まりの範囲を「スキルの終わりまで」に広げた。hearing.md 4.2 の承認の形を、道具を入れる・EVAL を始める・Issue を起票する承認にも使った。hearing.md 11章・creator-structure.md 4.1：生成の後の直しをコミットし、タグ plugin-creator-generated を付けて「生成したときの状態」とする。hearing.md 6.5・testing.md 10.1：実物の入力のファイルは組み立てのスクリプトが写す（統括の決定。manifest.json の eval_inputs）。hearing.md 10.1 の本文の並びに「問いの形」の節を足した。
- B3：EVAL の回数の既定は、testing.md 8.2 のとおり未決（費用を測ってから）。仮に、あり・なしを3回ずつにし、承認の問いで変えられる。
- C1：上位の文書で直すこと（tasks/C1.md の同じ節）。hearing.md 7.1 に state.json の欄の名前を書く。generated-plugin-structure.md 9章に _confirm の引数と断る順、見本が別のサーバーであることを書く。hearing.md 6.3 に「確認で示した後にナレッジが変わったら、示し直すまで生成に進めない」を足した（設計書にない確かめ）。ツールに defer: "never" を足した（BLUEPRINT 7章）。
- C1：実機でしか確かめられないこと：ハイフンを含むツール名 plugin-creator_open の受け入れ、defer: "never"、onPostToolUse の toolArgs・toolResult の形、サブエージェントのコンパクションのイベント（H2）。
- B2：上位の文書で直すこと（tasks/B2.md の同じ節）。設計書 4.5 と BLUEPRINT 3.1 に「担当」に入れる項目（agentDisplayName）を書く。BLUEPRINT 8章に、足した決まった値（entry_skill_name、entry_skill_description、orchestrator_extra_tools、worker_extra_tools、verifier_extra_tools、worker_agents）と worker-task の対応を書く。設計書 4.8 に「計画の記録は、その試行の作業エージェントを呼ぶ前にする」を決まりとして書く。
- B2：土台の ui/static/render.js に JSDoc の `{{ el: … }}` があるので、土台は差し込み口の置き換えと「{{ が残っていないか」の確かめから外す（C2 に引き継ぎ済み）。
- B2→D1：統括の本文の task の引数の名前（agent_type、mode）は、Claude Code の Agent の引数と違うので、変換で置き換わらない。
- C2：上位の文書で直すこと（tasks/C2.md）。BLUEPRINT 8章の manifest.json に eval_inputs を足し、差し込み口の表をひな形の字（{{slot:worker-task}}、{{worker_agents}}、{{*_extra_tools}}）に合わせる。generated-plugin-structure.md 7章の土台に adapter.mjs を足す（check-base は extensions/_plugin_/ の下を全部比べる）。hearing.md 6.5：仮のファイルはメインのエージェントが parts/files/ に書き、実物は eval_inputs で build が写す。
- C2：要確認。marketplace.json の source "./" が手元のフォルダのマーケットプレイスから入るか（最終確認）。jsonschema のない Python で build したときは task.json の形の確かめを1段目に任せる（警告）。生成プラグインの名前が plugin-creator と同じとき断らない（記録のツールの名前が重なる）。
- C2→A3：1段目の自己試験が _plugin_ のパスを直書きしていて、生成プラグインの中では動かない（入口には響かない）。1段目に marketplace.json の確かめ（plugins[].name と plugin.json の name）を足す提案。
- C2：git の名前とメールが設定されていないときは、最初のコミットだけ plugin-creator <plugin-creator@localhost> を使う（設定ファイルは変えない）。生成の後の直しのコミットとタグ（plugin-creator-generated）は、同じやり方の git -c で行える。
- B1：上位の文書で直すこと（tasks/B1.md）。generated-plugin-structure.md 3.4・7章、creator-structure.md 2章・4.1：土台に adapter.mjs が加わる。3.2 の「偽物のつなぎ口」は「偽物の SDK のセッションを adapter.mjs に渡す」形になった。BLUEPRINT 3.1・3.2：tool.completed の toolName は開始から補う、tool.started に arguments、parentAgentId は tasks.list にない、agent.started.agentType のそろえ方。4.14：許可の受け口に requestId は渡らない。6.2：open の返り値の形。
- B1：実機でしか確かめられないこと：agentType・agentName の届き方、onSubagentStop が終わりのイベントより先に届くか、Auto の見分け（modelId が auto か）、model.list の要素の形、tool.started の arguments の全文が記録に残って大きくなりうること、Windows では SIGTERM を受けられないこと。
- C3：上位の文書で直すこと（tasks/C3.md）。testing.md 10.4・generated-plugin-structure.md 11章 #1・R2 3.10〜3.11：SDK でエクステンションを読み込むには requestExtensions: true だけでは足りず、extensionSdkPath と CopilotClient の extensionLaunchProvider が要る（本物の SDK 1.0.25 とランタイム 1.0.102 に偽物のモデルをつないで確かめた）。この方式では、読み込みのときの確認が許可の求めとして出ないので、--allow-tool の代わりの案は要らない。ユーザーの ~/.copilot/extensions/ のエクステンションは起動を断って混ぜない。EVAL は COPILOT_CLI_PATH を使わない。testing.md 11.2 の道具に npm が入る（EVAL の道具は npm install --ignore-scripts で約190MB）。
- C3：要確認（最終確認で人が見る）：assistant.usage の copilotUsage.totalNanoAiu と aiCreditsStatus、session_limits_exhausted.requested が届くか、サブエージェントの許可の求めが onPermissionRequest に届くか、COPILOT_PLUGIN_DIR_ONLY でほかのプラグインが混ざらないか、Node.js 20.19 での動き。extensionLaunchProvider は実験的な API なので SDK の版を固定した。EVAL の AI クレジットの目安は未測定（最初の EVAL で埋める）。
- C3→A3：1段目で eval.json の check.type の4種類と、種類ごとの必須の項目まで検査できる（今は check.type があることまで）。
- B3-fix：上位の文書で直すこと14件（tasks/B3-fix.md の同じ節）。主なもの：hearing.md 3.1・10.1 の段階の表に「生成」の行がなく、コンパクションの後の生成の続け方が決まっていない。段階「生成」ではフックが止まるので、生成の途中のコンパクションで読み直しの差し込みがない。「ほかにありますか？」の答えの出どころを「ユーザーが自分から話した」にした。生成の後の承認（道具を入れる、Issue を起票する）に答えが来なかったときの扱い。creator-structure.md 4.1 で組み立てが断ったときに誰が直すかと、その直しを3回に数えるか（数える）。REQ-034 の「読み取って確かめた項目」の範囲。再開の後はいつも URL を示し直す。autopilot の切り方（Shift+Tab）。
- 最終確認で人が確かめること（B3-fix の依頼）：marketplace.json の source "./" で入れられるか（copilot plugin marketplace add、marketplace browse、plugin install、plugin list --json）。test-plugin が隣の make-plugin の references を読めるか。読み込みの確認の題に出る名前。
- D1c への引き継ぎ（B3-fix）：会話例を置いたら、README の「置きます」を「あります」に直す。
- B2-fix：上位の文書で直すこと（tasks/B2-fix.md）。BLUEPRINT 8章：差し込み口の見出しは ### 以下、統括の差し込み口は作業エージェントに渡すもので検証エージェントにはナレッジを渡さない。generated-plugin-structure.md 4.8 の3：検証エージェントに渡すものに、作業ごとの設定の値と入力のファイルの場所を足す。REQ-011・4.3・4.8：頼みの文と合否の基準が食い違うときの決まりがない（ユーザーに確認）。
- A1（続き）：上位の文書で直すこと。設計書 4.3 の統括への指示文の中身に最初の1文を足す。6.2 の表と 4.2 に「実行中に呼ばれたら頼みの文は受け付けず、始められない旨の知らせを返す」を足す。ひな形の docs/design/design.md も同じ。
- D1b：上位の文書で直すこと（tasks/D1b.md）。creator-structure.md 2章の部品の表に模擬ユーザー（tests/dev-eval/personas/、validate.mjs）の行がない。testing.md 6.1：ファイルに入れる決まりに、4つ目の答え「違う」に当たるもの（wrong）を足す。6.2：決まりの確かめへの答え（confirm）が7観点にない。6.3・6.5：急ぐ合図を signal で足す形にした。6.5：課題の入力のファイルは、示すファイルのうち role が input のもの。
- C1（言葉）：生成プラグインの Web管理画面の文（ページの題「Web管理画面」、「評価基準をすべて満たした」「ユーザーと確かめた基準」など）は、言葉の置き換えの表の範囲（ユーザーの答え22はクリエイターの返り値と画面）の外で、変えていない。REQ-025（説明のない専門用語を使わない）に照らして、生成プラグインの画面の言葉を見直すかは判断が要る。
- D1a：上位の文書で直すこと（tasks/D1a.md の末尾）。testing.md 4章：task の引数の扱い（task→Agent、agent_type→subagent_type、mode "sync"→run_in_background false）、変数の置き換えは設定ファイルだけ、写さないもの（docs/、tests/、examples/、wip/、heldout）、エクステンションのツール名の規則（<ext>_<tool> → mcp__<ext>__<tool>）、skill→Skill は公式の表にない補い、.eval/ の中身、claude -p の init で読み込みを確かめられること。testing.md 6.3・6.6：見ない模擬ユーザーを置き換えた版に入れない（変換スクリプトが tests/ を写さないことで守る）。creator-structure.md 2章：変換スクリプトの行がない。
- D1a：要確認。Agent を run_in_background: false で呼ぶと結果が同じ手番に返るか。記録の tool_use の名前が Agent か Task か（両方を受ける）。同じプロセスの MCP サーバーのツールをサブエージェントの tools で絞れるか。.mcp.json の cwd が効くか。試験の claude は 2.1.310、SDK 同梱は 2.1.307。
- D1d：上位の文書で直すこと（tasks/D1d.md）。testing.md 4章：記録のツールを呼んだエージェントの結び付けは、フックの tool_use_id と MCP の _meta の claudecode/toolUseId で結べる（要確認が解けた）。取り消されたかは取れない（試験の仕組みが止めたかで決める）。MCP のツールに alwaysLoad、agent: に claude_code のプリセットが要る、Agent は既定で裏で動く。agent.started の model は Agent SDK では始まりの時点で分からない。adapter.mjs の describeOpened を共有する（今は写し）。screen.mjs にモデル選択の窓口を足す。creator-structure.md 2章に開発の試験の部品の行がない。Agent SDK を 0.3.310 に上げた。
- D1d（統括の決定）：内側の EVAL で、生成プラグインの作業ごとの設定（作るときに決まるので、模擬ユーザーの eval.json の値と鍵が合わない）は、ユーザー役が画面の設定の欄（見出しと説明）を読んで、模擬ユーザーのナレッジから値を決めて入れる（testing.md 7章の「人と同じ流れ」）。testing.md 7章に書く必要がある。
- D1d：この環境にサンドボックスの道具（bubblewrap、socat）がなかった（testing.md 11.1）。2026-10-24 にこのセッションに限って apt-get で入れ（bubblewrap 0.9.0、socat 1.8.0.0）、bwrap が動くことを確かめた。次のセッションからも使うには、ユーザーが環境の設定のセットアップスクリプトに `apt-get install -y bubblewrap socat` を足す（最後の報告で伝える）。
- EVAL の費用の見込み：outer.mjs --dry-run の見込み（1回 0.1 ドル）は試作の短いヒアリングの値で、今のクリエイターの長いヒアリングと生成には当たらない。最初は1回だけ回して実際の費用と利用枠の減り方を測ってから、回数を決めるのがよい（ユーザーに確認する）。
- D1c：開発中に一度、承認の前に本物のモデルを少し使った（本物の SDK と偽物の API で通す実験で、ユーザー役の呼び出しだけが本物に届いた。Sonnet、短い約17回）。原因を直し、偽物の API につながっていない query を断る守りを試験に足した。ユーザーに報告する。
- D1c：上位の文書で直すこと（tasks/D1c.md）。testing.md 6.2：合格の割合が決まっていない（決めた：漏らさない・指示のことを話さないは0件、ほかは90%以上）。決まりの確かめ（confirm）が7観点にない。6.5：抜き書きの出どころ（最初の依頼の文を含めない）、組み込みの範囲、承認の前の書き込みの見方（Bash で書いたファイルは見分けられない）。6.3：対照のクリエイターの作り方と判定、急いでいる話し方で選ぶもの。6.6：見ない模擬ユーザーの記録の伏せ方。4章：qa.jsonl と AskUserQuestion の結果の文の形。
- D1c：要確認。生成プラグインの tests/run.py が Playwright 不足で止まり、クリエイターが道具の用意を提案する（EVAL の中の扱いは最初の実行で決める）。週報の模擬ユーザーの headings.asked が一般の問いに当たる、headings.leak の「来週の予定」が成果物の fact にも出る（偽陽性が出たら絞る）。
- D1c→統括：会話例を置いたら、README の「置きます」を「あります」に直す。EVAL の前に `node tests/dev-eval/runner/outer.mjs --persona … --dry-run` で回数と費用の見込みを出せる。
- X2-05（X3 が V1 の生データで確かめた）：Copilot CLI 1.0.102 のシェルのツール `bash` は `initial_wait`（30〜600秒）を持ち、それまでに終わらないコマンドは途中の出力を返して動き続け、終わると知らせが来る。test-plugin の EVAL のように数十分かかるコマンドの扱いに効く（R2 と testing.md に書く）。
- X1-17：BLUEPRINT 8章の README の差し込み口 `readme-task` は消した（ひな形の README に差し込み口はない。仕様は README に作業ごとの使い方を求めていない）。
- R2：`requestSandboxPermissive` を「サンドボックスの外で動かす」と示さない（generated-plugin-structure.md 6.3）。tasks.list には shell と client のタスクも入る。
- V1（本物の Copilot CLI 1.0.102 と偽物のモデル。報告は research/V1-copilot-cli-smoke.md）：
  - 不具合1【重大】サブエージェントのツールは、親（統括エージェント）の `tools` の範囲に絞られる（更新履歴 1.0.67・1.0.68）。今の統括の `tools` では、検証エージェントが `<名前>_verdict` を、作業エージェントが `edit`・`execute` を使えず、実行が `all_passed` にならない。統括の `tools` に足しても、統括が Claude の族・作業が GPT の族（既定の組み合わせ）だと作業は `apply_patch` を受け取れない。統括の `tools:` を書かない形（全ツール）なら、族を混ぜても通る。直し方はユーザーに確認中。設計書 4.4・4.7・4.8、testing.md の1段目、R2 に効く。
  - 不具合2【重大】ツールの処理が投げた例外の文はモデルに届かない（「Tool execution failed」だけになる）。断るときは `{ textResultForLlm: '<理由>', resultType: 'failure' }` を返す（確かめた）。R2 3.3 の「例外の文がモデルに返る」は誤り。generated-plugin-structure.md の記録のツールの断りと creator-structure.md も直す。
  - 不具合3【軽】`subagent.started.agentDisplayName` は `worker`・`verifier`（短い名前）で、`task` の `description` ではない。`description` は統括の `task` 呼び出しの `tool.execution_start.arguments.description` にあり、`toolCallId` で結べる。設計書 4.5 と BLUEPRINT 3.1 を直す。
  - `/experimental on` は動くが deprecated（`copilot help config`：`--experimental` か `/settings experimental on`）。`--experimental` は一度付けると `settings.json` に残る。案内している場所：README、setup.md、ひな形の入口のスキル・README・設計書・仕様書、creation-requirements.md、output-requirements.md、generated-plugin-structure.md、creator-structure.md。
  - make-plugin を読むたびに、スキルのフォルダの全ファイル（ひな形の84件を含む約100件）が「Related files」として届く。ふつうのパスで約2,700トークン（うちひな形が約2,400）。SKILL.md の本文（約4,900）と合わせると、hearing.md 12章の5,000トークンの狙いを超える。置き場所はユーザーに確認中。
  - `-p` では、エクステンションの読み込みの確認に答える人がおらず読み込まれない。`--allow-tool='extension-permission-access'` か `--allow-all-tools` が要る（R2 3.10 の見込みが確かめられた）。
  - 生成プラグインの入口のスキルのコマンドは `/<名前>`（スキルの名前がプラグインの名前と同じため）。クリエイターは `/plugin-creator:make-plugin`。
  - Copilot CLI は、サブエージェントのシステムプロンプトに「Do NOT use output redirection … to create output files」と `<subagent_usage>`（「Default to doing the work yourself」）を足す。作業エージェントに編集のツールが要る理由になる。
  - 必須の引数が欠けても Copilot CLI は止めない（`minimum` などは説明の末尾の文字になる）。検査は handleTool のままでよい。
  - 確かめられなかった（ログインが要る・環境にない）：`defer: "never"`、`model.list` の要素の形と Auto の見分け、`model` のリストの2番目への切り替わり、読み取り役の `web`、`assistant.usage`、指示ファイルを受け取らないこと、GitHub からの marketplace add、実ブラウザー、Windows・macOS。
  - V1 が誤って、ファイルシステムの根に `/home-gen-a/`（Copilot CLI の設定とログ、約600KB）を作った。安全の検査で消せないので、ユーザーに消してもらう（最後の報告で伝える）。

## 後の仕事に渡すこと（作業のエージェントの報告から）

- A3→D1：会話例の版は、冒頭30行に「クリエイターの版：x.y.z」と書く。examples/ に版のない Markdown を置くと不合格になる。
- A3→B2：ひな形の文書や土台に `K-数字` の例を書かない（「それ以外」のナレッジの番号の探索に引っかかる）。
- A3→A1・A2・C3：task.json の settings の options は文字の並び。workers[].agent は `worker` か `worker-<名前>`。eval.json の形は BLUEPRINT 4.3。
- A3→C2・D1：構造の検査は `run_checks(root, kind)`（kind は generated か plugin）。試験の入口 run.py は `--root`、`--stage1-script`、`--stage2-dir`、`--need` で使い回せる。
- A3：SKILL.md のフロントマターの Agent Skills の6項目以外（user-invocable など）は不合格にした（R1 の勧め）。references の 20KB は 20,000 バイト未満と読んだ。

- A2→B1：許可の求めの `detail.sandboxBypass` は `requestSandboxBypass && !requestSandboxPermissive` にする（R2 の #13）。許可の種類に path・workflow・extension-management がある。
- A2→A3・C3：`node --test <ディレクトリ>` は Node 22 では動かない。`"…/*.test.mjs"` の形にする。画面の試験は `NODE_PATH=<playwright の node_modules> PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`。
- A2→A1：`previous.canFile` と `setup.taskDisplays` を core が必ず持つ（送った）。持ったら ui/app.mjs の task.json を読み直す補いと `taskPath` を消す。
- A2：画面は明るい配色だけ（暗い配色は作っていない）。表示の値の形（text は文字、kv は {見出し: 値}、table は {columns, rows}、progress は 0〜100 か {value, max, label}、image・file は {fileId, name}）は A1 の show の説明と同じ。
- A2：server.mjs の staticDir は配列でもよく、クリエイターの画面が自分の部品とひな形の部品を一緒に出せる。

- A1→B1：`core.toolDefinitions` を登録する。`agent.started.agentType` は `<プラグイン>:orchestrator` の形で渡す。`tool.started` に `arguments` を付ける（同じ呼び出しの繰り返しの課題に要る）。許可の求めの `detail.sandboxPermissive` を渡す。`createCore` に `startUi: (core) => startApp({ core, cwd })` を渡す。
- A1→画面：`endReason.detail` に `extension_restarted`（エクステンションが再起動した）が加わった。ui/static の `ABORT_DETAILS` に足す（B1 に頼む）。`setup.taskDisplays` と `previous.canFile` は core が必ず持つので、ui/app.mjs の task.json を読み直す補いと `taskPath` を消す（B1 に頼む）。
- A1：窓口の listTasks がエージェントだけなので、「止めても止まらなかったシェルの処理」（4.10）は課題にできない（報告すること）。まとめ中のフェーズは null。開始は最大30秒かかりうる（各10秒×3）。
- A1：記録のツールの説明の文は仮（【仮】）。B2 が仕上げる。

## 途中経過のコミットの注意

- 担当が変異の試験をしている間（`*.mutbak` などがあるとき）に途中経過のコミットをすると、壊した状態が入る（9b58b92 で起きた。D1d が 0b8c6cc で直した）。途中経過のコミットの前に `git status` で `*.mutbak` や見慣れない一時ファイルがないかを見て、あればその担当のファイルは入れない。common.md に、変異の試験は写しでする決まりを足した。

## 次にすること（2026-10-24 時点）

1. （済み）V1 の追加の確かめ：クリエイターの直下の `template/` に移しても、中のスキル・エージェント・エクステンション・MCP・plugin.json は読み込まれない。Related files は97件→16件。試験的機能の案内は `copilot --experimental`（一度付ければ settings.json に残る。起動した後なら `/settings experimental on`：自動で再起動し、エクステンションの確認が2回出る）。報告の7節。
2. ひな形を移す（答え25。Sonnet。指示は briefs/M1.md）。2026-10-24 に M1 を立てた。あわせて X3 の段1の束（C1：X2-02・12・18・10、C3：X2-10・X1-16〔答え27〕、D1c：X2-08・X2-09(1)、D1b：X2-21〔答え26〕）を頼んだ。統括の分（BLUEPRINT 8章の readme-task を消す X1-17、X2-05 の bash の事実を報告に残す）は M1 の後にする。SKILL.md・references（confirm.md、generate.md）・scaffold.py・check_creator.py・test_scaffold.py・test_convert.py の置き場所の参照を直す。あわせて generate.md 27〜28行目の manifest の `"orchestrator": { "extra_tools": [] }` を消す（B1 の報告）。
3. （2026-10-24 に立てた。共通の指示は briefs/X-fix.md）M1 の後に X3 の段2の束（B3〔Opus〕、C2、A1、A2、A3、A4、B1）と、試験的機能の案内の直し（答え29。B3：README・setup.md、A4：ひな形の README・requirements.md・design.md 2.3、B2：ひな形の入口の SKILL.md）を立てる。A4 にはひな形の design.md の統括の表（答え24）も入れる。答え28（作り直しの流れの最終確認）は最終確認の一覧に入れる。
3b. 会話例の冒頭の「クリエイターの版：」を、画面の文（X2-18 で「plugin-creator の版」にそろえた）に合わせて「plugin-creator の版：」にする（統括の判断。エンドユーザーに見える文なので。D1c：examples-build.mjs と試験、check_creator.py の REQ-037 の確かめ。B3：improve.md）。仕様 REQ-037 の「クリエイターの版」は開発者の用語なので、そのままでよい。
4. 直しが全部入ったら、V1 に本物の Copilot CLI で確かめ直してもらう（統括の許す一覧で通るか、GPT の族の統括が受け取るツールの全部、apply_patch のフックの toolName、update_todo を拒んで困らないか、断りの文、担当の欄）。
5. T1 の通しをもう一度。
6. EVAL：まず1回だけ回して費用を測る（ユーザーに承認をとる）。会話例。README の「置きます」→「あります」。
7. 最後の報告。

## 2026-10-22 23:15 の立て直し

- 16:50 ごろ、利用枠の上限で C1 と B3 のワークフローの全エージェントが止まった。その後のプロセスの再起動で Workflow の道具が使えなくなった。
- そのため、残りの仕事は Agent の道具だけで進める。指示は `briefs/` のファイルに置く（共通は `briefs/common.md`、担当ごとは `briefs/<番号>.md`）。新しいエージェントには「briefs/common.md と briefs/<番号>.md を読んで従う」とだけ渡す。
- B3 は、書く（Opus）→ 観点ごとの点検（Opus。指摘は `reviews/B3-<観点>.md` に書く）→ 確かめて直す（Opus）→ 最後の確かめ（Opus）を、統括が順に立てる。B2 も同じ形にする。

## 利用枠の上限の記録

- 利用枠は約5時間ごとに戻る。6体を並べると、30〜40分ほどで上限に当たる（2026-10-22 02:23、11:10 ごろ、16:50 ごろ、2026-10-23 03:10 前）。止まったエージェントは、戻った後に SendMessage で続けられる（同じセッションのうち）。ワークフローは止まると最初からになるので使わない。
- 2026-10-23 03:57：C1、B3（書く）、B2、B1、C2、C3 を再開した。08:50 ごろ、また6体とも上限で止まった。
- 2026-10-23 09:30：6体とも再開した（2回目）。B3（書く）と C1 は終わった。ほかは 14:20 まで止まった。
- 2026-10-23 14:20：B1、B2、C2、C3 を再開し、C1 に続きを頼み、B3 の点検の4体を立てた。B2・C1・C2 は終わり、B2 の点検の4体を立てた。19:20 まで止まった。
- 2026-10-24 03:18：B1、C3、B3 の点検の4体を再開した。B1 と B3 の点検は終わり、B2 の点検の4体を順に再開し、B3 を直す担当を立てた。

## 動いているサブエージェント（同じセッションなら SendMessage で続けられる）

| 仕事 | ID |
| --- | --- |
| A1 | a53fe02c46a87994d（完了） |
| A2 | a4dd7b3736f4dd2a9（完了） |
| A3 | a6ae7ad9d3151a163（完了） |
| A4 | afd1d4ef4c0e6d043（完了） |
| C1 | ad77758fe8b6dfff7（完了。V1 の不具合2〔78644fb〕、X の直し4件〔bf9b154：confirm の evalTasks[].settings、作業の定義の案の sha256（taskHash）、「クリエイター」→「plugin-creator」、試験の名前〕。B3 に descriptions.mjs の【仮】、C2 に settings の突き合わせを渡す） |
| B3（書く） | a85fc7bf7ada9e044（完了。次は点検：briefs/review.md） |
| B2 | ae0285d8193b30123（完了） |
| B2 の点検 | 4つとも完了（design 8件、format 6件、models 19件、language 9件。high はなし） |
| B2 を直す | aacc17a8675d68a69（完了。42件中36件を直した） |
| D1a 変換 | a94162dfbb0aaf6aa（完了） |
| D1b 模擬ユーザー | a28af96a1b11b7fea（完了。週報・議事録・研修のアンケートの集計の3人。答え26で議事録に話し方の5種を足し〔232fad3〕、週報と議事録の terse・hurry に「いくつかのことを聞かれたら、それぞれ答える」を足した〔ee30b34〕） |
| D1d 内側の EVAL | afe3eb2243185d726（完了。V1 の直しへの合わせ〔58ba51f〕、統括の tools をなくしたことへの合わせ〔0b8c6cc：内側のつなぎ口が実行用のコピーの統括の定義に、Claude Code の名前の許す一覧を tools として書く。Claude Code では子のツールは親に絞られないことを確かめた〕） |
| D1c 外側の EVAL | af526bb1af09f9618（完了。X の直し〔5c227bb：記録する数 countRecorded、REQ-045・046 のモデルの観点 main-model・worker-model〕。次は M1 の後に会話例の版の呼び方〔3b〕を頼む） |
| X1 突き合わせ（生成プラグインの側） | a573cbefd6ad8b7da（完了。19件〔high 2：V1 の不具合1・2と同じ〕。reviews/X1.md） |
| X2 突き合わせ（クリエイターの側） | a015be8b3c3f5b5f0（完了。22件〔high 0〕。reviews/X2.md） |
| T1 すべての試験の通し | a7e9349258395fe6a（完了。約1,500件が通り、落ちたのは会話例がないこと〔REQ-037。EVAL の後に作る〕だけ。組み立てた生成プラグインの tests/run.py も、Playwright を入れた後に合格） |
| V1 Copilot CLI の読み込みの確かめ | a2958fd3e81866605（不具合3件と追加の確かめ2つを報告〔7001605〕。道具は scratchpad/v1/。直しが全部入った後に確かめ直しを頼む） |
| M1 ひな形を移す | adf071c830ffd5da8（完了。template/ に移した。Related files は16件になる見込み。上位の文書：hearing.md 587行目、generated-plugin-structure.md 712行目、creator-structure.md 3.4） |
| 第2陣（X の直し。2026-10-24） | B3 を直す担当 ad474ab788e9b207f（クリエイターの自然言語の部分・README・setup.md・improve.md）、B2 ae0285d8193b30123（入口のスキルの案内）、A1 a53fe02c46a87994d（完了〔ebde558〕：起票の手順の文、途中で切れた知らせを同じセッションか同じ作業フォルダに限る、Windows で偽物の gh とシグナルの試験を飛ばす。A2 に DEFAULT_FILE_STEPS、C1 に issue.test.mjs の偽物の gh を渡した）、A2 a4dd7b3736f4dd2a9（X1-05・19・14）、A3 a6ae7ad9d3151a163（X1-13・07・09・14、X2-19）、A4 afd1d4ef4c0e6d043（文書のひな形と案内）、C2 ab07d1229ed5e8971（X2-03・22・10）、D1c af526bb1af09f9618（完了：会話例の版は「plugin-creator の版：x.y.z」だけを受ける〔46c8763 に入った〕）、C3 ad65681a2d31da659（完了〔91752c2〕：EVAL の実行ごとに、実行の間にできて作業フォルダとセッションの番号が合う記録だけを消す。ふだんの記録が20件以上あると1実行で最大1件押し出される〔承認の前に伝える文を B3 に入れさせる〕。kill -9 では消えない。cwd と sessionId が合うことは最終確認で人が見る）。B3 の後に自然言語の点検を立てる |
| X3 突き合わせの指摘の仕分け | a806235c922ce2476（完了。40行：A 5、B 33、D 2〔答え26〜28〕。担当ごとの束は reviews/X3-triage.md の2章） |
| H1 見ない模擬ユーザー | ac4ca894931c3fb3d（完了。形の確かめに通った。tests/dev-eval/heldout/h1/ に作る。統括はこのフォルダの中身を読まない。git の出力も `grep -v heldout` で外して見る） |
| B3 の点検 | 4つとも完了（design 19件〔high 2〕、format 7件、models 24件〔high 1〕、language 34件） |
| B3 を直す | ad474ab788e9b207f（完了。84件中81件を直した。上位の文書で直すこと14件は tasks/B3-fix.md） |
| B1 | a7b491f44bb4b21eb（V1 の不具合1〜3を直して push〔448e24e、6201eb4〕。統括の許す一覧は adapter.mjs。判断は tasks/B1.md） |
| C2 | ab07d1229ed5e8971（完了） |
| C3 | ad65681a2d31da659（完了） |

## 再開のしかた

1. このファイルを読む。`wip/implementation/` の下の報告と、`git log` を見る。
2. 状態が「進行中」の段階から続ける。調べものは `research/` の報告の「未着手・途中」だけをやり直す。
3. 実装の仕事は、`tasks/<番号>.md` のメモを読み、同じ ID のエージェントに SendMessage で続けさせる。ID が使えない（新しいセッション）ときは、同じ指示（BLUEPRINT 5章の担当とモデル）で新しいエージェントを立て、メモから続けさせる。
