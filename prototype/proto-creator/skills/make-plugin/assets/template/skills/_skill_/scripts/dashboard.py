#!/usr/bin/env python3
"""Control the web dashboard from the agent.

  dashboard.py start                       start the dashboard and print its URL
  dashboard.py wait [--timeout SEC]        wait until the user presses 開始, then print the settings (JSON)
  dashboard.py phase <name>                show the current phase (計画, 作業, 検証)
  dashboard.py result --reason R --summary S   show the result
The dashboard address is kept in .dashboard.json in the current directory.
"""
import argparse
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = ".dashboard.json"
NO_PROXY = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def url():
    with open(STATE_FILE, encoding="utf-8") as f:
        return json.load(f)["url"]


def post(path, data):
    request = urllib.request.Request(url() + path, data=json.dumps(data).encode(),
                                     headers={"Content-Type": "application/json"})
    NO_PROXY.open(request, timeout=10).read()


def start():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    process = subprocess.Popen([sys.executable, os.path.join(HERE, "server.py"), "--port", str(port)],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    address = f"http://127.0.0.1:{port}/"
    for _ in range(50):
        try:
            NO_PROXY.open(address + "status", timeout=1).read()
            break
        except OSError:
            time.sleep(0.1)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump({"url": address, "pid": process.pid}, f)
    print(f"Web管理画面: {address}")


def wait(timeout):
    try:
        print(NO_PROXY.open(url() + f"wait-start?timeout={timeout}", timeout=timeout + 10).read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 408:
            print("まだ開始されていません。もう一度 wait を実行してください。")
            return 3
        raise
    return 0


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("start")
    p_wait = sub.add_parser("wait")
    p_wait.add_argument("--timeout", type=float, default=100)
    p_phase = sub.add_parser("phase")
    p_phase.add_argument("name")
    p_result = sub.add_parser("result")
    p_result.add_argument("--reason", required=True)
    p_result.add_argument("--summary", default="")
    args = parser.parse_args()
    if args.command == "start":
        start()
    elif args.command == "wait":
        return wait(args.timeout)
    elif args.command == "phase":
        post("event", {"kind": "phase", "phase": args.name})
    elif args.command == "result":
        post("result", {"reason": args.reason, "summary": args.summary})
    return 0


if __name__ == "__main__":
    sys.exit(main())
