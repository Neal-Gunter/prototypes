# v27 第二版机翻：先直译原文；不合格（见 qc.py 的 ok()）再试术语预替换；再按中文标点拆句；都不合格记 null（运行时保留中文）。
# 用法：SHARD=0/2 mtenv/bin/python scripts/i18n/mt2.py   → .tmp/i18n-v2-0.json（可断点续跑）
import json, re, os, sys, time, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("qc", os.path.join(HERE, "qc.py")); qc = importlib.util.module_from_spec(spec); spec.loader.exec_module(qc)
ok, CJK = qc.ok, qc.CJK
import argostranslate.translate as T
G = json.load(open(os.path.join(HERE, "glossary.json"))); PRE = sorted(G["pre"].items(), key=lambda kv: -len(kv[0])); POST = G["post"]
def pre(s):
    for k, v in PRE: s = s.replace(k, " " + v + " ")
    return re.sub(r"\s+", " ", s).strip()
def post(s):
    for a, b in POST: s = re.sub(a, b, s)
    return s
L = {l.code: l for l in T.get_installed_languages()}; tr = L["zh"].get_translation(L["en"])
def mt(x): return post(tr.translate(x)) if CJK.search(x) else x
PUN = {"，": ", ", "。": ". ", "；": "; ", "：": ": ", "、": ", ", "！": "! ", "？": "? ", "（": " (", "）": ") ", "“": " \"", "”": "\" ", "‘": "'", "’": "'", "《": "", "》": "", "…": "…"}
def one(s):
    c = mt(s)
    if ok(s, c): return c
    p = pre(s)
    if p != s:
        c = mt(p) if CJK.search(p) else post(p)
        if ok(s, c): return c
    parts = re.split(r"([，。；：、！？（）“”‘’《》…])", s)
    if len(parts) < 3: return None
    out = []
    for q in parts:
        if q in PUN: out.append(PUN[q]); continue
        if not CJK.search(q): out.append(q); continue
        c = mt(q)
        if not ok(q, c):
            pq = pre(q); c = mt(pq) if CJK.search(pq) else post(pq)
            if not ok(q, c): return None
        out.append(c)
    c = re.sub(r"\s+", " ", "".join(out)).strip(); c = re.sub(r"\s+([,.;:!?)])", r"\1", c)
    return c if ok(s, c) else None
src = json.load(open(".tmp/i18n-src.json"))
a, n = map(int, os.environ.get("SHARD", "0/1").split("/"))
outp = f".tmp/i18n-v2-{a}.json"
done = json.load(open(outp)) if os.path.exists(outp) else {}
items = [x for x in dict.fromkeys(src["whole"] + src["runs"] + src["subs"])][a::n]
items = [x for x in items if x not in done]
t0 = time.time()
for i, s in enumerate(items):
    try: done[s] = one(s)
    except Exception as e: print("ERR", e, file=sys.stderr); done[s] = None
    if i % 250 == 0:
        json.dump(done, open(outp, "w"), ensure_ascii=False); print(f"{i}/{len(items)} {time.time()-t0:.0f}s", flush=True)
json.dump(done, open(outp, "w"), ensure_ascii=False)
print("MTDONE", len(done), "null", sum(v is None for v in done.values()), flush=True)
