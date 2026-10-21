# GAP：Copilot CLI 1.0.98 で、対話の設計に要るのに未確認だったことの実測

- 調べた日：2026-10-21（UTC）。対象：`GitHub Copilot CLI 1.0.98.`（`copilot --version` の出力。`@github/copilot-linux-x64` 1.0.98）。
- 調べ方：A-copilot-cli.md の「再開のチェックリスト」と同じ。ログインせず、オフラインのモード（`COPILOT_OFFLINE=true`、`COPILOT_PROVIDER_BASE_URL`）で偽物のモデル（`research/cli/logserver.js`）につなぎ、対話モード（TUI）を pty と pyte で動かした。モデルに送られたリクエスト本文を全部ファイルに記録した。
- 限界：
  - BYOK（自前のモデルの窓口）経路だけの観測。GitHub の Copilot API（CAPI）経路で同じかは確かめていない（A-copilot-cli.md の冒頭と同じ限界）。
  - 偽物のモデルなので、本物のモデルが差し込まれた文をどう扱うか（従うか、無視するか）、要約に何を書くかは分からない。
  - 主に gpt-4.1（OpenAI の chat completions 形式）。Anthropic 形式（claude-sonnet-4.6）は 2 の差し込み位置だけ確かめた。
  - 自動の圧縮は、上限を `COPILOT_PROVIDER_MAX_PROMPT_TOKENS` で小さくして起こした。

## 道具と置き場所

`G=/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/gap`

| もの | 場所 |
| --- | --- |
| TUI を動かすスクリプト（`research/cli/tuirun.sh` の写し。ログとホームを gap の下に置く。`NOALLOW=1` で `COPILOT_ALLOW_ALL` を外す） | `$G/tuirun.sh` |
| TUI の操作（`research/cli/tui.py` の写し。貼り付け用に、文字列を一度に送る `["raw", ...]` を足した） | `$G/tui.py` |
| 偽物のモデルの応答（`steps.js` の写し） | `$G/handlers/steps.js` |
| 偽物のモデルの応答（圧縮で履歴が書き換わっても手順を最初からやり直さないよう、手順の位置をファイル `state-<STATEKEY>.json` に持つ版） | `$G/handlers/seqstate.js` |
| 試したプラグイン（Agent Plugins の形式。`plugin.json` の `$schema` は `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`） | `$G/plugins/maker/` |
| 　スキル make-plugin（`references/question-items.md` を1つ） | `$G/plugins/maker/skills/make-plugin/` |
| 　スキル review-plugin（5 で使う2つ目） | `$G/plugins/maker/skills/review-plugin/` |
| 　エクステンション（全部のフックを記録し、目印つきの文を差し込む。記録のツール `maker_record` を `skipPermission: true` で登録。振る舞いは `$COPILOT_HOME/ext-config.json` で切り替え） | `$G/plugins/maker/com.github.copilot/extensions/maker-ui/extension.mjs` |
| ファイルの多いスキル（1 の補足） | `$G/plugins/maker-multi/` |
| 実験ごとのリクエスト本文 | `$G/logs/<実験名>/NNN-*.json`（`dump.py` で書き出した `NNN.messages.txt`・`NNN.system.txt`・`NNN.tools.json` も同じ所） |
| 実験ごとの画面 | `$G/logs/<実験名>/tui/snap-*.txt` |
| エクステンションのフックの記録 | `$G/homes/<実験名>/ext-hooks.jsonl` |
| セッションのイベント | `$G/homes/<実験名>/session-state/<ID>/events.jsonl` |
| 手順（TUI の操作） | `$G/steps/*.json` |

差し込む文の目印（エクステンションが返す `additionalContext`）：

| フック | 目印 |
| --- | --- |
| `onSessionStart` | `INJ-SESSIONSTART source=<source>` |
| `onUserPromptSubmitted` | `INJ-UPS-<回> STATE: phase=interview asked=<回>` |
| `onPreToolUse` | `INJ-PRE-<回>-<ツール名>` |
| `onPostToolUse` | `INJ-POST-<回>-<ツール名> STATE: decided=<記録の数>` |
| 記録のツール `maker_record` の返り値 | `RECORD-RESULT-MARKER-<回>: saved "<item>". STATE: decided=<回>` |
| スキルの本文 | `SKILL-BODY-MAKE-PLUGIN-MARKER`、`SKILL-BODY-REVIEW-PLUGIN-MARKER` |
| references のファイル | `REF-QUESTION-ITEMS-MARKER` |

## 状態の一覧

| 問い | 状態 | 一言 |
| --- | --- | --- |
| 1. プラグインに入れたスキル | 確定 | 名前は前置きなし（`make-plugin`）、`location` は `plugin`。`<skill-context>` の形はプロジェクトのスキルと同じ。ユーザーが打つときは `/maker:make-plugin` |
| 2. エクステンションから毎回の発言に差し込めるか | 確定 | できる。フックごとに入る場所が違う。圧縮で古い差し込みは消え、新しい差し込みは圧縮の後も毎回入る。10,240 バイトで切られる |
| 3. ask_user の答えのときも効くか | 確定 | `onUserPromptSubmitted` は呼ばれない。`onPostToolUse`（と `onPreToolUse`）は呼ばれ、ask_user の結果の後ろに入る。ただし画面にも出る |
| 4. 長い貼り付け | 確定 | 20,400 バイトまでは全文がモデルに送られた。20,600 バイト以上はセッションのフォルダのファイルに保存され、パスだけが送られた |
| 5. 2つのスキルの後の /compact | 確定（条件の一部は未確認） | 全文で残るのは最後の1つだけ。前のものはパスだけ。**同じ手番の中で自動の圧縮が起きると、スキルは1つも残らなかった** |
| 6. 記録のツールの返り値の圧縮後 | 確定 | ほかのツールの結果と同じく消える |

## 実験の一覧

すべて `cd $G && ./tuirun.sh <実験名> <handler> <モデル> <port> <steps> -- <copilot の引数>` の形。ポートは 18301〜18321。

| 実験名 | 何を確かめたか | copilot の主な引数と環境 | 問い |
| --- | --- | --- | --- |
| g1-list | `<available_skills>` の名前と description | `--plugin-dir $G/plugins/maker -i 'hello #STEPS:[{"text":"STEP1-DONE"}]#END'` | 1 |
| g1-skill | skill ツールで呼んだときの `<skill-context>`。`maker:review-plugin` の名前で呼べるか。`/review-plugin` | `--plugin-dir … -i 'make a plugin #STEPS:[skill make-plugin, view, text]#END'`、手順 `steps/skill.json` | 1 |
| g1-slash | ユーザーが打つときの名前（`/maker:make-plugin`）、補完、`/skills` の画面 | `--plugin-dir …`、手順 `steps/slash.json` | 1 |
| g1-multi、g1-many | スキルのフォルダにファイルが多いときの「Related files」の並びと省略 | `--plugin-dir $G/plugins/maker-multi` | 1 |
| g2-ext0 | `--plugin-dir` と `--experimental` でエクステンションが読み込まれるか。差し込みの場所 | `--experimental --plugin-dir …` | 2 |
| g2-noallow | 読み込みのときの確認（`COPILOT_ALLOW_ALL` を外す） | `NOALLOW=1`、手順 `steps/noallow.json` | 2 |
| g2-main | スキル → ask_user → 記録のツール → 2つ目のスキル → `/compact` → 打った発言 → ask_user → 記録のツール | `--experimental --plugin-dir …`、手順 `steps/main.json` | 2, 3, 5, 6 |
| g2-pad | 差し込みの大きさの上限。ask_user の取り消し（Esc）と断る（Ctrl+D）でもフックが呼ばれるか | `COPILOT_PROVIDER_MAX_PROMPT_TOKENS=400000`、`ext-config.json` = `{"pads":[1000,4000,10000,20000,40000,…]}`、手順 `steps/pad.json`、handler `seqstate.js` | 2, 3 |
| g2-claude | Anthropic 形式での差し込みの場所 | `PTYPE=anthropic`、モデル `claude-sonnet-4.6` | 2, 3 |
| g2-suppress | `suppressOutput: true` で画面の表示が消えるか | `ext-config.json` = `{"suppress":true}` | 3 |
| g2-modres | `modifiedResult` で ask_user の結果を書き換えたときの画面 | `ext-config.json` = `{"modifyAskUser":true,"noAC":true}` | 3 |
| g2-sysmsg | エクステンションの `joinSession` の `systemMessage` | `ext-config.json` = `{"systemMessage":{"mode":"append","content":"INJ-SYSMSG-APPEND …"}}` | 2（補足） |
| g4-paste | 15行の貼り付けと 43KB（400行）の貼り付け | 括弧つき貼り付け（`ESC[200~ … ESC[201~`）を一度に送る。手順 `steps/paste.json` | 4 |
| g4-sweep、g4-sweep2 | 貼り付けがファイルに回る大きさ（5,000〜30,000 バイト、20,400／20,600／25,000 バイト） | 手順 `steps/sweep.json`、`steps/sweep2.json` | 4 |
| g5-skills2 | 同じ手番で2つのスキル → `/compact`。ユーザーの `/maker:make-plugin` → モデルの skill → `/compact` | `--plugin-dir …`、手順 `steps/skills2.json` | 5 |
| g5-auto | 自動の圧縮（上限 24,000）。上限を超えて「truncation」が起き、偽物のモデルが手順を繰り返したので、結果は参考にとどめる | `COPILOT_PROVIDER_MAX_PROMPT_TOKENS=24000` | 5（参考） |
| g5-auto2 | 同じ手番の中で、スキル2つの後に自動の圧縮 | `COPILOT_PROVIDER_MAX_PROMPT_TOKENS=30000`、handler `seqstate.js` | 5 |
| g5-auto3 | 前の手番でスキル2つ、次の手番の中で自動の圧縮 | 同上 | 5 |
| g5-auto4 | 1つの手番の聞き取り（スキル → ask_user → 記録 → 大きい出力 → 自動の圧縮 → ask_user → 記録）。エクステンションつき | 同上、`--experimental --plugin-dir …` | 2, 3, 5, 6 |

---

## 1. プラグインに入れたスキル（確定）

### 事実（実測）

1. **`<available_skills>` では、名前に前置きが付かない**。`location` は `plugin`（g1-list の `001.system.txt` 165〜175 行）。

   ```text
   <skill>
     <name>make-plugin</name>
     <description>Create an Agent Plugin that embeds the user&apos;s work knowledge. Use when the user asks to make or build a plugin for their job.</description>
     <location>plugin</location>
   </skill>
   ```

   - description は SKILL.md のフロントマターのまま（`'` は `&apos;` に変わる）。プロジェクトのスキルの `location` は `project`、組み込みは `builtin`（A-copilot-cli.md 2-1）。

2. **モデルが skill ツールで呼ぶ名前は `make-plugin`。`maker:make-plugin` では見つからない**（g1-skill の `005.messages.txt`）。

   ```text
   Skill "maker:review-plugin" not found. Available skills: make-plugin, review-plugin, customize-cloud-agent, github-pr-media
   ```

3. **`<skill-context>` の形は、プロジェクトのスキルと同じ**（A-copilot-cli.md 2-2 と同じ）。tool の結果は定型文で、本文は直後の role=user のメッセージに入る（g1-skill の `005.messages.txt` [3]〜[4]）。

   ```text
   ===== [3] role=tool
   Skill "make-plugin" loaded successfully. Follow the instructions in the skill context.
   ===== [4] role=user
   <skill-context name="make-plugin">
   Base directory for this skill: /tmp/.../gap/plugins/maker/skills/make-plugin

   Related files (use view tool to read):
     - /tmp/.../gap/plugins/maker/skills/make-plugin/references/question-items.md

   # make-plugin (gap test)

   SKILL-BODY-MAKE-PLUGIN-MARKER
   ...
   </skill-context>
   ```

   - `<skill-context name="…">` の名前も前置きなし。`references/` の中身は入らず、絶対パスだけ（`REF-QUESTION-ITEMS-MARKER` は0件）。
   - Base directory は `--plugin-dir` で渡したフォルダの中のスキルのフォルダ（インストールしたときは、インストール先になると見込むが、確かめていない）。

4. **ユーザーが打つときは `/maker:make-plugin`（`/<プラグイン名>:<スキル名>`）。`/make-plugin` や `/review-plugin` は `Unknown command`**（g1-skill の `snap-c.txt`：`✗ Unknown command: /review-plugin`。g1-slash の `snap-c-complete.txt`：`/make` と打つと補完に `/maker:make-plugin`、`/maker:review-plugin` が出た）。打ったときの user メッセージ（g1-slash の `002.messages.txt`）：

   ```text
   The user explicitly invoked the "/maker:make-plugin" skill. Follow its instructions now.

   <skill-context name="make-plugin">
   ...
   ARGUMENTS: via prefixed slash #STEPS:[{"text":"STEP2-DONE"}]#END
   </skill-context>
   ```

   - `ARGUMENTS:` は `</skill-context>` の内側の最後に入る。
   - `/skills` の画面では `make-plugin` に「Plugin-contributed」と出る（g1-slash の `snap-d-skills.txt`）。

5. **「Related files」の並び**（g1-multi、g1-many）：
   - SKILL.md 以外の、スキルのフォルダの中のすべてのファイル（下のフォルダも含む、`.hidden/` のような隠しフォルダも含む）を、パスの文字の順に並べる。`references/` だけではない（`NOTES.md`、`assets/template.json`、`references/a-examples.md`、`references/question-items.md`、`references/sub/nested.md`、`references/z-last.md`、`scripts/check.sh` の順）。
   - 中身の多いフォルダは「Summarized directories」にまとめられ、ファイルは並ばない。`node_modules/` の中は出なかった（g1-many の `002.messages.txt`）。

     ```text
     Summarized directories:
       - assets/tpl/core/ (150 items)
       - assets/tpl/ui/ (150 items)
     Related files (use view tool to read):
       - .../make-plugin/.hidden/h.md
       - .../make-plugin/NOTES.md
       ...
     ```

   - ランタイムの文字列には「`...and more files (listing truncated)`」もある（`research/cli/runtime.strings`）。何件で切られるかは確かめていない。

### 分からなかったこと

- 何個のファイルからフォルダがまとめられるか、何件で一覧が切られるか（150 件のフォルダはまとめられ、6 件のフォルダはまとめられなかった）。
- `copilot plugin install` で入れたときの Base directory の場所。

### 考察（設計への意味）

- SKILL.md や README で、ユーザーに打ってもらうコマンドを示すなら `/<クリエイターの名前>:make-plugin` の形になる。モデルに向けて書く名前（skill ツール）は `make-plugin` のまま。
- `docs/design/generated-plugin-structure.md` 9章（クリエイターの画面での流用）では、生成プラグインのひな形をスキルのフォルダの中に置く（「ひな形はスキルのフォルダの中にあり」）。ひな形のファイルは「Related files」に全部並ぶか、まとめて「(N items)」と出る。読む必要のない一覧で文脈を使い、モデルが関係のないファイルを読みに行くかもしれない（考察。本物のモデルで確かめていない）。ひな形を `references/` と分けた名前のフォルダに置き、SKILL.md でどのファイルをいつ読むかを名指しするのが単純（考察）。

---

## 2. エクステンションから状態を毎回の発言に差し込めるか（確定）

### 型定義と docs で分かったこと（Copilot CLI 1.0.98 の `copilot-sdk/types.d.ts`、`copilot-sdk/docs/examples.md`）

- `additionalContext` を返せるフック：`onUserPromptSubmitted`（ほかに `modifiedPrompt`）、`onPreToolUse`（ほかに `permissionDecision`、`modifiedArgs`）、`onPostToolUse`（ほかに `modifiedResult`、`suppressOutput`）、`onPostToolUseFailure`（`additionalContext` だけが使われる）、`onSessionStart`、`onSubagentStart`（子の最初の prompt の前に足す）。
- docs の原文：「Return `additionalContext` to silently append instructions the agent will follow.」の見出しは「Injecting additional context into every message」（examples.md）。
- `onUserPromptTransformed`（`modifiedTransformedPrompt`）は「runs after the runtime has transformed the submitted prompt with generated context, but before it is persisted to session history or sent to the model」（types.d.ts）。
- ランタイムの文字列：「Ignoring additionalContext returned by a … because aggregating it would exceed the … byte limit (… bytes).」（`research/cli/runtime.strings` 26884 行付近）。
- フックの種類にはほかに `preCompact`（「Runs before conversation context is compacted.」）があるが（`copilot-sdk/generated/rpc.d.ts` の `HookType`）、エクステンションの `SessionHooks` にはない。試していない。

### 読み込み（実測）

- `--experimental --plugin-dir $G/plugins/maker` で、Agent Plugins の形式のプラグインの `com.github.copilot/extensions/maker-ui/extension.mjs` が読み込まれた（g2-ext0。ツールの一覧に `maker_record` が入り、`ext-hooks.jsonl` に `joined` が出た）。これで、generated-plugin-structure.md 11章 #1 の注の残り「`--plugin-dir` でも読み込まれるか」が確かめられた。
- エクステンションの名前は `plugin:maker:maker-ui`（`plugin:<プラグイン名>:<フォルダ名>`）。
- エクステンションの1つのプロセス（同じ pid）が、`/compact` と自動の圧縮をまたいで動き続けた（g2-main は pid 1412 のみ、g5-auto4 は pid 3258 のみ）。
- **読み込みのときの確認と、どう許可したか**：
  - `tuirun.sh` は既定で `COPILOT_ALLOW_ALL=true` を渡す。このときは確認が出ずに読み込まれた（g2-ext0、g2-main ほか）。
  - `COPILOT_ALLOW_ALL` を外すと（g2-noallow）、フォルダの信頼の確認のあと、次の確認が1回出た。どちらも Enter（1. Yes）で許可した（`snap-a.txt`、`snap-b.txt`）。

    ```text
    │ Extension "plugin:maker:maker-ui" wants elevated permissions
    │ This extension wants to: skip tool permission prompts, register hooks.
    │ Denying will prevent this extension from loading.
    │ ❯ 1. Yes
    │   2. Yes, and always allow "plugin:maker:maker-ui" in this directory (/tmp/claude-0/.../proj)
    │   3. No (Esc)
    ```

    `onPermissionRequest` を登録していないので「handle permission requests」は出ない（generated-plugin-structure.md 4.1 の記述と合う）。

### 差し込んだ文が入る場所（実測。g2-ext0、g2-main の `004.messages.txt`）

| フック | 入る場所 | 原文 |
| --- | --- | --- |
| `onSessionStart` | 最初のユーザーの発言の前に、別の role=user のメッセージとして1つ | `===== [1] role=user` / `INJ-SESSIONSTART source=new` |
| `onUserPromptSubmitted` | その発言の user メッセージの末尾に `<system_reminder>` で囲んで足される | `hi #STEPS:…#END` / 空行 / `<system_reminder>` / `INJ-UPS-1 STATE: phase=interview asked=1` / `</system_reminder>` |
| `onPostToolUse` | そのツールの結果（role=tool）の末尾に足される | `User responded: Write reports` / 空行 / `Tool "ask_user" succeeded. Additional guidance from postToolUse hooks:` / `INJ-POST-2-ask_user STATE: decided=0` |
| `onPreToolUse` | そのツールの結果の **後ろ** に、別の role=user のメッセージとして（skill ツールでは `<skill-context>` の後ろ） | `===== [9] role=user` / `Additional context from preToolUse hook:` / `INJ-PRE-2-ask_user` |

- `onUserPromptTransformed` の `transformedPrompt` には、`<current_datetime>…</current_datetime>` ＋ 打った文 ＋ `<system_reminder>…</system_reminder>` が入っていた。つまり `onUserPromptSubmitted` の差し込みは、変換の前に足される。
- セッションのイベントには `hook.start`／`hook.end` が出る。`hook.end` の原文：`{"hookInvocationId":"…","hookType":"userPromptSubmitted","success":true,"output":{"additionalContext":"INJ-UPS-1 STATE: phase=interview asked=1"}}`（g2-main の `ext-hooks.jsonl`）。EVAL で差し込みを記録に残せる。
- Anthropic 形式（g2-claude の `004-_v1_messages.json`）でも同じ場所に入った：`onPostToolUse` は `tool_result` の中身の末尾、`onPreToolUse` は次の user メッセージの text ブロック、`onSessionStart` は最初の user メッセージの最初の text ブロック。キャッシュの印（`cache_control`）は最後のブロック（このときは preToolUse の text）に付いた。

### 圧縮の後（実測。g2-main の `008.messages.txt`、g5-auto4 の `007`〜`010`）

- **それまでの差し込みは、すべて消える**。打った発言は `<user_message>` に原文で残るが、`<system_reminder>` の部分は入らない（打った文そのもの＝`user.message` の `content` が使われ、`transformedContent` は使われない）。`onSessionStart` のメッセージも消え、作り直されない。

  ```text
  <user_message>
  second turn TYPED-2 #STEPS:[{"name":"skill","arguments":{"skill":"review-plugin"}},{"text":"STEP2-DONE"}]#END
  </user_message>
  ```

- **フックは圧縮の後も呼ばれ続け、新しい差し込みは毎回入る**（g2-main：`008` に `INJ-UPS-3`、`010` に `INJ-POST-5-ask_user`。g5-auto4：自動の圧縮の後の `007` に `INJ-PRE-5-bash`・`INJ-POST-5-bash`、`008` に `INJ-POST-6-ask_user`）。`/compact` 自体では `onUserPromptSubmitted` は呼ばれなかった。
- 圧縮の前は、差し込みは履歴に残ってたまり続ける（g2-main の `007` の時点で `INJ-UPS-1`、`INJ-UPS-2`、`INJ-POST-1`〜`4`、`INJ-PRE-1`〜`4` がすべて履歴にある）。
- エクステンションは `session.compaction_start`／`session.compaction_complete` のイベントを受け取れた（g2-main、g5-auto4 の `ext-hooks.jsonl`）。圧縮が起きたことを知って、次のフックで差し込みを変えられる。

### 大きさの上限（実測。g2-pad）

- `onPostToolUse` の `additionalContext` を 1,000／4,000／10,000 バイトにすると全部入った。20,000 と 40,000 バイトにすると、**どちらも 10,240 バイトで、印もなく切られた**（tool の結果の長さ 10,351 字＝前置き 111 字＋10,240 字。末尾の目印 `PADEND-4`・`PADEND-5` が消えた）。

### 補足：`joinSession` の `systemMessage`（実測。g2-sysmsg）

- エクステンションの `joinSession({ systemMessage: { mode: "append", content: "INJ-SYSMSG-APPEND …" } })` は効き、システムプロンプトの中（gpt-4.1 では `</system_notifications>` の後、`<solution_persistence>` の前）に入った。システムプロンプトは毎回作り直されるので圧縮で消えないと見込むが、圧縮の後は確かめていない。
- 決まるのは `joinSession` のときだけで、その後に変える手段は rpc.d.ts に見つからなかった（`systemMessage` で検索）。プラグインを入れたすべてのセッションに入る（考察）。

### 考察（設計への意味）

- 「状態を毎回見せ直す」（C-llm-interviewer.md の、前の情報を見せ直すと長い会話の劣化が一部戻るという報告）は、エクステンションのフックで実装できる。圧縮で古い差し込みが消え、新しいものだけが入るので、古い状態が履歴に残り続ける心配は圧縮のたびに解消する。ただし圧縮の前は、毎回の差し込みが履歴にたまり、文脈を使う。差し込みは短い要約（未聞きの項目の名前、決まったナレッジの数など）にし、全文は記録のツールの側（ファイル）に置くのが単純（考察）。10,240 バイトを超えると黙って切られるので、超えない形にする必要がある（事実から決まる）。
- 差し込みに頼る設計は、Claude Code 向けの置き換え（testing.md 4章）ではエクステンションが外れるので、そのままでは試験できない。試験の仕組みが同じ差し込みを作る必要がある（Claude Code や Agent SDK に同じ仕組みがあるかは、この調査では確かめていない）。KISS（憲章 第10条）の観点では、差し込みは「なくても手順が回り、あると圧縮の後に助かる」補助にとどめるのが無難（考察）。
- `systemMessage` は、クリエイターを使っていないセッションにも入るので、対話の状態を入れる場所には向かない（考察）。

---

## 3. ask_user の答えのときも差し込めるか（確定）

### 事実（実測。g2-main、g2-pad、g5-auto4 の `ext-hooks.jsonl` とリクエスト本文）

1. **`onUserPromptSubmitted` は ask_user の答えでは呼ばれない**。呼ばれたのは、ユーザーが打った発言（`-i` の最初の発言を含む）だけ。g2-main では ask_user に2回答えたが、`onUserPromptSubmitted` は打った4回（n=1〜4）だけだった。
2. **`onPreToolUse` と `onPostToolUse` は ask_user でも呼ばれる**。`onPostToolUse` の入力に、問い（`toolArgs` の `message` と `requestedSchema`）と答え（`toolResult`）が入る（g2-main の `ext-hooks.jsonl`）：

   ```text
   onPreToolUse  {'n': 2, 'toolName': 'ask_user', 'toolArgs': '{"message":"Goal of the job?","requestedSchema":{...}}'}
   onPostToolUse {'n': 2, 'toolName': 'ask_user', 'toolResult': '{"textResultForLlm":"User responded: Write reports","resultType":"success","sessionLog":"User responded:\ngoal: Write reports","toolTelemetry":{"properties":{"elicitation_action":"accept","elicitation_field_types":"[\"enum\"]"},"metrics":{"elicitation_field_count":1}}}'}
   ```

   - 項目が1つのフォームでは、モデルへの結果は `User responded: Write reports`（項目名なし）。`sessionLog` には `goal: Write reports` と項目名が入る。項目が2つのときは `User responded: goal=Review code, lastTime=…`（A-copilot-cli.md 1-4）。
3. **ask_user の答えを受けた次のリクエストに、`onPostToolUse` の差し込みが ask_user の結果の末尾として入る**（2 の表のとおり）。`onPreToolUse` の差し込みも、ask_user の結果の後ろに別の user メッセージとして入る。圧縮の後の ask_user でも同じ（g2-main の `010`、g5-auto4 の `008`）。
4. **取り消し（Esc）と断る（Ctrl+D）も `resultType: "success"` で、`onPostToolUse` が呼ばれる**（g2-pad）。`elicitation_action` は `cancel`。断ったときの結果の原文（1.0.98）：

   ```text
   The user is not available to respond and will review your work later. Work autonomously and make good decisions. If the request is genuinely ambiguous or unresolvable, stop and call task_complete summarizing the ambiguity rather than proceeding on an unfounded assumption.

   Tool "ask_user" succeeded. Additional guidance from postToolUse hooks:
   INJ-POST-7-ask_user STATE: decided=0
   ```

5. **ask_user の結果に足した文は、ユーザーの画面にも出る**（g2-main の `snap-t1.txt`）。`suppressOutput: true` を返しても消えなかった（g2-suppress）。`modifiedResult` で結果の文を書き換えても、書き換えた文がそのまま画面に出た（g2-modres）。

   ```text
    ● Asked user Goal of the job?
      └ Write reports
        Tool "ask_user" succeeded. Additional guidance from postToolUse hooks:
        INJ-POST-2-ask_user STATE: decided=0
   ```

   - 一方、`onPreToolUse`、`onUserPromptSubmitted`、`onSessionStart` の差し込みは、どの画面にも出なかった（`$G/logs/*/tui/snap-*.txt` を `INJ-PRE|INJ-UPS|INJ-SESSION` で検索して0件）。skill や bash の `onPostToolUse` の差し込みも、画面では畳まれて見えなかった。
   - 記録のツールの返り値は、画面に1行で出る（`● maker_record item: "goal decided" RECORD-RESULT-MARKER-1: saved "goal decided". STATE: decided=1`）。

### 考察（設計への意味）

- 聞き取りの大半は ask_user の答えで進み、ユーザーが打つ発言は少ない。そのため「毎回の発言に差し込む」なら、`onUserPromptSubmitted` だけでは足りず、ツールのフックが要る（事実から決まる）。
- ask_user の後に状態を差し込む口は2つある（考察）：
  - `onPostToolUse`：ask_user の結果の直後に入るのでモデルが見落としにくいが、ユーザーの画面に英語の定型文つきで出る。専門用語を避ける方針（communication.md、00-context の 9）とぶつかる。
  - `onPreToolUse`：画面に出ないが、計算するのは答えの前で、入るのは答えの後ろ（前の時点の状態になる）。
- `onPostToolUse` の入力に問いと答えがそろうので、**モデルが記録のツールを呼ばなくても、エクステンションが ask_user の問いと答えを全部ファイルに残せる**（事実から言えること）。圧縮で ask_user の答えが消える問題（A-copilot-cli.md 3-3）への、モデルに頼らない備えになる。どの質問が効いたかの記録（00-context の 10、REQ-049）や外側の EVAL の「聞いたか・答えたか」の記録（testing.md 6.3）の材料にもなる。ただし Claude Code 向けの置き換えではエクステンションが外れるので、試験の仕組みの側で同じ記録を作る必要がある（考察）。

---

## 4. 長い貼り付け（確定）

### 事実（実測）

1. **15行（725 バイト）の貼り付け**：入力欄では `[Paste #1 - 15 lines]` に畳まれたが、送るとモデルへの user メッセージには全文が入った（g4-paste の `002.messages.txt`。`PASTE-A-LINE-01`〜`15` がすべてある）。画面の履歴にも全文が出た。
2. **大きさで扱いが変わる**（g4-sweep、g4-sweep2。行は 100 バイト）：

   | 大きさ | 入力欄の表示 | モデルに送られたもの |
   | --- | --- | --- |
   | 5,000〜20,000 バイト（50〜200行） | `[Paste #1 - N lines]` | 全文（例：20,000 バイトの貼り付けで user メッセージは 20,107 字、200行すべて） |
   | 20,400 バイト（204行） | `[Paste #1 - 204 lines]` | 全文 |
   | 20,600 バイト以上 | `[Saved pasted content to workspace (20.1 KB) id=1]` | パスだけ |

   ファイルに回ったときの user メッセージ（g4-paste の `003.messages.txt`）：

   ```text
   <pasted_content file="/tmp/.../homes/g4-paste/session-state/bed95371-…/files/paste-1792573971545.txt" size="42.2 KB" lines="400" /> big paste #STEPS:[{"text":"PASTE2-DONE"}]#END
   ```

   - ファイルはセッションのフォルダの `files/` に、貼り付けた全文（43,199 バイト）で保存された。モデルは `view` などで読む必要がある（`view` は 20KB を超えるファイルを読まない：A-copilot-cli.md 6-3）。
3. 仕組み（`research/cli/pkg/package/cli-main.js` 1.0.98）：行数の境目 `NVe=10`（10行を超えると `[Paste #N - X lines]` に畳む。畳んでも送るときに全文に戻す）と、バイト数の境目 `Ttn=S.largeOutputDefaultThreshold()`（超えると `session.workspaces.saveLargePaste` でファイルに保存し、`<pasted_content file=… size=… lines=… />` を送る）。境目の値はネイティブの関数の中で、文字列からは読めなかった。実測では 20,400 と 20,600 バイトの間（20 KiB＝20,480 バイトと見込むが、ちょうどの値は確かめていない）。

### 考察（設計への意味）

- 手順書やルールの文を貼り付けてもらう聞き方は、約20KB までならモデルに全文が届く。それより大きいと、貼り付けたのに「中身を読んでいない」状態になりうる。貼り付けを頼むときは、`<pasted_content file=…>` が来たらそのファイルを読むよう SKILL.md に書くか、ファイルの場所を教えてもらい読む流れ（REQ-017）にそろえるのが単純（考察）。
- 20KB 以下の貼り付けはユーザーが打った発言なので、圧縮の後も `<user_message>` に原文で残ると見込む（打った発言が原文で残ることは A-copilot-cli.md 3-3。貼り付けを含む発言で圧縮を試してはいない）。大きい貼り付けを何度もすると、圧縮の後も消えずに文脈を使い続ける（A-copilot-cli.md 3-4 の「打ったメッセージはたまり続ける」と合わせた考察）。

---

## 5. 2つのスキルを呼んだ後の圧縮で、`<invoked_skills>` にいくつ残るか（確定。「Retained skill」の条件は未確認）

### 事実（実測）

1. **`/compact` の前の手番までに2つのスキルを呼ぶと、全文で残るのは最後の1つだけで、前のものはパスだけになる**（g2-main の `008.messages.txt`。手番1で make-plugin、手番2で review-plugin、そのあと `/compact`）：

   ```text
   <invoked_skills>
   ## Most recent skill: review-plugin
   Path: /tmp/.../gap/plugins/maker/skills/review-plugin/SKILL.md

   Continue to follow these instructions:

   # review-plugin (gap test)

   SKILL-BODY-REVIEW-PLUGIN-MARKER


   ## Previously used skills
   These skills were used earlier in the session. Reactivate one before relying on its instructions unless its instructions are retained below:
   - make-plugin: /tmp/.../gap/plugins/maker/skills/make-plugin/SKILL.md
   </invoked_skills>
   ```

   - 同じ手番で2つ呼んで手番を終えてから `/compact` した場合も、ユーザーが `/maker:make-plugin` と打った後にモデルが review-plugin を呼んだ場合も、同じ形だった（g5-skills2 の `005`、`010`）。
   - 前の手番でスキルを呼び、次の手番の中で自動の圧縮が起きた場合も同じ形だった（g5-auto3 の `007`〜`009`）。
   - ランタイムには「`### Retained skill: `」の文字列があるが（`research/cli/runtime.strings` 4525 行）、どの実験でも出なかった。出る条件は分からない。

2. **同じ手番の中で呼んだスキルは、その手番の中で自動の圧縮が起きると、`<invoked_skills>` に1つも残らない**（g5-auto2、g5-auto4）。圧縮の後のリクエストは、要約と打った発言だけで、スキルの本文も「Previously used skills」もなかった。次にユーザーが打った手番でも戻らなかった（g5-auto4 の `010`）。

   g5-auto4（1つの手番の聞き取り：make-plugin → ask_user → 記録 → 大きいツールの出力で 80% を超える → 自動の圧縮 → ask_user → 記録）の、圧縮の後の最初のリクエスト（`007.messages.txt`）：

   ```text
   ===== [1] role=user
   Some of the conversation history has been summarized to free up context.

   You were originally given instructions from a user over one or more turns. Here were the user messages:
   <user_message>
   interview TYPED-1 #STEPS:[...]
   </user_message>

   Here is a summary of the prior context:
   <summary>
   ...（偽物の要約）
   </summary>

   ===== [2] role=assistant TOOL_CALLS=[... bash echo small1 ...]
   ===== [3] role=tool
   small1
   ...
   ```

   イベント（`events.jsonl`）：`session.compaction_start` `{"systemTokens":5647,"conversationTokens":11794,"toolDefinitionsTokens":8896,"currentTokens":28720,"tokenLimit":30000,"trigger":"threshold"}`、`session.compaction_complete` `{"success":true,…,"messagesRemoved":11,…}`。

   - 比べると（g5-auto3）、前の手番でスキルを呼んでおけば、同じ条件の自動の圧縮で `## Most recent skill: review-plugin` が残った。違いは「スキルを呼んだのが、圧縮が起きた手番の中か、前の手番か」だけである。
   - A-copilot-cli.md 2-3・3-3 の「圧縮の後も最後に呼ばれたスキルの本文は残る」は、スキルを前の手番で呼んだ実験（i10、s5、s8。`research/cli/logs/s5-autocompact/015` 以降に `invoked_skills` あり）での結果で、この条件の違いは試されていなかった。**この報告の結果は、A の記述に「同じ手番の中の圧縮では残らない」という例外を足すもの**である。
   - ここでいう手番は、ユーザーの1回の発言（打った発言）から、エージェントが返事をし終えるまで。ask_user の答えでは手番は区切られない（g5-auto4 は1つの手番で ask_user に2回答えた。`events.jsonl` では、ランタイムはモデルの呼び出しごとに `assistant.turn_start` を出すが、その `interactionId` は最初の発言から2つ目の発言の前まで同じ `193444bd-…` で、2つ目の発言で `caaa3b85-…` に変わった）。
3. 圧縮の後にもう一度 skill ツールでスキルを呼ぶと、`<skill-context>` がもう一度入った（g5-auto の `007`。イベントは `skill.invoked_ref`）。
4. 参考（g5-auto）：上限 24,000 では、80% を超えたところで裏の圧縮が始まると同時に、送る直前に上限を超えたため履歴が削られた（`session.truncation` `{"tokenLimit":24000,…,"messagesRemovedDuringTruncation":6,…}`）。偽物のモデルが手順を繰り返したので、この実験は参考にとどめる。

### 分からなかったこと

- 「`### Retained skill:`」が出る条件。
- 本物のモデルの要約に、使っていたスキルの名前や手順がどこまで書かれるか（偽物のモデルなので分からない）。
- 手動の `/compact` を手番の途中で行う手段はないので、同じ手番の例外は自動の圧縮でだけ確かめた。

### 考察（設計への意味）

- **聞き取りを ask_user でつなぐと、1つの手番が長くなる**。その手番の中で自動の圧縮（入力の上限の約80%）が起きると、make-plugin の手順はモデルから消える（事実）。残るのは要約と、ユーザーが打った発言だけである。00-context の 6（長い対話の状態の保ち方）の前提が変わる。
- 備えの候補（どれも考察。本物のモデルで効くかは確かめていない）：
  1. 手順の要点と今の段階を、会話の外（記録のツールのファイル）に持ち、エクステンションが `session.compaction_complete` を受けたら、次のフック（ask_user なら `onPreToolUse` か `onPostToolUse`）で「make-plugin の手順を skill ツールで読み直す」旨と今の段階を差し込む。スキルの一覧（`<available_skills>`）はシステムプロンプトに残るので、読み直しはできる（事実：3）。
  2. 段階の区切りで手番を終える（文章で区切りを伝え、ユーザーに打ってもらう）。ただし、システムプロンプトは「Never ask questions via plain text output」と文章での質問を禁じている（A-copilot-cli.md 1-2）ので、質問ではなく区切りの知らせにする必要がある。手番が分かれれば、前の手番で呼んだスキルは残る（事実：1）。
  3. 1つの手番の文脈を小さく保つ（大きいファイルを読む仕事をサブエージェントに任せる）。圧縮そのものが起きにくくなる。
- KISS の観点では、1（差し込み）は Claude Code 向けの置き換えで試験できない（2 の考察）。2 と 3 は SKILL.md の書き方だけで済む。どれを採るかは方針の選択である。

---

## 6. 記録のツールの返り値は、圧縮の後にどうなるか（確定）

### 事実（実測）

- **ほかのツールの結果と同じく消える**。g2-main：`/compact` の前の `007` までは `RECORD-RESULT-MARKER-1` が履歴にあり、後の `008`・`009`・`010` には無い（`011` の `RECORD-RESULT-MARKER-2` は圧縮の後に新しく呼んだもの）。g5-auto4（自動の圧縮）：`006` まであった `RECORD-RESULT-MARKER-1` が `007` 以降に無い。
- エクステンションのプロセスと、その中の値（記録の数 `rec`）は圧縮の後も残る。圧縮の後の差し込みに `STATE: decided=1` が出た（g5-auto4 の `007`：`INJ-POST-5-bash STATE: decided=1`）。

### 考察（設計への意味）

- 記録のツールの返り値に状態を書いても、圧縮の後のモデルは見られない。圧縮の後に状態をモデルへ戻すには、モデルが記録を読み直すツール（例：今の一覧を返す）を呼ぶか、2 の差し込みを使う必要がある（事実から言えること）。
- エクステンションの中の値は `/clear` で失われる（`/clear` でエクステンションは読み込み直される：`copilot-sdk/docs/extensions.md`「Extensions are reloaded on `/clear`」。この調査では `/clear` を試していない）。翌日の再開まで考えると、記録はファイルに置く（generated-plugin-structure.md 6.5 と同じ考え）。

---

## 設計で決めること（00-context の 1〜11）との対応と確信度

| 情報 | 効く設計項目 | 確信度 |
| --- | --- | --- |
| 同じ手番の中の自動の圧縮では、スキルの本文が1つも残らない。前の手番で呼んだスキルは最後の1つだけ全文で残る | 6, 1, 11 | 高（BYOK・偽物のモデル） |
| ask_user の答えでは `onUserPromptSubmitted` は呼ばれず、`onPreToolUse`／`onPostToolUse` は呼ばれる | 6, 2 | 高 |
| フックの差し込みの場所（`<system_reminder>`、tool の結果の末尾、別の user メッセージ）と、圧縮で消えること、圧縮の後も毎回入ること | 6, 11 | 高 |
| 差し込みは 10,240 バイトで黙って切られる | 6, 5 | 高 |
| ask_user の後の `onPostToolUse` の差し込みと `modifiedResult` は画面に出る。`suppressOutput` で消えない。`onPreToolUse` の差し込みは出ない | 9, 2 | 高（pyte で見た範囲） |
| `onPostToolUse` に ask_user の問いと答えがそろう（モデルに頼らず記録できる） | 10, 5, 6 | 高 |
| 記録のツールの返り値は圧縮で消える | 5, 6 | 高 |
| プラグインのスキルの名前（モデルは `make-plugin`、ユーザーは `/maker:make-plugin`）、Related files の並び | 1, 11 | 高 |
| 貼り付けは約20KB まで全文、超えるとファイルのパスだけ | 7, 2 | 高（境目のちょうどの値は中） |
| `--plugin-dir` でもエクステンションが読み込まれる。`COPILOT_ALLOW_ALL=true` では読み込みの確認が出ない | 10（EVAL）, 6 | 高 |
| エクステンションの `systemMessage` はシステムプロンプトに入る（全セッションに入る） | 6, 11 | 中（圧縮の後は未確認） |
| `### Retained skill:` の条件 | 6 | 低（未確認） |

## 出典

- 実測：`$G/logs/<実験名>/`、`$G/homes/<実験名>/`（上の実験の一覧）。Copilot CLI 1.0.98、Linux x64、2026-10-21。
- パッケージ（Copilot CLI 1.0.98 に含まれるもの。`research/cli/pkg/package/`）：`copilot-sdk/types.d.ts`（`SessionHooks`、`PreToolUseHookOutput`、`PostToolUseHookOutput`、`UserPromptSubmittedHookOutput`、`UserPromptTransformedHookInput`、`SessionStartHookOutput`、`SystemMessageConfig`、`Tool.skipPermission`、`LargeToolOutputConfig`）、`copilot-sdk/extension.d.ts`（`JoinSessionConfig`）、`copilot-sdk/docs/extensions.md`、`copilot-sdk/docs/examples.md`（Hooks の節）、`copilot-sdk/generated/rpc.d.ts`（`HookType`、`HistoryCompactRequest`）、`cli-main.js`（貼り付けの `NVe=10`、`saveLargePaste`、`<pasted_content …/>`）、`prebuilds/linux-x64/runtime.node` の文字列（`research/cli/runtime.strings`：「Ignoring additionalContext …」「### Retained skill: 」「Summarized directories:」「...and more files (listing truncated)」）。
- 前の調査：`/home/user/plugin-creater/wip/dialogue-design/research/A-copilot-cli.md`（1-4、2-2、2-3、3-3、3-4、6-3、6-4、再開のチェックリスト 1・2・5）。
- 上位の文書：`docs/design/generated-plugin-structure.md` 4.1、6.5、9章、11章 #1、`docs/design/creator-structure.md` 2章・4.3、`docs/design/testing.md` 4章・6章。
