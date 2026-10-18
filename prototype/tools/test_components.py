#!/usr/bin/env python3
"""Level 2 (component tests) for a plugin generated from the proto template. No model is used.

Usage: test_components.py PLUGIN_DIR  -> prints a JSON report; exit 1 when a test fails.
Covers: the hook script (Copilot and Claude Code payloads), the dashboard controller, and the MCP server
(direct JSON-RPC, and the MCP Inspector CLI when INSPECTOR=1).
"""
import glob
import json
import os
import signal
import subprocess
import sys
import tempfile
import urllib.request

NO_PROXY = urllib.request.build_opener(urllib.request.ProxyHandler({}))
results = []


def check(name, condition, detail=""):
    results.append({"test": name, "ok": bool(condition), "detail": detail})


def run(args, cwd, stdin=""):
    p = subprocess.run(args, cwd=cwd, input=stdin, capture_output=True, text=True, timeout=60)
    return p.returncode, p.stdout, p.stderr


def status(cwd):
    with open(os.path.join(cwd, ".dashboard.json"), encoding="utf-8") as f:
        url = json.load(f)["url"]
    return json.load(NO_PROXY.open(url + "status", timeout=5)), url


def post(url, path, data):
    request = urllib.request.Request(url + path, data=json.dumps(data).encode(), headers={"Content-Type": "application/json"})
    return NO_PROXY.open(request, timeout=5).status


def test_hooks_and_dashboard(plugin):
    skill_dir = glob.glob(os.path.join(plugin, "skills", "*", "scripts", "dashboard.py"))[0]
    hook = os.path.join(plugin, "scripts", "report_hook.py")
    cwd = tempfile.mkdtemp(prefix="l2-")

    # Without a dashboard, every hook mode succeeds and does nothing.
    for mode in ("start", "stop", "check-stop"):
        code, _, _ = run([sys.executable, hook, mode], cwd, json.dumps({"agentName": "worker", "cwd": cwd}))
        check(f"hook {mode}: ダッシュボードがないときは何もしない", code == 0, f"exit={code}")

    code, out, _ = run([sys.executable, skill_dir, "start"], cwd)
    check("dashboard start: URL を表示する", code == 0 and "http://127.0.0.1:" in out, out.strip())
    try:
        state, url = status(cwd)
        check("dashboard start: 最初は待機中", state["started"] is False and state["agents"]["worker"] == "待機")

        code, out, _ = run([sys.executable, skill_dir, "wait", "--timeout", "1"], cwd)
        check("dashboard wait: 開始前は時間切れを伝える", code == 3 and "まだ開始されていません" in out, f"exit={code}")
        check("Web管理画面: 誤った設定は受け付けない", _status_of(url, "start", {"model": "gpt", "limit": 0}) == 400)
        post(url, "start", {"model": "haiku", "limit": 2})
        code, out, _ = run([sys.executable, skill_dir, "wait", "--timeout", "5"], cwd)
        check("dashboard wait: 開始後は設定を返す", code == 0 and json.loads(out) == {"model": "haiku", "limit": 2}, out.strip())

        run([sys.executable, skill_dir, "phase", "作業"], cwd)
        code, _, _ = run([sys.executable, hook, "start"], cwd, json.dumps({"agentName": "worker", "cwd": cwd}))
        state, _ = status(cwd)
        check("hook start（Copilot CLI の形式）: 作業エージェントが実行中になる",
              code == 0 and state["agents"]["worker"] == "実行中" and state["phase"] == "作業")
        code, _, _ = run([sys.executable, hook, "stop"], cwd,
                         json.dumps({"hook_event_name": "SubagentStop", "agent_type": "weekly:verifier", "cwd": cwd}))
        state, _ = status(cwd)
        check("hook stop（Claude Code の形式）: 検証エージェントが完了になる", code == 0 and state["agents"]["verifier"] == "完了")
        code, _, _ = run([sys.executable, hook, "start"], cwd, "これは JSON ではない")
        check("hook: 壊れた入力でも作業を止めない", code == 0, f"exit={code}")

        code, _, _ = run([sys.executable, hook, "check-stop"], cwd, json.dumps({"toolName": "bash", "cwd": cwd}))
        check("hook check-stop: 止める前はツールを通す", code == 0, f"exit={code}")
        post(url, "stop", {})
        code, _, err = run([sys.executable, hook, "check-stop"], cwd, json.dumps({"tool_name": "Bash", "cwd": cwd}))
        check("hook check-stop: 止めたあとはツールを止める（終了コード2）", code == 2 and "止めた" in err, f"exit={code}")
        state, _ = status(cwd)
        check("止める: すべてのエージェントが停止し、理由が記録される",
              all(s == "停止" for s in state["agents"].values()) and state["result"]["reason"] == "ユーザーが止めた")
    finally:
        with open(os.path.join(cwd, ".dashboard.json"), encoding="utf-8") as f:
            os.kill(json.load(f)["pid"], signal.SIGTERM)


def _status_of(url, path, data):
    try:
        return post(url, path, data)
    except urllib.error.HTTPError as e:
        return e.code


def mcp_session(server, messages):
    p = subprocess.run([sys.executable, server], input="".join(json.dumps(m) + "\n" for m in messages),
                       capture_output=True, text=True, timeout=30)
    return [json.loads(line) for line in p.stdout.splitlines() if line.strip()]


def test_mcp(plugin):
    server = os.path.join(plugin, "mcp", "calc_server.py")
    replies = mcp_session(server, [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
        {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "yen_to_man", "arguments": {"amount": 520000}}},
        {"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "yen_to_man", "arguments": {"amount": 9999}}},
        {"jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": {"name": "yen_to_man", "arguments": {"amount": -1}}},
        {"jsonrpc": "2.0", "id": 6, "method": "tools/call", "params": {"name": "yen_to_man", "arguments": {"amount": "多い"}}},
        {"jsonrpc": "2.0", "id": 7, "method": "no/such"},
    ])
    by_id = {r.get("id"): r for r in replies}
    check("MCP: 初期化できる", by_id[1]["result"]["serverInfo"]["name"] == "calc")
    check("MCP: 通知には返事をしない", len(replies) == 7, f"replies={len(replies)}")
    check("MCP: ツールの一覧に yen_to_man がある", [t["name"] for t in by_id[2]["result"]["tools"]] == ["yen_to_man"])
    check("MCP 正常: 520000円 → 52万円", by_id[3]["result"]["content"][0]["text"] == "52万円")
    check("MCP 正常: 1万円未満は切り捨て（9999円 → 0万円）", by_id[4]["result"]["content"][0]["text"] == "0万円")
    check("MCP 異常: 負の金額はエラー", by_id[5]["result"].get("isError") is True)
    check("MCP 異常: 数でない金額はエラー", by_id[6]["result"].get("isError") is True)
    check("MCP 異常: ないメソッドはエラー", by_id[7]["error"]["code"] == -32601)

    if os.environ.get("INSPECTOR") == "1":
        base = ["npx", "-y", "@modelcontextprotocol/inspector", "--cli", sys.executable, server]
        p = subprocess.run(base + ["--method", "tools/list"], capture_output=True, text=True, timeout=180)
        check("MCP Inspector CLI: ツールの一覧が取れる", p.returncode == 0 and "yen_to_man" in p.stdout, (p.stderr or p.stdout)[-300:])
        p = subprocess.run(base + ["--method", "tools/call", "--tool-name", "yen_to_man", "--tool-arg", "amount=368000"],
                           capture_output=True, text=True, timeout=180)
        check("MCP Inspector CLI: ツールを呼べる（368000円 → 36万円）", p.returncode == 0 and "36万円" in p.stdout, (p.stderr or p.stdout)[-300:])


def main():
    plugin = os.path.abspath(sys.argv[1])
    test_hooks_and_dashboard(plugin)
    test_mcp(plugin)
    failed = [r for r in results if not r["ok"]]
    print(json.dumps({"plugin": plugin, "ok": not failed, "passed": len(results) - len(failed),
                      "failed": failed, "results": results}, ensure_ascii=False, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
