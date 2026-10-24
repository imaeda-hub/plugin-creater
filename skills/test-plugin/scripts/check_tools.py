#!/usr/bin/env python3
"""試験の道具が手元にそろっているかを確かめ、足りなければ入れる（testing.md 11.2、REQ-048）。

使い方:
    python3 check_tools.py --plugin <生成プラグインのフォルダ> [--scope stage12|eval|all] [--install]

  --scope   確かめる道具の範囲。stage12＝1・2段目（構造の検査と部品の試験）、eval＝EVAL、all＝両方（既定）。
            生成した直後は stage12、ユーザーが試験を頼んだときは all を使う。
  --install 入れてよいとユーザーが答えた後に付ける。入れられるものだけを入れる（下）。付けなければ、何も入れず、確かめるだけ。

入れる場所（ユーザーの環境全体は変えない）
  Python のパッケージ   生成プラグインの tests/.venv（Python の仮想環境。PyYAML、jsonschema）
  1・2段目の Playwright  生成プラグインの tests/node_modules
  EVAL の道具           <COPILOT_HOME>/plugin-data/plugin-creator/tools/（@github/copilot-sdk と playwright）
  ブラウザー            手元の Chrome か Edge を使う。どちらもないときだけ、Playwright の Chromium を Playwright の既定の場所
                       （ホームフォルダの中の共通の場所。1つ約 280 MB）に入れる
Python と Node.js（npm を含む）そのものがないときは、入れ方を示すだけにする（自分では入れない）。
Linux でサンドボックスを使うときの道具は、有無を示すだけ（入れない。なくても試験はできる）。

標準出力は JSON 1つ。主な項目:
  ok         この範囲の必須の道具がすべてある
  tools      道具ごとの { id, name, scope, required, ok, found, where, howToInstall, command, installable }
  missing    ない必須の道具（ユーザーに示す。name、where＝入れる場所、howToInstall、commandText＝入れるコマンド、installable＝--install で入れられるか）
  manual     missing のうち、ユーザーが自分で入れるもの（--install では入らない）の id
  installed  --install のとき、実行した手順ごとの { ids, what, where, commandText, ok, output }
終了コード: 0 必須の道具がそろっている、1 足りない（--install の後も足りないとき、入れるのに失敗したときを含む）、2 使い方の誤り。
標準ライブラリだけで動く（Python 3.7 以上で動かせるように書いてある。道具としては 3.9 以上を求める）。
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import subprocess
import sys
from typing import Any, Dict, List, Optional, Tuple

HERE = os.path.dirname(os.path.abspath(__file__))
SCOPES = ("stage12", "eval", "all")
NODE_NEED = "20.19 以上か 22.12 以上"
PIP_PACKAGES = {"pyyaml": "PyYAML", "jsonschema": "jsonschema>=4.0"}
OUTPUT_TAIL = 1500
TIMEOUTS = {"venv": 180, "pip": 900, "npm": 1200, "browser": 1800, "probe": 60}

# 手元の Chrome と Edge（Playwright の channel の名前）。見つけ方は試験の入口 run.py と同じ
BROWSERS = [
    ("chrome", "Google Chrome", ["google-chrome", "google-chrome-stable", "chrome"], [
        "/opt/google/chrome/chrome",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        r"%PROGRAMFILES%\Google\Chrome\Application\chrome.exe",
        r"%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe",
        r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe",
    ]),
    ("msedge", "Microsoft Edge", ["microsoft-edge", "microsoft-edge-stable", "msedge"], [
        "/opt/microsoft/msedge/msedge",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        r"%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe",
        r"%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe",
    ]),
]

# Linux でサンドボックスを使うときの道具（testing.md 11.2）。有無を示すだけ
SANDBOX_TOOLS = [
    ("bwrap", "bubblewrap（0.5.0 以上）", "bwrap", ("bubblewrap", (0, 5, 0))),
    ("slirp4netns", "slirp4netns", "slirp4netns", None),
    ("unshare", "unshare（util-linux 2.35 以上）", "unshare", ("util-linux", (2, 35))),
    ("nsenter", "nsenter（util-linux 2.35 以上）", "nsenter", ("util-linux", (2, 35))),
    ("iptables", "iptables", "iptables", None),
    ("ip6tables", "ip6tables", "ip6tables", None),
    ("iptables-restore", "iptables-restore", "iptables-restore", None),
    ("ip6tables-restore", "ip6tables-restore", "ip6tables-restore", None),
]


# ---------------------------------------------------------------- 実行環境（試験では差し替える）

class Context:
    """OS への問い合わせをまとめた入れ物。試験では、これを継いで偽物にする。"""

    def __init__(self, plugin: str, scope: str = "all", env: Optional[Dict[str, str]] = None, pins: Optional[Dict[str, str]] = None) -> None:
        self.plugin = os.path.abspath(plugin)
        self.scope = scope
        self.env = dict(os.environ if env is None else env)
        self.pins = pins if pins is not None else load_pins()
        self.system = platform.system()          # Linux、Darwin、Windows
        self.python = sys.executable
        self.python_version = tuple(sys.version_info[:3])

    @property
    def windows(self) -> bool:
        return self.system == "Windows"

    def which(self, name: str) -> Optional[str]:
        return shutil.which(name, path=self.env.get("PATH"))

    def exists(self, path: str) -> bool:
        return os.path.exists(path)

    def read_json(self, path: str) -> Optional[Dict[str, Any]]:
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else None
        except (OSError, ValueError):
            return None

    def listdir(self, path: str) -> List[str]:
        try:
            return sorted(os.listdir(path))
        except OSError:
            return []

    def run(self, cmd: List[str], cwd: Optional[str] = None, timeout: int = 60) -> Tuple[int, str]:
        """コマンドを動かす。@returns (終了コード, 標準出力と標準エラー出力をつないだ文字)。動かせなければ (-1, 理由)"""
        try:
            proc = subprocess.run(cmd, cwd=cwd, env=self.env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout)
        except subprocess.TimeoutExpired:
            return -1, "%d 秒たっても終わらなかった" % timeout
        except OSError as e:
            return -1, str(e)
        return proc.returncode, proc.stdout.decode("utf-8", "replace")

    def write_file(self, path: str, text: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)

    # 場所
    @property
    def copilot_home(self) -> str:
        return self.env.get("COPILOT_HOME") or os.path.join(os.path.expanduser("~"), ".copilot")

    @property
    def tools_dir(self) -> str:
        return os.path.join(self.copilot_home, "plugin-data", "plugin-creator", "tools")

    @property
    def tests_dir(self) -> str:
        return os.path.join(self.plugin, "tests")

    @property
    def venv_dir(self) -> str:
        return os.path.join(self.tests_dir, ".venv")

    @property
    def venv_python(self) -> str:
        return os.path.join(self.venv_dir, "Scripts", "python.exe") if self.windows else os.path.join(self.venv_dir, "bin", "python")


def load_pins() -> Dict[str, str]:
    """EVAL の道具の版。同じフォルダの package.json（1か所だけに書く）から読む。"""
    path = os.path.join(HERE, "package.json")
    with open(path, encoding="utf-8") as f:
        deps = json.load(f).get("dependencies", {})
    return {"sdk": deps["@github/copilot-sdk"], "playwright": deps["playwright"]}


def quote(part: str) -> str:
    if part and re.fullmatch(r"[A-Za-z0-9_@%+=:,./\\-]+", part):
        return part
    if os.name == "nt":
        return '"%s"' % part.replace('"', '\\"')
    return "'%s'" % part.replace("'", "'\"'\"'")


def command_text(cmd: Optional[List[str]]) -> str:
    return " ".join(quote(p) for p in cmd) if cmd else ""


# ---------------------------------------------------------------- 1つ1つの確かめ

def tool(ctx: Context, id: str, name: str, scope: str, ok: bool, found: str = "", where: str = "", how: str = "",
         command: Optional[List[str]] = None, installable: bool = False, required: bool = True, **extra: Any) -> Dict[str, Any]:
    item = {
        "id": id, "name": name, "scope": scope, "required": required, "ok": ok, "found": found, "where": where,
        "howToInstall": how, "command": command, "commandText": command_text(command), "installable": installable and not ok,
    }
    item.update(extra)
    return item


def parse_version(text: str, pattern: str = r"(\d+)\.(\d+)(?:\.(\d+))?") -> Optional[Tuple[int, int, int]]:
    m = re.search(pattern, text)
    return (int(m.group(1)), int(m.group(2)), int(m.group(3) or 0)) if m else None


def node_supported(v: Tuple[int, int, int]) -> bool:
    """Copilot SDK が動く Node.js：20.19 以上、22.12 以上、23 以上。"""
    major, minor = v[0], v[1]
    return (major == 20 and minor >= 19) or (major == 22 and minor >= 12) or major >= 23


def check_python(ctx: Context) -> Dict[str, Any]:
    ok = ctx.python_version >= (3, 9)
    return tool(ctx, "python", "Python（3.9 以上）", "stage12", ok, "%d.%d.%d" % ctx.python_version, how="Python 3.9 以上を入れる（https://www.python.org/downloads/）。このコマンドは自分では入れません")


def venv_module_works(ctx: Context) -> bool:
    return ctx.run([ctx.python, "-c", "import venv, ensurepip"], timeout=TIMEOUTS["probe"])[0] == 0


def check_venv(ctx: Context, python_ok: bool) -> Dict[str, Any]:
    cmd = [ctx.python, "-m", "venv", ctx.venv_dir]
    what = "Python の仮想環境（生成プラグインの tests/.venv）"
    code, out = ctx.run([ctx.venv_python, "-c", "import sys; print('%d.%d.%d' % sys.version_info[:3])"], timeout=TIMEOUTS["probe"]) if ctx.exists(ctx.venv_python) else (-1, "")
    if code == 0:
        return tool(ctx, "venv", what, "stage12", True, out.strip(), where=ctx.venv_dir)
    how = "生成プラグインのフォルダで `%s` を実行して、仮想環境を作る（ユーザーの環境全体は変えません）" % command_text(cmd)
    installable = python_ok
    if python_ok and not venv_module_works(ctx):
        installable = False
        how = "この Python では仮想環境（venv）が使えません。Debian や Ubuntu では `sudo apt install python3-venv` で入れてから、もう一度確かめてください"
    return tool(ctx, "venv", what, "stage12", False, where=ctx.venv_dir, how=how, command=cmd, installable=installable)


def pip_cmd(ctx: Context, packages: List[str]) -> List[str]:
    return [ctx.venv_python, "-m", "pip", "install"] + packages


def check_pip_package(ctx: Context, id: str, label: str, venv_ok: bool, venv_will_exist: bool) -> Dict[str, Any]:
    package = PIP_PACKAGES[id]
    name = "%s（Python の仮想環境の中）" % label
    cmd = pip_cmd(ctx, [package])
    how = "仮想環境（tests/.venv）の中で `%s` を実行する" % command_text(cmd)
    if venv_ok:
        probe = "import yaml; print(yaml.__version__)" if id == "pyyaml" else "import importlib.metadata as m; print(m.version('jsonschema'))"
        code, out = ctx.run([ctx.venv_python, "-c", probe], timeout=TIMEOUTS["probe"])
        if code == 0:
            version = out.strip()
            if id == "jsonschema":
                v = parse_version(version)
                if v is None or v[0] < 4:
                    return tool(ctx, id, name + "は 4.0 以上", "stage12", False, version, where=ctx.venv_dir, how=how, command=cmd, installable=True, pip=package)
            return tool(ctx, id, name, "stage12", True, version, where=ctx.venv_dir, pip=package)
    return tool(ctx, id, name, "stage12", False, "", where=ctx.venv_dir, how=how, command=cmd, installable=venv_will_exist, pip=package)


def check_node(ctx: Context) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    node = ctx.which("node")
    found, ok = "見つからない", False
    if node:
        code, out = ctx.run([node, "--version"], timeout=TIMEOUTS["probe"])
        v = parse_version(out) if code == 0 else None
        found = out.strip().lstrip("v") if v else "動かない"
        ok = bool(v and node_supported(v))
    node_tool = tool(ctx, "node", "Node.js（%s）" % NODE_NEED, "both", ok, found, how="Node.js %s を入れる（https://nodejs.org/）。このコマンドは自分では入れません" % NODE_NEED)
    npm = ctx.which("npm")
    npm_ok, npm_found = False, "見つからない"
    if npm:
        code, out = ctx.run([npm, "--version"], timeout=TIMEOUTS["probe"])
        npm_ok, npm_found = (code == 0, out.strip() if code == 0 else "動かない")
    npm_tool = tool(ctx, "npm", "npm（Node.js に付いてくる）", "both", npm_ok, npm_found, how="Node.js を入れ直すと付いてくる（https://nodejs.org/）。このコマンドは自分では入れません")
    node_tool["path"], npm_tool["path"] = node, npm
    return node_tool, npm_tool


def package_version(ctx: Context, base: str, *name: str) -> Optional[str]:
    data = ctx.read_json(os.path.join(base, "node_modules", *name, "package.json"))
    return str(data.get("version")) if data and data.get("version") else None


def npm_install_tests_cmd(ctx: Context, npm: str) -> List[str]:
    return [npm, "install", "--prefix", ctx.tests_dir, "--no-save", "--no-package-lock", "--ignore-scripts", "--no-audit", "--no-fund", "playwright@%s" % ctx.pins["playwright"]]


def npm_install_tools_cmd(ctx: Context, npm: str) -> List[str]:
    return [npm, "install", "--ignore-scripts", "--no-audit", "--no-fund"]


def check_playwright_tests(ctx: Context, npm_ok: bool, npm: Optional[str]) -> Dict[str, Any]:
    want = ctx.pins["playwright"]
    have = package_version(ctx, ctx.tests_dir, "playwright")
    cmd = npm_install_tests_cmd(ctx, npm or "npm")
    name = "Playwright（生成プラグインの tests/node_modules）"
    how = "`%s` を実行する（生成プラグインの tests/node_modules にだけ入る）" % command_text(cmd)
    if have == want:
        return tool(ctx, "playwright", name, "stage12", True, have, where=os.path.join(ctx.tests_dir, "node_modules"))
    found = "" if have is None else "%s（%s が要る）" % (have, want)
    return tool(ctx, "playwright", name, "stage12", False, found, where=os.path.join(ctx.tests_dir, "node_modules"), how=how, command=cmd, installable=npm_ok)


def check_eval_tools(ctx: Context, npm_ok: bool, npm: Optional[str]) -> List[Dict[str, Any]]:
    cmd = npm_install_tools_cmd(ctx, npm or "npm")
    how = "道具のフォルダ（%s）に package.json を写し、そこで `%s` を実行する" % (ctx.tools_dir, command_text(cmd))
    sdk_have = package_version(ctx, ctx.tools_dir, "@github", "copilot-sdk")
    runtime = [n for n in ctx.listdir(os.path.join(ctx.tools_dir, "node_modules", "@github")) if n.startswith("copilot-sdk-")]
    sdk_ok = sdk_have == ctx.pins["sdk"] and bool(runtime)
    if sdk_have is None:
        sdk_found = ""
    elif sdk_have != ctx.pins["sdk"]:
        sdk_found = "%s（%s が要る）" % (sdk_have, ctx.pins["sdk"])
    elif not runtime:
        sdk_found = "%s（この OS 用の実行ファイルのパッケージ @github/copilot-sdk-<OS> が入っていません）" % sdk_have
    else:
        sdk_found = sdk_have
    pw_have = package_version(ctx, ctx.tools_dir, "playwright")
    pw_ok = pw_have == ctx.pins["playwright"]
    pw_found = "" if pw_have is None else (pw_have if pw_ok else "%s（%s が要る）" % (pw_have, ctx.pins["playwright"]))
    return [
        tool(ctx, "eval-sdk", "Copilot SDK（EVAL の道具のフォルダ）", "eval", sdk_ok, sdk_found, where=ctx.tools_dir, how=how, command=cmd, installable=npm_ok, step="eval-tools"),
        tool(ctx, "eval-playwright", "Playwright（EVAL の道具のフォルダ）", "eval", pw_ok, pw_found, where=ctx.tools_dir, how=how, command=cmd, installable=npm_ok, step="eval-tools"),
    ]


def system_browser(ctx: Context) -> Optional[Tuple[str, str, str]]:
    """手元の Chrome か Edge。@returns (channel, 名前, 場所) か None"""
    for channel, label, commands, paths in BROWSERS:
        for command in commands:
            found = ctx.which(command)
            if found:
                return channel, label, found
        for path in paths:
            expanded = os.path.expandvars(path)
            if ctx.exists(expanded):
                return channel, label, expanded
    return None


def playwright_dirs(ctx: Context) -> List[str]:
    """Playwright が入っているフォルダ（node_modules の親）。1・2段目の分、EVAL の分の順"""
    out = []
    if ctx.scope in ("stage12", "all") and package_version(ctx, ctx.tests_dir, "playwright") == ctx.pins["playwright"]:
        out.append(ctx.tests_dir)
    if ctx.scope in ("eval", "all") and package_version(ctx, ctx.tools_dir, "playwright") == ctx.pins["playwright"]:
        out.append(ctx.tools_dir)
    return out


def playwright_cli(base: str) -> str:
    return os.path.join(base, "node_modules", "playwright", "cli.js")


def chromium_installed(ctx: Context, node: Optional[str]) -> bool:
    """Playwright の Chromium が、Playwright の既定の場所にあるか"""
    if not node:
        return False
    script = "const fs=require('fs');const {chromium}=require('playwright');process.stdout.write(fs.existsSync(chromium.executablePath())?'yes':'no')"
    for base in playwright_dirs(ctx):
        code, out = ctx.run([node, "-e", script], cwd=base, timeout=TIMEOUTS["probe"])
        if code == 0 and out.strip().endswith("yes"):
            return True
    return False


def check_browser(ctx: Context, node: Optional[str], node_ok: bool, will_have_playwright: Optional[str]) -> Dict[str, Any]:
    """will_have_playwright：Playwright が入っている、またはこれから入る（--install で）フォルダ（node_modules の親）。なければ None"""
    name = "ブラウザー（Chrome か Edge。どちらもなければ Playwright の Chromium）"
    chosen = system_browser(ctx)
    if chosen:
        channel, label, path = chosen
        return tool(ctx, "browser", name, "both", True, "%s（%s）" % (label, path), where=path, channel=channel)
    if chromium_installed(ctx, node):
        return tool(ctx, "browser", name, "both", True, "Playwright の Chromium", where="Playwright の既定の場所（ホームフォルダの中の共通の場所）", channel="chromium")
    cmd = [node or "node", playwright_cli(will_have_playwright), "install", "chromium"] if will_have_playwright else None
    how = ("Chrome か Edge を入れる。入れないときは、`%s` で Playwright の Chromium（約 280 MB）を、Playwright の既定の場所（ホームフォルダの中の共通の場所）に入れる" % command_text(cmd)
           if cmd else "Chrome か Edge を入れる。入れないときは、Playwright を入れた後に、Playwright の Chromium（約 280 MB）を入れる（`node <playwright の cli.js> install chromium`）")
    return tool(ctx, "browser", name, "both", False, "", where="Playwright の既定の場所（ホームフォルダの中の共通の場所）", how=how, command=cmd, installable=bool(node_ok and cmd), channel=None)


def check_sandbox(ctx: Context) -> List[Dict[str, Any]]:
    if ctx.system != "Linux":
        return []
    out = []
    for id, name, command, version_rule in SANDBOX_TOOLS:
        found = ctx.which(command) or next((p for p in ("/usr/sbin/" + command, "/sbin/" + command) if ctx.exists(p)), None)
        ok, text = bool(found), found or ""
        if found and version_rule:
            code, output = ctx.run([found, "--version"], timeout=TIMEOUTS["probe"])
            v = parse_version(output) if code == 0 else None
            if v is None:
                ok, text = False, "%s（版を読めない）" % found
            else:
                ok = v >= version_rule[1] + (0,) * (3 - len(version_rule[1]))
                text = "%s（%d.%d.%d）" % (found, v[0], v[1], v[2])
        out.append(tool(ctx, "sandbox-" + id, name, "eval", ok, text, how="Linux で Copilot CLI のサンドボックスを使うときだけ要る。なくても EVAL はできる。ディストリビューションのパッケージで入れる（このコマンドは入れません）", required=False))
    return out


# ---------------------------------------------------------------- まとめ

def check_all(ctx: Context) -> List[Dict[str, Any]]:
    stage12 = ctx.scope in ("stage12", "all")
    evals = ctx.scope in ("eval", "all")
    tools: List[Dict[str, Any]] = []
    node_tool, npm_tool = check_node(ctx)
    npm_ok = npm_tool["ok"] and node_tool["ok"]
    pw_base: Optional[str] = None   # Playwright が入っている、またはこれから入るフォルダ
    if stage12:
        python = check_python(ctx)
        venv = check_venv(ctx, python["ok"])
        will_have_venv = venv["ok"] or venv["installable"]
        tools += [python, venv, check_pip_package(ctx, "pyyaml", "PyYAML", venv["ok"], will_have_venv), check_pip_package(ctx, "jsonschema", "jsonschema", venv["ok"], will_have_venv)]
    tools += [node_tool, npm_tool]
    if stage12:
        pw = check_playwright_tests(ctx, npm_ok, npm_tool.get("path"))
        tools.append(pw)
        if pw["ok"] or pw["installable"]:
            pw_base = ctx.tests_dir
    if evals:
        sdk, pw_eval = check_eval_tools(ctx, npm_ok, npm_tool.get("path"))
        tools += [sdk, pw_eval]
        if pw_base is None and (pw_eval["ok"] or pw_eval["installable"]):
            pw_base = ctx.tools_dir
    tools.append(check_browser(ctx, node_tool.get("path"), node_tool["ok"], pw_base))
    if evals:
        tools += check_sandbox(ctx)
    return tools


def public(item: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in item.items() if k not in ("path",)}


def summarize(tools: List[Dict[str, Any]]) -> Dict[str, Any]:
    missing = [t for t in tools if t["required"] and not t["ok"]]
    return {
        "ok": not missing,
        "missing": [{k: t[k] for k in ("id", "name", "where", "howToInstall", "commandText", "installable")} for t in missing],
        "manual": [t["id"] for t in missing if not t["installable"]],
    }


# ---------------------------------------------------------------- 入れる

def tail(text: str) -> str:
    return text.strip()[-OUTPUT_TAIL:]


def build_steps(ctx: Context, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """入れる手順を、入れる順に作る。--install なしでは予定として示し、--install では同じものを動かす。
    順：仮想環境、pip、1・2段目の Playwright、EVAL の道具、ブラウザー（Playwright が入った後）。Python と Node.js そのものは入れない。"""
    by_id = {t["id"]: t for t in tools}

    def todo(i: str) -> bool:
        t = by_id.get(i)
        return bool(t and t["required"] and not t["ok"] and t["installable"])

    npm = (by_id.get("npm") or {}).get("path") or "npm"
    steps: List[Dict[str, Any]] = []
    if todo("venv"):
        steps.append({"ids": ["venv"], "what": "Python の仮想環境を作る", "where": ctx.venv_dir, "cmd": by_id["venv"]["command"], "cwd": ctx.plugin, "timeout": TIMEOUTS["venv"]})
    pips = [i for i in ("pyyaml", "jsonschema") if todo(i)]
    if pips:
        steps.append({"ids": pips, "what": "Python のパッケージを仮想環境に入れる", "where": ctx.venv_dir, "cmd": pip_cmd(ctx, [PIP_PACKAGES[i] for i in pips]), "cwd": ctx.plugin, "timeout": TIMEOUTS["pip"]})
    if todo("playwright"):
        steps.append({"ids": ["playwright"], "what": "Playwright を生成プラグインの tests/node_modules に入れる", "where": os.path.join(ctx.tests_dir, "node_modules"), "cmd": npm_install_tests_cmd(ctx, npm), "cwd": None, "timeout": TIMEOUTS["npm"]})
    eval_ids = [i for i in ("eval-sdk", "eval-playwright") if todo(i)]
    if eval_ids:
        steps.append({"ids": eval_ids, "what": "EVAL の道具（Copilot SDK と Playwright）を道具のフォルダに入れる", "where": ctx.tools_dir, "cmd": npm_install_tools_cmd(ctx, npm), "cwd": ctx.tools_dir, "timeout": TIMEOUTS["npm"], "writePackageJson": True})
    if todo("browser"):
        steps.append({"ids": ["browser"], "what": "Playwright の Chromium を入れる（約 280 MB）", "where": "Playwright の既定の場所（ホームフォルダの中の共通の場所）", "cmd": by_id["browser"]["command"], "cwd": None, "timeout": TIMEOUTS["browser"]})
    return steps


def plan_of(steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [{"ids": s["ids"], "what": s["what"], "where": s["where"], "commandText": command_text(s["cmd"])} for s in steps]


def execute(ctx: Context, steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """手順を順に動かす。前の手順が失敗したら、それに頼る手順は動かさない（仮想環境なしの pip、Playwright なしのブラウザー）"""
    results: List[Dict[str, Any]] = []
    failed: set = set()
    needs = {"pip": {"venv"}, "browser": {"playwright", "eval-playwright"}}
    for st in steps:
        kind = "browser" if st["ids"] == ["browser"] else "pip" if any(i in PIP_PACKAGES for i in st["ids"]) else ""
        if kind and needs[kind] & failed:
            results.append({"ids": st["ids"], "what": st["what"], "where": st["where"], "commandText": command_text(st["cmd"]), "ok": False, "output": "前の手順（%s）が失敗したので、動かしませんでした" % "、".join(sorted(needs[kind] & failed))})
            failed.update(st["ids"])
            continue
        cmd = st["cmd"]
        if kind == "browser":
            # Playwright が入った後の場所で、コマンドを作り直す（入れる前に決めた場所のものがなければ）
            if not ctx.exists(cmd[1]):
                bases = playwright_dirs(ctx)
                if bases:
                    cmd = [cmd[0], playwright_cli(bases[0]), "install", "chromium"]
        try:
            if st.get("writePackageJson"):
                with open(os.path.join(HERE, "package.json"), encoding="utf-8") as f:
                    ctx.write_file(os.path.join(ctx.tools_dir, "package.json"), f.read())
        except OSError as e:
            results.append({"ids": st["ids"], "what": st["what"], "where": st["where"], "commandText": "", "ok": False, "output": "道具のフォルダを用意できませんでした：%s" % e})
            failed.update(st["ids"])
            continue
        code, out = ctx.run(cmd, cwd=st["cwd"], timeout=st["timeout"])
        results.append({"ids": st["ids"], "what": st["what"], "where": st["where"], "commandText": command_text(cmd), "ok": code == 0, "output": "" if code == 0 else tail(out)})
        if code != 0:
            failed.update(st["ids"])
    return results


# ---------------------------------------------------------------- 入口

def run(ctx: Context, do_install: bool) -> Dict[str, Any]:
    tools = check_all(ctx)
    steps = build_steps(ctx, tools)
    installed: List[Dict[str, Any]] = []
    plan = plan_of(steps)
    if do_install and steps:
        installed = execute(ctx, steps)
        tools = check_all(ctx)   # 入れた後の状態を、もう一度確かめる
    summary = summarize(tools)
    result: Dict[str, Any] = {
        "ok": summary["ok"],
        "scope": ctx.scope,
        "plugin": ctx.plugin,
        "platform": ctx.system.lower(),
        "toolsDir": ctx.tools_dir,
        "tools": [public(t) for t in tools],
        "missing": summary["missing"],
        "manual": summary["manual"],
    }
    if do_install:
        result["installed"] = installed
        result["ok"] = summary["ok"] and all(r["ok"] for r in installed)
    else:
        result["installPlan"] = plan
    browser = next((t for t in tools if t["id"] == "browser"), None)
    if browser:
        result["browser"] = {"ok": browser["ok"], "channel": browser.get("channel"), "found": browser["found"]}
    return result


def main(argv: Optional[List[str]] = None, ctx: Optional[Context] = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="試験の道具を確かめ、足りなければ入れる")
    parser.add_argument("--plugin", required=True, help="生成プラグインのフォルダ")
    parser.add_argument("--scope", choices=SCOPES, default="all", help="stage12＝1・2段目、eval＝EVAL、all＝両方（既定）")
    parser.add_argument("--install", action="store_true", help="入れてよいとユーザーが答えた後に付ける")
    try:
        args = parser.parse_args(argv)
    except SystemExit as e:
        return 2 if e.code else 0
    if not os.path.isdir(args.plugin):
        print(json.dumps({"ok": False, "error": "plugin_not_found", "message": "生成プラグインのフォルダが見つかりません（%s）" % args.plugin}, ensure_ascii=False, indent=2))
        return 2
    ctx = ctx or Context(args.plugin, args.scope)
    result = run(ctx, args.install)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
