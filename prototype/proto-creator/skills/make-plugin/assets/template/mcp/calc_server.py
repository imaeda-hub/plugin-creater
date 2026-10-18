#!/usr/bin/env python3
"""Minimal MCP server over stdio: converts yen to 万円 (amounts under 10,000 yen are dropped)."""
import json
import sys

TOOLS = [{
    "name": "yen_to_man",
    "description": "円の金額を万円の単位に直す。1万円未満は切り捨てる。",
    "inputSchema": {
        "type": "object",
        "properties": {"amount": {"type": "integer", "minimum": 0, "description": "円の金額"}},
        "required": ["amount"],
    },
}]


def call_tool(name, args):
    if name != "yen_to_man":
        return {"content": [{"type": "text", "text": f"unknown tool: {name}"}], "isError": True}
    amount = args.get("amount")
    if isinstance(amount, bool) or not isinstance(amount, int) or amount < 0:
        return {"content": [{"type": "text", "text": "amount は 0 以上の整数で指定してください"}], "isError": True}
    return {"content": [{"type": "text", "text": f"{amount // 10000}万円"}]}


def reply(msg_id, result=None, error=None):
    message = {"jsonrpc": "2.0", "id": msg_id}
    if error is None:
        message["result"] = result
    else:
        message["error"] = error
    sys.stdout.write(json.dumps(message, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            reply(None, error={"code": -32700, "message": "parse error"})
            continue
        if "id" not in msg:
            continue  # notifications need no reply
        method, msg_id, params = msg.get("method"), msg["id"], msg.get("params") or {}
        if method == "initialize":
            reply(msg_id, {
                "protocolVersion": params.get("protocolVersion", "2025-06-18"),
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "calc", "version": "0.1.0"},
            })
        elif method == "tools/list":
            reply(msg_id, {"tools": TOOLS})
        elif method == "tools/call":
            reply(msg_id, call_tool(params.get("name"), params.get("arguments") or {}))
        elif method == "ping":
            reply(msg_id, {})
        else:
            reply(msg_id, error={"code": -32601, "message": f"method not found: {method}"})


if __name__ == "__main__":
    main()
