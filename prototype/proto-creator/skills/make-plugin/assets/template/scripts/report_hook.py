#!/usr/bin/env python3
"""Hook: report sub-agent start/stop to the web dashboard, and block tools after the user pressed stop.

Usage: report_hook.py start|stop|check-stop  (the hook payload arrives on stdin)
The payload may use Copilot CLI field names (agentName, cwd) or Claude Code / VS Code ones (agent_type, agent_name).
"""
import json
import os
import sys
import urllib.request

NO_PROXY = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def dashboard_url(cwd):
    try:
        with open(os.path.join(cwd, ".dashboard.json"), encoding="utf-8") as f:
            return json.load(f)["url"]
    except (OSError, ValueError, KeyError):
        return None


def agent_name(payload):
    name = payload.get("agentName") or payload.get("agent_name") or payload.get("agent_type") or "?"
    return name.split(":")[-1]  # Claude Code prefixes plugin agents with "<plugin>:"


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        payload = {}
    url = dashboard_url(payload.get("cwd") or os.getcwd())
    if url is None:
        return 0  # the dashboard is not running: nothing to report or enforce
    if mode in ("start", "stop"):
        body = json.dumps({"kind": "agent", "agent": agent_name(payload),
                           "state": "実行中" if mode == "start" else "完了"}).encode()
        request = urllib.request.Request(url + "event", data=body, headers={"Content-Type": "application/json"})
        try:
            NO_PROXY.open(request, timeout=5).read()
        except OSError:
            pass
        return 0
    if mode == "check-stop":
        try:
            stopped = json.load(NO_PROXY.open(url + "status", timeout=5)).get("stopped")
        except (OSError, ValueError):
            return 0
        if stopped:
            print("ユーザーが Web管理画面で止めたため、ツールを実行しません。作業を終えてください。", file=sys.stderr)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
