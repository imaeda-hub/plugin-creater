# D. 公開されている AI エージェントの道具は、ユーザーに聞き取りをして仕様・スキル・エージェントを作るとき、どう進めているか

調査日: 2026-10-20（今日）。担当: 調査 D（既存の道具の聞き取りの手順と指示文）。
前提: `research/00-context.md` の「調査の決まり」に従った。リポジトリ（plugin-creater）は読むだけで、変更していない。取得したリポジトリの中のスクリプトは実行していない。

この文書の読み方:

- 「事実」は、ファイルのパスと版（コミット）または URL と取得日を付けて書いた。英語の原文は引用のまま。
- 「考察」は事実と分けて、各節の末尾と最後の章にまとめた。
- 一次情報（公式リポジトリの指示文、公式ドキュメント、作者のコミットメッセージ）と二次情報（要約ツールを通した取得、第三者の記事、検索結果の要約）は、見出しか注記で分けた。
- 長い原文は `D-quotes/` の下に置いた（章末の一覧に絶対パスを書いた）。

---

## 0. 調べたものと版

| 道具 | 取得したもの | 版・日付 | 種別 |
| --- | --- | --- | --- |
| GitHub Spec Kit | `github/spec-kit` を clone（のち履歴も取得） | commit `505781d7cabb5180b7098a7d8371c48456f9d4f6`、2026-10-20。`pyproject.toml` の version は `1.2.3.dev0` | 一次 |
| obra/superpowers | `obra/superpowers` を clone して履歴を取得 | v7.0.0 = `bb92a77`（2026-10-09）、main = `b739a8af`（2026-10-20） | 一次 |
| Anthropic skill-creator / doc-coauthoring | `anthropics/skills` を clone | `dbd4588f9e1033efb41dad4bef2f7947c8993d44`、2026-10-09 | 一次 |
| Claude Code plugin-dev / feature-dev | `anthropics/claude-code` の `plugins/` を sparse clone | `49b8c35f8c57493c2f0eba1429ccaa9638ab8712`、2026-10-20 | 一次 |
| GitHub awesome-copilot | `github/awesome-copilot` を clone | `613efc8c21d9b3ce642dff361d17006cd9967e28`、2026-10-20 | 一次（中身は寄稿された物の集まり。公式の保証ではない） |
| BMAD Method | `bmad-code-org/BMAD-METHOD` を clone | `61e01f82644c4bb533750cfa0d6d61ab61d2cc9b`、2026-10-18。最新の公開版は CHANGELOG の v6.12.0（2026-09-03）で、main は「Unreleased（v7 向けの Toolsmith の初稿）」を含む | 一次 |
| Kiro（AWS） | 公式ドキュメントを WebFetch | `kiro.dev/docs/specs/` 系の4ページ（Page updated: 2026-08-04 〜 2026-10-15）。2025-07-15 の公式ブログ | 一次（要約ツール経由） |
| OpenAI Codex | `openai/codex` を blobless clone、公式ドキュメントを WebFetch | `feadd9441e67f2d8970ffc390212c32f3dfbba43`、2026-10-20 | 一次（リポジトリ）、公式ドキュメントは要約経由 |
| OpenAI GPT Builder / Agent Builder | 公式ページを取得しようとした | GPT Builder のヘルプは HTTP 403。Agent Builder のガイドは取得できた | 一次（Agent Builder のみ） |
| GitHub Copilot CLI（ドキュメントのみ） | docs.github.com の HTML を取得してテキスト化 | 取得日 2026-10-20。変換前の HTML は `research/D-web/` | 一次 |
| 追加: mattpocock/skills の grilling | `mattpocock/skills` を clone | `5beb35b040e3de97e54fa9e386d7e42d15c295c2`、2026-10-19 | 一次（作者の文書と指示文） |
| 追加: SpecKit Grill Me（Spec Kit の community 拡張） | `yoshi1220/speckit-grill-me` を clone | `595ae5198587c8c8eb806436eb2d141e4ab325ff`、2026-10-18、拡張の版 1.0.2 | 一次（寄稿者の物） |
| 追加: Claude Code の公式ベストプラクティス | `code.claude.com/docs/en/best-practices` を WebFetch | 取得日 2026-10-20 | 一次（要約経由だが長い逐語を含む） |

追加した理由: 担当の指示に「ほかにも良いものがあれば足す」とあった。grilling は「質問の出し方の設計」と「利用者の報告」が同じ場所にまとまっていた。Claude Code の公式ベストプラクティスには、公式の「インタビューさせる」型があった。

---

## 1. GitHub Spec Kit

### 1.1 事実（一次: `templates/commands/*.md`、`spec-driven.md`、commit 505781d7）

| 項目 | 内容 |
| --- | --- |
| 段階の順番 | `constitution`（原則）→ `specify`（仕様）→ `clarify`（質問）→ `plan` → `checklist` → `tasks` → `analyze` → `implement` → `converge`。クイックスタートに「短い道」（small な機能は clarify・checklist・analyze を省く）が書いてある（https://github.github.io/spec-kit/quickstart.html、WebFetch）。clarify は「plan の前に走らせる。探索的な試作ならユーザーが省いてよいが、手戻りの危険が上がると警告する」と指示文にある |
| 質問の形（specify） | あいまいな点は、まず**推測で埋める**（"Make informed guesses based on context and industry standards"）。推測できないものだけ `[NEEDS CLARIFICATION: ...]` を付け、最大3つ。3つ以内の質問は**まとめて**表で出す（列: Option / Answer / Implications、行: A・B・C・Custom）。ユーザーは `Q1: A, Q2: Custom - [details], Q3: B` の形で答える |
| 質問の形（clarify） | **1回に1問**（"Present EXACTLY ONE question at a time."）。選択式（2〜5個、互いに排他）か、5語以内の短い答えの2種類だけ。**推奨の選択肢を先頭で目立たせて理由を1〜2文**（`**Recommended:** Option [X] - <reasoning>`）。表で全選択肢を出し、「選択肢の記号、`yes` / `recommended` で推奨を受け入れる、自分の短い答え、のどれでもよい」と案内する |
| 質問の書き方（2026-07-28 に追加） | 質問は必ず `**Question:**` に続く**完全な疑問文**で、`?` で終える。話題のラベルや要求の番号を質問にしてはいけない。直後に「なぜ大事か」を平易な1文で添える。自己点検: 「Spec Kit を知らない読み手が、質問の1行だけで答えられるか」 |
| 1回に聞く数 | clarify は1問。specify は最大3問を同時に。checklist は最初に最大3問（Q1〜Q3）、足りなければ追加で最大2問（Q4・Q5）で、合計5問まで |
| 質問の上限 | clarify は**セッション全体で5問**（"Maximum of 5 total questions across the whole session."）。上限に達しても高影響の領域が残れば "Deferred" として理由つきで明示する。同じ質問の聞き直し（言い換え）は数えない |
| あいまいさの分類 | 10の領域（taxonomy）を使い、各領域を Clear / Partial / Missing に判定して、内部の「網羅の地図（coverage map）」を作る。領域: 機能の範囲と振る舞い／領域とデータの型／画面と操作の流れ／非機能の品質／外部との連携／例外と失敗／制約とトレードオフ／用語の一貫性／完了の目印／その他（TODO、「頑丈」「直感的」のような数字のない形容詞）。Partial か Missing の領域が質問の候補になる。ただし「実装方法・技術選定・タスク分割」に関するものは質問にしない |
| 優先順位 | 候補が5つを超えたら (Impact × Uncertainty) で上位5つ。「答えが設計・データ・試験・UX・運用・遵守の検証に実質影響しない質問」「好みの問題」は除く |
| 答えがあいまいなとき | 「選択肢に当てはまるか、5語に収まるか」を検証し、あいまいなら**手早い確認**を聞く（同じ質問のうちで、数は増えない） |
| 「分からない」への対応 | 見つからなかった（テンプレートに規定なし）。代わりに、推奨を出しておいて `yes` で受け入れさせる型がある。checklist には「対話できないときの既定値」（深さ=標準、読み手=レビュー担当、焦点=関連性の上位2つ）がある |
| 網羅の確かめ | 質問を出す前の地図（上記）。終わりに「領域ごとの状態表」（Resolved 解決／Deferred 先送り／Clear もともと十分／Outstanding 残るが影響小）を報告する。質問がゼロなら「全領域 Clear」の簡単な要約を出す |
| 終える条件 | ①重大なあいまいさが早く解けた、②ユーザーが「done」「good」「no more」などと言った、③5問に達した、のどれか。「先の質問を先に見せてはいけない」（"Never reveal future queued questions in advance."） |
| 決まったことの記録 | 答えを1つ受け入れるたびに、`spec.md` に `## Clarifications` → `### Session YYYY-MM-DD` → `- Q: <question> → A: <final answer>` を足し、**その場で**該当する節（機能要求・データ・非機能・例外・用語）を書き換える。矛盾する古い文は残さない。**答えごとにファイルを保存**する（"to minimize risk of context loss"）。検証: 答え1つにつき箇条書き1つ、5問以内、曖昧語が残っていない、など |
| ユーザーの確認 | 答え1つごとが確認。specify は品質チェックリスト（`checklists/requirements.md`）で自己検証し、3回まで直す。段階ごとの人の確認は、GitHub の公式ブログ（2025-09-02、Den Delimarsky、WebFetch の要約）に「you don't move to the next one until the current task is fully validated」とある。このブログはエージェントが質問をする手順には触れていない |
| 中断と再開 | 状態は `spec.md` の Clarifications と `.specify/feature.json` にあり、clarify を再実行すれば足りない点を再検出する。専用の再開の手順の記述は見つからなかった |
| 指示文の書き方 | 手順を番号で並べ、数値（5、3、2〜5、≤5語）、書式、禁止、検証、完了の条件（"Done When" のチェックリスト）を細かく書く型。1ファイル約290行 |

### 1.2 作者・利用者の報告（変更履歴と issue。clarify.md の `git log`）

- 2026-03-03（#1557）: 指示文の中で上限が「10」と「5」で食い違っていた（"Maximum of 10 total questions" と他の6か所の「5」）。5に直した。
- 2026-07-28（#3745）: 「Agents often present topic labels or bare requirement ids as "questions", which are not answerable on their own.」→ 完全な疑問文と「なぜ大事か」を必須にした。
- 2026-02-27 の issue #1717（2026-09-15 に修正で閉じた。WebFetch の要約）: ユーザーが `/speckit.clarify checklists/spec-quality.md` を走らせたところ、エージェントが24項目をすべて「plan 段階の関心事」として先送りし、質問を1つもせず、「No critical ambiguities detected.」と答えた。修正（#4507、2026-09-15）の説明: 「The command treated "better deferred to planning" as a catch-all, so agents skipped NFRs, acceptance criteria, and edge cases.」→ 先送りしてよいのは「実装方法・技術選定・タスク分割」だけに限った。
- コミット履歴と主要コミットのメッセージは `D-quotes/speckit-clarify-history.txt` に置いた（2026-03〜09 の変更は、上の3件のほか、フック・チェックリストの再検証など周辺の追加が中心）。

### 1.3 関連する Spec Kit の他の物

- `assess` 拡張（Spec Kit に同梱、`extensions/assess/commands/speckit.assess.intake.md`）: 「Intake captures; it does not evaluate or solutionize.」「Never invent origin, ownership, or context the input does not support — mark it `[NEEDS CLARIFICATION: …]`.」。ユーザーに質問して聞き出す手順ではなく、受け取った物を記録する段階。
- `constitution` コマンド（`templates/commands/constitution.md`）: 値がなければ「会話から、なければリポジトリから推し量り、本当に分からなければ聞くか `TODO(<FIELD_NAME>): explanation` と書く」。
- コミュニティ拡張 **SpecKit Grill Me**（`extensions/catalog.community.json` の `grill`、作者 yoshi1220、v1.0.2）: clarify の「5問まで」を外す。README（WebFetch）: 「where reducing downstream rework is more important than minimizing interview time」。設計の木・frontier（いま聞ける質問の集まり）・round（1回分）を使い、「1回に1問ずつ順に」聞き、事実はまず調べ、**すべての決定点が最終の状態になるまで**続け、最後に「満足の確認（satisfaction gate）」でユーザーに明示的に確認する。指示文（`spec-kit-extension/commands/me.md`）は406行で、用語集つき。clarify と同じ成果物（`## Clarifications`、チェックリストの再検証）を作る互換性を保つ。質問の指示文には次のような規定がある（逐語）: 「Offer one to three situation-appropriate choices labeled from `A.` ... always end with a free-form option. The user must be able to accept a non-recommended choice as easily as the recommended one by replying with a single label.」「Whenever marking an option `**Recommended**`, explain the recommendation.」「Before the choices, list the **verified facts**, **accepted decisions**, and **unverified assumptions** used to compare the options ... Every verified fact carries its source」「Anything inferred, estimated, or merely plausible ... is an unverified assumption, never a verified fact」「**Settle consequences without asking.** ... list it at the satisfaction gate so the user can revise it」（受け入れた規則から必然的に導かれる点は聞かずに反映し、最後の確認でまとめて見せる）。**1ファイルに数百行の規則を積んだ型**で、安価なモデルで守られるかの記述は見つからなかった。

### 1.4 考察（事実と分ける）

- 上限5と「推奨つきの1問ずつ」は、質問の負担を減らし、答え方（`yes`）を短くする設計。ただし利用者の報告から、上限と「先送りしてよい」の逃げ道が、**聞かない方向の失敗**（#1717）を生んだと読める。
- 答えごとにファイルへ書く点は、会話の要約・圧縮で消える事故への備え（指示文に理由が書いてある）。
- 「質問は完全な疑問文」の追加は、クリエイターの CLAUDE.md の「項目を番号やラベルだけで示さず、中身を言葉で示す」と**同じ失敗**に対する、先行する修正。

---

## 2. obra/superpowers の brainstorming（と writing-plans など）

### 2.1 事実: 現行版 v7.0.0（2026-10-09）の `skills/brainstorming/SKILL.md`（225行）

| 項目 | 内容 |
| --- | --- |
| 段階の順番 | ①最初に「いま何を知っているか」を自問する。要望の中にすべてあれば（例:「アイコンをコーンフラワーブルーに」）、聞かずにやって、何をしたか言う。②**最初のメッセージ**は2つだけ: 「質問を飛ばして始めてほしければそう言ってください」の1行と、実際の場面や具体的な絵を語らせる**自由回答の質問を1つ**（例:「これがあったらいいのにと思う場面は？」）。③会話。④**説明を小分けにして返す（Play It Back）**。⑤規模を決める（すぐやる／小さな変更はチャットで／プロジェクトは設計書）。⑥設計書。⑦builder check。⑧承認 |
| 質問の形 | 各メッセージは**質問1つで終える**。「例の答えの一覧を後ろにぶら下げない1文」。**自由回答が先**で、「選択肢を出すのは行き詰まったときだけ」。専門用語・処理の用語は使わない（"pitched just a little above where your human partner is"）。「推測してもらって直させる」ほうが質問より効くことが多い（`"I'm guessing this is because X keeps biting you?"`） |
| 1回に聞く数 | 1つ。数の上限は書いていない |
| 触れる範囲 | 「領域であって台本ではない。質問として読み上げない」（"Never read these out as questions"）: どんな物か／なぜ今・成功とは／目標・非目標・**反目標**（技術的には動いても失敗になる状態）／先行事例／現状／気にしている細部。「作り方」（媒体・道具・言語）は、自分で決めたいか任せるかを**早めに**聞く。任せられたら既定値を選び、**平易な言葉で言う**（"A default they never heard is one they couldn't reject."） |
| 現場の下調べ | 手がかりがついたら、調べることを**申し出る**（コード、ファイル、Web）。「見に行くか決めるのは本人」 |
| あいまいさの扱い | 具体に錨を下ろす質問（"Walk me through the last time..."、"If it could only do one of these well, which?"、"What would make you wince if I got it wrong?"）。「行き詰まったら具体案を出す」。「違う案を黙って多数考え、弱いものを捨ててから出す」 |
| 網羅の確かめ | 「領域」のリスト（上）と、**builder check**: 設計書を書いたあと、新しいサブエージェントに「あなたはこの設計書から計画を立てる人。書いた人には聞けない。『ここで当て推量になり、外すと困る』質問だけを、重要な順に出せ。なければ "nothing important left"」と言わせる。出た質問を3つに分ける: 会話で答え済み／些細（自分で決めて「自分の判断」と印を付ける）／ユーザーだけが答えられる（**1回のメッセージ**にまとめて重要な順に聞く）。「サブエージェントがなければ、自分がその作り手として読む」 |
| 終える条件 | 数ではなく**承認**: 「小さな変更ならチャットで、プロジェクトなら設計書」を、ユーザーが承認するまで何も作らない（`<HARD-GATE>`）。例外: ユーザーが質問を断ったとき、承認した使い捨ての試作 |
| 決まったことの記録 | ソフトウェアのリポジトリなら `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`（コミットする）。それ以外は聞く。内容: 意図と理由／目標・非目標・反目標／制約／ユーザーが**決めた通りに**書いた「作り方」の部分／作り手に任せる部分。**推測は「自分の判断」と印を付ける** |
| ユーザーの確認 | 説明を200〜300語の塊にして返し（理解できた部分ができ次第、質問と**交互に**）、「どこが違うか、足りないか」で終える。「推測は推測と印を付け、本人の言葉だけを本人のものとして書く」。設計書は承認まで渡さない |
| 見せ方 | 「見たほうが分かる」場面（画面、配置、流れ、見た目の違う選択肢、図）では、ブラウザーのタブで見せることを**その場で**申し出る（単独のメッセージ。断られたら再度出さない）。用意されている `visual-companion.md` は、ブラウザーの画面を開く手順（Copilot CLI の背景実行の手順も書いてある） |
| 中断と再開 | 見つからなかった（専用の再開の手順なし） |
| 赤信号の表 | 「"I'll offer options to save them effort" → Options steer. Ask them to describe it first.」「"They said 'sounds good' to the idea" → Approval covers what you showed them. A description you haven't written isn't approved.」などの表（言い訳と現実の対） |

### 2.2 事実: 作者が書いた設計の理由と変遷（一次: 作者のリリースノートとコミットメッセージ）

- 版の変遷（`RELEASE-NOTES.md`）:
  - v3.4.0（2025-10-30）: 「ask questions one at a time, then present design in 200-300 word sections」。旧版（commit `8e38ab8`）は「Prefer multiple choice questions when possible, but open-ended is fine too」「Only one question per message」。2025年の古い情報で、v7 で逆向きに変わった。
  - 2025-10-17（commit `4d8db81`）: 選択式の質問に `AskUserQuestion` を使う案内を追加。
  - v4.3.0（2026-02-12）: 「Models were skipping the design phase and jumping straight to implementation skills like frontend-design, or collapsing the entire brainstorming process into a single text block.」→ `<HARD-GATE>`、6項目のチェックリスト、処理の流れの図で**強制**する形にした。
  - v4.0.0（2025-12-17）: 「The Description Trap」: 説明文（description）に手順の要約を書くと、エージェントが本文ではなく説明文に従う → 説明文は「いつ使うか」だけにする。
  - v5.0.6（2026-03-24）: サブエージェントでの設計書レビューの繰り返しをやめ、自己点検に変更。「doubled execution time (~25 min overhead) without measurably improving plan quality. Regression testing across 5 versions with 5 trials each showed identical quality scores」。
  - v6.4.1（2026-09-18）: 利用者の報告（#2258）。Reactの TODO アプリの会話で、本当の目的（React を学ぶこと）を聞かず、「that scope is ok」を足場づくりの許可として扱った。→ 目的を聞く、理解を返して直してもらう、承認を「実際に見せた段階」に結びつける。
  - v7.0.0（2026-10-09、PR #2463）: 作り直し。「Over time the skill drifted from drawing out intent toward routing and gating.」（PR の説明。WebFetch の要約）。
- v7.0.0 のコミットメッセージ（`research/D-quotes/superpowers-v7-brainstorming-commit-messages.txt`、一次。作者の自己申告で、標本は小さい）:
  - 「With playback saved for the end, project brainstorms ran 8-15 questions before the human saw any summary. Interleaved, the first playback lands around turn 3-6 (6 runs: habit-tracker, pottery, offsite x2), so corrections arrive before more questions build on a wrong guess. Total length is about the same.」
  - 「Each message ends with one question, no example answers hanging off it; multi-question messages and parenthetical menus showed up in most runs.」
  - 「Playback marks the agent's guesses as guesses; one run played the agent's own example back as the human's.」
  - 「In a blind comparison (6 testers, old vs new skill), every new-skill tester flagged the builder check: two rounds and 3-9 questions after they'd said 'write it up'. Now the agent warns once ..., settles minor gaps itself and marks them as its calls, and brings only the questions that change what gets built, in one message, most important first. 4/4 runs ... showed a single round.」
  - 「Claude Code subagents run in the background, so the subject can't block on the builder check. The skill now says what matters (don't hand over the document until the check is back)」
  - 「A session asked to design an iOS app never discussed platform or stack and built a web app with a home-screen icon.」→ 「作り方」を聞く段落の追加。
  - 「Blind testers flagged a researched answer as a wall of text for a non-technical person.」→ 平易な1行（「報告は最重要の発見を述べ、残りは申し出る」）。Opus・Sonnet・gpt-6-luna・gpt-6-astra で試し、「報告の長さは Claude で 320〜400語。この行で『残りを申し出る』返答が 1/5 から Opus 4/5・Sonnet 3/5 に増えた。GPT 系は元から短く、変化なし」。
- PR ページの要約（WebFetch。**原文未確認の数字**）: 旧版の出だしが25/25で処理の専門用語から始まったのに対し新版は0/25、1会話あたりの選択肢の数が16〜27から0〜1、盲検で6人中6人が新版を選んだ、など。作者のシミュレートした「隠れた意図を持つ人」が、選択肢の中から「もっともらしいが違う枠組み」を選んだ、という説明。数字は要約を通した値で、逐語の確認ができていない。
- 評価の道具（「隠れた意図を持つ人」を AI が演じる多ターンの駆動、盲検の対比）は、「別の PR に移した」（コミット「Move the eval harness and results to their own PR」）。取得した clone の `tests/` には入っていない。

### 2.3 関連するスキル（事実）

- `skills/writing-plans/SKILL.md`: 計画は「作り手が書き手に聞けない」前提で、TBD や「適切に検証を足す」のような**何も決めない行**を失敗と定義（"Lines that decide nothing ... are the opposite failure"）。自己点検の5項目（仕様の網羅、手順の走査、型の一貫、Review Focus、釣り合い）。実行の方法を聞く質問は、推奨と理由を1文つけて出す（"For this plan I recommend <one of the two>, because <one sentence...>"）。
- `skills/writing-skills/SKILL.md`「Match the Form to the Failure」: 失敗の種類ごとに書き方を変える。「規則を知っていて破る」→ 禁止＋言い訳の表＋赤信号（「"prefer..."、"consider..." のような軟らかい指針」は**逆効果**）。「形が違う」→ 肯定形の型。「必須の要素が抜ける」→ テンプレートの必須の欄。「条件による」→ 観察できる条件。「禁止は、形を整える問題では逆効果」（収集した試験の記述）。
- コミットメッセージの数字: 「TDD の言い訳への反論を表の1行に圧縮すると、圧力下で試験を先に書く率が control 8/10 → treatment 5/10（n=10、Claude と Codex の両方で確認）」→ 反論を各行に戻した。
- `skills/using-superpowers/SKILL.md`: 「If you think there is even a 1% chance a skill might apply ... you ABSOLUTELY MUST invoke the skill」。サブエージェントは `<SUBAGENT-STOP>` で無視。セッション開始のフックで本文を文脈に入れる方式（`docs/porting-to-a-new-harness.md` に Copilot CLI の列あり。作者の記述で、こちらでは確かめていない）。

### 2.4 考察

- 作者が1年のうちに「選択式を好む・1問ずつ」から「自由回答を先に・選択肢は行き詰まったときだけ」へ変えた理由は、「選択肢が利用者の枠組みを決めてしまい、隠れた事実が出てこなかった」こと（コミットと PR の要約で一致）。ただし評価は AI が演じる利用者と少人数の盲検で、規模は小さい。
- 手順を守らせる工夫（HARD-GATE、赤信号の表、説明文を「いつ」だけにする）は、モデルが手順を飛ばした実例から追加されている。
- サブエージェントを**質問する側ではなくレビューする側**に使い、質問をユーザーに持ち帰るのはメインの仕事にしている。Claude Code ではサブエージェントが背景で動くため、「待たせる」には本文の工夫が要った。

---

## 3. Anthropic の skill-creator と doc-coauthoring（`anthropics/skills` @ dbd4588f、2026-10-09）

### 3.1 skill-creator（`skills/skill-creator/SKILL.md`、485行）

事実:

| 項目 | 内容 |
| --- | --- |
| 段階の順番 | 意図を捉える（Capture Intent）→ 聞き取りと下調べ（Interview and Research）→ SKILL.md を書く → 試験の課題を作って動かす → 結果を見て直す。使う人の位置を見て、途中から始めてよい（下書きがあれば試験から） |
| Capture Intent の原文 | 「Start by understanding the user's intent. The current conversation might already contain a workflow the user wants to capture ... If so, extract answers from the conversation history first — the tools used, the sequence of steps, corrections the user made, input/output formats observed. The user may need to fill the gaps, and should confirm before proceeding to the next step.」 |
| 質問の項目 | 4つ: ①このスキルで Claude に何をさせるか、②いつ呼ばれるか（どんな言い回し・場面）、③期待する出力の形、④試験の課題を用意するか（客観的に確かめられる出力は有益、主観的な出力は不要が多い。「既定を提案して、決めるのは本人」） |
| Interview and Research の原文 | 「Proactively ask questions about edge cases, input/output formats, example files, success criteria, and dependencies. Wait to write test prompts until you've got this part ironed out.」「Check available MCPs - if useful for research ..., research in parallel via subagents if available, otherwise inline. Come prepared with context to reduce burden on the user.」 |
| 質問の形・数・上限・終える条件・記録 | 書いていない（形式、数、上限、終える条件、聞き取りの記録のファイル）。つまり**聞き取りの手順は薄い**（既存の記憶ファイルの結論と一致） |
| 伝え方 | 「Communicating with the user」の節: 「pay attention to context cues」。「evaluation」「benchmark」はふつう可。「JSON」「assertion」は本人が分かっている手がかりがあるまで説明なしに使わない。「迷ったら短い定義を添える」 |
| 省く道 | 「if the user is like "I don't need to run a bunch of evaluations, just vibe with me", you can do that instead.」 |

### 3.2 doc-coauthoring（`skills/doc-coauthoring/SKILL.md`、375行。仕様・提案書などを一緒に書く手順。**聞き取りの設計としては skill-creator より詳しい**）

| 項目 | 内容 |
| --- | --- |
| 段階の順番 | 申し出（試すか自由に書くか聞く）→ Stage 1 文脈の収集 → Stage 2 構造と洗練（節ごと）→ Stage 3 読み手の試験 |
| Stage 1 の質問 | まず5つの「メタの質問」（文書の種類、主な読み手、読んだ人にどう動いてほしいか、テンプレートの有無、他の制約）。「略式で答えてよい」と伝える。次に**情報の丸ごと出し**（"info dump"）を促す（背景、なぜ別の案を使わないか、組織の事情、期限、依存、関係者の懸念）。「整理しなくてよい」。そのあと、足りない点について**番号つきで5〜10問**を出し、「1: yes, 2: see #channel, 3: no because backwards compat」のような略式の答えを許す |
| 終える条件（Stage 1） | 「Sufficient context has been gathered when questions show understanding - when edge cases and trade-offs can be asked about without needing basics explained.」 |
| Stage 2（節ごとの繰り返し） | 節ごとに: 5〜10問の質問 → 5〜20個の候補を出す（ブレスト）→ 残す・外す・合わせるをユーザーが短い理由つきで選ぶ（例: "Keep 1,4,7,9" "Remove 3 (duplicates 1)"）→ 抜けの確認 → 下書き → 手直し。「ユーザーには文書を直接直さず、何を直すか言ってもらう（好みを学べるため）」。**「3回続けて大きな変化がなければ、削れるものがないか聞く」** |
| Stage 3 | 文脈を持たない新しい Claude（サブエージェント）に、文書と「読み手が実際にしそうな質問」を渡して答えさせ、曖昧さ・誤った前提・矛盾も点検させる。終わりは「Reader Claude consistently answers questions correctly and doesn't surface new gaps or ambiguities」 |
| 記録 | 構造を作った時点で、全節の見出しと「[To be written]」のあるファイル（またはアーティファクト）を作り、`str_replace` で節ごとに埋める。「全体を再出力しない」 |
| 中断・疲れ | 「If user seems frustrated: Acknowledge this is taking longer than expected. Suggest ways to move faster」。段階を飛ばしたい場合は「自由に書く」に切り替える |
| 伝え方 | 「Be direct and procedural」「Explain rationale briefly when it affects user behavior」「Don't try to 'sell' the approach」 |

考察: クリエイターの聞き取りに近いのは doc-coauthoring の「丸ごと出し → 番号つきの質問 → 理解が出た質問になったら終える」と、「新しい目で読む試験で穴を探す」。後者は生成プラグインを別のエージェントに試させる外側の EVAL と似た発想。

---

## 4. Claude Code の plugin-dev と feature-dev（`anthropics/claude-code` の `plugins/`、@49b8c35f、2026-10-20）

### 4.1 事実: `plugins/plugin-dev/commands/create-plugin.md`（415行）

| 項目 | 内容 |
| --- | --- |
| 段階の順番 | 8段階: ①Discovery ②Component Planning ③Detailed Design & Clarifying Questions ④Structure ⑤Implementation ⑥Validation ⑦Testing ⑧Documentation。TodoWrite で全段階を追跡 |
| ①の質問 | 目的が引数から明らかなら、**理解を要約して確認**。不明なら4問: どんな問題を解くか／誰がいつ使うか／何をするか／参考にする似たプラグインは。最後に「理解を要約してユーザーの確認を取ってから進む」 |
| ②の質問 | 必要な部品（スキル・コマンド・エージェント・フック・MCP・設定）を決め、**表**で出して確認を取る（部品の種類／数／目的） |
| ③の質問 | 「CRITICAL: This is one of the most important phases. DO NOT SKIP.」。部品ごとに未決の点を洗い出し、「Present all questions to user in organized sections (one section per component type)」（**まとめて、部品の種類ごとの見出しで**）、「Wait for answers before proceeding to implementation」。「If user says "whatever you think is best", provide specific recommendations and get explicit confirmation」。質問の例: スキルは「どんな質問で呼ばれるべきか」、エージェントは「先回りで動くか、頼まれたときだけか／どの道具／出力の形／守る品質」 |
| 質問の上限・網羅の確かめ・記録 | 書いていない。記録は TodoWrite のみで、聞き取りの結果をファイルに書く指示はない |
| 人の確認の場所 | 「Key Decision Points (Wait for User)」: Phase 1 の後（目的）、2の後（部品）、3の後（実装に進んでよいか）、6の後、7の後 |
| 質問の道具 | `allowed-tools` に `AskUserQuestion`。参照資料（`skills/command-development/references/interactive-commands.md`）: 「Users can always choose "Other" ... (automatic)」「Options should be 2-4 choices」「Can ask 1-4 questions per tool call」「header: Short label (max 12 chars)」 |
| 仕事の分け方 | 作る処理はサブエージェント（`agent-creator`、`plugin-validator`、`skill-reviewer`）に任せ、質問はメインのコマンドが持つ。`agents/agent-creator.md` の `tools: ["Write", "Read"]` で質問する手段がないのに、本文の Edge Cases に「Vague user request: Ask clarifying questions before generating」とある（**質問できないサブエージェントに質問を指示している矛盾**。メインが聞いたうえで渡す前提と読める） |

### 4.2 事実: `plugins/feature-dev/commands/feature-dev.md`（125行）

- 7段階。Phase 3 Clarifying Questions は「CRITICAL ... DO NOT SKIP」「Present all questions to the user in a clear, organized list」「Wait for answers」「If the user says "whatever you think is best", provide your recommendation and get explicit confirmation」。質問は「コードの理解のあと、設計の前」（"Ask questions early (after understanding the codebase, before designing architecture)"）。
- 設計は、方針の違う2〜3案（最小変更／清潔な設計／現実的な釣り合い）をサブエージェントに作らせ、メインが**推奨と理由**をつけて提示し、ユーザーが選ぶ。
- 「Phase 5 Implementation: DO NOT START WITHOUT USER APPROVAL」。

### 4.3 事実: Anthropic 公式ベストプラクティス（https://code.claude.com/docs/en/best-practices、2026-10-20 取得、`D-quotes/claude-code-best-practices-interview.md`）

- 「Let Claude interview you」: 「I want to build [brief description]. Interview me in detail using the AskUserQuestion tool. Ask about technical implementation, UI/UX, edge cases, concerns, and tradeoffs. Don't ask obvious questions, dig into the hard parts I might not have considered. Keep interviewing until we've covered everything, then write a complete spec to SPEC.md.」
- 終わりは「Keep interviewing until we've covered everything」（数ではなく網羅の自己判断）。その後は「start a fresh session to execute it」（新しい会話で、書いた仕様を使う）。
- 文脈: 「Claude's context window fills up fast, and performance degrades as it fills」「Customize compaction behavior in CLAUDE.md with instructions like "When compacting, always preserve ..."」「If you've corrected Claude more than twice on the same issue ..., /clear and start fresh」。

### 4.4 考察

- plugin-dev は「全部の質問を、部品ごとの見出しでまとめて出す」型で、1問ずつの型（superpowers、spec-kit clarify）と対照的。質問の数と形、聞き取りの記録、終える判断の規定は薄い。
- Anthropic 自身も、聞き取りで集めたことを**ファイル（SPEC.md）に書いて、新しい会話に引き継ぐ**型を勧めている。これは会話の文脈の劣化への対処。

---

## 5. GitHub awesome-copilot（@613efc8c、2026-10-20）

収録は寄稿の集まりで、品質は物による。Copilot CLI を明示して書かれた物（`ask_user` ツールを使う）を優先して読んだ。

### 5.1 Copilot CLI 向けと明記されていた物

**(a) `skills/roundup-setup/SKILL.md`（状況報告を作る plugin の初期設定の聞き取り。聞き取りの設計として最も参考になる）** 全文を `D-quotes/awesome-copilot-roundup-setup.md` に置いた。

| 項目 | 内容 |
| --- | --- |
| 段階の順番 | 1 歓迎（許可を求めず、そのまま次へ）→ 2 役割（4問）→ 3 **良い例を貼ってもらう**（最大3つ。「分析はまだしない、受け取ったと返すだけ」）→ 4 **文体の分析と playback**（「What I picked up from your examples:」形式: 形式／整理の仕方／口調／含めること／省くこと／癖。続けて `ask_user` で「合っているか、足りない・違うことは」）→ 5 読み手（複数なら質問を圧縮）→ 6 情報の場所（「"MCP tools" や "integrations" と聞かず、仕事がどこで起きるかを聞く」）→ 7 好みと制約（必ず入れる／入れない／守る制約）→ 8 設定ファイルの生成 → 9 試しに1回出してみる提案 |
| 質問の形 | 「Ask **one question at a time.** Use the `ask_user` tool for every question. Provide choices when reasonable, but always allow freeform answers.」「**Never bundle multiple questions** into a single prompt.」 |
| 平易さ | 「Use plain language throughout. ... Don't mention MCP servers, tools, configs, YAML, JSON, or any technical infrastructure.」 |
| 速さの目安 | 「Keep momentum. This should take 5-10 minutes, not 30.」「If someone is impatient, move faster.」 |
| あいまいさ・例がないとき | 例を持っていない人には「理想の形を説明してもらう」に切り替え、「箇条書きか段落か」「長さ」「堅さ」「入れる節」を個別に聞く |
| 疲れ・急ぎ | 「User seems rushed: compress the remaining phases. Get the essentials (examples + audiences + sources) and skip the nice-to-haves」 |
| 途中の変更 | 「Don't restart from the beginning」。既存の設定ファイルがあれば、上書きの前に聞く |
| 記録 | 最後に `~/.config/roundup/config.md` を生成。**貼ってもらった例は原文のまま**コードブロックに入れる。「非開発者が開いても読めるように」書く |
| 確認 | 分析結果の playback（段階4）、最後に「試してみるか」 |

**(b) `skills/azure-architecture-autopilot/`（Azure の構成を対話で決めて Bicep まで作る。`SKILL.md` に「Tool Usage Guide (GHCP Environment)」の表がある）**。`references/phase1-advisor.md` の `ask_user` の規則（`D-quotes/awesome-copilot-azure-autopilot-ask_user.md`）:
- 「Questions with 2 or more choices MUST use ask_user (do not list them as text)」
- 「`choices` MUST be passed as a string array」（文字列で渡すとエラー）
- 「If there is a recommended option, place it first and append `(Recommended)` at the end」
- 「Only 1 question per call」「Choices are limited to a maximum of 4」
- 「While waiting for user input via `ask_user`, preload information needed for the next step in parallel.」（質問の待ち時間に、次の調べ物を並行して行う）
- 「**HARD GATE** Spec Collection Complete → Diagram Generation Required」: 「仕様の収集が終わっただけでは Phase 1 は終わりではない。図を出してユーザーに見せて確認する」
- 「All sub-agents (explore/task/general-purpose) cannot use `web_fetch` or `web_search`.」（寄稿者の記述。Copilot CLI の実機では未確認）
- ユーザーの言語を最初のメッセージから判定して以後それで答える。
- これは寄稿者の記述であり、`ask_user` の引数の仕様の**公式の根拠ではない**（公式は「Ask the user a question」の1行だけ。9章）。

**(c) `skills/lsp-setup/SKILL.md`**: 「Always use `ask_user` with `choices` when asking the user to pick a language or scope.」

**(d) `skills/copilot-cli-quickstart/SKILL.md`**: `allowed-tools: ask_user, sql, fetch_copilot_cli_documentation`。学習の進み具合を、**セッションの `sql` ツールで表に保存**する（`lesson_progress`）。「SQL が失敗したら、進捗の保存なしで続ける」。これは Copilot CLI にセッション内の SQL の保存先があることを示す寄稿者の使い方（公式側の確認は別担当）。

### 5.2 Copilot CLI 向けと限定されない聞き取りの物

**(e) `skills/setup-my-iq/SKILL.md`（自分についての文脈ファイル6つを作る聞き取り。暗黙知を引き出す質問の型が多い）**。`D-quotes/awesome-copilot-setup-my-iq.md`。
- 「Ask one question at a time. Never present lists of questions.」「Never ask compound questions.」「Use what you learn in earlier files to inform later interviews. Don't re-ask things you already know.」
- 「When the user gives a vague answer, push for specifics: "Can you give me an example?" or "What does that actually look like day to day?"」
- 「When you have enough to draft, say so and draft. Don't keep asking. "Enough" means you have answers covering the core fields in that file's template」（**終える条件=ひな型の中心の欄が埋まったら**）
- **具体的な不満から規則を引き出す**: 「Surface them by recalling concrete frustrations rather than asking for abstract rules.」例:「When was the last time an AI tool did something you didn't want? What did it do, and what should it have done instead?」（「1つの答えで境界の規則が3つ出ることが多い」）
- **悪い例から避ける言い回しを引き出す**: 「Read this sentence: 'I'd encourage you to lean into the opportunity ...' What's wrong with it for your voice?」（"Surfaces the avoid-list faster than positive questions."）
- **事前入力は提案であって答えではない**: 「Pre-fill is a proposal, not an answer. Present what you found, label it as auto-filled, and ask the user to confirm or correct each value」「Open-ended fields ... still need to be asked. Don't fabricate them from indirect signals.」
- **反応のパス（Reaction Pass）**: 下書きを見せて「違うところ、仮定が外れたところ、足りないところは」。「問題ない」と言われたら1回だけ押す（「一番弱い・一般的な1文はどれか。どうすればもっと本人らしくなるか」）。2回目に「大丈夫」と言われたら受け入れて進む。
- 「Keep files concise. One page, not five.」「The files should sound like the user, not like an AI writing about them.」「If the user needs to stop mid-file, tell them where you are so they can resume.」
- 状態の判定: 既存ファイルの有無から「初回／途中で止まった／穴がある／更新／全部やり直し」の5場合に分け、再開できるようにする。

**(f) `skills/d365-solution-blueprint/SKILL.md`（Dynamics 365 の設計書を、設計者の聞き取りで作る。分野特化だが、聞き取りの設計は参考になる）**。`D-quotes/awesome-copilot-d365-blueprint.md`。
- 「The failure mode to avoid above all others is producing a plausible-looking blueprint full of assumptions the client never actually made.」「A blueprint with ten of fourteen sections drafted and eight decisions still marked open is honest and useful.」
- 節ごとに5拍: **Frame**（この節で何を決めるかを2〜3文）→ **Ask**（「put 3-5 questions to the user. Never dump twenty questions at once.」）→ **Propose**（本物の選択があるときだけ2〜3案とトレードオフと推奨）→ **Record**（決定ログ）→ **Draft and save**（書いて見せて保存し、進捗表を更新）。「Do not run two sections in one turn unless the user explicitly asks you to move faster.」
- **聞き方**: 「Ask the design question -> probe the constraint behind it -> surface the option the client has not considered.」「When the user gives you a solution, work back to the requirement. When they give you a requirement, propose options. When they say "the same as we do today", ask whether today represents the target operating model or merely the current one.」
- **記録の型**: 決定ログは6欄（決定・理由・却下した代替・影響・**決めた人（個人名）**・日付）。重要な文は**ちょうど1つ**に分類: Decision（決定）／Assumption（仮定。持ち主と検証日が要る）／Constraint（外から課された制約）／Open item（未決。持ち主と必要な日が必須）。「Never let an assumption drift into being presented as a decision.」本文には `**OPEN - [owner] / [date needed]**` と書き、台帳にも載せる。
- **決められないとき**: 取り返しがつかない決定がその場で決まらなければ、①「load-bearing open item」として記録、②決定者と、それが妨げになる日を書く、③それに依存して暫定になる節を明記（"Sections 5 and 7 are drafted on the assumption of X."）。
- **反対があるとき**: 「record the client's decision accurately and add an Architect's note stating your recommendation and the risk you see. Do not silently design around it and do not refuse to document it.」
- **中断と再開**: 「At the start of every later session: read the current blueprint first. Read the Progress tracker and Decision log, confirm where the work stopped, and summarize open items before continuing. Never re-ask a question that the decision log already answers.」「If the user resumes without the working blueprint ..., ask for the latest file rather than reconstructing decisions from memory.」
- 「Never fill silence with a plausible assumption.」「Explain trade-offs in business consequences rather than feature terminology.」

### 5.3 仕様・計画・プロンプトを作る汎用の物（質の幅が大きい）

| 物 | 聞き取りの規定 |
| --- | --- |
| `skills/prd/SKILL.md` | 「Before writing a single line of the PRD, you MUST interrogate the user」。聞くのは3項目（核心の問題・成功指標・制約）。「Never write a PRD without asking at least 2 clarifying questions first.」「Hallucinate Constraints しない。ユーザーが技術を指定していなければ、聞くか `TBD`」 |
| `agents/prd.agent.md` | 「Ask 3-5 questions to reduce ambiguity. Use a bulleted list」。会話口調で、まとめて出す |
| `skills/first-ask/SKILL.md`、`skills/boost-prompt/SKILL.md` | VS Code の Joyride 拡張の `joyride_request_human_input` を使う。「Keep refining until the human has no further input.」（**終える条件=人がもう足すことがない**） |
| `agents/custom-agent-foundry.agent.md`（VS Code のカスタムエージェントを作る） | 「Discover: Ask clarifying questions about role, purpose, tasks, and constraints」（役割／主な仕事／必要な道具／してはいけないこと／流れの中での位置／使う人）→ Design → Draft → Review → Refine → Document。質問の数・形の規定なし |
| `skills/microsoft-skill-creator/SKILL.md` | **先に調べてから聞く**: Learn MCP で調べて「見つけたことを示し、3問」（どの領域が重要か／主な作業／コードサンプルの言語） |
| `agents/gem-skill-creator.agent.md` | サブエージェント。「Ask only for true blockers」「No improvisation」。出力は JSON のみ |
| `agents/simple-app-idea-generator.agent.md` | 「One question at a time」。絵文字だらけの口調（クリエイターの方針と合わない） |
| `agents/salesforce-flow.agent.md` ほか3件 | 「Ask all your questions at once — batch them into a single list rather than asking one at a time」（**1問ずつの流派と正反対**） |
| `skills/quality-playbook/SKILL.md` | 「Guided Q&A. Ask 3-5 questions derived from what you actually found during exploration」。ファイルを読んで見つけた具体の事柄から質問を作る例（例: 「I found [specific defensive code]. What failure caused this? How many records were affected?」） |

### 5.4 事実: 公式ドキュメントとの食い違い

- 寄稿の学習ハブの文書（`website/src/content/docs/learning-hub/copilot-configuration-basics.md`、awesome-copilot の clone）に「Enhanced autopilot: When autopilot mode is active ... the agent automatically handles elicitation dialogs, `ask_user` prompts, sampling requests, and permission prompts without surfacing them as interactive dialogs.」とある。
- 公式の Autopilot の文書（https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/use-autopilot-mode、取得日 2026-10-20）は「`--no-ask-user` suppresses clarifying questions. The agent makes decisions instead of asking for input」と書き、autopilot 自体が質問を抑えるとは書いていない。**食い違い。どちらが実機の動作かは、実機で確かめる必要がある**（別担当への申し送り）。聞き取りのスキルは、autopilot の間は使わないか、事前に検出して止める設計が要る可能性がある。

### 5.5 考察

- Copilot CLI で実際に動いている聞き取りは、`ask_user`（選択肢＋自由入力）を使い、「1問ずつ」「推奨を先頭に（Recommended）」「選択肢は最大4つ」の規則を各自が書いている。仕様の出どころは公式ではなく寄稿者の経験。
- 「暗黙知を引き出す」質問の型（具体的な不満、悪い例、貼ってもらった例、事前入力は提案）は、roundup-setup と setup-my-iq にある。

---

## 6. BMAD Method（@61e01f82、2026-10-18）

注意: 「advanced elicitation」という名前だが、実体は**ユーザーから聞き出す手法ではなく、エージェント自身が直前に出した成果物を批評し直すための手法の一覧**（下の6.1）。聞き取りの手順は analyst・PM・brief・PRD などのスキルにある。

### 6.1 `skills/bmad-advanced-elicitation/`（事実）

- 説明（`SKILL.md` の冒頭）: 「Push the LLM to reconsider, refine, and improve its recent output.」
- 手法のカタログ `assets/methods.csv` は**71件、12分類**（collaboration 12、core 11、creative 9、advanced 8、risk 7、technical 6、framing 4、research 4、competitive 3、learning 3、philosophical 2、retrospective 2）。例: Socratic Questioning、5 Whys Deep Dive、First Principles Analysis、Pre-mortem Analysis、Assumption Audit、Steelmanning、Abstraction Laddering、Reframe the Question、Stakeholder Round Table、Red Team vs Blue Team、Boundary & Edge Case Sweep（後者は CHANGELOG の「19 new advanced-elicitation techniques」）。
- 使い方: 5つの手法を提示（分類から選ぶ）＋「Reshuffle（入れ替え）」「List all」「Proceed」の**メニュー**。選ばれた手法を最新の成果物に当てて、変更案を示し、「Apply／Reject／別の指示」。「Never change the work unless the user accepts the proposal.」
- 他のスキル（brief、PRD、brainstorming、forge-idea）が、あいさつで「いつでも bmad-party-mode や bmad-advanced-elicitation を呼べる」と案内する。

### 6.2 聞き取りに当たるスキル（事実）

**`skills/bmad-product-brief/SKILL.md`（95行）と `skills/bmad-prd/SKILL.md`（98行）。** `D-quotes/bmad-product-brief-brainstorming.md`、`D-quotes/bmad-prd.md`。

| 項目 | 内容 |
| --- | --- |
| 立ち位置 | 「You will not do the thinking for them. Coach, do not quiz. Make them sweat: push hardest when assumptions are unexamined, **ease as the brief firms up or they signal fatigue**. ... Push back when an answer is thin.」「the user must feel that it is their own creation」（PRD: 「Fight the urge to do the thinking for them unless they put you into Fast path.」） |
| 段階の順番 | PRD: 「Brain dump → Stakes calibration → Working mode → mode-scoped work. Get to working mode fast — two or three turns, not ten.」 |
| 最初の聞き方 | 「invite a brain dump and ask up front for any other source material they already have (memo, deck, transcript, prior brief, slack thread). **Read what exists first; ask only what is missing.** After the dump, a simple "anything else?" often surfaces what they almost forgot. Drill into specifics only after the broad shape is on the table; premature granular questions interrupt the dump and miss the room.」 |
| 質問の形 | 「**Elicitation, not direction.** ... Open-ended "tell me about X" beats multiple choice. When you find yourself naming wedges, picking MVP cuts, or proposing phases, stop — you have crossed from elicitation into authoring. Hand the pen back. **Infer-and-confirm ("I'm assuming X works like Y — right?") is fine; quizzing the user through a tree of LLM-shaped choices is not.**」 |
| 利用者の道を選ばせる | 「Working mode」: **Fast path**（残りの穴を**1〜2個のまとめた質問**にして、推測した所に `[ASSUMPTION]` を付けて全部書き、ユーザーが直す）か **Coaching path**（節ごとに一緒に歩く）。「最初の質問は、趣味／社内／公開のどれかという**重みの確認を1つ**」で、深さと厳しさを調整 |
| 実際の1回をたどる | 「**User Journeys are captured, not authored.** ... prompt the user to narrate a real session with a named protagonist (Mary, mom of three — not "the user") — what the person does, in what order, where it lands — then structure the answer into UJ-N form and confirm.」 |
| 懸念の見つけ方 | 「Concern scan」: ユーザーが渡した物を読みながら、その製品が実際に抱える懸念（遵守、連携の多さ、運用の約束、ハードウェアの制約、公開 API、収益化、データの統治 など）の名前を挙げる。「The list is open; recognize what's there, do not classify into a fixed shape.」（固定の分類を当てはめない） |
| 終える条件 | Finalize の手順（記録の監査 → 入力との突き合わせ → レビュー → **未決事項の仕分け** → 仕上げ → close）。仕分け: 「Phase-blockers (would make the PRD unsafe for UX/architecture/epics) surfaced **one at a time** and resolved; non-blockers deferred with owner + revisit condition」 |
| 記録 | **`.memlog.md`**（追記のみの記録）:「the run's canonical memory and audit trail — every decision, change, and override ... lands as one append-only line as the conversation unfolds. ... The PRD is distilled toward it; **whatever isn't logged is lost on resume.**」`memlog.py append --type <decision/change/override/assumption/event> --text "<one-line gist, reason included>"`。**`addendum.md`**: ユーザーが話した深い内容（却下した代替案の理由、選択肢の比較、技術の詳細、詳しいペルソナ）を、本文に入らないがその場で取り置く。「Capture to the addendum during the conversation ... do not wait for finalize.」 |
| 中断と再開 | 「The workspace persists; stop and resume freely.」作業フォルダは Create を確認した時点でディスクに作る（"Persistence is real-time."）。同じ種類の途中のフォルダ（frontmatter の `status` が `final` でない）があれば、再開を申し出る |
| サブエージェントの使い方 | 「**Extract, don't ingest.**」渡された資料はサブエージェントに**抽出**させ、親は抽出結果だけを受け取る。調べ物も「Subagent searches; parent gets a digest.」レビューは並列のサブエージェントが `review-{lens}.md` に書き、**親には要約だけ返す**。質問はサブエージェントがしない |

**`skills/bmad-brainstorming/SKILL.md`（84行）:** 「**One prompt per message while in dialogue; no multiple-choice menus.** Don't stack questions into a wall or hand a menu that invites lazy picking — both pull the user out of generating.」（例外は、進め方の選択だけ。「how to run is theirs to pick; what to ideate never is」）。**memlog** が会話の記憶: 「Whatever isn't in it is gone. Log every idea, decision, question, and bit of user direction ... one line each」。再開（`references/resume.md`）は memlog を**全部読む**のは再開のときだけ。

**`skills/bmad-forge-idea/SKILL.md`（113行）:** 「Ask one question at a time, press on weak points, and do not let vague claims pass without examination.」。「attack this」「defend this」「switch roles」で議論の向きを変えられる。「Strengthening an idea, rejecting it, or thinking it through more clearly are all complete outcomes」。

**`skills/bmad-agent-analyst/SKILL.md`（75行）:** Mary という名前の分析担当。活動開始の手順と、メニューで機能を呼ぶ形が中心で、聞き取りの手順そのものは書かれていない。

### 6.3 BMad Toolsmith（スキルやエージェントを作るスキル。Unreleased、v7 向けの初稿）

CHANGELOG（Unreleased）: 「Smithy builds a skill, an agent, a memory agent or a module from a conversation about what it is for, who uses it and what it produces ... **Nothing is written before the user approves a read-back**, and after a build five quality lenses run over every file the agent will read and Smithy fixes what they find.」「Toolsmith asks no setup questions.」

`skills/bmad-toolsmith/discover.md`（30行。全文を `D-quotes/bmad-toolsmith-discover-canon.md` に置いた）:

- **Mine before you ask**: 「Read what the user already gave you: the request, the conversation so far (tools used, the order of steps, corrections they made, inputs and outputs they showed), files or skills they pointed at. When the conversation itself is the workflow ("turn this into a skill"), most answers are in it. Ask only for the gaps.」
- **質問の形**: 「**One or two questions at a time**, in whatever order the gaps call for, **each with the answer you would infer so the user can just confirm.** A user who arrives with a hardened idea or says they want to move fast gets a confirmation and a read-back, not an interview.」
- **決めること5つ**: ①何を片づけるか・誰のためか（「2つの目的は2つのスキル」）、②出力を使う人（または物）と、その人が**この会話なしで動けるために出力が満たすべきこと**（「the one line that sets every bar」）、③呼ぶときに打つ言い回しと、静かにしているべき近い依頼、④何で動くか・モデルが元から知らないノウハウがどこにあるか（手順書、事故、手でやった記録、繰り返す訂正）、⑤出力が客観的に検査できるか（試験にどれだけ頼るかを決める）。加えて、**どこで動かすか**（自分のエージェントとモデル／組織の既知のモデル／**モデル不明の人たちへの配布**）。「That last answer decides whether anything can be measured against the model in the room.」
- **押し返し**: 「そもそもスキルか、本人が直接頼める一度きりか／プロジェクトの規約（指示ファイル向き）／スクリプトで検査できる制約／どんな入力で壊れるか」。さらに、「スキルが**モデルに何かを教える**と主張する場合は、1つの現実の入力で、**仕様ではなく呼び出し文だけ**を、スキルなしのサブエージェントに流して、それで足りるなら『スキルは不要』と言う」。
- **提案したら辞退を再提案しない**（「One line each; the user picks, and a decline is not re-proposed.」）。
- **読み返し（read-back）**: 名前（本人に聞く。提案つき）、1行の目的、説明文の下書き、形、登録の仕方、進め方、置き場所、作るファイル。**承認を待つ**。承認で `{target}` が決まり、後続は「再度聞き直さず、読み返しから」作業する。承認後の変更は「触る部分だけやり直す」。
- `ship.md`: 作ったあと、**5つの観点（lens）のサブエージェントを並列で**走らせて直し、`cut_check.py` で意図せず消えた文を戻し、トークン数を測って伝え、**呼び出しの試験（呼ばれるべき8〜10個、紛らわしい8〜10個）を1回だけ提案**。

`skills/bmad-toolsmith/canon.md`（89行。指示文の質の基準）:
- 「Asked to build a prompt, you will script the path: phases, question banks, mandatory sections. It feels like diligence; it is **the central defect**. A script is your imagined transcript of one good session; real sessions diverge, and a model holding one spends its intelligence on compliance.」→ **「Write the destination, not the route」**: 立場（stance）、結果（outcome）、使う人（consumer）、基準（bar）、**推測できないこと**（non-inferables）だけ書く。「The consumer is the highest-leverage line」。
- 「ALL-CAPS MUST, ALWAYS and NEVER mean the prompt is patching a symptom the author once saw. ... A rule with its reason survives the case the author did not foresee.」「Say what to do rather than what to avoid.」
- 「Close every step on a condition the model can check. A step that ends on "once it is clear" or "when ready" lets the model declare itself done early.」
- 「The two-version comparison」: 5行の最小版と本物を同じ入力で比べ、最小版が勝てば構造は足かせ。
- 「Number only true sequences.」（番号は、本当に順番が要る手順だけ）

### 6.4 考察

- BMAD の PRD・brief の聞き取りは、**自由回答と丸ごと出しを先に、押し返しを価値とし、選択肢の木を連ねる質問を避ける**。Smithy は「推測した答えを添えて確認させる」。この2つは、superpowers v7 とほぼ同じ向き。
- BMAD は**追記のみの記録（memlog）を会話の途中で書き、再開はそれを読む**ことで、長い会話の消失に備える。クリエイターの設計項目 6 に直接効く。
- Smithy の `canon.md` は、「質問の台帳（question bank）を台本にする」ことを**欠陥**と書く。これは「聞く項目（REQ-015）を固定の質問票にする」設計と緊張関係にある。ただし canon の前提は、有能なモデルと、検証のできる環境（5行の最小版との比較試験）で、安価なモデルでは別の証拠（8章）がある。

---

## 7. Kiro（AWS）— 公式ドキュメント

事実（`D-quotes/kiro-and-openai-docs-excerpts.md`。WebFetch の要約を通した値）:

| 項目 | 内容 |
| --- | --- |
| 段階の順番 | Requirements-First（要求 → 設計 → タスク）と Design-First（設計 → 要求 → タスク）。`requirements.md`、`design.md`、`tasks.md`。Quick Spec は段階ごとの承認なし（"without approval gates between them"）。最初に「機能か、バグ修正か」を聞く |
| 要求の書き方 | `requirements.md` は EARS 記法の "structured, testable requirements"。型: `WHEN [condition/event] THE SYSTEM SHALL [expected behavior]`。例: "WHEN a user submits a form with invalid data THE SYSTEM SHALL display validation errors next to the relevant fields"。中身: ユーザーストーリー＋受け入れ基準、EARS の振る舞い、機能要求、**エッジケースとエラー処理** |
| 質問の形・数・上限・あいまいさの扱い | **見つからなかった**（`/docs/specs/`、`/feature-specs/`、`/feature-specs/requirements-first/`、`/best-practices/`、2025-07-15 の公式ブログ「From chat to specs」を読んだが、「質問して要求を引き出す」手順の記述はない。ブログは「identifies and resolves ambiguities upfront」と書くが方法は書かない） |
| 網羅の確かめ | 要求ができたあと、**Analyze Requirements** を選ぶと「logical inconsistencies, ambiguities, conflicting constraints, and gaps」を深く分析する（"takes minutes (not seconds)"。「小さな・分かりきった仕様では省いてよい」）。聞き取りではなく、書いた後の点検 |
| 確認の取り方 | 要求の見直し（「Confirm when requirements meet your needs.」）、各文書に Review ボタン（"opens Markdown Review, where you can comment on exact passages and send your comments to Kiro at once."） |
| 繰り返し | 「Kiro's Feature Specs are designed for continuous refinement」。要求を直接直すか、Kiro に頼んで設計を合わせ直させ、`tasks.md` で Sync Files |
| 中断と再開 | 文書がファイルとして残るので再開できる。専用の手順の記述は見つからなかった |

考察: Kiro の公式の説明は、**書いた文書を人が見て直す**ことに重心があり、聞き取りの設計は参考にならない。参考になるのは要求の書き方（EARS の「WHEN … SHALL …」）と、書いた後の自動点検（Analyze Requirements）。EARS は Spec Kit のコミュニティ拡張（`ears`）でも使われている（拡張の説明の事実）。

---

## 8. OpenAI（Codex と ChatGPT）

### 8.1 Codex の plan モード（一次: `openai/codex` @ feadd944、2026-10-20。`codex-rs/collaboration-mode-templates/templates/plan.md`、128行。全文を `D-quotes/openai-codex-plan-mode.md` に置いた）

| 項目 | 内容 |
| --- | --- |
| 段階の順番 | 3段階: **PHASE 1 環境で足場を固める（explore first, ask second）** → **PHASE 2 意図の会話（what they actually want）** → **PHASE 3 実装の会話（what/how we'll build）** → 計画の提示（`<proposed_plan>`） |
| 質問の前の調べ | 「Eliminate unknowns in the prompt by discovering facts, not by asking the user. ... **Before asking the user any question, perform at least one targeted non-mutating exploration pass**」。例外: プロンプト自体に明らかな曖昧さや矛盾があるときだけ、調べる前に聞いてよい。「Never ask questions you can answer from your environment (e.g., "where is this struct")」 |
| 2種類の未知 | ①**調べればわかる事実**は調べる（聞くのは、候補が複数／見つからないが識別子が要る／本当は製品の意図、のとき。聞くときは**具体の候補（パス、サービス名）を示して1つを推奨**）。②**好み・トレードオフ**（調べても出ない）は**早めに聞く**。「Provide 2–4 mutually exclusive options + a recommended default.」「**If unanswered, proceed with the recommended option and record it as an assumption in the final plan.**」 |
| 質問の形 | 「Strongly prefer using the `request_user_input` tool」。「Offer only meaningful multiple‑choice options; don't include filler choices」。選択肢にできない重要な質問だけ、ツールなしで直接聞いてよい |
| 質問の数 | 「You SHOULD ask many questions, but each question must: materially change the spec/plan, OR confirm/lock an assumption, OR choose between meaningful tradeoffs. not be answerable by non-mutating commands.」（**数の上限なし。質問ごとの条件を付ける**） |
| あいまいさ・網羅 | PHASE 2: 「Keep asking until you can clearly state: **goal + success criteria, audience, in/out of scope, constraints, current state, and the key preferences/tradeoffs.**」「**Bias toward questions over guessing: if any high-impact ambiguity remains, do NOT plan yet—ask.**」。PHASE 3: 「keep asking until the spec is **decision complete**: approach, interfaces (APIs/schemas/I/O), data flow, edge cases/failure modes, testing + acceptance criteria, rollout/monitoring, and any migrations/compat constraints.」 |
| 終える条件 | 「Only output the final plan when it is **decision complete** and leaves no decisions to the implementer.」 |
| 記録 | 最終の計画（Summary／Key Changes／Test Plan／Assumptions。「Explicit assumptions and defaults chosen where needed」）を `<proposed_plan>` で包む。**途中の決定の保存先は規定なし**（会話の中） |
| ユーザーの確認 | 「Do not ask "should I proceed?" in the final output. The user can easily switch out of Plan mode」。計画の修正は「完全な置き換え」で出す |
| モードの強制 | 「Plan Mode is not changed by user intent, tone, or imperative language. If a user asks for execution while still in Plan Mode, treat it as a request to **plan the execution**, not perform it.」。変更する操作は禁止（読む・調べるのは許可） |
| 中断と再開 | 規定なし |

`request_user_input` ツールの仕様（`codex-rs/core/src/tools/handlers/request_user_input_spec.rs`。`D-quotes/openai-codex-request_user_input_spec.rs.txt`）:
- 質問の配列について「**Prefer 1 and do not exceed 3**」。
- 選択肢「Provide 2-3 mutually exclusive choices. **Put the recommended option first and suffix its label with "(Recommended)".** Do not include an "Other" option in this list; the client will add a free-form "Other" option automatically.」
- 質問は「Single-sentence prompt」、見出しは12字以内、選択肢の説明は「One short sentence explaining impact/tradeoff if selected.」
- すべての質問に選択肢が必須（空だとエラー）。モードによっては使えない（`request_user_input is unavailable in {mode} mode`）。コミュニティの報告（二次、OpenAI community forum の検索結果）では、既定モードでは使えず plan モードで使える。

`/init`（`codex-rs/tui/assets/prompt_for_init_command.md`、41行）: 質問せず、リポジトリを読んで `AGENTS.md`（"Repository Guidelines"、200〜400語）を書く。既存ならそのまま（"do not overwrite or modify it"）。公式ベストプラクティス: 「keep it short」「add rules only after you notice repeated mistakes」。

### 8.2 Codex の skill-creator（`codex-rs/skills/src/assets/samples/skill-creator/SKILL.md`、229行。`D-quotes/openai-codex-skill-creator-excerpt.md`）

- 「Ask clarifying questions only when the missing information matters and cannot be reasonably inferred.」
- 「If the user has already explained the task clearly, proceed without requesting additional examples.」
- 「Assume Codex is already capable. Include only information that changes its decisions or improves its work.」「Preserve user intent and scope. ... Do not turn a particular example, past failure, or personal preference into a universal requirement.」（利用者1人の癖を一般則にしない）
- 呼び出し方式の質問は、**本当に不明で重要なときだけ**（既定は自動発見）。
- 評価では「Give the evaluating agent a realistic user request, the skill, and the minimum raw artifacts needed ... Do not provide the intended answer, suspected bug, proposed fix, or prior conclusions」。

→ Anthropic の skill-creator は「Proactively ask」、Codex のものは「必要なときだけ」。**聞く量の方針が反対**。

### 8.3 Codex の公式ドキュメント（二次: WebFetch の要約、日付表示なし）

- 「Plan mode lets Codex gather context, ask clarifying questions, and build a stronger plan before implementation.」
- 「If you have a rough idea of what you want but aren't sure how to describe it well, ask Codex to question you first.」

### 8.4 ChatGPT の GPT Builder と Agent Builder

- GPT Builder: 公式ヘルプ（help.openai.com）は HTTP 403 で**取得できなかった**。curl でも同じ。検索結果の要約（低確信）では、現行のヘルプは「conversational builder」と「configuration view」と書き、OpenAI は Custom GPTs を 2026-12-11 に終了して plugins/skills に移す、と報じられている。BMAD の CHANGELOG にも「Gemini Gems and ChatGPT Custom GPTs are deprecated and are being replaced by skills on both platforms.」とある（BMAD の記述）。本文は未確認。
- Agent Builder: 公式ガイド（https://developers.openai.com/api/docs/guides/agent-builder、取得日 2026-10-20）に「OpenAI is deprecating Agent Builder.」「scheduled to shut down on November 30, 2026」。キャンバスにノードをつなぐ手作業の作り方で、質問して作る手順の記述はない。

考察: OpenAI の公開物で、聞き取りの設計として使えるのは **Codex の plan モードのテンプレート**（一次・全文）。GPT Builder と Agent Builder は参考にならない（取得不能／終了予定）。

---

## 9. GitHub Copilot CLI 自身の plan モードと `/init`（公式ドキュメントのみ）

事実（`D-quotes/copilot-cli-docs-excerpts.md`。docs.github.com の HTML をテキスト化、取得日 2026-10-20）:

| 項目 | 内容 |
| --- | --- |
| plan モード | `Shift+Tab` で通常モードと plan モードを切り替える（ベストプラクティス）。コマンドリファレンスの表は「Shift+Tab: Cycle between standard, plan, and autopilot mode.」で、autopilot も含めて巡る。`/plan [PROMPT]`: 「Create an implementation plan before coding.」 |
| plan モードの流れ（ベストプラクティス） | 「Analyzes your request and codebase. / **Asks clarifying questions to align on requirements and approach.** / Creates a structured implementation plan with checkboxes. / Saves the plan to `plan.md` in your session folder. / **Waits for your approval before implementing.**」。`Ctrl+Y` で計画を既定のエディターで見て直せる |
| 質問の道具 | 道具の一覧に「`ask_user` — Ask the user a question」。引数の仕様の公式な記述は**見つからなかった**。「`--no-ask-user`: Disable the ask_user tool (the agent works autonomously without asking questions).」。公式の Autopilot の文書: 「`--no-ask-user` suppresses clarifying questions. The agent makes decisions instead of asking for input」。2026-01-21 の公式の更新履歴（要約）: Copilot は `ask_user` で追いの質問をし、前提を確かめ、設計の判断の意見を聞く |
| plan モードの保護 | 「`/plan` starts a planning session where Copilot CLI can explore and analyze your codebase but is blocked from editing your project files. ... this isn't just a suggestion to the model, it's enforced directly, so it doesn't depend on the model choosing to behave.」「Delegated sub-tasks are protected too」。計画のファイルは別の作業場所に書ける。「It's a safety net, not a guarantee.」 |
| `/init` | 「Copilot analyzes your codebase and writes or updates a `.github/copilot-instructions.md` file in the repository.」記すこと: ビルド・試験・lint のコマンド、大まかな構造、リポジトリ固有の決まり。「If the file already exists, Copilot suggests improvements which you can choose to apply or reject.」→ **質問せずコードを読んで書く** |
| 文脈の管理 | 「The system automatically manages context through intelligent compaction」、`/compact [FOCUS-INSTRUCTIONS]`（「Summarize the conversation history to reduce context window usage」）、`/context`、`/clear`・`/new`、チェックポイント。ただし**手順や途中の決定が要約で残るか**の記述は見つからなかった |
| 再開 | `/resume [SESSION-ID]`、`/continue`、`--resume`/`-n NAME`（名前で探せる） |
| 外部からの割り込み | 「Steering And Queueing」（Ctrl+Enter で次の発言として待機）。見つけた範囲では、スキル実行中の質問に割り込む仕組みの説明はない |

考察: Copilot CLI の plan モードも `/init` も、公式の説明は薄い。聞き取りの設計の細部（質問の数、形）は書かれていない。クリエイターは `ask_user` の実際の引数を、別担当（パッケージの中身）の調査で確かめる必要がある。

---

## 10. 追加: mattpocock/skills の grilling（質問の出し方の設計と、利用者の報告が同じ場所にある）

事実（一次: `skills/productivity/grilling/SKILL.md`（30行）と `docs/productivity/grilling.md`、`docs/productivity/grill-me.md`、`.changeset/grilling-yes-accepts-recommendation.md`。`D-quotes/mattpocock-grilling.md`、`mattpocock-grill-me-doc.md`）:

| 項目 | 内容 |
| --- | --- |
| 段階の順番 | 主題を**設計の木（design tree）**として扱う。決定が子の決定を呼ぶ。**frontier**=前提が全部決まっていて、いま聞ける質問の集まり。**round**=frontier を1回で聞く |
| 質問の形 | 「Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.」書式: `❓ **Q1** - **<title>**: <body>` の下に `➡️ <your recommended answer>`。「Word each question so "yes" accepts your recommended answer.」（2026年に追加: 推奨が質問に反対していて、同意すると「いいえ」になる問題への修正） |
| 1回に聞く数・上限 | frontier のぶんまとめて（「13問が約3 round」「46問が4 round」）。**上限は設けない**（「Some plans need three questions and some need fifty; a fixed ceiling either truncates the hard case or feels arbitrary on the easy one.」）。「Count rounds, not questions.」 |
| 事実と決定の分け方 | 「Finding *facts* is your job, never the user's. ... dispatch a sub-agent to find it; ... Don't block on it」「The *decisions* are the user's: put each to them and wait.」「An agent running `grilling` that answers its own decisions has broken the skill.」 |
| 終える条件 | 「The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. **Do not act on it until the user confirms you have reached a shared understanding.**」 |
| 記録 | `grill-me` は**状態を持たない**（ファイルを書かない）。`grill-with-docs` は `GLOSSARY.md`（用語集）と ADR を**その場で**書く（`domain-modeling` スキル）。ADR を勧めるのは「元に戻しにくい／文脈なしでは驚く／本物のトレードオフの結果」の3つが全部そろうときだけ |
| 用語の整理 | `domain-modeling`: 「Sharpen fuzzy language: propose a precise canonical term.」「Discuss concrete scenarios: Invent scenarios that probe edge cases and force the user to be precise」「Cross-reference with code: ... "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"」 |
| 「分からない」 | 「"I don't know" is a real answer, and a question you can't answer is usually a sign to prototype rather than to guess.」「ungrillable」（見た目や感触のように、反応するものがないと答えられない質問）は、話し合いをやめて試作する |
| 質問の担当を他人に移す | `to-questionnaire`: 「Grill the send, not the subject.」ユーザーが答えられない（受け手が知っている）事柄は、ユーザーに「誰に送るか」「何を返してほしいか」だけ聞き、相手に渡す**質問票**（Markdown）を作る |
| 中断・引き継ぎ | `handoff`: 会話を引き継ぎ文書に圧縮して別のエージェントに渡す（「他の成果物に書かれた内容は複製せず、パスで参照」「機密は伏せる」） |

利用者の報告・作者が書いた設計の理由（一次: 作者の文書。「作者が集めた利用者の声」を含む）:
- 「Can I go back to one question at a time? Yes, and **a large part of the audience does**.」「Users who read slowly, who work in a second language, or who use the sequential format to help them focus report that one question at a time works better for them.」（CLAUDE.md に1行足せば戻せる）
- 「**It ran out of questions and started building.** ... Weaker and faster models still skip the gate. **Users report this most often on lower-effort or non-frontier models, which collapse "interview until shared understanding" into a couple of questions and an outline.** If yours does it, the reliable fix is a line in your own `AGENTS.md` or `CLAUDE.md` telling the agent not to implement without permission.」
- 「**It answered its own questions instead of asking me.** That is a bug in the run ... It happens most when another skill runs `grilling` to resolve a ticket, and the agent takes that task as permission to keep moving.」
- 「`grill-with-docs` ran, but it never loaded `grilling`. This is a real bug, still unfixed, and users report it across harnesses and models. **A skill that names another skill does not reliably cause that skill to load**」
- 失敗の型: 「passivity: answering "agreed, agreed, agreed" for forty questions and coming out with a plan the agent wrote and you nodded at.」
- モデル: 「Grilling depends on the model's own knowledge of how systems break, so use your best one. Implementation mostly follows context, so a cheaper model is fine there.」
- 履歴: 「Round-based questioning shipped briefly as a separate skill (`/batch-grill-me`), then moved into `grilling` itself」。**1問ずつ → 一括 → round（frontier）**と変わった。

考察: grilling は、1問ずつ（遅い）と全部一度に（依存する質問が混ざる）の間を、frontier という単位で解いた設計。ただし作者自身が、frontier の選択は「判断であって計算ではない」と認め、半数近くの利用者が1問ずつに戻すと書いている。安価なモデルが「終わった」を早く宣言する、という報告は、設計項目 11 に効く。

---

## 11. 道具どうしの比較表

「上限」は、質問の数の規定。「推奨」は、推奨の選択肢の提示。

| 道具 | 最初の動き | 質問の形 | 1回の数 | 上限 | 事実の調べ | 推奨を示す | 決定の記録 | 終える条件 | 人の確認 | 再開 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Spec Kit specify | 推測で埋める | 選択式（A/B/C/自由）を表で | 最大3（まとめて） | 3つの未確定印 | 推測・既定 | 表に Implications | spec.md、Assumptions 節 | チェックリストが通る（3回まで） | 質問の答え | 規定なし |
| Spec Kit clarify | 領域10種の地図 | 選択式（2〜5）か5語の答え | **1** | **5**（セッション全体） | 規定なし（仕様書を読む） | **先頭に推奨と理由** | **答えごとに** spec.md の Clarifications と本文 | 5問／重大点の解消／ユーザーの「done」 | 答えごと | spec.md に残る |
| superpowers v7 | 質問を省く申し出＋自由回答1問 | **自由回答が先**。選択肢は行き詰まったときだけ | **1** | なし | 申し出て調べる | 「推測を出して直させる」 | 設計書（最後に1つ）。途中は会話 | 設計書の承認 | 小分けの説明（200〜300語）を交互に、builder check、承認 | 規定なし |
| Anthropic skill-creator | 会話から先に読み取る | 規定なし（4項目＋「Proactively ask」） | 規定なし | なし | MCP・サブエージェントで下調べ | 規定なし | 聞き取りの記録の規定なし | 規定なし | 「次に進む前に確認」 | 規定なし |
| Anthropic doc-coauthoring | 5つのメタ質問＋情報の丸ごと出し | **番号つき5〜10問**、略式の答え | 5〜10（まとめて） | なし | 連携で読む | 候補5〜20個から選ばせる | 見出しと「[To be written]」のファイルに節ごと | 「質問が基本ではなく例外・トレードオフになった」／読み手の試験が通る | 節ごとの下書きを見せる | ファイル |
| Claude Code plugin-dev | 目的が明らかなら要約して確認 | 部品ごとの見出しで**まとめて** | まとめて | なし | コード探索（feature-dev） | 「任せる」と言われたら推奨を出し明示の確認 | TodoWrite のみ | 段階の人の確認（5か所） | 5か所で待つ | 規定なし |
| Claude Code ベストプラクティス | 「interview me」の例文 | `AskUserQuestion` | 規定なし | なし | 「Don't ask obvious questions」 | 規定なし | 終わったら SPEC.md | 「Keep interviewing until we've covered everything」 | 規定なし | 新しい会話で SPEC.md から |
| awesome-copilot roundup-setup | 歓迎→役割 | `ask_user`（選択肢＋自由入力） | **1** | 目安5〜10分 | 貼ってもらった例を分析 | 規定なし | 最後に config.md（例は原文で） | 全段階の完了 | 分析の playback、試し出し | 既存ファイルの扱い |
| awesome-copilot setup-my-iq | 事前入力を提案 | 1問ずつ、複合なし | **1** | なし | 事前入力は「提案」 | 規定なし | ファイルごとに下書き→反応のパス | ひな型の中心の欄が埋まる | 反応のパス | 5つの状態で再開 |
| awesome-copilot d365 blueprint | 節ごとに Frame | Ask→深掘り→選択肢の提示 | **3〜5** | 「二十問を一度に出さない」 | 公式情報で検証 | 本物の選択があるとき | 決定ログ6欄、4分類 | 節ごとの保存。未決は明示 | 節ごと | 進捗表と決定ログを読んで再開 |
| BMAD brief/PRD | 丸ごと出し→重みの確認→作業モード選択 | **自由回答が先**。「選択肢の木」は避ける。Fast path は1〜2個にまとめる | 1 または 1〜2 | なし | 「読んでから聞く」。調べはサブエージェント | 推測を出して確認 | memlog（追記のみ）＋ addendum | Finalize の手順。未決の仕分け | 節ごと、レビュー | memlog と作業フォルダ |
| BMAD Toolsmith | 会話から読み取る | 1〜2問、**推測した答えを添えて** | 1〜2 | なし | 「Mine before you ask」 | 推測した答えを添える | 承認された read-back | read-back の承認 | read-back を承認するまで何も書かない | 規定なし |
| Kiro | 規定を見つけられなかった | — | — | — | — | — | requirements.md（EARS） | ユーザーが確認 | Review ボタン | ファイル |
| Codex plan モード | **先に調べる**（質問の前に最低1回） | `request_user_input`（2〜3択、推奨を先頭、「Other」自動） | 推奨1、最大3（道具） | **なし**（質問ごとの条件） | 調べて分かることは聞かない | **推奨を先頭に**。無回答なら推奨で進み仮定として記録 | 最終の `<proposed_plan>` | 「decision complete」 | 計画の提示、モード切替 | 規定なし |
| Copilot CLI plan | 公式の説明は薄い | `ask_user`（引数は未確認） | 規定なし | なし | 探索する | 規定なし | `plan.md`（セッションのフォルダ） | 承認 | 「Waits for your approval」 | `/resume` |
| grilling | 設計の木を作る | **frontier を番号つきで一括**、推奨つき | frontier 分 | **なし**（意図的に） | **サブエージェントが調べる** | **毎問に推奨**、`yes` で受け入れ | glossary / ADR（with-docs）／なし（grill-me） | frontier が空＋ユーザーが共有理解を確認 | 確認するまで動かない | handoff |
| SpecKit Grill Me（拡張） | 事実を先に調べる | 1問ずつ（1〜3択＋必ず自由入力） | 1 | なし | 調べる | **理由つきの推奨**＋確認済みの事実／決定／未確認の仮定を出どころつきで並べる | spec.md に答えごと | 全決定点が最終状態＋満足の確認 | 満足の確認 | spec.md |

---

## 12. 共通して使われている工夫（事実の集計。出典は上の各章）

1. **調べて分かることは聞かない／先に読んでから聞く**: Codex plan mode、BMAD（brief・PRD・Toolsmith）、skill-creator（会話から先に読み取る）、grilling（事実はサブエージェント）、setup-my-iq（事前入力は提案）、Pocock の setup スキル（「Explore, present what you found, confirm with the user, then write」）。
2. **聞くのは「決定」と「好み」**: Codex の「2種類の未知」、grilling の「事実は自分の仕事、決定はユーザーの」、d365 の「Never fill silence with a plausible assumption」、Spec Kit の「reasonable defaults（聞かなくてよい例）」。
3. **推奨や推測の答えを添えて確認させる**: Spec Kit clarify（`yes`/`recommended`）、Codex（推奨を先頭、`(Recommended)`）、grilling（`yes` で受け入れ）、Smithy（推測した答えを添える）、superpowers（推測を出して直させる）、BMAD（infer-and-confirm）、Copilot の寄稿スキル（`(Recommended)` を先頭）。
4. **選択式は2〜4個、自由入力の逃げ道が常にある**: Claude `AskUserQuestion`（2〜4、「Other」自動）、Codex（2〜3、「Other」自動）、Spec Kit（2〜5＋短い答え）、Copilot の寄稿スキル（最大4）。
5. **決まったことを会話の途中でファイルに書く**: Spec Kit（答えごとに保存）、BMAD memlog（追記のみ）、d365（決定ログ）、grill-with-docs（用語集と ADR をその場で）、doc-coauthoring（節ごとに `str_replace`）。「会話の要約・圧縮で消える」ことへの備えとして、Spec Kit と BMAD は指示文に理由を書いている。
6. **理解を返して直してもらう**: superpowers（200〜300語の塊を交互に）、roundup-setup（段階4）、setup-my-iq（反応のパス）、Smithy（read-back）、plugin-dev（要約して確認）、grilling（共有理解の確認）。
7. **承認までは作らない（ゲート）**: superpowers の HARD-GATE、plugin-dev の「Key Decision Points」、feature-dev の「DO NOT START WITHOUT USER APPROVAL」、Smithy の read-back、Copilot plan の「Waits for your approval」、Codex plan（モードの強制）。
8. **仮定に印を付ける**: Spec Kit（Assumptions、`[NEEDS CLARIFICATION]`）、Codex（assumptions）、BMAD（`[ASSUMPTION]`）、d365（4分類と「仮定が決定に化けない」）、superpowers（「推測は推測と印を付ける」）、grilling（「nothing left silently assumed」）。
9. **専門用語を避ける・平易に**: superpowers（process jargon を使わない）、Spec Kit（「質問1行だけで答えられる」）、roundup（MCP・YAML などを言わない）、skill-creator（手がかりを見て用語を選ぶ）、d365（業務への影響で説明）。
10. **本人が断れる／急げる**: superpowers（最初に質問を省く申し出）、skill-creator（「just vibe with me」）、BMAD（Fast path）、roundup（急ぐ人は圧縮）、Spec Kit（「done」）、doc-coauthoring（段階を飛ばす）。
11. **サブエージェントは「調べる・抽出する・点検する」に使い、ユーザーへの質問は親が持つ**: BMAD（抽出・調査・レビュー）、grilling（事実の調査）、superpowers（builder check）、doc-coauthoring（読み手の試験）、plugin-dev（作る・検証する）。サブエージェントが質問する設計は見つからなかった（plugin-dev の `agent-creator` は質問を指示するが、道具が Write と Read だけ）。
12. **質問が書き手の目標に効くかを事前に確かめる条件**: Codex（materially change the plan／確認する／トレードオフを選ぶ）、Spec Kit（設計・試験に実質影響する質問だけ）、setup-my-iq（"Enough means ... core fields"）。

---

## 13. 道具ごとに違う工夫（事実。差が出た理由の説明は章内の作者の記述）

| 論点 | 一方 | もう一方 |
| --- | --- | --- |
| 自由回答 vs 選択式 | superpowers v7（自由回答が先）、BMAD（"Open-ended beats multiple choice"）、roundup（選択肢は「適切なとき」） | Spec Kit clarify（選択式 or 5語）、Codex（`request_user_input` は選択肢が必須）、Claude `AskUserQuestion` |
| 1問ずつ vs まとめて | superpowers、Spec Kit clarify、BMAD brainstorming、setup-my-iq、roundup（「Never bundle」） | plugin-dev・feature-dev（部品ごとにまとめて）、doc-coauthoring（5〜10問）、Salesforce 系のエージェント（「Ask all your questions at once」）、grilling（frontier の round） |
| 数の上限 | Spec Kit clarify（5）、checklist（3＋2）、PRD スキル（最低2）、d365（3〜5問ずつ） | Codex（なし、質問ごとの条件）、grilling（意図的になし）、superpowers（なし） |
| 聞く量の方針 | Anthropic skill-creator（"Proactively ask"）、Codex plan（"Bias toward questions over guessing"） | Codex skill-creator（"Ask clarifying questions only when ... cannot be reasonably inferred"）、Spec Kit specify（まず推測、未確定印は3つまで） |
| 終える判断 | 数（Spec Kit 5）、空の frontier（grilling）、承認（superpowers）、「質問が理解を示す」（doc-coauthoring）、ひな型の中心の欄が埋まる（setup-my-iq）、decision complete（Codex）、本人がもう足さない（first-ask） | 規定なし（skill-creator、Kiro） |
| 記録のタイミング | 答えごと（Spec Kit、BMAD memlog、grill-with-docs） | 最後に1つ（superpowers の設計書、roundup の config、Codex の計画） |
| 中断と再開の備え | BMAD（memlog、作業フォルダ、再開の申し出）、d365（進捗表と決定ログ）、setup-my-iq（状態の判定） | grill-me（状態を持たない）、skill-creator・Codex・Kiro（規定なし） |
| 指示文の書き方 | Spec Kit・superpowers: 手順・数値・禁止・赤信号の表・ゲート。BMAD canon: 「台本ではなく行き先を書く」「質問の台帳は欠陥」 | — |
| 指示文の検証 | superpowers（AI が演じる利用者の多ターン試験、盲検、モデルを変えた試験）、BMAD（`bmad-eval`、呼び出しの試験）、skill-creator（試験の課題と採点） | Spec Kit（テンプレートの**文言**を確かめる `tests/test_clarify_stage_gate.py`。対話の質は測らない） |
| 質問を「出さない」道 | Copilot `/init`、Codex `/init`（質問せずコードを読んで書く） | — |

---

## 14. 考察（事実から読み取れること。確信度は章末の表）

1. **「聞く」より前に「読む」を置く流れが、新しい道具ほど強い**（Codex、BMAD、Smithy、superpowers の「申し出て調べる」）。クリエイターの REQ-017（ファイルを読んで「〜という決まりですか？」と確かめる）と同じ向き。ただし `roundup-setup` と `setup-my-iq` は、**貼ってもらった例の分析 → 分析結果を返して直してもらう**型で、これは REQ-017 にほぼそのまま当たる実物。
2. **質問の形の流行は変わりつつある**: superpowers は2025年の「選択式を好む」から2026年の「自由回答が先」へ、理由つきで変えた（作者の自己申告で、標本は小さい）。一方 Codex・Spec Kit・Claude は、選択肢＋推奨の型を維持している。**どちらが正しいかは出典の中では決着していない**。Codex の型は、質問が決定に当たるとき（好み・トレードオフ）に向き、superpowers・BMAD の型は、意図を引き出すとき（目的・場面）に向く、と使い分ける読み方ができる（これは考察で、出典の記述ではない）。
3. **失敗は両方向にある**: 聞かない方向（Spec Kit #1717「質問ゼロで『重大なあいまいさなし』」、grilling の「質問を数問で打ち切って構想に進む」、superpowers #2258「that scope is ok」を許可と扱う）と、聞きすぎる方向（superpowers の盲検で builder check が「2回・3〜9問」で不評、grilling の FAQ に「It asked me two hundred questions. What went wrong?」）。対策は、聞かない方向には**ゲートと「承認は見せた段階のみ」**、聞きすぎには**ranked な1回のまとめ、スコープを分ける**。
4. **質問の書き方の失敗**: Spec Kit #3745「ラベルや要求番号が質問になっている」は、CLAUDE.md の「番号やラベルだけで示さず、中身を言葉で示す」と同じ。対策は「完全な疑問文」「なぜ大事か1文」「質問1行だけで答えられるか」の自己点検。
5. **手順を守らせる工夫は、実際に飛ばされた例から足されている**（superpowers の HARD-GATE と赤信号、grilling の確認ゲート、Spec Kit の「defer の範囲を限定」）。軟らかい指針は規則の飛ばしに効かない（superpowers writing-skills）。一方、BMAD の canon は「台本は欠陥」と書く。**安価なモデルでは台本・ゲート・赤信号の表が必要になるという報告**（grilling の「lower-effort or non-frontier models ... collapse ... into a couple of questions and an outline」）があり、有能なモデルでは台本が足かせになる、という BMAD の主張と、どちらが当てはまるかは、**クリエイターのモデルの幅を前提に、外側の EVAL で確かめるしかない**。
6. **長い会話の状態**は、(a) 答えごとにファイルへ書く（Spec Kit、BMAD memlog）、(b) 決定ログと進捗表を読んで再開（d365、BMAD）、(c) 新しい会話に引き継ぐ（Anthropic の SPEC.md、grilling の handoff）の3つの型がある。Copilot CLI の自動圧縮が手順を保つかは、公式文書に記述が見つからなかった。
7. **サブエージェントに質問させる設計は、調べた範囲で見つからなかった**。どの道具も、ユーザーへの質問はメインが持ち、サブエージェントは調べ物・抽出・点検に使う。Claude Code ではサブエージェントが背景で動くため、待たせるには指示文の工夫が要った（superpowers）。
8. **どの質問が効いたかを記録して改善する仕組みは、実運用の物では見つからなかった**。近いのは、superpowers の（別 PR に移された）AI 利用者による試験と、BMAD の memlog の型（question・decision・gap など）、grilling の「It's working if」の観察基準。

---

## 15. 食い違い、見つからなかったこと、限界

食い違い:

- `ask_user` と autopilot: 公式（`--no-ask-user` だけが質問を抑える）と寄稿の学習ハブ（autopilot が `ask_user` を自動処理する）が食い違う（5.4）。実機で確かめる必要がある。
- Spec Kit: 公式ブログ（2025-09-02、二次扱い）は「エージェントが clarifying questions をする」とは書かないが、コマンドのテンプレートには詳しい手順がある。クイックスタート（WebFetch）も質問の形や数を書いていない。信頼できるのはテンプレート（一次）。
- Copilot CLI の plan モードの切り替え: ベストプラクティスは「Shift+Tab to toggle between normal mode and plan mode」、概要ページは「Shift+Tab to cycle in and out of plan mode」、コマンドリファレンスは「Cycle between standard, plan, and autopilot mode」と書く。
- 質問を1つずつか、まとめてか、上限を置くか: 道具により逆（13章）。

見つからなかったこと（どこを探したか）:

- Kiro の質問手順: `kiro.dev/docs/specs/` の4ページと2025-07-15 のブログ。
- GPT Builder の手順の公式の説明: help.openai.com と openai.com が HTTP 403（curl も）。検索結果の要約のみ。
- Copilot CLI の `ask_user` の引数の公式の仕様、plan モードの内部の指示文: docs.github.com の CLI 関連の4ページ。別担当のパッケージ調査の領分。
- 質問の効き目を実運用で測る物: 上記の全リポジトリを `grep`（interview、eval、effective など）。superpowers の評価の道具は別 PR に移されていて、clone には入っていない。
- superpowers や Spec Kit の clarify の「質問が多すぎる」という利用者の苦情: 検索（Web）と issue。見つかったのは Spec Kit #1717（質問が**少なすぎる**）のみ。

限界:

- WebFetch は小さなモデルによる要約を通す。Kiro、Codex の公式ドキュメント、PR #2463・#2258、Spec Kit の issue #1717、grill 拡張の README、ブログは**逐語ではなく要約**。数字（25/25、16〜27 → 0〜1 など）はこの経路のもので、原文では確かめていない。コミットメッセージ（clone の `git log`）の引用は逐語。
- 試験・評価はいずれも**作者の自己申告**で、標本は小さい（n=5〜10、盲検6人など）。
- 実際に動かして確かめたことはない（この調査は読むだけ）。
- awesome-copilot は寄稿の集まりで、公式の保証はない。

---

## 16. 設計で決めること 1〜11 への対応と確信度

「確信度」は、この調査の事実が設計の判断を支える強さ（出典の質、一致の度合い）。

| # | 設計で決めること | 効く情報（章） | 確信度 |
| --- | --- | --- | --- |
| 1 | 対話の段階と順番 | 先に読む→丸ごと聞く→少数の質問→読み返し→承認（Codex、BMAD、Smithy、superpowers、doc-coauthoring、roundup-setup、d365の5拍）。段階ごとに人の確認を置く（plugin-dev、Spec Kit）。質問を飛ばせる入口（superpowers、BMAD の Fast path）（1〜6、10章） | 中〜高 |
| 2 | 質問の形 | 選択式の限界（2〜4個、推奨を先頭に、自由入力の逃げ道）と、自由回答を先にする流派（2、4〜6、8、10章）。1問ずつ／まとめ／frontier の round の3流派と、利用者の好みが割れるという報告（10章）。質問の書き方（完全な疑問文、なぜ大事か1文）（1章）。`ask_user` の引数は公式では未確認（9章） | 中（流派が割れていて、決着した証拠はない） |
| 3 | あいまいさの見分け方・聞き直し・「分からない」 | 具体の場面を語らせる質問、推測を出して直させる、具体の不満・悪い例から引き出す、「Ask→probe the constraint→surface the option」、「まず例を貼ってもらう→分析→返す」、「分からない」には具体案か推奨を出す／未決として持ち主と期日を書く／質問票にして他人に渡す（2、5、10章）。回数の上限の規定は少ない（setup-my-iq の「1回押す、2回目は受け入れる」が数少ない例） | 中〜高 |
| 4 | 聞き漏らしと終える判断 | 領域の地図（Spec Kit の10領域、5問で打ち切り、残りは Deferred と明示）、frontier が空、決定が完全（Codex）、質問が理解を示す（doc-coauthoring）、ひな型の中心の欄が埋まる（setup-my-iq）、builder check と読み手の試験（superpowers、doc-coauthoring）、ユーザーの疲れの扱い（BMAD の「ease」、roundup の圧縮）（1、2、3、5、6、8、10章） | 中 |
| 5 | 引き出したナレッジの残し方 | 答えごとに書く Q→A の行（Spec Kit）、決定ログ6欄＋4分類（d365）、追記のみの memlog と addendum（BMAD）、貼ってもらった例を原文で残す（roundup）、用語集と ADR（Pocock）、EARS の「WHEN…SHALL」（Kiro）、「技術に依存せず測れる」成功基準（Spec Kit）。**合否の基準を EVAL の課題に変える**直接の物は見つからなかった。近いのは Smithy の「出力が客観的に検査できるかが、試験にどれだけ頼るかを決める」、skill-creator の試験の課題 | 中（記録の型は豊富、合否→EVAL は薄い） |
| 6 | 長い対話の状態の保ち方 | 答えごとの保存（Spec Kit）、追記のみの記録＋再開（BMAD）、決定ログと進捗表（d365）、新しい会話への引き継ぎ（Anthropic、handoff）、圧縮で残す内容を指示する（Claude の公式）。Copilot CLI の圧縮が手順を保つかは未確認（9章） | 中 |
| 7 | ファイルを読んで決まりを推し量る進め方 | 質問の前に最低1回は調べる、候補を示して1つを推奨（Codex）、「あなたのコードは X だが、いま Y と言った。どちらか」（Pocock）、事前入力は提案であって答えではない（setup-my-iq）、貼ってもらった例の分析→返して直してもらう（roundup）。**コードではなく仕事の資料を読んで決まりを推す**物は、roundup/setup-my-iq 以外に少ない | 中 |
| 8 | 仕事の分け方・モデル | ユーザーへの質問はメインが持つ。サブエージェントは調べる・抽出・点検（BMAD、grilling、superpowers、doc-coauthoring）。Claude Code の背景のサブエージェントは待たせにくい（superpowers）。「聞き取りは最良のモデルで」（Pocock、作者の文書） | 中 |
| 9 | 分かりやすい伝え方 | process jargon を使わない（superpowers）、質問1行で答えられる（Spec Kit）、専門語を出さない（roundup）、手がかりを見て選ぶ（skill-creator）、業務への影響で説明（d365）、推測は推測と印（superpowers）、「分からない」に説明を足して聞き直す物は、そのままの規定としては見つからなかった | 高（複数の一次の記述が一致） |
| 10 | どの質問が効いたかの記録（REQ-049） | 実運用の物では**見つからなかった**。近いのは superpowers の評価（隠れた意図の AI 利用者で「引き出せた隠れた事実」を数える）、BMAD の memlog の型、Pocock の「It's working if」 | 低 |
| 11 | 安価なモデル・様々なモデルでも手順が守られる書き方 | 飛ばされた実例からゲートを足す（superpowers v4.3.0）、赤信号の表と、反論を各行に戻す（8/10→5/10）、説明文に手順を書かない（Description Trap）、失敗の型で書き方を変える（Match the Form to the Failure）、「安価なモデルは質問を数問で打ち切る」（grilling の利用者報告）、「スキルが別のスキルを名指しても読み込まれない」（grilling）、サブエージェントや補助スクリプトより本文に書く、`Done when:` のような**確認できる完了条件**（Pocock、BMAD の canon）。有能なモデル向けには「台本は欠陥」（BMAD）という反対の主張もある | 中（報告は作者・利用者のもので、Copilot CLI の複数モデルでの実測は別途必要） |

総合の確信度: 事実（指示文の原文、版、日付）は**高**。設計への当てはめ（特に 2、4、10、11）は、評価の標本が小さく、作者の自己申告が中心なので、**中〜低**。外側の EVAL で確かめる前提で使うこと。

---

## 17. 長い原文の置き場所（`D-quotes/`）

すべて `/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/D-quotes/` の下。

| ファイル | 中身 |
| --- | --- |
| `speckit-clarify.md` | Spec Kit `/speckit.clarify` の全文（commit 505781d7） |
| `speckit-specify-checklist-excerpts.md` | `specify` の未確定事項の扱い、`checklist` の質問生成 |
| `speckit-clarify-history.txt` | clarify.md の変更履歴と主要コミットのメッセージ |
| `superpowers-brainstorming-v7.md` | v7.0.0 の brainstorming と builder check の全文 |
| `superpowers-brainstorming-v6.4.2.md`、`superpowers-brainstorming-v4.2-hardgate.md`、`superpowers-brainstorming-v3.4.0-old.md` | 旧版（変遷の比較用。v4.2-hardgate のファイル名は commit 7f2ee61 の版で、リリースは v4.3.0） |
| `superpowers-v7-brainstorming-commit-messages.txt` | v7 の作り直しのコミットメッセージ（測定の記述） |
| `anthropic-skill-creator-intent.md` | skill-creator の冒頭〜Interview and Research |
| `anthropic-doc-coauthoring.md` | doc-coauthoring の全文 |
| `claude-code-plugin-dev-create-plugin.md`、`claude-code-feature-dev-and-agent-creator.md` | plugin-dev の create-plugin、feature-dev、agent-creator の抜粋 |
| `claude-code-best-practices-interview.md` | Claude Code 公式ベストプラクティスの「インタビューさせる」ほか |
| `awesome-copilot-roundup-setup.md`、`awesome-copilot-setup-my-iq.md`、`awesome-copilot-d365-blueprint.md`、`awesome-copilot-azure-autopilot-ask_user.md` | awesome-copilot の聞き取りスキル |
| `bmad-toolsmith-discover-canon.md`、`bmad-prd.md`、`bmad-product-brief-brainstorming.md` | BMAD の Toolsmith（discover、canon、ship）、PRD、brief、brainstorming |
| `kiro-and-openai-docs-excerpts.md` | Kiro と OpenAI の公式ドキュメントの抜粋（要約経由。取得できなかったことの記録を含む） |
| `openai-codex-plan-mode.md`、`openai-codex-request_user_input_spec.rs.txt`、`openai-codex-init-prompt.md`、`openai-codex-skill-creator.md`、`openai-codex-skill-creator-excerpt.md` | Codex の plan モードのテンプレート、質問ツールの仕様、`/init`、skill-creator |
| `copilot-cli-docs-excerpts.md` | Copilot CLI の公式ドキュメントの抜粋（plan、`/init`、`ask_user`、autopilot） |
| `mattpocock-grilling.md`、`mattpocock-grill-me-doc.md`、`mattpocock-writing-for-agents.md` | grilling、grill-me の利用者向け文書、指示文の書き方 |

そのほかの置き場所:

- 取得したリポジトリ: `/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/repos/`（読むだけ。スクリプトは実行していない）。
- 取得した Web ページ（HTML とテキスト）: `/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/D-web/`。
- HTML をテキストにする小さなスクリプト（自作）: `/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/D-tools/h2txt.py`。
