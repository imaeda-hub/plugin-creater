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

### 呼び方と出力（D1c・D1d が使う）

- 呼び方：`python3 -I tests/dev-eval/convert.py <SRC> <OUT> [--skip-validate]`。Python から使うなら `convert.convert(src, out, validate=True)`（変換レポートの辞書を返す。断るときは `Refusal`）。
- 終了コード：0 = 変換でき、`claude plugin validate` にも通った／1 = 変換はできたが検証に通らなかった（OUT は残す）／2 = 変換を断った（SRC に plugin.json がない、OUT が前の出力でない、など）。標準出力に要点の JSON（`ok`、`out`、`plugin`、`changes`、`warnings`、`validate`、不合格のときは `validate_output`）。
- OUT の中身：`.claude-plugin/plugin.json`、`agents/<名前>.md`、`skills/…`、`.mcp.json`、`hooks/hooks.json`、`.eval/conversion-report.json`、`.eval/rules.md`（`rules/` があるとき）。置き換えた版はそのまま Agent SDK の `plugins: [{ type: 'local', path: OUT }]` で読み込める。`settings.json` は書かない（メインのエージェントのモデルは EVAL の仕組みが決める。testing.md 4章）。
- 変換レポート（`.eval/conversion-report.json`）の項目：
  - `extension_tools`：置き換えた全部のエクステンションのツール名。`{ from: "weekly-report_plan", to: "mcp__weekly-report__plan", extension, server, tool: "plan", where: [使われたファイル] }`。EVAL の仕組み（D1c・D1d）は、自分が出す MCP サーバー（サーバー名 `server`）のツール名が、`tool` の一覧を過不足なく含むか（少なくとも `tool` がすべて登録されているか）を確かめられる。
  - `extensions`：外したエクステンション `[{ name, server }]`。
  - `agents`：`[{ name, file, copilot_model, model }]`。画面で選んだモデルを入れるときは、`file` のフロントマターの `model:` を、`model_map[選んだ名前]` に書き換える。
  - `model_map`：モデルの対応の表（Copilot の名前 → Claude Code の ID）。画面で選ぶ名前を ID にするのに使う。
  - `rules_file`：`.eval/rules.md` か null。EVAL の課題の側で、指示として足す。
  - `changes`、`warnings`、`validate`（`ran`、`ok`、`exit_code`、`output`）。
- 変換は同じ入力なら同じ出力になる（試験で確かめた）。

（続きは「決めたこと」へ）

## 決めたこと

## 要確認

## 上位の文書で直すこと
