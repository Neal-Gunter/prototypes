# v27：离线机翻（Argos Translate zh→en，模型 translate-zh_en 1.9）。不联网、不收费。
# 用法：mtenv/bin/python scripts/i18n/mt.py .tmp/i18n-src.json .tmp/i18n-mt.json
import json, sys, re, os, time
import argostranslate.translate as T
src = json.load(open(sys.argv[1])); outp = sys.argv[2]
done = json.load(open(outp)) if os.path.exists(outp) else {}
# 术语表：先把专业词换成英文再送进模型（模型会原样保留英文），译完再修常见误译
GLOSS = json.load(open(os.path.join(os.path.dirname(__file__), "glossary.json")))
PRE = sorted(GLOSS["pre"].items(), key=lambda kv: -len(kv[0]))
POST = GLOSS["post"]
def pre(s):
    for k, v in PRE: s = s.replace(k, " " + v + " ")
    return re.sub(r"\s+", " ", s).strip()
def post(s):
    for a, b in POST: s = re.sub(a, b, s)
    return s
items = [x for x in src["whole"] + src["runs"] + src["subs"] if x not in done]
sh = os.environ.get("SHARD")
if sh: a, n = map(int, sh.split("/")); items = items[a::n]
lang_from = [l for l in T.get_installed_languages() if l.code == "zh"][0]
lang_to = [l for l in T.get_installed_languages() if l.code == "en"][0]
tr = lang_from.get_translation(lang_to)
t0 = time.time()
for i, s in enumerate(items):
    p = pre(s)
    if not re.search(r"[\u4e00-\u9fff]", p): done[s] = post(p); continue
    try: done[s] = post(tr.translate(p))
    except Exception as e: print("ERR", s, e, file=sys.stderr)
    if i % 200 == 0:
        json.dump(done, open(outp, "w"), ensure_ascii=False)
        print(f"{i}/{len(items)} {time.time()-t0:.0f}s", flush=True)
json.dump(done, open(outp, "w"), ensure_ascii=False)
print("MTDONE", len(done), flush=True)
