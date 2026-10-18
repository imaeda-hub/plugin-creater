# Agent SDK で EVAL を動かすときの注意

Claude Code の Agent SDK（TypeScript 版 0.3.302、Claude Code 2.1.302）で、プラグインの EVAL の仕組みを試作して分かったこと（2026年10月）。設計への反映は [試験の設計](../../docs/design/testing.md) にある。試作のコードは、ブランチ `claude/test-prototype` の `prototype/` にある（main には入れていない）。

## 試されるエージェントを隔離する

- 環境変数は、必要なものだけを渡す。SDK は `env` を指定しないと、すべての環境変数を引き継ぐ。
  - 引き継いだとき、試験する側のセッションの設定が混ざった。サブエージェントを裏で動かす設定（`CLAUDE_AUTO_BACKGROUND_TASKS`）、思考の深さ（`CLAUDE_EFFORT`）、追加のフォルダ、セッションの ID などである。
  - GitHub や AWS などの資格情報も、試されるプラグインのコードから見えてしまう。
  - このクラウド環境では、`PATH`、プロキシと証明書、`ANTHROPIC_BASE_URL`、一時的な `HOME` だけで認証できた。
- `settingSources: []` で、ユーザー設定とプロジェクト設定を読ませない。それでも Claude Code に組み込まれたプラグインは読み込まれるが、あり・なしの両方に入るので比較には影響しない。
- コマンドは、OS のサンドボックスで動かす。サンドボックスがないとき、エージェントが自分の判断で `/tmp/work` に作業を移した。サンドボックスでは書き込みが作業フォルダに限られ、外への書き込みは「読み取り専用」として止まった。Linux では bubblewrap と socat が要る。
- ファイルの書き込みのツール（Write、Edit）は、サンドボックスの対象外である。許可の規則で、作業フォルダの中（`Write(./**)`、`Edit(./**)`）だけを許す。

## 許可の求め方

- 普段のツールは `allowedTools` であらかじめ許可し、`canUseTool` に回すのは質問（AskUserQuestion）だけにする。
  - サブエージェントが裏で動いたとき、その許可の求めが受け付けられずに失敗した（「Stream closed」）。
  - `allowedTools` に書いたツールは `canUseTool` に回らないという警告が出るが、ねらいどおりなので問題ない。
- AskUserQuestion への答えは、`updatedInput` の `answers` に「質問の文 → 答え」の形で返す。選択肢にない自由な答えも返せる。

## Linux のサンドボックスとローカルのサーバー

- サンドボックスの中のコマンドは、コマンドごとに専用の localhost を持つ。中で起動した Web サーバーには、外のブラウザーからも、あとから実行する別のコマンドからもつながらない。`allowLocalBinding` は Linux では効かない。
- 外につなぐ必要があるコマンドだけを、`excludedCommands` でサンドボックスの外に出す。パスまで指定して範囲を絞る。
- `excludedCommands` は、1回の呼び出しに含まれるすべてのコマンドが一致したときだけ効く。変数、`cd`、`;`、リダイレクトを付けると、サンドボックスの中のままになる。

## そのほか

- 記録（トランスクリプト）は、`HOME` の下の `.claude/projects/` に残る。続きの会話（`resume`）には、同じ `HOME` を使う。
- 続きの会話で返る `total_cost_usd` は、それまでの分を含む合計である。
- サブエージェントの種類と、それが使ったモデルは、実行の記録（ツール呼び出しの ID とメッセージのモデル名）から分かる。
- 試されるエージェントも、モデルの利用枠を使う。EVAL を続けて回したところ、利用枠の上限に達したというエラー（「You've hit your session limit」）で止まり、示された時刻（約3時間後）まで再開できなかった。

## 出典

- [Claude Agent SDK: Handle approvals and user input](https://code.claude.com/docs/en/agent-sdk/user-input)
- [Claude Agent SDK: Use Claude Code features in the SDK](https://code.claude.com/docs/en/agent-sdk/claude-code-features)
- [Claude Code: Sandboxing](https://code.claude.com/docs/en/sandboxing)
