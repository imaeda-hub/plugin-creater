# R2 エクステンションと SDK の API（最新版で）

状態：途中

未着手・途中の項目：
- (1) 実装者向けの API の要約（未着手。(3) がそろってから書く）
- (2) 設計書の前提と違う最新の事実（未着手）
- (3) 詳細と出典：3.1〜3.8 は書いた。残り：3.9 エクステンションの起動・環境・終了（cwd、`COPILOT_HOME`、Node.js の機能、外部の npm パッケージ）、3.10 読み込みの条件と読み込みのときの確認（cli-main.js）、3.11 Copilot SDK 1.0.25（EVAL）、3.12 公式ドキュメント

対象の版：Copilot CLI 1.0.102（`@github/copilot`、`@github/copilot-linux-x64`）、Copilot SDK 1.0.25（`@github/copilot-sdk`）。比べる版：Copilot CLI 1.0.98、Copilot SDK 1.0.22（設計書が確かめた版）。調べた日：2026-10-22。

取り出し先（どれも `npm pack --ignore-scripts` で取り、スクリプトは動かしていない）：

- `/tmp/claude-0/-home-user-plugin-creater/f6e65e0d-9c94-5351-8ee1-475927b3b43e/scratchpad/r2/pkg/cli/package/`：Copilot CLI 1.0.102（`@github/copilot-linux-x64` の実行ファイルに埋め込まれた `copilot.tgz` を取り出したもの）
- `/tmp/claude-0/-home-user-plugin-creater/f6e65e0d-9c94-5351-8ee1-475927b3b43e/scratchpad/r2/pkg/sdk/package/`：Copilot SDK 1.0.25
- `/tmp/claude-0/-home-user-plugin-creater/f6e65e0d-9c94-5351-8ee1-475927b3b43e/scratchpad/r2/pkg/v98dl/`：比べるための Copilot CLI 1.0.98 と Copilot SDK 1.0.22

以下、出典の書き方：「CLI 1.0.102 `copilot-sdk/types.d.ts`」は CLI のパッケージの中の SDK、「SDK 1.0.25 `dist/types.d.ts`」は SDK のパッケージを指す。

---

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
