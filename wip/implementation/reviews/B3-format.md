# B3 の点検：観点 format

状態：途中（SKILL.md 2つ・references・エージェント2つ・plugin.json・ツールの説明の案まで見た。README と marketplace.json は公式ドキュメントで確かめている途中）

点検の物差し：R1 の (1)（SKILL.md とカスタムエージェントの決まり）、R3 の 1.1・1.4・1.8（plugin.json、スキルのフロントマター、marketplace.json）、B3.md の「決まり」、hearing.md 10.1、ユーザーの答え 11・12（RESUME.md）、公式ドキュメント（README のコマンド）。

## 数えたもの

数え方：スクラッチの仮想環境（tiktoken 0.14.0、o200k_base）。フロントマターを除いた本文を数えた。スクリプトは /tmp/claude-0/-home-user-plugin-creater/f6e65e0d-9c94-5351-8ee1-475927b3b43e/scratchpad/b3-format/measure.py（作った者の count.py とは別に書いた）。

| ファイル | 本文の行数 | 本文のトークン数 | 大きさ（バイト） | 決まり | 判定 |
| --- | --- | --- | --- | --- | --- |
| skills/make-plugin/SKILL.md | 120 | 4,335 | 15,922 | 500行未満・5,000トークン未満 | 合う（作業のメモの数と同じ。残りは665トークン） |
| skills/test-plugin/SKILL.md | 45 | 1,668 | 6,325 | 同上 | 合う |
| references/assets.md | 26 | 930 | 3,439 | 20KB 未満。100行を超えたら目次 | 合う |
| references/carried.md | 20 | 416 | 1,558 | 同上 | 合う |
| references/confirm.md | 51 | 1,836 | 6,432 | 同上 | 合う |
| references/deepen.md | 49 | 1,108 | 3,791 | 同上 | 合う |
| references/generate.md | 73 | 2,393 | 8,291 | 同上 | 合う |
| references/improve.md | 29 | 1,026 | 3,700 | 同上 | 合う |
| references/items.md | 36 | 1,126 | 4,068 | 同上 | 合う |
| references/last-time.md | 27 | 744 | 2,693 | 同上 | 合う |
| references/read.md | 32 | 972 | 3,464 | 同上 | 合う |
| references/receive.md | 21 | 532 | 2,010 | 同上 | 合う |
| references/rules.md | 28 | 666 | 2,318 | 同上 | 合う |
| references/screen.md | 43 | 906 | 3,171 | 同上 | 合う |
| references/start.md | 19 | 773 | 2,865 | 同上 | 合う |
| references/words.md | 25 | 580 | 1,936 | 同上 | 合う |
| agents/reader.agent.md | 59 | 1,216 | 4,832（本文 1,690 文字） | 本文 30,000 文字以内 | 合う |
| agents/worker.agent.md | 126 | 3,259 | 11,458（本文 5,308 文字） | 同上 | 合う |

- description の長さ：make-plugin 190 文字、test-plugin 154 文字、reader 147 文字、worker 208 文字。どれも 1024 文字以内で、`<`・`>` を含まない。
- references の14個は、すべて make-plugin の本文で名指しされている（段階の表、deepen.md と improve.md と words.md は表の外の文）。
- plugin.json は、写したスキーマ（wip/implementation/research/schemas/agent-plugins-1.0.0/plugin.schema.json）で合格した（jsonschema 4.26.0）。`tests/creator/check_creator.py .` は、会話例（examples/ がまだない）の1件のほかは合格。

## 指摘

### F-1（medium）生成プラグインの名前と入口のスキルの description の決まりが足りず、組み立てで断られたときに直す者がいない

- ファイルと場所：skills/make-plugin/references/generate.md「## 1. 部品の分け方を決める」の「生成プラグインの名前（英小文字・数字・ハイフン。作業が分かる英語）と、1行の説明」「入口のスキルの名前と description。description は日本語で、何ができあがるかを手順でない短い1句で書き、…」と、「## 3. 組み立て」の「3. 失敗したら、返った理由を作業エージェントに渡して直させ、もう一度動かす。」
- 問題：メインのエージェントが manifest.json に書く名前と description に、公式の形の決まりの一部しか書いていない。
  - 名前：「1〜64文字」「ハイフンで始めず・終えず」「`--` を含めない」がない。入口のスキルの名前には、決まりが何も書かれていない。
  - description：「1行」「1024文字以内」「`<`・`>` を入れない」「『I can …』『You can …』の形にしない」がない。
  - 組み立てのスクリプトはこれらを断り（scaffold.py の `NAME_RE`・64文字、`check_description` の「1行で書いてください」「1024 文字以内」）、1段目は `<`・`>` と「I can」を不合格にする（template/tests/stage1/check_structure.py 439〜442行）。一方、3の3は断られた理由を作業エージェントに渡すが、作業エージェントは manifest.json を「読むだけで、書き換えない」（worker.agent.md「## B 生成プラグインの部品」）。名前や description で断られると、直せないまま直しの回数を使い切るおそれがある。
- 根拠：R1 (1) の SKILL.md の2「`name` は1〜64文字の英小文字・数字・ハイフンにし、ハイフンで始めず・終えず、`--` を含めない」、3「`description` は1024文字以内にする」「『I can …』『You can …』の形にしない。XML のタグ（`<`、`>`）を入れない」。Agent Skills の仕様（agentskills.io/specification、2026-10-24 に取得）の `name` と `description` の欄。ユーザーの答え11（「クリエイターが書く生成プラグインのスキルにも効く」）。
- 直し方：generate.md の1に次の2点を足す。
  - 「生成プラグインの名前と入口のスキルの名前は、1〜64文字の英小文字・数字・ハイフンにし、ハイフンで始めず・終えず、`--` を含めない。」
  - 「description は1行・1024文字以内にし、`<` と `>` を入れず、『I can』『You can』で始めない。」
  - 3の3を「manifest.json の誤りで断られたら、自分で manifest.json を直す。それ以外は、返った理由を作業エージェントに渡して直させる」に分ける。
- 確かさ：確か（scaffold.py 66・84・240〜246・313〜331行、check_structure.py 434〜442行、worker.agent.md 42行で確かめた）

### F-2（medium）マーケットプレイスの `source: "./"`（リポジトリの直下）が通るかを確かめていない

- ファイルと場所：.github/plugin/marketplace.json の `"source": "./"`。README.md「## インストール」の `copilot plugin install plugin-creator@plugin-creator`
- 問題：公式ドキュメントの `source` の例は、どれも下のフォルダ（`./plugins/frontend-design` など）を指す。リポジトリの直下を指す例はない。通らなければ、README に書いた入れ方が唯一の入れ方なのに動かない。作業のメモの「要確認3」、C2・A4 のメモにも同じ未確認がある。
- 根拠：R3「確かめられなかったこと」の「マーケットプレイスの `source` に、リポジトリの直下のプラグイン（`./`）を指定できるか。docs に記述がない」。公式の plugin reference の「Plugin entry fields」（`source`：「Where to fetch the plugin (relative path, GitHub, or URL)」）と plugins-marketplace（例は `"source": "./plugins/frontend-design"`）。どちらも github/docs の main から 2026-10-24 に取得した。1.0.102 の文字列には「Plugin path escapes marketplace directory」がある。ただし、どう判定するかは、ネイティブの部品の文字列からは読めなかった。
- 直し方：最終確認の手順に、モデルを使わない次の確かめを入れる。`copilot plugin marketplace add <このリポジトリの手元のフォルダ>` → `copilot plugin marketplace browse plugin-creator` → `copilot plugin install plugin-creator@plugin-creator` → `copilot plugin list --json`。入らなければ、`source` を `"."` にするか、プラグインを下のフォルダに移す。ひな形の marketplace.json（C2）も同じ形なので、一緒に確かめる。
- 確かさ：たぶん（上の4つのコマンドで決まる）

### F-3（low）環境の落とし穴が references にだけある

- ファイルと場所：references/receive.md「答えに `<pasted_content file="…" />` が入っていたら、そのファイルが示されたものとして扱う」。references/read.md「例外：ユーザーが打った発言に文書がそのまま添えられて届いたとき（発言に「The user included native document attachments in this message.」の文が加わる）は、その文書は自分で読んで候補を記録する」
- 問題：どちらも Copilot CLI の環境に特有の落とし穴である。ところが、その段階のファイルを読んでいるときにしか見えない。長い貼り付けや `@` の文書は、ほかの段階の答え（前回の1回の長い話、生成前の確認の直しなど）でも届きうる。そのとき、`<pasted_content>` のファイルを読まずに、答えがないものとして扱うおそれがある。
- 根拠：R1 (1) の SKILL.md の5「落とし穴（gotchas）は references ではなく本文に置く」。R1 (3-1)「環境に特有の落とし穴（gotchas）は、参照ファイルではなく SKILL.md に置く。モデルが、読むべき場面に気づかないことがあるため（[BP]）」。hearing.md 2.4 の事実の表「入力欄への貼り付けは、約20KB までは全文がモデルに届く。それより大きいと、…`<pasted_content file="…" />` のパスだけが届く」は、段階を限っていない。ただし、hearing.md 3.1 はこの扱いを段階「実物を受け取る」に置いていて、R1 と食い違う。
- 直し方：本文の「記録のしかた」か「問いの形」に、すべての段階で効く1文を置く。例：「どの段階でも、答えに `<pasted_content file="…" />` があれば、そのファイルを読んで答えとする。発言に文書がそのまま添えられて届いたら、その文書を自分で読む。」references の側は、段階に特有の扱いだけを残す（ファイルの場所として記録する、候補を記録する）。足すと本文は約60トークン増えるが、5,000トークンには収まる。設計書との食い違いは、作業のメモの「上位の文書で直すこと」に書く。
- 確かさ：たぶん（`ask_user` の自由入力の欄に約20KB を超えて貼ったときにも `<pasted_content>` になるかで決まる。チャットに書く答え〔答えが来ないときの続け方、Claude Code の文章の問い〕では、hearing.md 2.4 のとおり起きる）

