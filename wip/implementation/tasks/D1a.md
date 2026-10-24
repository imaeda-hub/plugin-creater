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

設計書（testing.md 4章）と R4 の直しのとおりに作り、決まっていない細かいところは、目的に合う最も単純なやり方にした。

試作の convert.py からの直し（R4 注 C）
- モデル：リストのとき、候補の最初の Claude を ID にする。Claude がなければ、価格表で同じ値段の Claude にする（表は5つ。ブリーフのとおり）。どれにも当たらなければ `inherit` にして警告する。`model` のないエージェントは `model: inherit`。別名（sonnet など）は使わない。`model-policy`・`modelPolicy` は外して警告。`reasoningEffort` は `effort`（low、medium、high、xhigh、max のときだけ。ほかは外して警告）。
- エクステンションのツール名：`<エクステンション>_<ツール>` を `mcp__<エクステンション>__<ツール>` にする。エージェントの tools、本文のバッククォートの名前、本文のどこにあっても（英字と下線だけのツール名の形で、エクステンションの名前で始まるもの）。`` `<エクステンション>_` `` だけの「名前の頭」の言い方も `` `mcp__<エクステンション>__` `` にする（B2 の統括の本文に「名前が `<名前>_` で始まるもの」がある）。サーバー名に使えない文字（`.` など）は下線にし、警告する（レポートの `server` を見る）。
- 会話例を外す：トップの `examples/` を写さない（クリエイターのスキルのフォルダの外にある。BLUEPRINT 1章）。
- 置き換えの直後に `claude plugin validate`：既定で動かす。警告は不合格にしない（終了コード 0 なら合格）。`--skip-validate` で飛ばせる。
- 小さな不具合：tools が文字列でも1文字ずつ処理しない。フックの `timeout`（`timeoutSec` の別名）と `powershell` だけの項目を扱う。
- 試作のうち使わなかったもの：`.eval/rules.md` はそのまま使う（クリエイターに rules はないが、生成プラグインが持つかもしれない）。
- スキルの本文は、`SKILL.md` だけでなく、スキルのフォルダの中の Markdown（`references/` など）も置き換える。`assets/`（ひな形。Copilot CLI 向けの生成プラグインの元）と `scripts/` の中は置き換えない。クリエイターの references に `plugin-creator_*` と `task` と `ask_user` が多数ある。
- 本文の `${PLUGIN_ROOT}` は置き換えない（R4 注 C-5 の「本文も置き換える」は採らなかった）。理由：Copilot CLI は本文で展開しないので、本文に書かれていても実行時の意味がなく、クリエイターの作業エージェントの本文は「生成プラグインの mcp.json に書く例」として `${PLUGIN_ROOT}` を載せている。Claude Code は本文の `${CLAUDE_PLUGIN_ROOT}` を読み込みのときに実際のパスにするので、置き換えると例が壊れる。設定ファイル（mcp.json、フック、lsp.json）の中だけ置き換える。

統括の task の引数（B2 からの引き継ぎ。公式で確かめた）
- Claude Code の Agent の引数は、Agent SDK 0.3.307 の `sdk-tools.d.ts` の `AgentInput`（公式の型）で確かめた：`description`、`prompt`、`subagent_type`、`model`、`effort`、`run_in_background`、`name`、`isolation`。`mode` は「廃止。無視される（権限モード）」の別の意味で、`"sync"` を渡しても働かない。サブエージェントの既定は裏で動く（`run_in_background` の説明：「Agents run in the background by default」。sub-agents の公式ページも同じ）。
- 置き換え：`` `task` `` → `` `Agent` ``、`` `agent_type` `` → `` `subagent_type` ``、`` `mode` `` → `` `run_in_background` ``、`` `"sync"` `` → `` `false` ``、`` `"background"` `` → `` `true` ``。統括の本文は「実行のしかた（`mode`）に `"sync"` を指定し」「`"background"` で呼んだりしない」と書いているので、置き換えると「実行のしかた（`run_in_background`）に `false` を指定し」「`true` で呼んだりしない」になる。1体ずつ終わりを待つ（前面で動かす）という意味が、Claude Code でも保たれる。
- 範囲：`` `agent_type` ``、`` `"sync"` ``、`` `"background"` `` のどれかがバッククォートで書かれている本文でだけ。`` `mode` `` は普通の単語なので、その本文にだけ（生成プラグインの作業ごとの文に `mode` という設定名があっても、巻き込まない）。
- `description`、`prompt` は両方で同じ名前なので置き換えない。

そのほか
- 写さないもの：トップの `docs/`、`tests/`、`examples/`、`wip/`、`.git`、`.github`、`.claude`、`CLAUDE.md`、`AGENTS.md`、`.gitignore`、`plugin.json`、`mcp.json`、`com.github.copilot/`（部品ごとに置き換える）。どこにあっても `heldout`、`node_modules`、`__pycache__`、`.venv`、`.pyc`。シンボリックリンクは追わず、警告して写さない。**試作は全部を写していた**ので、そのままでは `wip/` と見ない模擬ユーザーが、試されるクリエイターから読める場所に入った。いまは `tests/` を入り口で外し、中を一覧もしない（試験で、`heldout` を一覧も開きもしないことを確かめた）。
- 生成プラグインのルートの `scripts/`、`mcp/` など、MCP サーバーやフックが `${PLUGIN_ROOT}` で指すものは写す。
- OUT：ない、または前の変換の出力（`.eval/conversion-report.json` がある）のときだけ使う。ほかのフォルダは消さずに断る。SRC と OUT が重なるときも断る。
- 検証に通らなくても OUT は残す（直す手がかり）。
- Agent の `skill` → `Skill`：公式の対応表にないが、Claude Code のスキルを読み込むツールの名前が `Skill` で働きが同じなので足した。表にないもの（`task_complete`、`write_agent` など。クリエイターの本文に「あれば」の形である）は、Claude Code に同じ働きのツールがないので、そのまま残す。
- エージェントの `tools` の別名の順：`edit` は Edit、Write。`search` は Grep、Glob。`web` は WebFetch、WebSearch（testing.md 4章の表の順）。
- 本文のバッククォートの別名（`web`、`read` など、`tools` の別名）は置き換えない。testing.md 4章は「実行時のツール名」だけを本文で置き換えるとある（別名は `tools` の欄の言葉）。読み取り役の本文の「`web` は…」は、そのまま残る。`tools` の欄は WebFetch、WebSearch になっているので、意味は通る。
- 変換するのは `.md`（スキルとエージェント）、`mcp.json`、`com.github.copilot/hooks`・`commands`・`lsp.json`・`rules`、`plugin.json`。SKILL.md のフロントマターは、`allowed-tools` があるときだけ作り直し（リストにする）、ほかは元の文字のまま。
- 試験の置き場所：tests/dev-eval/test_convert.py（unittest）。

## 要確認

## 上位の文書で直すこと
