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

D1c へ：次の3つと package.json を、D1d が作った（`tests/dev-eval/runner/`）。D1c が先に同じ役目のものを作っていたら教えてほしい（D1d は D1c のものに寄せる）。作る前に `ls tests/dev-eval/runner/` で確かめること。試験は `model-map.test.mjs`・`isolation.test.mjs`・`mcp-tools.test.mjs`（状態の欄の印を見る）。

| ファイル | 中身（形） |
| --- | --- |
| `tests/dev-eval/package.json` | Node.js の部品の版の固定。`@anthropic-ai/claude-agent-sdk` 0.3.310（Claude Code 2.1.310 と同梱で同じ版。手元の `claude --version` も 2.1.310）、その peer の `@anthropic-ai/sdk` 1.3.0・`@modelcontextprotocol/sdk` 1.32.2・`zod` 4.6.7、`playwright` 1.56.1。`type: module`。`cd tests/dev-eval && npm install`（約 350MB。node_modules は git に入らない）。lock のファイルは置かない（C3 と同じ） |
| `model-map.mjs` | モデルの名前の対応。表は D1a の convert.py だけが持ち、変換レポート（`<置き換えた版>/.eval/conversion-report.json` の `model_map`）から読む。`readConversionReport(root)`、`modelMapOf(report)`、`toClaudeModelId(map, name)`（未知の名前は Error）、`toCopilotName(map, id)`、`copilotModelList(map)`（`[{ id, name }]`。画面の選択肢） |
| `isolation.mjs` | Agent SDK の隔離（testing.md 5章）。`ENV_ALLOW`、`agentEnv({ home, extra })`、`sandboxStatus()`（Linux は bwrap・socat が PATH にあるか。`{ available, missing }`）、`makeSandboxOptions({ enabled })`、`isInsideDir(cwd, p)`、`makeCanUseTool({ cwd, onQuestion, refused })`（AskUserQuestion は `onQuestion(questions)` の `{ 質問の文: 答え }` で答える。作業フォルダの外への Write/Edit は断る）、`allowedToolsFor({ mcpTools })`、`makeQueryOptions({ cwd, home, model, plugins, mcpServers, mcpTools, hooks, agent, systemPromptAppend, sandbox, onQuestion, refused, envExtra, maxTurns, resume, abortController })`（上をまとめた `query()` の options。`settingSources: []`、システムプロンプトは `claude_code` のプリセット〔`agent` の本文を効かせるのに要る〕、本体は SDK 同梱のもの） |
| `mcp-tools.mjs` | 同じプロセスの MCP サーバー。`createToolServer({ name, tools, onCall })` が `{ type: 'sdk', name, instance }` を返す（`mcpServers[name]` に渡す）。`tools` は `[{ name, description, inputSchema(JSON Schema そのまま), handler(args, ctx) }]`。`ctx` は `{ toolUseId, agentId, signal }`。`query()` 1回ごとに別のインスタンスを作ること。ツールは `anthropic/alwaysLoad` で、いつもプロンプトに載る。`mcpToolName(server, tool)` |

確かめて分かったこと（本物の Agent SDK 0.3.310 の Claude Code を、偽の Anthropic API〔ローカルの HTTP サーバー〕につないで確かめた。D1c も使える）：
- `ANTHROPIC_BASE_URL` に偽のサーバー、`ANTHROPIC_API_KEY` に適当な文字、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` を env で渡せば、本物の Claude Code が動く。ストリーミングの応答（SSE）を返せばよい。
- MCP のツールは、ツール検索の裏に回される（モデルには使えない）。`_meta: { "anthropic/alwaysLoad": true }` をツールに付けると、プロンプトに載る。
- MCP のツールの呼び出しの `_meta` に `claudecode/toolUseId` が入る。フックの `tool_use_id` と同じ値。
- `agent: '<プラグイン>:<エージェント>'` は、`systemPrompt: { type: 'preset', preset: 'claude_code' }` のときだけ、エージェントの本文が効く（既定の最小のシステムプロンプトでは本文が入らない）。`tools` の制限とモデルは、プリセットがなくても効く。
- `Agent` の呼び出しは、既定で裏で動く（`is_backgrounded: true`、すぐ「launched」が返る）。環境変数 `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` を渡すと、前面で動き、サブエージェントの最後の返事が返る（設計書の「sync で1体ずつ」と同じ）。

## 決めたこと

（まだ）

## 要確認

（まだ）

## 上位の文書で直すこと

（まだ）
