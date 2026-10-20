
## 10. 設計で決めること（1〜11）との対応表と確信度

確信度の基準：高＝複数の独立した研究で一致し、本文を確認した。中＝本文は確認したが、研究が 1〜2 件、または模擬ユーザーや小規模な評価に基づく。低＝ガイドラインの水準、類推、または査読前の単独の報告。

| 設計で決めること | 効く情報（節） | 要点 | 確信度 |
| --- | --- | --- | --- |
| 1 対話の段階と順番 | Anthropic の書き起こし（3.2.1）、Geiecke（3.2.2）、Chopra（3.2.3）、spec-kit・superpowers（3.6）、ASK（3.1.5）、SparkMe（3.2.7） | 定型の冒頭（目的、所要時間、正解はない、記録を取る）→最近の具体的な出来事→中心の質問は開かれた質問から→骨組みで網羅を点検→定型の終わり（ほかにないか、要点の確認）。部ごとに質問数の目安 | 中 |
| 2 質問の形 | LLMREI、Geiecke、Wuttke、ASK、Ask Less、IN3、GATE、Barari、spec-kit、superpowers（3.1〜3.3、4） | 1 回 1 問はモデルが守りにくい（同じ話題の絞り込みは許容されている例が多い）。聞き出しは開かれた質問、決定は推奨つきの選択肢、と分ける考え方が、食い違う公開例と矛盾しにくい。選択肢が誘導になる直接の実測は、はい／いいえの確認（Barari）のみ。質問の理由を添える効果は未検証 | 中（選択肢と推奨は低〜中） |
| 3 あいまいな答えの見分けと聞き直し | Chopra、Wuttke、Cuevas、ReqElicitGym、Ambig-SWE、Geiecke（3.1.3、3.2、3.3.1） | 不明確・矛盾・新しい概念を聞き返す、と明示すると見分ける。明示しないと追いを出さないことがある。「具体的な出来事」へ戻す。「分からない」への対応は公開例が割れている | 中 |
| 4 聞き漏らしの管理と、聞き終える判断 | ReqElicitGym、OntoAgent、SparkMe、ASK、Geiecke のコード、LLMREI、Anthropic 81k 付録（3.1、3.2） | 終了の判断はモデルごとに極端に違う（止まらない／早く止まる）。網羅の骨組み、質問数の上限、利用者が出せる終了の合図を手順に置く。10 分前後で離脱 9.7%、答えも短くなる。質問数の目安の数字は領域が違い、試験で決める | 中〜高（終了のばらつき）／低（質問数の数字） |
| 5 引き出したナレッジの残し方 | spec-kit、ASK、SparkMe、Chopra、Barari、Cuevas、Mircea、Wuttke、superpowers（3.1.5、3.2、3.6） | 答えを受けるたびに記録に書く。確認は「はい／いいえ」だけにせず、反例や具体例を足す。本人の原文と AI の言い換えを分けて残す。推測に印を付ける。要約を本人が何度でも直せる | 中 |
| 6 長い対話の状態の保ち方 | Laban、Li（古い）、MultiChallenge、音声の経験報告、Ask Less（3.5.1、3.1.7、3.3.3） | 会話の記憶に置くと、途中のターンが落ち、小型のモデルは繰り返す。外の記録を正とし、毎回見せ直す（Snowball は劣化の 15〜20% を軽減）。会話の圧縮で手順が消える問題そのものを調べた研究は見つからなかった | 高（問題の存在）／中（緩和の程度） |
| 7 ファイルを読んで決まりを推し量る | Ambig-SWE、Ask Less、Cho ほか、skill-creator、superpowers、Barari、GATE（3.3、3.4、3.6） | 読んで分かることは聞かない。本人の事例から LLM が規則を抽出するほうが、本人に語らせるより効く可能性。推測は「推測」と印を付け、確認は反例か具体例で。本人が書く規則と具体例への判断は食い違うことがある | 低〜中（類推を含む） |
| 8 仕事の分け方とモデル | Ask or Assume、ASK、Chopra、superpowers、SparkMe（3.1.5、3.2.3、3.3.2、3.6） | 足りなさの検出、記録の整理、網羅の点検は別の役に分けられる。ユーザーと話すのはメイン。ただし、分離の利点は主にモデルを替えたときの安定にある（Claude では質問を促すだけの基準と同等） | 中 |
| 9 分かりやすい伝え方 | spec-kit、superpowers、skill-creator、Shen の誤りの型（3.6、3.1.2） | 日常語、専門用語はその文で定義、質問の行だけで答えられる、相手の語彙に合わせる。効果を測った研究は見つからなかった | 低〜中 |
| 10 どの質問が効いたかの記録 | ReqElicitGym、Ask Less、Shen、Chopra、SparkMe（3.1.3、3.2、3.3） | 質問ごとに、型（開かれた／掘り下げ／聞き返し／確認／選択肢）、出た知識の項目（新規／部分／なし）、答えの長さ、本人が直したか、を記録する先例がある。LLM の判定役は人間と合わない場合がある（Cuevas）ので、一部は人間が確かめる | 中 |
| 11 安いモデル・様々なモデルでも守られる書き方 | Ambig-SWE、Ask or Assume、ReqElicitGym、Wuttke、Chopra、Shen、音声の経験報告、Geiecke（3.1〜3.3） | モデルによって、質問の頻度、終了、指示への従い方が大きく違う。終了、上限、質問の道具の使い方は手順と道具に埋め込む。規則を足すと別の行動が崩れるので、変更のたびに複数のモデルで検査する。肯定形、役割の表記、難しい規則への 1 例。強く促すと逆効果のモデルがある | 中 |
| （外側の EVAL、`testing.md` 6 章） | ReqElicitGym、Braun、Ask Less、RegretBench、Ask or Assume、Ambig-SWE（3.1.3、3.3、3.5.2） | 聞かれるまで話さない模擬ユーザーを実対話と照合した例（κ=0.73）。LLM のユーザー役は「はい」に偏らない（「いいえ」に偏る）ので、確認の質問の質は測れない。協力的すぎる問題は既存の知見と整合 | 中 |

この調査全体の限界：(1) 多くの評価が英語で、模擬ユーザー、または報酬を得る回答者（Prolific）による。(2) 引き出す対象が「意見」「好み」「要求」で、「作業の手順と決まり」ではない（ASK、Data Therapist、Cho ほかが近いが、小規模または草稿）。(3) モデルの世代がまちまち（GPT-3.5 から GPT-5.2、Claude Opus 4.5 まで）。(4) 査読前の論文（Ask Less、Ask or Assume の版、OntoAgent、Cho ほかなど）を含む。

---

# 付録：公開されたプロンプトと、評価環境の原文

- 英語の原文は原文のまま。日本語の説明は私が付けた。
- PDF から取り出したものは、段落の整形以外は変えていない。段落の途中の改行は取り除いた。
- A〜G は論文の本文または付録、H は公開リポジトリのファイル、J は公開された書き起こしの冒頭と終わり。
- 公開されている実物の全文は、`scratchpad/papers/` と `scratchpad/papers/prompts/` に保存した（作業用のコピーで、リポジトリには入れていない）。

### A-1. LLMREI-short（本文 III-A 節、3 文のプロンプト全文）

出典：Korn, Gorsch, Vogelsang, arXiv:2507.02564。

`````text
You are an interviewer, called LLMREI, who assists a requirements engineer in eliciting requirements. Bombard the stakeholder with questions about his/her business and his/her project to find out everything the stakeholder envisions! Act like a real-world interviewer, so only ask one question at a time or only ask two questions if it is about one specific topic.
`````

### A-2. LLMREI-long の抜粋（本文 III-B 節。著者が「面接の指針と誤りへの対処を除いた抜粋」と書くもの）

全文は再現パッケージ（doi 10.5281/zenodo.14988928）にあるが、未取得。

`````text
You are an interviewer, called LLMREI, who assists a requirements engineer in eliciting requirements.
Goal: The purpose of this chat bot is to conduct comprehensive and effective requirements elicitation interviews with stakeholders, ensuring all necessary information is gathered to support project development.
{Interview Cookbook}
Maintain professionalism throughout the interview. Adjust questions based on the stakeholder's role, education level, and domain knowledge. Adapt questioning style to fit the flow of the stakeholder's responses. Actively listen to differentiate between stated needs and actual needs. Let the customer create scenarios. Example: "Please visualize the first page of your application and explain how you would interact with it step-by-step."
`````

### E-1. IN3 / Mistral-Interact の会話の作り方（3.3 節。訓練用の会話を GPT-4 同士で作るときの規則）

出典：Qian et al., arXiv:2402.09205（ACL 2024）。

`````text
• Query with Options: For each round of conversation, we instruct the Assistant-GPT to provide thoughts and ask only one query with options. The inquiry is made based on the missing details and options listed in the initial thought. One query at a time makes model inquiries less pushy, while reasonable options provided can inspire the user's deeper thoughts and encourage explicit expression of implicit intentions. All of these serve to make the model's interaction more user-friendly.
• Diverse User Tones: For the user response in each round of conversation, we prompt User-GPT to imitate users with different tones, focusing mainly on succinct (assume users are lazy and provide short responses) and passionate (assume users provide long responses with new information) response patterns.
• Explicit Intention Summary: We instruct Assistant-GPT to explicitly summarize all user-provided intentions (both responses to inquiries and new information) in thoughts and provide a clearer version of user goal once it believes enough information is gathered.
`````

### E-2. ReqElicitGym：模擬ユーザー（oracle user）の設計原則とインタビュアーへの制約

出典：Jin et al., arXiv:2602.18306、3.3 節と 4.4 節。

`````text
The construction of the oracle user follows three key design principles. (1) Groundedness in Implicit Requirements. The oracle user must only reveal information that is explicitly annotated as implicit requirements in the evaluation dataset. Its responses are grounded in the predefined Implicit Req set of each scenario, ensuring that no information beyond the ground truth is introduced during the interaction. (2) Passive Response. The oracle user adopts a controlled and non-proactive interaction style to enable fair and discriminative evaluation. Specifically, it does not proactively volunteer additional requirement information unless explicitly asked by the interviewer. This design isolates the interviewer's contribution and more accurately reflects its ability to identify missing requirement dimensions and formulate effective questions. (3) Context Awareness. The oracle user conditions its responses on the full dialogue history, allowing it to maintain consistency across turns and avoid repeating previously disclosed information.

[interviewer prompt, 4.4] The system prompt explicitly constrains the model behavior: at each turn, the interviewer must either ask exactly one question to elicit missing requirements or terminate the interview by outputting a special finish signal. This design prevents the LLM from asking multiple questions within a single turn, thereby ensuring consistent turn granularity across different LLMs.
`````

### E-3. ASK の Knowledge Checker の採点基準と、節の確定の規則

出典：Roudiere & Lento、ECKM 2026、3.2.3 節と 3.2.4 節。

`````text
For each requirement, it assigns a score from 0 to 5 according to the following scale: 0 - not met at all, 1 - not met, 2 - almost met, 3 - barely met, 4 - met, and 5 - met beyond expectations.

If all requirements receive a score of 4 or 5, the section is considered validated, and the drafting process proceeds to the next section (or terminates if the last section has been completed). Otherwise, a requirement with a score of 3 or lower is selected, and the KC generates guidance for the Assistant to steer the next question toward addressing the unmet requirement.
`````

### J-1. Anthropic Interviewer の実際の発言（公開された書き起こし work_0000 から。システムプロンプトではない）

システムプロンプトは非公開。以下は、公開データ（Hugging Face、CC-BY、参加者が公開に同意）にある実際の発言で、インタビュアーがどう振る舞ったかの例。冒頭の発言は 1,250 件のうち 826 件が「Hi there! I'm Claude from Anthropic's research team. …」で始まり、全件に所要時間と「no right or wrong answers」の記述がある（私の集計）。

`````text
[開始]
Hi there! I'm Claude from Anthropic's research team. Thank you so much for taking the time to speak with me today.

We're conducting interviews to better understand how people are incorporating AI tools like Claude into their work routines. Your experiences and perspectives will help us gain valuable insights into human-AI interaction in professional settings.

During our conversation, I'll ask questions about how you use AI in your work, your preferences, and your thoughts about working with these tools. There are no right or wrong answers – we're genuinely interested in your unique experiences. This should take about 10 minutes.

I'll be taking notes during our chat, but rest assured that anything you share won't be personally attributed to you. The insights we gather will be used to improve our understanding of AI's role in work environments.

Does that sound good? Do you have any questions before we begin?

[最初の質問]
Great! Let's dive in.

Could you tell me about how AI fits into your typical workday? What kinds of tasks do you use it for?

[途中の発言の例：評価を含む受け止め＋言い直し＋主質問＋同じ話題の絞り込み]
That's really interesting - you're essentially using AI as a starting point and then applying your own judgment. I'm curious about your preferences when working with AI. Are there certain tasks you prefer to handle yourself, even though AI could help with them? What makes those tasks different?

[終わりの前]
Those are all the questions I had prepared. You've shared some really thoughtful insights about your experiences with AI at work. I particularly appreciated your perspective on using AI as a competitive tool when you need to catch up with colleagues, and how providing detailed personal context made such a difference in the strategy's effectiveness.

Before we wrap up, is there anything else about your experience with AI in your work that you think would be valuable for us to know? Something we haven't covered yet?

[終わり]
Perfect! Thank you again for your time and for sharing your experiences so openly. Your insights about using AI as a problem-solving tool when you're stuck, the importance of detailed context, and how workplace competition influences your AI usage will be incredibly helpful for our research on human-AI interaction in professional contexts.

I really appreciate you taking the time to speak with me today!
`````
