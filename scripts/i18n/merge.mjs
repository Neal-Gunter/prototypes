// v27：把机翻结果 + 零件原英文名合成 public/i18n/en-mt.json（运行时英文模式懒加载）
import fs from "node:fs";
const src = JSON.parse(fs.readFileSync(".tmp/i18n-src.json", "utf8"));
const dict = {};
for (const f of fs.readdirSync(".tmp").filter((f) => /^i18n-mt-\d+\.json$/.test(f))) Object.assign(dict, JSON.parse(fs.readFileSync(".tmp/" + f, "utf8")));
let mtN = Object.keys(dict).length;
for (const [k, v] of Object.entries(src.exact)) dict[k] = v; // 零件名用原英文名，不机翻
// 只保留现在源码里还存在的片段
const keep = new Set([...src.whole, ...src.runs, ...src.subs, ...Object.keys(src.exact)]);
for (const k of Object.keys(dict)) if (!keep.has(k)) delete dict[k];
const need = [...src.whole, ...src.runs, ...src.subs].filter((k) => !(k in dict));
const meta = { engine: "Argos Translate 1.9（离线），模型 translate-zh_en 1.9", note: "machine-assisted translation; part names use the original English names from the source libraries", generated: new Date().toISOString(), entries: Object.keys(dict).length, machine: mtN, exact: Object.keys(src.exact).length, untranslated: need.length };
fs.mkdirSync("public/i18n", { recursive: true });
fs.writeFileSync("public/i18n/en-mt.json", JSON.stringify({ meta, dict }));
console.log(JSON.stringify(meta), (fs.statSync("public/i18n/en-mt.json").size / 1024).toFixed(0) + " KB");
