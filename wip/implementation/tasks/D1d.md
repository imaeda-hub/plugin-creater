# D1d 作業のメモ：内側の EVAL（tests/dev-eval/runner/ の内側の部分）

担当の指示：wip/implementation/briefs/D1.md の「D1d」の節（共通：common.md）

置き場所（これ以外は作らない・変えない）：
- tests/dev-eval/runner/ の内側の部分（ファイル名は `inner-*.mjs` を基本にする。D1c の外側の部分と名前を分ける）
- 共通の部品（Agent SDK の隔離など）は D1c と分け合う。作ったら下の「共通の部品」に置き場所と形を書く
- 試験は tests/dev-eval/ の下（実際のモデルは使わない）

## 状態

印の意味：[x] できた（試験も通った）、[~] ファイルはできた（試験はまだ）、[ ] まだ

- [x] 読み込み（testing.md、ナレッジ3つ、R4、BLUEPRINT、B1 の adapter.mjs、A1 の core、C3 の screen.mjs・grade.mjs・tasks.mjs・judge.mjs、D1a の convert.py、D1b の FORMAT.md）。憲章は CLAUDE.md の求めのとおり先頭で確かめる前に作業を始めてしまったので、最後に通して読み、反する点がないか確かめる（下の「憲章の確かめ」）
- [x] 偽の API で、本物の Agent SDK 0.3.310 の Claude Code を動かす実験（スクラッチ。分かったことは上の節）
- [x] 共通の部品：package.json、model-map.mjs、isolation.mjs、mcp-tools.mjs と、それぞれの試験（20 件通った）、fake-anthropic.mjs（偽の Anthropic API）
- [x] inner-adapter.mjs（内側のつなぎ口）、inner-run.mjs（実行1回）、inner-test-support.mjs（試験の道具）
- [x] inner-e2e.test.mjs：ありの実行・なしの実行・チャットの返事・質問のツール・止める（5 件通った。本物の Agent SDK 0.3.310 と Claude Code の本体、本物の生成プラグイン〔C2 の見本を組み立てて D1a の変換スクリプトで置き換えたもの〕の画面と Playwright を、偽の Anthropic API につないだ）
- [x] inner-judge.mjs（モデルで判定する関数の Agent SDK 版）と試験 inner-judge.test.mjs（4 件通った）
- [x] inner-run.mjs の状態の決め方の試験 inner-run.test.mjs（10 件通った。偽の Agent SDK）
- [x] inner.mjs（入口：模擬ユーザーの inner/ の課題を、あり・なしで回して比べる。コマンドライン）と試験 inner.test.mjs（8 件通った。コマンドラインを、D1b の週報の模擬ユーザー・D1c のユーザー役と通した）
- [ ] inner-adapter の単体の試験（偽の sdk）
- [ ] 止めた後に claude のプロセスが残らないことの確かめ
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
