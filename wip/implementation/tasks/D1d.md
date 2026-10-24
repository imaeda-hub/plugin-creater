# D1d 作業のメモ：内側の EVAL（tests/dev-eval/runner/ の内側の部分）

担当の指示：wip/implementation/briefs/D1.md の「D1d」の節（共通：common.md）

置き場所（これ以外は作らない・変えない）：
- tests/dev-eval/runner/ の内側の部分（ファイル名は `inner-*.mjs` を基本にする。D1c の外側の部分と名前を分ける）
- 共通の部品（Agent SDK の隔離など）は D1c と分け合う。作ったら下の「共通の部品」に置き場所と形を書く
- 試験は tests/dev-eval/ の下（実際のモデルは使わない）

## 状態

印の意味：[x] できた（試験も通った）、[~] ファイルはできた（試験はまだ）、[ ] まだ

- [ ] 読み込み（憲章、testing.md 1〜9章・11.1、ナレッジ3つ、R4、R2、B1 の adapter.mjs、C3 の screen.mjs・grade.mjs）
- [ ] 共通の部品の置き場所の決め
- [ ] 内側のつなぎ口（Agent SDK 用）
- [ ] 画面の操作
- [ ] 採点
- [ ] 試験
- [ ] 最後の返事

## 共通の部品（D1c と分け合うもの。置き場所と形）

D1c へ：次の3つは、D1d が `tests/dev-eval/runner/` に作る（最初の版は、この節を書いてから約30分以内にできる予定。できたら下の状態の欄に印を付ける）。D1c が先に同じ役目のものを作っていたら、D1d は D1c のものを使い、ここを書き直す。作る前に、`ls tests/dev-eval/runner/` で確かめること。

| ファイル | 中身（形） |
| --- | --- |
| `model-map.mjs` | Copilot のモデルの名前 → Claude Code の ID の表（D1a の convert.py の表と同じ。D1.md D1a の5つ）。`COPILOT_TO_CLAUDE`（表）、`toClaudeModelId(name)`（未知の名前は Error）、`claudeToCopilotName(id)`、`COPILOT_MODELS`（`[{ id, name }]`。画面の選択肢） |
| `isolation.mjs` | Agent SDK の隔離（testing.md 5章）。`agentEnv({ home, extra })`（環境変数の許可リスト＋一時 HOME）、`sandboxStatus()`（bubblewrap・socat が PATH にあるか）、`makeSandboxOptions({ enabled })`、`makeCanUseTool({ cwd, onQuestion, refused })`（AskUserQuestion はユーザー役へ、作業フォルダの外への Write/Edit は拒む）、`makeQueryOptions({ cwd, home, model, plugins, mcpServers, hooks, agent, agents, sandbox, allowedTools, ... })`（上をまとめて、`query()` の options を返す） |
| `mcp-tools.mjs` | 同じプロセスの MCP サーバー。`createToolServer({ name, tools, onCall })` が `{ type: 'sdk', name, instance }` を返す（`mcpServers[name]` にそのまま渡せる）。`tools` は `[{ name, description, inputSchema(JSON Schema そのもの), handler(args, ctx) }]`。`ctx` は `{ toolUseId, agentId, signal }`（`_meta['claudecode/toolUseId']` などから）。JSON Schema をそのまま MCP に出す（zod に直さない）ので、モデルに見える引数の決まりが Copilot 版と同じになる。`query()` 1回ごとに別のインスタンスを作ること（1つのサーバーは1つの接続しか持てない） |

（上は D1d が先に決めた形。D1c の都合で変えたいときは、ここに書き足すか、統括に伝える。）

## 決めたこと

（まだ）

## 要確認

（まだ）

## 上位の文書で直すこと

（まだ）
