# B2 の点検：観点 format

状態：完了

点検の物差し：R1 の (1)（SKILL.md とカスタムエージェントの決まり）と (3-1)・(3-2)、R3 の 1.4（スキルのフロントマター）、B2.md の「決まり」、tasks/B2.md と tasks/C2.md の「組み立てへの引き継ぎ」、BLUEPRINT 6章・8章、C2 の skills/make-plugin/scripts/scaffold.py（組み立ての後の形を実際に作って確かめた）。

点検したファイル：skills/make-plugin/assets/template/ の skills/_entry_/SKILL.md、com.github.copilot/agents/orchestrator.agent.md・worker.agent.md・verifier.agent.md、com.github.copilot/extensions/_plugin_/core/tools.mjs の description。

## 確かめたこと（合っていたもの）

組み立て：C2 の本物の CLI（`python3 -I skills/make-plugin/scripts/scaffold.py build`、ひな形は本物）で、tests/creator/scaffold/sample の見本から2通り作った。スクリプトと出力は /tmp/claude-0/-home-user-plugin-creater/f6e65e0d-9c94-5351-8ee1-475927b3b43e/scratchpad/b2-format/（build_variants.py、check_fm.py、strict_check.py、edge.py、出力は one/ と two/ の folder/weekly-report）。

- one：見本のまま（作業エージェント1体、作業ごとのツールなし）。
- two：作業エージェント2体（worker、worker-check）、統括・作業の2体目・検証に作業ごとのツール、mcp.json あり、入口のスキルの description に `"`・`:`・`\`・`#`・「Use when:」を入れた。

結果：

- 2通りとも build が通り、A3 の構造の検査（組み立てたプラグインの tests/stage1/check_structure.py）が全項目で合格（references はファイルがないので飛ばし）。差し込み口は残らない。
- フロントマターは PyYAML で読め、SKILL.md は Agent Skills の検証の参照実装と同じ切り方（`split("---", 2)`）と strictyaml 1.6.2 でも読めた。name はフォルダ名と同じ、Agent Skills の6項目以外の項目なし。description の `"` と `\` は正しく戻る。
- Copilot CLI 1.0.102 のフロントマターの読み手は、Rust の serde_yaml 0.9.34（unsafe-libyaml 0.2.11）である（R2 で展開したパッケージの runtime.node の文字列「src/native/frontmatter/src/lib.rs」「custom agent markdown frontmatter is malformed」）。JSON の escape は YAML の二重引用符の escape に含まれるので、組み立ての置き換え方で読める。
- tools の作業ごとの分は `  - "docs/status"` の行になり、ツールがないときは行ごと消えて空行も残らない（B2 と C2 の取り決めどおり）。`{{worker_agents}}` は ``- `weekly-report:worker`：週報を書く係`` の行になる。
- model：統括・検証 `[claude-sonnet-5.5, gpt-6.1-sol]`、作業 `[gpt-6-luna, claude-haiku-5.5]`。4つの ID は runtime.node の文字列にあり、書き方は組み込みの定義（`model: [gpt-5.6-luna, gpt-5.4-mini]`）と同じ形。`models`・`model-policy`・`reasoningEffort`・`name`・`disable-model-invocation`・`user-invocable`・`infer`・`include-custom-instructions` は書いていない。
- tools：別名は小文字（agent、read、edit、execute、search）、記録のツールは名前のまま、`*` と `skill` なし、検証に edit と execute なし。
- 統括の本文の `task` の引数の名前（`agent_type`、`mode` の `"sync"`／`"background"`、`description`、`prompt`）は、runtime.node の `task` の引数の説明（「3-5 word UI intent.」「Task; include complete context.」「Agent type.」「Use "sync" by default; "background" only with independent work.」）と合う。
- 大きさ（tiktoken o200k_base、組み立て後の two）：SKILL.md 本文 49 行・1,570 トークン（500 行・5,000 トークン未満）。本文の文字数は統括 3,501、作業 1,140、作業の2体目 1,069、検証 1,353（30,000 文字以内）。description は 108〜134 文字で、`<`・`>` なし。UTF-8、BOM と CRLF なし。
- 本文の組み立て：SKILL.md は守らせたい決まりが先頭（「先頭の決まり」）。3つの定義は 役割 → 受け取るもの → 手順 → 返す形（雛形つき）→ してはいけないこと の順（間に「作業ごとの指示」などの節を足した形）。ツール名と引数の名前はバッククォートで囲まれている。強い言葉、版や日付、ナレッジの番号の例（`K-` と数字）はない。応答・出力の言語は「日本語」と具体の言語名で書かれている。
- 統括の本文が引く core の文（「繰り返しはもう終わっています」「作業を終えてください」「この実行は止められた」、合否の基準の「- 番号：文」の形）は、core/records.mjs・constants.mjs・index.mjs・lifecycle.mjs の buildInstruction の文と合う。README のひな形に「### 任せたいツールを前もって許可する」の見出しがある（SKILL.md が名指しする節）。

## 指摘

### F-1（medium）差し込み口の文の見出しの段（`###` 以下）の決まりが、差し込み口を書く者に届いておらず、組み立て後に「作業ごとの指示」の節が空になる

- ファイルと場所：ひな形の worker.agent.md「## 作業ごとの指示」の下の `{{slot:worker-task}}`（orchestrator.agent.md・verifier.agent.md の「## 作業ごとの指示」、SKILL.md の「## このプラグインがする作業」も同じ）。決まりは tasks/B2.md の「組み立てへの引き継ぎ」の表の「見出しは `###` 以下」「見出しを使うなら `###` 以下」にだけある。
- 問題：差し込み口の文を書くクリエイターの作業エージェント（com.github.copilot/agents/worker.agent.md の「### 差し込み口に書くこと」の表）には、`task-requirements` と `task-design` のほかに見出しの段の決まりがない。C2 の見本 tests/creator/scaffold/sample/parts/slots/worker-task.worker.md は `## 週報の書き方` で始まり、C2 の試験の two_workers も `## まとめ方` を書く。見本で組み立てると、worker.agent.md は「## 作業ごとの指示」（中身なし）→「## 週報の書き方」→「## 返す形」となり、作業ごとの指示が「作業ごとの指示」の節の外の、別の節になった（scratchpad/b2-format/two/folder/weekly-report/com.github.copilot/agents/worker.agent.md で確かめた）。本文は「下の「作業ごとの指示」を読む」「作業ごとの指示に、送る表示が書かれていれば」と節の名前で指すので、文字どおりに読むモデルは、作業ごとの指示がないと受け取りうる。
- 根拠：tasks/B2.md の「組み立てへの引き継ぎ」の表（「見出しは `###` 以下」）。R1 の (1) カスタムエージェント 8（本文を 役割 → 受け取るもの → 手順 → 返す形 → してはいけないこと の順に組み立てる）。R1 (3-3)「Markdown の見出しと一覧で節と階層を示し」（[O-PE]）、「Sonnet 5 は低い effort ほど文字どおりに従い、1つの項目への指示を、ほかの項目に広げない」（[A-S5]）。
- 直し方：
  1. クリエイターの作業エージェント（com.github.copilot/agents/worker.agent.md の「### 書き方の決まり」）に1行足す：「`entry-task`・`orchestrator-task`・`worker-task.<agent>`・`verifier-task` の文で見出しを使うときは `###` 以下にする。ひな形の `##` の節の中に入るためである。」（B3 の担当）
  2. C2 の見本 worker-task.worker.md の `## 週報の書き方` を `### 週報の書き方` に、試験の two_workers の `## まとめ方` を `### まとめ方` に直す（C2 の担当）。
  3. 守らせたいなら、scaffold.py が、この4つの差し込み口の文に `#` か `##` で始まる行があれば断るか警告する（C2 の担当。断るなら problems に「見出しは ### 以下にしてください」）。
  4. BLUEPRINT 8章の差し込み口の名前の項に、見出しの段の決まりを足す（B2 のメモの「上位の文書で直すこと」の BLUEPRINT 8章の項に含める）。
- 確かさ：確か（節がずれることは組み立てて確かめた。モデルの振る舞いへの効き方は実機で確かめていない）。

### F-2（low）検証エージェントの本文に、ファイルの場所を絶対パスで扱う文がない

- ファイルと場所：verifier.agent.md の「## 受け取るもの」「## 手順」の 1・2（「成果物そのものを読んで確かめる」「どのファイルのどこが、なぜ基準に合わないか」）。
- 問題：統括（「ファイルの場所は絶対パスで書く」）と作業（「ファイルの場所は絶対パスで扱う」）にはあるが、検証にはない。検証の指摘は作業エージェントに渡され、画面でユーザーも読むので、ファイルを相対パスや名前だけで示すと、どのファイルかが定まらないことがある。B2 のメモの「R1 の (1) との照らし合わせ」は、カスタムエージェント 9 を「合う（3つとも）」としていて、実際と合わない。
- 根拠：R1 の (1) カスタムエージェント 9「ファイルの場所は絶対パスで扱うよう書く」。R1 (3-2) 組み込みのエージェントの共通の型「ファイルのパスは絶対パスで書く」。
- 直し方：verifier.agent.md の手順 2 の「不合格の基準には、どのファイルのどこが、」の前に、「ファイルの場所は絶対パスで扱い、指摘でファイルを示すときも絶対パスで書く。」を足す（理由は「作業エージェントが、その指摘だけで直せるようにするためである」に含まれる）。B2 のメモの照らし合わせの 9 も直す。
- 確かさ：確か。

### F-3（low）作業エージェントが2体以上のとき、どの定義の description も同じ文になり、何に長けたエージェントかが分からない

- ファイルと場所：worker.agent.md のフロントマター `description: "{{plugin_name}} の作業エージェント。{{plugin_name}} の統括エージェントが、試行ごとの計画に沿って成果物を作らせるときに呼ぶ。…"`。組み立てで worker-<名前>.agent.md に同じ文が写る（two の worker.agent.md と worker-check.agent.md で確かめた）。
- 問題：B2 は「統括は名前で呼ぶので、description で選ばない」として、エージェントごとに分けないと決めた（tasks/B2.md「決めたこと」の3つ目）。しかし description は `task` のエージェントの一覧に出る、選ぶときの手がかりで、2体が同じ文だと一覧からは見分けられない。統括の本文の `{{worker_agents}}` の一覧には呼び名があるが、`task` の一覧の側では区別がない。
- 根拠：R1 の (1) カスタムエージェント 2「`description`（必須）には、何に長けたエージェントか（成果）と、いつ任せるかを書く。メインのエージェントが `task` で選ぶときの手がかりになる」。R1 (3-2)「公式の description の勧め：what expertise this agent has and when it should be used」（[CA]）。
- 直し方：worker.agent.md の description の初めの文を `"{{plugin_name}} の作業エージェント（{{worker_label}}）。…"` にし、C2 の worker_copy が、作業エージェントごとに `{{worker_label}}` を manifest.json の workers[].label で置き換える（二重引用符の中なので、今の yaml_value と同じく JSON の escape で入れる）。引き継ぎの「決まった値」の表に `{{worker_label}}` を足す。直さないなら、今の決めたことに「`task` の一覧では作業エージェントを見分けられないが、統括は `{{worker_agents}}` の名前で呼ぶ」と、割り切りを書き足す。
- 確かさ：たぶん（統括が `agent_type` を選ぶときに、`task` の一覧の description をどれだけ見るかは、実機で確かめていない。統括が名前を取り違えた実行の記録があれば決まる）。

### F-4（low）`show` の引数 `value` の説明に、progress の「0〜100 の数」の形がなく、ツールの説明の文と食い違う

- ファイルと場所：core/tools.mjs の show。ツールの description「progress は 0〜100 の数か { value, max, label }（label はなくてよい）」と、`value` の description「progress は { value, max, label? }」。
- 問題：同じツールの中で、受け付ける形の書き方が2通りある。core/records.mjs の normalizeDisplay は数（0〜100）も受け付けるので、ツールの説明が正しく、引数の説明が足りない。モデルはどちらを読むかで書き方がぶれる。B2 は「引数の説明は変えていない」とした（B2.md の「引数の形と処理は変えない」を、引数の説明も含むと読んだ）が、食い違いは残った。
- 根拠：R1 の (1) SKILL.md 10「食い違う指示やあいまいな指示を残さない。GPT-6 の族は…食い違いがあると止まりやすい」（カスタムエージェント 12 と BLUEPRINT 6章で、記録のツールの説明の文にも R1 の決まりを当てる）。core/records.mjs の `case 'progress'`（`typeof value === 'number'` で 0〜100 を受け付ける）。
- 直し方：`value` の description を「表示の種類に合う値。text は文字列、kv は { 見出し: 値 }、table は { columns: [見出し], rows: [[値]] }、progress は 0〜100 の数か { value, max, label? }、image と file は作業フォルダの中のファイルの場所の文字列。」にする（引数の形・処理は変えない。説明の文だけ）。引数の説明に手を入れてよいかは統括が決める。
- 確かさ：確か。

### F-5（low）`issue` の説明の文で、review の記録のツールの名前がバッククォートで囲まれていない

- ファイルと場所：core/tools.mjs の issue の description「名前の終わりが _review の記録のツールが返した課題と同じものは足さない。」
- 問題：ほかの部品（SKILL.md と3つの定義）はツール名をバッククォートで囲むが、ここだけ地の文に `_review` が混ざる。土台の文なのでプラグインの名前は入れられないが、名前の一部であることは示せる。
- 根拠：R1 の (1) SKILL.md 7「ツールの名前はバッククォートで囲む」（BLUEPRINT 6章：記録のツールの説明の文は R1 に沿って仕上げる）。B2.md の点検の観点 format「ツール名のバッククォート」。
- 直し方：「名前が `_review` で終わる記録のツールが返した課題と、同じものは足さない。」にする。
- 確かさ：確か。

### F-6（low）入口のスキルの description に入れられる字の確かめが足りず、組み立て後のフロントマターが読めなくなる字がある

- ファイルと場所：SKILL.md のフロントマター `description: "{{entry_skill_description}}"`（B2 の置き方）と、それを埋める scaffold.py の check_description・json_escape（C2）。
- 問題：B2 の置き方（二重引用符の中に JSON の escape で入れる）は、改行と `"`・`\`・制御文字（U+0000〜U+001F）には強いが、次の2つは組み立てを通ってしまう。
  1. description の中の `---`：Agent Skills の検証の参照実装（skills-ref の parse_frontmatter）は、ファイルを `content.split("---", 2)` で切るので、`"週報を作る --- 下書き"` は引用符が閉じないと読まれ、不合格になる（strictyaml で確かめた。scratchpad/b2-format/edge/x/SKILL.md）。A3 の構造の検査は行の頭の `---` だけで切るので、見つけない。
  2. U+007F と U+0080〜U+009F（U+0085 を除く）：json.dumps（ensure_ascii=False）は escape せず、YAML の読み手（PyYAML。libyaml も同じ決まり）は「special characters are not allowed」で読めない（scratchpad/b2-format/edge.py で確かめた）。こちらは A3 の構造の検査が見つける。
- 根拠：R1 (3-1)「Agent Plugins 1.0.0 は、プラグインのスキルが Agent Skills の仕様に従うことを求め（MUST）、従わないスキルをクライアントが飛ばすこと（MUST skip）を定める」、「Agent Skills の検証の参照実装」（[REF]）。R3 1.4。B2.md の点検の観点 format「組み立ての後に正しい YAML とスキルの決まりになるか」。
- 直し方：scaffold.py の check_description（entry_skill.description に当てる分）で、`---` を含む文と、U+007F〜U+009F・U+FFFE・U+FFFF を含む文を断る（problems に「description に --- や見えない制御文字を入れないでください」）。B2 のひな形は直さなくてよい（C2 の担当）。
- 確かさ：たぶん（1 は、Copilot CLI 自身の読み手〔Rust の frontmatter の部品〕が行の頭の `---` で切るなら Copilot CLI では読める。skills-ref と同じ切り方をするクライアントがあるかは確かめていない。メインのエージェントが description に `---` や制御文字を書くことはまれ）。

## 数

- high：0
- medium：1（F-1）
- low：5（F-2〜F-6）
