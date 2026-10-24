# X の指示：全体の突き合わせの点検

点検の担当（X1、X2）は、wip/implementation/briefs/review.md の決まり（直さない、指摘の6つの書き方、重さ）に従う。ただし、点検するものと物差しは、下の担当ごとの節による。指摘は wip/implementation/reviews/<担当>.md に書く。

部品ごとの点検（B2・B3 の自然言語の部品の点検）はすでに済んでいる。この点検は、部品と部品の間の食い違いと、仕様の要件の取りこぼしを見る。

## 共通して見ること
- 部品の間の取り決め（BLUEPRINT.md の 3章〜9章と、各担当の作業のメモ tasks/*.md の「引き継ぎ」）が、両側の実装で同じになっているか。名前（ツール名、差し込み口、ファイルの置き場所、引数、JSON の欄の名前）、形、順番、断る条件。
- 仕様書の要件ごとに、それを実現する実装と、確かめる試験（または EVAL、人の確かめ）があるか（憲章 第6条3項）。ないものを挙げる。
- 憲章とユーザーの答え（RESUME.md）に反するところ。
- 試験が、名前のとおりのことを本当に確かめているか（目立つものだけ）。

## X1：生成プラグインの側
- 点検するもの：skills/make-plugin/assets/template/ の全部（core、ui、extension.mjs、adapter.mjs、エージェントの定義、入口のスキル、docs、README、plugin.json、marketplace.json、tests）、skills/make-plugin/scripts/scaffold.py、skills/test-plugin/scripts/ の全部。
- 物差し：docs/specs/output-requirements.md と test-requirements.md の全要件、docs/design/generated-plugin-structure.md、testing.md の 10章、BLUEPRINT.md、tasks/A1〜A4・B1・B2・B2-fix・C2・C3 のメモ。

## X2：クリエイターの側と開発の試験
- 点検するもの：skills/make-plugin/SKILL.md と references、skills/test-plugin/SKILL.md、com.github.copilot/agents/、com.github.copilot/extensions/plugin-creator/、README.md、plugin.json、.github/plugin/marketplace.json、tests/creator/、tests/dev-eval/（heldout/ を除く。common.md の決まり）。
- 物差し：docs/specs/creation-requirements.md の全要件と test-requirements.md、docs/design/creator-structure.md・hearing.md・testing.md、BLUEPRINT.md、tasks/B3・B3-fix・C1・C2・C3・D1a〜D1d のメモ。
- 特に、SKILL.md と references が書く手順（ツールの呼び方、スクリプトの引数、manifest.json や parts の置き場所、結果のファイルの読み方）が、実装（エクステンション、scaffold.py、test-plugin の scripts、生成プラグインの tests/run.py）と合っているか。
