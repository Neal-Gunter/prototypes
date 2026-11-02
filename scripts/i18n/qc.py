# v27：机翻质检 + 重译。模型（OPUS-MT 派生）经常“幻觉”出联合国文件腔、乱码汉字、丢掉型号数字。
# 规则：译文不许含汉字；原文里的每个英文 / 数字记号（型号、单位、数值）都必须原样出现在译文里；译文里不许出现原文没有的数字；
#       不许出现黑名单里的幻觉词；不许有连续 5 个相同字符。不合格的：①不做术语预替换再译一次 ②按中文标点拆句逐句译；还不合格就丢掉
#       （运行时退回更短的片段或保留中文——宁可不翻，不要乱翻）。
# 用法：mtenv/bin/python scripts/i18n/qc.py  → .tmp/i18n-mt-fix.json（key → 译文 或 null）
import json, re, os, sys, time, glob
sys.argv = [sys.argv[0], ".tmp/i18n-src.json", "/dev/null"]
HERE = os.path.dirname(__file__)
CJK = re.compile(r"[\u3400-\u9fff\uf900-\ufaff]")
BAD = re.compile(r"session|discriminat|palestin|israel|occupied|general assembly|security council|secretar|committee|subparagraph|paragraph|rapporteur|delegation|member state|united nations|human rights|punisher|honduras|demobili|mobili[sz]|instalment|amendment|remarks|discontinue|convention|government|republic|terroris|kosovo|iraq|afghan|sudan|darfur|congo|somalia|refugee|peacekeep|agenda|annex|thirde|♪|\bUN\b|\bUNDP\b|resolution \d|decision \d|chapter [ivx]+\b|article \d|ibid|para\.", re.I)
TOK = re.compile(r"[A-Za-z0-9][A-Za-z0-9.+\-_/×]*[A-Za-z0-9]|[A-Za-z0-9]")
NUM = re.compile(r"\d+(?:\.\d+)?")
def ok(s, t):
    if not t or CJK.search(t) or BAD.search(t) or re.search(r"(.)\1{4,}", t): return False
    tl = t.lower().replace(" ", "")
    for k in TOK.findall(s):
        if k.lower().replace(" ", "") not in tl: return False
    sn = set(NUM.findall(s)); cn = re.search(r"[一二三四五六七八九十两百千万]", s)
    for n in NUM.findall(t):
        if n not in sn and not cn: return False
    if len(t) > 5 * len(s) + 40: return False
    return True
if __name__ == "__main__":
    src = json.load(open(".tmp/i18n-src.json"))
    D = {}
    for f in sorted(glob.glob(".tmp/i18n-mt-[0-9]*.json")): D.update(json.load(open(f)))
    keys = [k for k in src["whole"] + src["runs"] + src["subs"] if k in D]
    badk = [k for k in keys if not ok(k, D[k])]
    print("checked", len(keys), "failed", len(badk), flush=True)
    if os.environ.get("COUNT"): sys.exit(0)
    import argostranslate.translate as T
    G = json.load(open(os.path.join(HERE, "glossary.json"))); PRE = sorted(G["pre"].items(), key=lambda kv: -len(kv[0])); POST = G["post"]
    def pre(s):
        for k, v in PRE: s = s.replace(k, " " + v + " ")
        return re.sub(r"\s+", " ", s).strip()
    def post(s):
        for a, b in POST: s = re.sub(a, b, s)
        return s
    L = {l.code: l for l in T.get_installed_languages()}; tr = L["zh"].get_translation(L["en"])
    cache = {}
    def mt(x):
        if x not in cache: cache[x] = post(tr.translate(x)) if CJK.search(x) else x
        return cache[x]
    PUN = {"，": ", ", "。": ". ", "；": "; ", "：": ": ", "、": ", ", "！": "! ", "？": "? ", "（": " (", "）": ") ", "“": " \"", "”": "\" ", "‘": "'", "’": "'", "《": "", "》": ""}
    fix = {}; t0 = time.time(); nfix = 0
    for i, s in enumerate(badk):
        got = None
        for cand in (lambda: mt(s), lambda: mt(pre(s)) if pre(s) != s else None):
            c = cand()
            if c and ok(s, c): got = c; break
        if not got:
            parts = re.split(r"([，。；：、！？（）“”‘’《》])", s); out = []
            for p in parts:
                if p in PUN: out.append(PUN[p]); continue
                if not p.strip(): out.append(p); continue
                if not CJK.search(p): out.append(p); continue
                c = next((c for c in (mt(p), mt(pre(p))) if ok(p, c)), None)
                if c is None: out = None; break
                out.append(c)
            if out is not None:
                c = re.sub(r"\s+", " ", "".join(out)).strip(); c = re.sub(r"\s+([,.;:!?)])", r"\1", c)
                if ok(s, c): got = c
        fix[s] = got; nfix += got is not None
        if i % 100 == 0: print(f"{i}/{len(badk)} fixed {nfix} {time.time()-t0:.0f}s", flush=True); json.dump(fix, open(".tmp/i18n-fix.json", "w"), ensure_ascii=False)
    json.dump(fix, open(".tmp/i18n-fix.json", "w"), ensure_ascii=False)
    print("QCDONE failed", len(badk), "fixed", nfix, "dropped", len(badk) - nfix, flush=True)
