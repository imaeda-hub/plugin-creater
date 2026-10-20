
## 11. 進み具合（確定／途中／未着手）と、再開用のチェックリスト

打ち切りの指示（コーディネーター、クレジットの残りわずか）を受けて、2026-10-20 に、ここまでをまとめた。新しい資料は、この指示の後には開いていない。

### 11.1 担当項目ごとの状態

| 担当項目（指示書の 1〜6） | 状態 | 内容 |
| --- | --- | --- |
| 1 要求引き出しのインタビュー（LLMREI、Elicitron、追いの質問、RE 2024〜26） | **確定**（主要部分）／途中（周辺） | LLMREI、Shen ほか、ReqElicitGym、OntoAgent、ASK、Data Therapist、音声の経験報告は本文を読んだ。Mircea ほか、Lojo ほか、Elicitron は一部本文。LENS は抄録と冒頭のみ。「インタビューの誤りを LLM で見つける」研究は、Shen の誤りの型の判定（LLM と人間が 81.0% 一致）を確認したのみで、独立した論文は探していない（途中） |
| 2 AI が行う質的インタビュー（Anthropic Interviewer、Geiecke & Jaravel、会話型アンケート、評価研究） | **確定**（主要部分）／途中（プロンプト原文の収集） | Anthropic（ブログ、81k の付録、書き起こし 1,250 件の集計）、Geiecke、Chopra、Wuttke、Cuevas、Barari、SparkMe、Xiao（古い）は確認済み。**Anthropic のシステムプロンプトは非公開**（確認済み）。未取得のプロンプト：LLMREI-long の全文、Geiecke の B.2〜B.5 とコード、Chopra の他エージェントのプロンプト、SparkMe のプロンプト（付録 B） |
| 3 確認の質問（いつ聞き、どう聞くか） | **確定**（Ambig-SWE、Ask or Assume、Ask Less、IN3）／途中（そのほか） | RegretBench と Value of Information は冒頭のみ。**CLARITI（arXiv:2604.14624）、Uncertainty-Aware Clarification（arXiv:2606.03135）、Tri-Agent（arXiv:2609.02054）は PDF を取得したが読んでいない（未着手）**。CLAM、ClarifyGPT、STaR-GATE、Zhang ほかは抄録と冒頭（いずれも訓練が前提で、クリエイターには使えない） |
| 4 LLM の聞き手に特有の失敗と対策 | **確定**（横断の表）／途中（迎合） | 表は節 5。迎合：Sharma、ELEPHANT、Braun は抄録と冒頭。**聞き手の迎合を直接測った研究は見つからなかった**（途中のまま。探した語は節 8）。長い会話：Laban は本文、Li ほかと MultiChallenge は一部 |
| 5 知識の引き出しを支える構造（網羅の確認、段階、メモ） | **途中** | 網羅の骨組み（OntoAgent）、その場のメモ（SparkMe）、記録係と点検係（ASK）、質問を出す前の見直し（Ask Less）は確認済み。ただし**メモや要約の効果を単独で比べた実験は見つからなかった**。GuideLLM は一部のみ。専門家の暗黙知（Cho ほか）は草稿で、1 つの領域 |
| 6 評価のしかた | **確定**（一覧は節 3.7） | 人の評価、網羅率、模擬ユーザー、質の指標の 4 系統を整理した。模擬ユーザーの検証例は ReqElicitGym（κ=0.73）のみ |
| 公開された実践の収集（プロンプト原文） | **確定**（原文取得済み）／途中（版の日付） | spec-kit、superpowers、OpenAI Cookbook、Anthropic skill-creator を原文で取得（付録 H）。GitHub のコミット日付は 403 で取得できず、main の取得日だけを記録 |
| 設計で決めること 1〜11 との対応表 | **確定**（節 10）。ただし根拠が「途中」の項目は確信度に反映 | 7（ファイルを読んで推し量る）と 9（分かりやすい伝え方）は根拠が薄い（確信度：低〜中） |

### 11.2 再開用のチェックリスト（これから開く資料）

優先度が高い順。「取得済み」は、`scratchpad/papers/` に PDF とテキストがあるもの。

1. **取得済みで未読（確認の質問の最新研究）**：`cliariti.raw.txt`（arXiv:2604.14624、質問数を 41% 減らしたとする報告。数字は検索結果の要約のみで、本文未確認）、`uncert_info_gain.raw.txt`（arXiv:2606.03135）、`triagent.raw.txt`（arXiv:2609.02054）。確認したいこと：質問を出すかどうかの基準、質問数、ユーザー役の作り方。
2. **取得済みで一部しか読んでいない**：`regretbench.raw.txt`（停止の判断と人格の頑健性の結果の表）、`voi_clarify.raw.txt`（Value of Information の実験の数字）、`chat_to_interview.raw.txt`（OntoAgent の表 III アブレーションの数字、人間評価）、`guidellm.raw.txt`、`newsinterview.raw.txt`（情報の引き出しの指標の定義）。
3. **プロンプト原文（未取得）**：LLMREI-long の全文（Zenodo、doi 10.5281/zenodo.14988928）、Geiecke のリポジトリ（`friedrichgeiecke/interviews`）、Chopra & Haaland のリポジトリ（論文の D.1 節にある URL）、SparkMe のプロンプト（`SALT-NLP/SparkMe`）。`raw.githubusercontent.com` は取得できたが、`api.github.com` と `github.com` は 403。リポジトリの場所は、各論文の記載から確認する。
4. **二次情報のままの原典**：Kuks ほか（2025、Industry 4.0 Science 41(6)、ASK の論文経由）、MimiTalk（Liu & Yu 2025）、StorySage（Talaei ほか 2025）、Guven ほか（2025、OSF）、Jabarian & Henkel（2025、音声の AI 面接）、Shaikh ほか 2023（RLHF が追いの質問を減らす、STaR-GATE の引用経由）、Kamoi ほか 2024（LLM の誤り検出の再現率、Chopra の引用経由）。
5. **未検証の主張**：ELEPHANT の ICLR 2026 採択（Microsoft Research のページの記述、二次）、Barari の CORRECTION 後の版との数字の一致、Mircea ほかの REFSQ 2026 掲載（Springer の記載、二次）、Elicitron の掲載誌（JCISE とする二次情報あり）、STaR-GATE の COLM 2024 採択（本文では確認できず）、MultiChallenge リーダーボードの順位と分野別の得点。
6. **見つからなかったことの再探索**：(a) 聞き手の迎合を測った研究（別の語：「agreeableness」「validation」「echoing」「interviewer bias」）、(b) 質問の理由を添える効果、(c) 長い会話の圧縮（要約・コンパクション）で、聞き取りの手順や途中の結果が消えるかを調べた研究、(d) 人から作業の手順を聞き取って AI のスキルにする研究（別の語：「procedural knowledge elicitation」「SOP elicitation」「workflow extraction from interview」）、(e) 聞き取りの最中のメモの効果の単独比較。
7. **クリエイター固有の検証（文献ではなく試験が要る）**：確認の質問の形（「〜という決まりですか？」だけ、反例も聞く、候補を 2 つ見せる）の違いが、模擬ユーザーでなく人間でどう出るか。質問数の目安。聞き直しの回数の上限。終了の合図の出し方。
8. **既存のナレッジへの反映案（提案のみ。この調査では書き換えていない）**：`user-simulation.md` に、(1) ReqElicitGym の模擬ユーザー（κ=0.73）、(2) Braun の「LLM は『いいえ』に偏る」、(3) Ask Less の「聞かれたときだけ明かす」の 3 点を足す余地。`knowledge-elicitation.md` に、Barari の「はい」への偏りと、Geiecke の 6 原則の要約を足す余地。

### 11.3 作業用ファイルの場所

- 本ファイル：`/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/C-llm-interviewer.md`
- 論文の PDF とテキスト：`/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/papers/`（`*.pdf`、`*.raw.txt`、`*.txt`）
- 公開プロンプトの原ファイル：`.../scratchpad/papers/prompts/`（`speckit_clarify.md`、`sp_brainstorming.md`、`skillcreator.md`、`oai_dr.ipynb`）
- Anthropic の書き起こし 1,250 件（JSON）：`.../scratchpad/papers/hf/`、集計スクリプトと出力：`.../scratchpad/research/tools/analyze_anthropic_interviewer.py`、`.../analyze_anthropic_interviewer.out`
