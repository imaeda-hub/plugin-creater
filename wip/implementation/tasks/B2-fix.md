# B2 を直す担当のメモ

指示：briefs/fix.md、briefs/common.md、briefs/B2.md。指摘：reviews/B2-design.md、B2-format.md、B2-models.md、B2-language.md。
担当のファイル（ひな形 skills/make-plugin/assets/template/ の下）：skills/_entry_/SKILL.md、com.github.copilot/agents/orchestrator.agent.md・worker.agent.md・verifier.agent.md、com.github.copilot/extensions/_plugin_/core/tools.mjs の説明の文。
ほかの担当の部品（core の処理、adapter.mjs、ui/、scaffold.py、クリエイターの側）は直さず、「ほかの担当への依頼」に書く。

## 状態

- [x] 指摘4つを読む
- [x] 根拠（core の records・index・constants・lifecycle の buildInstruction・events、adapter の onPreToolUse・taskDescriptionOf・defer、設計書 3.1・4.1〜4.10、README のひな形、R1 の (1)・(3-3)、RESUME.md、scaffold.py の置き換え、1.0.102 の runtime.node の文字列）を読んで確かめた
- [ ] 直す（SKILL.md → orchestrator → worker → verifier → tools.mjs → tasks/B2.md の古い記述）
- [ ] 機械的な確かめ
- [ ] 指摘の扱いの表を仕上げる

## 指摘の扱い

（作業中）

## ほかの担当への依頼

## 上位の文書で直すこと

## 機械的な確かめの結果
