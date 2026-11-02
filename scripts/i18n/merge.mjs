// v27：把机翻结果 + 零件原英文名合成 public/i18n/en-mt.json（运行时英文模式懒加载）
import fs from "node:fs";
const src = JSON.parse(fs.readFileSync(".tmp/i18n-src.json", "utf8"));
const dict = {};
// 第二版（mt2.py，已过质检）优先；null = 质检不合格，故意不翻
const v2 = fs.readdirSync(".tmp").filter((f) => /^i18n-v2-\d+\.json$/.test(f));
const files = v2.length ? v2 : fs.readdirSync(".tmp").filter((f) => /^i18n-mt-\d+\.json$/.test(f));
let rejected = 0;
const CJK = /[\u3400-\u9fff\uf900-\ufaff]/, BAD = /session|discriminat|palestin|israel|occupied|assembly of|security council|secretar|committee|paragraph|rapporteur|delegation|united nations|human rights|punisher|instalment|amendment|government|republic|terroris|refugee|agenda|annex|♪|(.)\1{4,}/i;
for (const f of files) for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(".tmp/" + f, "utf8")))) {
  if (v == null || CJK.test(v) || BAD.test(v)) { rejected++; continue; } // 最后一道闸：含汉字或幻觉词的一律不要
  dict[k] = v;
}
let mtN = Object.keys(dict).length;
for (const [k, v] of Object.entries(src.exact)) dict[k] = v; // 零件名用原英文名，不机翻
// 只保留现在源码里还存在的片段
const keep = new Set([...src.whole, ...src.runs, ...src.subs, ...Object.keys(src.exact)]);
for (const k of Object.keys(dict)) if (!keep.has(k)) delete dict[k];
const need = [...src.whole, ...src.runs, ...src.subs].filter((k) => !(k in dict));
const meta = { engine: "Argos Translate 1.9（离线），模型 translate-zh_en 1.9", note: "machine-assisted translation; part names use the original English names from the source libraries", generated: new Date().toISOString(), entries: Object.keys(dict).length, machine: mtN, exact: Object.keys(src.exact).length, untranslated: need.length, rejected_by_qc: rejected, qc: "译文不得含汉字；原文的型号 / 数字必须原样保留；不得出现原文没有的数字；黑名单幻觉词；不合格的宁可保留中文" };
fs.mkdirSync("public/i18n", { recursive: true });
fs.writeFileSync("public/i18n/en-mt.json", JSON.stringify({ meta, dict }));
console.log(JSON.stringify(meta), (fs.statSync("public/i18n/en-mt.json").size / 1024).toFixed(0) + " KB");
