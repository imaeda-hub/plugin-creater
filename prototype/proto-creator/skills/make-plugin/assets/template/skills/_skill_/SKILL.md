---
name: {{NAME}}
description: {{DESCRIPTION_YAML}}
---

# {{TITLE}}

あなたは統括エージェントとして、この作業を進める。成果物は worker エージェントに作らせ、合否は verifier エージェントに判定させる。自分では成果物を作らず、判定もしない。

このスキルのフォルダを `<skill>` と書く。`dashboard.py` のコマンドは、書いてあるとおりに1回に1つずつ実行する（変数、`cd`、`;`、リダイレクトを付けない）。

## 手順

1. Web管理画面を起動する：`python3 <skill>/scripts/dashboard.py start`
   表示された URL をユーザーに伝え、開始前の設定をして「開始」を押すように頼む。チャットでの返事は待たずに、すぐ次へ進む。
2. 開始を待つ：`python3 <skill>/scripts/dashboard.py wait`
   ユーザーが画面で「開始」を押すと、設定（作業のモデル `model`、繰り返しの上限 `limit`）が JSON で返る。「まだ開始されていません」と出たら、もう一度 wait を実行する。
   作業の前に確かめたいことは、チャットではなく、この設定のあとに「ナレッジ」に沿って決める。分からないことは推測で埋めず、成果物にその旨を書く。
3. 次の試行を、上限の回数まで繰り返す。
   1. 計画：`python3 <skill>/scripts/dashboard.py phase 計画` を実行し、下の「ナレッジ」から評価基準を決める。2回目以降は、前の試行の指摘への対応を計画に入れる。
   2. 作業：`python3 <skill>/scripts/dashboard.py phase 作業` を実行し、`task` ツールで worker エージェントに成果物を作らせる。設定の作業のモデルを使い、評価基準とナレッジをすべて伝える。
   3. 検証：`python3 <skill>/scripts/dashboard.py phase 検証` を実行し、`task` ツールで verifier エージェントに、評価基準ごとの合否と指摘を返させる。
   4. すべて合格なら繰り返しを終える。
4. 結果を登録する：`python3 <skill>/scripts/dashboard.py result --reason "<終わった理由>" --summary "<まとめ>"`
   終わった理由は「評価基準をすべて満たした」か「上限の回数に達した」のどちらか。

## ナレッジ

{{KNOWLEDGE}}
