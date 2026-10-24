# D1a の作業メモ：Claude Code 向けの変換（tests/dev-eval/convert.py と試験）

担当の指示：wip/implementation/briefs/D1.md の「D1a」の節（共通：common.md）

置き場所（これ以外は作らない・変えない）：
- tests/dev-eval/convert.py
- tests/dev-eval/ の下の、変換の試験（test_convert.py など）

## 状態

印の意味：[x] できた（試験も通った）、[~] ファイルはできた（試験はまだ）、[ ] まだ

- [x] 資料を読む（common.md、D1.md、BLUEPRINT、RESUME、testing.md 全章、ナレッジ3つ、R4、試作 convert.py、C1 のメモ、ひな形のエージェント）
- [x] Claude Code の公式ドキュメントで確かめる（Agent の引数、tools の MCP 名、model、plugin.json）
- [~] tests/dev-eval/convert.py（できた。クリエイターとサンプルの生成プラグインを置き換え、claude plugin validate に通ることを手で確かめた。試験はまだ）
- [ ] 試験（test_convert.py）
- [ ] 試験が通る
- [ ] 最後の返事

## D1c・D1d・D1b と合わせること（先に決めた。変えるときは統括に知らせる）

### エクステンションのツール名 → MCP のツール名

- 規則：エクステンションのフォルダの名前を `<ext>` とする（`com.github.copilot/extensions/<ext>/`）。Copilot CLI でのツール名 `<ext>_<短い名前>` を、`mcp__<ext>__<短い名前>` にする。
  - サーバー名は、エクステンションのフォルダの名前そのまま（生成プラグインは生成プラグインの名前、クリエイターは `plugin-creator`）。
  - 例：`weekly-report_plan` → `mcp__weekly-report__plan`、`plugin-creator_doc_text` → `mcp__plugin-creator__doc_text`。
- したがって、EVAL の仕組みは、Agent SDK の同じプロセスの MCP サーバーを、サーバー名 `<ext>` で作り、ツール名は `<短い名前>`（`open`、`plan`、`doc_text` など）で出す。`mcpServers: { "<ext>": createSdkMcpServer({ name: "<ext>", tools }) }` の形。
- 変換スクリプトは、置き換えたすべての名前を変換レポート（`.eval/conversion-report.json`）の `extension_tools` に `{ from, to, server, tool, where }` で残す。EVAL の仕組み（D1c・D1d）は、ここにある `server` と `tool` が、自分が出すツールと過不足なく合うかを確かめられる。

（続きは「決めたこと」へ）

## 決めたこと

## 要確認

## 上位の文書で直すこと
