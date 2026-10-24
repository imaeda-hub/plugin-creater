# B3 の点検：観点 format

状態：途中（SKILL.md 2つ・references・エージェント2つ・plugin.json・ツールの説明の案まで見た。README と marketplace.json は公式ドキュメントで確かめている途中）

点検の物差し：R1 の (1)（SKILL.md とカスタムエージェントの決まり）、R3 の 1.1・1.4・1.8（plugin.json、スキルのフロントマター、marketplace.json）、B3.md の「決まり」、hearing.md 10.1、ユーザーの答え 11・12（RESUME.md）、公式ドキュメント（README のコマンド）。

## 数えたもの

数え方：スクラッチの仮想環境（tiktoken 0.14.0、o200k_base）。フロントマターを除いた本文を数えた。スクリプトは /tmp/claude-0/-home-user-plugin-creater/f6e65e0d-9c94-5351-8ee1-475927b3b43e/scratchpad/b3-format/measure.py（作った者の count.py とは別に書いた）。

| ファイル | 本文の行数 | 本文のトークン数 | 大きさ（バイト） | 決まり | 判定 |
| --- | --- | --- | --- | --- | --- |
| skills/make-plugin/SKILL.md | 120 | 4,335 | 15,922 | 500行未満・5,000トークン未満 | 合う（作業のメモの数と同じ。残りは665トークン） |
| skills/test-plugin/SKILL.md | 45 | 1,668 | 6,325 | 同上 | 合う |
| references/assets.md | 26 | 930 | 3,439 | 20KB 未満。100行を超えたら目次 | 合う |
| references/carried.md | 20 | 416 | 1,558 | 同上 | 合う |
| references/confirm.md | 51 | 1,836 | 6,432 | 同上 | 合う |
| references/deepen.md | 49 | 1,108 | 3,791 | 同上 | 合う |
| references/generate.md | 73 | 2,393 | 8,291 | 同上 | 合う |
| references/improve.md | 29 | 1,026 | 3,700 | 同上 | 合う |
| references/items.md | 36 | 1,126 | 4,068 | 同上 | 合う |
| references/last-time.md | 27 | 744 | 2,693 | 同上 | 合う |
| references/read.md | 32 | 972 | 3,464 | 同上 | 合う |
| references/receive.md | 21 | 532 | 2,010 | 同上 | 合う |
| references/rules.md | 28 | 666 | 2,318 | 同上 | 合う |
| references/screen.md | 43 | 906 | 3,171 | 同上 | 合う |
| references/start.md | 19 | 773 | 2,865 | 同上 | 合う |
| references/words.md | 25 | 580 | 1,936 | 同上 | 合う |
| agents/reader.agent.md | 59 | 1,216 | 4,832（本文 1,690 文字） | 本文 30,000 文字以内 | 合う |
| agents/worker.agent.md | 126 | 3,259 | 11,458（本文 5,308 文字） | 同上 | 合う |

- description の長さ：make-plugin 190 文字、test-plugin 154 文字、reader 147 文字、worker 208 文字。どれも 1024 文字以内で、`<`・`>` を含まない。
- references の14個は、すべて make-plugin の本文で名指しされている（段階の表、deepen.md と improve.md と words.md は表の外の文）。
- plugin.json は、写したスキーマ（wip/implementation/research/schemas/agent-plugins-1.0.0/plugin.schema.json）で合格した（jsonschema 4.26.0）。`tests/creator/check_creator.py .` は、会話例（examples/ がまだない）の1件のほかは合格。

## 指摘

