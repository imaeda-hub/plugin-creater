"""check_tools.py（試験の道具の確かめと用意）の試験。ネットワークも本物の npm・pip も使わない（偽物の環境で動かす）。

動かし方（リポジトリの根で）:
    python3 -m unittest discover -s tests/creator/test-plugin -p "test_*.py"

確かめる要件：REQ-048（足りない道具と入れ方と入れる場所を示す。ユーザーがよいと答えるまで入れない。
Chrome か Edge があれば、ブラウザーは入れない。どちらもないときだけ Playwright の Chromium を入れる）。
"""
import ast
import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SCRIPT = os.path.join(os.environ.get("C3_SCRIPTS_DIR") or os.path.join(REPO, "skills", "test-plugin", "scripts"), "check_tools.py")

_spec = importlib.util.spec_from_file_location("check_tools", SCRIPT)
ct = importlib.util.module_from_spec(_spec)
sys.modules["check_tools"] = ct
_spec.loader.exec_module(ct)

PLUGIN = "/p"
HOME = "/h"
TOOLS = HOME + "/.copilot/plugin-data/plugin-creator/tools"
VENV_PY = PLUGIN + "/tests/.venv/bin/python"
PINS = {"sdk": "1.0.25", "playwright": "1.56.1"}


class Fake(ct.Context):
    """OS への問い合わせを、試験が決める偽物。run は、コマンドに含まれる語で答えを選ぶ。"""

    def __init__(self, scope="all", system="Linux", python_version=(3, 12, 0), which=None, exists=None, files=None, dirs=None, runs=None):
        super().__init__(PLUGIN, scope, env={"COPILOT_HOME": HOME + "/.copilot", "PATH": "/x"}, pins=dict(PINS))
        self.system = system
        self.python = "/usr/bin/python3"
        self.python_version = python_version
        self.fake_which = dict(which or {})
        self.fake_exists = set(exists or [])
        self.fake_files = dict(files or {})
        self.fake_dirs = dict(dirs or {})
        self.fake_runs = list(runs or [])   # [(語, (終了コード, 出力))]。先に当てはまったものを使う
        self.calls = []
        self.written = {}

    def which(self, name):
        return self.fake_which.get(name)

    def exists(self, path):
        return path in self.fake_exists

    def read_json(self, path):
        return self.fake_files.get(path)

    def listdir(self, path):
        return self.fake_dirs.get(path, [])

    def run(self, cmd, cwd=None, timeout=60):
        self.calls.append((list(cmd), cwd))
        text = " ".join(cmd)
        for word, result in self.fake_runs:
            if word in text:
                return result
        return 0, ""

    def write_file(self, path, text):
        self.written[path] = text


def installed_world(scope="all", **overrides):
    """何もかもそろっている環境。Chrome は入っていない（Playwright の Chromium がある）"""
    kwargs = dict(
        scope=scope,
        which={"node": "/usr/bin/node", "npm": "/usr/bin/npm"},
        exists={VENV_PY, PLUGIN + "/tests/node_modules/playwright/cli.js", "/usr/sbin/iptables"},
        files={
            PLUGIN + "/tests/node_modules/playwright/package.json": {"version": "1.56.1"},
            TOOLS + "/node_modules/playwright/package.json": {"version": "1.56.1"},
            TOOLS + "/node_modules/@github/copilot-sdk/package.json": {"version": "1.0.25"},
        },
        dirs={TOOLS + "/node_modules/@github": ["copilot-sdk", "copilot-sdk-linux-x64"]},
        runs=[
            ("node --version", (0, "v22.22.0\n")),
            ("npm --version", (0, "10.9.4\n")),
            ("import venv, ensurepip", (0, "")),
            ("import yaml", (0, "6.0.3\n")),
            ("m.version('jsonschema')", (0, "4.26.0\n")),
            ("sys.version_info", (0, "3.12.1\n")),
            ("executablePath", (0, "yes")),
            ("--version", (0, "bubblewrap 0.9.0")),
        ],
    )
    kwargs.update(overrides)
    return Fake(**kwargs)


def by_id(tools):
    return {t["id"]: t for t in tools}


class Pins(unittest.TestCase):
    def test_REQ_048_versions_come_from_package_json_in_the_same_folder(self):
        with open(os.path.join(os.path.dirname(SCRIPT), "package.json"), encoding="utf-8") as f:
            deps = json.load(f)["dependencies"]
        self.assertEqual({"sdk": deps["@github/copilot-sdk"], "playwright": deps["playwright"]}, ct.load_pins())
        self.assertEqual({"sdk": "1.0.25", "playwright": "1.56.1"}, ct.load_pins())

    def test_REQ_048_node_versions_the_copilot_sdk_needs(self):
        for v, ok in (((20, 18, 0), False), ((20, 19, 0), True), ((21, 9, 0), False), ((22, 11, 0), False), ((22, 12, 0), True), ((23, 0, 0), True), ((24, 1, 0), True)):
            self.assertEqual(ok, ct.node_supported(v), v)

    def test_REQ_048_the_script_uses_no_syntax_newer_than_python_3_7(self):
        with open(SCRIPT, encoding="utf-8") as f:
            ast.parse(f.read(), feature_version=(3, 7))

    def test_REQ_048_commands_are_shown_in_a_form_that_can_be_pasted(self):
        self.assertEqual("npm install --prefix /a/b playwright@1.56.1", ct.command_text(["npm", "install", "--prefix", "/a/b", "playwright@1.56.1"]))
        self.assertEqual("pip install 'jsonschema>=4.0'", ct.command_text(["pip", "install", "jsonschema>=4.0"]))
        self.assertEqual("python -m venv '/a b/c'", ct.command_text(["python", "-m", "venv", "/a b/c"]))


class Checks(unittest.TestCase):
    def test_REQ_048_everything_present_means_ok_and_nothing_to_install(self):
        ctx = installed_world()
        tools = ct.check_all(ctx)
        self.assertTrue(all(t["ok"] for t in tools if t["required"]), [t["id"] for t in tools if t["required"] and not t["ok"]])
        self.assertEqual([], ct.build_steps(ctx, tools))
        result = ct.run(ctx, False)
        self.assertTrue(result["ok"])
        self.assertEqual([], result["missing"])
        self.assertEqual([], result["installPlan"])
        self.assertEqual("chromium", result["browser"]["channel"])

    def test_REQ_048_nothing_present_lists_each_missing_tool_with_how_to_install_and_where(self):
        ctx = Fake(which={"node": "/usr/bin/node", "npm": "/usr/bin/npm"}, runs=[("node --version", (0, "v22.12.0")), ("npm --version", (0, "10.0.0")), ("import venv, ensurepip", (0, ""))])
        result = ct.run(ctx, False)
        self.assertFalse(result["ok"])
        missing = {m["id"]: m for m in result["missing"]}
        self.assertEqual(["venv", "pyyaml", "jsonschema", "playwright", "eval-sdk", "eval-playwright", "browser"], list(missing))
        self.assertEqual(PLUGIN + "/tests/.venv", missing["venv"]["where"])
        self.assertEqual("/usr/bin/python3 -m venv " + PLUGIN + "/tests/.venv", missing["venv"]["commandText"])
        self.assertIn(missing["venv"]["commandText"], missing["venv"]["howToInstall"])
        self.assertEqual(PLUGIN + "/tests/node_modules", missing["playwright"]["where"])
        self.assertIn("playwright@1.56.1", missing["playwright"]["commandText"])
        self.assertIn("--no-save", missing["playwright"]["commandText"])
        self.assertEqual(TOOLS, missing["eval-sdk"]["where"])
        self.assertIn("Playwright の既定の場所", missing["browser"]["where"])
        self.assertTrue(all(m["installable"] for m in missing.values()), 'どれも --install で入れられる（先の手順で入るものを含む）')
        self.assertEqual([], result["manual"])
        self.assertEqual(TOOLS, result["toolsDir"])

    def test_REQ_048_nothing_is_installed_without_the_install_flag(self):
        ctx = Fake(which={"node": "/usr/bin/node", "npm": "/usr/bin/npm"}, runs=[("node --version", (0, "v22.12.0")), ("npm --version", (0, "10.0.0")), ("import venv, ensurepip", (0, ""))])
        result = ct.run(ctx, False)
        self.assertNotIn("installed", result)
        installing = [c for c, _ in ctx.calls if "install" in c or "venv" in c and "-m" in c]
        self.assertEqual([], installing, '確かめるだけのコマンドしか動かさない')
        self.assertEqual({}, ctx.written)

    def test_REQ_048_python_and_node_themselves_are_only_shown_never_installed(self):
        ctx = Fake(python_version=(3, 8, 10), which={}, runs=[("import venv, ensurepip", (0, ""))])
        result = ct.run(ctx, True)
        manual = result["manual"]
        self.assertEqual(["python", "node", "npm"], [i for i in manual if i in ("python", "node", "npm")])
        by = by_id(result["tools"])
        self.assertFalse(by["python"]["installable"])
        self.assertIn("python.org", by["python"]["howToInstall"])
        self.assertIn("nodejs.org", by["node"]["howToInstall"])
        self.assertEqual("3.8.10", by["python"]["found"])
        self.assertEqual("見つからない", by["node"]["found"])
        steps = ct.build_steps(ctx, ct.check_all(ctx))
        self.assertEqual([], steps, 'Python がなければ仮想環境も作れず、Node.js がなければ npm も使えないので、入れる手順はない')
        self.assertEqual([], result["installed"])

    def test_REQ_048_unsupported_node_counts_as_missing(self):
        ctx = installed_world(runs=[("node --version", (0, "v20.18.0")), ("npm --version", (0, "10.0.0"))])
        by = by_id(ct.check_all(ctx))
        self.assertFalse(by["node"]["ok"])
        self.assertEqual("20.18.0", by["node"]["found"])

    def test_REQ_048_a_python_without_venv_support_is_shown_with_the_fix_and_not_installed_automatically(self):
        ctx = Fake(which={"node": "/usr/bin/node", "npm": "/usr/bin/npm"}, runs=[("node --version", (0, "v22.12.0")), ("npm --version", (0, "10.0.0")), ("import venv, ensurepip", (1, "No module named ensurepip"))])
        by = by_id(ct.check_all(ctx))
        self.assertFalse(by["venv"]["ok"])
        self.assertFalse(by["venv"]["installable"])
        self.assertIn("python3-venv", by["venv"]["howToInstall"])
        self.assertFalse(by["pyyaml"]["installable"], '仮想環境ができないので、パッケージも入れられない')
        self.assertIn("venv", ct.run(ctx, False)["manual"])

    def test_REQ_048_old_jsonschema_counts_as_missing_and_is_upgraded_in_the_venv(self):
        ctx = installed_world(runs=[("m.version('jsonschema')", (0, "3.2.0\n")), ("import yaml", (0, "6.0.3\n")), ("sys.version_info", (0, "3.12.1\n")), ("node --version", (0, "v22.22.0")), ("npm --version", (0, "10.9.4")), ("executablePath", (0, "yes"))])
        tools = ct.check_all(ctx)
        by = by_id(tools)
        self.assertFalse(by["jsonschema"]["ok"])
        self.assertEqual("3.2.0", by["jsonschema"]["found"])
        self.assertTrue(by["pyyaml"]["ok"])
        steps = ct.build_steps(ctx, tools)
        self.assertEqual([["jsonschema"]], [s["ids"] for s in steps])
        self.assertEqual([VENV_PY, "-m", "pip", "install", "jsonschema>=4.0"], steps[0]["cmd"])

    def test_REQ_048_playwright_of_another_version_or_a_missing_runtime_package_counts_as_missing(self):
        files = installed_world().fake_files
        files[PLUGIN + "/tests/node_modules/playwright/package.json"] = {"version": "1.60.0"}
        files[TOOLS + "/node_modules/@github/copilot-sdk/package.json"] = {"version": "1.0.22"}
        ctx = installed_world(files=files)
        by = by_id(ct.check_all(ctx))
        self.assertFalse(by["playwright"]["ok"])
        self.assertEqual("1.60.0（1.56.1 が要る）", by["playwright"]["found"])
        self.assertEqual("1.0.22（1.0.25 が要る）", by["eval-sdk"]["found"])
        norun = installed_world(dirs={TOOLS + "/node_modules/@github": ["copilot-sdk"]})
        sdk = by_id(ct.check_all(norun))["eval-sdk"]
        self.assertFalse(sdk["ok"])
        self.assertIn("実行ファイルのパッケージ", sdk["found"])

    def test_REQ_048_the_scope_decides_which_tools_are_checked(self):
        ids = lambda scope: [t["id"] for t in ct.check_all(installed_world(scope))]
        stage12 = ids("stage12")
        evals = ids("eval")
        self.assertEqual(["python", "venv", "pyyaml", "jsonschema", "node", "npm", "playwright", "browser"], stage12)
        self.assertEqual(["node", "npm", "eval-sdk", "eval-playwright", "browser"], [i for i in evals if not i.startswith("sandbox-")])
        self.assertEqual(set(stage12) | set(evals), set(ids("all")))
        self.assertTrue(any(i.startswith("sandbox-") for i in evals))
        self.assertFalse(any(i.startswith("sandbox-") for i in stage12))


class Browser(unittest.TestCase):
    def test_REQ_048_chrome_or_edge_on_the_computer_is_used_and_no_browser_is_installed(self):
        for which, channel in (({"google-chrome": "/usr/bin/google-chrome"}, "chrome"), ({"microsoft-edge": "/usr/bin/microsoft-edge"}, "msedge")):
            ctx = Fake(which=dict(which, node="/usr/bin/node", npm="/usr/bin/npm"), runs=[("node --version", (0, "v22.12.0")), ("npm --version", (0, "10.0.0"))])
            by = by_id(ct.check_all(ctx))
            self.assertTrue(by["browser"]["ok"], channel)
            self.assertEqual(channel, by["browser"]["channel"])
            self.assertNotIn(["browser"], [s["ids"] for s in ct.build_steps(ctx, ct.check_all(ctx))])

    def test_REQ_048_chrome_is_found_at_the_usual_place_too_and_is_preferred_over_edge(self):
        ctx = Fake(which={"microsoft-edge": "/usr/bin/microsoft-edge"}, exists={"/opt/google/chrome/chrome"})
        self.assertEqual(("chrome", "Google Chrome", "/opt/google/chrome/chrome"), ct.system_browser(ctx))
        both = Fake(which={"microsoft-edge": "/e", "google-chrome": "/c"})
        self.assertEqual("chrome", ct.system_browser(both)[0])
        self.assertIsNone(ct.system_browser(Fake()))

    def test_REQ_048_without_chrome_or_edge_the_playwright_chromium_is_used_when_it_is_there(self):
        ctx = installed_world()
        browser = by_id(ct.check_all(ctx))["browser"]
        self.assertTrue(browser["ok"])
        self.assertEqual("chromium", browser["channel"])

    def test_REQ_048_without_any_browser_the_chromium_is_planned_after_playwright_and_only_then(self):
        ctx = installed_world(runs=[("executablePath", (0, "no")), ("node --version", (0, "v22.22.0")), ("npm --version", (0, "10.9.4")), ("import yaml", (0, "6.0.3")), ("m.version('jsonschema')", (0, "4.26.0")), ("sys.version_info", (0, "3.12.1"))])
        tools = ct.check_all(ctx)
        browser = by_id(tools)["browser"]
        self.assertFalse(browser["ok"])
        self.assertTrue(browser["installable"])
        self.assertEqual(["/usr/bin/node", PLUGIN + "/tests/node_modules/playwright/cli.js", "install", "chromium"], browser["command"])
        self.assertIn("約 280 MB", browser["howToInstall"])
        steps = ct.build_steps(ctx, tools)
        self.assertEqual([["browser"]], [s["ids"] for s in steps])

    def test_REQ_048_the_browser_step_waits_for_playwright_to_be_installable(self):
        bare = Fake(which={"node": "/usr/bin/node", "npm": "/usr/bin/npm"}, runs=[("node --version", (0, "v22.22.0")), ("npm --version", (0, "10.9.4")), ("import venv, ensurepip", (0, ""))], scope="eval")
        browser = by_id(ct.check_all(bare))["browser"]
        self.assertIn(TOOLS + "/node_modules/playwright/cli.js", browser["command"])
        nonode = Fake(which={})
        self.assertFalse(by_id(ct.check_all(nonode))["browser"]["installable"])


class Sandbox(unittest.TestCase):
    def test_REQ_048_linux_sandbox_tools_are_only_shown_and_never_make_the_result_fail(self):
        ctx = installed_world(runs=[("node --version", (0, "v22.22.0")), ("npm --version", (0, "10.9.4")), ("import yaml", (0, "6.0.3")), ("m.version('jsonschema')", (0, "4.26.0")), ("sys.version_info", (0, "3.12.1")), ("executablePath", (0, "yes")), ("--version", (0, "bubblewrap 0.4.1"))],
                               which={"node": "/usr/bin/node", "npm": "/usr/bin/npm", "bwrap": "/usr/bin/bwrap"})
        result = ct.run(ctx, False)
        sandbox = {t["id"]: t for t in result["tools"] if t["id"].startswith("sandbox-")}
        self.assertEqual(8, len(sandbox))
        self.assertFalse(sandbox["sandbox-bwrap"]["ok"], '0.4.1 は 0.5.0 より古い')
        self.assertFalse(sandbox["sandbox-bwrap"]["required"])
        self.assertTrue(sandbox["sandbox-iptables"]["ok"])
        self.assertFalse(sandbox["sandbox-slirp4netns"]["ok"])
        self.assertTrue(result["ok"], '足りなくても、ok は変わらない')
        self.assertEqual([], result["missing"])

    def test_REQ_048_util_linux_older_than_2_35_does_not_count(self):
        ctx = installed_world(which={"node": "/usr/bin/node", "npm": "/usr/bin/npm", "unshare": "/usr/bin/unshare"},
                              runs=[("unshare --version", (0, "unshare from util-linux 2.34")), ("node --version", (0, "v22.22.0")), ("npm --version", (0, "10.9.4")), ("import yaml", (0, "6.0.3")), ("m.version('jsonschema')", (0, "4.26.0")), ("sys.version_info", (0, "3.12.1")), ("executablePath", (0, "yes"))])
        self.assertFalse(by_id(ct.check_all(ctx))["sandbox-unshare"]["ok"])

    def test_REQ_048_other_systems_do_not_check_the_linux_sandbox_tools(self):
        for system in ("Darwin", "Windows"):
            ids = [t["id"] for t in ct.check_all(installed_world(system=system))]
            self.assertFalse(any(i.startswith("sandbox-") for i in ids), system)


class Install(unittest.TestCase):
    def bare(self, **kw):
        return Fake(which={"node": "/usr/bin/node", "npm": "/usr/bin/npm"},
                    runs=[("node --version", (0, "v22.12.0")), ("npm --version", (0, "10.0.0")), ("import venv, ensurepip", (0, ""))], **kw)

    def test_REQ_048_the_install_steps_run_in_order_in_the_places_the_design_decides(self):
        ctx = self.bare()
        steps = ct.build_steps(ctx, ct.check_all(ctx))
        self.assertEqual([["venv"], ["pyyaml", "jsonschema"], ["playwright"], ["eval-sdk", "eval-playwright"], ["browser"]], [s["ids"] for s in steps])
        venv, pip, pw, evals, browser = steps
        self.assertEqual(["/usr/bin/python3", "-m", "venv", PLUGIN + "/tests/.venv"], venv["cmd"])
        self.assertEqual([VENV_PY, "-m", "pip", "install", "PyYAML", "jsonschema>=4.0"], pip["cmd"])
        self.assertEqual(["/usr/bin/npm", "install", "--prefix", PLUGIN + "/tests", "--no-save", "--no-package-lock", "--ignore-scripts", "--no-audit", "--no-fund", "playwright@1.56.1"], pw["cmd"])
        self.assertEqual(["/usr/bin/npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"], evals["cmd"])
        self.assertEqual(TOOLS, evals["cwd"], 'EVAL の道具は、道具のフォルダの中で入れる')
        self.assertEqual("playwright", browser["cmd"][1].split(os.sep)[-2])

    def test_REQ_048_install_runs_the_steps_copies_package_json_to_the_tools_folder_and_checks_again(self):
        ctx = self.bare()
        result = ct.run(ctx, True)
        self.assertEqual([["venv"], ["pyyaml", "jsonschema"], ["playwright"], ["eval-sdk", "eval-playwright"], ["browser"]], [r["ids"] for r in result["installed"]])
        self.assertTrue(all(r["ok"] for r in result["installed"]))
        with open(os.path.join(os.path.dirname(SCRIPT), "package.json"), encoding="utf-8") as f:
            self.assertEqual(f.read(), ctx.written[TOOLS + "/package.json"])
        ran = [c for c, _ in ctx.calls if "install" in c or c[1:3] == ["-m", "venv"]]
        self.assertEqual(5, len(ran))
        self.assertNotIn("installPlan", result)

    def test_REQ_048_when_a_step_fails_the_steps_that_need_it_are_not_run_and_the_result_is_not_ok(self):
        ctx = self.bare()
        ctx.fake_runs.insert(0, ("-m venv", (1, "ensurepip is not available")))
        ctx.fake_runs.insert(0, ("--prefix", (1, "npm ERR! network")))
        result = ct.run(ctx, True)
        by = {tuple(r["ids"]): r for r in result["installed"]}
        self.assertFalse(by[("venv",)]["ok"])
        self.assertIn("ensurepip", by[("venv",)]["output"])
        self.assertFalse(by[("pyyaml", "jsonschema")]["ok"])
        self.assertIn("前の手順（venv）が失敗した", by[("pyyaml", "jsonschema")]["output"])
        self.assertFalse(by[("playwright",)]["ok"])
        self.assertIn("network", by[("playwright",)]["output"])
        self.assertTrue(by[("eval-sdk", "eval-playwright")]["ok"], 'ほかの場所の手順は動かす')
        self.assertFalse(result["ok"])
        pip_ran = [c for c, _ in ctx.calls if "pip" in c]
        self.assertEqual([], pip_ran)

    def test_REQ_048_install_with_nothing_to_install_does_nothing(self):
        ctx = installed_world()
        result = ct.run(ctx, True)
        self.assertEqual([], result["installed"])
        self.assertTrue(result["ok"])
        self.assertEqual({}, ctx.written)

    def test_REQ_048_the_result_reports_the_tool_state_after_installing(self):
        ctx = self.bare()
        before = ct.run(self.bare(), False)
        self.assertFalse(before["ok"])
        # 偽物の環境は、入れても状態が変わらない。入れた後にもう一度確かめた結果が出る（まだ足りない）ことを見る
        after = ct.run(ctx, True)
        self.assertFalse(after["ok"])
        self.assertTrue(after["missing"])


class Cli(unittest.TestCase):
    def run_cli(self, *args, env=None):
        proc = subprocess.run([sys.executable, SCRIPT, *args], capture_output=True, env=dict(os.environ, **(env or {})))
        return proc.returncode, proc.stdout.decode("utf-8"), proc.stderr.decode("utf-8")

    def test_REQ_048_a_wrong_use_returns_2(self):
        self.assertEqual(2, self.run_cli()[0])
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(2, self.run_cli("--plugin", tmp, "--scope", "nothing")[0])
            code, out, _ = self.run_cli("--plugin", os.path.join(tmp, "none"))
            self.assertEqual(2, code)
            self.assertEqual("plugin_not_found", json.loads(out)["error"])

    def test_REQ_048_the_real_check_prints_one_json_and_the_exit_code_follows_ok(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, out, _ = self.run_cli("--plugin", tmp, "--scope", "stage12", env={"COPILOT_HOME": os.path.join(tmp, "home")})
            result = json.loads(out)
            self.assertEqual(0 if result["ok"] else 1, code)
            self.assertEqual("stage12", result["scope"])
            self.assertEqual(os.path.realpath(tmp), os.path.realpath(result["plugin"]))
            ids = [t["id"] for t in result["tools"]]
            self.assertEqual(["python", "venv", "pyyaml", "jsonschema", "node", "npm", "playwright", "browser"], ids)
            self.assertFalse(os.path.exists(os.path.join(tmp, "tests")), '確かめるだけでは、何も作らない')
            self.assertFalse(os.path.exists(os.path.join(tmp, "home")))

    def test_REQ_048_main_returns_the_exit_code_from_an_injected_context(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            code = ct.main(["--plugin", tempfile.gettempdir(), "--scope", "eval"], installed_world("eval"))
        self.assertEqual(0, code)
        self.assertTrue(json.loads(buf.getvalue())["ok"])


if __name__ == "__main__":
    unittest.main()
