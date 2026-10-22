#!/usr/bin/env python3
"""試験の入口。1つのコマンドで、1段目（構造の検査）と2段目（部品の試験）を動かす。

使い方:
    python3 tests/run.py [--json] [--results ファイル]

  1. 道具がそろっているかを確かめる。足りなければ、足りない道具と入れ方を示して止まる。
  2. 1段目：tests/stage1/check_structure.py（PyYAML と jsonschema）
  3. 2段目：tests/stage2 の *.test.mjs を `node --test` で、tests/stage2/task の test_*.py を unittest で
  4. 段階ごとの合否と、不合格の試験とその理由を出す。同じ内容を tests/results/latest.json にも書く。

終了コード: 0 合格、1 不合格あり、2 道具が足りなくて止まった。
試験のない段階は「試験なし」と示す（合格とも不合格とも数えない）。モデルは使わない。

クリエイター自身の試験でも使い回せるよう、次の指定ができる:
    --root フォルダ        試験するプラグインのフォルダ（既定は、このファイルのあるフォルダの1つ上）
    --stage1-script ファイル  1段目のスクリプト（`<root> --json` で動き、JSON を出すもの）
    --stage2-dir フォルダ     2段目の試験のフォルダ
    --need 名前             tools の表にある道具を、必ず要るものとして足す（例：tiktoken）
"""
from __future__ import annotations

import argparse
import datetime
import glob
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import traceback
import unittest
from typing import Any, Dict, List, Optional, Tuple

HERE = os.path.dirname(os.path.abspath(__file__))
TIMEOUT_SECONDS = 900   # 1つの段階の上限。超えたら不合格にする

# ---------------------------------------------------------------- 道具の確かめ

NODE_NEED = "20.19 以上か 22.12 以上"
BROWSER_COMMANDS = ["google-chrome", "google-chrome-stable", "chrome", "microsoft-edge", "microsoft-edge-stable", "msedge"]
BROWSER_PATHS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    r"%PROGRAMFILES%\Google\Chrome\Application\chrome.exe",
    r"%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe",
    r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe",
    r"%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe",
    r"%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe",
]
HOWTO = {
    "python": "Python 3.9 以上を入れる（https://www.python.org/downloads/）",
    "pyyaml": "Python の仮想環境の中で `python3 -m pip install PyYAML` を実行する",
    "jsonschema": "Python の仮想環境の中で `python3 -m pip install -U jsonschema` を実行する",
    "tiktoken": "Python の仮想環境の中で `python3 -m pip install tiktoken` を実行する",
    "node": "Node.js %s を入れる（https://nodejs.org/）" % NODE_NEED,
    "playwright": "試験のフォルダで `npm install playwright` を実行する（全体に入れたものは使えない）",
    "browser": "Chrome か Edge を入れる。どちらもないときは、`npx playwright install chromium` で Playwright の Chromium を入れる",
}


def python_version() -> Tuple[bool, str]:
    return sys.version_info >= (3, 9), "%d.%d.%d" % sys.version_info[:3]


def module_found(module: str) -> Tuple[bool, str]:
    return importlib.util.find_spec(module) is not None, ""


def jsonschema_found() -> Tuple[bool, str]:
    """公式スキーマは JSON Schema 2020-12 なので、jsonschema 4.0 以上が要る。"""
    if importlib.util.find_spec("jsonschema") is None:
        return False, ""
    try:
        from importlib.metadata import version
        found = version("jsonschema")
    except Exception:   # 版を調べられなくても、あるものとして進める
        return True, ""
    return found.split(".")[0].isdigit() and int(found.split(".")[0]) >= 4, found


def node_version() -> Tuple[bool, str]:
    node = shutil.which("node")
    if not node:
        return False, "見つからない"
    try:
        out = subprocess.run([node, "--version"], capture_output=True, timeout=30).stdout.decode("utf-8", "replace").strip()
    except (OSError, subprocess.SubprocessError):
        return False, "動かない"
    m = re.match(r"v(\d+)\.(\d+)", out)
    if not m:
        return False, out or "版が分からない"
    return node_supported(int(m.group(1)), int(m.group(2))), out.lstrip("v")


def node_supported(major: int, minor: int) -> bool:
    """Copilot SDK が動く Node.js：20.19 以上、22.12 以上、23 以上。"""
    return (major == 20 and minor >= 19) or (major == 22 and minor >= 12) or major >= 23


def node_import_works(directory: str, script: str) -> bool:
    node = shutil.which("node")
    if not node:
        return False
    try:
        return subprocess.run([node, "--input-type=module", "-e", script], cwd=directory, capture_output=True,
                              timeout=60).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def playwright_found(directory: str) -> Tuple[bool, str]:
    return node_import_works(directory, "await import('playwright')"), ""


def browser_found(directory: str) -> Tuple[bool, str]:
    """手元の Chrome か Edge、なければ Playwright の Chromium。"""
    for command in BROWSER_COMMANDS:
        if shutil.which(command):
            return True, command
    for path in BROWSER_PATHS:
        if os.path.exists(os.path.expandvars(path)):
            return True, os.path.expandvars(path)
    script = "import fs from 'node:fs'; const {chromium} = await import('playwright'); process.exit(fs.existsSync(chromium.executablePath()) ? 0 : 1)"
    return (True, "Playwright の Chromium") if node_import_works(directory, script) else (False, "")


def gather_needs(stage2_dir: str, extra: List[str]) -> Tuple[List[str], str]:
    """要る道具の名前の並びと、Playwright を確かめるフォルダ。"""
    needs = ["python", "pyyaml", "jsonschema"]
    node_files = find_node_tests(stage2_dir)
    probe_dir = stage2_dir
    if node_files:
        needs.append("node")
        for path in node_files:
            with open(path, encoding="utf-8", errors="ignore") as f:
                if re.search(r"""(from\s+|import\s*\(\s*)['"]playwright['"]""", f.read()):
                    needs += ["playwright", "browser"]
                    probe_dir = os.path.dirname(path)
                    break
    for name in extra:
        if name not in needs:
            needs.append(name)
    return needs, probe_dir


def check_tools(needs: List[str], probe_dir: str) -> List[Dict[str, Any]]:
    checks = {
        "python": ("Python（3.9 以上）", python_version),
        "pyyaml": ("PyYAML", lambda: module_found("yaml")),
        "jsonschema": ("jsonschema（4.0 以上）", jsonschema_found),
        "tiktoken": ("tiktoken", lambda: module_found("tiktoken")),
        "node": ("Node.js（%s）" % NODE_NEED, node_version),
        "playwright": ("Playwright", lambda: playwright_found(probe_dir)),
        "browser": ("ブラウザー（Chrome か Edge。なければ Playwright の Chromium）", lambda: browser_found(probe_dir)),
    }
    items = []
    for name in needs:
        if name not in checks:
            items.append({"id": name, "name": name, "ok": False, "found": "この入口は、この道具を確かめられない",
                          "howToInstall": "tools の表にない道具です"})
            continue
        title, probe = checks[name]
        ok, found = probe()
        items.append({"id": name, "name": title, "ok": ok, "found": found, "howToInstall": HOWTO.get(name, "")})
    return items


# ---------------------------------------------------------------- 1段目

def run_stage1(root: str, script: str) -> Dict[str, Any]:
    stage: Dict[str, Any] = {"id": "stage1", "name": "構造の検査", "status": "failed", "failures": [], "warnings": [], "checks": []}
    if not os.path.isfile(script):
        stage["failures"].append({"test": "構造の検査のスクリプト", "reason": "%s がない" % script})
        return stage
    try:
        proc = subprocess.run([sys.executable, "-I", script, root, "--json"], capture_output=True, timeout=TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        stage["failures"].append({"test": "構造の検査", "reason": "%d 秒たっても終わらない" % TIMEOUT_SECONDS})
        return stage
    out = proc.stdout.decode("utf-8", "replace")
    try:
        report = json.loads(out)
    except ValueError:
        reason = proc.stderr.decode("utf-8", "replace").strip() or out.strip() or "終了コード %d" % proc.returncode
        stage["failures"].append({"test": "構造の検査", "reason": "結果を読めなかった: " + reason[:500]})
        return stage
    stage["status"] = "passed" if report.get("ok") else "failed"
    stage["failures"] = report.get("failures", [])
    stage["warnings"] = report.get("warnings", [])
    stage["checks"] = [{"id": c["id"], "title": c["title"], "status": c["status"]} for c in report.get("checks", [])]
    stage["counts"] = count_statuses([c["status"] for c in report.get("checks", [])])
    return stage


def count_statuses(statuses: List[str]) -> Dict[str, int]:
    return {"total": len(statuses), "passed": statuses.count("passed"), "failed": statuses.count("failed"),
            "skipped": statuses.count("skipped")}


# ---------------------------------------------------------------- 2段目

def find_node_tests(stage2_dir: str) -> List[str]:
    files = glob.glob(os.path.join(stage2_dir, "**", "*.test.mjs"), recursive=True)
    return sorted(f for f in files if os.sep + "node_modules" + os.sep not in f)


def find_python_tests(stage2_dir: str) -> Tuple[str, List[str]]:
    task_dir = os.path.join(stage2_dir, "task")
    return task_dir, sorted(glob.glob(os.path.join(task_dir, "test_*.py")))


TAP_SUBTEST = re.compile(r"^(\s*)# Subtest: (.*)$")
TAP_RESULT = re.compile(r"^(\s*)(not ok|ok) \d+ - (.*)$")
TAP_KEY = re.compile(r"^(\s*)([A-Za-z_]+): ?(.*)$")


def parse_tap(text: str) -> List[Dict[str, str]]:
    """`node --test --test-reporter=tap` の出力を、試験ごとの {name, status, reason} にする。"""
    lines = text.splitlines()
    tests: List[Dict[str, str]] = []
    stack: List[str] = []
    comments: List[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        sub = TAP_SUBTEST.match(line)
        if sub:
            depth = len(sub.group(1)) // 4
            stack = stack[:depth] + [sub.group(2)]
            i += 1
            continue
        res = TAP_RESULT.match(line)
        if not res:
            if line.startswith("#"):
                comments.append(line.lstrip("# ").strip())
            i += 1
            continue
        indent, ok, name = len(res.group(1)), res.group(2) == "ok", res.group(3)
        directive = re.search(r" # (SKIP|TODO)\b", name)
        if directive:
            name = name[: directive.start()]
        info: Dict[str, str] = {}
        j = i + 1
        if j < len(lines) and lines[j].strip() == "---":
            j += 1
            while j < len(lines) and lines[j].strip() != "...":
                key = TAP_KEY.match(lines[j])
                if key and len(key.group(1)) == indent + 2:
                    value = key.group(3)
                    if value in ("|-", "|", ">-"):
                        block, k = [], j + 1
                        while k < len(lines) and (not lines[k].strip() or len(lines[k]) - len(lines[k].lstrip()) > indent + 2):
                            block.append(lines[k].strip())
                            k += 1
                        value, j = "\n".join(block).strip(), k - 1
                    else:
                        value = value.strip()
                        if len(value) >= 2 and value[0] == value[-1] == "'":
                            value = value[1:-1].replace("''", "'")
                    info[key.group(2)] = value
                j += 1
            i = j
        path = " > ".join(stack[: indent // 4] + [name])
        status = "skipped" if directive else ("passed" if ok else "failed")
        reason = ""
        if status == "failed":
            if info.get("failureType") == "subtestsFailed":
                comments, i = [], i + 1
                continue   # 入れ子の中の失敗が別に出るので、まとめの行は数えない
            reason = " / ".join(x for x in info.get("error", "").splitlines() if x.strip())[:300]
            if reason == "test failed" and "exitCode" in info:   # ファイルを読み込めなかったとき
                detail = next((c for c in comments if "Error" in c), "")
                reason = "試験のファイルが動かなかった（終了コード %s）%s" % (info["exitCode"], ": " + detail[:250] if detail else "")
        if info.get("type") != "suite" or status == "failed":
            tests.append({"name": path, "status": status, "reason": reason})
        comments = []
        i += 1
    return tests


def run_node_tests(root: str, files: List[str]) -> List[Dict[str, str]]:
    node = shutil.which("node") or "node"
    try:
        proc = subprocess.run([node, "--test", "--test-reporter=tap"] + files, cwd=root, capture_output=True,
                              timeout=TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        return [{"name": "node --test", "status": "failed", "reason": "%d 秒たっても終わらない" % TIMEOUT_SECONDS}]
    tests = parse_tap(proc.stdout.decode("utf-8", "replace"))
    for t in tests:   # 試験のファイルの名前は、プラグインの根からの相対にして見やすくする
        if os.path.isabs(t["name"]):
            t["name"] = os.path.relpath(t["name"], root).replace(os.sep, "/")
    if proc.returncode != 0 and not any(t["status"] == "failed" for t in tests):
        detail = proc.stderr.decode("utf-8", "replace").strip()[-400:]
        tests.append({"name": "node --test", "status": "failed", "reason": "終了コード %d%s" % (proc.returncode, "（%s）" % detail if detail else "")})
    return tests


class CollectingResult(unittest.TestResult):
    """unittest の結果を、試験ごとの {name, status, reason} にためる。"""

    def __init__(self) -> None:
        super().__init__()
        self.items: List[Dict[str, str]] = []

    def _add(self, name: str, status: str, reason: str = "") -> None:
        self.items.append({"name": name, "status": status, "reason": reason})

    @staticmethod
    def _reason(err: Any) -> str:
        text = traceback.format_exception_only(err[0], err[1])[-1].strip()
        lines = [x for x in text.splitlines() if x.strip()]
        if "Traceback (most recent call last)" in text:   # 試験のファイルを読み込めなかったとき：最後の行が本当の理由
            return lines[-1][:300]
        return " / ".join(lines[:2])[:300]

    def addSuccess(self, test: Any) -> None:
        self._add(test.id(), "passed")

    def addFailure(self, test: Any, err: Any) -> None:
        self._add(test.id(), "failed", self._reason(err))

    def addError(self, test: Any, err: Any) -> None:
        self._add(test.id(), "failed", self._reason(err))

    def addSkip(self, test: Any, reason: str) -> None:
        self._add(test.id(), "skipped", reason)

    def addExpectedFailure(self, test: Any, err: Any) -> None:
        self._add(test.id(), "passed")

    def addUnexpectedSuccess(self, test: Any) -> None:
        self._add(test.id(), "failed", "失敗するはずの試験が通った")

    def addSubTest(self, test: Any, subtest: Any, err: Any) -> None:
        if err is not None:
            self._add(subtest.id(), "failed", self._reason(err))


def unittest_worker(start_dir: str, out_path: str) -> int:
    """別のプロセスで unittest を動かし、結果を JSON のファイルに書く（試験が固まっても入口が止まらないように）。"""
    result = CollectingResult()
    unittest.defaultTestLoader.discover(start_dir, pattern="test_*.py").run(result)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result.items, f, ensure_ascii=False)
    return 0


def run_python_tests(root: str, start_dir: str) -> List[Dict[str, str]]:
    fd, out_path = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    try:
        proc = subprocess.run([sys.executable, os.path.abspath(__file__), "--unittest-worker", start_dir, out_path],
                              cwd=root, capture_output=True, timeout=TIMEOUT_SECONDS)
        with open(out_path, encoding="utf-8") as f:
            return json.load(f)
    except subprocess.TimeoutExpired:
        return [{"name": "unittest", "status": "failed", "reason": "%d 秒たっても終わらない" % TIMEOUT_SECONDS}]
    except (OSError, ValueError):
        detail = proc.stderr.decode("utf-8", "replace").strip()[-400:]
        return [{"name": "unittest", "status": "failed", "reason": "結果を読めなかった（終了コード %d）%s" % (proc.returncode, "：" + detail if detail else "")}]
    finally:
        try:
            os.remove(out_path)
        except OSError:
            pass


def run_stage2(root: str, stage2_dir: str) -> Dict[str, Any]:
    stage: Dict[str, Any] = {"id": "stage2", "name": "部品の試験", "status": "none", "failures": [], "warnings": [], "tests": []}
    node_files = find_node_tests(stage2_dir)
    py_dir, py_files = find_python_tests(stage2_dir)
    tests: List[Dict[str, str]] = []
    if node_files:
        tests += [dict(t, runner="node") for t in run_node_tests(root, node_files)]
    if py_files:
        tests += [dict(t, runner="unittest") for t in run_python_tests(root, py_dir)]
    if not (node_files or py_files):
        stage["note"] = "試験なし（%s に *.test.mjs も task/test_*.py もない）" % os.path.relpath(stage2_dir, root)
        return stage
    stage["tests"] = tests
    stage["counts"] = count_statuses([t["status"] for t in tests])
    stage["failures"] = [{"test": t["name"], "reason": t["reason"]} for t in tests if t["status"] == "failed"]
    stage["status"] = "failed" if stage["failures"] else "passed"
    return stage


# ---------------------------------------------------------------- 結果

STATUS_TEXT = {"passed": "合格", "failed": "不合格", "none": "試験なし", "stopped": "止まった"}


def summarize(stage: Dict[str, Any]) -> str:
    counts = stage.get("counts")
    if not counts:
        return ""
    text = "%d 件のうち %d 件合格" % (counts["total"], counts["passed"])
    if counts["failed"]:
        text += "、%d 件不合格" % counts["failed"]
    if counts["skipped"]:
        text += "、%d 件は対象外" % counts["skipped"]
    return "（%s）" % text


def format_text(result: Dict[str, Any]) -> str:
    lines = ["試験の入口: %s" % result["root"], "", "道具の確かめ"]
    for item in result["tools"]["items"]:
        mark = "ある" if item["ok"] else "足りない"
        lines.append("  [%s] %s%s" % (mark, item["name"], " %s" % item["found"] if item["found"] else ""))
        if not item["ok"]:
            lines.append("      入れ方: %s" % item["howToInstall"])
    if result["status"] == "stopped":
        lines += ["", "足りない道具があるので止まりました。入れてから、もう一度動かしてください。"]
    for stage in result["stages"]:
        lines += ["", "%s %s: %s%s" % ("1段目" if stage["id"] == "stage1" else "2段目", stage["name"],
                                      STATUS_TEXT[stage["status"]], summarize(stage))]
        if stage.get("note"):
            lines.append("  " + stage["note"])
        for failure in stage["failures"]:
            lines += ["  不合格: %s" % failure["test"], "      理由: %s" % failure["reason"]]
        for warning in stage["warnings"]:
            lines.append("  注意: %s（%s）" % (warning["message"], warning["test"]))
    lines += ["", "結果: %s" % STATUS_TEXT[result["status"]], "結果のファイル: %s" % result["resultsFile"]]
    return "\n".join(lines)


def write_results(result: Dict[str, Any], path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)   # 読む側が書きかけを見ないように、一時ファイルに書いてから名前を変える


def run(root: str, stage1_script: str, stage2_dir: str, results_path: str, extra_needs: List[str]) -> Dict[str, Any]:
    started = datetime.datetime.now().astimezone()
    needs, probe_dir = gather_needs(stage2_dir, extra_needs)
    items = check_tools(needs, probe_dir)
    result: Dict[str, Any] = {
        "root": root, "startedAt": started.isoformat(timespec="seconds"),
        "tools": {"ok": all(i["ok"] for i in items), "items": items, "missing": [i for i in items if not i["ok"]]},
        "stages": [], "resultsFile": results_path,
    }
    if not result["tools"]["ok"]:
        result.update({"status": "stopped", "ok": False, "exitCode": 2})
    else:
        result["stages"] = [run_stage1(root, stage1_script), run_stage2(root, stage2_dir)]
        failed = any(s["status"] == "failed" for s in result["stages"])
        result.update({"status": "failed" if failed else "passed", "ok": not failed, "exitCode": 1 if failed else 0})
    result["finishedAt"] = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    result["durationSeconds"] = round((datetime.datetime.now().astimezone() - started).total_seconds(), 1)
    write_results(result, results_path)
    return result


def main(argv: Optional[List[str]] = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="試験の入口（1段目と2段目を1つのコマンドで動かす）")
    parser.add_argument("--root", default=os.path.dirname(HERE))
    parser.add_argument("--results", help="結果を書くファイル（既定は <root>/tests/results/latest.json）")
    parser.add_argument("--stage1-script", default=os.path.join(HERE, "stage1", "check_structure.py"))
    parser.add_argument("--stage2-dir", default=os.path.join(HERE, "stage2"))
    parser.add_argument("--need", action="append", default=[])
    parser.add_argument("--json", action="store_true", help="結果を JSON で標準出力に出す")
    parser.add_argument("--unittest-worker", nargs=2, metavar=("DIR", "OUT"), help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    if args.unittest_worker:
        return unittest_worker(*args.unittest_worker)
    root = os.path.abspath(args.root)
    results = os.path.abspath(args.results or os.path.join(root, "tests", "results", "latest.json"))
    result = run(root, os.path.abspath(args.stage1_script), os.path.abspath(args.stage2_dir), results, args.need)
    print(json.dumps(result, ensure_ascii=False, indent=2) if args.json else format_text(result))
    return result["exitCode"]


if __name__ == "__main__":
    sys.exit(main())
