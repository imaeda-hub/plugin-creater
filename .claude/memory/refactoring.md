# リファクタリング

## リファクタリングとは

- 外から見た振る舞いを変えずに、内部の構造を分かりやすく、変更しやすくすること（Martin Fowler の定義）。
- 小さな手順を積み重ね、手順ごとに動作を確かめる。どの手順のあとも、正しく動く状態を保つ。

## SWEBOK での位置づけ

- 主に第7章「ソフトウェア保守」で扱われる。
  - 4.2 リエンジニアリング：V3 では、ここでリファクタリングを、振る舞いを変えずにプログラムを再編成し、構造と保守性を高める技法として説明している。
  - 2.1.4 保守性、2.3.1 技術的負債のコスト見積もり
- 第4章「ソフトウェア構築」の 1.2「変化を見越して受け入れる」とも関係する。

## なぜ必要か

- 変更を重ねるソフトウェアは、複雑さを減らす作業をしない限り、どんどん複雑になる（レーマンの法則）。
- 生成プラグインは自己改善（憲章 第17条）で変更を重ねるため、定期的に構造を整える必要がある。
- SKILL.md などのエージェント用定義ファイルは実装資産（憲章 第6条）なので、ソースコードと同じくリファクタリングの対象になる。

## 進め方

- 機能の変更と構造の整理を、同じ変更に混ぜない（Kent Beck の「2つの帽子」）。
- 機能を変える前に、まず変えやすい形に整える（準備のリファクタリング）。Kent Beck の言葉では「変更を簡単にしてから、簡単な変更をする」。

## エージェント用定義ファイルでのリファクタリング

- 例：推論の要らない処理を、SKILL.md の自然言語の指示からスクリプトへ移す（[スキル](skills.md) の「Markdown とスクリプトの分け方」）。
- `description` を変えると、スキルが「いつ使われるか」が変わる。これはリファクタリングではなく、振る舞いの変更として扱う。
- AI の出力は毎回同じとは限らない。変更の前後で同じ入力を与えて結果を比べ、振る舞いが変わっていないことを確かめる。

## AI エージェントによるリファクタリングの傾向

- AI コーディングエージェントのリファクタリングを調べた研究（Horikawa ら、2025年。Java の OSS で約1.5万件を分析）では、名前や型の変更など局所的なものが中心だった。人間のリファクタリングに多い設計レベルの変更は少なかった。

## 出典

- [Refactoring（Martin Fowler）](https://refactoring.com/)
- [Preparatory Refactoring Example（Martin Fowler）](https://martinfowler.com/articles/preparatory-refactoring-example.html)
- [SWEBOK Guide V4.0 Topics（公式目次）](https://www.computer.org/education/bodies-of-knowledge/software-engineering/topics)
- [Lehman's laws of software evolution](https://en.wikipedia.org/wiki/Lehman%27s_laws_of_software_evolution)
- [Agentic Refactoring: An Empirical Study of AI Coding Agents（arXiv:2511.04824）](https://arxiv.org/abs/2511.04824)
