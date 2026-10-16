# ナレッジ索引

- [AI エンジニアリングの5分類](ai-engineering.md) — プロンプト／コンテキスト／ハーネス／ループ／グラフ。提唱された順と、互いの関係
- [ハーネスエンジニアリングの目的と人間の役割](harness-purpose.md) — 目的はヒューマン・オン・ザ・ループ。監督のためエージェントの振る舞いを可視化する。ハーネスは AI が知らないことを人間が対話を通じて作る
- [スキル（GitHub Copilot CLI）](skills.md) — 本質は description。Markdown・スクリプト・アセット・リファレンスで構成し、推論の要否で Markdown とスクリプトに分ける
- [MCP](mcp.md) — 外部システムと安全にデータをやり取りする役割に特化。ローカルの操作はスキルへ移行
- [カスタムエージェント（GitHub Copilot CLI）](custom-agents.md) — マルチエージェント構成の1エージェントを定義。モデル・権限・ツールなどを指定できる
- [マルチエージェントの強み](multi-agent.md) — コンテキストウィンドウの最適化、処理速度、AI クレジットの最適化
- [ハーネスの置き場所](harness-placement.md) — 決められた場所に置くことで効果を発揮。GitHub リポジトリでは `.github` 内
- [プラグイン](plugins.md) — ハーネス群の配布・インストールの仕様。Agent Plugins 1.0.0 はスキルと MCP のみ、Copilot CLI はそれ以外も同梱できる
- [ハーネスの調達](harness-sourcing.md) — 標準機能 → OSS（Awesome Copilot など）→ 自作 の順に検討
- [実例：組み込み機器のプリントデバッグ](example-embedded-print-debug.md) — クロスコンパイル・デプロイ・ログ取得をスキル化し、ヒューマン・オン・ザ・ループにする
- [自己改善](self-improvement.md) — （大事な考え）実行中にログを残し、実行後に振り返って改善提案し、自分のリポジトリへ Issue を発行する
- [AI の思考サイクル（PDS）](pds-cycle.md) — （大事な考え）闇雲に実行を繰り返さず、必ず計画・実行・評価のサイクルを回す
- [ソフトウェア工学の知識体系を参考にする](software-engineering-knowledge.md) — （大事な考え）推測だけでなく、SWEBOK など人間が蓄積してきた知識体系を取り入れる
