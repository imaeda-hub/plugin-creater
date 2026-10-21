# VERIFY2：Copilot CLI 1.0.98 での実測（文書ファイルの読み方、default のない選択肢、自由入力欄の改行）

- 調べた日：2026-10-21（UTC）。対象：`GitHub Copilot CLI 1.0.98.`（`copilot --version`）、Linux x64。
- 調べ方：A-copilot-cli.md の「再開のチェックリスト」、GAP-report.md と同じ。ログインせず、オフラインのモード（`COPILOT_OFFLINE=true`、`COPILOT_PROVIDER_BASE_URL`）で偽物のモデル（`research/cli/logserver.js` ＋ `research/cli/handlers/steps.js`）につないだ。対話モード（TUI）は pty と pyte で動かし、画面を文字で保存した。モデルに送られたリクエスト本文は全部ファイルに残した。ポートは 18401〜18492。
- 限界（全項目に共通）：
  - BYOK（自前のモデルの窓口）経路だけを見た。ふだんの利用（GitHub の Copilot API、CAPI 経路）で同じかは確かめていない。
  - 偽物のモデルなので、本物のモデルや提供元が、届いたファイルを実際に読めるかは確かめられない。そこは提供元の公式ドキュメントで補った（出典を書いた）。

## 道具と置き場所

`V=/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/verify2`

| もの | 場所 |
| --- | --- |
| `-p` で動かすスクリプト（`research/cli/run.sh` の写し。ログとホームを verify2 の下に置く） | `$V/run.sh` |
| TUI を動かすスクリプト（`research/gap/tuirun.sh` の写し。`research/gap/tui.py` を使う） | `$V/tuirun.sh` |
| 提供元が文書つきのリクエストを 400 で断る偽物のサーバー（`logserver.js` の写しに、`input_file`／`document` を含む最初のリクエストへ 400 を返す数行を足した）と、それを使うスクリプト | `$V/logserver400.js`、`$V/run400.sh`、`$V/tuirun400.sh` |
| 試験用のファイルを作るスクリプト | `$V/scripts/mkdocs.py`、`mkmin.py`、`mkpptx.py` |
| リクエストを読みやすく出すスクリプト | `$V/scripts/showuser.py`（user メッセージの中身の種類）、`$V/scripts/toolres.py`（ツールの呼び出しと結果） |
| 試験用のファイル | `$V/proj/`（下の表）、`$V/proj2/`（拡張子だけ変えたもの） |
| 手順（TUI の操作）とプロンプト | `$V/steps/` |
| 実験ごとのリクエスト本文 | `$V/logs/<実験名>/NNN-*.json` |
| 実験ごとの画面 | `$V/logs/<実験名>/tui/snap-*.txt` |
| セッションのイベント | `$V/homes/<実験名>/session-state/<ID>/events.jsonl` |
| 抜き出したもの | `$V/captures/`（`v1-view-results.txt`、`attachment-matrix.txt`、`view-tool-gpt41.json`） |
| `copilot --help` の出力、公式ドキュメントの HTML | `$V/help/main.txt`、`$V/web/cli-command-reference.html` |

試験用のファイル（中の文字に目印を入れた）：

| ファイル | 大きさ | 中の目印 | 作り方 |
| --- | --- | --- | --- |
| `mini.docx` | 939 B | `MINDOCX-TEXT-MARKER` | zip で手作りした最小の docx |
| `report.docx` | 36,800 B | `DOCX-TITLE-MARKER` など | python-docx |
| `budget.xlsx` | 4,902 B | `XLSX-HEADER-MARKER` など | openpyxl |
| `spec.pdf` | 1,858 B（2ページ） | `PDF-TEXT-MARKER`、`PDF-PAGE2-MARKER` | reportlab（本文の流れは圧縮される） |
| `mini.pptx` | 11,368 B | `MINPPTX-TITLE-MARKER` など | python-pptx で使わないレイアウトを消したもの |
| `deck.pptx` | 32,921 B | `PPTX-TITLE-MARKER` など | python-pptx |
| `red.png` | 75 B | — | 8×8 の赤い画像（比べるため） |
| `blob.bin` | 1,024 B | — | 0〜255 のバイトの繰り返し（比べるため） |
| `notes.txt` | 27 B | `TXT-MARKER` | 文字のファイル（比べるため） |

---

## 1. Office の文書・PDF を、モデルがどう読めるか

### 結果

1. **`view` ツールは文書を文字に変えない。** ファイルのバイトをそのまま UTF-8 として読んだ文字列（読めないバイトは「�」）がツールの結果として返る。docx・xlsx・pptx は zip の中身（圧縮されたバイト列）、PDF は PDF の生の構文（本文は圧縮された流れ）になる。**どの目印もモデルに届いたリクエストに入らなかった**（`MINDOCX-TEXT-MARKER`、`XLSX-HEADER-MARKER`、`PDF-TEXT-MARKER`、`MINPPTX-TITLE-MARKER` が0件）。
   - 20KB を超えるファイルは文字に変えずに断る：`File too large to read at once (35.9 KB). Consider using the grep tool to search within the file, or view with view_range to read specific sections.`（report.docx、deck.pptx）。
   - 比べるために読んだ `blob.bin` も同じく生のバイト。`red.png` だけは `Viewed image file successfully.` が返った（画像は別の扱い）。
   - OpenAI 形式（gpt-4.1）と Anthropic 形式（claude-sonnet-4.6）で同じ結果。
   - view の説明文（原文）：「View files, images, or directories. * Images return base64 data and MIME type. * Text files return their content. … * Files over 20KB are truncated; use `view_range` for sections.」。文書の扱いは書かれていない。
2. **ただし、文書を「ファイルのまま」モデルに渡す仕組み（native document）がある。** `@ファイル`、ファイルのパスの貼り付け（TUI）、`--attachment`（`-p` のみ）で文書を示すと、条件が合えば文書のバイトを base64 でそのままモデルの API に送る。**文字に変えるのは Copilot CLI ではなく、受け取る提供元の API**。
   - 対象の拡張子（`--attachment` で1つずつ試した）：**pdf、doc、docx、xls、xlsx、ppt、pptx、rtf、odt**。受け付けない：txt、md、csv、html、json、ods、odp、zip、拡張子なし（中身が PDF でも）、bin。断るときの文：`--attachment file type not supported (must be an image or native document): <パス>`。拡張子で決まっている。
   - **実際にファイルのまま送られるかは、BYOK では通信の形式で決まった**（モデル名では決まらない）：

     | 通信の形式（BYOK） | 試したモデル名 | PDF | docx・xlsx・pptx（doc・xls・ppt・rtf・odt も） |
     | --- | --- | --- | --- |
     | OpenAI Responses（`COPILOT_PROVIDER_WIRE_API=responses`） | gpt-5.5、gpt-5-mini、gpt-4.1 | `input_file`（`data:application/pdf;base64,…`） | `input_file`（`data:application/vnd.openxmlformats-…;base64,…` など） |
     | Anthropic messages（`COPILOT_PROVIDER_TYPE=anthropic`） | claude-sonnet-4.6 | `document`（`media_type: application/pdf`、base64） | ファイルのまま送らない。パスと行数だけ |
     | OpenAI chat completions（既定） | gpt-4.1、gpt-5.5、claude-sonnet-4.6、gemini-3.8-flash | パスと行数だけ | パスと行数だけ |

   - ファイルのまま送るときは、user メッセージの末尾に次の文が加わり、ファイルごとに説明の文が付く（原文）：
     - `<system_reminder>\nThe user included native document attachments in this message. Review any attached document directly before responding, and do not call tools just to read an attached document.\n</system_reminder>`
     - `Document file "mini.docx" at path "/…/proj/mini.docx"`（`@` で示したときは `Document file "@mini.docx" at path …`）
   - ファイルのまま送らないときは、テキストのファイルの `@` と同じく `<tagged_files>\n* /…/spec.pdf (88 lines)\n</tagged_files>` だけが入る（「行数」はバイナリの改行の数で意味はない）。モデルは自分で読みに行く必要があり、`view` では上の 1 のとおり読めない。
3. **受け取った提供元がどう読むか（公式ドキュメント。Copilot CLI ではなく提供元の仕様）**
   - OpenAI Responses API：`input_file` で PDF、Word／ODT／RTF（`.doc`、`.docx`、`.odt`、`.rtf` など）、PowerPoint（`.ppt`、`.pptx` など）、Excel（`.xls`、`.xlsx` など）を受け付ける。PDF は「extracts both text and page images and sends both to the model」、PDF 以外は「the API extracts text only」、表計算は「the first 1,000 rows per sheet」を解析し要約などを足す。PDF 以外の文書の中の画像やグラフは取り込まれない。一方、Chat Completions の `file_data` は「PDF only」。（https://developers.openai.com/api/docs/guides/file-inputs 、2026-10-21 アクセス）
   - Anthropic：PDF は「The system converts each page of the document into an image. The text from each page is extracted and provided alongside each page's image.」。「Binary formats such as .xlsx or .docx are not supported in document blocks and must be converted to text or PDF first.」（https://platform.claude.com/docs/en/build-with-claude/pdf-support 、2026-10-21 アクセス）。Copilot CLI が Anthropic 形式で PDF だけを送るのはこれと合っている。
4. **提供元が文書を断ったとき（400）は、自動でやり直さない。** その手番はエラーで終わり、画面に「Replaced document attachment(s) in conversation history with file references because the provider rejected the request; a document attachment may be unsupported or unreadable.」と `✗ 400 …` が出る。履歴の中の文書は `<tagged_files>`（パスと行数）に置き換わり、ユーザーが次に何か打つと、その形で送られる。`-p` では終了コード 1。置き換えた後も `<system_reminder>The user included native document attachments …` の文は履歴に残ったまま（実測 v7-reject-tui の 002）。changelog 1.0.63「Recover from unreadable native document attachments by falling back to file-path uploads」。
5. **組み込みの変換の仕組み（ツール、スキル）はない。**
   - TUI のツールの一覧（gpt-4.1）：bash、read_bash、stop_bash、list_bash、view、create、edit、fetch_copilot_cli_documentation、skill、ask_user、sql、session_store_sql、read_agent、list_agents、write_agent、grep、glob、task。gpt-5.5 は create・edit の代わりに apply_patch、grep の代わりに rg。文書を文字に変えるツールはない。
   - 組み込みのスキル（`builtin-skills/`）は customize-cloud-agent、discover-resources、github-pr-media の3つだけ。同梱のプラグインは github-copilot-browser（browser-use など）だけ。PDF に触れるのは discover-resources の説明「Find a public MCP server or public skill the user could add for an unavailable external capability, such as database access, accessible PDF reports, …」だけ（外部の MCP やスキルを探すための手引き）。
   - パッケージ（cli-main.js、runtime.strings）に pdftotext、markitdown、mammoth（JS の docx 変換）、libreoffice、pandoc などの変換の部品は見つからなかった（`mammoth` は形容詞の単語リストの中の1件だけ）。
   - システムプロンプト（gpt-4.1、gpt-5.5）に PDF・docx などの扱いの指示はない。
6. **モデルが自分で文字にできるのは `bash` で変換したときだけ**（native document が使えない経路では）。偽物のモデルに bash を呼ばせると、ツールの結果として文字が返った（このマシンに unzip と pdftotext があったため。ユーザーの PC にあるとは限らない）：
   - `unzip -p mini.docx word/document.xml | sed -e 's/<[^>]*>//g'` → `MINDOCX-TEXT-MARKER minimal docx paragraph`
   - `pdftotext spec.pdf -` → `PDF-TEXT-MARKER hello from the pdf page one … PDF-PAGE2-MARKER second page`
   - `unzip -p budget.xlsx xl/worksheets/sheet1.xml` → セルの XML（`<t>XLSX-HEADER-MARKER</t>` など。表計算は XML のままで、表の形に直すのはモデルの仕事）
   - `unzip -p mini.pptx ppt/slides/slide1.xml | grep -o '<a:t>[^<]*'` → `<a:t>MINPPTX-TITLE-MARKER` など
7. 公式ドキュメント（Copilot CLI）：コマンドリファレンスの `--attachment` は「Attach a file to the initial prompt (can be used multiple times). Image files are accepted, but sending them successfully requires the selected model and organization policy to allow vision input.」で、**文書（native document）については書かれていない**。`copilot --help` には「Attach a file (image or native document) to the initial prompt; only valid in non-interactive mode」とある。ショートカットの表は「`@ FILENAME` Include file contents in the context.」「Ctrl + V Paste from clipboard as an attachment.」（https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference 、2026-10-21 アクセス）。関係する changelog：1.0.41「Add --attachment flag in non-interactive (-p/--prompt) mode to attach files (images or native documents)」、1.0.49「Document attachment paths are included in context so the agent can reference pasted file paths」、1.0.60「BYOK file attachments larger than 5 MiB now send successfully via OpenAI Responses provider」、1.0.63（上記）、1.0.64「Attached images and PDFs persist across session resume even if the source file is later changed or deleted」。

### 確かめ方

```bash
V=/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/verify2
H=$V/../cli/handlers/steps.js
# (a) view で9つのファイルを読ませる（-p）。gpt-4.1（chat）と claude-sonnet-4.6（anthropic）
./run.sh v1-view $H gpt-4.1 18401 -- -p "$(cat $V/steps/view-prompt.txt)" --allow-all
PTYPE=anthropic ./run.sh v1-view-claude $H claude-sonnet-4.6 18402 -- -p "$(cat $V/steps/view-prompt.txt)" --allow-all
# → logs/v1-view/002-*.json の role=tool（抜き出し：captures/v1-view-results.txt）
# (b) --attachment を形式・通信の形式ごとに（-p）
./run.sh v2-att-gpt-spec-pdf $H gpt-4.1 18403 -- -p 'see attached #STEPS:[{"text":"ATT-DONE"}]#END' --attachment $V/proj/spec.pdf --allow-all
WIRE=responses ./run.sh v2-att-gpt55-mini-docx $H gpt-5.5 <port> -- -p '…' --attachment $V/proj/mini.docx --allow-all
PTYPE=anthropic ./run.sh v2-att-claude-spec-pdf $H claude-sonnet-4.6 <port> -- -p '…' --attachment $V/proj/spec.pdf --allow-all
WORKDIR=$V/proj2 WIRE=responses ./run.sh v2-type-t.rtf $H gpt-5.5 <port> -- -p '…' --attachment $V/proj2/t.rtf --allow-all
# → 一覧：captures/attachment-matrix.txt（v2-att-*、v2-type-* の全部）
# (c) TUI の @ と、パスの貼り付け
WIRE=responses ./tuirun.sh v3-at-gpt55 $H gpt-5.5 18441 $V/steps/atdoc.json --        # @mini.docx @spec.pdf @budget.xlsx @mini.pptx
./tuirun.sh v3-at-gpt41 $H gpt-4.1 18442 $V/steps/atdoc.json --
PTYPE=anthropic ./tuirun.sh v3-at-claude $H claude-sonnet-4.6 18445 $V/steps/atdoc.json --
WIRE=responses ./tuirun.sh v3-paste-gpt55 $H gpt-5.5 18443 $V/steps/pastedoc.json --  # 括弧つき貼り付けで絶対パス
./tuirun.sh v3-paste-gpt41 $H gpt-4.1 18444 $V/steps/pastedoc.json --
# (d) bash で変換
./run.sh v4-bash $H gpt-4.1 18451 -- -p "$(cat $V/steps/bash-prompt.txt)" --allow-all
./run.sh v4-bash2 $H gpt-4.1 18452 -- -p "$(cat $V/steps/bash2-prompt.txt)" --allow-all
# (e) 提供元が 400 で断る
WIRE=responses ./run400.sh v7-reject-gpt55 $H gpt-5.5 18491 -- -p '…' --attachment $V/proj/mini.docx --allow-all
WIRE=responses ./tuirun400.sh v7-reject-tui $H gpt-5.5 18492 $V/steps/reject.json --
```

画面の抜粋（TUI でパスを貼り付けたところ。gpt-5.5、v3-paste-gpt55 `snap-typed.txt`）：

```text
❯ [📄 spec.pdf] [📄 mini.docx] [📄 budget.xlsx] summarize #STEPS:[{"text":"PASTE-DONE"}]#END
```

送信後のタイムラインと、モデルに届いた文では `[file: spec.pdf] [file: mini.docx] [file: budget.xlsx] summarize …` になる（chat completions の gpt-4.1 でも画面は同じで、届く中身は `<tagged_files>` のパスだけ）。

モデルに届いた user メッセージ（gpt-5.5、Responses、`@mini.docx` のとき。v3-at-gpt55 の 001。base64 は省略）：

```text
input_text  '…@mini.docx and @spec.pdf and @budget.xlsx and @mini.pptx summarize …\n\n<system_reminder>\nThe user included native document attachments in this message. Review any attached document directly before responding, and do not call tools just to read an attached document.\n</system_reminder>'
input_text  'Document file "@mini.docx" at path "/…/verify2/proj/mini.docx"'
input_file  {"type": "input_file", "file_data": "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBBQ…"}
（spec.pdf、budget.xlsx、mini.pptx も同じ形で続く）
```

同じ操作の Anthropic 形式（v3-at-claude の 001）：`document`（application/pdf）は spec.pdf の1つだけ。ほかの3つは本文の末尾の `<tagged_files>\n* /…/mini.docx (1 lines)\n* /…/budget.xlsx (22 lines)\n* /…/mini.pptx (44 lines)\n</tagged_files>`。

view のツールの結果（gpt-4.1、v1-view の 002。先頭だけ）：

```text
mini.docx   'PK\x03\x04\x14\x00\x00\x00\x08\x00�pU]yn3��…[Content_Types].xml}P�N�0…'（906 文字）
report.docx 'File too large to read at once (35.9 KB). Consider using the grep tool to search within the file, or view with view_range to read specific sections.'
budget.xlsx 'PK\x03\x04…docProps/app.xmlM�M…'（4,693 文字）
spec.pdf    '%PDF-1.3\n%���� ReportLab Generated PDF document (opensource)\n1 0 obj\n<<\n/F1 2 0 R…'（1,858 文字）
mini.pptx   'PK\x03\x04…'（10,915 文字）
red.png     'Viewed image file successfully.'
notes.txt   'TXT-MARKER plain text file\n'
```

### 分からなかったこと

- **CAPI 経路（ログインしたふだんの利用）で、どのモデルに文書をファイルのまま送るか。** BYOK では通信の形式で決まったが、CAPI ではモデルの能力の情報で決まる可能性がある（ランタイムに `document_helpers_is_native_document_file`、`nativeDocumentPathFallbackPaths` などの文字列はあるが、条件は読み取れなかった）。ログインが要る。
- 本物の提供元が、届いた docx・xlsx・pptx をどの程度読めるか（OpenAI の公式の説明は上記。実際の読み取りの質は未確認）。
- 文書の大きさの上限（native document で送れる最大の大きさ、ページ数）。changelog に 5 MiB を超える BYOK の添付の修正があるが、試していない。
- `view` で画像（red.png）を読んだとき、BYOK の gpt-4.1・claude-sonnet-4.6 ではツールの結果が `Viewed image file successfully.` だけで、画像のデータは次のリクエストのどこにも入っていなかった（説明文は「Images return base64 data」）。今回の主題ではないので原因は追っていない。
- `.ods`・`.odp` が対象外で `.odt` だけが対象の理由（拡張子の一覧の作り）。
- Windows・macOS での貼り付け（ドラッグ＆ドロップ、Ctrl+V のクリップボードのファイル）の振る舞い。

---

## 2. ask_user のフォーム（TUI の elicitation 版）で、default のない enum のカーソルの位置

### 結果

1. **カーソル（`❯`）は最初の選択肢に合う。** default を付けたときと見た目は同じ。
2. **Enter だけを押すと、最初の選択肢が選ばれて確定する。** モデルに返る文は `User responded: Daily`（選択肢は Daily、Weekly、Monthly の順）。`required` に入れても入れなくても同じ。
3. **1項目だけのフォームでは、何も選ばずに確定する方法はない。** 下の案内は「↑/↓ select · enter accept · ctrl+d decline · esc cancel」で「tab next」がなく、Tab を押しても何も起きず、続く Enter で最初の選択肢が選ばれた。答えずに閉じるのは Esc（cancel）か Ctrl+D（decline）だけ（それぞれの返る文は前の調べのとおり）。
4. **選んだ印（`✓`）の違い**：default を付けたときは、カーソルを動かすと default の選択肢に `✓` が残る（前の調べ i2：`✓ Write reports` / `❯ Review code`）。default がないときは、↓ で動かしても `✓` はどこにも出ない（下の画面）。つまり「まだ選んでいない」状態はあるが、Enter はカーソルの位置の選択肢を選ぶ。
5. **2項目以上のフォームでは、Tab で項目を飛ばすと、選ばないまま確定できる。**
   - 1つ目の項目で Enter：その選択肢を選んで2つ目の項目に移る（確定しない）。最後の項目で Enter：フォーム全体を確定する。両方 Enter だけ → `User responded: first=A1, second=b1`（2つ目は oneOf で、表示名「B one」ではなく値 `b1`）。
   - 1つ目で Tab（選ばずに次へ）→ 2つ目で Enter：**その場でフォームが確定し、飛ばした項目は答えに入らない**。**`required: ["first","second"]` を付けても止められなかった。**
   - **このとき、モデルに返る文には項目名が付かない**：`User responded: b1`。セッションの記録（events.jsonl）では `"content":{"second":"b1"}` と項目名つきで残っているが、モデルにはどの項目の答えか分からない形で届く。1項目のフォームの `User responded: Daily` も同じく項目名なし。2つ答えたときだけ `first=A1, second=b1` の形になった（観測した範囲：答えの数が1つなら値だけ、2つなら「名前=値」）。

### 確かめ方

```bash
V=/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/verify2
H=$V/../cli/handlers/steps.js
python3 -I $V/scripts/mkask.py $V   # steps/ask-*.txt（プロンプト）と steps/tui-*.json（操作）を作る
./tuirun.sh v5-nodef-enter    $H gpt-4.1 18461 $V/steps/tui-enter.json    -- -i "$(cat $V/steps/ask-nodef.txt)"     # すぐ Enter
./tuirun.sh v5-nodef-move     $H gpt-4.1 18462 $V/steps/tui-move.json     -- -i "$(cat $V/steps/ask-nodef.txt)"     # ↓ ↑ Enter
./tuirun.sh v5-nodefreq-enter $H gpt-4.1 18463 $V/steps/tui-enter.json    -- -i "$(cat $V/steps/ask-nodefreq.txt)"  # required つき
./tuirun.sh v5-nodef-tab      $H gpt-4.1 18481 $V/steps/tui-one-tab.json  -- -i "$(cat $V/steps/ask-nodef.txt)"     # Tab → Enter
./tuirun.sh v5-two-enter      $H gpt-4.1 18464 $V/steps/tui-two-enter.json -- -i "$(cat $V/steps/ask-two.txt)"      # 2項目、Enter Enter
./tuirun.sh v5-two-tab        $H gpt-4.1 18465 $V/steps/tui-two-tab.json  -- -i "$(cat $V/steps/ask-two.txt)"      # 2項目、Tab Enter
./tuirun.sh v5-tworeq-tab     $H gpt-4.1 18466 $V/steps/tui-two-tab3.json -- -i "$(cat $V/steps/ask-tworeq.txt)"   # 2項目とも required、Tab Enter
python3 -I $V/scripts/toolres.py $V/logs/v5-nodef-enter/002-_v1_chat_completions.json
```

モデルに呼ばせた ask_user の引数（v5-nodef）：

```json
{"message":"NODEF-Q pick a cadence","requestedSchema":{"type":"object","properties":{"choice":{"type":"string","title":"Report cadence","description":"No default given","enum":["Daily","Weekly","Monthly"]}}}}
```

画面（v5-nodef-move の `snap-a.txt` → `snap-a-down.txt`）：

```text
 Copilot needs information.
 NODEF-Q pick a cadence
 Report cadence:
 No default given
 ❯ Daily
   Weekly
   Monthly
   Other (type your answer)
 ↑/↓ select · enter accept · ctrl+d decline · esc cancel
```

```text
 Report cadence:
 No default given
   Daily
 ❯ Weekly
   Monthly
   Other (type your answer)
```

Enter の後（v5-nodef-enter の `snap-b.txt`）とモデルに返った文（002 の role=tool）：

```text
 ● Asked user NODEF-Q pick a cadence
   └ Daily
 ● NODEF-DONE
```

```text
User responded: Daily
```

2項目で1つ目を Tab で飛ばしたとき（v5-tworeq-tab）：

```text
 Copilot needs information.
 TWOREQ-Q both required, no default
  First field  [Second field]
 Second field:
 ❯ B one
   B two
   Other (type your answer)
 ↑/↓ select · enter accept · shift+tab prev · ctrl+d decline · esc cancel
```

Enter の後：タイムラインは `● Asked user TWOREQ-Q both required, no default` / `└ b1`。モデルに返った文は `User responded: b1`。events.jsonl は `"responseKind":"ask_user","content":{"second":"b1"}`。

### 分からなかったこと

- 「答えが1つなら項目名を付けない」規則が、自由入力や boolean・数値の項目でも同じか（enum と oneOf でしか見ていない）。
- 飛ばした項目が required でも確定できるのが意図した仕様か（ドキュメントに記述なし）。
- 本物の端末で、色などで「選んだ／まだ選んでいない」を区別して見せているか（pyte は色を落とす）。

---

## 3. 自由入力だけの項目（enum のない string）の入力欄での改行と長い文

### 結果

1. **改行を入れられる。** 次の4通りのキーの送り方は、どれも入力欄の中の改行になった（確定しなかった）。モデルに返る文は `User responded: LINE-01 first line\nLINE-02 second line`。
   - Ctrl+J（`\n`）
   - ESC＋CR（`\x1b\r`。Linux・Windows の Alt+Enter、ほかに端末の設定で Shift+Enter に割り当てる送り方。Copilot CLI には、VS Code などの端末に「Shift+Enter でこの文字列を送る」キー設定を足す処理がある：cli-main.js の `zH="\x1B\r",kX="shift+enter"` と「Added key binding for shift+enter for …」）
   - CSI u 形式の Shift+Enter（`\x1b[13;2u`）
   - xterm の modifyOtherKeys 形式の Shift+Enter（`\x1b[27;2;13~`）
2. **Enter（CR）だけを押すと確定になる。** 改行にはならない。
3. **入力欄の下の案内には改行のキーが出ない**：「enter accept · ctrl+d decline · esc cancel」。本体の入力欄のヘルプには「shift+enter … insert newline」がある（cli-main.js）。公式ドキュメントのショートカットの表も本体の入力欄について「Shift + Enter or Option + Enter (Mac) / Alt + Enter (Windows/Linux) Insert a newline in the input.」。
4. **改行を含む長い文の貼り付け（括弧つき貼り付け）は、欠けずに届いた。**
   - 10行・1,079 文字、10行・10,039 文字の2つを貼り付けて Enter → モデルに返った文の本文は貼り付けた文と1文字も違わなかった（Python で比べて一致）。
   - 本体の入力欄のように「[Paste #1 …]」へ縮めたり、ファイルに回したりはしなかった（GAP の問い4 の本体の入力欄の振る舞いとは違う）。
   - 入力中の欄に見えるのは最後の4行分（折り返しを含む）だけ。確定後のタイムラインには全文が出た（1,079 文字のとき `│ story: PLINE-01 …` から `└ PLINE-10 …` まで10行）。

### 確かめ方

```bash
V=/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/verify2
H=$V/../cli/handlers/steps.js
# プロンプト steps/ask-free.txt：{"story":{"type":"string","title":"Your story","description":"Free text, several lines welcome"}} の1項目
# 操作：「LINE-01 first line」→ 改行のキー（raw で一度に送る）→「LINE-02 second line」→ Enter
./tuirun.sh v6-free-ctrlj    $H gpt-4.1 18471 $V/steps/tui-free-ctrlj.json    -- -i "$(cat $V/steps/ask-free.txt)"
./tuirun.sh v6-free-escr     $H gpt-4.1 18472 $V/steps/tui-free-escr.json     -- -i "$(cat $V/steps/ask-free.txt)"
./tuirun.sh v6-free-csiu     $H gpt-4.1 18473 $V/steps/tui-free-csiu.json     -- -i "$(cat $V/steps/ask-free.txt)"
./tuirun.sh v6-free-xtermmod $H gpt-4.1 18474 $V/steps/tui-free-xtermmod.json -- -i "$(cat $V/steps/ask-free.txt)"
# 括弧つき貼り付け（ESC[200~ … ESC[201~）で10行 → Enter。貼り付けた文は steps/paste10.txt、steps/paste10big.txt
./tuirun.sh v6-free-paste10    $H gpt-4.1 18475 $V/steps/tui-free-paste10.json    -- -i "$(cat $V/steps/ask-free.txt)"
./tuirun.sh v6-free-paste10big $H gpt-4.1 18476 $V/steps/tui-free-paste10big.json -- -i "$(cat $V/steps/ask-free.txt)"
```

画面（v6-free-ctrlj の `snap-typed.txt`。改行の後に2行目を打ったところ）：

```text
 Copilot needs information.
 FREE-Q tell me in detail
 Your story
 Free text, several lines welcome
 ──────────────────────────────────────────────────────────────────────────
 ❯ LINE-01 first line
   LINE-02 second line
 ──────────────────────────────────────────────────────────────────────────
 enter accept · ctrl+d decline · esc cancel
```

貼り付けた直後（v6-free-paste10 の `snap-pasted.txt`。見えるのは最後の4行）：

```text
 ❯ PLINE-07 word07 word07 word07 …
   PLINE-08 word08 word08 word08 …
   PLINE-09 word09 word09 word09 …
   PLINE-10 word10 word10 word10 …
 ──────────────────────────────────────────────────────────────────────────
 enter accept · ctrl+d decline · esc cancel
```

モデルに返った文（v6-free-paste10 の 002）：`User responded: PLINE-01 word01 … \nPLINE-02 … \nPLINE-10 word10 …`（1,079 文字。貼り付けた文と一致）。

### 分からなかったこと

- 実際の端末（Windows Terminal、macOS の Terminal・iTerm2、VS Code の端末など）で Shift+Enter がどの文字列を送るか。設定なしの端末で Shift+Enter が CR だけを送る場合は、改行ではなく確定になるはず（CR が確定であることは確かめた）が、実機では試していない。
- 入力欄の中でカーソルを上の行に戻して直せるか（↑ キーの動き）。
- 文字数の上限（10,039 文字までは欠けなかった。それより長い文は試していない）。
- 日本語（全角）の入力・貼り付けでの表示と折り返し。

---

## 出典の一覧

- 実測：`$V/logs/<実験名>/`（v1-view、v1-view-claude、v2-att-*、v2-type-*、v3-at-*、v3-paste-*、v4-bash、v4-bash2、v5-*、v6-free-*、v7-reject-*）。Copilot CLI 1.0.98、Linux x64、2026-10-21。
- パッケージ：`research/cli/pkg/package/`（`cli-main.js`、`changelog.json`、`builtin-skills/`、`plugins/`）、ランタイムの文字列 `research/cli/runtime.strings`。`copilot --help` の出力 `$V/help/main.txt`。
- 公式ドキュメント（2026-10-21 アクセス）：
  - GitHub Copilot CLI コマンドリファレンス：https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference （保存：`$V/web/cli-command-reference.html`）
  - OpenAI File inputs：https://developers.openai.com/api/docs/guides/file-inputs
  - Anthropic PDF support：https://platform.claude.com/docs/en/build-with-claude/pdf-support
- 公式の changelog：`research/cli/web/changelog.md`（1.0.41、1.0.49、1.0.60、1.0.63、1.0.64 の項）。
- 二次情報：使っていない。
