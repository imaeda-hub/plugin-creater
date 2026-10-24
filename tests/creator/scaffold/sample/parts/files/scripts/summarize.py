#!/usr/bin/env python3
"""記録のファイルを、「今週やったこと」と「来週やること」に分ける（見本）。"""
import sys


def split_sections(text):
    done, todo = [], []
    for line in text.splitlines():
        if line.startswith("来週"):
            todo.append(line)
        elif line.strip():
            done.append(line)
    return {"今週やったこと": done, "来週やること": todo}


if __name__ == "__main__":
    print(split_sections(sys.stdin.read()))
