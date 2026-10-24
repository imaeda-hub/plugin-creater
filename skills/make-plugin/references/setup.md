# `plugin-creator_open` がないときの直し方

`plugin-creator_open` がないのは、plugin-creator の画面と記録を動かすプラグインの中の部品（エクステンション。Copilot CLI が起動する別のプログラム）が読み込まれていないためである。原因は次の3つのどれかなので、3つとも直し方を示して止まる。ヒアリングは始めない。

1. 試験的機能が有効になっていない：`/experimental on` で有効にして、Copilot CLI を起動し直す。
2. 読み込むときの確認を断った：Copilot CLI を起動し直して、チャットに出る確認（題は `Extension "…" wants elevated permissions`）を許可する。
   - 確認の意味：plugin-creator の画面を開くツールと、お話で決まったことを手元の記録に書くツールが、確認なしで動く。示された Word・Excel・PowerPoint の文書の文字を読むツールも、確認なしで動く。お話の間は、問いと答えを手元のファイルに記録し、会話の自動の要約の後に1回だけ、AI に手順を読み直すよう知らせる。
   - 許可する理由：断ると読み込まれず、お話を始められない。
   - 選び方：「Yes」は今回だけ許可し、Copilot CLI を起動するたびと `/clear` のたびに、また確認が出る。「Yes, and always allow "…" in this directory」は、このフォルダでは次から確認が出ない。
3. エクステンションを使わない設定（`/extensions mode` の Disabled）になっている：`/extensions mode` で Load & Augment か Load Only に戻す。Disabled は、次のセッションにも残る。

直したら、もう一度チャットで頼むよう伝える。
