# 試験の仕組みの試作

[試験の設計](../docs/design/testing.md) が、クラウド環境の Claude Code で動くかを確かめた試作。参考のために残している。実装資産ではない。

## 中身

| フォルダ | 内容 |
| --- | --- |
| `proto-creator/` | 試作のクリエイター（Copilot CLI 形式）。質問してナレッジを引き出し、`assets/template/` から生成プラグインを作る |
| `tools/` | 変換スクリプト（`convert.py`）、1段目（`check_structure.py`）、2段目（`test_components.py`、`ui_test.mjs`）、模擬ユーザー（`personas/`）、Agent Plugins の公式スキーマの写し |
| `runner/` | Agent SDK で動かす EVAL の仕組み。外側（`outer.mjs`）、内側（`inner.mjs`）、サンドボックスの確認（`sandbox_smoke.mjs`） |

## 準備

1. OS のサンドボックスに要る bubblewrap と socat を入れる：`apt-get install -y bubblewrap socat`
2. Node のパッケージを入れる。ブラウザーはクラウド環境に入っているものを使う：`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install`
3. Python の環境を作る：`python3 -m venv venv && venv/bin/pip install -r requirements.txt`

## 動かし方

- 1段目：`venv/bin/python tools/check_structure.py <生成プラグイン>`
- 2段目：`venv/bin/python tools/test_components.py <生成プラグイン>` と `node tools/ui_test.mjs <生成プラグイン> <画面の写しを置くフォルダ>`
- 内側の EVAL：`node runner/inner.mjs <生成プラグイン> tools/personas/weekly-report.json`
- 外側の EVAL：`node runner/outer.mjs proto-creator tools/personas/weekly-report.json`

生成プラグインは、`proto-creator/skills/make-plugin/scripts/scaffold.py` で手で作るか、外側の EVAL で作る。EVAL はモデルを使うので、費用がかかる（外側を1回で約 0.4 ドル）。作業フォルダと結果は `runs/` にできる。
