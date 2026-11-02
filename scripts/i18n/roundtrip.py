# v30（我的补充）：中→英→中 往返检查。把英文译文再用离线 Argos（translate-en_zh）译回中文，
# 和原文比“字二元组”相似度（Dice）。分数低 = 英文可能丢了意思或译歪了（也可能只是回译模型换了说法，要人看）。
# 用法：mtenv/bin/python scripts/i18n/roundtrip.py in.json out.json   in = [[zh, en], ...]
import json, sys, re
import argostranslate.translate as T
rows = json.load(open(sys.argv[1]))
L = {l.code: l for l in T.get_installed_languages()}
tr = L["en"].get_translation(L["zh"])
def grams(s):
    s = re.sub(r"[\s\W_]+", "", s.lower())
    return [s[i:i + 2] for i in range(len(s) - 1)] or [s]
def dice(a, b):
    A, B = grams(a), grams(b)
    from collections import Counter
    ca, cb = Counter(A), Counter(B)
    inter = sum((ca & cb).values())
    return 2 * inter / (len(A) + len(B)) if A and B else 0.0
out = []
for zh, en in rows:
    back = tr.translate(en)
    out.append({"zh": zh, "en": en, "back": back, "sim": round(dice(zh, back), 3)})
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=0)
