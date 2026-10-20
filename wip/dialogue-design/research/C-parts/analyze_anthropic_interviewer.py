"""Anthropic/AnthropicInterviewer の書き起こし 1,250 件を集計する。

入力: papers/hf/*.json（HF datasets-server の rows API の応答。取得手順は報告書に記載）
実行: python3 -I analyze_anthropic_interviewer.py <hf-json-dir>
注意: 正規表現による粗い集計であり、誤分類を含む。
"""
import collections
import glob
import json
import re
import statistics as st
import sys

d = sys.argv[1]
rows = []
for f in sorted(glob.glob(d + "/*.json")):
    for r in json.load(open(f))["rows"]:
        rows.append((f.split("/")[-1].split("_")[0], r["row"]["transcript_id"], r["row"]["text"]))


def turns(t):
    parts = re.split(r"\n\n(?=(?:Assistant|AI|User):)", t)
    out = []
    for p in parts:
        m = re.match(r"(Assistant|AI|User):\s*(.*)", p, flags=re.S)
        if m:
            out.append((m.group(1), m.group(2)))
    return out


n = len(rows)
print("transcripts", n, dict(collections.Counter(s for s, _, _ in rows)))

# 1. interviewer message counts (including opening and closing)
cnt = [len([1 for r, _ in turns(t) if r in ("Assistant", "AI")]) for _, _, t in rows]
print("interviewer messages per transcript: mean %.1f median %s min %s max %s" % (st.mean(cnt), st.median(cnt), min(cnt), max(cnt)))

# 2. opening message features
op = collections.Counter()
for _, _, t in rows:
    first = [x for r, x in turns(t) if r in ("Assistant", "AI")][0].lower()
    op["states_minutes"] += bool(re.search(r"\b\d+(-\d+)? minutes", first))
    op["no_right_or_wrong"] += "no right or wrong" in first
    op["notes"] += "notes" in first
    op["anonymity"] += bool(re.search(r"(anonym|attributed|confidential)", first))
print("opening:", {k: round(v / n, 3) for k, v in op.items()})

# 3. middle interviewer messages (exclude opening and closing)
mid = []
for _, _, t in rows:
    ai = [x for r, x in turns(t) if r in ("Assistant", "AI")]
    mid += ai[1:-1]
m = len(mid)
dist = collections.Counter(min(a.count("?"), 3) for a in mid)
print("middle messages", m, "question-mark count distribution", {k: round(v / m, 3) for k, v in sorted(dist.items())})
praise = re.compile(r"^(that's|that is|what a|wow|great|fascinating|interesting|i love|that sounds)\b[^.!?\n]{0,60}\b(interesting|fascinating|great|helpful|valuable|insightful|honest|thoughtful|powerful|wonderful|excellent|compelling|smart|clever|impressive|good|really)\b", re.I)
print("start with evaluative remark: %.3f" % (sum(1 for a in mid if praise.search(a.strip())) / m))
print("contain restating phrase: %.3f" % (sum(1 for a in mid if re.search(r"(so you|you're essentially|it sounds like|sounds like you|so it sounds|so that means|you mentioned)", a, re.I)) / m))

# 4. closing
anyelse = sum(1 for _, _, t in rows if re.search(r"anything else|anything we haven|anything i haven", " ".join([x for r, x in turns(t) if r in ("Assistant", "AI")][-2:]).lower()))
print("final 'anything else' check: %.3f" % (anyelse / n))

# 5. user answer length by position (exclude the reply to consent and the reply to the final check)
bypos = collections.defaultdict(list)
q = collections.defaultdict(list)
for _, _, t in rows:
    us = [x for r, x in turns(t) if r == "User"][1:-1]
    k = len(us)
    for i, u in enumerate(us, start=1):
        w = len(u.split())
        bypos[i].append(w)
        q[min(int((i - 1) / k * 4), 3)].append(w)
print("user answer words by position (n>=50): position n mean median")
for i in sorted(bypos):
    if len(bypos[i]) >= 50:
        print(" ", i, len(bypos[i]), round(st.mean(bypos[i]), 1), st.median(bypos[i]))
print("quartile of interview mean words:", {b: round(st.mean(v), 1) for b, v in sorted(q.items())})
