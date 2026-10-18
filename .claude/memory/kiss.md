# KISS

## KISS とは

- Keep It Simple, Stupid の略。必要なものだけを、できるだけ単純に作るという考え方。
- ロッキード社スカンクワークスの技術者 Kelly Johnson が広めたとされる。現場の整備士が限られた工具で修理できるほど単純な設計を求めた、という逸話が知られている。

## なぜ必要か

- AI を使って何かを作っていくと、リポジトリは肥大化していく傾向にある。
- 公開データでも、AI コーディング支援の普及とともに、重複したコードが増え、構造を整える変更（コードの移動）が減ったと報告されている（GitClear「AI Copilot Code Quality 2025」。2020〜2024年に変更された約2億行を分析）。ただし相関であり、因果は示されていない。
- 生成プラグインも自己改善（憲章 第21条）で変更を重ねるため、同じように肥大化しやすい。

## リファクタリングとの違い

- [リファクタリング](refactoring.md)は、複雑になったものを、振る舞いを変えずにあとから整える。
- KISS は、そもそも不要なものを足さず、最初から単純に作る。
- 両方を組み合わせて、肥大化を防ぐ。

## 出典

- [KISS principle（Wikipedia）](https://en.wikipedia.org/wiki/KISS_principle)
- [AI is eroding code quality states new in-depth report（DevClass、GitClear 2025 の紹介）](https://devclass.com/2025/02/20/ai-is-eroding-code-quality-states-new-in-depth-report/)
