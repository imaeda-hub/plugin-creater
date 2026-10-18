# 試験の設計

クリエイターと生成プラグインを、どう試験するかを定める。

## 1. 前提

- 試験は AI が Claude Code で自律的に行い、人は結果を見る。
- クリエイターと生成プラグインは Copilot CLI 向けだが、AI の試験は Claude Code だけで行う。
- 最終確認だけは、人が手元の Copilot CLI で行う（9章）。

## 2. 試験の段階

| 段階 | 確かめること | やり方 |
| --- | --- | --- |
| 1 構造の検査 | 設定ファイル、ファイルの置き場所、フロントマターが正しいか | 公式のスキーマと公式ドキュメントの決まりで検査する |
| 2 部品の試験 | スクリプト、フック、MCP サーバーなどが正しく動くか | 部品を直接動かし、正常な入力と異常な入力で確かめる |
| 3 EVAL | 必要な場面で呼ばれ、期待する成果物を作れるか | 実際のモデルで課題を実行して採点する。プラグインあり・なしで同じ課題を繰り返し実行し、スコアを比べる |

- 1・2段目はモデルを使わないので、費用がかからず、結果も毎回同じになる。
- 1段目では、Agent Plugins の公式スキーマを手元に写して使う。カスタムエージェントの項目は、Copilot CLI のコマンドリファレンスとカスタムエージェントの設定リファレンスとで一部違うので、両方を認める。
- 2段目では、たとえば次のように部品を動かす。
  - フック：標準入力に JSON を渡し、標準出力の JSON と終了コードを確かめる。入力の形は Copilot CLI と Claude Code で違う（例：エージェント名が `agentName` と `agent_type`）ので、両方の形で確かめる。
  - MCP サーバー：単体で起動し、MCP のクライアント（MCP 公式の Inspector の CLI モードなど）からツールを呼ぶ。
  - Web管理画面：ブラウザーを操作するプログラム（Playwright）で、人と同じ操作をして確かめる。エージェントの状態は、本物のエージェントを動かさず、用意した状態の変化を流して確かめる。

## 3. 試験は2重になる

クリエイターの出力は生成プラグインである。生成プラグインが正しいかは、その生成プラグインをさらに試験して確かめる。

```text
外側の試験（クリエイターを試す）
  模擬した会話 ──▶ クリエイター ──▶ 生成プラグイン
                                        │
内側の試験（生成プラグインを試す）        ▼
  分野の課題 ─────────────────▶ 生成プラグイン ──▶ 成果物
```

| 段階 | 外側（クリエイター） | 内側（生成プラグイン） |
| --- | --- | --- |
| 1 構造の検査 | クリエイターのファイル | できた生成プラグインのファイル |
| 2 部品の試験 | クリエイターのスクリプトなど | 生成プラグインのスクリプト、フック、MCP サーバー、Web管理画面 |
| 3 EVAL | 模擬した会話を入力し、生成プラグインを作らせる | 分野の課題を入力し、成果物を作らせる |

1・2段目の仕組みは、外側と内側で同じものを使う。

試験は次の順に進める。

1. クリエイターに、1・2段目の試験を行う。
2. クリエイターを Claude Code 向けに置き換え、外側の EVAL を行う。生成プラグインができる。
3. できた生成プラグインに、1・2段目の試験を行う。
4. 生成プラグインを Claude Code 向けに置き換え、内側の EVAL を行う。
5. 1〜4の結果から、クリエイターを採点する。

## 4. Claude Code 向けの置き換え

3段目は Claude Code で実行するため、プラグインを Claude Code が読み込める形に置き換えてから試す。

| 部品 | Copilot CLI 向けの形 | Claude Code 向けの形 |
| --- | --- | --- |
| マニフェスト | 直下の `plugin.json` | `.claude-plugin/plugin.json` |
| スキル | `skills/<名前>/SKILL.md` | 同じ場所。フロントマターの `allowed-tools` や本文に書いたツール名を、Claude Code の名前にそろえる |
| MCP サーバー | `mcp.json` | `.mcp.json`。サーバー本体は同じで、設定の書き方（`${PLUGIN_ROOT}` を `${CLAUDE_PLUGIN_ROOT}` にするなど）を置き換える |
| カスタムエージェント | `com.github.copilot/agents/` | `agents/` のサブエージェント。`tools` の別名（`read`、`edit`、`execute`、`search` など）と MCP のツール（`サーバー名/ツール名`）を Claude Code の名前（`Read`、`Edit` と `Write`、`Bash`、`Grep` と `Glob`、`mcp__plugin_<プラグイン名>_<サーバー名>__<ツール名>`）にし、モデル名を置き換える |
| フック | `com.github.copilot/hooks/hooks.json` | `hooks/hooks.json` の形。イベント名（`subagentStart` → `SubagentStart` など）、コマンドの項目（`bash` → `command`）、`${PLUGIN_ROOT}` を置き換える |
| インストラクション | `com.github.copilot/rules/` | Claude Code では、プラグインの直下に置いた CLAUDE.md は読み込まれない。EVAL の課題の側で、指示として足す |

- ツール名は、Copilot CLI の公式ドキュメント（フックのリファレンス）にある対応表に従う。例：`bash` → `Bash`、`view` → `Read`、`ask_user` → `AskUserQuestion`、`task` → `Agent`。
- 本文の中のツール名は、バッククォートで囲んだもの（`` `task` `` など）と、`ask_user` のような普通の単語と紛れない名前だけを置き換える。そのため、SKILL.md やエージェントの本文では、ツール名をバッククォートで囲んで書く。
- モデル名は、Claude Code で使える名前にする。Claude 以外のモデルは、Claude Code では使えない。
- 置き換えは、変換スクリプトで行う。毎回同じ結果になるようにするためである。変換スクリプトも2段目で試験する。
- 置き換えた版は、`claude plugin validate` で Claude Code に読み込めることを確かめてから試す。警告（作者の情報がないなど）は不合格にしない。
- 置き換えた版を試すので、結果は Copilot CLI での振る舞いと完全には一致しない。特に、スキルが呼ばれる場面や、エージェントへの仕事の割り振りは、ツールが違うと変わりうる。質問のツールも、Claude Code では選択肢が必要で、Copilot CLI では自由に答えられるので、質問のしかたが少し変わる。

## 5. EVAL を実行する仕組み

- 外側と内側の EVAL は、Agent SDK（Claude Code をプログラムから動かす公式の部品）を使った、同じ自作の仕組みで実行する。
- Claude Code の `claude plugin eval` は使わない。公式ドキュメントに、ユーザー役が質問に答える仕組みも、実行中にブラウザーを操作する仕組みも見当たらないためである。
- 実行のたびに、まっさらな作業フォルダで始め、試すプラグインだけを読み込む。プラグインなしで比べるときは、何も読み込まない。
- 試されるエージェントは、次のように隔離する。
  - 環境変数は、必要なもの（パス、プロキシと証明書、モデルの接続先）だけを渡し、実行のたびに一時的なホームフォルダを使う。試験する側のセッションの設定が混ざると振る舞いが変わり、資格情報が混ざると試されるコードから見えてしまうためである。
  - ユーザー設定とプロジェクト設定は読み込ませない。
  - コマンドは OS のサンドボックスで動かし、書き込みを作業フォルダに限る。ファイルの書き込みのツールも、作業フォルダの中だけを許す。サンドボックスがないと、エージェントが自分の判断で作業フォルダの外に作業を移すことがあるためである。
  - 生成プラグインの Web管理画面を操作するスクリプトだけは、パスを指定してサンドボックスの外で動かす。Linux のサンドボックスの中では、コマンドごとに専用の localhost を持つので、中で起動した画面にはブラウザーからつながらないためである。
- 普段のツールと、試すプラグインの MCP サーバーのツールは、あらかじめ許可する。許可を求める仕組みに回すのは、ユーザー役が答える質問だけにする。裏で動くサブエージェントの許可の求めは、受け付けられずに失敗することがあるためである。
- 使われたスキル、サブエージェントとそのモデルは、Agent SDK の実行の記録から採点に使う。

## 6. 外側の EVAL

### 6.1 模擬した会話

- 人間との会話は、ユーザー役の AI で模擬する。
- ユーザー役には、模擬ユーザーごとに、依頼の内容と、その人が持っているナレッジを、ナレッジごとの答える条件とともに渡す。聞かれないと話さないナレッジ（当たり前すぎて話されにくいこと、すでに持っている資産）は、具体的に聞かれたときだけ答える条件にする。
- ユーザー役は、クリエイターに聞かれたことだけに答える。
- クリエイターからの質問には、試験の仕組みが、ユーザー役の答えを返す。クリエイターが質問のツールを使わずに、文章で質問して手番を終えたときも、ユーザー役の答えを次の発言として返す。

### 6.2 採点

外側の EVAL では、できた生成プラグインを次の観点で採点する。採点の観点は、出力の要件の受け入れ基準に対応づける。

- 1・2段目の試験に通るか
- 模擬ユーザーのナレッジ、特に聞かれないと話さないナレッジが組み込まれているか
- 内側の EVAL の結果

## 7. 内側の EVAL

- 内側の EVAL の課題と採点基準は、クリエイターとは別に、試験の資産として模擬ユーザーごとに用意する。生成プラグインに入っているテストはクリエイターが作ったものなので、クリエイターの採点には使わない。自分で作った基準で自分を採点しないためである。
- 試験の仕組みは、人と同じ流れ（設定 → 開始 → 監視 → 結果）でブラウザーを操作して、置き換えた生成プラグインを動かす。生成プラグインには、試験のためだけの機能を足さない。
  - Web管理画面の URL が出るのを待ってブラウザーで開き、設定して開始する。
  - 実行中は、フェーズとエージェントの状態の表示を記録する。
  - 終わったら、結果の表示を読む。
- 生成プラグインがチャットで返事や答えを求めて手番を終えたときは、ユーザー役が人の代わりに返事をする。
- 画面で選んだモデルで作業エージェントが動いたかは、実行の記録で確かめる。

## 8. 費用と時間

- 外側の EVAL は、1回ごとに生成プラグインを丸ごと作る。さらに、できた生成プラグインを内側の EVAL で繰り返し動かすので、実行の回数がかけ算で増える。
- 1・2段目は費用がかからないので、すべての生成プラグインに行う。内側の EVAL は、生成プラグインの数と実行の回数を絞って行う。
- 同じ条件でも、進め方や結果は実行のたびに変わる。1回の結果だけで判断しない。
- 目安（プロトタイプで測った値。統括は Sonnet、作業エージェントは Haiku。費用は定価での見積もり）：
  - 内側の EVAL：プラグインありで1回 約1分・約 0.13〜0.22 ドル、なしで1回 約10〜25秒・約 0.03〜0.06 ドル
  - 外側の EVAL：あり・なしと内側の EVAL を合わせて1回 約3分・約 0.4 ドル

## 9. 最終確認

- 最終確認では、人が手元の Copilot CLI にプラグインをインストールし、使い始められることを確かめる（出力の要件のインストールの受け入れ基準）。
- Copilot CLI での読み込みの不具合や、Copilot CLI でしか起きない不具合は、ここで見つける。

## 10. 試験環境に必要なもの

- Agent SDK（Claude Code と同じ版にそろえる）
- bubblewrap と socat（Linux で OS のサンドボックスを動かすため）。クラウド環境には入っていないので、環境の設定のセットアップスクリプトで入れる。
- ブラウザー（Chromium）と、ブラウザーを操作する Playwright。ブラウザーはクラウド環境に入っている。Playwright は、そのブラウザーに合う版を試験の仕組みのフォルダに入れる。全体に入っている Playwright は、ESM 形式のスクリプトから読み込めなかったためである。
- Python と PyYAML・jsonschema（1段目の検査と変換スクリプト）

## 根拠

- 憲章 第6条1項・3項（実装資産にテストコードを含める。仕様書の要件をテストまで追跡できるようにする）
- 出力の要件（[output-requirements.md](../specs/output-requirements.md)）

## 出典

- [Claude Code: Test plugins with evals](https://code.claude.com/docs/en/plugin-evals)
- [Claude Code: Plugin manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference)
- [Claude Code: Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code: Sandboxing](https://code.claude.com/docs/en/sandboxing)
- [Claude Agent SDK: Plugins in the SDK](https://code.claude.com/docs/en/agent-sdk/plugins)
- [Claude Agent SDK: Use Claude Code features in the SDK](https://code.claude.com/docs/en/agent-sdk/claude-code-features)
- [Claude Agent SDK: Handle approvals and user input](https://code.claude.com/docs/en/agent-sdk/user-input)
- [GitHub Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-configuration)
- [Custom agents configuration（GitHub Copilot）](https://docs.github.com/en/copilot/reference/custom-agents-configuration)
- [Agent Plugins Specification 1.0.0](https://github.com/agentplugins/agent-plugins-spec/blob/main/spec/1.0.0.md)
- [Playwright](https://playwright.dev/)
