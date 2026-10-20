# B. 人から「本人には当たり前の、暗黙のナレッジ」を引き出す、人間の側の確立した手法

- 作成日：2026-10-20（本文中の URL のアクセス日はすべて 2026-10-20）
- 担当：知識工学・要求工学の調査（B）。`00-context.md` の「調査の決まり」に従う。
- 条件：クリエイターは、1人のユーザー（その仕事の実務者）と、チャットの文字だけで、数十往復で聞き取りをする。観察・対面のワークショップはできない。

## 0. この報告の読み方

| 記号 | 意味 |
| --- | --- |
| 【一次】 | 論文・標準・公式文書・報告書の本文を、自分で開いて読んだ |
| 【二次】 | ブログ、紹介記事、検索結果の要約、他の論文が引いている内容 |
| 【抄録のみ】 | 本文は読めず、抄録・書誌だけ確かめた |
| 【未読】 | 本文を読めていない（存在と書誌だけ確かめた） |
| 〔考察〕 | 私の考え。事実とは分けて書く |

- 「使えるか」の項は、**判定（根拠）＝事実**と、**変え方＝〔考察〕**に分けて書く。
- 古い情報：2024 年以前の資料が大半である（年を付ける）。人の記憶や回答の仕方についての知見は今も広く引かれているが、**いずれも「聞き手が人」のときの結果**である。聞き手が AI の研究は、本調査では Xiao ほか（2020）の1件しか読めなかった（AI が聞き手の研究は担当外）。
- 読めなかったもの・探した場所は §12 にまとめた。

## 要点（先に結論）

1. **SWEBOK V4 の引き出しの手法の一覧は、V3 と同じではない。** V3（2014）は「インタビュー、シナリオ、試作品、進行役のいる打ち合わせ、観察、ユーザーストーリー、その他」。V4（v4.0 は 2024、v4.0a は 2026年8月）は、関係者から引き出す手法8項目（インタビュー、会議、JAD などの進行役のいる打ち合わせ、**protocol analysis**、フォーカスグループ、質問紙、探索的試作、user story mapping）と、関係者以外の出どころ・手法（**観察、apprenticing（仕事を実際にやって覚える）、使い方の場面の記述、task analysis**、デザイン思考など）に分かれる。ナレッジの「5つ」は、V3 の「ユーザーストーリー」「その他」が抜けている（§1）。
2. **SWEBOK V4 にも V3 にも、インタビューの進め方の勧めはない。** あるのは「関係者は仕事を説明しにくく、大事なことを言わないことがある。引き出しは受け身の作業ではない。要求の多くは暗黙である」という注意だけ。進め方は他の資料に当たる必要がある（§1）。
3. **ACTA（Militello & Hutton）** は、(1)タスク図（3〜6段階に分けて、判断が要る段階に丸を付ける）、(2)ナレッジ監査（6つの基本の探りと2つの任意の探り。各回答に「どんな手がかりと方法を使うか」「経験の浅い人はなぜ難しいか」を続ける）、(3)模擬の場面の聞き取り、(4)認知要求の表、の4つ。**探りの質問の原文は §2 に全部ある**（NPRDC TN-98-4 の付録の聞き取りの手引きから）。3つの聞き取りを1人にすると**約3時間**かかる（§2）。
4. **CDM** は、**実際にあった非定型の1件**を、4回なぞる（話す→時系列を作る→深掘りの探り→「もし〜なら」）。理由は「なぜその行動をとったか」を直接聞くより、「何をしたか」を聞くほうが信頼できるから（Ericsson & Simon の引用）。時系列の**空白と重なりが、聞き漏らしと記憶違いの手がかり**になる（§3）。
5. **laddering**（なぜ？を重ねる）は、上に3〜5段、あいまいな言葉を「どうやって見分けるか？」で下に1〜5段たどると、「散らかっている」が「画面に6個以上ある」のような**測れる基準**に落ちる（Sherlock & Rugg 2003）。ただし「なぜあなたはそうしたか」の説明は、あとから作った理屈になりやすい（van Someren ほか 1994、Nisbett & Wilson 1977）（§4）。
6. **「〜ですか？」という はい/いいえ の確認は危ない。** 同意しやすさ（acquiescence）は平均で約10%（Krosnick 1999）。患者への確認の公式手引き（AHRQ）も「理解しましたか？」は復唱の質問ではないとする。**自分の言葉で言い直してもらう／選択肢を並べる**のが勧め（§4、§5）。
7. **要求の引き出しのインタビューの失敗**（Bano ほか 2019、学生28組の初回）：34の失敗、7つの分類。最も多いのは「あいまいな質問」（28組中21）。聞いたあとの**要約をしなかった組が19/28**。あいまいさは、見つければ**暗黙のナレッジを開く鍵**になる一方、聞き手の側で気づけないことが多い（Ferrari ほか 2016、2017：聞き手が見つけたあいまいさが、聞き直しで見つけたものと一致したのは26%、聞き直しだけが見つけたのが46%）（§6）。
8. **飽和**の数字（Guest ほか 2006：6件で70%、12件で92%、Guest ほか 2020：基準6件・連続2〜3件・新情報5%以下）は、**複数の参加者**を前提にしている。**1人への聞き取りでの「聞き終え」は、研究がない**。使える物差しは、チェックリストとの照合、「他にありますか」への追加が止まること、新しい話が範囲外・優先度が低い話に偏ること（Wiegers 2013）（§7）。
9. **長さと疲れ。** 文字のチャットは、対面の**約2倍の時間**がかかり、集中が落ちる。解決は複数回に分けること（Opdenakker 2006）。同意しやすさは疲れたあとと難しい質問で増える（Krosnick 1999）。ACTA 全部は約3時間。数十往復では**全部は入らない**（§7）。
10. **ナレッジの書き方**：ACTA の「手がかりと方法」「なぜ難しいか」「ありがちな誤り」の表、事例と例外で足していくルール（Ripple Down Rules：専門家は「どう決めたか」の説明でなく、その場の事例での**正当化**を述べる）、決定表（DMN 1.5：「漏れなく、重ならず」を確かめる）、例による確認（Example Mapping：ルール・例・答えが出ない質問）（§8）。
11. **「公式のルール」と「実際にやっていること」は違う。** どの専門家も、文書にない知識と、決まりから外れたやり方を持つ（Hoffman 2005）。設計者の自己申告は「表向き」になる（Sherlock & Rugg 2003）。実際の1件と、示されたファイルとの照合が効く（§8）。
12. **チャットの文字だけ**の研究：Dimond ほか（2012）は、語数は電話の約1/4でも、出てくる論点の数（コード）は電話とチャットで差がなかった。Xiao ほか（2020、約600人）は、探りを入れるチャットは、通常の質問紙より、情報量が39%多く、具体的で明確な回答を得た（§9）。

---

## 1. SWEBOK の「要求の引き出し」：V4 と V3 の比較（担当1）

### 1.1 読んだ本文

| 版 | 出典（書誌と URL） | 区分 |
| --- | --- | --- |
| V4.0a（2026年8月公開） | IEEE Computer Society, *Guide to the Software Engineering Body of Knowledge (SWEBOK Guide) v4.0a*, Released August 2026. 第1章 Software Requirements 2 節（1-6〜1-8 ページ）。公式の置き場：https://ieeecs-media.computer.org/media/education/swebok/swebok-v4.pdf | 【一次】 |
| V4.0（2024） | 同上 v4.0（編者 Hironori Washizaki）。内容の同じ節を、大学の授業の置き場の写しで読んだ：https://mycourses.aalto.fi/pluginfile.php/2367766/mod_resource/content/3/swebok-v4.pdf （公式ではない置き場） | 【一次】 |
| V3.0（2014・古い） | Bourque & Fairley (eds.), *SWEBOK Guide V3.0*, IEEE CS, 2014. 第1章 3.2 節（1-6〜1-7 ページ）：https://ieeecs-media.computer.org/media/education/swebok/swebok-v3.pdf | 【一次】 |
| 公式の目次 | https://www.computer.org/education/bodies-of-knowledge/software-engineering/topics（ナレッジ knowledge-elicitation.md が引いているページ。今回は目次としてのみ確認） | 【一次】 |

V4.0 と V4.0a の「2.2 よく使われる要求の引き出しの手法」の一覧は、同じ内容だった（2つを突き合わせた）。V4 の置き場の違い：公式の `ieeecs-media` は v4.0a、授業の置き場の写しは v4.0。

### 1.2 V4（2.2 節）の一覧（原文）

> "A wide variety of techniques can be used to elicit requirements from stakeholders. Some techniques work better with certain stakeholder classes than others. Common stakeholder elicitation techniques include the following:
> • interviews; • meetings, possibly including brainstorming; • joint application development (JAD) [13], joint requirements planning (JRP) [14] and other facilitated workshops; • protocol analysis; • focus groups; • questionnaires and market surveys; • exploratory prototyping, including low-fidelity and high-fidelity user interface prototyping [1*, c15]; • user story mapping."

> "Requirements can also be elicited from sources other than stakeholders. Such sources and techniques include the following: • previous versions of the system; • defect tracking database for previous versions of the system; • systems that interface with the system under development; • competitive benchmarking; • literature search; • quality function deployment (QFD)'s House of Quality [15]; • observation, where the software engineer studies the work and the environment where the work is being done; • apprenticing, where the software engineer learns by doing the work; • usage scenario descriptions; • decomposition (e.g., capabilities into epics into features into stories); • task analysis [16]; • design thinking (empathize, define, ideate, prototype, test) [17]; • ISO/IEC 25010 …; • security requirements …; • applicable standards and regulations."

### 1.3 V3（3.2 節・2014）の一覧（原文の要点）

V3 は次の7項目を挙げる：Interviews／Scenarios／Prototypes／Facilitated meetings／Observation／User stories／Other techniques。

- Interviews：「"Interviewing stakeholders is a 'traditional' means of eliciting requirements. It is important to understand the advantages and limitations of interviews and how they should be conducted."」
- Scenarios：「"They allow the software engineer to provide a framework for questions about user tasks by permitting 'what if' and 'how is this done' questions to be asked."」
- Prototypes：「"Low fidelity prototypes are often preferred to avoid stakeholder 'anchoring' on minor, incidental characteristics of a higher quality prototype …"」
- Observation：「"These techniques are relatively expensive but also instructive because they illustrate that many user tasks and business processes are too subtle and complex for their actors to describe easily."」

### 1.4 V3 と V4 の差（事実）

| V3（2014） | V4（2024／2026） | 備考 |
| --- | --- | --- |
| Interviews | interviews | 同じ |
| Scenarios | usage scenario descriptions（関係者以外の出どころの側の項） | 位置が変わった |
| Prototypes | exploratory prototyping（関係者から引き出す側） | 「探索的」と明記された |
| Facilitated meetings | meetings（ブレインストーミング含む）、JAD・JRP などの facilitated workshops | 細かくなった |
| Observation | observation（関係者以外の出どころの側の項） | 位置が変わった |
| User stories | user story mapping、decomposition（capabilities→epics→features→stories） | 形が変わった |
| Other techniques | （競合調査、欠陥の記録、QFD など個別に列挙） | 個別に列挙 |
| （なし） | **protocol analysis、focus groups、questionnaires and market surveys、apprenticing、task analysis、design thinking** | V4 で加わった |

ナレッジ `knowledge-elicitation.md` の「V3 では5つ」は、V3 本文の7項目のうち「User stories」「Other techniques」を数えていない。**「V4 の一覧が同じか」の答えは「同じではない」**。

### 1.5 インタビューの進め方の勧めはあるか（事実）

- V4 本文の引き出しの節に、**インタビューの進め方の手順や質問の型はない**。あるのは次の注意と出どころの案内だけ。

> "Elicitation can be difficult, and the software engineer needs to know that (for example) users might have difficulty describing their tasks, leave important information unstated or be unwilling or unable to cooperate. Elicitation is not a passive activity. Even if cooperative and articulate stakeholders are available, the software engineer must work hard to elicit the right information. Many product requirements are tacit or can be found only in information that has yet to be collected."

- この節の参照先は、Wiegers & Beatty, *Software Requirements*, 3rd ed.（Microsoft Press, 2013）の第7章 と、Sommerville, *Software Engineering*, 10th ed.（2018）の 4.3 節（どちらも本文は未読）。Wiegers & Beatty 第7章の目次（Cisco Press の見本ページ：https://www.ciscopress.com/content/images/9780735679665/samplepages/9780735679665.pdf 【一次・目次のみ】）には、Interviews、Workshops、Focus groups、Observations、Questionnaires、System interface analysis、User interface analysis、Document analysis、Planning elicitation、Preparing for elicitation、Performing elicitation activities、Following up after elicitation、**How do you know when you're done?**、Assumed and implied requirements、**Finding missing requirements** がある。
- V4 の追加読み物に、**電子的な連絡（チャットを含む）を使った聞き取りで暗黙のナレッジが引き出せたとする博士論文**が挙がっている：N. Ahmad, *Effects of Electronic Communication on the Elicitation of Tacit Knowledge in Interview Techniques for Small Software Developments*, doctoral thesis, University of Huddersfield, 2021。V4 の紹介文：「"This doctoral thesis shows how using four different types of electronic communication tools to discuss interview agenda details with interviewees before conducting semi-structured interviews for requirements elicitation improved elicitation of tacit (hidden) knowledge."」本文は §9 に書いた。
- V4 の 3.1（要求の分析）には「なぜを重ねる」の記述がある。

> "The 5-whys technique (e.g., [3*, c4]) involves repeatedly asking, 'Why is this the requirement?' to converge on the true problem. Repetition stops when the answer is, 'If that isn't done, then the stakeholder's problem has not been solved.' Often, the true problem is reached in two or three cycles, but the technique is called 5-whys to incentivize engineers to push it as far as possible."

- V4 3.1 は、要求のあるべき性質も挙げる：「"be testable (quantified), meaning that compliance or noncompliance can be clearly demonstrated"」「"complete — The requirements adequately address boundary conditions, exception conditions and security needs"」「"use stakeholder vocabulary"」。これは §8（合否の基準への変換）に効く。

### 1.6 使えるか

- 判定：SWEBOK V4 は、**手法の一覧と「暗黙・言い残し・受け身でない」という注意**は与えるが、**聞き方の手順は与えない**。ナレッジ `knowledge-elicitation.md` の「インタビューの難しさ」の3点（当たり前は話されない／専門用語／ハーネスで引き出したいのはまさにそれ）は、V4 の注意と矛盾しない。
- 〔考察〕V4 の一覧のうち、チャットだけの1人の聞き取りで直接使えるのは、interviews、exploratory prototyping（見本を見せて反応を聞く）、usage scenario descriptions、task analysis（§2 の ACTA が実務者向けの形）、protocol analysis（§4.3：実際の作業の記録を後から語ってもらう）。observation と apprenticing は、チャットでは直接できない。代わりに、**実際の成果物・ファイル（REQ-017）を手がかりに「その1回」を語ってもらう**形が近い。

---

## 2. 認知タスク分析（CTA）と ACTA（Militello & Hutton）（担当2）

### 2.1 出典

| 資料 | 書誌・URL | 区分 |
| --- | --- | --- |
| ACTA の報告書（古い：1997。実務者向け版の元） | Militello, L. G., Hutton, R. J. B., Pliske, R. M., Knight, B. J., Klein, G., & Randel, J. (1997). *Applied Cognitive Task Analysis (ACTA) Methodology*. Navy Personnel Research and Development Center, NPRDC-TN-98-4, November 1997. DTIC ADA335225。DTIC は「The request is blocked.」で開けなかったため、archive.org の写し（本文テキスト）で読んだ：https://archive.org/details/DTIC_ADA335225 、https://archive.org/download/DTIC_ADA335225/DTIC_ADA335225_djvu.txt | 【一次】（OCR の本文。引用は OCR で拾ったまま、記号のみ補正） |
| ACTA の論文（古い：1998） | Militello, L. G., & Hutton, R. J. B. (1998). Applied cognitive task analysis (ACTA): a practitioner's toolkit for understanding cognitive task demands. *Ergonomics*, 41(11), 1618–1641. DOI 10.1080/001401398186108。UWE の置き場は Cloudflare で 403、ResearchGate は 403。**本文は読めていない** | 【未読】 |
| ACTA の再現1（2021） | Stanik, Puhlfürß, Mahler, Sasu, Reip, Maalej. *Lessons Learned from Customizing and Applying ACTA to Design a Novel Device for Emergency Medical Care.* arXiv:2108.05622v2 (4 Aug 2022). https://arxiv.org/pdf/2108.05622 | 【一次】 |
| ACTA の再現2（2023） | Berlin, C., & Praetorius, G. (2023). Applied Cognitive Task Analysis (ACTA) of Marine Piloting in a Swedish Context. *Human Factors in Transportation* (AHFE), 95: 709–718. DOI 10.54941/ahfe1003856。https://research.chalmers.se/publication/551049/file/551049_Fulltext.pdf | 【一次】 |
| 紹介（2009） | Gore, J., & McAndrew, C. (2009). Methods: Accessing expert cognition. *The Psychologist* (BPS), 16 March 2009. https://www.bps.org.uk/psychologist/methods-accessing-expert-cognition | 【二次】（ACTA の探りの1つを原文で引く） |
| 一覧メモ（2020） | Klein, G. (2020). *Naturalistic Decision Making Tools* (memo, 14 October 2020). https://www.gary-klein.com/_files/ugd/2360d8_e98ff384865a4f7b856ed49e4a82e6d7.pdf | 【一次】（本人による一覧） |
| 研究者による再評価（2018） | Leu & Abbass. *A Multi-Disciplinary Review of Knowledge Acquisition Methods.* arXiv:1802.09669. https://arxiv.org/pdf/1802.09669 | 【二次】（ナレッジ監査を「1980年代に提案」と書く誤りがあるため、年代は使わない） |
| 二次の紹介（探りを挙げる） | Commoncog「An easier method for extracting tacit knowledge」https://commoncog.com/an-easier-method-for-extracting-tacit-knowledge/ | 【二次】（探りの文言は、下の報告書の原文と一致した） |

### 2.2 ACTA の全体（報告書の原文の要点）

ACTA は4つの道具からなる。

- **タスク図（Task Diagram）**：「"elicits a broad overview of the task and identifies the difficult cognitive elements"」。専門家に、仕事を**3〜6段階**に分けてもらい、どの段階が判断を要するか丸を付けてもらう。「"The interviewer limits the SME to between three and six steps, to ensure that time is not wasted delving into minute detail during the surface-level interview."」
- **ナレッジ監査（Knowledge Audit）**：「"identifies ways expertise is used in a domain and provides examples based on actual experience"」。探りの質問の1つに答えてもらい、そのたびに、**手がかりと方法**、**経験の浅い人にはなぜ難しいか**を聞く。
- **模擬の場面の聞き取り（Simulation Interview）**：難しい場面を示し、判断点ごとに、行動・状況の見立て・決め手の情報・ありがちな誤りを聞く。
- **認知要求の表（Cognitive Demands Table）**：複数の専門家のデータを、「difficult cognitive elements, why difficult, common errors, and cues and strategies used」の見出しで整理する。「見出しは、新しい講座や設計に必要な情報の種類に合わせて変えてよい」。

ナレッジ監査が目指すことの原文：

> "The goal is not simply to find out whether each component is present in the task, but to find out the nature of these skills, specific events where they were required, strategies that have been used, and so forth."
> "It is not expected that all probes will be equally relevant in each domain. After a few interviews, interviewers can easily determine which probes have the highest payoff."

タスク図について、範囲を絞る理由：

> "Efforts to delineate a mental model can quickly degenerate into a search for everything in a person's head as Rouse and Morris (1986) have pointed out."

### 2.3 タスク図の質問の原文（報告書の付録 D の聞き取りの手引き）

- "Think about what you do when you (Task of Interest). Can you break this task down into between three and six steps?"
- "Of the steps you have just identified which require difficult cognitive skills? By cognitive skills I mean judgments, assessments, problem solving— thinking skills."
- 手引きの注意（原文）：「"Your interviewee may immediately start talking at a very fine level of detail. Make it clear early on that you are looking for a very broad overview with this interview."」「"If your interviewee begins listing things to consider rather than the steps of the task, help reframe the topic for him/her. 'What do you do when you (Task of Interest)?'"」「"This may be a new way for the interviewee to think about the job. Give him/her time to think. You may need to repeat or rephrase the question."」

### 2.4 ナレッジ監査の探りの質問の原文（報告書の付録 D：基本の6つ＋任意の2つ）

各探りの前に、聞き手が読むか言い換える短い説明が付く（説明の内容は、下の括弧）。

| 探り | 説明（要点） | 質問の原文 |
| --- | --- | --- |
| Past & Future | 専門家は、状況がどう生まれ、どこへ向かうかを読める | "Is there a time when you walked into the middle of a situation and knew exactly how things got there and where they were headed?" |
| Big Picture | 初心者は断片しか見えない。専門家は全体像をつくる | "Can you give me an example of what is important about the Big Picture for this task? What are the major elements you have to know and keep track of?" |
| Noticing | 他の人が見落とす手がかり・パターンに気づく | "Have you had experiences where part of a situation just "popped" out at you; where you noticed things going on that others didn't catch? What is an example?" |
| Job Smarts | 手順を組み合わせて効率よく進める。手抜きはしないが、無駄もしない | "When you do this task, are there ways of working smart or accomplishing more with less—that you have found especially useful?" |
| Opportunities/Improvising | その場で何が効くかを見て、機会に向きを変える | "Can you think of an example when you have improvised in this task or noticed an opportunity to do something better?" |
| Self Monitoring | 自分のやり方を点検し、必要なら変える | "Can you think of a time when you realized that you would need to change the way you were performing in order to get the job done?" |
| （任意）Anomalies | 初心者は普通が分からず、異常に気づけない。「起きるはずのことが起きない」にも気づく | "Can you describe an instance when you spotted a deviation from the norm, or knew something was amiss?" |
| （任意）Equipment Difficulties | 道具は間違えることがある。初心者は道具を信じる | "Have there been times when the equipment pointed in one direction, but your own judgment told you to do something else? Or when you had to rely on experience to avoid being led astray by the equipment?" |

各探りの答え（例）のあとに続ける2つの質問（付録 D の原文）：

- "In this situation, how would you know this? What cues and strategies are you relying on?"（→「手がかりと方法」の列）
- "In what way would this be difficult for a less-experienced person? What makes it hard to do?"（→「なぜ難しいか」の列）

手引きの注意（原文）：

- "Examples allow you to get at specifics and help you understand the task better. Ask for an example for each element of expertise."
- "Some of the questions may take a few minutes for the SME to answer thoughtfully; don't rush; give the SME time to think over what you are asking about."
- "Confusion about what to write and in which columns may be a signal that your SME has misunderstood your question; the information you are getting is not what you expect. You may want to take a timeout, restate the question, and check that your SME understands what you are trying to get at."
- 「"It is important that you cover the six basic Knowledge Audit probes; you may also want to use some or all of the optional probes."」

表の例（報告書 図2：消防の捜索）：探り「Past and Future」の例「explosion in office strip: search the office areas rather than source of explosion」、手がかりと方法「Material safety data sheets (MSDS) tell you…」、なぜ難しいか「Novice would be trained to start at source and work out.」

Hoffman（2005）は、探りを**自分の分野に合わせて書き換える**例を示す：「"Your work involves a need to analyze cases in great detail. But we know that experts are also able to maintain a sense of the 'big picture.' Can you give me an example of what is important about the big picture for (your, this) task? …"」（§3.3 の Hoffman 2005 の資料。【一次】）。

### 2.5 模擬の場面の聞き取りの質問の原文（付録 D）

- "Think back over the scenario. Please list the major events that occurred during the incident. These events could include judgments or decision points."
- "As the (Job you are investigating) in this scenario, what actions, if any, would you take at this point in time?"
- "What do you think is going on here? What is your assessment of the situation at this point in time?"
- "What pieces of information led you to this situation assessment and these actions?"
- "What errors would an inexperienced person be likely to make in this situation?"
- 注意（原文）：「"People often want to critique the simulation. Assure your interviewee that you are interested in his/her critique, but that for the first part of the interview, you would like to work with the scenario as it has been presented. Be sure to follow up and ask for a critique at the end."」
- 場面は新しく作らず、**既にあるものを使う**：「"Developing a new simulation specifically for use in the interview is not a trivial task and is likely to require an up-front Cognitive Task Analysis"」。紙と鉛筆でよく、「"fidelity is not an important issue. The key is that the simulation present a challenging scenario."」

### 2.6 時間・評価・手引きの改良（事実）

- 時間：「"It typically takes 3 hours to use all three interview techniques with one SME."」（報告書 56 ページ）。BPS の紹介は「"The knowledge audit can take up to two hours to complete"」（Gore & McAndrew 2009、【二次】）。
- 評価：大学院生が、2時間の説明と6時間の講習のあとで、専門家に聞き取りをして、重要で正確な認知情報を得て、教材にできた。主観では「easy to use, flexible, clear output」。ただし**構造のない聞き取りの群との差は、ほとんど出なかった**（人数が少なく、聞き手の個人差が大きい）：「"we were surprised to find so few differences between the ACTA group and the unstructured interview group in our data"」。ACTA の群は「"I felt confident in my ability to lead an interview"」の評価が高かった（4.18 対 3.25、p=.02）。
- 限界（原文）：「"It is our belief that a tradeoff exists: the more streamlined and proceduralized Cognitive Task Analysis techniques become, the less powerful they are. Our suspicion is that the ACTA techniques gather less comprehensive information than more systematic techniques such as … PARI method … and that the information gathered is more superficial than that gathered using the Critical Decision method …"」。CDM の聞き取りから作った表は、ACTA や構造のない聞き取りから作った表より、**広い認知要求で、各要求の深さがあった**（付録 C.3）。
- 手引きの改良（原文の要点。「新人の聞き手」が使う設計の根拠になる）：
  - 「"The first was to reduce the number of probes so that the Knowledge Audit would accommodate the necessary time constraints. The second was to eliminate jargon and incorporate more everyday language so that the interviewer could understand the concept of the aspect of expertise being probed and also so that the SMEs could understand what they were being asked. We also learned that providing an explanation of each probe was a useful way to introduce the question and to elicit more concrete responses based on the SME's own experiences."」
  - 視点の切り替えを**1回**にした：「"the early versions of this interview instructed the interviewer to elicit an example (expert perspective), then ask why that activity is difficult (novice perspective), and finally ask the expert to describe his/her strategies (expert perspective). To reduce the confusion we reordered the questions … The new order requires only one switch in perspective."」
  - 模擬の場面の聞き取りでは、「"in telling a story people tend to describe actions first and then fill in details about what led to that action. The order of the first two probes was reversed to accommodate the interviewees' story-telling tendencies."」
  - タスク図の最初の質問を「"Please decompose this task into subtasks...."」から、上の「"Think about what you do when you (Task of Interest). Can you break this task down into…"」に変えた（学生が過程でなく細部に迷い込んだため）。
- 利用者分析：ナビーの教官たちは、専門性を文書にすると「手順の一覧になり、技能を捉えない」と心配した（「"a fear that to try to document expertise and cognitive skill … will result in a list of procedures that do not adequately capture the concepts and skills"」）。

### 2.7 ACTA を実際に使った人の報告（2021、2023）

- Stanik ほか（2021/2022、【一次】）：救急の機器の設計で、**全部オンライン**（Zoom と Miro）で ACTA を変えて使った。タスク図は共同編集の画面と、メールの往復（4回）で作った。ナレッジ監査は専門家11人、1人45〜60分。「**最初の3人のあと、答えが重なるので、探りの一部を聞かなくした**」：「"We stopped explicitly asking questions of some of the categories after finishing the first three interviews since the interviewees' answers were highly overlapping with the answers of other questions."」「"Using only a subset of the original categories enabled us to have a more natural conversation with the interviewees and to discuss a higher number of tasks during the time-limited interviews."」また「各探りの答えは、機器でなく**過程**の難しさになりやすい」ので、後半は Equipment Difficulties に重点を置いた。**各面談を文字に起こし、分からなかった語に印を付け、次の面談で聞いた**（Lesson 2）。聞き手と記録係を交代して、聞き手の偏りを減らした。タスク図は「3〜6段階」の勧めに従い6段階。
- Berlin & Praetorius（2023、【一次】）：海上の水先案内人8人。1人52分〜1時間42分。ACTA の手引きを順に使うと「"quite cumbersome, repetitive and time-consuming"」だった。仕事の型が決まっていない職業で、「ジョブスマート」か「裏技」か分けにくい探りがあった。そこで、**探りを順番に聞かず**、紙の表（行列）を見せて、本人が好きな順で話せるようにした。
- Hutchins, Pirolli, & Card（2004、DTIC ADA466054、古い、【一次】）：情報分析官の仕事で、ACTA は初期の把握に役立ったが、「"we determined that we needed to broaden the set of interview probes to uncover the bigger picture"」。最初の面談は約1.5時間。**分析したあと、同じ人に戻ってきてもらい、追いの面談**をした。

### 2.8 使えるか（チャット・1人・数十往復）

- 判定（根拠）：
  - **タスク図**：○。短い。Stanik ほかは、画面の共有とメールの往復（4回）で作った。ACTA は「3〜6段階」「判断が要る段階に丸」と、手順が小さい。
  - **ナレッジ監査**：○（最も合う）。1つの探りは、**自分の経験の具体例**を求める単独の質問で、文字でも1問ずつ出せる。実際に動画・紙の表・メールで使われた（Stanik、Berlin & Praetorius）。ただし**全部の探りを順に聞くと、冗長**（Stanik、Berlin & Praetorius）。ACTA 自身も「探りを減らし、言葉を日常語にし、各探りに説明を付けた」と報告する。
  - **模擬の場面の聞き取り**：△。場面が要る（既存のものを使う方針）。紙と鉛筆でよいと明記（ACTA 報告書）。
  - **認知要求の表**：○。複数の専門家のデータをまとめる道具。1人のユーザーなら、1人分の表になる。
  - **時間**：全部で約3時間（対面）。数十往復では全部は入らない。
- 変え方〔考察〕：
  - ナレッジ監査の探りは、1つのタスクに、基本の6つから**その分野に効くものを選ぶ**（3〜4つ）。1つの探りは「例」「手がかりと方法」「初心者はなぜ難しいか」の3往復で、4つ選ぶと12往復、タスクを2つ聞くと約24往復になる（これは ACTA の3つの質問の構造からの単純な計算）。数十往復の予算では、**判断が要る段階を1〜2個に絞る**のが現実的。
  - 「経験の浅い人はなぜ難しいか」「初心者がしやすい誤り」の聞き手の位置に、**生成プラグインの AI を置く**と、探りが目的に合う（「AI が間違えやすいのはどこか」）。これは〔考察〕であり、ACTA 自身の用法ではない。
  - 探りの前に、**短い説明（何を知りたいか）**を付ける。ACTA の改良の結果（説明を付けると具体的な答えが増えた）に合う。

---

## 3. Critical Decision Method（CDM）と、その簡略版（担当2）

### 3.1 出典

| 資料 | 書誌・URL | 区分 |
| --- | --- | --- |
| 原典（古い：1989） | Klein, G. A., Calderwood, R., & MacGregor, D. (1989). Critical decision method for eliciting knowledge. *IEEE Trans. Systems, Man, and Cybernetics*, 19(3), 462–472. DOI 10.1109/21.31053（OpenAlex 上、非公開：本文は読めていない） | 【未読】 |
| 手法の検証（古い：1998） | Hoffman, R. R., Crandall, B., & Shadbolt, N. (1998). Use of the critical decision method to elicit expert knowledge: A case study in the methodology of cognitive task analysis. *Human Factors*, 40(2), 254–276. DOI 10.1518/001872098779480442（非公開：本文は読めていない） | 【未読】 |
| 実務者向けの手引き（古い：2006） | Crandall, B., Klein, G., & Hoffman, R. R. (2006). *Working Minds: A Practitioner's Guide to Cognitive Task Analysis.* MIT Press.（archive.org は貸出のみで、本文は読めていない。4つの局面は Plant & Stanton 経由） | 【未読】 |
| 本人の説明（2020） | Klein, G.（2020）上の一覧メモ。CDM の説明：「"A knowledge elicitation technique that uses a set of cognitive probes to determine the basis for situation assessment and decision making during nonroutine incidents in multiple sweeps of the incident in retrospection."」。サイト https://www.gary-klein.com/cdm は「"a retrospective interview strategy that applies a set of cognitive probes to actual, non-routine events"」「"the interviewer uses a semi-structured format"」 | 【一次】（説明のみ） |
| 応用1（古い：1991、AERA 発表） | Freeman, J. J., et al. (1991). *A Knowledge Elicitation Technique for Educational Development: The Critical Decision Method.* ERIC ED334223. https://archive.org/details/ERIC_ED334223 （OCR が乱れているため、引用は読めた語に補正し、補正は [ ] で示す） | 【一次】 |
| 応用2（簡略版の資料。2005） | Hoffman, R. R. (2005). *Protocols for Cognitive Task Analysis.* IHMC. DTIC ADA475456。https://archive.org/details/DTIC_ADA475456 | 【一次】 |
| 応用3（2004） | Hutchins, S. G., Pirolli, P. L., & Card, S. K. (2004). A New Perspective on Use of the Critical Decision Method with Intelligence Analysts. DTIC ADA466054. https://archive.org/details/DTIC_ADA466054 | 【一次】 |
| 応用4 | Plant, K. L., & Stanton, N. A.「A Qualitative Exploration of Critical Incidents: Expanding Neisser's Perceptual Cycle Model」（AHFE の公開 PDF。掲載ページの表示は *Human Aspects of Transportation I (2021)*。本文の引用文献は 2013 年まで）https://openaccess-api.cms-conferences.org/articles/download/978-1-4951-2097-8_1 | 【一次】 |

Flanagan, J. C. (1954). The critical incident technique. *Psychological Bulletin*, 51(4), 327–358. DOI 10.1037/h0061470 は、CDM の元になった手法。PubMed に抄録がなく、本文は読めていない【未読】。Freeman ほか（1991）が「"The Critical Decision Method (CDM), a variant on the Critical Incident Technique (CIT; Flanagan, 1954)"」と書く（【一次】）。

### 3.2 手順：「掃引（sweep）」

- Plant & Stanton は、Crandall ほか（2006）の4つの局面を挙げる（【一次】だが、元の本を引いたもの）：「"(1) Incident identification, (2) Timeline construction, (3) Deepening probes and (4) 'what if' queries."」また、「"A shorter version of the method is permitted when time with experts is limited. For this, Crandall, Klein, and Hoffman (2006) have suggested that the probes are asked in relation to the whole incident as opposed to each phase of the incident."」「"the probes have been modified over the years and researchers are encouraged to modify the list as necessary"」。インタビューは30〜60分（Plant & Stanton の研究）。
- Freeman ほか（1991）：「"Each story was told four times."」
  1. 1回目：専門家が、中断なしで簡単に話す。
  2. 2回目：聞き手が**白板に時系列**を作り、本人と一緒に直す。時系列には、環境の刺激、本人の行動、時刻を入れる。
  3. 3回目：**探り**で、判断点・選択肢・判断基準を聞き、時系列に足す。
  4. 4回目：**落とし穴**。「"What if I had been handed the problem at this stage, unskilled as I am in this field?"」「"How might a less-experienced person have erred here?"」。聞き手は、あえて素人の質問や、反対の立場（devil's advocate）、例外探しをした。

### 3.3 探りの質問の原文

(a) Freeman ほか（1991）の3回目の探り（OCR 補正済み）：

- "What did you know at this time?"
- "What options did you consider?"
- "Why did you choose this option?"
- "What experiences or training [OCR: fining] were needed?"
- "Was anyone else involved? What did they do?"
- "What materials or tools did you use? How did you use them?"

(b) Plant & Stanton の「探りの例」の表（【一次】）：「"What information did you use when making the decision?"」「"Was the decision you made comfortably within your experience (why / why not)?"」「"Did your experience influence the decision that you made?"」「"Were you expecting this sort of incident to arise during the flight?"」「"What features were you looking for when formulating your decision?"」「"At any stage were you uncertain about the appropriateness of your decision?"」

(c) Hoffman（2005）の簡略版 **Recent Case Walkthrough**（CDM を縮めたもの。目的は、聞き手が分野に入ることと、信頼関係を作ること）：

> "The Recent Case Walk-through is an abbreviated version of the Critical Decision Method, and is primarily aimed at: • Bootstrapping the Analyst into the domain • Establishing rapport with the Participant"

- 指示：「"Please walk me through your most recent problem. When was it? What were the goals you had to achieve? What did you do, step by step?"」
- 時系列を作ったあと：「"Now let's go over this timeline. I'd like you to suggest corrections and additions."」
- 深掘り：「"Now I'd like to go through this time line a step at a time and ask some questions."」探りの型（原文）：Information「"What information did you need or use to make this judgment? Where did you get this information? What did you do with this information?"」／Mental Modeling「"Did you try to imagine the important causal events and principles? Did you make a spatial picture in your head? Can you draw me an example of what it looks like?"」／Knowledge Base「"In what ways did you rely on your knowledge of this sort of case? How did this case relate to typical cases you have encountered?"」／Guidance「"At what point did do you look at any sort of guidance? Why did you look at the guidance? How did you know if you could trust the guidance? … Did you need to modify the guidance?"」／Legacy Procedures「"What forms do you have to complete or specific products you have to produce?"」

(d) Hutchins ほか（2004）：情報分析官向けに**探りを分野用に作り直した**表（Information／Mental Models／Hypotheses／Intermediate Products）。例：「"What information were you seeking, or what questions were you asking?"」「"Why did you need this information?"」「"Were there any difficulties in getting the information you needed from that source?"」「"Did you formulate any hypotheses?"」「"Did you write any intermediate notes or sketches?"」。分析後の追いの面談の探り：「"What were your specific goals at the time?"」など。

### 3.4 なぜ「実際の1件」なのか（Freeman ほか 1991 の理由。事実）

- 「"asking a subject why she took some action produces less [OCR: l»s] reliable data than asking what actions she took. CDM subjects are asked to report what they observed or concluded during a single incident, not their assessments of events nor generalizations across incidents."」（Ericsson & Simon, 1980 の「"Interpretive probing, unlike the critical incident technique, cannot be relied on to produce data stemming directly from the subjects' actual sequences of thought processes."」を引いている）
- 一般化は最後の手段：「"subjects in the debugging study used generalization (e.g., 'I do this whenever I see symptoms like that.') principally as a last resort"」
- 日常の繰り返しは記録しない：「"Ericsson and Simon (1980) caution that subjects may accurately recall the details of a single instance of an often-repeated task. However, the CDM does not elicit routine incidents."」
- 時系列が**聞き漏らしの手がかり**になる：「"the use of the timeline signals memory or reporting problems to the interviewer. Unoccupied slots on the timeline point the interviewer toward unreported events. Overlapping events in a time slot may indicate inaccurate recall. Both conditions mark the need for intensive questioning. Finally, using the timeline to represent the problem in its totality seems to help subject recall details."」
- 時系列の弱点：専門家の検討会で、「"expert debugging is a less linear process than was implied in most of the individual interviews, in which time pressures or the linear character of the timeline may have biased the data."」
- 5回目の案：1〜4回目に、聞き手と専門家が**使う言葉の意味を磨いてしまい、濃い言葉**で話すようになる。「"the latter few recitations tend to employ dense terms whose meaning the expert and interviewer have refined throughout the interview."」

### 3.4b 実際の1件に頼る話の注意（二次）

- NN/g の CIT の紹介（Rosala, 2020-01-26、【二次】）は、「"Memory is fallible, and so details can often be lost."」「"Doesn't represent typical usage."」（人は極端な出来事を思い出し、普段の使い方は思い出さない）、「聞き方を変えると、思い出す出来事が変わるので、誘導しない」と挙げる。https://www.nngroup.com/articles/critical-incident-technique/
- 〔考察〕CDM は「普段の繰り返しの作業」を狙わない（Freeman）。クリエイターが引き出したいのは、**普段の作業の決まり**が多い。「実際の1回」は、**最近の普通の1回**（Hoffman の Recent Case Walkthrough）と、**非定型の1回**（CDM）の2種を使い分ける必要がある。

### 3.5 回数・時間・限界（事実）

- 完全な CTA は、「"A typical Cognitive Task Analysis conducted using the Critical Decision method includes at least six interviews with SMEs."」（ACTA 報告書 付録 C.3）。
- ACTA の報告書は、CDM の表のほうが ACTA の表より深いと述べる（§2.6）。Leu & Abbass（2018、【二次】）は、「time consuming and requires elicitors to possess high level of expertise in the domain」と書く。
- Hutchins ほか（2004）：最初の面談は約1.5時間、分析したあと追いの面談。

### 3.6 使えるか（チャット・1人・数十往復）

- 判定（根拠）：
  - 1掃引目（話す）・2掃引目（時系列）：○。時系列は**文字の箇条書きで共同編集できる**（Freeman は白板、Stanik は共有画面と、メールの往復）。
  - 3掃引目（深掘り）：○。探りは、**単独の具体的な質問**。
  - 4掃引目（もし〜なら）：△。仮定の質問だが、**実際の1件に結び付けた**質問であって、一般の仮定ではない（Freeman）。
  - 全体：Hoffman の Recent Case Walkthrough は、**CDM の簡略版で、目的が「分野に入ること・信頼関係」**。数十往復のクリエイターには、こちらの大きさが合う。
- 変え方〔考察〕：
  - 「最近の1回」を話してもらい、**聞き手が時系列を文字で作って見せ、直してもらう**。空白（飛んだところ）と重なりの印を付けて、そこを聞く（Freeman の「時系列は聞き漏らしの合図」）。
  - 深掘りは、ACTA の2つの問い（手がかりと方法／初心者の誤り）と、CDM の問い（何を知っていたか／どんな選択肢か）から、その分野に効く3〜4問を選ぶ。
  - 話す言葉の意味が聞いているうちにずれる（Freeman の「濃い言葉」）ことに備え、ユーザーの言葉を**そのまま**残す。AI が言い換えた言葉で話し続けない。

---

## 進捗の一覧（調整役の指示により、ここで一旦まとめた）

| 節 | 内容 | 状態 |
| --- | --- | --- |
| §1 | SWEBOK V4 と V3 の比較 | **確定** |
| §2 | ACTA（探りの原文、時間、評価、再現） | **確定**（Ergonomics 1998 の本文は未読） |
| §3 | CDM と Recent Case Walkthrough | **確定**（Klein 1989、Hoffman 1998、Working Minds は未読） |
| §4 | 暗黙知の手法（laddering、teach-back、think-aloud、contextual inquiry、repertory grid、card sort、free list） | **途中**（事実と出典は確定。個々の節の詳しい書き下ろしを圧縮した） |
| §5 | 聞き方の型と落とし穴 | **途中**（出典は確定、書き下ろしを圧縮） |
| §6 | 失敗の研究（Bano、Ferrari） | **確定（要点）** |
| §7 | 聞き終える判断（飽和、チェックリスト、長さ） | **途中** |
| §8 | 知識の書き方、合否の基準への変換 | **途中** |
| §9 | チャットの文字だけの研究 | **途中** |
| §10 | 考察 | **途中** |
| §11 | 設計で決めること 1〜11 への対応表と確信度 | **途中**（暫定） |
| §12 | 未読・探した場所・再開のチェックリスト | **確定** |

---

## 4. 暗黙知を引き出す手法（担当3）【途中：圧縮版】

### 4.0 分類と、手法どうしの比べ

- Hoffman ほか（1995）【抄録のみ】：手法を3つに分ける。「"(1) analysis of the tasks that experts usually perform"」「"(2) various types of interviews"」「"(3) contrived tasks which reveal an expert's reasoning processes without necessarily asking about these processes"」。Hoffman, Shadbolt, Burton, & Klein (1995). *Organizational Behavior and Human Decision Processes*, 62(2), 129–158. DOI 10.1006/obhd.1995.1039。https://research.bond.edu.au/en/publications/eliciting-knowledge-from-experts-a-methodological-analysis/
- Leu & Abbass（2018）【二次】：人が聞き手の手法を、informal（観察、インタビュー）／process tracing（verbal report、protocol analysis、cognitive walkthrough）／conceptual（概念の引き出し、repertory grid、sorting）に分ける。構造のあるインタビューの型として「"focused discussions, teach-back, role play, twenty-questions, Cloze experiment, Likert scale items, question answering protocols, questionnaires and group interview techniques"」を挙げる（元は Cooke 1994 など）。ナレッジ監査を「1980年代に提案」と書く誤りがある。https://arxiv.org/pdf/1802.09669
- Cooke（1994）*Int. J. Human-Computer Studies* 41(6): 801–849、Shadbolt & Smart（2015）*Evaluation of Human Work* 4th ed., 163–200 は **未読**（Southampton の置き場は 403）。
- Burton, Shadbolt, Rugg, & Hedgecock（1990、古い）【抄録のみ】*Knowledge Acquisition* 2(2): 167–178：構造化インタビュー、protocol analysis、card sort、laddered grid を2つの分類の領域・各8人の専門家で比べ、「protocol analysis, despite being commonly used, is the least efficient」。また「"subjects entirely ignorant of a domain are able to construct plausible knowledge bases from common sense alone"」（専門家の知識の検証には、素人との比べが要る、という含み）。https://research.bond.edu.au/en/publications/the-efficacy-of-knowledge-elicitation-techniques-a-comparison-acr/
- Davis ほか（2006）の系統的レビューの更新：Dieste, Lopez, & Ramos（2008, WER）【一次】https://www.inf.puc-rio.br/wer/WERpapers/artigos/artigos_WER08/dieste.pdf 。「"interviews were the most effective elicitation technique. … structured interviews performed better than unstructured ones. Laddering is almost as good as interviews. Sorting and protocol analysis can be considered low effective techniques."」「"interviews were able to extract more information than several other elicitation techniques, and also … the information extracted was more complete."」laddering は「"more difficult to apply than unstructured interviews"」。**効果の測り方は「引き出せた情報の量・網羅」が中心**で、古い小規模な実験が多い（Davis 2006 本文は未読）。
- Sutcliffe & Sawyer（2013、RE'13、発表スライド）【一次・スライド】https://www.cin.ufpe.br/~in1020/docs/aulas/IN1020_aula28.pdf ：暗黙（unknown knowns）に対して、インタビューは「Open ended questions」、観察は「Serendipitous discovery」、シナリオも「Serendipitous discovery」、workshops と protocols は「limited potential」。論文本文は未読。Gervasi ほか（2013）の4分類（known knowns／known unknowns／unknown knowns＝暗黙／unknown unknowns）は Ferrari ほか（2016）本文で読んだ（§6）。
- Rugg らの説明【二次】：言われなかった知識に届くのは「observation, laddering, think-aloud」など限られた手法で、インタビュー・質問紙・フォーカスグループでは届きにくい（検索結果の要約。原典 Maiden & Rugg 1996 *ACRE*, Software Engineering Journal 11(3): 183–192 は未読）。

### 4.1 laddering（「なぜ？」を重ねる）

- 中身【一次】Sherlock & Rugg (2003), PPIG/EASE 15th, 453–472. https://ppig.org/files/2003-PPIG-15th-sherlock.pdf ：
  - 「"A very limited set of probes is used to move around the respondent's knowledge. … Each probe derives in a standardized way from something previously said by the respondent"」
  - 上に（目標・価値）：「"Could you tell me which of these you would prefer, and why?"」のあと、繰り返し「"Could you tell me why you would prefer that?"」。「"The process usually reaches top-level goals surprisingly swiftly (three to five levels)"」
  - 下に（説明を測れる言葉へ）：「"You mentioned X earlier in the session. Could you tell me how you could tell that something was X?"」。例：「"cluttered"」→「"too many items on the screen"」→「"There are more than about half a dozen"」。「"'About half a dozen' is sufficiently specific to be used in design decisions, unlike 'cluttered'."」「"between one and five levels of explanation is the usual range."」
  - 種類を聞く：「"Can you tell me some types of X?"」。この論文の実験の探り：「"what problems are associated with X?"」「"what are the reasons, do you think, for designers using X?"」。
  - 同じ論文は、設計者の説明が「**表向き（front）**」になりうることを述べる：「"this will be more likely to produce a 'front' version than a 'back' version"」。
- 元の手法【二次】Reynolds & Gutman (1988), *J. Advertising Research* 28(1): 11–31（未読）。Torres, Riba, & Freeman (2015), *Int. J. Intercultural Information Management* 5(1/2) が整理（https://arxiv.org/pdf/1607.07796 ）：「"Why is that important to you?"」；最初は「"obvious, very simple or even stupid"」な質問で楽にさせる；「"the typical in-depth interview should last between 60 to 75 minutes. Approximately five to ten ladders can be assembled from each one."」；入口の型：直近の場面を呼び出す／ないと仮定する／否定の形（「使わなかったらどうなるか」）／過去にさかのぼる／第三者の経験／沈黙。
- SWEBOK V4 の 5-whys（§1.5）：「2〜3回で本当の問題に着く」「止める条件：やらなければ関係者の問題が解けない、が答えになったとき」。
- 注意（事実）：「なぜ」で**自分の行動の原因を説明させる**質問は信頼しにくい（§5.5）。
- 使えるか：判定（根拠）：○。1つの探りが前の答えの言葉から作れるので文字に向く。**ただし1回の聞き取りで梯子は5〜10本**（Reynolds & Gutman、二次）。変え方〔考察〕：全部の言葉でなく、**合否の決め方・決まった書き方**の中の**あいまいな言葉**（「見やすい」「ちゃんと」）だけを、「それはどうやって見分けますか？」で下げる。数字や有無に落ちたら止める。

### 4.2 teach-back／復唱による確認

- 医療の手引き【一次・公的機関】AHRQ, *Use the Teach-Back Method: Tool 5*（Content last reviewed April 2024）https://www.ahrq.gov/health-literacy/improve/precautions/tool5.html ：「"The teach-back method is a way of checking understanding by asking patients to state in their own words what they need to know or do about their health."」「"Do not ask questions that can be answered with a 'yes' or 'no.' 'Do you understand?' and 'Does that make sense?' are NOT teach-back questions. Patients are likely to answer 'yes' whether they understand or not."」「"you are checking how well you explained something, not testing the patient"」「"If they parrot your words back to you, they may not have understood."」「"Chunk and Check."（情報を小さく区切り、その都度復唱）」。
- 知識獲得の側【二次】：teach-back interview は「role reversal」の1つ。「"After some initial knowledge elicitation, the knowledge engineer tests the captured information" by attempting to "'teach' the domain expert."」（Alan Dix の用語集 https://alandix.com/glossary/aibook/knowledge elicitation!teach-back interview ）。Cordingley（1989）が挙げる12の手法に「Teach back」「Laddering」「Sorting tasks」「Critiquing」「20 questions」「Protocol」などが入る（書評 *Knowledge Engineering Review*, 2000, https://maxapress.com/data/article/ker/preview/pdf/S0269888900005981.pdf 、【二次】）。
- 要求工学の側【一次】Bano ほか（2019）：終わりの要約をした組が少ない（§6）。「"a summary, performed by the analyst to confirm their understanding, can often trigger further clarifications from the customer's side."」
- 注意：医療の teach-back は**聞き手の説明を相手が復唱**。知識獲得の teach-back は**聞き手の理解を専門家に教え返し、直してもらう**。向きが逆だが、「はい/いいえ でなく、自分の言葉で」は共通。
- 使えるか：判定（根拠）：○。文字で何の問題もない。変え方〔考察〕：「〜という決まりですか？」を、「私の理解はこうです。**違うところを直してください**」と、**言い換え＋直し**を頼む形にする。区切り（chunk）ごとに行う。

### 4.3 think-aloud ／ retrospective（後からの語り）

- 【一次】van Someren, Barnard, & Sandberg (1994). *The Think Aloud Method* (Academic Press；著者の受理原稿) https://pure.uva.nl/ws/files/716505/149552_Think_aloud_method.pdf ：
  - 「"the information that can be verbalized is the content of working memory. This means that the content of long-term memory (the general knowledge) cannot be verbalized (unless it is somehow retrieved rather than used)"」
  - 後からの語りの問題：「"subjects may tend to present their thought processes as more coherent and intelligent than they originally were"」。信頼できない条件：「"all discrepancies were found in situations in which there was either a delay in time between the cognitive process and the report, or there was a question by the experimenter that required an interpretation rather than a direct report, ('Why did you do X instead of Y?'), or both."」
  - 対策：「"notes taken during problem-solving or a video … can support the retrospection. This gives better results than just retrospection because the action protocol helps the subject to remember thoughts that he would not reconstruct otherwise."」
- 【一次】Nisbett & Wilson (1977), *Psychological Review* 84(3): 231–259（古い）https://web.math.princeton.edu/~sswang/literature_general_unsorted/Nisbett-Wilson-PsychologicalReview1977.pdf ：自分の認知過程の報告は、「"a priori, implicit causal theories"」に基づくことがある（本文は OCR が粗く、抄録の前半と上の句のみ確認）。
- 使えるか：判定（根拠）：同時の think-aloud は、チャットでは△（作業しながら打つ負担）。後からの語りは○。変え方〔考察〕：**本人が実際に使ったファイル・出力・履歴を手がかりに**「その時何が見えたか／何をしたか」を聞く（action protocol の代わり）。「なぜ」でなく「何を見て／次に何をしたか」。

### 4.4 contextual inquiry（観察できないときの代わり）

- 【二次】NN/g, Flaherty (2020-12-06). https://www.nngroup.com/articles/contextual-inquiry/ ：「"a type of ethnographic field study that involves in-depth observation and interviews"」。原則4つ：Context／Partnership／Interpretation／Focus。師匠と弟子の型（研究者が弟子）。1〜2時間〜数日。
- 【二次】NN/g, Kaplan (2022-11-13). https://www.nngroup.com/articles/remote-contextual-inquiry/ ：離れていると「"only the user is in-situ, not the researcher."」「"our purview of the environment is limited."」画面全体の共有と、作業場所の写真を頼む。1回2〜3時間。
- Beyer & Holtzblatt の原典（*Contextual Design*, 1997/1998）は**未読**。SWEBOK V3/V4 は観察を挙げ（§1）、V3 は「"too subtle and complex for their actors to describe easily"」と理由を述べる。
- 使えるか：判定（根拠）：×（観察できない）。変え方〔考察〕：**ファイル・履歴・画面の貼り付け**（REQ-017/018）で、作業の跡を見る。聞き手は「弟子」の位置（教えてもらう）をとる。

### 4.5 repertory grid

- 【一次】Shaw & Gaines (1986), *Techniques for Knowledge Acquisition and Transfer* (KAW'86) https://gaines.library.uvic.ca/pdf/KAW86M.pdf ：専門家に、分野の**要素**（事例）を示し、**構成概念（対になった言葉）**で評価してもらい、含意（「A ならば B」）を規則として取り出す。例：人事評価の専門家の「総合評価が高い」は、「頭が良い・創造的・信頼できる・自分で動く」などの含意から。限界（Boose 1985 を引く）：「"better suited for analysis than for synthesis problems … rather than design and planning, and … difficult to apply to deep causal knowledge or strategic knowledge"」。
- 三つ組の質問【二次・低信頼】Wikipedia：3つを示し、「どう2つが似て、3つ目と違うか」。構成概念は6〜16個が普通。https://en.wikipedia.org/wiki/Repertory_grid 。Tan & Hunter (2002), *MIS Quarterly* 26(1): 39–57 は【未読】。
- 使えるか：判定（根拠）：△。評価の表が要り、1回の聞き取りの時間が重い。変え方〔考察〕：ユーザーに**良かった成果物と悪かった成果物**が複数あるときだけ、「この3つで、2つが似て1つが違うところは？」を使い、**合否の基準の言葉**を引き出す。

### 4.6 card sort・pile sort・free list

- 【一次】Borgatti (1999), Elicitation techniques for cultural domain analysis, in Schensul et al. (eds.), *Enhanced Ethnographic Methods*, AltaMira, pp. 115–151（置き場の PDF は画像のため、ページ画像で読んだ）http://www.analytictech.com/mb870/Readings/elicitation.pdf ：
  - free list：「"just ask a set of informants to list all the members of the domain"」「"what other kinds of fruit are there?"」「"what else is there that is like a mango?"」。普通の質問との違い（刺激が自分の外の対象で、比べられる）。**インフォーマルな聞き取りでも「例を挙げて」は有効**：「"You mentioned that there are a number of ways that graduate students can screw up. Can you give me some examples?"」。「"the objective might be simply to elicit just one element, which then becomes the vehicle for further exploration."」逆に「**その項目は含まれるか。含まれないならなぜか**」と聞くと、「"negative examples help to elicit the characteristics that are shared by all members"」。
  - 一覧の順序：似た項目が連続して出て、間に一瞬の間（pause）があり、新しい連続が始まる。
  - 領域には**中心と周辺があり、絶対の境界はない**（「ずっと尾が伸びる」）。
  - pile sort の指示の原文：「"Here are a set of cards representing animals. I'd like you to sort them into piles according to how similar they are. You can make as many or as few piles as you like. Go!"」。読み書きできる人には**名前**を書いたカードが良い（絵は見た目に引きずられる）。通常**20人以上**に行う（人をまたぐ手法）。
- 【一次】Weller ほか（2018）*PLOS ONE* 13(6): e0198606 https://pmc.ncbi.nlm.nih.gov/articles/PMC6010234/ ：「"Even small samples (n = 10) produced 95% of the most salient ideas with exhaustive listing, but only 53% of those items were captured with limited responses per person (three)."」→ **1人に「他にありますか」を尽きるまで聞くと、目立つ項目が多く取れる**（人をまたぐ集計での結果）。
- 使えるか：判定（根拠）：free list ○、pile sort △（人をまたぐ前提。1人だけだとその人の分類にとどまる）。Dieste らは sorting を効果が低いほうに入れる。変え方〔考察〕：「決まりを全部挙げて」→「他には？」→「**ここまでで、どれが同じ種類ですか。名前を付けてください**」で項目を種類に分けると、一覧の形（設計5）が決まる。

### 4.7 その他

- 見本・批評（critiquing）：SWEBOK V3 の試作品の項（§1.3）。Cordingley の12手法に Critiquing（二次）。〔考察〕REQ-020 の見本は、これに当たる。§8.4 の Ripple Down Rules も、**間違いを見せて直してもらう**型。
- cognitive interview（Fisher & Geiselman）：Memon, Meissner, & Fraser (2010), *Psychology, Public Policy, and Law* 16(4): 340–372 の抄録の要約（検索結果）：「正しい詳細が大きく増え、誤りは少し増えた」。目撃証言向け。本文は未読【抄録のみ・低】。
- 「実際の最近の1件」の実務書（Mom Test）【二次・低】https://mtlynch.io/book-reports/the-mom-test/ ：「"Ask about specifics in the past instead of generics or opinions about the future."」「"Talk less and listen more."」本の本文は未読。

---

## 5. 聞き方の型と落とし穴（担当4）【途中：圧縮版】

### 5.1 開かれた質問と閉じた質問（Krosnick 1999）
【一次】Krosnick, J. A. (1999). Survey research. *Annual Review of Psychology*, 50: 537–567. https://web.stanford.edu/dept/communication/faculty/krosnick/docs/1999/1999%20AnnRevSurvey.pdf
- 「"respondents tend to confine their answers to the choices offered, even if the researcher does not wish them to do so … people generally ignore the opportunity to volunteer a response and simply select among those listed, even if the best answer is not included. Therefore, a closed-ended question can only be used effectively if its answer choices are comprehensive, and this is difficult to assure."」
- 「"open-ended questions seem to be more viable research tools than had seemed to be the case."」（不慣れな人でも困らない、目立つ答えに偏らない、信頼性・妥当性は閉じた質問以上、という研究を引く）
- 〔考察〕クリエイターの質問ツールの**選択肢**は、ユーザーの答えを選択肢の中に閉じ込めうる。「その他（自由記入）」が実質あっても、人は書かない傾向がある（上の研究は紙・面談の調査。チャットのボタンでの再現は未確認）。

### 5.2 誘導質問・同意しやすさ
- 【一次】Loftus & Palmer (1974), *J. Verbal Learning and Verbal Behavior* 13: 585–589（古い）https://www.gwern.net/doc/psychology/cognitive-bias/1974-loftus.pdf ：「"A leading question is simply one that, either by its form or content, suggests to the witness what answer is desired or leads him to the desired answer."」動詞を変えるだけで、速度の推定が変わった（smashed 40.8、collided 39.3、bumped 38.1、hit 34.0、contacted 31.8 mph）。1週間後、smashed の群は、実際にはなかった割れたガラスを「見た」と答えやすい。著者は、答えの偏りと記憶の書き換えの2通りの解釈を挙げる。
- 【一次】Krosnick (1999)：「"acquiescence—the tendency to endorse any assertion made in a question, regardless of its content"」。「"an average acquiescence effect of about 10%, and the same sort of evidence documents comparable acquiescence in true/false and yes/no questions."」「"Acquiescence is more common when a question is difficult to answer …, when respondents have been encouraged to guess …, after they have become fatigued …, and during telephone interviews than during face-to-face interviews …, presumably because people feel more accountable under the latter conditions."」
- 【二次・調査会社の手引き】Pew Research Center「Writing Survey Questions」https://www.pewresearch.org/our-methods/u-s-surveys/writing-survey-questions/ （日付の表示なし）：「"This behavior is even more pronounced when there's an interviewer present"」「"A better practice is to offer respondents a choice between alternative statements."」
- 〔考察〕REQ-017 の「〜という決まりですか？」は、はい/いいえ の形そのもので、疲れたあと・難しい確認ほど「はい」が増える。**反対の主張と並べて選んでもらう／どんなときに当てはまらないかを聞く／自分の言葉で言い直してもらう**が代わりになる（§4.2）。

### 5.3 二重質問（1つの質問に2つ入れる）
- 【二次】Pew：「"Questions that ask respondents to evaluate more than one concept (known as double-barreled questions)" … "often lead to responses that are difficult to interpret."」「"It is also important to ask only one question at a time."」
- 【一次】Bano ほか：「とても長い質問」で、顧客が繰り返しや言い換えを求めた（§6）。
- 例外（事実）：ACTA の「Big Picture」の探りは、1つの探りの中に2つの文（"Can you give me an example…? What are the major elements …?"）を持つ（§2.4）。1つの探りに1つの狙い、が守られている形。

### 5.4 仮定より「実際の最近の1件」
§3.4（CDM の理由）、§3.4b（NN/g CIT）、§4.7（Mom Test）、Hoffman の Recent Case Walkthrough（§3.3）。

### 5.5 「なぜ」の扱い
- 信頼しにくい：van Someren ほか（§4.3）、Freeman ほか（§3.4）、Nisbett & Wilson（§4.3）。
- 有用：**目標・理由を上へたどる**（laddering 上向き、5-whys：§1.5、§4.1）。
- 〔考察〕「なぜ」は、**要求の理由・目的**には使い、**自分の行動の原因の説明**には「何を見たか／何をしたか」を使い分ける。

### 5.6 沈黙・要約・言い換え
- ACTA：「don't rush; give the SME time」「take a timeout, restate the question, and check…」（§2.4）。
- 要約：Bano ほか（§6）、AHRQ（§4.2）。
- 文字では「沈黙」は使えない〔考察〕。代わりに、**1回の発話に質問を1つだけ**にして、**答えが出るまで次を出さない**。

### 5.7 質問の順序・始め方
- Bano ほか：始め（打ち解け）と終わり（要約）の誤りが多い。勧めの順：打ち解ける→今の業務の過程→困りごと→終わりに要約。
- Pew：「"A questionnaire, like a conversation, should be grouped by topic and unfold in a logical order."」「"earlier questions can unintentionally provide context for the questions that follow"」。
- ACTA の順：タスク図→ナレッジ監査→模擬→表。Hoffman 2005：文書の分析→最近の1件→ナレッジ監査（§8.6）。

### 5.8 言葉
- ACTA は言葉を日常語にして効果があった（§2.6）。Bano ほか：専門的な質問、共通の語彙を確かめない聞き手（§6）。Freeman ほか：聞いているうちに言葉の意味が濃くなる（§3.4）。

---

## 6. 要求の引き出しのインタビューでよくある失敗（担当5）【確定（要点）】

### 6.1 Bano ほか（2019）【一次】
- 書誌：Bano, M., Zowghi, D., Ferrari, A., Spoletini, P., & Donati, B. (2019). Teaching requirements elicitation interviews: an empirical study of learning from mistakes. *Requirements Engineering*, 24(3): 259–289. DOI 10.1007/s00766-019-00313-0。読んだ本文：受理原稿 https://par.nsf.gov/servlets/purl/10105611 。（2018 RE 会議版：DOI 10.1109/RE.2018.00027）
- 研究：学生の分析者が、役割演技の顧客に、**15分**のインタビューを3回。第1研究（学生110人・28組、初回のみ）で失敗を拾い、第2研究（138人・34組、3回とも）で追った。【限界：学生、役割演技の顧客、15分、対面。】
- 結果の原文：「"we identified 34 unique mistakes classified into 7 high-level themes, namely question formulation, question omission, interview order, communication skills, analyst behaviour, customer interaction, teamwork and planning."」第2研究：「"the students struggled mostly in the areas of question formulation, question omission and interview order and did not manage to improve their skills throughout the three interviews."」
- 件数（第1研究、28組）：あいまいな質問 21、聞いたあとの要約なし 19、打ち解けなし 16、始め方・順序の誤り 15、関係者を聞かない 12。
- あいまいな質問の例（原文）：「"What is the impact of the project to your business?"」「"Can you indicate the major constraints of the project?"」「"What are your expectations?"」。技術的な質問：「"What is the minimum viable product"(!)」を顧客が分からなかった。
- 聞かなかったこと：追いの質問・探り（「"they thought that the maximum information that could be elicited was reached already"」）、今の業務の過程、優先順位、問題領域。
- 順序の誤り：打ち解けの前に直接質問、**解決策を問題の前に**、終わりの要約なし。「"Summarizing the findings of the interview is a best practice for overcoming the misinterpretations during the interview."」
- 要約と曖昧さ：「"a summary, performed by the analyst to confirm their understanding, can often trigger further clarifications"」。曖昧な答えは、次の面談の質問の材料になった。
- 設計上のもう1つの結果：失敗の一覧を**チェックリスト**として使って、学生の上達を測れた。
- 考察のヒント：失敗は、**領域に関わる側（質問の作り方、抜け、順序）**が、社会的な側（態度、打ち解け）より多かった（「"more mistakes in domain-related categories"」）。

### 6.2 Ferrari, Spoletini, & Gnesi（2016）【一次】
- 書誌：*Requirements Engineering* 21(3): 333–355. DOI 10.1007/s00766-016-0249-3。本文（受理原稿）https://openportal.isti.cnr.it/data/2016/353983/2016_353983.postprint.pdf 
- 研究：1人の分析者が、**ビジョン論文**として、役割演技の34回の構造のないインタビュー（顧客：分野の専門家11人とソフトウェア技術者7人）を行い、聞き手が曖昧と感じた232か所を分類。著者は「"not meant to be a rigorous empirical study"」と書く。
- 主張：曖昧さは、暗黙のナレッジを開く鍵になる：「"the occurrence of an ambiguity is often a resource for discovering tacit knowledge"」「"the ambiguity often works as a conversational picklock"」。曖昧さの4分類：unclarity、multiple understanding、incorrect disambiguation、correct disambiguation。
- 暗黙の定義（Gervasi ほか 2013 の枠）：known known／known unknown／**unknown known（顧客は言えるのに渡さず、分析者は存在に気づかない＝暗黙）**／unknown unknown。
- 例5.2（原文の要点）：写真の保管形式を聞く「"In which format do you have the pictures, .jpg, .tiff ?"」に、専門家が「"Well, a digital archive does not exist!"」。**具体的な質問が、言われていなかった前提を出した**。
- 暗黙のナレッジを取り出せない唯一の場合：「**聞き手が誤解したことに気づかない（undetected incorrect disambiguation）**」。「"if an undetected incorrect disambiguation occurs, the analyst has no means to discover tacit knowledge during the interview."」
- 分野の専門家の顧客では、曖昧さから出てきた暗黙のナレッジの**61%が分野の知識**、目標の暗黙は 4〜8% と少ない。

### 6.3 Ferrari ほか（2017, RE'17）【一次・探索研究】
- Ferrari, Spoletini, Donati, Zowghi, & Gnesi (2017). Interview Review: Detecting Latent Ambiguities to Improve the Requirements Elicitation Process. *RE 2017*, 400–405. DOI 10.1109/RE.2017.15。https://par.nsf.gov/servlets/purl/10061986
- 「"Only in 26% of the cases the ambiguities revealed by the analysts matched with the ambiguities found by the reviewers. In 46% of the cases, ambiguities were found by the reviewers, and were not detected by the analysts."」手法：録音を第三者が聞いて曖昧さに印を付け、「自分が聞き手なら聞いたはずの質問」を挙げ、**次の面談で使う**。（予備の探索で、実験は進行中と書かれている）

### 6.4 使えるか〔考察〕
- チャットの記録は、**文字の全文記録**なので、第三者（別のエージェント）が後から読んで曖昧さと聞き漏らしを拾う設計（Interview Review）が、そのまま使える。ただし、サブエージェントはユーザーに質問できないので（00-context）、拾った質問は主のエージェントが次に聞く。上の実験は少人数の予備結果で、チャット・AI では未検証。

---

## 7. 聞き終える判断（担当6）【途中】

### 7.1 飽和
- Guest, Bunce, & Johnson (2006). *Field Methods* 18(1): 59–82. DOI 10.1177/1525822X05279903【未読。Guest ほか 2020 の要約による】：「"70% of all 114 identified themes turned up in the first six interviews, and 92% were identified within the first 12 interviews"」（西アフリカの女性60人）。
- Guest, Namey, & Chen (2020). *PLOS ONE* 15(5): e0232076. https://pmc.ncbi.nlm.nih.gov/articles/PMC7200005/ 【一次】：飽和を「基準の大きさ（base size）・連続の長さ（run length）・新しい情報の割合（threshold）」で決める。基準は4〜6件、連続は2〜3件、新情報は ≤5% か 0%。「typically 6–7 interviews will capture the majority of themes in a homogenous sample」。「"there is no guarantee that saturation is in fact reached"」。
- Francis ほか (2010). *Psychology & Health* 25(10): 1229–1245. https://openaccess.city.ac.uk/id/eprint/1732/1/What%20is%20an%20adequate%20sample%20size.pdf 【一次】：**理論（あらかじめ決めた構成概念）に基づく**インタビューの研究向け。「initial analysis sample of 10」「stopping criterion of 3」（その後、連続3件で新しい考えが出ない）。
- Hennink, Kaiser, & Marconi (2017). *Qual Health Res* 27(4): 591–608. DOI 10.1177/1049732316665344【抄録の要約のみ】：25件で、コード飽和は9件、**意味の飽和は16〜24件**（「"heard it all"」と「"understand it all"」は別）。
- Weller ほか（2018）（§4.6）：項目の**目立ち具合（salience）**で飽和を考える。
- 限界（事実）：上はすべて**複数の参加者**をまたぐ数。1人への聞き取りで、いつ聞き終えるか、の研究は**見つからなかった**。

### 7.2 1人への聞き取りで網羅を確かめる（事実）
- Wiegers (2013-06-10)「When Are the Requirements Done?」（*Software Requirements* 2nd ed. から）【二次・著者は SWEBOK V4 の主要参照の著者】https://www.jamasoftware.com/blog/when-are-the-requirements-done/ ：収穫逓減のしるし：「"If the users can't think of any more use cases or user stories, perhaps you're done."」「"If users repeat issues that they already covered in previous discussions, perhaps you're done."」新しい案がすべて範囲外・低優先・「いつか」。確かめ方：機能領域のチェックリスト（「"If you don't find gaps, perhaps you're done."」）、CRUDL の表。「"good enough"」「analysis paralysis を避ける」。
- Beatty & Wiegers「Revealing Invisible Requirements」（*Software Requirements* 3rd ed. から）【二次】https://modernanalyst.com/Resources/Articles/tabid/115/ID/2929/Revealing-Invisible-Requirements.aspx ：「"Ask, 'What are we assuming?' during elicitation sessions to try to surface those hidden thoughts."」「"'Else' conditions frequently are overlooked."」「"Check boundary values for missing requirements."」「"Represent complex logic by using decision tables or decision trees to cover all the possible situations."」「"Create a checklist of common functional areas to consider for your projects."」「"Ask context-free questions, high-level and open-ended questions"」（Gause & Weinberg 1989 を引く）。
- Example Mapping（Wynne, 2015-12-08）【二次・公式ブログ】https://cucumber.io/blog/bdd/example-mapping-introduction/ ：答えが出ない質問は「red card」に取り、先に進む：「"simply capture the question and move on."」「"A table covered in red (question) cards tells us that we still have a lot to learn about this story."」約25分。
- ACTA：数人のあと、効く探りが分かる（§2.2）。Stanik：3人のあと、重なる探りをやめた（§2.7）。
- 〔考察〕**1人への聞き取りの終わりの物差し**の候補：(a)10項目（REQ-015）の埋まり具合、(b)直近の連続k個の探りで「新しい決まり」が出なかった（Guest 2020 の run length の形を、1人の中の探りに当てる。**閾値は検証されていない**）、(c)追加が範囲外・優先度の低いものに偏った（Wiegers）、(d)答えが保留の質問の一覧（red card）が、聞くべきものと、聞かなくてよいものに分けられた。

### 7.3 長さと疲れ（事実）
| 資料 | 数字 |
| --- | --- |
| ACTA（対面） | 3つの聞き取りを1人に **約3時間**。ナレッジ監査は最大約2時間（Gore & McAndrew）。 |
| Stanik（ビデオ） | ナレッジ監査 1人 **45〜60分** |
| Berlin & Praetorius | 52分〜1時間42分（ACTA 全体） |
| CDM（Plant & Stanton） | 30〜60分。完全な CDM は専門家 **6人以上** |
| Hutchins ほか | 初回 約1.5時間＋追いの面談 |
| Reynolds & Gutman（二次） | 60〜75分で梯子5〜10本 |
| NN/g contextual inquiry | 1回2〜3時間、複数回に分ける |
| **Opdenakker (2006)**（チャット） | 「"To have a good and in-depth interview by MSN messenger takes about double the time of a FtF interview (MARKHAM, 2004). Meanwhile the concentration of the interviewer and the interviewee can decrease, with negative consequences for the quality of the interview. A possible solution is to have several MSN messengers sessions with the interviewee."」 |
- Krosnick (1999)：疲れると、**弱い satisficing**（努力を減らす）が早く出る。「"Other respondents may … become increasingly fatigued and distracted as a questionnaire progresses."」同意しやすさは疲れたあと、難しい質問で増える（§5.2）。
- 【二次】Galesic & Bosnjak (2009), *Public Opinion Quarterly* 73(2): 349–360（本文未読）：長い質問紙ほど、後ろの質問の回答が速く・短く・均一になる、と紹介されている（Angus Reid の白書による。閉じた質問が中心のウェブ調査）。
- 〔考察〕数十往復は、チャットでは**対面の1時間前後**に当たる（Opdenakker の2倍を使った**私の目安**）。ACTA 全体（約3時間）は入らない。**回を分ける**（Opdenakker、Hutchins、Stanik）、**1回目のあとに記録を読んで分からない語に印を付け、次に聞く**（Stanik の Lesson 2）の2つが、人の側の根拠。

---

## 8. 知識の書き方と、合否の基準への変え方（担当7）【途中】

### 8.1 ACTA・CDM の表（§2、§3）
- ナレッジ監査の表：「Aspects of Expertise」「Cues and Strategies」「Why Difficult?」。認知要求の表：「difficult cognitive elements, why difficult, common errors, and cues and strategies used」。模擬の聞き取り：Actions／Situation Assessment／Critical Cues／Potential Errors の5列。Klein（2020 メモ）：CDM から「Critical Cue Inventory」（見つかった**手がかり**の一覧）と「Situation Awareness Record」（事例ごとの手がかりと目標の変化）。
- 〔考察〕**判断の手がかり（cue）と、例外・誤り**を、決まりと並べて残す形。

### 8.2 測れる形にする
- 下向き laddering（§4.1）：「cluttered」→「more than about half a dozen」。
- SWEBOK V4（§1.5）：「testable (quantified)」「boundary conditions, exception conditions」。

### 8.3 決定表
- 【一次】OMG, *Decision Model and Notation (DMN) v1.5*, formal/24-01-01, January 2024. https://www.omg.org/spec/DMN/1.5/PDF ：「"a complete table contains all possible combinations of input values (all the rules)."」「"input values SHOULD be exclusive and complete. Exclusive means that input values are disjoint. Complete means that all relevant input values from the domain are present."」例：「"the following two input value ranges overlap: <5, <10. The following two ranges are incomplete: <5, >5."」（=5 が抜ける）。重なるときは hit policy（Unique が既定）で決める。
- 〔考察〕専門家の言う条件を、**重なりと漏れ（境界、「それ以外」）**で点検する型。Wiegers の「else」「境界値」と同じ。

### 8.4 事例と例外で足す（Ripple Down Rules）
- 【一次】Richards, D. (2009). Two decades of Ripple Down Rules research. *The Knowledge Engineering Review*, 24(2): 159–184. https://www.maxapress.com/data/article/ker/preview/pdf/S0269888909000241.pdf ：「"experts never explain how they reach a conclusion, rather they justify that a conclusion is correct, and provide this justification in a particular context (Compton & Jansen, 1988, 1990)."」「"RDR uses a failure-driven approach to KA, where knowledge found to be incorrect by the domain expert, is patched locally within the context of the case on hand at the point where the knowledge was in error."」過去に直した事例（cornerstone cases）を保存し、直すたびに照合する。「"requiring that the classification of the new case distinguish it from the system's classification and be justified by features of the new case."」
- 〔考察〕**生成プラグインの出力が間違った事例を見せ、「どこが違うか」を言ってもらい、その事例を EVAL の課題にする**流れの人の側の根拠（EVAL との接続は設計6の担当に委ねる）。

### 8.5 例による確認（Example Mapping）
- ルール（青）、例（緑）、答えが出ない質問（赤）（§7.2）。ルールに例が付かなければ、ルールが分かっていない。

### 8.6 公式と実際、手がかりの妥当性
- 【一次】Hoffman (2005) Documentation Analysis：「"Practitioners possess knowledge and strategies that do not appear in the documents and task descriptions and, in some cases at least, could not possibly be documented."」「"all practitioners who work in complex sociotechnical contexts possess knowledge and reasoning strategies that are not captured in existing procedures or documents, many of which represent (naughty) departures from what those experts are supposed to do or to believe"」。また、専門家に基本を聞いて時間を使わないために、先に文書を読む：「"To take up the expert's time by asking questions such as 'What is limestone?' would have made no sense."」
- 【一次】Kahneman & Klein (2009). Conditions for intuitive expertise: A failure to disagree. *American Psychologist* 64(6): 515–526. DOI 10.1037/a0016755（読んだ本文：https://dl1.cuni.cz/mod/resource/view.php?id=153128 。権利関係は未確認の写し）：「"Subjective experience is not a reliable indicator of judgment accuracy."」直観が信頼できるのは、環境に妥当な手がかりがあり、学ぶ機会があったとき。
- 〔考察〕専門家の言う手がかりが**正しい**かは、聞き取りだけでは確かめられない。EVAL（実際の事例）で確かめる前提にする。

### 8.7 使えるか〔考察〕
- ユーザーの言葉を残す理由：Freeman の言葉のずれ、Stanik の「分からない語に印」。復唱は「言い直し＋直してもらう」（§4.2）。

---

## 9. チャットの文字だけを扱った研究（担当3 の補足）【途中】

- Opdenakker (2006) *FQS* 7(4), Art. 11【一次】https://qualitative-research.net/index.php/fqs/article/download/175/392/489 ：チャット（MSN）は、時間は同時、場所は離れる。**社会的な手がかりがない**（絵文字で補うが、文化で意味が違う）。「記録がそのまま取れ、書き起こしが要らない」が、「**メモを取らなくなる危険**」。「"terminating an interview in MSN messenger can be more difficult, because it can seem very abrupt."」「"may be more suitable for people who type fast"」。匿名性で自己開示が増えうる（Bampton & Cowton 2002 などを引く）。
- Dimond, Fiesler, DiSalvo, Pelc, & Bruckman (2012). *Proc. ACM GROUP '12*, 277–280. DOI 10.1145/2389176.2389218【抄録のみ】https://dl.eusset.eu/items/9ead8225-6650-42d9-9258-c9266b40cb14/full ：「"Although phone interviews contain four times as many words on average as email and IM, we were surprised to discover that there is no significant difference in number of unique qualitative codes expressed between phone and IM."」
- Xiao ほか (2020). *ACM TOCHI* 27(3), Article 15. DOI 10.1145/3381804【一次】https://arxiv.org/pdf/1905.10700 ：約600人、半分は Qualtrics、半分は**探りを入れる AI チャット**。「"the chatbot drove a significantly higher level of participant engagement and elicited significantly better quality responses … in terms of their informativeness, relevance, specificity, and clarity."」情報量はチャットが Qualtrics より 39% 多い（283 対 204 bits）。応答の長さ 90 対 64 語。チャットの技：応答への反応、「"I'd love to hear more. Go on..."」、探り「"Why do you like to read?"」、「分からない」への対応「"No worries, just share what's on your mind."」。調査は自由記述の質問紙の領域で、仕事のナレッジの聞き取りではない。
- Ahmad (2021) 博士論文【一次・参考】https://eprints.hud.ac.uk/35469/1/FINAL%20THESIS%20-%20Ahmad%2C%20Nauman.pdf ：被験者120人（4群×30）。インタビューの**前に議題をチャット・メール・音声で話し合う**と、暗黙の知識の引き出しの評価が上がった。「効果の高さ」の順：Hybrid（音声＋メール＋チャット）＞チャット＞メール＞音声。**効果の測定は主に質問紙の評価**で、小さなウェブサイトの開発という設定（弱い根拠。SWEBOK V4 が追加の読み物に挙げた）。
- Stanik ほか（§2.7）：全部オンライン、メールの往復で「"give both parties enough time to reflect on the diagram and to ensure a common understanding."」
- 〔考察〕チャットは、**語数は減るが論点の数は保たれうる**（Dimond）。聞き手が**探りを入れる**と質が上がる（Xiao）。一方、**メモを取らない危険**（Opdenakker）は、クリエイターでは「決まったことの一覧」を画面に出すこと（REQ-043）で埋められる。

---

## 10. 考察（私の考え。事実ではない）【途中】

1. **ACTA のナレッジ監査と、「実際の1回」（Hoffman の Recent Case Walkthrough／CDM）の組み合わせが、条件（チャット・1人・数十往復）に最も合う。** 根拠：§2.8、§3.6。単独の具体的な質問で、文字で出せ、時間が短い。
2. **聞き手の位置に「経験の浅い人＝生成プラグインの AI」を置くと、ACTA の「なぜ難しいか」「ありがちな誤り」が、そのまま「AI が間違えやすいところ」になる。** ACTA 自身の用法ではない。
3. **確認の質問の形が、品質を左右する。** はい/いいえの確認は同意に傾く（Krosnick、AHRQ）。「言い直し＋直し」「反対の主張との選択」「当てはまらないとき」を聞く。ただし、これらの形で、同意に傾く度合いが下がるかは、**チャットでは未検証**（EVAL で測れる）。
4. **「表向き」と「実際」の差を拾う。** ファイルを先に読み（Hoffman）、実際の1回の時系列と示された決まりを照らし合わせ、外れたところを聞く（Sherlock & Rugg、Hoffman）。
5. **合否の基準は、あいまいな言葉を下に1〜5段たどって測れる形にし（Sherlock & Rugg）、条件は漏れと重なりを点検し（DMN、Wiegers）、事例と例外で足す（RDR）。** 例外の聞き方：「それが当てはまらなかったのはいつですか」。
6. **全部は入らないので、選ぶ。** 3〜4個の探り×1〜2個の判断が要る段階（§2.8）。残りは回を分ける（Opdenakker、Hutchins）か、「保留の質問」の一覧にする（Example Mapping）。
7. **聞き手が気づけない誤解が最も危険**（Ferrari 2016）。第三者の目（Interview Review）か、区切りごとの復唱で埋める。
8. **聞き終えの物差し**は、人の側の研究がない。候補（§7.2）を、外側の EVAL（user-simulation）で試すのが筋（要検証）。

---

## 11. 設計で決めること 1〜11 への対応表（暫定）

| 設計で決めること | 効く情報（節） | 確信度 |
| --- | --- | --- |
| 1 対話の段階と順番 | ACTA の順（§2）、Hoffman の順：文書→最近の1件→ナレッジ監査（§8.6）、Bano の順の誤り（§6.1）、Pew の順序の影響（§5.7）、CDM の掃引（§3） | 中 |
| 2 質問の形（選択肢／自由回答、1つ／複数、推奨、理由） | Krosnick：閉じた質問は答えを閉じ込める、同意は約10%（§5.1、5.2）／Pew：1度に1つ、代案を並べる（§5.3）／ACTA：各探りに説明を付けると具体的になる（§2.6）／推奨を示すことの影響の直接研究は**なし**（誘導：Loftus） | 中（推奨の示し方は低） |
| 3 あいまいな答えの見分けと聞き直し | Ferrari（§6.2、6.3）、下向き laddering（§4.1）、5-whys（§1.5）、ACTA の「混乱は聞き違いの合図」（§2.4）、Xiao の「分からない」への対応（§9）、Bano のあいまいな質問（§6.1） | 中 |
| 4 聞き漏らし・聞き終え・疲れ・質問数 | §7（飽和は複数人の数字。1人の研究はなし）、Wiegers、Opdenakker、ACTA の時間 | 低〜中 |
| 5 ナレッジの残し方 | §8（ACTA の表、決定表、RDR、Example Mapping、測れる形）、Freeman の言葉のずれ（§3.4）、Stanik の書き起こしと印（§2.7） | 中 |
| 6 長い対話の状態の保ち方 | 直接の根拠は少ない：回を分ける（Opdenakker、Hutchins）、時系列を外の記憶にする（Freeman）、記録を読んで印を付ける（Stanik） | 低 |
| 7 ファイルを読んで決まりを推し量る | Hoffman の文書の分析（§8.6）、「表向き」（§4.1、8.6）、action protocol（§4.3）、はい/いいえの確認の危険（§5.2）、Ferrari の例5.2（§6.2） | 中 |
| 8 仕事の分け方 | Interview Review：第三者が記録を読む（§6.3）、Stanik：記録係の交代（§2.7）。人の側の根拠は薄い | 低 |
| 9 分かりやすい伝え方 | ACTA：日常語と説明（§2.6）、Bano：専門的な質問・共通の語彙（§6.1）、Pew：簡単で具体的な言葉 | 中 |
| 10 どの質問が効いたかの記録 | ACTA：数人のあと効く探りが分かる（§2.2）、Stanik：重なる探りをやめた（§2.7）、Bano：失敗の一覧をチェックリストに（§6.1）、Guest 2020：探りごとの「新しい情報」を数える（§7.1） | 中 |
| 11 低コスト・様々なモデルで手順が守られる書き方 | 人の側の根拠は薄い。ACTA は、短い手引き（job aid）で新人の聞き手が実施できたが、構造のない聞き取りとの成果の差は小さかった（§2.6）→ 手順を**少なく・単純に**した改良（探りを減らす、視点の切り替え1回）が参考 | 低 |

全体の確信度：**§1〜§3、§6 は高**（本文を読んだ）。**§4〜§5 は中**（主要な事実は読んだが、原典を読めていない手法が多い）。**§7〜§9 は中〜低**（1人・チャットの研究がない）。**§10 は考察で、検証が要る。**

---

## 12. 未読・探した場所・再開のチェックリスト

### 12.1 読めなかったもの（探した場所と結果）
- DTIC（apps.dtic.mil）：「The request is blocked.」（ADA335225、AD1107100、ADA467484）。archive.org の `DTIC_*` で代替。
- UWE リポジトリ（Militello & Hutton 1998 の公開版）：Cloudflare の確認画面で 403。ResearchGate：403。
- Southampton eprints（Shadbolt、Hoffman ほか）：403。IEEE Xplore／SAGE／Springer：有料で本文なし。
- OpenAlex／Semantic Scholar の API：回数制限（429）で使えなかった。Royal Holloway：TLS エラーと 503（証明書の確認は無効にしていない）。
- *Working Minds*（archive.org）：貸出のみ（401）。

### 12.2 再開のチェックリスト（新しく開くもの）
- [ ] Militello & Hutton (1998) *Ergonomics* 41(11): 1618–1641 の本文（探りの文言が 1997 報告書と違うか）
- [ ] Klein, Calderwood, & MacGregor (1989) の CDM の手順と探りの表。Hoffman, Crandall, & Shadbolt (1998)。Crandall, Klein, & Hoffman (2006) の CDM の章
- [ ] Flanagan (1954) *Psychological Bulletin* 51(4)（最近の出来事を使う理由、記憶の扱い）
- [ ] Reynolds & Gutman (1988) の本文。Rugg & McGeorge (1995) *Expert Systems* 12(4)「Laddering」。Rugg & McGeorge (2005) の sorting のチュートリアル
- [ ] Cooke (1994)。Shadbolt & Smart (2015)。Hoffman ほか (1995) の本文（手法ごとの効率）
- [ ] Davis ほか (2006) RE'06 の原文。Dieste & Juristo (2011) *IEEE TSE*
- [ ] Guest ほか (2006) の本文。Hennink ほか (2017) の本文。Hennink & Kaiser (2022) の系統的レビュー
- [ ] Wiegers & Beatty (2013) 第7章「How do you know when you're done?」「Finding missing requirements」の本文
- [ ] Sutcliffe & Sawyer (2013) RE'13 の論文。Gervasi ほか (2013)。Maiden & Rugg (1996) ACRE
- [ ] Beyer & Holtzblatt の contextual inquiry の原典
- [ ] Rogers & Farson (1957) *Active Listening*（要約・言い換え）
- [ ] Fisher & Geiselman の cognitive interview。Memon ほか (2010) の本文
- [ ] Galesic & Bosnjak (2009) の本文（長さと回答の質）
- [ ] 1人に対する聞き取りでの「聞き終え」の研究（探したが見つからなかった。「single informant saturation」「free-list stopping」などで再検索）
- [ ] チャット・AI が聞き手の聞き取りの研究（担当 C が扱う。Xiao ほか 2020 以外）

### 12.3 ナレッジへの反映（提案。この調査では変更しない）
- `.claude/memory/knowledge-elicitation.md` の「V3 では5つ」を、「V3 は7項目（User stories と Other を含む）。V4 は一覧が異なる（§1.4）」に直す。

---

## 13. 出典一覧（アクセス日はすべて 2026-10-20）

SWEBOK v4.0a https://ieeecs-media.computer.org/media/education/swebok/swebok-v4.pdf ／ v4.0 https://mycourses.aalto.fi/pluginfile.php/2367766/mod_resource/content/3/swebok-v4.pdf ／ v3.0 https://ieeecs-media.computer.org/media/education/swebok/swebok-v3.pdf ／ ACTA TN-98-4 https://archive.org/details/DTIC_ADA335225 ／ Hoffman 2005 https://archive.org/details/DTIC_ADA475456 ／ Hutchins 2004 https://archive.org/details/DTIC_ADA466054 ／ Freeman 1991 https://archive.org/details/ERIC_ED334223 ／ Klein 2020 メモ https://www.gary-klein.com/_files/ugd/2360d8_e98ff384865a4f7b856ed49e4a82e6d7.pdf ／ Plant & Stanton https://openaccess-api.cms-conferences.org/articles/download/978-1-4951-2097-8_1 ／ Stanik https://arxiv.org/pdf/2108.05622 ／ Berlin & Praetorius https://research.chalmers.se/publication/551049/file/551049_Fulltext.pdf ／ Gore & McAndrew https://www.bps.org.uk/psychologist/methods-accessing-expert-cognition ／ Leu & Abbass https://arxiv.org/pdf/1802.09669 ／ Bano https://par.nsf.gov/servlets/purl/10105611 ／ Ferrari 2016 https://openportal.isti.cnr.it/data/2016/353983/2016_353983.postprint.pdf ／ Ferrari 2017 https://par.nsf.gov/servlets/purl/10061986 ／ Dieste 2008 https://www.inf.puc-rio.br/wer/WERpapers/artigos/artigos_WER08/dieste.pdf ／ Sutcliffe & Sawyer スライド https://www.cin.ufpe.br/~in1020/docs/aulas/IN1020_aula28.pdf ／ Sherlock & Rugg https://ppig.org/files/2003-PPIG-15th-sherlock.pdf ／ Torres ほか https://arxiv.org/pdf/1607.07796 ／ van Someren ほか https://pure.uva.nl/ws/files/716505/149552_Think_aloud_method.pdf ／ Nisbett & Wilson https://web.math.princeton.edu/~sswang/literature_general_unsorted/Nisbett-Wilson-PsychologicalReview1977.pdf ／ Loftus & Palmer https://www.gwern.net/doc/psychology/cognitive-bias/1974-loftus.pdf ／ Krosnick https://web.stanford.edu/dept/communication/faculty/krosnick/docs/1999/1999%20AnnRevSurvey.pdf ／ Pew https://www.pewresearch.org/our-methods/u-s-surveys/writing-survey-questions/ ／ AHRQ https://www.ahrq.gov/health-literacy/improve/precautions/tool5.html ／ Guest 2020 https://pmc.ncbi.nlm.nih.gov/articles/PMC7200005/ ／ Francis https://openaccess.city.ac.uk/id/eprint/1732/1/What%20is%20an%20adequate%20sample%20size.pdf ／ Weller https://pmc.ncbi.nlm.nih.gov/articles/PMC6010234/ ／ Borgatti http://www.analytictech.com/mb870/Readings/elicitation.pdf ／ Shaw & Gaines https://gaines.library.uvic.ca/pdf/KAW86M.pdf ／ Wiegers https://www.jamasoftware.com/blog/when-are-the-requirements-done/ ／ Beatty & Wiegers https://modernanalyst.com/Resources/Articles/tabid/115/ID/2929/Revealing-Invisible-Requirements.aspx ／ Wynne https://cucumber.io/blog/bdd/example-mapping-introduction/ ／ DMN 1.5 https://www.omg.org/spec/DMN/1.5/PDF ／ Richards https://www.maxapress.com/data/article/ker/preview/pdf/S0269888909000241.pdf ／ Kahneman & Klein https://dl1.cuni.cz/mod/resource/view.php?id=153128 ／ Opdenakker https://qualitative-research.net/index.php/fqs/article/download/175/392/489 ／ Dimond https://dl.eusset.eu/items/9ead8225-6650-42d9-9258-c9266b40cb14/full ／ Xiao https://arxiv.org/pdf/1905.10700 ／ Ahmad https://eprints.hud.ac.uk/35469/1/FINAL%20THESIS%20-%20Ahmad%2C%20Nauman.pdf ／ NN/g（contextual inquiry、remote、CIT）https://www.nngroup.com/articles/contextual-inquiry/ 、https://www.nngroup.com/articles/remote-contextual-inquiry/ 、https://www.nngroup.com/articles/critical-incident-technique/ ／ Burton 1990、Hoffman 1995（Bond 大学の記録）上記 ／ Wikipedia repertory grid https://en.wikipedia.org/wiki/Repertory_grid ／ Mom Test の書評 https://mtlynch.io/book-reports/the-mom-test/
