#!/usr/bin/env python3
"""Web dashboard: settings before the start, live view while running, stop button, and results.

Listens on 127.0.0.1 only. Usage: server.py --port N
"""
import argparse
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

AGENTS = ["統括", "worker", "verifier"]
state = {"started": False, "stopped": False, "settings": None, "phase": "-",
         "agents": {a: "待機" for a in AGENTS}, "result": None, "events": []}
lock = threading.Condition()

PAGE = """<!doctype html><meta charset="utf-8"><title>Web管理画面</title>
<style>body{font-family:sans-serif;margin:16px} li{margin:2px 0} #result{white-space:pre-wrap;background:#f4f4f4;padding:8px}</style>
<h1>Web管理画面</h1>
<section id="settings-area"><h2>開始前の設定</h2>
<label>作業のモデル <select id="model"><option>haiku</option><option selected>sonnet</option><option>opus</option></select></label>
<label>繰り返しの上限 <input id="limit" type="number" min="1" value="3"></label>
<button id="start">開始</button></section>
<section><h2>実行中</h2><p>フェーズ：<span id="phase">-</span></p><ul id="agents"></ul>
<button id="stop">止める</button></section>
<section><h2>結果</h2><div id="result"></div></section>
<script>
const $ = (id) => document.getElementById(id);
$('start').onclick = () => fetch('/start', {method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({model: $('model').value, limit: Number($('limit').value)})});
$('stop').onclick = () => fetch('/stop', {method: 'POST'});
async function refresh() {
  const s = await (await fetch('/status')).json();
  $('start').disabled = s.started;
  $('phase').textContent = s.phase;
  $('agents').innerHTML = Object.entries(s.agents)
    .map(([a, st]) => `<li data-agent="${a}" data-state="${st}">${a}：${st}</li>`).join('');
  if (s.result) {
    $('result').textContent = `終わった理由：${s.result.reason}\\n使った設定：作業のモデル=${s.settings ? s.settings.model : '-'}、繰り返しの上限=${s.settings ? s.settings.limit : '-'}\\nまとめ：${s.result.summary || ''}`;
  }
}
setInterval(refresh, 500); refresh();
</script>"""


def record(kind, **data):
    state["events"].append({"t": round(time.time(), 3), "kind": kind, **data})


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send(self, code, body, content_type="application/json"):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", content_type + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            return json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            return None

    def do_GET(self):
        if self.path == "/":
            return self.send(200, PAGE, "text/html")
        if self.path == "/status":
            with lock:
                return self.send(200, json.dumps(state, ensure_ascii=False))
        if self.path.startswith("/wait-start"):
            timeout = float(self.path.partition("timeout=")[2] or 100)
            with lock:
                lock.wait_for(lambda: state["started"], timeout=timeout)
                if not state["started"]:
                    return self.send(408, json.dumps({"error": "まだ開始されていません"}, ensure_ascii=False))
                return self.send(200, json.dumps(state["settings"], ensure_ascii=False))
        self.send(404, "{}")

    def do_POST(self):
        data = self.body()
        if data is None:
            return self.send(400, json.dumps({"error": "JSON ではありません"}, ensure_ascii=False))
        with lock:
            if self.path == "/start":
                limit = data.get("limit")
                if data.get("model") not in ("haiku", "sonnet", "opus") or not isinstance(limit, int) or limit < 1:
                    return self.send(400, json.dumps({"error": "設定が正しくありません"}, ensure_ascii=False))
                state.update(started=True, settings={"model": data["model"], "limit": limit})
                state["agents"]["統括"] = "実行中"
                record("start", settings=state["settings"])
            elif self.path == "/event":
                if data.get("kind") == "phase":
                    state["phase"] = str(data.get("phase"))
                    record("phase", phase=state["phase"])
                elif data.get("kind") == "agent":
                    state["agents"][str(data.get("agent"))] = str(data.get("state"))
                    record("agent", agent=data.get("agent"), state=data.get("state"))
                else:
                    return self.send(400, json.dumps({"error": "kind が正しくありません"}, ensure_ascii=False))
            elif self.path == "/result":
                state["result"] = {"reason": str(data.get("reason", "")), "summary": str(data.get("summary", ""))}
                state["agents"] = {a: ("完了" if st != "停止" else st) for a, st in state["agents"].items()}
                record("result", **state["result"])
            elif self.path == "/stop":
                state["stopped"] = True
                state["agents"] = {a: "停止" for a in state["agents"]}
                if state["result"] is None:
                    state["result"] = {"reason": "ユーザーが止めた", "summary": ""}
                record("stop")
            else:
                return self.send(404, "{}")
            lock.notify_all()
        self.send(200, "{}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
