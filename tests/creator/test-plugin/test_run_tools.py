"""ひな形の試験の入口（tests/run.py）の「道具の見つけ方」の試験（ユーザーの答え16）。

  - tests/.venv があれば、その Python で入口が動き直す（PyYAML と jsonschema は仮想環境にある）
  - 手元の Chrome か Edge を見つけて、画面の試験に環境変数 PLUGIN_TEST_BROWSER_CHANNEL で渡す
  - 足りない道具の入れ方の文が、tests/.venv と tests/node_modules を指している

入口そのものの試験は、ひな形の tests/stage1/selftest/test_run.py（A3）にある。ここでは、C3 が変えた部分だけを確かめる。
動かし方（リポジトリの根で）:  python3 -m unittest discover -s tests/creator/test-plugin -p "test_*.py"
確かめる要件：REQ-048（試験に要る道具を調べ、足りなければ入れ方と入れる場所を示す。ブラウザーは Chrome か Edge を使う）。
"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
TEMPLATE_TESTS = os.path.join(REPO, "template", "tests")
RUN = os.path.join(TEMPLATE_TESTS, "run.py")
PACKAGE_JSON = os.path.join(REPO, "skills", "test-plugin", "scripts", "package.json")

_spec = importlib.util.spec_from_file_location("template_run", RUN)
entry = importlib.util.module_from_spec(_spec)
sys.modules["template_run"] = entry
_spec.loader.exec_module(entry)

HAS_NODE = entry.node_version()[0]


class Channel(unittest.TestCase):
    def test_REQ_048_chrome_or_edge_on_the_computer_gives_the_channel_and_chrome_comes_first(self):
        found = {"google-chrome": "/usr/bin/google-chrome", "microsoft-edge": "/usr/bin/microsoft-edge"}
        with mock.patch("shutil.which", side_effect=lambda name: found.get(name)):
            self.assertEqual("chrome", entry.browser_channel())
            self.assertEqual((True, "google-chrome"), entry.browser_found("."))
        with mock.patch("shutil.which", side_effect=lambda name: {"msedge": "/usr/bin/msedge"}.get(name)):
            self.assertEqual("msedge", entry.browser_channel())

    def test_REQ_048_a_browser_at_the_usual_place_counts_too(self):
        with mock.patch("shutil.which", return_value=None), mock.patch("os.path.exists", side_effect=lambda p: p == "/opt/microsoft/msedge/msedge"):
            self.assertEqual("msedge", entry.browser_channel())
            self.assertEqual((True, "/opt/microsoft/msedge/msedge"), entry.browser_found("."))

    def test_REQ_048_without_chrome_or_edge_there_is_no_channel_so_the_playwright_chromium_is_used(self):
        with mock.patch("shutil.which", return_value=None), mock.patch("os.path.exists", return_value=False):
            self.assertIsNone(entry.browser_channel())

    @unittest.skipUnless(HAS_NODE, "node がない")
    def test_REQ_048_the_node_tests_get_the_channel_unless_the_user_already_chose_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            test = os.path.join(tmp, "channel.test.mjs")
            with open(test, "w", encoding="utf-8") as f:
                f.write("import test from 'node:test';\nimport assert from 'node:assert/strict';\n"
                        "test('REQ-048 channel', () => { assert.equal(process.env.PLUGIN_TEST_BROWSER_CHANNEL ?? '', process.env.EXPECTED_CHANNEL ?? ''); });\n")
            with mock.patch.object(entry, "browser_channel", return_value="chrome"), mock.patch.dict(os.environ, {"EXPECTED_CHANNEL": "chrome"}):
                os.environ.pop("PLUGIN_TEST_BROWSER_CHANNEL", None)
                self.assertEqual("passed", entry.run_node_tests(tmp, [test])[0]["status"])
            with mock.patch.object(entry, "browser_channel", return_value="chrome"), mock.patch.dict(os.environ, {"PLUGIN_TEST_BROWSER_CHANNEL": "chromium", "EXPECTED_CHANNEL": "chromium"}):
                self.assertEqual("passed", entry.run_node_tests(tmp, [test])[0]["status"], "ユーザーが決めた指定は上書きしない")
            with mock.patch.object(entry, "browser_channel", return_value=None), mock.patch.dict(os.environ, {"EXPECTED_CHANNEL": ""}):
                os.environ.pop("PLUGIN_TEST_BROWSER_CHANNEL", None)
                self.assertEqual("passed", entry.run_node_tests(tmp, [test])[0]["status"], "見つからなければ、渡さない")


class HowToInstall(unittest.TestCase):
    def test_REQ_048_the_how_to_texts_point_to_the_venv_and_tests_node_modules(self):
        how = entry.HOWTO
        self.assertIn("tests/.venv", how["pyyaml"])
        self.assertIn("python3 -m pip install PyYAML", how["pyyaml"])
        self.assertIn("python3 -m venv tests/.venv", how["jsonschema"])
        self.assertIn("python3 -m pip install -U jsonschema", how["jsonschema"])
        self.assertIn("npm install --prefix tests --no-save --no-package-lock playwright@", how["playwright"])
        self.assertIn("tests/node_modules", how["playwright"])
        self.assertIn("playwright/cli.js install chromium", how["browser"])
        self.assertIn("Chrome か Edge", how["browser"])

    def test_REQ_048_the_playwright_version_is_the_one_in_the_creators_package_json(self):
        with open(PACKAGE_JSON, encoding="utf-8") as f:
            pinned = json.load(f)["dependencies"]["playwright"]
        self.assertEqual(pinned, entry.PLAYWRIGHT_VERSION)
        self.assertIn("playwright@" + pinned, entry.HOWTO["playwright"])


@unittest.skipUnless(HAS_NODE, "node がない")
class Venv(unittest.TestCase):
    """tests/.venv があるときの動き直し。仮想環境は --system-site-packages で作る（PyYAML と jsonschema を、今の Python から見せる）"""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.root = os.path.join(self.tmp, "plugin")
        os.makedirs(os.path.join(self.root, "tests", "stage2"))
        self.stage1 = os.path.join(self.tmp, "stage1_stub.py")
        self.marker = os.path.join(self.tmp, "stage1-prefix.txt")
        with open(self.stage1, "w", encoding="utf-8") as f:
            f.write(textwrap.dedent("""
                import json, sys
                open(%r, "w").write(sys.prefix)
                print(json.dumps({"ok": True, "failures": [], "warnings": [], "checks": []}))
            """ % self.marker))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def make_venv(self, system_site_packages):
        args = [sys.executable, "-m", "venv", "--without-pip"] + (["--system-site-packages"] if system_site_packages else []) + [os.path.join(self.root, "tests", ".venv")]
        subprocess.run(args, check=True, capture_output=True)
        self.venv = os.path.realpath(os.path.join(self.root, "tests", ".venv"))

    def run_entry(self, env_extra=None):
        env = {k: v for k, v in os.environ.items() if k != "PLUGIN_TESTS_IN_VENV"}
        env.update(env_extra or {})
        return subprocess.run([sys.executable, RUN, "--root", self.root, "--stage1-script", self.stage1, "--stage2-dir", os.path.join(self.root, "tests", "stage2"), "--json"],
                              capture_output=True, env=env)

    def test_REQ_048_with_a_venv_the_entry_runs_again_in_it_and_the_stage_scripts_use_it(self):
        self.make_venv(system_site_packages=True)
        proc = self.run_entry()
        self.assertEqual(0, proc.returncode, proc.stdout.decode("utf-8")[-600:] + proc.stderr.decode("utf-8")[-600:])
        with open(self.marker, encoding="utf-8") as f:
            self.assertEqual(self.venv, os.path.realpath(f.read()), "1段目のスクリプトは、仮想環境の Python で動く")
        self.assertTrue(json.loads(proc.stdout.decode("utf-8"))["tools"]["ok"])

    def test_REQ_048_the_venv_decides_what_is_found_so_packages_missing_from_it_are_reported(self):
        self.make_venv(system_site_packages=False)
        proc = self.run_entry()
        result = json.loads(proc.stdout.decode("utf-8"))
        self.assertEqual(2, proc.returncode)
        self.assertEqual("stopped", result["status"])
        missing = [m["id"] for m in result["tools"]["missing"]]
        self.assertEqual(["pyyaml", "jsonschema"], missing, "今の Python にあっても、仮想環境になければ足りないと示す")
        self.assertIn("tests/.venv", result["tools"]["missing"][0]["howToInstall"])
        self.assertFalse(os.path.exists(self.marker), "足りないときは、試験を動かさない")

    def test_REQ_048_the_rerun_does_not_loop_and_can_be_switched_off(self):
        self.make_venv(system_site_packages=False)
        proc = self.run_entry({"PLUGIN_TESTS_IN_VENV": "1"})
        result = json.loads(proc.stdout.decode("utf-8"))
        self.assertEqual(0, proc.returncode, "動き直した後（または印がある）なら、もう一度動き直さない")
        self.assertTrue(result["tools"]["ok"])

    def test_REQ_048_a_venv_that_does_not_run_is_ignored(self):
        broken = os.path.join(self.root, "tests", ".venv", "bin")
        os.makedirs(broken)
        with open(os.path.join(broken, "python"), "w") as f:
            f.write("#!/bin/sh\nexit 1\n")
        os.chmod(os.path.join(broken, "python"), 0o755)
        if os.name == "nt":
            self.skipTest("Windows では動かない")
        self.assertIsNone(entry.venv_python(self.root))
        self.assertEqual(0, self.run_entry().returncode, "壊れた仮想環境は使わず、今の Python で動かす")

    def test_REQ_048_without_a_venv_nothing_changes(self):
        self.assertIsNone(entry.venv_python(self.root))
        self.assertIsNone(entry.rerun_in_venv(self.root, []))
        self.assertEqual(0, self.run_entry().returncode)

    def test_REQ_048_the_unittest_worker_is_not_rerun(self):
        self.make_venv(system_site_packages=True)
        out = os.path.join(self.tmp, "w.json")
        os.makedirs(os.path.join(self.root, "tests", "stage2", "task"))
        proc = subprocess.run([sys.executable, RUN, "--root", self.root, "--unittest-worker", os.path.join(self.root, "tests", "stage2", "task"), out], capture_output=True)
        self.assertEqual(0, proc.returncode)
        self.assertEqual([], json.load(open(out, encoding="utf-8")))


if __name__ == "__main__":
    unittest.main()
