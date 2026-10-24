# R2 エクステンションと SDK の API（最新版で）

状態：完了（2026-10-22）

未着手・途中の項目：なし。実機（1.0.102）で確かめていないことは (2) の末尾にまとめた。

対象の版：Copilot CLI 1.0.102（`@github/copilot`、`@github/copilot-linux-x64`）、Copilot SDK 1.0.25（`@github/copilot-sdk`）。比べる版：Copilot CLI 1.0.98、Copilot SDK 1.0.22（設計書が確かめた版）。調べた日：2026-10-22。

取り出し先（どれも `npm pack --ignore-scripts` で取り、スクリプトは動かしていない）：

- `/tmp/claude-0/-home-user-plugin-creater/f6e65e0d-9c94-5351-8ee1-475927b3b43e/scratchpad/r2/pkg/cli/package/`：Copilot CLI 1.0.102（`@github/copilot-linux-x64` の実行ファイルに埋め込まれた `copilot.tgz` を取り出したもの）
- `/tmp/claude-0/-home-user-plugin-creater/f6e65e0d-9c94-5351-8ee1-475927b3b43e/scratchpad/r2/pkg/sdk/package/`：Copilot SDK 1.0.25
- `/tmp/claude-0/-home-user-plugin-creater/f6e65e0d-9c94-5351-8ee1-475927b3b43e/scratchpad/r2/pkg/v98dl/`：比べるための Copilot CLI 1.0.98 と Copilot SDK 1.0.22

以下、出典の書き方：「CLI 1.0.102 `copilot-sdk/types.d.ts`」は CLI のパッケージの中の SDK、「SDK 1.0.25 `dist/types.d.ts`」は SDK のパッケージを指す。

---

## (1) 実装者向けの API の要約

Copilot CLI 1.0.102 と Copilot SDK 1.0.25 で確かめた形。型の抜き書きと出典は (3) の各節にある。`@experimental` の API（`tasks.*`、`tools.updateSubagentSettings`、`model.*`、`workspaces.*`、`ToolInvocation.agentId`）は、版が上がると変わりうる。

### 1.1 つなぎ口（`extension.mjs`）の骨組み

```js
import { joinSession } from "@github/copilot-sdk/extension";   // CLI が同梱の SDK に向ける。npm で入れない（3.9）
import os from "node:os";
import path from "node:path";

const session = await joinSession({
  tools: [{
    name: "<プラグイン名>_plan",               // 読み込まれたすべてのエクステンションの中で一意（ぶつかると後のものが読み込みに失敗。3.3）
    description: "…",
    parameters: { type: "object", properties: { /* … */ }, required: [/* … */] },  // 素の JSON Schema でよい
    skipPermission: true,                      // 確認なしで動く。読み込みのときの確認に「skip tool permission prompts」が加わる
    defer: "never",                            // ツール検索の裏に回させない（任意。3.3）
    handler: async (args, invocation) => {
      // invocation.agentId：呼んだサブエージェントの番号（イベントの agentId と同じ）。メインのエージェントからは undefined
      // invocation.signal：CLI が呼び出しを終えたら abort
      return "記録しました。…";                // 文字列＝成功。例外＝失敗としてモデルに返る。{ textResultForLlm, resultType: "failure" } も返せる
    },
  }],
  hooks: {
    onPreToolUse: (input) => {                 // input: { toolName, toolArgs, agentId?, agentType?, parentAgentId?, sessionId, timestamp, workingDirectory }
      try {
        if (input.agentId && denied.has(input.agentId)) {
          return { permissionDecision: "deny", permissionDecisionReason: "…" };
        }
      } catch { /* 例外を投げない（投げると拒まずに進む。設計 4.4） */ }
      return undefined;                        // 何も返さなければ、いつもの流れ
    },
    onSubagentStop: (input) => { /* input.agentId?, input.agentType, input.agentName, input.response（最後の返事） */ },
    // クリエイター：onPostToolUse（input.toolName === "ask_user"、input.toolArgs、input.toolResult）、onUserPromptSubmitted（input.prompt）
  },
  onPermissionRequest: (request, invocation) => {   // 見るためだけ（設計 4.14）
    try { enqueuePermission(request, invocation); } catch { /* 例外を投げない（投げると SDK が user-not-available で答える） */ }
    return { kind: "no-result" };              // 答えない
  },
});
```

- フックは関数を1つでも渡すと登録される。`skipPermission` のツール、フック、`onPermissionRequest` のどれかがあると、読み込みのときに確認（`extension-permission-access`）が出る（3.10）。
- 標準出力は JSON-RPC。`console.log()` は使わない。調べるためのログは `console.error()`（`~/.copilot/logs/extensions/` に残る）か `session.log()`（チャットに出る）（3.9）。
- `process.execPath` は copilot の実行ファイル。Node.js のスクリプトを子プロセスで動かす用途に使わない（3.9）。

### 1.2 中心 → つなぎ口（`session.rpc` の呼び出し）

| 窓口 | 呼び出し | 返り値で使うもの |
| --- | --- | --- |
| 統括を起動する | `session.rpc.tasks.startAgent({ agentType: "<プラグイン>:orchestrator", prompt, name: "<実行の番号を入れた名前>", description?, model? })` | `{ agentId }`（イベントの `agentId` と同じ） |
| 取り消す | `session.rpc.tasks.cancel({ id: agentId })` | `{ cancelled: boolean }` |
| 一覧 | `session.rpc.tasks.list()` | `{ tasks: TaskInfo[] }`。`type` が `"agent"` のものだけを見る（`"shell"`・`"client"` もある）。`id`、`displayName`、`status`（`running`・`idle`・`completed`・`failed`・`cancelled`）、`executionMode`（`sync`・`background`）、`agentType`、`model`、`resolvedModel`、`latestResponse`、`idleSince` |
| 一覧から外す | `session.rpc.tasks.remove({ id })` | `{ removed: boolean }`（`running`・`idle` は外れない） |
| サブエージェントのモデルを上書き | `session.rpc.tools.updateSubagentSettings({ subagents: { agents: { "<プラグイン>:worker": { model }, "<プラグイン>:verifier": { model } } } })` | `{}` |
| 上書きを外す | `session.rpc.tools.updateSubagentSettings({ subagents: null })` | `{}`（今の値を読む窓口はない） |
| 今のモデル | `session.rpc.model.getCurrent()` | `{ modelId?, providerId?, reasoningEffort?, autoTier?, … }` |
| 選べるモデル | `session.rpc.model.list()`（`rpc.models.list` ではない。(2) の #2） | `{ list: JsonValue[], providers?, auto?, … }`。要素の形は型で決まっていない |
| チャットに書く | `session.log(message, { level: "info" \| "warning" \| "error", ephemeral? })` | なし |
| 作業フォルダ | `session.rpc.workspaces.getWorkspace()` | `{ workspace: { cwd?, git_root?, … } \| null, path? }` |
| セッションの番号 | `session.sessionId`（＝`process.env.SESSION_ID`） | — |
| `COPILOT_HOME` | `process.env.COPILOT_HOME ?? path.join(os.homedir(), ".copilot")` | — |
| エクステンションの状態 | `session.rpc.extensions.list()` | `{ extensions: [{ id: "plugin:<プラグイン>:<フォルダ>", name, source, status, pid? }] }` |

### 1.3 つなぎ口 → 中心（`session.on(type, handler)` で受けるイベント）

どのイベントも `{ id, timestamp, parentId（1つ前のイベント）, agentId?（サブエージェントの番号）, ephemeral?, type, data }`。親のエージェントは `subagent.started` の `data.parentId`（イベントの `parentId` ではない）。

| 中立のイベント | イベント | `data` で使うもの |
| --- | --- | --- |
| エージェントの開始 | `subagent.started` | `agentName`、`agentType?`、`executionMode?`、`model?`、`modelSelectionSource?`、`parentId?`、`toolCallId` |
| エージェントの設定 | `subagent.configured` | `model`、`multiTurn` |
| エージェントの終わり | `subagent.completed` | `cancelled?`、`model?`、`durationMs?`、`totalTokens?` |
| エージェントの失敗 | `subagent.failed` | `error`、`model?` |
| ツールの開始・終わり | `tool.execution_start` / `tool.execution_complete` | `toolCallId`、`toolName`、`arguments?` / `toolCallId`、`success`、`result?.content`、`error?.message` |
| 許可の求め | `permission.requested` | `requestId`、`permissionRequest`（`kind` ごとの項目は 3.6）、`promptRequest?`、`resolvedByHook?`（真なら待ちにしない） |
| 許可の終わり | `permission.completed` | `requestId`、`result`、`decisionSource?` |
| 返事の待ち・終わり | `user_input.requested` / `user_input.completed` | `requestId`、`question`、`choices?` / `requestId`、`answer?` |
| 利用の上限の待ち・終わり | `session_limits_exhausted.requested` / `.completed` | `requestId`、`maxAiCredits`、`usedAiCredits` / `requestId`、`response.action`（`add`・`set`・`unset`・`cancel`） |
| 手番を終えて待ちに入った | `system.notification` | `kind.type === "agent_idle"` のとき `kind.agentId`、`kind.agentType`、`kind.displayName?` |
| コンパクション | `session.compaction_start` / `session.compaction_complete` | `compactionAttemptId?` / `success`、`compactionAttemptId?`、`outcome?` |
| 費用 | `assistant.usage` | `model`、`inputTokens?`、`outputTokens?`、`copilotUsage?.totalNanoAiu`（÷10億 = AI クレジット）、`aiCreditsStatus?` |
| スキル | `skill.invoked` | `name`、`pluginName?` |

### 1.4 EVAL（Copilot SDK 1.0.25）

```js
import { CopilotClient, RuntimeConnection } from "@github/copilot-sdk";
const client = new CopilotClient({
  connection: RuntimeConnection.forStdio({ args: ["--plugin-dir", pluginDir], env: { ...process.env, COPILOT_PLUGIN_DIR_ONLY: "true" } }),
  workingDirectory: workDir,
});
await client.start();
const session = await client.createSession({
  model, workingDirectory: workDir, requestExtensions: true, trustWorkingDirectory: "session",
  onPermissionRequest: (request, invocation) => {
    const managed = invocation.promptRequest?.managedApprovalRequired ?? request.managedApprovalRequired;
    if (managed === true) { stopEval("組織の設定で人の承認が要る"); return { kind: "no-result" }; }
    if (request.kind === "extension-permission-access") return { kind: "approve-once" };
    if (isOutsideWorkDirWrite(request)) return { kind: "reject", feedback: "…" };
    return { kind: "approve-once" };
  },
  onUserInputRequest: () => ({ answer: "課題に書いたこと以外は決まっていません。判断して進めてください", wasFreeform: true }),
  onEvent: record,
});
const { plugins } = await session.rpc.plugins.list();
// 利用の上限：session.on("session_limits_exhausted.requested", e => session.rpc.ui.handlePendingSessionLimitsExhausted({ requestId: e.data.requestId, response: { action: "cancel" } }))
```

- 同梱のランタイムは Copilot CLI 1.0.102。手元の CLI に替えるのは `RuntimeConnection.forStdio({ path })` か `COPILOT_CLI_PATH`。
- Node.js は `^20.19.0 || >=22.12.0`。

## (2) 設計書の前提と違う最新の事実

「新しい」は 1.0.98 → 1.0.102 で変わったもの、「前から」は 1.0.98 にもあったが設計が前提にしていない（または見落としている）もの。

| # | 事実 | 新しい／前から | 効く設計書の節 |
| --- | --- | --- | --- |
| 1 | **組織の管理の印 `managedApprovalRequired` の読み方が変わった。** 許可の受け口の第2引数に `promptRequest` が渡るようになり、人の答えが要るかは `invocation.promptRequest?.managedApprovalRequired` を優先し、なければ生の `request.managedApprovalRequired` を見る。印を持つのは `commands`・`write`・`read`・`url`・`workflow` の5種類（3.5、3.11） | 新しい（SDK 1.0.25 / CLI 1.0.102） | testing.md 10.4「質問と許可の求め」（`managedApprovalRequired` の求めは自動で許可せず止める）。生成プラグインのエクステンションは答えないので影響しない |
| 2 | **エクステンションから選べるモデルの一覧を取る窓口は `session.rpc.model.list()` である。** 設計の `rpc.models.list` はサーバーの単位（`CopilotClient` の rpc）で、`joinSession` は `CopilotSession` しか返さないので、エクステンションの公開の API からは呼べない。`session.rpc.model.list()` の返り値の要素は `JsonValue` で、形が型で決まっていない（3.8） | 前から（1.0.98 も同じ） | generated-plugin-structure.md 3.2 の窓口の表（「今のモデルと、選べるモデルの一覧を返す」）、4.6、11章 #10 |
| 3 | **`/clear` のほかにも、同じセッションのままエクステンションが起動し直される。** `/extensions mode` の既定「Load & Augment」ではエージェントが `extensions_reload` を持ち（実行には利用者の許可が要る）、`/extensions mode` を Disabled にして戻しても起動し直す。このとき、セッションの番号は変わらず、裏の統括は動き続ける見込み（3.9） | 前から | generated-plugin-structure.md 6.5（自分のセッションの終わっていない実行は、すぐ途中で切れたとする）、4.13、4.4（拒む一覧の作り直し）、11章 #23。起動したときに、自分のセッションの終わっていない実行の統括が `tasks.list` に残っていないかを見て、残っていれば取り消すなどの扱いを決める必要がある |
| 4 | **Copilot SDK のセッション（`requestExtensions: true`）は、置き場所を絞らずにエクステンションを読み込む。** `COPILOT_PLUGIN_DIR_ONLY` はプラグインの見つけ方を止めるだけなので、利用者の `~/.copilot/extensions/` のエクステンションも EVAL のセッションに入る見込み（3.10） | 前から | testing.md 10.4「読み込みと隔離」（あり・なしの比べ合いに、ほかのものが混ざらないようにする） |
| 5 | **公式の CLI plugin reference の `com.github.copilot/` の表に、extensions が載っていない**（agents・commands・rules・hooks・lsp.json だけ）。置き場所の根拠は、更新履歴 1.0.79・1.0.80-0 と 1.0.98 の実測、1.0.102 の `cli-main.js`。入口のファイル名も、公式（`.mjs`・`.cjs`・`.js`）とパッケージの説明（`.mjs` だけ）で食い違う（3.10） | 公式の説明（2026-10-22 取得） | generated-plugin-structure.md 3.4、4.1、7章、出典。ナレッジ「画面と Copilot CLI のつなぎ方」 |
| 6 | **公式の About extensions は `/extensions mode` を書かなくなり、コマンドリファレンスの「Extension modes」に移った。** モードは Load & Augment（既定）・Load Only・Disabled。Disabled は以後のセッションにも残る（3.10） | 公式の説明 | generated-plugin-structure.md の出典（About extensions を `/extensions mode` の根拠にしている）、4.7（ツールがないときの直し方に、Disabled のときの戻し方も入る） |
| 7 | **`-p` では、プラグインのエクステンションは `EXTENSIONS` の旗だけで読み込まれる。** 環境変数 `GITHUB_COPILOT_PROMPT_MODE_EXTENSIONS=true` が要るのは、リポジトリの `.github/extensions/` だけ（3.10） | 前から（公式のコマンドリファレンスに載った） | testing.md 10.4（「`-p` で動かすときは EXTENSIONS の機能の旗が要る」は正しい。旗の付け方は確かめられなかった） |
| 8 | **サンドボックスの既定が、ローカルネットワークへの接続を許すようになった**（更新履歴 1.0.100）。macOS では 1.0.101 で、サンドボックスの中のコマンドが localhost の TCP につながる（3.9） | 新しい | ナレッジ「画面と Copilot CLI のつなぎ方」のサンドボックスの節（macOS の `allowLocalNetwork` がオフだと…）、generated-plugin-structure.md 4.12（エクステンションが外で動く見込みは変わらない） |
| 9 | **読み込みのときの確認は、Assisted の判定で自動にならず、必ず明示の承認になった**（更新履歴 1.0.101） | 新しい | generated-plugin-structure.md 4.1（前提は崩れない。README の案内は同じでよい）、testing.md 10.4（EVAL の `onPermissionRequest` が `extension-permission-access` に答える必要は変わらない） |
| 10 | **サブエージェントが、カスタムツールと MCP のツールの許可を引き継ぐようになった**（更新履歴 1.0.102「Subagents honor custom and MCP tool approvals, avoiding duplicate permission prompts…」） | 新しい | generated-plugin-structure.md 4.14（前提は崩れない。統括・作業・検証の確認が減る方向） |
| 11 | **`onUserPromptSubmitted` が `decision: "block"` を返せるようになった**（`reason` 付き。手番を動かさず、発言も残さない） | 新しい | hearing.md 7.4（問答の記録には使わないので前提は崩れない。新しくできること） |
| 12 | **SDK 1.0.25 の同梱のランタイムは Copilot CLI 1.0.102**（1.0.22 は 1.0.98） | 新しい | testing.md 10.4、ナレッジ「Copilot CLI の試験機能」の「SDK 1.0.22 は 1.0.98」 |
| 13 | **シェルの許可の求め（`kind: "shell"`、確認の形では `commands`）の `requestSandboxPermissive` が真のときは、「サンドボックスの外で動かす」ではなく「記録だけにして中で動かし直す」求め**（`requestSandboxBypass` も真になるが、外に出ると書いてはいけない）。パスの許可（`promptRequest` の種類 `path`）が出る場面も 1.0.101 で増えた（3.6、3.12） | 前から／1.0.101 | generated-plugin-structure.md 6.3（「サンドボックスの外で動かす求め（`requestSandboxBypass`）は目立たせる」） |
| 14 | **`tasks.list` の `tasks` には、エージェントのほかに `shell` と `client` のタスクも入る。** 木のエージェントを見るときは `type === "agent"` で絞る（3.7） | 前から | generated-plugin-structure.md 4.3・4.4・6.1（`tasks.list` で名前から統括を探す、木の状態を見る） |

設計の前提のうち、1.0.102 でも変わっていないことを確かめたもの（型と実装の比べ合い）：`joinSession` の形と `requestedEnvironmentVariables`、`onPermissionRequest` を渡さないと許可の求めが届かないこと、`no-result` と例外のときの `user-not-available`、`resolvedByHook` の扱い、フックの入力の `agentId`・`agentType`・`parentAgentId`、`onSubagentStop` の `response`、`ToolInvocation.agentId`、`tasks.startAgent`・`cancel`・`list` の形と `TaskStatus` の `idle`、`executionMode`、`updateSubagentSettings` のキーと `null`、`subagent.*` のイベントと `cancelled`、`permission.*`・`user_input.*`・`session_limits_exhausted.*` のイベント、`system.notification` の `agent_idle`、エクステンションの起動（`process.execPath` と `extension_bootstrap.mjs`）、親のプロセスの見張り（1秒ごと）、終了（SIGTERM、5秒後に SIGKILL）、`/clear` での起動し直し、読み込みのときの確認の項目と選択肢、SDK の `requestExtensions` が旗なしで効くこと。

実機（1.0.102）で確かめていないこと：エクステンションの `process.cwd()`、環境変数に `COPILOT_HOME` が入ること、埋め込みの Node.js の版、SDK のセッションで `extension-permission-access` が `onPermissionRequest` に届くこと、`pluginDirectories` でエクステンションが読み込まれるか、`extensions_reload` の後に裏の統括が動き続けること、`session.rpc.model.list()` の要素の形、Auto のときの `model.getCurrent()` の値。どれも、パッケージの中身からの判断か、1.0.98 での実測である。

## (3) 詳細と出典

### 3.1 版とパッケージの関係

| 事実 | 出典 |
| --- | --- |
| npm の最新（`latest`）は Copilot CLI 1.0.102（2026-10-21 公開）、Copilot SDK 1.0.25（2026-10-21 公開）。1.0.99 は先行版（`1.0.99-0`〜`-3`）だけで、正式版はない | `npm view @github/copilot dist-tags`・`time`、`npm view @github/copilot-sdk dist-tags`・`time`（2026-10-22） |
| SDK 1.0.25 が同梱するランタイムは Copilot CLI 1.0.102（`package.json` の `copilotCliVersion: "1.0.102"`、`copilotRuntime.version: "1.0.102"`）。ランタイムは別パッケージ `@github/copilot-sdk-<OS>-<CPU>`（optionalDependencies）に入る。SDK 1.0.22 は 1.0.98 | SDK 1.0.25・1.0.22 `package.json` |
| SDK 1.0.25 の型定義と docs（`extension.d.ts`・`types.d.ts`・`session.d.ts`・`client.d.ts`・`index.d.ts`・`generated/rpc.d.ts`・`generated/session-events.d.ts`・`docs/*.md`）は、CLI 1.0.102 に同梱の `copilot-sdk/` と1字も違わない。つまり、エクステンションが使う SDK と EVAL が使う SDK は同じ版の同じ定義である | 2つを `diff` で比べた |
| SDK の通信の版は `SDK_PROTOCOL_VERSION = 3` | SDK 1.0.25 `dist/sdkProtocolVersion.js` |
| Node.js の要件は `^20.19.0 || >=22.12.0`（1.0.22 と同じ） | SDK 1.0.25 `package.json` の `engines` |
| エクステンションの中の `@github/copilot-sdk/extension` は、利用者が入れるものではなく、CLI が自分の同梱の `copilot-sdk/extension.js` に向ける（3.9） | CLI 1.0.102 `preloads/extension_sdk_resolver.mjs`、`copilot-sdk/docs/extensions.md` |

1.0.98 → 1.0.102 で、エクステンションまわりのファイルの変わり方（`diff` の行数）：

| ファイル | 変わり方 |
| --- | --- |
| `copilot-sdk/extension.d.ts`、`docs/extensions.md`、`docs/examples.md`、`workflow.d.ts`、`canvas.d.ts`、`preloads/extension_bootstrap.mjs`、`preloads/extension_sdk_resolver.mjs` | 変わっていない |
| `copilot-sdk/types.d.ts` | 191行。許可の受け口の第2引数の型、`managedApprovalRequired` の読み方、`onUserPromptSubmitted` の返り値の `decision: "block"`、`CustomAgentConfig.modelPolicy`、セッションの設定の `sandboxConfig`・`trustWorkingDirectory`・`autopilot`、ツールの `namespace` など（下の各節） |
| `copilot-sdk/session.d.ts` | 27行。`sendAndWait` が autopilot の終わり（`session.autopilot_stopped`）でも返る、`setTools` の引数の型 |
| `docs/agent-author.md` | 3行。`onUserPromptSubmitted` の `decision`・`reason` の表の行 |
| `generated/rpc.d.ts`・`generated/session-events.d.ts` | 3128行・364行。設計が使う型で変わったものは、各節に書く |

### 3.2 `joinSession` の設定（`JoinSessionConfig`）

形（CLI 1.0.102 `copilot-sdk/extension.d.ts`。1.0.98 と同じ）：

```ts
export type JoinSessionConfig =
  Omit<ResumeSessionConfig, "onPermissionRequest" | "extensionSdkPath" | "skillProvider" | "imageGeneration"> & {
    onPermissionRequest?: PermissionHandler;
    requestedEnvironmentVariables?: string[];   // 機微な環境変数を名前で求める。断られると joinSession が reject し、読み込まれない
    workflows?: WorkflowHandle[];               // @experimental
  };
export declare function joinSession(config?: JoinSessionConfig): Promise<CopilotSession>;
```

実装で分かったこと（CLI 1.0.102 `copilot-sdk/extension.js` の `joinSession`、`client.js` の `resumeSessionInternal`）：

- セッションの番号は環境変数 `SESSION_ID` から取る。ないと「joinSession() is intended for extensions running as child processes of the Copilot CLI.」で例外になる。
- `onPermissionRequest` を渡さないと、SDK は既定の受け口 `defaultJoinSessionPermissionHandler`（いつも `{ kind: "no-result" }` を返す）を入れる。ただし CLI への登録の印 `requestPermission` は「既定の受け口でないとき」だけ真になる（`requestPermission: config.onPermissionRequest !== defaultJoinSessionPermissionHandler`）。つまり、渡さなければ許可の求めの受け口は CLI に登録されない。設計 4.14 と 11章 #21 の実測（渡さないと `permission.requested` が届かない）と合う。
- 同じく、`requestUserInput: !!config.onUserInputRequest`、`hooks: !!(config.hooks && Object.values(config.hooks).some(Boolean))`。フックは、関数を1つでも渡したときだけ登録される。
- `suppressResumeEvent` の既定は `true`（エクステンションがつながっても `session.resume` のイベントを出さない）。
- ツールは `name`・`description`・`parameters`（JSON Schema に直す）・`overridesBuiltInTool`・`skipPermission`・`defer`・`metadata`・`isTerminal`・`namespace` が CLI に送られる。`handler` は SDK の中に残り、CLI からの `external_tool.requested` で呼ばれる。

`JoinSessionConfig` で使える主な項目（`SessionConfigBase` から。SDK 1.0.25 `dist/types.d.ts`）：`tools`、`hooks`、`onPermissionRequest`、`onUserInputRequest`、`onElicitationRequest`、`commands`（スラッシュコマンド）、`onEvent`（つながる前から受けるイベントの受け口）、`systemMessage` など。

### 3.3 ツールと `ToolInvocation`

```ts
// SDK 1.0.25 dist/types.d.ts（抜き書き）
export interface Tool<TArgs = unknown> {
  name: string;
  description?: string;
  parameters?: ZodSchema<TArgs> | Record<string, unknown>;   // 素の JSON Schema でもよい
  handler?: ToolHandler<TArgs>;
  overridesBuiltInTool?: boolean;
  skipPermission?: boolean;          // true なら許可の確認なしで動く
  defer?: "auto" | "never";          // 既定 "auto"：ツールが多いとき、ツール検索の裏に回される（遅れて読み込む）ことがある
  metadata?: Record<string, unknown>;
  isTerminal?: boolean;              // 成功するとその手番を終える
  namespace?: ToolNamespace;         // 1.0.102 で足された（@experimental）
}
export type ToolHandler<TArgs = unknown> = (args: TArgs, invocation: ToolInvocation) => Promise<unknown> | unknown;
export interface ToolInvocation {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  availableTools?: CurrentToolMetadata[];  // ツール検索のツールのときだけ
  traceparent?: string;
  tracestate?: string;
  signal?: AbortSignal;    // CLI がその呼び出しを終えたか、切れたときに abort
  agentId?: string;        // @experimental 呼んだサブエージェントの番号（イベントの agentId と同じ）。メインのエージェントからの呼び出しでは undefined
  requestId?: string;      // @experimental
}
export type ToolResultType = "success" | "failure" | "rejected" | "denied" | "timeout";
export type ToolResultObject = { textResultForLlm: string; resultType: ToolResultType; error?: string; sessionLog?: string; binaryResultsForLlm?: ToolBinaryResult[]; toolTelemetry?: ToolTelemetry; toolReferences?: string[] };
```

- 返り値：文字列はそのまま成功。`null`・`undefined` は空の成功。オブジェクトは `ToolResultObject` の形ならそのまま、そうでなければ `JSON.stringify` される。関数が例外を投げると、その文がエラーとしてモデルに返る（SDK 1.0.25 `dist/session.js` の `_executeToolAndRespond`、`docs/agent-author.md` Gotchas）。
- `ToolInvocation.agentId` は、SDK が CLI のイベント `external_tool.requested` の `agentId` をそのまま渡したもの（`session.js` の `_handleBroadcastEvent`）。1.0.98 と同じ。
- ツールの名前は、読み込まれたすべてのエクステンションの中で一意でなければならない。ぶつかると、後のエクステンションが読み込みに失敗する（`docs/agent-author.md` の Constraints と Gotchas）。
- `defer` の既定 `"auto"` は 1.0.98 にもある（新しくない）。ツールの総数が閾値を超えると、MCP とエクステンションのツールがツール検索の裏に回されうる（`types.d.ts` の `ToolSearchConfig` の説明）。記録のツールを必ず見せたいなら `defer: "never"` を付けられる。

### 3.4 フック（`SessionHooks`）

入力の共通部分（SDK 1.0.25 `dist/types.d.ts`。1.0.98 と同じ）：

```ts
export interface BaseHookInput {
  agentId?: string;        // サブエージェントの番号。メインのエージェントのフックと古いランタイムではない
  agentType?: string;      // 分かるとき
  parentAgentId?: string;  // 直の親の番号（分かるとき）
  sessionId: string;       // 子のツールのフックは子のセッションの番号、サブエージェントの開始・終わりのフックは親のセッションの番号
  timestamp: Date;
  workingDirectory: string;
}
```

| フック | 入力（`BaseHookInput` に足すもの） | 返り値 | 1.0.98 からの変化 |
| --- | --- | --- | --- |
| `onPreToolUse` | `toolName`、`toolArgs` | `{ permissionDecision?: "allow" \| "deny" \| "ask"; permissionDecisionReason?; modifiedArgs?; additionalContext?; suppressOutput? }` か `void` | なし |
| `onPostToolUse` | `toolName`、`toolArgs`、`toolResult: ToolResultObject` | `{ modifiedResult?; additionalContext?; suppressOutput? }` か `void`。成功の結果のときだけ呼ばれる | なし |
| `onPostToolUseFailure` | `toolName`、`toolArgs`、`error: string` | `{ additionalContext? }`。`resultType` が `"failure"` のときだけ（`rejected`・`denied`・`timeout` では呼ばれない） | なし |
| `onUserPromptSubmitted` | `prompt` | `{ modifiedPrompt?; additionalContext?; suppressOutput?; decision?: "block"; reason? }` | **`decision: "block"` と `reason` が足された**（1.0.102）。`block` すると手番は動かず、ユーザーの発言も残らず、`session.warning`（`warningType: "policy_blocked"`）が出る |
| `onUserPromptTransformed` | `prompt`、`transformedPrompt` | `{ modifiedTransformedPrompt? }` | なし |
| `onSessionStart` | `source: "startup" \| "resume" \| "new"`、`initialPrompt?` | `{ additionalContext?; modifiedConfig? }` | なし |
| `onSessionEnd` | `reason: "complete" \| "error" \| "abort" \| "timeout" \| "user_exit"`、`finalMessage?`、`error?` | `{ suppressOutput?; cleanupActions?; sessionSummary? }` | なし |
| `onErrorOccurred` | `error`、`errorContext`、`recoverable` | `{ suppressOutput?; errorHandling?: "retry" \| "skip" \| "abort"; retryCount?; userNotification? }` | なし |
| `onAgentStop` | `stopReason?`、`transcriptPath?`、`stopHookActive?` | `{ decision?: "block"; reason? }`。メインのエージェントだけ | なし |
| `onSubagentStart` | `transcriptPath`、`agentName`、`agentDisplayName?`、`agentDescription?` | `{ additionalContext? }`（子の最初の指示の前に足す） | なし |
| `onSubagentStop` | 上に加えて `agentId?`、`agentType`、`stopReason: "end_turn"`、`response`（子の最後の返事） | `{ decision: "block"; reason; modifiedResponse? }` か `{ decision?: "allow"; modifiedResponse? }` | なし |
| `onPreMcpToolCall` | `toolCallId?`、`serverName`、`toolName`、`arguments`、`_meta?` | `{ metaToUse? }` | なし |

関数の型はどれも `(input, invocation: { sessionId: string }) => Promise<Output | void> | Output | void`。

### 3.5 許可の求めの受け口（`onPermissionRequest`）

```ts
// SDK 1.0.25 dist/types.d.ts（抜き書き）
export type PermissionRequest = GeneratedPermissionRequest & { readonly managedApprovalRequired?: boolean };
export type PermissionRequestResult = PermissionDecisionRequest["result"] | { kind: "no-result" };
export interface PermissionHandlerInvocation {          // 1.0.102 で名前の付いた型になり、promptRequest が足された
  sessionId: string;
  managedSettingsEnabled?: boolean;
  promptRequest?: PermissionRequestedData["promptRequest"];
}
export type PermissionHandler = (request: PermissionRequest, invocation: PermissionHandlerInvocation)
  => Promise<PermissionRequestResult | AttributedPermissionResult> | PermissionRequestResult | AttributedPermissionResult;
```

- 1.0.98 では第2引数は `{ sessionId; managedSettingsEnabled? }` だった。1.0.102 で `promptRequest`（利用者に見せる確認の形）が足された。
- `managedApprovalRequired`（組織の管理の設定で、人の答えが要る印）の読み方が変わった。1.0.98 の説明は「管理の設定が人の決めを求めていることを示す。自動の承認を飛ばして、ふつうの確認を出すべき」だった。1.0.102 では「生の `permissionRequest.managedApprovalRequired` は管理の方針の出どころと1回限りの制約を残す。人の答えがまだ要るかは、`promptRequest` があればその `managedApprovalRequired` を優先し、なければ生の印に戻る」。さらに「Assisted の承認の後に人の要件を外せるのは、`promptRequest` の種類が `commands`・`read`・`write`・`url`・`workflow` のときだけ。それ以外と `promptRequest` がないときは、生の印を正とする」（`types.d.ts` の `PermissionRequest` と `PermissionHandlerInvocation` の説明、SDK 1.0.25 `README.md` の Permission Handling）。
- SDK の README の手本は、`managedApprovalRequired === true` なら `{ kind: "no-result" }` を返して人の確認に任せる形である（SDK 1.0.25 `README.md`）。
- SDK の実装（SDK 1.0.25 `dist/session.js`）：
  - `permission.requested` が届くと、`resolvedByHook` が真なら何もしない。受け口があれば呼ぶ。
  - 受け口が `{ kind: "no-result" }` を返すと、何も答えない。
  - 受け口が例外を投げると、`{ kind: "user-not-available" }` で答えてしまう（1.0.98 と同じ。設計 4.14 のとおり）。
- 許可の求めの種類（`permissionRequest.kind`）：`shell`、`write`、`read`、`mcp`、`url`、`memory`、`custom-tool`、`hook`、`extension-management`、`workflow`、`extension-permission-access`、`extension-env-access`（`session-events.d.ts` の `PermissionRequest`。1.0.98 と同じ）。画面に出す項目は 3.6 の表。
- 答えの形（`PermissionDecision`）の `kind`：`approve-once`、`approve-for-session`、`approve-read-only-for-session`、`approve-for-location`、`approve-permanently`、`reject`（`feedback?`）、`user-not-available` ほか（`rpc.d.ts` の `PermissionDecision`）。README の手本は `{ kind: "approve-once" }` と `{ kind: "reject", feedback }` を使う。

### 3.6 セッションのイベント

イベントの外側（どのイベントも同じ。SDK 1.0.25 `dist/generated/session-events.d.ts`。1.0.98 と同じ）：

```ts
interface XxxEvent {
  agentId?: string;        // サブエージェントの番号。メインのエージェントとセッション単位のイベントではない
  data: XxxData;
  ephemeral?: boolean;     // 真なら、ディスクのイベントの記録に残らない
  id: string;              // イベントの番号（UUID）
  parentId: string | null; // 1つ前のイベントの番号（イベントの鎖）。親のエージェントではない
  timestamp: string;
  type: "xxx";
}
```

注意：`event.parentId` は「1つ前のイベント」で、親のエージェントの番号ではない。`subagent.started` の親のエージェントは `event.data.parentId`（下）。

| イベント | `data` の主な項目 | 1.0.98 からの変化 |
| --- | --- | --- |
| `subagent.started` | `agentName`、`agentDisplayName`、`agentDescription`、`agentType?`、`executionMode?`（`"sync"`・`"background"` の文字列）、`model?`、`modelSelectionSource?`、`taskModelSource?`、`parentId?`（生んだサブエージェントのタスクの番号。メインのセッションが生んだときはない）、`toolCallId`、`resumable?`、`workflowRunId?` | なし |
| `subagent.configured` | `model`（決まったモデル）、`multiTurn`、`reasoningEffort?`、`contextTier?` | なし |
| `subagent.completed` | `agentName`、`agentDisplayName`、`cancelled?`（取り消しで終わったら真。取り消しは失敗ではないので completed が出る）、`model?`、`firstDispatchedModel?`、`modelSelectionSource?`、`durationMs?`、`totalTokens?`、`totalToolCalls?`、`toolCallId` など | なし |
| `subagent.failed` | `agentName`、`agentDisplayName`、`error`、`model?`、`durationMs?`、`toolCallId` など | なし |
| `tool.execution_start` | `toolCallId`、`toolName`、`arguments?`、`model?`、`mcpServerName?`、`mcpToolName?`、`shellToolInfo?`、`turnId?`、`parentToolCallId?`（非推奨） | なし |
| `tool.execution_complete` | `toolCallId`、`success`、`result?`（`content`、`detailedContent?` など）、`error?`（`message`、`code?`）、`model?`、`sandboxed?`、`turnId?` | `toolUsage?` が足された（設計に影響なし） |
| `permission.requested` | `requestId`、`permissionRequest`、`promptRequest?`、`resolvedByHook?`、`permissionMode?`、`agentMode?`、`ownerSessionId?`、`ownerAgentId?`、`riskAssessment?`。どのエージェントの求めかは外側の `agentId` | `fusion?` が足された（設計に影響なし） |
| `permission.completed` | `requestId`、`result`、`decisionSource?`（`assisted_approval`・`human_response`・`host_policy`・`unattended_fallback`・`authorization_carry_forward`）、`toolCallId?`、`blocker?` | なし |
| `user_input.requested` | `requestId`、`question`、`choices?`、`allowFreeform?`、`toolCallId?` | なし |
| `user_input.completed` | `requestId`、`answer?`、`wasFreeform?` | なし |
| `session_limits_exhausted.requested` | `requestId`、`maxAiCredits`、`usedAiCredits` | なし |
| `session_limits_exhausted.completed` | `requestId`、`response: { action: "add" \| "set" \| "unset" \| "cancel"; additionalAiCredits?; maxAiCredits? }` | なし |
| `system.notification` | `content`、`kind`（`type` で分かれる）。`agent_idle`：`{ type, agentId, agentType, description?, displayName? }`。`agent_completed`：`{ type, agentId, agentType, status: "completed" \| "failed", description?, displayName?, prompt? }` | なし |
| `session.compaction_start` | `compactionAttemptId?`、`trigger?`、`currentTokens?`、`tokenLimit?`、`model?` など | `compactionAttemptId`・`switchTargetModel`・`targetPromptTokenLimit` が足された（hearing.md 2.2 で 1.0.101 として書いたもの） |
| `session.compaction_complete` | `success`、`compactionAttemptId?`、`outcome?`、`outcomeReason?`、`failureReason?`、`trigger?`、`preCompactionTokens?`、`postCompactionTokens?`、`summaryContent?` など | 上と同じく項目が足された（1.0.98 の項目は残る） |
| `assistant.usage` | `model`、`inputTokens?`、`outputTokens?`、`cacheReadTokens?`、`copilotUsage?: { totalNanoAiu: number; model? }`、`aiCreditsStatus?: "complete" \| "partial" \| "unavailable"`、`initiator?`（`"sub-agent"` など）、`interactionType?`、`isAuto?`、`duration?` など | 通信の圧縮の項目が足された（設計に影響なし） |
| `skill.invoked` | `name`、`path`、`content`、`pluginName?`、`pluginVersion?`、`source?`、`trigger?`、`allowedTools?` | なし |
| `session.idle` | `aborted?`、`mode?`。「裏のエージェントもつないだシェルもない」ときに出る（`IdleData` の説明） | なし |

- `aiCreditsStatus` の `unavailable` は「金額の報告がなかった」で、0 は「費用 0」を意味しない（`AiCreditsStatus` の説明）。
- 1.0.102 で新しく足されたイベント：`mcp.oauth_recovery_completed`、`session.autopilot_stopped`、`session.mcp_server_tools_loaded`（イベントの名前の一覧を 1.0.98 と比べた）。

許可の求めの種類ごとの、画面に出せる項目（`session-events.d.ts`）：

| 種類 | 項目 |
| --- | --- |
| `shell` | `fullCommandText`、`intention`、`commands`、`possiblePaths`、`possibleUrls`、`hasWriteFileRedirection`、`warning?`、`requestSandboxBypass?`、`requestSandboxBypassReason?`、`requestSandboxPermissive?`、`managedApprovalRequired?`、`toolCallId?` |
| `write` | `fileName`、`intention`、`diff`、`newFileContents?`、`requestSandboxBypass?`、`managedApprovalRequired?`、`toolCallId?` |
| `read` | `path`、`intention`、`requestSandboxBypass?`、`managedApprovalRequired?`、`toolCallId?` |
| `mcp` | `serverName`、`toolName`、`toolTitle`、`args?`、`readOnly`、`toolCallId?` |
| `url` | `url`、`intention`、`redirectedFrom?`、`requestSandboxBypass?`、`managedApprovalRequired?`、`toolCallId?` |
| `custom-tool` | `toolName`、`toolDescription`、`args?`、`skipPermission?`、`toolCallId?` |
| `extension-permission-access` | `extensionName`、`capabilities: string[]`、`toolCallId?` |
| `extension-env-access` | `extensionName`、`environmentVariables: string[]`、`toolCallId?` |

`requestSandboxPermissive` が真のときは、サンドボックスの外ではなく「記録だけにして中で再実行する」求めなので、「サンドボックスの外で動かす」と書いてはいけない（`PermissionRequestShell` の説明）。

### 3.7 `session.rpc.tasks`

```ts
// SDK 1.0.25 dist/generated/rpc.d.ts（どれも @experimental。1.0.98 と同じ）
tasks.startAgent(params: TasksStartAgentRequest): Promise<TasksStartAgentResult>;
tasks.list(): Promise<TaskList>;
tasks.cancel(params: { id: string }): Promise<{ cancelled: boolean }>;
tasks.remove(params: { id: string }): Promise<{ removed: boolean }>;   // 終わったか取り消したタスクを一覧から外す。running・idle は false（先に cancel）
tasks.sendMessage(params: { id: string; message: string; fromAgentId?: string }): Promise<{ sent: boolean; error?: string }>;
// ほかに register、update、refresh、waitForPending、getProgress、readOutput、getCurrentPromotable、promoteToBackground、promoteCurrentToBackground

export interface TasksStartAgentRequest {
  agentType: string;      // 例：'explore'、'task'、'general-purpose'。プラグインのエージェントは '<プラグイン>:<エージェント>'（設計 11章 #4 で確かめた）
  prompt: string;
  name: string;           // 表示用の名前（一意でなくてよい）。tasks.list の displayName に出る
  description?: string;
  model?: string;         // モデルの上書き
}
export interface TasksStartAgentResult { agentId: string; }
export interface TaskList { tasks: TaskInfo[]; }
export type TaskInfo = TaskAgentInfo | TaskClientInfo | TaskShellInfo;   // type で分かれる："agent" | "client" | "shell"
export interface TaskAgentInfo {
  type: "agent"; id: string; toolCallId: string; displayName?: string; description: string;
  status: TaskStatus; startedAt: string; completedAt?: string; error?: string;
  agentType: string; prompt: string; result?: string; model?: string; resolvedModel?: string;
  executionMode?: TaskExecutionMode; latestResponse?: string; idleSince?: string; activeTimeMs?: number; canPromoteToBackground?: boolean;
}
export interface TaskShellInfo {
  type: "shell"; id: string; description: string; status: TaskStatus; startedAt: string; completedAt?: string;
  command: string; attachmentMode: TaskShellInfoAttachmentMode; executionMode?: TaskExecutionMode; logPath?: string; pid?: number;
}
export type TaskStatus = "running" | "idle" | "completed" | "failed" | "cancelled";
export type TaskExecutionMode = "sync" | "background";
```

- `TaskInfo` には、エクステンションなどが登録したタスク（`TaskClientInfo`、`type: "client"`）も入る（1.0.98 にもある）。木のエージェントを探すときは `type === "agent"` で絞る。
- `TaskAgentInfo.resolvedModel`（実際に決まったモデル）も取れる。

### 3.8 `tools.updateSubagentSettings`、モデル、ログ

```ts
// SDK 1.0.25 dist/generated/rpc.d.ts（どれも @experimental。設定の型は 1.0.98 と同じ）
session.rpc.tools.updateSubagentSettings(params: UpdateSubagentSettingsRequest): Promise<{}>;
export interface UpdateSubagentSettingsRequest { subagents?: SubagentSettings | null; }  // null で、このセッションの上書きを外す
export type SubagentSettings = {
  agents?: { [agentType: string]: SubagentSettingsEntry | undefined };  // キーは agent_type（プラグインのエージェントは '<プラグイン>:<エージェント>'。設計 11章 #5）
  disabledSubagents?: string[];
  maxConcurrency?: number;
  maxDepth?: number;
} | null;
export interface SubagentSettingsEntry {
  model?: string; modelPolicy?: AgentModelPolicy; effortLevel?: string; contextTier?: ...; autoInvoke?: boolean;
}
```

- 説明は「このセッションの生きた上書きを置く。消すまで、保存されたユーザーの設定より優先する」。今の上書きを読む RPC は、1.0.102 の `rpc.d.ts` にも見当たらない（`get` に当たるものがない）。
- 置き換えか一部の足し込みかは、型と説明からは決められない（確かめられなかった）。

モデル（SDK 1.0.25 `dist/generated/rpc.d.ts`）：

```ts
session.rpc.model.getCurrent(): Promise<CurrentModel>;
export interface CurrentModel {
  modelId?: string; providerId?: string; reasoningEffort?: string; contextTier?: ContextTier;
  autoTier?: AutoTier; pendingAutoTier?: AutoTier | null; activatingAutoTier?: AutoTier | null;
  planBaseModelId?: string; planBaseProviderId?: string;
}
session.rpc.model.list(params?: { skipCache?: boolean }): Promise<SessionModelList>;   // セッションの認証と環境で選べるモデル
export interface SessionModelList {
  list: JsonValue[];   // 好ましい既定が先頭。BYOK のモデルは 'provider/id'
  providers?: ModelProviderDescriptor[]; modelPriceCategories?: SessionModelPriceCategory[];
  quotaSnapshots?: {...}; auto?: AutoTierMetadata;
}
// サーバーの単位（CopilotClient の rpc）。エクステンションの joinSession からは触れない（3.9）
client.rpc.models.list(params: { selectionId?: string; gitHubToken?: string }): Promise<ModelList>;  // ModelList = { models: Model[]; auto?; imageModels? }
```

- `session.rpc.model.list` の説明は「つながったホスト（CLI の画面、GitHub App）は、セッションのクライアントを通してこれを呼ぶべき」。1.0.98 にもある。
- 1.0.102 で `ModelList` に `auto?` と `imageModels?` が足された（`imageModels` はチャットのモデルとして選んではいけない）。

チャットに書く（SDK 1.0.25 `dist/session.d.ts`）：

```ts
session.log(message: string, options?: { level?: "info" | "warning" | "error"; ephemeral?: boolean }): Promise<void>;
session.on<K extends SessionEventType>(eventType: K, handler: (event) => void): () => void;   // 返り値で受け取りをやめる
session.on(handler: (event: SessionEvent) => void): () => void;
```

- エクステンションでは `console.log()` を使ってはいけない。標準出力は JSON-RPC の通り道である（SDK 1.0.25 `docs/agent-author.md` Gotchas）。

### 3.9 エクステンションの起動・環境・終了

起動のしかた（CLI 1.0.102。どれも 1.0.98 と同じ）：

- CLI は、セッションごとにエクステンションを起動する。起動に渡すもの：`copilotHome`、`projectRoot`（git のルート。なければ作業フォルダ）、`sessionStatePath`、`workingDirectory`（セッションの作業フォルダ）、`sdkPath`、`launcherProgram: process.execPath`、`blockedEnv`（シェルと MCP から外す環境変数の名前）、`pluginDirs`（インストールしたプラグインと `--plugin-dir` などの追加のプラグイン）（`cli-main.js` の `setupExtensionsForSession` → ネイティブの `installSessionExtensions`）。
- 起動するプログラムは CLI 自身の実行ファイル（`process.execPath`）で、引数に `extension_bootstrap.mjs` があると、CLI の入口（`index.js`）が自分の `preloads/extension_bootstrap.mjs` を読み込む。
- 実行ファイルの中の Node.js の版の文字列は `v24.20.0`（1.0.98 も同じ。`copilot` の実行ファイルの `nodejs.org/download/release/v24.20.0`）。エクステンションはこの埋め込みの Node.js で動く見込み（1.0.102 では実測していない。1.0.98 で `process.execPath` が copilot の実行ファイルだったことは設計 11章 #2）。
- 起動用のファイル `extension_bootstrap.mjs`（全文を読んだ。1.0.98 と同じ）：
  1. 環境変数 `COPILOT_EXTENSION_PARENT_PID` が親の番号と合わなければ、すぐ終わる。
  2. 1秒ごとに、親の番号が変わっていないか（`process.ppid`）と、親が生きているか（`process.kill(parentPid, 0)`）を見て、違えば `process.exit(0)` で終わる。設計 4.2 の「異常終了でも約1秒で終わる」はこの仕組みで、同じプロセスの画面のサーバーも一緒に終わる。
  3. `@github/copilot-sdk` と `@github/copilot-sdk/extension` を、`COPILOT_SDK_PATH`（CLI に同梱の `copilot-sdk/`）の `index.js`・`extension.js` に向ける（ESM は `Module.register` の解決フック、CJS は `Module._resolveFilename`）。それ以外の読み込みは Node.js のふつうの解決に任せる。
  4. 環境変数 `EXTENSION_PATH` のファイルを `import` する。
- エクステンションの中で使える環境変数（パッケージの中身で分かったもの）：`SESSION_ID`（セッションの番号。`joinSession` が使う）、`COPILOT_EXTENSION_PARENT_PID`、`COPILOT_SDK_PATH`、`EXTENSION_PATH`（`extension_bootstrap.mjs`）。
- 機微な環境変数（例：`GITHUB_TOKEN`）は、起動の前に外される（`docs/extensions.md`）。外す一覧の全体は、ネイティブの部分にあり確かめられなかった。

作業フォルダ、セッションの番号、`COPILOT_HOME` を知るやり方：

| 知りたいもの | やり方 | 確かさ |
| --- | --- | --- |
| セッションの番号 | `session.sessionId`（`joinSession` の返り値）か `process.env.SESSION_ID` | パッケージの中身で確か（`extension.js`） |
| 作業フォルダ | `(await session.rpc.workspaces.getWorkspace()).workspace?.cwd`。フックの入力の `workingDirectory` にも入る。`process.cwd()` は、CLI がセッションの作業フォルダを渡して起動するので同じになる見込み（`setupExtensionsForSession` の `workingDirectory`、`docs/examples.md` が `process.cwd()` をリポジトリとして使う例） | `getWorkspace` とフックは型で確か。`process.cwd()` は実測していない |
| セッションのフォルダ | `(await session.rpc.workspaces.getWorkspace()).path`、`session.workspacePath` | 型で確か |
| `COPILOT_HOME` | `process.env.COPILOT_HOME ?? path.join(os.homedir(), ".copilot")`。1.0.98 で `COPILOT_HOME` が渡ることは実測済み（設計 11章 #9）。1.0.102 の起動のしかたは 1.0.98 と同じ | 1.0.102 では実測していない。利用者が廃止予定の `--config-dir` で設定フォルダを変えていると、環境変数がなく `~/.copilot` に倒れる恐れがある（確かめられなかった） |
| プラグインの場所 | `import.meta.url` からたどる（設計 6.5 のとおり。`PLUGIN_ROOT`・`PLUGIN_DATA` は渡らない、設計 11章 #9） | 1.0.98 で実測 |

Node.js の機能と外部の npm パッケージ：

- `node:http`、`node:zlib`、`node:child_process`、`node:fs`、`node:crypto` は Node.js の組み込みなので使える（公式の手本 `docs/examples.md` が `node:child_process`・`node:fs`・`fetch` を使う）。
- `@github/copilot-sdk` 以外のパッケージは、エクステンションのファイルの場所からのふつうの解決（隣の `node_modules`）になる。公式の Creating an extension は「同梱の SDK だけを使うので、`package.json` もパッケージの管理も要らない」とだけ書き、外部のパッケージの使い方は書いていない。プラグインのインストールが `node_modules` を写すかは確かめられなかった。設計どおり、組み込みの機能だけで書くのが安全である。
- 注意：`process.execPath` は Node.js ではなく copilot の実行ファイルである。子プロセスで Node.js のスクリプトを動かしたいときに `process.execPath` を使うと、copilot の CLI が起動する（`index.js` は引数に `extension_bootstrap.mjs` があるときだけ特別に扱う）。`gh` など外のコマンドは、ふつうに `execFile` で呼べる。
- 標準出力は JSON-RPC の通り道なので、`console.log()` を使ってはいけない。`console.error()`（標準エラー）は使える。エクステンションのログは `~/.copilot/logs/extensions/` にあり、`/extensions manage` で状態とログのファイルの場所が見える（Creating an extension、2026-10-22 に取得）。

終了と読み込み直し：

- Copilot CLI を終えると、エクステンションは止められる（SIGTERM、5秒後に SIGKILL）（`docs/extensions.md`。1.0.98 と同じ）。
- `/clear`（と前に出ているセッションの入れ替え）で読み込み直される（同）。1.0.102 の実装でも、セッションが変わると `startExtensions(..., "reload")` を `retainProcessesIfUnchanged: false` で呼ぶので、プロセスは起動し直される（`cli-main.js` の `registerSession`・`startExtensions`。1.0.98 と同じ）。
- **`/clear` 以外にも、同じセッションのままエクステンションが起動し直されることがある**（1.0.98 から同じ。設計が見ていない点）：
  - `/extensions mode` が既定の「Load & Augment」だと、エージェントは `extensions_reload` などの管理のツールを持つ。`extensions_reload` は「動いているすべてのエクステンションを止め、見つけ直して起動し直す」（`docs/agent-author.md`）。実行には利用者の許可（`extension-management` の求め。画面の文は「Copilot wants to reload extensions.」）が要る（`cli-main.js`）。
  - `/extensions mode` を Disabled にすると、動いているプロセスが止まり、ツールが消える。読み込むモードに戻すと起動し直す（公式のコマンドリファレンスの Extension modes）。
  - このとき、セッションの番号は変わらず、裏の統括は動き続ける見込み（`tasks` はセッションのものなので）。設計 6.5 の「自分のセッションの終わっていない実行は、すぐ途中で切れたとする」がこの場合に合わない（(2) の #3）。

サンドボックス：

- サンドボックスに入れるかの設定は、MCP サーバー（`sandboxMcpServers`）と LSP サーバー（`sandboxLspServers`）にはあるが、エクステンションのものは 1.0.102 のネイティブの文字列にも見当たらない。エクステンションが外で動く見込みは変わらない（実測はしていない。設計 11章 #3）。
- 更新履歴 1.0.100：「Sandbox allows local network access by default so commands can reach localhost and private-network services.」。1.0.101：「macOS sandboxed commands can connect directly to localhost TCP services when local access is enabled and no host filters apply.」。ナレッジ「画面と Copilot CLI のつなぎ方」の「macOS では `allowLocalNetwork` がオフだと…」の既定が変わった。

### 3.10 読み込みの条件と、読み込みのときの確認

読み込みの条件（CLI 1.0.102 `cli-main.js`。1.0.98 と同じ）：

| 動かし方 | 条件 | 読み込む置き場所 |
| --- | --- | --- |
| 対話モード | 機能の旗 `EXTENSIONS`（`/experimental on` か `--experimental` で入る）。`/extensions mode` が Disabled でないこと | すべて（ネイティブが決める） |
| `-p`（プロンプトモード） | `EXTENSIONS` の旗が要る（`if(!e.EXTENSIONS)return`）。`/extensions mode` が Disabled でないこと | `user`・`plugin`・`session`。`project`（`.github/extensions/`）は環境変数 `GITHUB_COPILOT_PROMPT_MODE_EXTENSIONS=true` のときだけ |
| Copilot SDK のセッション | `requestExtensions: true`（旗は要らない）。`requestExtensions` を省くと、`enableConfigDiscovery: true` かつ `EXTENSIONS` の旗のときだけ。`false` なら読み込まない（`shouldLoadExtensionsForSession`） | 置き場所を絞らない（`includeSources` を渡さない）。利用者の `~/.copilot/extensions/` のエクステンションも読み込まれる見込み |

- `GITHUB_COPILOT_PROMPT_MODE_EXTENSIONS` は公式のコマンドリファレンスの環境変数の表にある：「Set to `true` to load project extensions and allow extension management tools in prompt mode (`-p`). Disabled by default…」（2026-10-22 に取得）。
- プラグインの `com.github.copilot/extensions/<名前>/` は、1.0.102 でも読まれる（更新履歴 1.0.79「Agent Plugins spec plugins can now ship extensions under a com.github.copilot/extensions/ directory」、1.0.80-0 でルートからは読まなくなった。1.0.102 の `cli-main.js` にも、プラグインのインストールの確認で `com.github.copilot/extensions/` を「extension or canvas code」と示す処理がある）。**ただし、公式の CLI plugin reference の「Copilot CLI reads its client-specific components from the `com.github.copilot` directory」の表には、agents・commands・rules・hooks・lsp.json だけが載っていて、extensions は載っていない**（2026-10-22 に取得）。
- 入口のファイル名：公式の Creating an extension は「`extension.mjs`、`extension.cjs`、`extension.js`」とし、パッケージの `docs/extensions.md`・`docs/agent-author.md` は「`.mjs` だけ」とする。食い違うので、`extension.mjs` にしておけばどちらにも合う（設計 7章と同じ）。
- エクステンションの名前（`id`）は `plugin:<プラグイン>:<フォルダ>` の形（`rpc.d.ts` の `Extension.id` の説明。設計 11章 #1 で実測）。状態は `session.rpc.extensions.list()` で `running`・`disabled`・`failed`・`starting` が分かる。

読み込みのときの確認（CLI 1.0.102 `cli-main.js` の `initializeSession`）：

- エクステンションのつながりが、`skipPermission` のツール、フック、許可の求めの受け口のどれかを登録すると、`kind: "extension-permission-access"` の許可の求めを出す。並ぶ項目は、それぞれ「skip tool permission prompts」「register hooks」「handle permission requests」。ほかに「observe permission requests」（つながりが `observePromptEvents` を求めたとき）があるが、SDK はこれを送らない（`client.js` に `observePromptEvents` がない）ので、生成プラグインのエクステンションには出ない。
- 断ると（`approved` 以外）、エクステンションは読み込みに失敗する。`requestedEnvironmentVariables` の求めは、そのあとに別の `kind: "extension-env-access"` で出る。
- 対話モードの確認の画面：題は「Extension "<名前>" wants elevated permissions」、本文は「This extension wants to: <項目>.」「Denying will prevent this extension from loading.」。選択肢は「Yes」、場所が分かるときは「Yes, and always allow "<名前>" <場所>」（`approve-for-location`）、分からないときは「Yes, and don't ask again for "<名前>" this session」（`approve-for-session`）、「No」。項目に「observe permission requests」があると、2つ目の選択肢は出ない。設計 4.1 の実測（1.0.98）と合う。
- 更新履歴 1.0.101：「Extension capability requests use explicit approval instead of the Assisted judge」。Assisted の許可（判定役が自動で決める仕組み）を使っていても、この確認は人に出る。
- 前もって許可する指定は `--allow-tool='extension-permission-access(<名前>)'`（公式の Creating an extension の例は `user:tool-time`）。プラグインのエクステンションでは `<名前>` が `plugin:<プラグイン>:<フォルダ>` になる見込み（例の形からの推し量り。確かめられなかった）。

### 3.11 Copilot SDK 1.0.25（ユーザーの環境の EVAL）

クライアント（SDK 1.0.25 `dist/types.d.ts`、`README.md`）：

```ts
import { CopilotClient, RuntimeConnection } from "@github/copilot-sdk";
const client = new CopilotClient({
  connection: RuntimeConnection.forStdio({            // 既定。同梱のランタイム（1.0.102）を起動する
    path: undefined,                                  // 省くと同梱のランタイム。COPILOT_CLI_PATH か path で手元の CLI に替えられる
    args: ["--plugin-dir", "/abs/path/to/plugin"],    // --plugin-dir はここで渡す（公式の Plugin directories）
    env: { ...process.env, COPILOT_PLUGIN_DIR_ONLY: "true" },  // 子プロセスの環境を置き換える。CopilotClientOptions.env と同時に指定すると例外
  }),
  workingDirectory: "/abs/path/to/clean-workdir",     // ランタイムのプロセスの作業フォルダ
  baseDirectory: undefined,                           // COPILOT_HOME に当たる。省くと ~/.copilot
  logLevel: "info",
});
await client.start();
```

- `CopilotClientOptions` に `cliPath`・`cliArgs` はない（1.0.22 にもない）。手元の CLI を使うのは `RuntimeConnection.forStdio({ path })` か環境変数 `COPILOT_CLI_PATH`（README）。
- `COPILOT_PLUGIN_DIR_ONLY=true` は 1.0.102 のランタイムにもある（`runtime.node` の文字列）。公式の Plugin directories：「set `COPILOT_PLUGIN_DIR_ONLY=true` in the runtime's environment to suppress automatic plugin discovery. Only the directories you pass via `--plugin-dir` will load.」（2026-10-22 に取得）。
- セッションの設定の `pluginDirectories: string[]` でも、セッションごとにプラグインを渡せる（公式の Plugin directories の Per-session plugin directories。1.0.98 の型にもある）。ただし、これで渡したプラグインのエクステンションが読み込まれるかは確かめられなかった（`--plugin-dir` の分は `setupExtensionsForSession` の `pluginDirs` に入る）。`--plugin-dir` を使うのが確か。
- 読み込まれたプラグインは `session.rpc.plugins.list()` で分かる（`PluginList.plugins[]`：`name`、`marketplace`、`version?`、`enabled`、`installedFrom?`、`source?` など）。公式の Plugin directories：「Plugins loaded via `--plugin-dir` appear in this list with their cache path set to the directory you provided.」

セッション（SDK 1.0.25 `dist/types.d.ts`）：

```ts
const session = await client.createSession({
  model: "<モデルの ID>",                  // モデルの指定（ID は client.listModels() か session.rpc.model.list() の値）
  workingDirectory: "/abs/path/to/clean-workdir",
  requestExtensions: true,                 // 既定はオフ。プラグインのエクステンションを読み込むのに要る
  trustWorkingDirectory: "session",        // 1.0.102 で足された。作業フォルダをこのセッションだけ信頼する（"user" は保存）
  sessionLimits: { maxAiCredits: 50 },     // @experimental。上限を超えると session_limits_exhausted.requested
  onPermissionRequest: async (request, invocation) => { /* 下 */ },
  onUserInputRequest: async (req) => ({ answer: "課題に書いたこと以外は決まっていません。判断して進めてください", wasFreeform: true }),
  onEvent: (event) => { /* 作成の途中のイベントも取りこぼさない */ },
});
```

- `onUserInputRequest` を渡すと、既定の `askUserVariant: "legacy"` の `ask_user`（問いと選択肢の形）が使えるようになる。入力は `{ question: string; choices?: string[]; allowFreeform?: boolean }`、返り値は `{ answer: string; wasFreeform: boolean }`。
- `onPermissionRequest` を渡さないと、許可の求めはイベントとして出て、答えが出ないまま残る（README）。
- 組織の管理の設定の印の読み方（1.0.102 で変わった。3.5）：

  ```ts
  onPermissionRequest: (request, invocation) => {
    const managed = invocation.promptRequest?.managedApprovalRequired ?? request.managedApprovalRequired;
    if (managed === true) { /* EVAL を止めて理由を示す（testing.md 10.4） */ return { kind: "no-result" }; }
    if (request.kind === "extension-permission-access") return { kind: "approve-once" };
    // 作業フォルダの外への書き込みなどは { kind: "reject", feedback: "..." }
    return { kind: "approve-once" };
  }
  ```

  `promptRequest`（`PermissionPromptRequest`）の種類は `commands`・`write`・`read`・`mcp`・`url`・`memory`・`custom-tool`・`path`・`hook`・`extension-management`・`workflow`・`extension-permission-access`・`extension-env-access`。`managedApprovalRequired` の項目を持つのは `commands`・`write`・`read`・`url`・`workflow` だけで（`session-events.d.ts`）、README の「人の要件を外せるのはこの5種類だけ」と合う。`promptRequest` そのものは 1.0.98 の `permission.requested` のイベントにもあり、1.0.102 で受け口の第2引数にも渡るようになった。
- `approveAll` は、`enableManagedSettings` が真のときは例外を投げる。生の `managedApprovalRequired` が真なら `no-result` を返す（`dist/types.js`）。
- エクステンションの読み込みのときの確認（`extension-permission-access`）は、セッションの許可の仕組み（`requestPermission`）を通って `permission.requested` になる（`cli-main.js` の `initializeSession`）。SDK のセッションでは `onPermissionRequest` に届く見込み（実測していない。設計 11章 #1 の残り）。
- 利用の上限の待ちへの答え方：`session.rpc.ui.handlePendingSessionLimitsExhausted({ requestId, response: { action: "cancel" } })`（`rpc.d.ts`。1.0.98 と同じ）。返り値 `{ success: boolean }`。
- 手番の終わり：`session.idle` は「裏のエージェントもつないだシェルもない」ときに出る（`IdleData` の説明）。`sendAndWait` は、autopilot では `session.autopilot_stopped` でも返るようになった（1.0.102）。
- 費用：`assistant.usage` の `copilotUsage.totalNanoAiu`。1 AI クレジット = 10億 nano-AIU（`rpc.d.ts`「Prices are quoted in nano-AIU; divide by 1,000,000,000 to get AI Credits.」）。`aiCreditsStatus` が `partial`・`unavailable` のときは、足し合わせた値が全部ではない。
- 同梱のランタイム：SDK 1.0.25 は Copilot CLI 1.0.102（3.1）。
- 更新履歴 1.0.101：「Headless and SDK sessions without an OAuth handler skip MCP connections when saved tokens require sign-in, while renewable grants still connect.」。EVAL で `onMcpAuthRequest` を渡さないと、サインインの要る MCP サーバーはつながらない。
- SDK の公開リポジトリのリリースの説明：v1.0.24 は「internal dependency updates only (… no SDK API changes)」、v1.0.25 は説明なし、v1.0.23 は先行版だけ（https://github.com/github/copilot-sdk/releases 、2026-10-22 に取得）。

### 3.12 1.0.98 から 1.0.102 までの更新履歴（関係するものすべて）

CLI 1.0.102 の `changelog.json` の `1.0.99-0` から `1.0.102` まで（172件。先行版と正式版で同じ文が重なる）から、エクステンション、フック、SDK、tasks、サブエージェント、許可、`/clear`、コンパクション、プラグイン、サンドボックス、モデルの選び方に関わるものを拾った。

| 版 | 文（原文） | 設計への効き |
| --- | --- | --- |
| 1.0.102 | Subagents honor custom and MCP tool approvals, avoiding duplicate permission prompts and allowing inherited workflows to run | サブエージェントのカスタムツール（エクステンションのツール）と MCP のツールの許可が、サブエージェントでも効く。統括・作業・検証の確認が減る方向。前提は崩れない |
| 1.0.102 | Prompt mode now honors managed Auto model selection for -p and piped stdin runs | 組織が Auto を決めているとき、`-p` でも Auto になる。設計 4.6（Auto）に関係 |
| 1.0.102 | Long-running sandboxed commands continue running reliably past 10 seconds | サンドボックスの中の長いコマンド（作業エージェント）が安定 |
| 1.0.101 | Extension capability requests use explicit approval instead of the Assisted judge | 読み込みのときの確認は、Assisted の判定で自動にならず、必ず人（か SDK の受け口）が答える（3.10） |
| 1.0.101 | Permission approval prompts explain escalation causes and show a request-specific diagnosis command | 確認の画面の見た目。設計への効きなし |
| 1.0.101 | Add assistedApprovalInstructions setting to guide Assisted Permissions confirmation decisions | Assisted の許可の新しい設定。設計への効きなし |
| 1.0.101 | Headless and SDK sessions without an OAuth handler skip MCP connections when saved tokens require sign-in, while renewable grants still connect. | EVAL（3.11） |
| 1.0.101 | The first prompt no longer hangs silently when no model is selected at startup; … | 設計への効きなし |
| 1.0.101 | Switching only reasoning effort no longer forces compaction in over-budget sessions. / Switching to HydraFusion compacts only when the routed model actually needs it | コンパクションの起き方。hearing.md 8章の前提は崩れない |
| 1.0.101 | Shell commands that create and then enter a directory now request path approval instead of being denied early. | パスの許可の求め（`promptRequest` の種類 `path`）が出る場面が増える。画面の待ちの表示（設計 6.3）が `permissionRequest.kind` だけを見ていると、何の確認かを出しきれないことがある |
| 1.0.101 | macOS sandboxed commands can connect directly to localhost TCP services when local access is enabled and no host filters apply. | サンドボックス（3.9） |
| 1.0.100（1.0.99-1） | Custom agents that declare the documented `search`, `web` or `todo` tool aliases, or name `github-mcp-server/web_search`, now receive the matching tools | 設計 11章 #24 に書いてある |
| 1.0.100（1.0.99-1） | Avoid false context exhaustion and rollover refusal when tool definitions are deferred | ツールの `defer`（3.3） |
| 1.0.100（1.0.99-1） | Add --trust-folder for one-off prompt-mode sessions started with -p or piped stdin | `-p` で作業フォルダを信頼する。SDK では `trustWorkingDirectory`（3.11） |
| 1.0.100（1.0.99-0） | Sandbox allows local network access by default so commands can reach localhost and private-network services. | サンドボックス（3.9） |
| 1.0.100（1.0.99-0） | /sandbox can keep sandboxing enabled for the current session without enabling it globally | サンドボックスをセッションだけ有効にできる |
| 1.0.100（1.0.99-0） | Trusted repository plugins install and update automatically before chat runs. | リポジトリのプラグイン |
| 1.0.100（1.0.99-0） | A skill `allowed-tools` rule keeps commas inside its arguments instead of being split apart. … | スキルの `allowed-tools` |
| 1.0.100（1.0.99-3） | Plugin enable, disable, update, and uninstall actions now route reliably after plugin inventory refreshes. | プラグインの操作 |
| 1.0.100（1.0.100-0） | Managed plugins update activation in existing sessions when managed policy changes | 組織が管理するプラグイン |
| 1.0.100（1.0.100-0） | Sessions no longer stall for minutes when an MCP server hangs while loading tools. | MCP |
| 1.0.100（1.0.99-2） | Show a clear notice when administrator-managed settings override your selected model | モデルの選び方 |

- 1.0.99〜1.0.102 に、エクステンションの API、フック、`tasks`、`/clear`、`joinSession` を変える記述はない（「extension」を含むのは 1.0.101 の1件だけ）。
- 型の上の変化は、更新履歴に書かれていないもの（`onUserPromptSubmitted` の `decision: "block"`、許可の受け口の `promptRequest` と `managedApprovalRequired` の読み方、`trustWorkingDirectory`、`sandboxConfig`、`autopilot` など）がある（3.1〜3.5、3.11）。

### 3.13 出典

パッケージ（どれも 2026-10-22 に `npm pack` で取得）：

- `@github/copilot-linux-x64@1.0.102` の実行ファイルに埋め込まれた `@github/copilot@1.0.102`：`copilot-sdk/extension.d.ts`・`extension.js`・`types.d.ts`・`session.d.ts`・`client.d.ts`・`index.d.ts`・`generated/rpc.d.ts`・`generated/session-events.d.ts`・`docs/extensions.md`・`docs/agent-author.md`・`docs/examples.md`、`preloads/extension_bootstrap.mjs`・`extension_sdk_resolver.mjs`、`index.js`、`cli-main.js`（`setupExtensionsForSession`、`initializeSession`、`shouldLoadExtensionsForSession`、`registerSession`、`startExtensions`、プロンプトモードのエクステンションの読み込み）、`changelog.json`、`prebuilds/linux-x64/runtime.node`（`strings` で見た文字列）
- `@github/copilot-sdk@1.0.25`：`package.json`、`README.md`、`dist/*.d.ts`、`dist/generated/*.d.ts`、`dist/extension.js`・`client.js`・`session.js`・`types.js`、`docs/*.md`
- 比べるための `@github/copilot-linux-x64@1.0.98`（埋め込みの `@github/copilot@1.0.98`）と `@github/copilot-sdk@1.0.22`

公式ドキュメント（どれも 2026-10-22 に取得）：

- [About extensions for GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-cli-extensions)
- [Creating extensions for GitHub Copilot CLI](https://docs.github.com/en/copilot/tutorials/create-an-extension)
- [GitHub Copilot CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)（Extension modes、`--plugin-dir`、`--trust-folder`、`--allow-tool`、`GITHUB_COPILOT_PROMPT_MODE_EXTENSIONS`、`COPILOT_HOME`）
- [GitHub Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)（`com.github.copilot/` の表、`PLUGIN_ROOT`・`PLUGIN_DATA`）
- [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-configuration)（コマンドのフックの時間切れと失敗、`/clear` での `sessionEnd`）
- [Copilot SDK: Plugin directories](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/plugin-directories)（`RuntimeConnection.forStdio({ args })`、`pluginDirectories`、`COPILOT_PLUGIN_DIR_ONLY`、`session.rpc.plugins.list()`）
- [github/copilot-sdk のリリース](https://github.com/github/copilot-sdk/releases)

