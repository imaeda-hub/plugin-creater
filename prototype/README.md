# 試験の仕組みの試作

[試験の設計](../docs/design/testing.md) が、クラウド環境の Claude Code で動くかを確かめた試作。参考のために残している。実装資産ではない。

## 中身

| フォルダ | 内容 |
| --- | --- |
| `proto-creator/` | 試作のクリエイター（Copilot CLI 形式）。質問してナレッジを引き出し、`assets/template/` から生成プラグインを作る |
| `control-creator/` | 対照のクリエイター。`proto-creator/` と同じで、質問だけを大まかなもの3つに絞ってある。試験が落ちるべきときに落ちるかを確かめるのに使う |
| `tools/` | 変換スクリプト（`convert.py`）、1段目（`check_structure.py`）、2段目（`test_components.py`、`ui_test.mjs`）、模擬ユーザー（`personas/`）、Agent Plugins の公式スキーマの写し |
| `runner/` | Agent SDK で動かす EVAL の仕組み。外側（`outer.mjs`）、内側（`inner.mjs`）、ユーザー役の試験（`test_user_role.mjs`）、サンドボックスの確認（`sandbox_smoke.mjs`） |

模擬ユーザーは2人いる。

- `weekly-report.json`：売上の CSV から週報を作る。内側の EVAL の課題もある。
- `meeting-minutes.json`：会議の文字起こしから議事録を作る。外側の EVAL（`--no-inner`）とユーザー役の試験だけに使う。

## 準備

1. OS のサンドボックスに要る bubblewrap と socat を入れる：`apt-get install -y bubblewrap socat`
2. Node のパッケージを入れる。ブラウザーはクラウド環境に入っているものを使う：`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install`
3. Python の環境を作る：`python3 -m venv venv && venv/bin/pip install -r requirements.txt`

## 動かし方

- 1段目：`venv/bin/python tools/check_structure.py <生成プラグイン>`
- 2段目：`venv/bin/python tools/test_components.py <生成プラグイン>` と `node tools/ui_test.mjs <生成プラグイン> <画面の写しを置くフォルダ>`
- ユーザー役の試験：`node runner/test_user_role.mjs tools/personas/weekly-report.json sonnet:3`（`モデル:版` を並べると比べられる。`--style terse` で話し方を変える）
- 内側の EVAL：`node runner/inner.mjs <生成プラグイン> tools/personas/weekly-report.json`
- 外側の EVAL：`node runner/outer.mjs proto-creator tools/personas/weekly-report.json`
  - `--with-only`：クリエイターなしの実行を省く
  - `--no-inner`：内側の EVAL を省く
  - `--style 名前`：ユーザー役の話し方（模擬ユーザーの `styles`）
  - `--user-model`・`--user-version`：ユーザー役のモデルと指示の版（既定は `runner/lib.mjs`）
  - 結果には、ナレッジごとに、クリエイターが聞いたか・ユーザー役が答えたか・組み込まれたかが出る（`missed=` の `not-asked`・`not-written` はクリエイター、`not-answered` はユーザー役の取りこぼしの疑い。`unprompted=` は聞かれずに話した隠すべきナレッジ）

生成プラグインは、`proto-creator/skills/make-plugin/scripts/scaffold.py` で手で作るか、外側の EVAL で作る。EVAL はモデルを使うので、費用がかかる（外側を、あり・なしと内側を含めて1回で約 0.4 ドル。ユーザー役の試験は1回で約 0.15 ドル）。作業フォルダと結果は `runs/` にできる。

`control-creator/` の `assets` と `scripts` は、`proto-creator/` へのシンボリックリンクである。
