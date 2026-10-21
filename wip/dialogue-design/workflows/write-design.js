export const meta = {
  name: 'hearing-design-doc',
  description: 'Write the hearing (knowledge elicitation) design doc and spec/design updates, review from 4 lenses, fix, verify',
  phases: [
    { title: 'Write', detail: 'one writer drafts docs/design/hearing.md and edits specs/designs', model: 'opus' },
    { title: 'Review', detail: '4 independent lenses: decisions, technical facts, readability, testability/trace', model: 'opus' },
    { title: 'Fix', detail: 'apply verified findings', model: 'opus' },
    { title: 'Verify', detail: 'check fixes and remaining issues', model: 'opus' },
  ],
}

const W = '/home/user/plugin-creater/wip/dialogue-design'

const CONTEXT = `
## 背景
- リポジトリ /home/user/plugin-creater（ブランチ claude/busy-allen-eqc4vt）。クリエイター（GitHub Copilot CLI 1.0.98 向けの Agent Plugin）が、ユーザーとの対話でナレッジを引き出し、生成プラグインを作る。
- 今回の仕事：ユーザーと対話してナレッジを引き出す部分（以下「ヒアリング」）の設計書を新しく作り、関係する仕様書と設計書を直す。仕様（何を聞くか）はあるが、設計（どう聞くか）がなかった。
- 調査、論点ごとのまとめ、点検、ユーザーとの質疑はすべて終わっている。材料：
  - ${W}/synthesis/decisions.md：決まったことの一覧。A（ユーザーに聞いた問いと推奨）、B（証拠と上位の文書で決まったこと）、D（点検で直した読み違い）、E〜G（ユーザーの答え、ユーザーの指摘）。**ユーザーの答えが最優先**。
  - ${W}/synthesis/synthesis.md：6つの論点（G1〜G6）ごとの根拠・選択肢・推奨・設計の下書きと、点検（指摘と、矛盾を直した対話全体の流れ）。
  - ${W}/research/：調査の報告（A-copilot-cli.md、A-appendix-1〜3、A-gap-report.md、A-verify2-report.md、B〜F）。Copilot CLI の事実は A 系（実測）が一次情報。
  - 上位の文書：docs/constitution/constitution.md（最優先）、docs/specs/*.md、docs/design/*.md、.claude/memory/*.md。

## ユーザーの決定（これと食い違う内容を書かない。これにない振る舞いを足さない）
1. 聞く順番：前回の実物（ファイル）を受け取り、読み、前回の1回を最初からたどってもらうのを先にする。仕様の10項目（REQ-015）は後半で聞き漏らしの点検に使い、分かった項目は「こう理解した。違うところ・足りないところは？」と確かめる形にする。この形も REQ-015 の「質問した」に数える（仕様に解釈を明記）。
2. 聞き出すヒアリング（仕事のやり方・決まり・例外・前回の1回・資産など）には、選択肢も答えの例も付けず、自由記述で聞く。答えの範囲が決まった「決める質問」（公開プラグインを使うか、画面の部品など）だけ、2〜4択＋おすすめ＋理由1文。決まりの確かめと生成前の最終承認には、おすすめも default も付けない。
3. ファイルから読み取った決まりの確かめ方：問いは「〜という決まりですか？」のまま、答えを4つから選ぶ：このとおり／そうしないときもある（どんなときか）／違う（本当はどうか）／決まりではなく、たまたま。おすすめも default も付けない。実測で、default のない選択肢では最初の選択肢にカーソルが合い Enter だけで選ばれる（A-verify2-report）ので、「このとおり」を最初に置かない。読み取った場所（ファイル名と箇所）を添える。
4. ファイルを読むのは新しい読み取り役のカスタムエージェント（model を書かず親セッションのモデルを継ぐ見込み。tools は読む・探す・Web と、下の文書変換ツールに絞る。スキルを呼ばせない）。返すのは決まりの候補・前回の1回の手がかり・資産の候補（出どころの引用つき）だけ。確かめるヒアリングはメインのエージェントが行う。
5. 答えが来ないとき（ask_user で Ctrl+D、Esc、autopilot）：推測で埋めず、その項目を「まだ答えていない」と記録し、何を聞きたかったかと続け方（チャットに答えを書く、autopilot を切る）を示して止まる。ask_user のない起動（-p、--no-ask-user）では、直し方を示して始めない。REQ-023 と README に書き足す。
6. 同じ点への聞き直しは2回まで。質問の意味が伝わらなかったときの言い直しは数えない。超えたら、ユーザーの言葉のまま保留にし、生成前の確認で見せる。
7. 再開：前の会話に戻ったとき（--continue／--resume）だけ続きから。記録は Copilot の設定フォルダの下（generated-plugin-structure.md 6.5 の生成プラグインの記録と同じ上の階層。クリエイターはセッションごとに分ける）。/clear や新しい会話では最初から。REQ-021 の「作業フォルダの外には何も作られない」が生成プラグインのファイルを指すことを明記する。
8. 疲れ・急ぎ：合図（「早く」「まだ？」、答えが短くなる）を見たら、残りの項目を示し、「このまま続ける」「残りを手早く聞く（1項目1問、聞き直しは1回まで）」「ここでやめて後で続ける（--continue の案内）」から選んでもらう。項目は飛ばさない。REQ-015 に振る舞いを足す。
9. コンパクション対策：エクステンションに状態取得ツールを足し、ツールの description に「コンパクションの後・再開の後・段階の始めにまず呼ぶ」と書く。加えて、エクステンションが session.compaction_complete を受けたら、聞き取りの最中なら次の onPreToolUse の additionalContext で1回だけ「skill ツールで make-plugin を読み直し、状態取得ツールを呼んでから続ける」と注入する（onPostToolUse は ask_user の後だと画面に出るので使わない。1KB 未満）。毎回の注入はしない。
10. 合否の基準：生成前の確認で、成果物を見て守られたか分かる決まり（決まった書き方、守らないと困ること）を「基準の案」として示し、外したいものを選んでもらう。残ったものと「合否の決め方」の答えを種類「合否の決め方」にする。REQ-038 に解釈を明記する。
11. EVAL の課題の入力ファイル：実物があれば写し、生成前の確認で「生成プラグインのリポジトリに入るファイル」として一覧で示す（差し替え可）。なければ前回の1回をもとに AI が仮のファイルを作り「仮」と示して確かめてもらう。
12. REQ-049 の観点1を「その項目をヒアリングしたのに出ず、後から出てきたもの」と「生成前の確認で足されたもの」に直す（受け入れ基準も合わせる）。
13. 外側の EVAL：高性能モデルではすべての採点の観点で合格を求める。安いモデル（Claude Haiku 5.5）でも回し、「全項目をヒアリングした」「承認の前に生成しなかった」の2点だけ合格を求める。
14. 最終確認に GPT のモデルでの実行は足さない（ユーザーの判断。推奨と違う）。
15. 未経験の作業（前回の1回もファイルもない）：「初めてやるとしたら、最初に何をしますか」と想定の1回をたどる。EVAL の入力は仮のファイル（11 と同じ）。REQ-016 と REQ-038 に例外を一文足す。
16. SKILL.md は日本語で書き、「ユーザーと同じ言語で応答する」と明示する。
17. Office の文書：クリエイターのエクステンションに docx・xlsx・pptx をテキストにするツールを足し、読み取り役が呼ぶ（サブエージェントからエクステンションのツールを呼べることは確認済み：generated-plugin-structure.md 11章 #8）。PDF は @ でモデルに直接渡せる場合はそれを使い、渡せないときはテキストにしてもらう。

証拠や上位の文書で決まったこと（decisions.md の B）と、点検で直した読み違い（D）も必ず反映する。主なもの：ヒアリングはメインのエージェントが ask_user で1回に1つ／質問は「なぜ聞くか1文＋それだけで答えられる完全な疑問文」、番号やラベルだけで聞かない、ユーザーの言葉はそのまま／調べて分かることは聞かない（目的・合否・守らないと困ること・いつもと違うとき・好みは推し量れても聞く）／あいまいさの合図7種と記録前の1文の点検と合図ごとの深掘りの型／「分からない」などは1つの表／項目の状態は 未着手・聞いた・決まりなし・保留 の4つ、「省く」は置かない／聞き終える条件（未着手ゼロ→「ほかにありますか」1回→生成前の確認。エクステンションは未着手が残れば確認を受け付けない）／状態のただ1つの元はクリエイターのエクステンションの記録（JSON）／問いと答えはフック（onPostToolUse で ask_user、onUserPromptSubmitted で打った発言）で自動記録、差し込みはしない／読むツールは1つ／記録のツールの返り値は画面に出るので平易な日本語の短い文／ナレッジの欄（番号、種類、項目、文、出どころ〔AI の判断を含む〕、ユーザーの言葉の抜き書き、例、例外、状態）／点検役のサブエージェントは置かない（EVAL で必要なら足す）／SKILL.md は本文500行・約5,000トークン以内＋段階ごとの references（各20KB 未満）、先頭に少数の決まりと「聞くか進めるか」の一点の優先宣言、強い禁止は生成前の関門1つ、短い赤信号の表／候補が4つを超える一覧は文章で示して自由入力で選んでもらう／Claude Code 向けの置き換えでは、選択肢が必須の質問ツールのとき聞き出すヒアリングは文章で1つ聞いて手番を終える／ユーザーに示すコマンドは /<クリエイターの名前>:make-plugin、skill ツールの名前は make-plugin／同じ手番の中の自動コンパクションでは SKILL.md の本文が1つも残らない（A-gap-report 5）。

## 書き方の決まり（ユーザーの強い指摘。守らないと差し戻し）
- 憲章 第9条：分かりやすさを何より重視し、簡潔に、伝わる用語で書く。
- 比喩で言い換えない（例：「道具」「手順書」「覚えられる量」は不可）。正確な技術用語（コンテキストウィンドウ、自動コンパクション、SKILL.md、ツール、フック、サブエージェント、ask_user など）を使う。読み手（開発者）は AI に詳しい。
- 1文に1つのこと。長い背景を書かない。番号やラベル（REQ-xxx、Q1、G3-2）だけで内容を示さず、中身を言葉で書く（番号は併記してよい）。
- クリエイターがユーザーにするものは「ヒアリング」と呼ぶ。
- 推測で書かない（CLAUDE.md 5章）。決まっていないことは「未決」「実機で確かめる」と書く。
- KISS（憲章 第10条）：必要なことだけ。同じことを2か所に書かない（ほかの設計書の節を参照する）。
- 指摘の経緯や「〜ではない」と打ち消すだけの文を書かない（憲章 第9条2項）。
- 根拠は、一次情報（公式ドキュメントの URL、論文、Copilot CLI 1.0.98 での実測）と、リポジトリのナレッジ（.claude/memory/）・上位の文書で示す。**wip/ の下のファイルは消す予定なので、設計書から wip/ のパスを参照しない**。実測の事実は「Copilot CLI 1.0.98 で実測（オフラインのモードで偽物のモデルにつないで確認、2026-10）」のように書く。
- 仕様書の書き方は docs/specs/README.md に従う（要件・根拠・受け入れ基準）。仕様は「ユーザーから見た振る舞い」を書き、内部の方式は設計書に書く（CLAUDE.md 8章）。
`

phase('Write')
const writerPrompt = `あなたは Agent Plugin のハーネスエンジニアで、このリポジトリの設計書の書き手である。
${CONTEXT}

## やること
1. 材料（decisions.md、synthesis.md、research の該当箇所）と上位の文書（憲章、docs/specs の creation-requirements.md・test-requirements.md・README.md、docs/design の creator-structure.md・generated-plugin-structure.md の 6.5・9章・11章・testing.md の 4・6・9・10章）を読む。
2. 新しい設計書 docs/design/hearing.md（題：ヒアリングの設計）を書く。最低限、次を含める（構成は読みやすさで決めてよい）：
   - 範囲（クリエイターのスキル make-plugin がユーザーにするヒアリング。作り直しを含む。生成と試験の後は既存の設計を参照）と、ほかの設計書との分担
   - 依って立つ Copilot CLI 1.0.98 の事実（実測）：ask_user（フォーム版、自由入力、default、Ctrl+D と autopilot の結果文、-p と --no-ask-user で無い、サブエージェントは持たない）、SKILL.md の載り方と自動コンパクションで残るもの・消えるもの（同じ手番の例外を含む）、--continue／--resume と /clear、@ファイルと view の制限、貼り付け、フックの差し込み口と画面表示
   - ヒアリングの流れ（新しく作るとき、作り直しのとき、未経験の作業のとき）。段階ごとに、目的、すること、終わる条件
   - 質問の形と書き方
   - 深掘り（あいまいさの合図、型、回数の上限）、「分からない」などの扱い、答えが来ないとき、疲れ・急ぎ、聞き終える条件
   - 確かめ方（ファイルから読み取った決まり、段階の区切りの言い直し、生成前の確認、合否の基準の案、課題の入力ファイル）
   - 記録（状態のただ1つの元、項目の状態、ナレッジの欄、問答の自動記録、置き場所、記録のツールと状態取得ツールの返り値）
   - コンパクションと再開への備え
   - 仕事の分け方とモデル（メイン、読み取り役、作業エージェント、文書変換ツール）
   - SKILL.md の組み立て（本文と references、先頭の決まり、赤信号の表、言語）
   - 質問の改善案（REQ-049）の判定
   - 試験（2段目、外側の EVAL への追加、Claude Code 向けの置き換え、最終確認）
   - 要件のたどり方（関係する要件の番号 → この設計書の節）
   - 実機で確かめること（残っている未確認の事実の一覧）
   - 出典
3. 仕様書を直す（ユーザーの決定にあるものだけ）：creation-requirements.md の REQ-015（疲れ・急ぎの振る舞い、「質問した」の解釈）、REQ-016（未経験の作業の例外）、REQ-021（「何も作られない」の対象の明記）、REQ-023（答えが来ないとき・ask_user がない起動・README）、REQ-049（観点1と受け入れ基準）。test-requirements.md の REQ-038（合否の基準の解釈、入力ファイルがないときの仮のファイル、未経験の作業）。要件の文・根拠・受け入れ基準をそろえて直す。
4. 既存の設計書を直す（重複させず、hearing.md を参照する形に）：creator-structure.md（冒頭の案内、2章の部品の表の make-plugin の行と読み取り役・文書変換ツールの追加、3.1 の分担の表、4.3 の読み込みの確認の文（フックの登録が加わる）、4.5 の改善案の判定）、generated-plugin-structure.md 9章（クリエイターのエクステンションの記録のツールの表：状態取得ツール、項目の状態、ナレッジの記録、生成前の確認、文書変換ツール、フックによる問答の記録とコンパクション後の1回の注入。「まだ聞いていない項目を知らせる」はエクステンションの計算に置き換え）、testing.md（4章の置き換え、6章の追加〔ユーザー役の話し方：分からないと答えがち・特にないと答えがち・急いでいる、安いモデルでの2点の合格、記録から機械的に見ること、測れないこと〕、9章の最終確認の項目〔コンパクション後に戻れるか、/<名前>:make-plugin で始まるか、断ると止まるか〕）。docs/design/generated-plugin-structure.md の 11章にクリエイターの未確認の項目を足すか、hearing.md の「実機で確かめること」に置くかは、重複しないように決める。
5. git の commit はしない（ファイルを書くだけ）。最後に、作った・直したファイルと、各ファイルで何を変えたかの一覧、判断に迷った点を返す。`

const writeResult = await agent(writerPrompt, { label: 'writer', phase: 'Write', model: 'opus' })
log('draft written')

phase('Review')
const FIND_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          file: { type: 'string' },
          location: { type: 'string', description: '節の名前や引用した文' },
          problem: { type: 'string' },
          evidence: { type: 'string', description: '確かめた根拠（ユーザーの決定の番号、報告の箇所、上位の文書の箇所）' },
          fix: { type: 'string', description: '具体的な直し方（書き換えの文があれば書く）' },
        },
        required: ['severity', 'file', 'location', 'problem', 'evidence', 'fix'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['findings', 'summary'],
}

const LENSES = [
  { key: 'decisions', text: `観点：ユーザーの決定（1〜17）と、証拠で決まったこと（decisions.md の B と D）が、漏れなく正しく反映されているか。決定と違うこと、決定にない振る舞いや推測を足していないか（CLAUDE.md 5章）。仕様の直しが決定の範囲に収まっているか。憲章と食い違わないか。決定どうしをつないだときの矛盾（例：答えが来ないときの扱いが1か所だけで決まっているか、項目の状態の名前が全ファイルでそろっているか）。` },
  { key: 'facts', text: `観点：Copilot CLI 1.0.98 の事実と研究の数字が、一次情報（${W}/research/ の A 系の実測、B〜F の報告が引く出典）どおりに書かれているか。読み違い、言い過ぎ、出典のない主張、確かめていないことを事実のように書いていないか。特に：同じ手番の自動コンパクションで SKILL.md が残らない条件、フックの差し込み口と画面表示、ask_user の Ctrl+D と autopilot の結果文、default のない選択肢のカーソル、@ファイルと view の制限、Office の文書の送られ方、プラグインのスキルの名前の形（/<プラグイン名>:make-plugin）、「LLM のユーザー役は『いいえ』に偏る」は英語の結果であること。設計書が wip/ のパスを参照していないか。` },
  { key: 'readability', text: `観点：憲章 第9条とユーザーの指摘（比喩を使わない、正確な技術用語、1文1意、簡潔、番号やラベルだけで示さない、クリエイターがユーザーにするものは「ヒアリング」）。比喩（道具、手順書、覚えられる量、など）、説明のない内部の言葉、長すぎる文、同じことの繰り返し（ファイル間を含む）、指摘の経緯や打ち消すだけの文を探す。直すときは、意味を変えずに書き換えの文を示す。KISS の観点で、要らない節や作り込みも指摘する。` },
  { key: 'testability', text: `観点：試験で確かめられるか、要件までたどれるか。仕様の受け入れ基準が、外側の EVAL・2段目・最終確認のどれで確かめられるかが設計書から分かるか（docs/design/testing.md と合っているか）。Claude Code 向けの置き換え（AskUserQuestion は1回1〜4問・各2〜4択、エクステンションは外れ試験の仕組みが MCP で同じツールを出す）で、ヒアリングの各段階と記録が動くか。要件のたどり方の表に漏れや誤りがないか（関係する REQ-015〜REQ-024、REQ-026、REQ-027、REQ-032〜REQ-038、REQ-043〜REQ-047、REQ-049）。` },
]

const reviews = await parallel(LENSES.map(l => () => agent(`あなたは厳しい査読者である。書き手の文書が正しいと思い込まず、誤りと抜けを探す。
${CONTEXT}

## 対象
書き手が今回作った・直したファイル（git diff と新しいファイル docs/design/hearing.md。\`git -C /home/user/plugin-creater status\` と \`git -C /home/user/plugin-creater diff\` で確かめる）。書き手の報告：
${writeResult}

## ${l.text}

指摘は、実際にファイルを開いて確かめたものだけにする。根拠の箇所を必ず示す。ファイルは変更しない。`, { label: `review:${l.key}`, phase: 'Review', schema: FIND_SCHEMA, model: 'opus' })))

const allFindings = reviews.filter(Boolean).flatMap((r, i) => r.findings.map(f => ({ ...f, lens: LENSES[i].key })))
log(`review findings: ${allFindings.length}`)

phase('Fix')
const fixResult = await agent(`あなたは設計書の書き手である。査読者の指摘をもとに、ファイルを直す。
${CONTEXT}

## 査読の指摘（4つの観点。重複や食い違いがある）
${JSON.stringify(allFindings, null, 2)}

## やること
- 指摘ごとに、実際にファイルと根拠を確かめ、正しい指摘なら直す。正しくない指摘（ユーザーの決定と食い違う、根拠が誤っている）は直さず、理由を書く。指摘どうしが食い違うときは、ユーザーの決定 → 憲章 → 仕様 → 証拠の順で決める。
- 直すときも書き方の決まりを守る。新しい作り込みを足さない。
- git の commit はしない。
- 最後に、指摘ごとの扱い（直した／直さない＋理由）の一覧を返す。`, { label: 'fixer', phase: 'Fix', model: 'opus' })

phase('Verify')
const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    remaining: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          file: { type: 'string' },
          location: { type: 'string' },
          problem: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'file', 'location', 'problem', 'fix'],
      },
    },
    verdict: { type: 'string', description: '設計書として、ユーザーに見せられる状態か。理由つき' },
  },
  required: ['remaining', 'verdict'],
}
const verify = await agent(`あなたは最後の確かめ役である。直した後のファイルを読み、残っている問題だけを挙げる。
${CONTEXT}

## 査読の指摘と、直した結果
指摘：${JSON.stringify(allFindings.map(f => ({ severity: f.severity, file: f.file, location: f.location, problem: f.problem })), null, 2)}
直した結果：${fixResult}

## 確かめること
1. 「直した」とされた指摘が、本当に直っているか（ファイルを開いて確かめる）。
2. 「直さない」とされた指摘の理由が妥当か。
3. ユーザーの決定 1〜17 が、すべて設計書か仕様に入っているか（1つずつ確かめる）。
4. 比喩、wip/ のパスの参照、番号だけの説明が残っていないか。
ファイルは変更しない。`, { label: 'verify', phase: 'Verify', schema: VERIFY_SCHEMA, model: 'opus' })

return { writeResult, findings: allFindings, fixResult, verify }
