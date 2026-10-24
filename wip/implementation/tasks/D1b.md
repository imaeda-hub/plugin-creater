# D1b 作業のメモ：模擬ユーザーと、模擬ユーザーの形の決まり

担当の指示：wip/implementation/briefs/D1.md の「D1b」の節（共通：common.md）

置き場所（これ以外は作らない・変えない）：
- tests/dev-eval/personas/（FORMAT.md、模擬ユーザー、示すファイル、作るスクリプト、形を確かめるスクリプトと試験）

## 状態

印の意味：[x] できた（試験も通った）、[~] ファイルはできた（試験はまだ）、[ ] まだ

- [x] 読み込み（憲章、CLAUDE.md、RESUME、BLUEPRINT、testing.md、hearing.md、ナレッジ、R4、試作の personas と lib.mjs・outer.mjs・test_user_role.mjs・inner.mjs、C3 の grade.mjs・tasks.mjs、doc-text.mjs）
- [x] FORMAT.md（書き上げた。統括に SendMessage で知らせた。変えるときは知らせる）
- [x] validate.mjs（形を確かめる。試験はまだ）
- [x] 週報の模擬ユーザー（weekly-report/。validate.mjs --all-styles 合格。ユーザー役の試験は D1c が動かす）
- [ ] 議事録の模擬ユーザー
- [ ] ファイルのない新しい1人
- [ ] docx・xlsx を作るスクリプト
- [ ] 形を確かめるスクリプトと試験

## 決めたこと

- 置き場所：tests/dev-eval/personas/<id>/（persona.json、files/、inner/）。見ない模擬ユーザーも同じ形で tests/dev-eval/heldout/<id>/ に置く（H1）。
- 内側の EVAL の課題は、C3 の eval.json の形（BLUEPRINT 4.3）をそのまま使う（inner/eval.json）。grade.mjs の validateTask・gradeProgram・prepareWorkDir がそのまま使える。
- 形を確かめるスクリプトは Node（validate.mjs）。D1c が import できる。docx・xlsx の中の文字は、クリエイターの doc-text.mjs（documentText）で読む。docx・xlsx を作るスクリプトは Python（make_files.py。python-docx 1.2.0、openpyxl 3.1.5）。

## 要確認

## 上位の文書で直すこと
