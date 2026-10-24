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

本物のモデルを使わないと確かめられないこと（この担当では使っていない）と、公式の資料にないこと。

1. 統括が `Agent` を `run_in_background: false` で呼んだとき、結果が同じ手番に返るか。型（`AgentInput`）と公式ページ（Agent SDK では Claude が待てる）から読んだだけで、動かしていない。最初の EVAL（D1d）で、統括の記録に作業・検証の結果が返っているか見る。裏で動いてしまうと、サブエージェントの組み込みツールが絞られる（公式：裏のサブエージェントは Read、Edit、Write、Bash などだけ。MCP のツールは残る）。
2. `claude -p` の init の `tools` には、Agent が `Task` の名前で出る（2.1.310。公式は「v2.1.63 で Agent に改名。`Task` は別名」）。記録の tool_use の名前が `Agent` か `Task` かは、動かしてみないと分からない。D1c・D1d は両方を受ける作りにする。
3. MCP のサーバー（Agent SDK の同じプロセスのもの）が出すツールを、プラグインのサブエージェントの `tools`（`mcp__<サーバー>__<ツール>`）で絞って渡せるか。公式は「サブエージェントはメインの会話の MCP ツールを引き継ぐ。`tools` に `mcp__<server>__*` と書ける」。同じプロセスのサーバーでも同じと読んだが、確かめていない（D1d の最初の EVAL）。
4. `.mcp.json` の stdio サーバーの `cwd`：Copilot CLI の mcp.json には `cwd` があり、Claude Code の公式の表（`command`、`args`、`env`）にない。写して警告する。`claude plugin validate` は通る。効くかは未確認。
5. `com.github.copilot/commands/` の中身：Copilot CLI のファイルの形が公式の資料にない（R3）ので、写しただけ。警告する。クリエイターと今の生成プラグインにはない。
6. `tools` が空のリスト（Copilot CLI ではツールなし）：Claude Code で空の指定がどうなるか公式に書いていない。`tools` を書かずに警告する（全部のツールが使える形になる）。今のクリエイターと生成プラグインにはない。
7. プラグイン名やエクステンション名に `.` を含むとき：Claude Code が MCP の名前をどう正規化するか公式の資料で確かめていない。エクステンションの名前は下線に直して警告し（レポートの `server`）、プラグイン自身の mcp.json のサーバーは警告だけする。
8. モデルの ID（`claude-haiku-5-5` など）が、本物のモデルでそのまま通るか。`claude plugin validate` と init の確認は、モデルの名前を調べない。
9. 試験の `claude` コマンドの版は 2.1.310（この環境）。Agent SDK 同梱の本体は 0.3.307 の 2.1.307（D1c が固定する）。変換の形は両方で同じ。init の確認は `claude` コマンドで行った。

## 上位の文書で直すこと（自分では直していない）

1. testing.md 4章：統括の `task` の引数の扱いが書かれていない。足す：Copilot CLI の `agent_type` は Claude Code の Agent の `subagent_type`、`mode: "sync"`・`"background"` は `run_in_background: false`・`true`（Claude Code の `mode` は無効の別の意味）。サブエージェントは既定で裏で動くので、1体ずつ待つには `false` が要る。変換スクリプトがバッククォートで書かれた名前と値を置き換える。
2. testing.md 4章：変数の置き換えは設定ファイル（mcp.json、フック、lsp.json）だけで、スキルとエージェントの本文では置き換えない、と書く（理由は「決めたこと」）。R4 注 C-5 を取り下げる。
3. testing.md 4章：置き換えた版に写さないものを書く。トップの `docs/`、`tests/`、`examples/`、`wip/`、`.git` など、`heldout`（どこにあっても）、シンボリックリンク。特に、見ない模擬ユーザー（tests/dev-eval/heldout/）を試されるクリエイターから隠すのは、変換スクリプトが `tests/` を写さないことに依っている。6.3・6.6 に「見ない模擬ユーザーと会話例は、置き換えた版に入れない」を足す。試作の変換は全部を写していた。
4. testing.md 4章：エクステンションのツール名の規則を書く。サーバー名はエクステンションのフォルダの名前、`<エクステンション>_<ツール>` は `mcp__<エクステンション>__<ツール>`。置き換えた名前は変換レポートの `extension_tools` に残り、EVAL の仕組みが出す MCP のツールと突き合わせられる。
5. testing.md 4章：モデルの対応の表は、変換レポートの `model_map` にも出る（画面で選ぶ名前を ID にするのに使う）。「変換スクリプトに表として持つ」と合う。
6. testing.md 4章：ツール名の対応に、公式の表にない `skill` → `Skill` を補った、と書く。表にないもの（`task_complete` など）はそのまま残す。
7. testing.md 4章：置き換えた版の中の `.eval/`（変換レポートと `rules.md`）を書く。`rules` は `.eval/rules.md` になり、EVAL の課題の側で指示として足す。
8. creator-structure.md 2章：部品の表に、変換スクリプト（tests/dev-eval/convert.py）とその試験（tests/dev-eval/test_convert.py）の行がない（R4 の指摘のとおり。追跡のため足す）。
9. testing.md 4章：置き換えた版が Claude Code に読み込まれることの確かめは、`claude plugin validate` に加えて、`claude -p` の init の `agents`・`skills` で見られる（モデルは呼ばない。つながらない接続先を指す）。試験に入れた。
