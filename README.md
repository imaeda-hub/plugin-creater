# plugin-creator

plugin-creator は、GitHub Copilot CLI のプラグインです。チャットであなたの仕事のやり方や決まりをお話で聞き取り、それを組み込んだ Copilot CLI のプラグインを作って、試験します。

できあがるプラグインは、まとめ役・作業役・確認役の AI に分かれて作業し、ブラウザーで開く作業の画面で、設定・監視・結果の確認ができます。

## インストール

このリポジトリをマーケットプレイス（プラグインの一覧を配る場所）として登録してから、プラグインを入れます。

```shell
copilot plugin marketplace add imaeda-hub/plugin-creator
copilot plugin install plugin-creator@plugin-creator
```

`plugin-creator@plugin-creator` は、@ の前がプラグインの名前、後ろがマーケットプレイスの名前です。

- Copilot CLI の中では、`/plugin marketplace add imaeda-hub/plugin-creator` と `/plugin install plugin-creator@plugin-creator` でも入れられます。
- GitHub からダウンロードしたフォルダから入れるときは、1行目の `imaeda-hub/plugin-creator` の代わりに、そのフォルダの場所（`/` や `~` から始まる絶対パス）を書きます。
- フォルダを直接指定する入れ方（`copilot plugin install ./フォルダ`）は、Copilot CLI 1.0.102 が「廃止予定」と表示するので、マーケットプレイスを通す入れ方にしています。

## 使うための準備

次の2つを、最初に行います。

### 1. 試験的機能を有効にする

plugin-creator の画面と記録を動かす仕組み（エクステンション。Copilot CLI が起動する別のプログラム）は、試験的な機能です（Copilot CLI 1.0.102 の時点）。有効にしないと、plugin-creator は使えません。

初めて使うときは、Copilot CLI を次のように起動します。一度付けると設定に残るので、次からは付けなくても有効です。

```shell
copilot --experimental
```

すでに起動しているときは、チャットで次のように打ちます。Copilot CLI が自動で再起動して、有効になります。再起動すると、今の会話は終わります。再起動の後は、まだ信頼していないフォルダでは、フォルダを信頼するかの確認が出て、続けて次の読み込みの確認が出ます（読み込みの確認は、続けて2回出ることがあります）。

```text
/settings experimental on
```

### 2. 読み込むときの確認を許可する

plugin-creator を読み込むとき、Copilot CLI がチャットに確認を出します。題は `Extension "plugin:plugin-creator:plugin-creator" wants elevated permissions` で、本文は次のとおりです。

```text
This extension wants to: skip tool permission prompts, register hooks.
Denying will prevent this extension from loading.
```

許可を自動で判定する設定（Assisted の許可）を使っていても、この確認は自動では許可されず、必ずあなたに出ます（Copilot CLI 1.0.101 から）。

確認の意味は次のとおりです。

- `skip tool permission prompts`（ツールの許可の確認を省く）：plugin-creator の画面を開くツールと、お話で決まったことを手元の記録に書くツールは、確認なしで動きます。お話の途中で、毎回確認が出ないようにするためです。あなたが示した Word・Excel・PowerPoint の文書の文字を読むツールも、確認なしで動きます（Copilot CLI を起動したフォルダの外の文書も読めます）。plugin-creator に改善の要望（Issue）を出すツールだけは、毎回確認が出ます。
- `register hooks`（フックを登録する）：お話の間、問いと答えを手元のファイルに記録します。また、会話の自動の要約（コンパクション）の後に1回だけ、AI に手順を読み直すよう知らせます。長いお話の途中で、手順が抜けないようにするためです。

許可する理由は、断ると plugin-creator が読み込まれず、お話を始められないからです。選び方は次のとおりです。

| 選択肢 | 意味 |
| --- | --- |
| Yes | 今回だけ許可します。Copilot CLI を起動するたびと、`/clear` のたびに、また確認が出ます |
| Yes, and always allow "plugin:plugin-creator:plugin-creator" in this directory（後ろにフォルダの場所が付きます。作業フォルダが Git のリポジトリのときは、`in this directory` の代わりに `in this repo` と出ます） | このフォルダでは常に許可します。このフォルダでは、次から確認が出ません（`/clear` の後も、起動し直しても）。ほかのフォルダでは、また出ます |
| Yes, and don't ask again for "plugin:plugin-creator:plugin-creator" this session | フォルダが分からないときに、上の選択肢の代わりに出ます。このセッション（Copilot CLI の1つの会話。`/clear` で新しいセッションになります）の間は、確認が出ません |
| No (Esc) | 断ります。plugin-creator は読み込まれません |

## 使い方

1. できあがるプラグインを置きたいフォルダ（作業フォルダ）で、Copilot CLI を起動します。
2. チャットで頼みます。例：「〇〇の作業を自動化したい」「この仕事を AI に任せたい」。手元の既存のプラグインを作り直したいときは、そのフォルダを示して頼みます。`/plugin-creator:make-plugin` と打っても始められます。
3. チャットに、plugin-creator の画面の URL が示されます。ブラウザーで開くと、お話で決まったことの一覧と、まだ聞いていないことが見られます。画面は見るだけで、答えや直しはチャットで行います。この URL は、Copilot CLI を動かしているマシンのブラウザーからだけ開けます。
4. 問いに答えていきます。最近実際にやった1回の流れや、いつも使っているファイルも聞かれます。
5. 作る前に、まとめと、作業の画面の見本と、試しに動かして採点する試験でプラグインにさせる作業とその合格の条件が示されます。直したいところを伝え、よいと答えると、作業フォルダの中の新しいフォルダに、git のリポジトリとしてプラグインができます。
6. できたプラグインの試験の結果と、使い方が示されます。

### 途中でやめて、後で続ける

疲れたときや急いでいるときは、途中でやめられます。続きは、前のセッションに戻ると、やめたところから聞かれます。

- すぐに続けるとき：`copilot --continue`
- 間に別のセッションを使ったとき：`copilot --resume=<セッションの番号>`（番号は、やめるときにチャットに示されます）

`/clear` や新しいセッションでは、最初から始まります。

### 答えが来ないとき、質問を受けられない起動のとき

plugin-creator は、あなたにしか分からないことを推測で埋めず、止まります。

- 質問を Ctrl+D で断ったとき、Esc で閉じたとき、autopilot で動かしているとき：何を聞きたかったかと、続け方（チャットに答えを書く、autopilot を切る。autopilot は Shift+Tab でモードを切り替えて切ります）を示して止まります。答えていない問いは、続けるときにもう一度聞かれます。それまでプラグインは作られません。
- 作った後の、試験の道具を入れるかと、改善の要望を出すかの問いに答えが来なかったときは、止まらずに、入れない・出さないとして進みます（試験をしなかったことは、できたことの説明で示されます）。
- `-p` や `--no-ask-user` を付けて起動したとき：質問のツールがないので、お話を始めず、これらを付けずに対話モードで起動し直すよう示します。

## モデルの選び方

- お話で仕事のやり方や決まりを聞き取る仕事には、思考力の高いモデルが向いています。
- モデルは `/model` で変えられます。お話と、作るときの判断は、選んだモデルで行います。
- できあがるプラグインのファイルを書く仕事は、選んだモデルによらず、費用の低いモデル（GPT-6 Luna。使えないときは Claude Haiku 5.5）で行います。ただし、モデルを Auto にしていると、ファイルを書く仕事も、Auto が選んだモデルで行います。

## できたプラグインの試験

- ファイルの形の検査と動きの試験は、できたプラグインのフォルダで `python3 tests/run.py` の1つのコマンドで動きます。AI クレジットを使いません。plugin-creator を入れていなくても動きます。
- 試しに動かして採点する試験（EVAL）は、チャットで「作ったプラグインを試験して」と頼むと行われます。AI クレジットを使うので、始める前に、実行の回数と使う AI クレジットの見込みが示され、よいと答えてから始まります。見込みを出せないときは、そのことと、使った分は終わった後に示すことが伝えられます。プラグインを直した後も、同じように頼めます。
- 試験に要る道具（Python、Playwright など）が足りないときは、足りない道具と入れ方と入れる場所が示されます。よいと答えると、plugin-creator が入れます。試しに動かして採点する試験の道具は、`<COPILOT_HOME>/plugin-data/plugin-creator/tools/` に入ります。

## 質問の改善の要望

作った後と、あなたが試験を頼んだ後に、plugin-creator が自分の質問の足りなかったところを振り返り、plugin-creator の GitHub リポジトリに出す改善の要望（Issue）の案を示すことがあります。案には、あなたの仕事の中身は書かれません。

- 案ごとに、出してよいかが聞かれます。よいと答えた案だけが出されます。
- 出すときに、Copilot CLI がツールの許可の確認を出します。この確認が、出してよいかの最後の歯止めです。確認では、毎回、今回だけ許可する選択肢を選び、このセッションの間や、ずっと許可する選択肢を選ばないでください。Issue を出すツールを、起動のときの `--allow-tool` などで前もって許可することもしないでください。
- 出すには、gh（GitHub の公式のコマンド）を入れて、`gh auth login` でログインしておきます。

## お話の記録の置き場所と消し方

お話の途中経過は、Copilot CLI の設定フォルダの中に、セッションごとに残ります。手元にだけ置かれ、外には送られません。

```text
<COPILOT_HOME>/plugin-data/plugin-creator/hearings/<セッションの番号>/
```

- `<COPILOT_HOME>` は、ふつうはホームフォルダの `.copilot` です（例：`~/.copilot/plugin-data/plugin-creator/hearings/`）。
- 中には、決まったことの記録（`state.json`）と、問いと答えの記録（`qa.jsonl`）があります。あなたの仕事の中身が入っています。
- 記録は自動では消えません。要らなくなったら、セッションの番号のフォルダを消します。すべて消すときは、`hearings` のフォルダを消します。記録を消したセッションは、`--continue` や `--resume` で戻っても、続きから聞けません。

## うまく始まらないとき

チャットで頼んでも plugin-creator の画面の URL が示されないときは、plugin-creator のエクステンションが読み込まれていません。次のどれかです。

- 試験的機能を有効にしていない：「1. 試験的機能を有効にする」のとおりに、`copilot --experimental` で起動するか、`/settings experimental on` と打ちます。
- 読み込むときの確認を断った：Copilot CLI を起動し直して、出た確認を許可します。選び方は「2. 読み込むときの確認を許可する」にあります。
- エクステンションを使わない設定（`/extensions mode` の Disabled）にしている：`/extensions mode` で Load & Augment か Load Only に戻します。Disabled は、次のセッションにも残ります。

## 会話例

plugin-creator と、AI が演じたユーザーとのやり取りの例は、[examples/](examples/) にあります。何を伝えればよいかの参考にしてください。
