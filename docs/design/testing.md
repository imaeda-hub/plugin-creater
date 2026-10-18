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
- 2段目では、たとえば次のように部品を動かす。
  - フック：標準入力に JSON を渡し、標準出力の JSON と終了コードを確かめる。
  - MCP サーバー：単体で起動し、MCP のクライアントからツールを呼ぶ。
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
| カスタムエージェント | `com.github.copilot/agents/` | `agents/` のサブエージェント。ツール名とモデル名を置き換える |
| フック | `com.github.copilot/hooks/hooks.json` | `hooks/hooks.json` の形 |
| インストラクション | `com.github.copilot/rules/` | Claude Code では、プラグインの直下に置いた CLAUDE.md は読み込まれない。EVAL の課題の側で、指示として足す |

- ツール名は、Copilot CLI の公式ドキュメント（フックのリファレンス）にある対応表に従う。例：`bash` → `Bash`、`view` → `Read`、`ask_user` → `AskUserQuestion`、`task` → `Agent`。
- モデル名は、Claude Code で使える名前にする。Claude 以外のモデルは、Claude Code では使えない。
- 置き換えは、変換スクリプトで行う。毎回同じ結果になるようにするためである。変換スクリプトも2段目で試験する。
- 置き換えた版は、`claude plugin validate` で Claude Code に読み込めることを確かめてから試す。
- 置き換えた版を試すので、結果は Copilot CLI での振る舞いと完全には一致しない。特に、スキルが呼ばれる場面や、エージェントへの仕事の割り振りは、ツールが違うと変わりうる。

## 5. EVAL を実行する仕組み

- 外側と内側の EVAL は、Agent SDK（Claude Code をプログラムから動かす公式の部品）を使った、同じ自作の仕組みで実行する。
- Claude Code の `claude plugin eval` は使わない。公式ドキュメントに、ユーザー役が質問に答える仕組みも、実行中にブラウザーを操作する仕組みも見当たらないためである。
- 実行のたびに、まっさらな作業フォルダで始め、試すプラグインだけを読み込む。プラグインなしで比べるときは、何も読み込まない。

## 6. 外側の EVAL

### 6.1 模擬した会話

- 人間との会話は、ユーザー役の AI で模擬する。
- ユーザー役には、模擬ユーザーごとに、依頼の内容と、その人が持っているナレッジを渡す。ナレッジには、聞かれないと話さないもの（当たり前すぎて話されにくいこと、すでに持っている資産）を含める。
- ユーザー役は、クリエイターに聞かれたことだけに答える。
- クリエイターからの質問には、試験の仕組みが、ユーザー役の答えを返す。

### 6.2 採点

外側の EVAL では、できた生成プラグインを次の観点で採点する。採点の観点は、出力の要件の受け入れ基準に対応づける。

- 1・2段目の試験に通るか
- 模擬ユーザーのナレッジ、特に聞かれないと話さないナレッジが組み込まれているか
- 内側の EVAL の結果

## 7. 内側の EVAL

- 内側の EVAL の課題と採点基準は、クリエイターとは別に、試験の資産として模擬ユーザーごとに用意する。生成プラグインに入っているテストはクリエイターが作ったものなので、クリエイターの採点には使わない。自分で作った基準で自分を採点しないためである。
- 試験の仕組みは、人と同じ流れ（設定 → 開始 → 監視 → 結果）でブラウザーを操作して、置き換えた生成プラグインを動かす。生成プラグインには、試験のためだけの機能を足さない。

## 8. 費用と時間

- 外側の EVAL は、1回ごとに生成プラグインを丸ごと作る。さらに、できた生成プラグインを内側の EVAL で繰り返し動かすので、実行の回数がかけ算で増える。
- 1・2段目は費用がかからないので、すべての生成プラグインに行う。内側の EVAL は、生成プラグインの数と実行の回数を絞って行う。

## 9. 最終確認

- 最終確認では、人が手元の Copilot CLI にプラグインをインストールし、使い始められることを確かめる（出力の要件のインストールの受け入れ基準）。
- Copilot CLI での読み込みの不具合や、Copilot CLI でしか起きない不具合は、ここで見つける。

## 10. 試験環境に必要なもの

- Agent SDK
- ブラウザー（Chromium）と、ブラウザーを操作する Playwright。クラウド環境に入っている。

## 根拠

- 憲章 第6条1項・3項（実装資産にテストコードを含める。仕様書の要件をテストまで追跡できるようにする）
- 出力の要件（[output-requirements.md](../specs/output-requirements.md)）

## 出典

- [Claude Code: Test plugins with evals](https://code.claude.com/docs/en/plugin-evals)
- [Claude Code: Plugin manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference)
- [Claude Code: Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Agent SDK: Plugins in the SDK](https://code.claude.com/docs/en/agent-sdk/plugins)
- [Claude Agent SDK: Use Claude Code features in the SDK](https://code.claude.com/docs/en/agent-sdk/claude-code-features)
- [Claude Agent SDK: Handle approvals and user input](https://code.claude.com/docs/en/agent-sdk/user-input)
- [GitHub Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-configuration)
- [Agent Plugins Specification 1.0.0](https://github.com/agentplugins/agent-plugins-spec/blob/main/spec/1.0.0.md)
- [Playwright](https://playwright.dev/)
