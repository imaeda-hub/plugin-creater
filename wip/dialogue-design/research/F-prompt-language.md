# F. 指示の言語（英語か日本語か）の調査

調査日: 2026-10-21。リポジトリ /home/user/plugin-creater は読むだけで、変更していない。

## 0. このメモの読み方

- 各項目は「分かったこと（事実）」「分からなかったこと」「考察（推測を含む）」の順に分けた。事実と考察は混ぜていない。
- 論文は、arXiv の本文（HTML）または ACL Anthology の PDF を取得し、本文の文字列で確かめた。表の数字も本文から読んだ。
- GitHub の Issue は、直接取得（curl）が 403 で拒否された。WebFetch の要約で得た内容なので、引用と数字は「要約経由で未検証」と書く。
- 各社の公式ドキュメントは、ページ全文を取得し、「multilingual」「same language」「respond in」などを検索して確かめた。見つからなかったものは「見つからなかった」と書く（存在しないとは言い切れない）。
- 記憶にあった論文名は、すべて arXiv のメタデータ（題名・提出日・要旨）を開いて実在を確かめた。

用語の注意: 研究の多くは「指示の言語」と「出力の言語」と「課題の言語」を分けずに比べている。日本語で書いた指示に日本語で答えさせる実験は、この3つが全部日本語になるので、指示の言語だけの効果は取り出せない。分けて比べた研究は、問1の Enomoto らと Cross-Lingual Prompt Steerability の2本だけだった。

---

## 問1. 指示を英語で書くか日本語で書くかで、指示の守られ方・複数段階の手順・ツールの使い方は変わるか

### 1-A. 分かったこと: 各社・各仕様の公式の指針

| 提供元 | 指示の言語について | 出典・日付 |
| --- | --- | --- |
| Anthropic | 「指示を何語で書くか」の推奨は見つからなかった。プロンプト作成の指針と Agent Skills の指針（どちらも全文を取得して検索）に、言語の推奨はない。多言語のページは「応答の言語を明示せよ」と言う（問2に記載） | https://platform.claude.com/docs/en/build-with-claude/multilingual-support ほか。取得日 2026-10-21。ページ内に更新日の表示なし |
| OpenAI | 見つからなかった。GPT-5 プロンプトガイド、GPT-4.1 プロンプトガイド、Prompt engineering ドキュメント、Model Spec（2025-12-18 版）を取得して検索し、指示の言語・応答の言語の推奨は0件 | https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide ほか。取得日 2026-10-21 |
| Google | 指示の言語の推奨は見つからなかった。応答の言語の推奨はある（問2に記載） | https://cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/system-instructions 。ページに「Last updated 2026-10-20 UTC」 |
| GitHub | Copilot CLI は英語が主な対象だと明記している。スキル・カスタム指示などのページには、指示の言語の推奨がない（7ページを取得して検索） | https://docs.github.com/en/copilot/responsible-use/copilot-cli 。取得日 2026-10-21。更新日の表示は確認できず |
| Agent Skills の仕様 | 自然言語の推奨なし（「対応言語」はスクリプト言語の話だけ） | https://agentskills.io/specification 。取得日 2026-10-21 |

GitHub の記述の原文（Copilot CLI の節）: "Copilot CLI uses a large language model to reason about tasks, generate code, modify files, and execute commands in your local terminal environment. The agent has been evaluated across a variety of programming languages. English is the primary supported language for prompts and responses."

Copilot Chat についても同様に "The primary supported language for GitHub Copilot Chat is English."（https://docs.github.com/en/copilot/responsible-use/chat-in-github ）とある。

Anthropic の Claude Code の公式ドキュメントにも、指示の言語の推奨は見つからなかった。ただし Claude Code には応答の言語を決める設定がある。更新履歴（https://code.claude.com/docs/llms-full.txt ）に "Added `language` setting to configure Claude's response language (e.g., language: "japanese")" とあり、版は 2.1.0。npm の公開日は 2026-01-07。設定のページ（https://code.claude.com/docs/en/settings ）の本文では、この項目を確認できなかった（更新履歴にだけ載っている）。

### 1-B. 分かったこと: 研究

#### (1) 指示の言語だけを変えて比べた研究（いちばん近い証拠）

**Enomoto, Kim, Chen, Komachi「A Fair Comparison without Translationese: English vs. Target-language Instructions for Multilingual LLMs」**（NAACL 2025 短報、2025-04-29〜05-04 の会議、pp.649-670）
https://aclanthology.org/2025.naacl-short.55 （PDF を取得して全文確認）

- 設計: 英語の指示と対象言語の指示を、同じ内容で、人手で自然な表現に直して作った。翻訳調（translationese）の偏りを除いている。日本語を含む7言語（de, es, fr, id, ja, ko, zh）を対象にした（課題によって言語の組は異なる）。モデルは小型の公開モデルで、suzume（Llama 3 8B 系）、Qwen2-Instruct 7B、Mistral-Nemo-Instruct 12B。
- 要旨の原文: "the advantage of adopting English instructions is not overwhelming"（先行研究は英語が有利と言ったが、翻訳調の偏りを除くと、英語の有利さは圧倒的ではない）。
- 課題の性能は、課題とラベルしだいで、英語・対象言語のどちらが良いかが変わった。レビューの分類では、ラベルの言語に合わせた指示が良い傾向。語彙の平易化（日本語を含む）は対象言語の指示が良い傾向で、読解は英語の指示が良い傾向。
- 指示の守られ方（5.2 節）の原文: "These results indicate that MLLMs follow English instructions more closely than target-language instructions. This observation suggests that using instructions in English is more effective for tasks requiring complex guidance."
  - 「指示に従わなかった割合」（表4、3モデルの平均値の一部）: 読解（MRC）で、suzume は英語の指示 45.57%、対象言語の指示 61.14%。Qwen2 は 37.49% 対 58.33%。Mistral-Nemo は 27.34% 対 46.90%。語彙の平易化では差が小さい（suzume 19.95% 対 23.54%、Qwen2 2.31% 対 2.97%、Mistral-Nemo 0.35% 対 0.91%）。数字は小さいほど指示を守っている。
  - 注意: 「従わなかった」の判定は、平易化は「単語を5語（日本語は7語）より多く出した」、読解は「参照文にない文字列を出した」。手順の多段階ではなく、出力形式の制約の遵守である。
- 同じ内容の指示でも、英語と対象言語では、生成文が約半分以上異なる（一致は suzume 約30%、Qwen2 約37%、Mistral-Nemo 約48%、読解）。つまり、指示の言語を変えると、同じモデルでも挙動がかなり変わる。

**Cross-Lingual Prompt Steerability**（arXiv 2512.02841、2025-12-02）
https://arxiv.org/abs/2512.02841 （HTML 全文を確認）

- 設計: システムプロンプトを、英語のまま使う場合と、設問と同じ言語に訳す場合で比べた。言語は en, zh, es, fr, hi（日本語なし）。モデルは Gemma-3-12B-IT、Llama-3.1-8B-Instruct、Qwen2.5-7B-Instruct。課題は MMLU-Pro、MATH500、UniMoral（知識・推論の設問で、手順を守る課題ではない）。システムプロンプトの訳は機械翻訳（Google Translate）で、翻訳調の偏りを除く工夫はない。
- 原文: "English system prompts show slightly worse performance in all four metrics compared to using prompts in the question's native language." 続けて "However, the performance drop is marginal, and using English prompts still offers practical advantages..."
- 数字（付録の表2）: 平均正答率は英語プロンプト 0.5033、同一言語プロンプト 0.5097（差 0.006）。

#### (2) 指示の言語を含む、多言語の指示追従ベンチマーク（日本語を含む）

**M-IFEval**（arXiv 2502.04688、2025-02-07。NAACL 2025 Findings）https://arxiv.org/abs/2502.04688 （HTML 全文を確認）

- 日本語を含む（フランス語、日本語、スペイン語）。プロンプトは、各言語の母語話者が、その言語で書いた。日本語は172問。ひらがな・カタカナ・漢字などの「文字種の制約」といった日本語固有の指示を含む。
- 日本語固有の指示は、ほかの言語より難しい。原文: "the 10 instructions with the lowest scores all were language-specific instructions such as forbidding "œ/ç", forbidding katakana, or specifying the frequency of the "ñ" character."
- 表1（厳密スコア、英語の IFEval 対 日本語。差は筆者が計算）:

| モデル | 英語 | 日本語 | 差 |
| --- | --- | --- | --- |
| o1 | 86.7 | 75.7 | -11.0 |
| Claude Opus（論文は「Claude 3.5」と表記） | 87.3 | 75.7 | -11.6 |
| Claude Sonnet（同上） | 88.1 | 77.0 | -11.1 |
| GPT-4o | 88.6 | 70.4 | -18.2 |
| o1 Mini | 83.9 | 69.5 | -14.4 |
| GPT-4o Mini | 86.0 | 65.9 | -20.1 |
| Qwen 2.5 32B | 86.0 | 65.9 | -20.1 |
| Claude Haiku（同上） | 77.3 | 61.9 | -15.4 |

- 注意: 日本語の問題集は、英語の IFEval を訳したものではなく、日本語固有の難しい指示を含む。英語との差は、言語の差だけでなく、問題の差も含む。日本語の中でも、英語由来の指示だけで比べると、o1 は 84.8、Sonnet は 81.2（本文）。

**Marco-Bench-MIF**（arXiv 2507.11882、2025-07-16。ACL 2025 長編）https://arxiv.org/abs/2507.11882 （HTML 全文を確認）

- 30言語（日本語を含む）の IFEval 拡張。翻訳ではなく現地化したデータの方が、機械翻訳データより 7〜22% 高い（機械翻訳データは精度を低く見積もる）。
- 原文: "High-resource European (de, fr) and East Asian languages (zh, ja) achieve 75-85% accuracy across top models, while low-resource languages (yo, ne, kk) performance is at 50-60%". 日本語は高資源言語の側に入る。
- 日本語単独の数字は、本文では取り出せなかった。

**Multi-IF**（arXiv 2410.15553、2024-10-21、Meta）: 複数ターン・多言語の指示追従。対象は英語、フランス語、スペイン語、ポルトガル語、ヒンディー語、中国語、ロシア語、イタリア語で、日本語を含まない。どのモデルも、ターンが進むほど失敗が増える（o1-preview は第1ターン 0.877 から第3ターン 0.707）。
**XIFBench**（arXiv 2503.07539、2025-03-10。NeurIPS 2025）: 6言語の制約つき指示。日本語を含むかどうかは確かめていない。

#### (3) ツールの使い方

- **Arabic Prompts with English Tools**（arXiv 2601.05101、2026-01-08）: 原文 "when users interact in Arabic, tool-calling accuracy drops by an average of 5-10%, regardless of whether the tool descriptions themselves are in Arabic or English." ツールの説明の言語（アラビア語か英語か）では差が出ず、ユーザーの言語で下がった。
- **Lost in Execution（MLCL）**（arXiv 2601.05366、2026-01-08）: 中国語・ヒンディー語・イボ語。原文 "parameter value language mismatch as a dominant failure mode, where models generate semantically appropriate parameter values in the user's language, violating language-invariant execution conventions." ツール選択は合っているのに、引数の値をユーザーの言語で作ってしまう失敗が多い。
- どちらも日本語は対象外。指示（スキル本文）の言語を変えた実験でもない。

#### (4) 周辺の研究

- **Language Shapes Instruction Hierarchy Compliance in Multilingual LLMs**（arXiv 2607.23545、2026-07-26）: 指示の優先順位（システム＞ユーザー＞ツール）を守るかを6言語で比べた。日本語は対象外。上位（システム）側に英語を置くと、いくつかのモデルで最も強く効き、Claude Sonnet では次点の言語を 11 ポイント以上上回った。GPT-5 は全言語で上限近く、言語の影響が小さい。
- **CulturALL**（arXiv 2604.19262、2026-04-21）: 文化的な文脈つきの課題で、英語に訳したプロンプトは、元の母語のプロンプトより 8.08% 低かった（本文）。指示追従ではなく、文化の知識を問う課題で、訳によって文脈が落ちる影響が混ざる。
- **Exploring the Effect of Multiple Natural Languages on Code Suggestion Using GitHub Copilot**（arXiv 2402.01438、2024-02-02。MSR 2024）: AtCoder の問題で、日本語の指示が最も正答率が高く、英語がそれに次ぎ、中国語が最も低かった。著者は、AtCoder が日本で多く使われ、日本語の資料が学習に多いためと推測している。一般化できないと本人たちが書いている。
- **Investigating the Influence of Prompt and Response Languages on LLM Content Generation**（arXiv 2608.26186、2026-08-22）: 英語とノルウェー語。プロンプトの言語で、応答の長さが約37〜41%変わる。原文 "Prompt language is not neutral and systematically shapes output length and lexical realization".

#### (5) 日本の個人による小さな実験（二次情報、信頼度は低い）

- Zenn「AIにタスクを依頼する時、手順指示の有無と日本語・英語の違いを比較した」（2025-02-08）https://zenn.dev/nkwtnb/articles/2bb1c6337348e4 : gpt-4o-mini、各条件10回、「1000語の英文を書く」課題の語数。平均は英語・手順なし 990.8、英語・手順あり 941.9、日本語・手順なし 921.1、日本語・手順あり 885.2。英語の方が1000に近く、手順を書いた方がかえって悪かった。標本が小さく、1つのモデルと1つの課題だけ。
- Zenn「日本語NLPタスクでも英語プロンプトが良いか？：読み推定を例に」（2023-03-26）https://zenn.dev/0x9d28/articles/42794976c41982 : gpt-3.5-turbo、150文。英語の指示の方が良かった（引き分け以外で、zero-shot で英語が23勝・日本語が6勝）。日本語の指示では、カタカナをひらがなに直す制約を破る例が多かった。古いモデルで、標本が小さい。

### 1-C. 分からなかったこと

- 「長い手順書（SKILL.md）を英語で書くか日本語で書くか」で、複数段階の手順の守りが変わるかを、日本語で直接測った研究は見つからなかった。
- 「指示の言語」だけを変え、日本語を含み、費用の低い商用モデル（Haiku 級、mini 級）を使った研究は見つからなかった。指示の言語だけを分けた2本の研究は、小型の公開モデル（8B〜12B）で、日本語を含むのは Enomoto らだけ。
- 各社の公式の指針は、指示を何語で書くかについて、推奨も禁止も書いていない。
- ツールの使い方で、指示（スキル本文）の言語の影響を測った研究は見つからなかった。見つかったのは、ユーザーの言語の影響だけ。

### 1-D. 考察（推測を含む）

- 指示の言語が与える影響は、あっても、モデルや課題による差より小さいことが多い。ただし、証拠の中心は小型の公開モデルで、聞き取りスキルが動く Copilot CLI のモデル（GPT 系、Claude 系、Gemini 系）に、そのまま当てはまるとは言えない。
- Enomoto らは、英語の指示の方が「出力形式の制約」を守りやすいと見ている。聞き取りスキルの「1回に1問だけ聞く」「選択肢と推奨を示す」のような形式の制約は、英語の方が守られやすい可能性がある。ただし、これは推測で、試していない。
- ツールの引数の言語の失敗（MLCL）は、日本語でも起きる可能性がある。ファイル名や識別子を日本語で作ってしまうなどの失敗が考えられる。確かめていない。
- Copilot CLI のシステムプロンプトとツールの説明が英語である点は、GitHub が「英語が主な対象」と書いていることと合う。英語の説明を、日本語の会話のそばに置くこと自体は、設計として普通である。

---

## 問2. 指示は英語、会話は日本語のとき、英語で返事をしてしまう（言語の取り違え）報告はあるか。公式の対策

### 2-A. 分かったこと: 研究

**Understanding and Mitigating Language Confusion in LLMs（Marchisio ら）**（arXiv 2406.20052、2024-06-28。EMNLP 2024）https://arxiv.org/abs/2406.20052 （HTML 全文を確認）

- 日本語を含む15言語。言語の取り違えを、行の単位（LPR: 応答のすべての行が望んだ言語である割合）と単語の単位で測る。1回の応答は最大100トークン。
- 要旨の原文: "We observe that base and English-centric instruct models are more prone to language confusion, which is aggravated by complex prompts and high sampling temperatures. We find that language confusion can be partially mitigated via few-shot prompting, multilingual SFT and preference tuning."
- 「英語の指示で、他言語の出力を頼む」設定（cross-lingual）を持つ。原文 "We set the instruction language to English."。システムプロンプトは試していない。
- 日本語の LPR（表3。列の対応は、本文の抽出から読み、Llama 3 で韓国語が最低になることで整合を確かめた）:

| モデル | 日本語の指示で日本語の出力 | 英語の指示で日本語の出力 |
| --- | --- | --- |
| GPT-4o | 99.0 | 92.5 |
| GPT-3.5 Turbo | 98.0 | 88.3 |
| Command R | 100.0 | 65.3 |
| Command R+ | 99.0 | 93.8 |
| Llama 3 70B Instruct | 10.0 | 1.4 |

  - 英語の指示で頼むと、日本語で完全に答える割合が、同じモデルでも下がる（GPT-4o で約7ポイント）。モデルの系列による差が、大きさによる差より大きい（Llama 3 は日本語で 10%、Command R と R+ は 65.3 と 93.8）。
- 指示の位置: 原文 "Integrated instructions cause more confusion"（言語の指定が文の中に埋め込まれていると、先頭か末尾にあるときより取り違えが多い。Command R で 69% 対 85%）。この難しさは、例を1つ示す（one-shot）と大きく減る（Command R で 69% から 80.6%）。
- 複雑なプロンプトの影響: 原文 "higher confusion is caused by prompt complexity rather than length"。
- 温度が高いほど取り違えが増える。Command R の日本語の単語単位の合格率（WPR、日本語の応答に英語の単語が混ざらない割合）は、温度 0.0 で 96.9%、温度 1.0 で 74.5%（表8）。

**Enomoto ら**（問1と同じ論文）
- 原文: "using English instructions more often leads to the generation of text in a language other than the target-language. This observation is similar to the findings of Marchisio et al. (2024)."
- 日本語（表18、読解課題）: 日本語の指示のとき、日本語で出力した割合は 99.78%（suzume）、99.78%（Qwen2）、99.34%（Mistral-Nemo）。英語の指示のときは 95.16%、96.48%、98.90%。英語の指示では、suzume は英語が 1.76% 混ざり、Qwen2 は中国語が 3.52% 混ざった。
- 逆の失敗もある。日本語の指示は、「情報がない」という答えを増やす（日本語・読解で suzume 28件、英語の指示は3件）。

**OLA: Output Language Alignment in Code-Switched LLM Interactions**（ACL 2026 長編、acl-long.2162。正確な公開日は未確認）https://aclanthology.org/2026.acl-long.2162.pdf （PDF 全文を確認）
- 韓国語と英語が混ざった入力で、望む出力の言語を、最新のモデル（Gemini 3 Pro、GPT-5.1 など）が取り違える。原文 "models consistently favor generating non-English outputs ... even when the instruction is given in English ... suggesting models default to the non-English script present in the context."
- 日本語は対象外。

**推論の言語**: 推論モデルは、英語以外の質問でも英語で考えがちで、考える言語を強制すると正答率が下がる（When Models Reason in Your Language、arXiv 2505.22888、2025-05-28）。推論の途中の言語の混ざりは、性能に影響する（Language Mixing in Reasoning Language Models、arXiv 2505.14815、2025-05-20）。応答の言語とは別の話で、聞き取りスキルへの影響は未確認。

### 2-B. 分かったこと: 現場の報告（二次情報、未検証の数字を含む）

- **Claude Code の Issue（Anthropic のリポジトリ）**。WebFetch の要約経由で、引用と数字は未検証。
  - #96326（2026-09-23、Open）: 「英語のツール出力を読んだ直後に、日本語を求める CLAUDE.md の規則があるのに、返事が英語に流れる。訂正しても続かない」。要約された報告者の言葉は "The drift seems to follow the language of the most recent tool output, even when that output is only a commit message or a code edit." 他の言語（ヘブライ語、イタリア語、韓国語、繁体字中国語、ドイツ語）の報告も付いている。ツール呼び出しが多いほど増える（ある利用者の集計で、ツール呼び出し0回で 6.5%、50回超で 31%）。保守側の返信は表示されなかった。
  - #99800（2026-10-05。報告者が 2026-10-18 に閉じた）: `language: "japanese"` の設定と CLAUDE.md の規則があっても、ツール呼び出しの間の進捗メッセージが英語になる。圧縮（compaction）の要約が英語で書かれる。回避策は「ツール呼び出しのたびに規則を再注入するフック」だけが確実、と報告者は書いている。
  - #99704（2026-10-05、Open、韓国語）: 同じ設定・同じ CLI で、モデル別の英語の割合を、応答の本文ブロックを数えて比べた。claude-opus-5 は 0%、claude-opus-5-5 は 33%（別の利用者の集計では、opus-5 が 0.6%、opus-5-5 が 9.4%）。明示の規則を足すと、英語の割合が 14.2% から 5.1% に下がった（同じ利用者の別の集計）。Haiku・Sonnet の数字はなかった。
  - つまり、指示の言語が英語か日本語かではなく、直近の文脈（ツール出力）の言語と、モデルの版が、応答の言語を決めているように見える、という報告である（報告者たちの観察）。
- **OpenAI 開発者コミュニティ**（2025-09-02、https://community.openai.com/t/gpt-5-ignores-explicit-language-instructions-responds-in-the-wrong-language-despite-strict-prompt/1355799 ）: GPT-5 が、システムプロンプトで言語を厳しく指定しても、検索結果の言語（ドイツ語）に引きずられて、英語の質問にドイツ語で答える。同じ設定で gpt-4-mini は問題がなかった。コメントの1つ: ChatGPT で言語を指定したあとに Web 検索を頼むと、ほとんど必ず元の言語に戻る。有効だったという案は、規則を短く1行にし、繰り返しを消すこと（"Language: user language if inferable, else default to English"）。
- **日本の記事**:
  - cc-sdd の作者（gotalab）の Zenn（2025-07-19、https://zenn.dev/gotalab/articles/3db0621ce3d6d2 、本文確認）: 「Claude.mdを独自のものに統合して利用するときに英語になる場合は、チャットの返答を日本語にしろという指示を入れると日本語になるはずです」。
  - papoo.work（2026-06-28、https://papoo.work/doc/60ecfd7f495a7794 、匿名の個人サイト）: 「CLAUDE.md を全部英語でガチガチに書くと、Claude の返答とかコミットメッセージとかも英語に寄りやすい」。根拠の測定は示されていない。対策は「出力の言語だけは一行で明示しとく」。
  - GitHub Copilot の日本語の PR レビュー: カスタム指示を足したあとも、英語で返ってくることがあるとの報告（mamezou-tech、2025-09-10、https://developer.mamezou-tech.com/en/blogs/2025/09/10/github_copilot_pull_request/ 、検索結果の要約のみ確認、本文は未確認）。
- **Copilot の他の製品**: VS Code の Copilot Chat の設定 `github.copilot.chat.localeOverride` は、応答の言語を固定する（第三者のブログ経由）。VS Code 用の設定で、Copilot CLI にあるかは確認できなかった。Copilot CLI のリポジトリ（github/copilot-cli）で「日本語の返答が英語になる」という Issue は見つからなかった。

### 2-C. 分かったこと: 公式の対策

- **Anthropic**（https://platform.claude.com/docs/en/build-with-claude/multilingual-support ）原文:
  - "Claude infers the response language from the conversation, but for production applications you should state the target language explicitly. The most reliable place to do this is the system prompt, which keeps the instruction stable across every turn of a conversation."
  - "If your application lets users pick a language at runtime, interpolate that choice into the system prompt rather than relying on Claude to infer it from the user's message."
  - "Although Claude can detect the target language automatically, explicitly stating the desired input and output languages improves reliability."
  - 例のシステムプロンプト: "Always respond in French, regardless of the language the user writes in."
- **Google**（https://cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/system-instructions 、更新 2026-10-20）原文: "Specifying which language the model should respond in (sometimes models can respond in your local language, even if the prompt is written in another language). When you use a non-English language for your prompts, we recommend you add the following to your system instructions: ... Respond in the same language as the query."
- **OpenAI**: 公式の対策は見つからなかった（問1の表を参照）。
- **GitHub**: 公式の対策は見つからなかった。Copilot CLI は英語が主な対象と明記しているだけ。
- **研究が示す緩和策**: 例を1つ付ける（few-shot）、温度を下げる、言語の指定を先頭か末尾に独立して置く（Marchisio ら）。

### 2-D. 分からなかったこと

- 「英語のシステムプロンプト＋英語のツール説明＋日本語のユーザー」で、日本語の返事が英語になる割合を、モデル別に測った研究は見つからなかった。Marchisio らは英語の指示で他言語の出力を頼む設定を測ったが、ユーザーの文が日本語である設定は測っていない。
- Copilot CLI 自体での報告は見つからなかった。Claude Code の報告は、別の製品で、別のモデルの版である。
- Issue の数字は、報告者による集計で、再現も査読もされていない。

### 2-E. 考察（推測を含む）

- 研究（Marchisio ら）は「英語の指示で日本語の出力を頼む」と、日本語で完全に答える割合が約7ポイント（GPT-4o）下がることを示す。ただし、そこでは利用者の文も英語である。実際には、利用者の文が日本語で、日本語が直近の文脈にあるので、この数字は悲観的な側の見積もりと考えられる。
- 一方、現場の報告（Claude Code、OpenAI のコミュニティ）では、日本語の利用者の文があり、規則があっても、英語のツール出力や英語の検索結果のあとに、英語に流れる。応答の言語を決めるのは、指示の言語よりも、直近の文脈の言語のように見える。この推測は、OLA（文脈の言語に引きずられる）とも矛盾しない。
- したがって、スキル本文を英語にするか日本語にするかより、「応答は日本語」の規則を明示することと、長いツール出力のあとに規則を思い出させる作りの方が、効きそうである。確かめてはいない。

---

## 問3. 費用の低いモデル（Haiku 級、mini 級）で、言語の差が大きくなるという報告はあるか

### 3-A. 分かったこと

- **Anthropic の公式表**（https://platform.claude.com/docs/en/build-with-claude/multilingual-support ）: 英語を 100% としたときの日本語の相対スコア。Claude Sonnet 4.5（表に deprecated の表示あり）が 96.8%、Claude Haiku 4.5 が 93.5%。ほかの言語も、Haiku の方が英語との差が大きい（例: スペイン語 98.2% 対 96.4%、ヨルバ語 79.7% 対 52.7%）。測定は、MMLU（知識・推論）を14言語に職業翻訳者が訳したもので、思考の連鎖つき、ゼロショット。指示追従ではない。
- **M-IFEval**（問1の表）: 英語から日本語への低下は、Haiku 3.5 が -15.4、GPT-4o mini が -20.1、o1 mini が -14.4。大型の Opus・Sonnet・o1 は -11 前後。ただし GPT-4o（-18.2）も大きく、「小さいほど差が大きい」と単純には言えない。本文は、Claude Sonnet が日本語固有の指示で高く、「Sonnet may have been trained on more Japanese data」と推測している。
- **Marco-Bench-MIF**（30言語、日本語を含む。表4「指定の言語で答える」の平均）: GPT-4o-mini 95.09、GPT-4o 95.43、Claude 3.5 Sonnet 94.03、Gemini 1.5 Flash 94.08。10B未満の公開モデルは、LLaMA3.1-8B 58.34、Aya23-8B 65.57、Ministral-8B 66.03、Qwen2.5-7B 78.95、Gemma2-9B 91.82 と大きくばらつく。本文: "even top LLMs like GPT-4o and Claude still can not fully follow the instruction that respond in specified language (5% wrong outputs)". 規模については、本文が「70B以上は8Bより45〜60%高い」「個々の指示（instruction-level）より、すべての指示を同時に守る割合（prompt-level）が10〜20ポイント低く、小型モデルで特に目立つ」と述べる（Ministral-8B について本文は "21.74 vs. 46.45 points difference"）。
- **Marchisio ら**（問2の表）: OpenAI の GPT-3.5 Turbo と GPT-4o は、日本語の取り違えの割合が近い。差が大きいのは、モデルの系列と調整の方法（Llama 2・3 と Command R の旧版が悪く、Llama 3.1 と Command R+ Refresh が良い）。
- **Enomoto ら**・**Cross-Lingual Prompt Steerability**: 8B〜12B の公開モデルを使い、英語の指示で英語以外の出力に取り違えが出る（問2）。Cross-Lingual Prompt Steerability は、8B 級は「プロンプトの言語や小さな変更に敏感」なので選んだと述べる。
- **XIH-Bench**（問1の周辺。日本語は対象外）: GPT-5 は言語の影響がほぼない（全言語で上限近く）。本文は、GPT-5 以外のモデルで言語による差が目立つと述べる。GPT-5-mini、GPT-5-nano、Claude Haiku 4.5 も評価対象に入っているが、それぞれの数字は読んでいない。
- **Claude Code の Issue**（問2）: 取り違えは、Opus 級の版の差で大きく動く（0% 対 33%）。Haiku・Sonnet の数字は報告にない。

### 3-B. 分からなかったこと

- Haiku 4.5 級・mini 級で、「英語の指示のスキルに日本語で会話させたとき」に英語で返す割合は、見つからなかった。
- 日本語での、GPT-5 mini、GPT-4.1 mini、Haiku 4.5 などの指示追従の数字は、見つからなかった（M-IFEval は Claude 3.5 Haiku と GPT-4o mini の2024年の版）。
- Marco-Bench-MIF の日本語の列の個別の数字は、本文の抽出から確実に読み取れなかったので、使っていない。

### 3-C. 考察（推測を含む）

- 費用の低いモデルの方が、日本語の指示追従と応答の言語の差が大きくなる傾向は、複数の資料の方向としては一致している（Anthropic の公式表、M-IFEval、Marco-Bench-MIF の10B未満）。ただし、商用の mini 級は、応答の言語を守る点（Marco-Bench-MIF）で、上位のモデルとほぼ同じだった。差が出るのは、複数の制約を同時に守る場面や、小型の公開モデルである。
- 聞き取りスキルは複数の制約（1問ずつ聞く、推奨を示す、日本語で答える、など）を同時に守らせる作りなので、小さいモデルでは、日本語だから落ちるのか、制約が多いから落ちるのかを分けて試す必要がある。

---

## 問4. 公開されている日本語のスキル・エージェントの実例と、作者の言語の選び方の理由

### 4-A. 分かったこと（実例。リポジトリの README と SKILL.md を取得して確認）

| 実例 | 言語の選び方 | 理由の記述 |
| --- | --- | --- |
| gotalab/cc-sdd（仕様書駆動開発。Claude Code、Codex、Copilot など8エージェントと14言語に対応）https://github.com/gotalab/cc-sdd | SKILL.md の本文は英語。出力の言語は変数で渡す。`--lang ja` を選ぶと、案内文に "Think in English, generate responses in Japanese. All Markdown content written to project files ... MUST be written in the target language configured for this specification (see spec.json.language)." が入る。SKILL.md には「spec.json の言語を使う」「言語が未指定なら英語」とある（tools/cc-sdd/src/template/context.ts、templates/agents/claude-code-skills/skills/kiro-spec-requirements/SKILL.md） | 作者の理由の記述は見つからなかった。作者の Zenn（2025-07-19）は、返答が英語になるときの対策（日本語にしろという指示を足す）だけを書いている |
| bmthd/skills（Claude Code、OpenCode、Cursor 向け）https://github.com/bmthd/skills | 各スキルは、英語の SKILL.md と、日本語訳の SKILL.ja.md を並べて置く。README の原文: "Agents still load the English SKILL.md; the translation is there to help you read it." | 英語の SKILL.md を選んだ理由は書かれていない。日本語訳は人が読むため、と書いている |
| sanoakr/ai-skills（Claude Code、Cursor、Copilot、Codex 向け）https://github.com/sanoakr/ai-skills | ja-proofreading の SKILL.md は、description が英語で、日本語の呼び出し語句（「日本語の文章を校正して」など）を併記し、description の中に "Report issues clearly in Japanese" とある。README は日本語 | 理由の記述は見つからなかった |
| j1nn0/skills（日本語の技術ブログ用）https://github.com/j1nn0/skills | README、description、本文のすべてが日本語 | 理由の記述は見つからなかった。日本語の文章を書く用途なので、日本語が前提と考えられる（推測） |
| ktaroabobon/agent-skills（commit、PR、Issue など）https://github.com/ktaroabobon/agent-skills | description と本文が日本語。複数段階の手順（「Step 1: 変更を塊に分ける」など）、allowed-tools、hooks を持つ。commit メッセージや PR の本文を日本語で書かせる | 理由の記述は見つからなかった |
| MasahikoShinya/AgentSkills、touyou/skills | README は日本語。touyou/skills には日本語の文章を書く系のパックがある | 理由の記述は見つからなかった |

### 4-B. 分かったこと（作者・筆者の言語の選び方の理由。二次情報）

- **note「CLAUDE.md は日本語で書くべきか？」**（岸大樹、2026-02-08、https://note.com/taiki_kishi/n/n170d225378b5 、本文確認）: 公式ドキュメントに言語の推奨はない、と調べている（本調査の結果と一致）。自分は日本語を選んだ。理由は、ドキュメントがすべて日本語で、利用者が日本語話者の1人だけで、「自治体DX」「LGWAN」「電子決裁」など英語にしにくい用語が多く、無理に訳すとかえって曖昧になるため。ハイブリッド（コマンドは英語、対話の指示とドメイン知識は日本語）も勧めている。英語派の理由として、トークンの効率、学習データの偏り、優れた実例の多くが英語、を挙げている（これらは公式の推奨ではなく、コミュニティの意見と注記している）。
- **papoo.work**（2026-06-28）: 「どっちでもいい。日本語で書いて全然問題ない」。差が出るのは、トークン効率（誤差レベル）、出力の言語が引っ張られること、保守する人間が読めるか。「これが本命」として、保守する人間が読めること。迷ったら、出力の言語を1行で明示する。根拠の測定は示されていない。匿名の個人サイトで、信頼度は低い。
- **DevelopersIO（クラスメソッド）**（2025-07-31、https://dev.classmethod.jp/articles/20250731-just-wanted-to-compress-tokens-in-claude-md/ 、本文確認）: 費用を減らすため、CLAUDE.md を英訳した（CLAUDE.md が英語版、CLAUDE_ja.md が日本語版）。「日本語訳はAIではなく人用」。原文の数字は、約20行で、英語版が約81トークン、日本語版が約636〜848トークン（87〜91%の削減）。ただし、この差は翻訳だけでは説明しにくい（英語版を短くしている可能性。推測）。ほかの実測では日本語は約1.57倍（ai-heartland.com、本文は未確認）。
- **日本語での自動起動**: 「description が英語だと、日本語の発話と照合されにくい」という話はよく見かけるが、その記事（ゆるくさの開発日記、2026-06-14、https://yurukusa-dev.hatenablog.com/entry/2026/06/14/034917 ）自身は、検証していない。記事の主題は、description が約1536文字で切り詰められ、末尾に足した日本語が先に消えること（Claude Code 固有の設定の話）。著者は有料の電子書籍を宣伝していて、信頼度は低い。
- 上の記事とは別の記事（検索結果の要約）は、「公式の例はすべて英語なので、英語の方が安定する可能性もある。自分もまだ検証しきれていない」と書いている。未確認。

### 4-C. 分からなかったこと

- 日本語・英語で同じスキルを書き、実際に比べた公開の検証は見つからなかった（検索で「見つからなかった」旨の要約が複数出た。見つけたのは、問1の小さな実験2件だけ）。
- Copilot CLI 向けの日本語スキルで、言語の選び方の理由を書いた作者は見つからなかった。
- 理由が書かれている例は、CLAUDE.md の言語についての記事が中心で、SKILL.md そのものの言語の理由は少ない。

### 4-D. 考察（推測を含む）

- 実例には3つの型がある。（a）全部日本語（ktaroabobon、j1nn0）。（b）手順は英語、出力の言語は変数や1行の規則で日本語にする（cc-sdd、sanoakr）。（c）英語を原本にし、人が読むための日本語訳を並べる（bmthd、クラスメソッドの記事）。
- 開発者（日本語話者）が保守する要件に合うのは、（c）の型と考えられる。ただし、日本語訳と英語の原本のずれを、どう防ぐかが、別の問題になる。
- 理由がはっきり書かれた実例は少ない。日本語を選ぶ理由は「保守する人が読める」「英語にしにくい用語がある」、英語を選ぶ理由は「トークンの効率」「他のツールと共用」が中心で、精度の測定に基づく理由は見つからなかった。

---

## 結論（確信度つき）

1. 指示（スキル本文）の言語が、手順の守りやツールの使い方を決定的に変える、という証拠は見つからなかった。小型の公開モデルでは、英語の指示の方が出力形式の制約を守りやすいが、課題の性能の差は小さく、英語が圧倒的に有利とは言えない（Enomoto ら、Cross-Lingual Prompt Steerability）。商用の GPT・Claude・Gemini の系列で、指示の言語だけを変え、日本語を含めて直接測った研究は見つからなかった。確信度: 中。
2. 指示を英語にして会話を日本語にすると、英語（や他言語）の返事が混ざる危険は、研究と現場の報告の両方にある。ただし現場の報告では、指示の言語より、直近のツール出力の言語とモデルの版が効いているように見える。公式の対策は一致していて、応答の言語を、システムプロンプトなどで明示する（Anthropic、Google）。OpenAI と GitHub は公式の対策を見つけられなかった。確信度: 中（明示の効果は高、指示の言語の影響の大きさは低）。
3. 費用の低いモデルで日本語の差が大きくなる傾向は、公式表（Haiku 4.5 は日本語が英語の93.5%、Sonnet 4.5 は96.8%）と M-IFEval の方向で一致する。ただし商用の mini 級は、応答の言語を守る点では上位とほぼ同じで、小型の公開モデルの方が大きく崩れる。聞き取りスキルでの Haiku 級・mini 級の数字はない。確信度: 低〜中。
4. GitHub は、Copilot CLI について「英語が主な対象」と明記しているが、指示を何語で書くかの推奨は、各社とも書いていない。公開されている日本語のスキルは、全部日本語、手順は英語で出力だけ日本語、英語の原本に日本語訳を並べる、の3つの型があり、理由の多くは「保守する人が読めるか」「英語にしにくい用語」「トークンの効率」で、精度の測定に基づく理由は見つからなかった。確信度: 中（公式の沈黙は、取得したページの範囲では確か。ほかのページにある可能性は残る）。
5. 決め手に欠けるので、実際に使うモデル（少なくとも1つの低価格モデル）で、日本語と英語の両方の聞き取りスキルを、同じ会話の台本で数回ずつ試して、日本語で返す割合と手順の守りを数えるのが、最も確かな確かめ方である（この調査の範囲では、これ以上の根拠が見つからなかったため）。確信度: 中。
