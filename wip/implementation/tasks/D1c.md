# D1c 作業のメモ：外側の EVAL とユーザー役（tests/dev-eval/runner/ の外側の部分）

担当の指示：wip/implementation/briefs/D1.md の「D1c」の節（共通：common.md）

置き場所（これ以外は作らない・変えない）：
- tests/dev-eval/runner/ の外側の部分（ファイル名は `outer-*.mjs`、`user-role*.mjs`、`creator-tools.mjs` など。D1d の `inner-*.mjs`・`isolation.mjs`・`mcp-tools.mjs`・`model-map.mjs` とは分ける）
- tests/dev-eval/control-creator/（対照のクリエイター）
- tests/dev-eval/ の下の試験（実際のモデルは使わない）
- 会話例の作成のスクリプト（tests/dev-eval/runner/ の中）。出力先は examples/

## 状態

印の意味：[x] できた（試験も通った）、[~] ファイルはできた（試験はまだ）、[ ] まだ

- [x] 読み込み（common.md、D1.md、BLUEPRINT、RESUME、testing.md 全章、hearing.md の関係の章、ナレッジ3つ、R4、試作の lib.mjs・outer.mjs・test_user_role.mjs・inner.mjs・control-creator、FORMAT.md、D1a・D1b・D1d のメモ、C1 のメモと creator.mjs・hooks.mjs・store.mjs・tool-defs.mjs、C2 のメモ、C3 の grade.mjs の窓口）
- [ ] 環境の確かめ（bubblewrap、socat、Agent SDK の版、claude の版）
- [ ] 共通の部品の置き場所の決め（下）
- [ ] ユーザー役（user-role.mjs）
- [ ] ユーザー役の試験（user-role-test.mjs）
- [ ] クリエイターのエクステンションの置き換え（creator-tools.mjs）
- [ ] 外側の EVAL の流れ（outer-*.mjs）
- [ ] 6.5 の採点
- [ ] 6.6 の記録の全文
- [ ] 対照のクリエイター
- [ ] 会話例の作成のスクリプト
- [ ] 見ない模擬ユーザーの読み込み
- [ ] 試験が通る
- [ ] 最後の返事

## 共通の部品（D1c が作るもの。D1d が使ってよい）

（まだ）

## D1c が使う D1a・D1b・D1d の部品

（まだ）

## 決めたこと

（まだ）

## 要確認

（まだ）

## 上位の文書で直すこと

（まだ）
