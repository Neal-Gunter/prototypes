// v21：FreeCAD-library（https://github.com/FreeCAD/FreeCAD-library，README：全部零件 CC BY 3.0，归属各自作者，作者见提交记录）
// 选件清单 scripts/lib/freecad-sel.json，作者 scripts/lib/freecad-authors.json（从 git 提交记录追溯，含改名前的路径）。
import fs from "node:fs";
import path from "node:path";
export const FC_HEAD = "f5ca01cdcaa2f69b9295a6382719c2d90628780c";
// STEP 读不出来的，不收（如实记录）
export const FC_SKIP = { "fc-lm8suu": "STEP 读取失败", "fc-t8-leadscrew-150": "STEP 转换异常" };
// 真实件 → 被替换的程序生成近似件（只在品类和主要尺寸对得上时才映射；尺寸见 meta 的 CAD 包围盒）
export const FC_REPLACES = {
  "fc-servo-sg90": "p-servo-micro", "fc-servo-futaba3003": "p-servo-standard", "fc-servo-sg90-horn1": "p-servo-horn",
  "fc-dc-tt-straight": "p-dc-tt", "fc-dc-n20-pololu": "p-motor-n20", "fc-dc-cqrobot-37d": "p-dc-37gb520",
  "fc-step-28byj48": "p-motor-28byj48", "fc-nema17-40": "p-motor-nema17-40", "fc-nema17-47": "p-motor-nema17-48", "fc-nema23-conn": "p-nema23-56",
  "fc-bearing-608zz": "p-bearing-608", "fc-bearing-623zz": "p-bearing-623", "fc-bearing-624zz": "p-bearing-624", "fc-bearing-6201": "p-bearing-6201",
  "fc-lm8uu": "p-lm8uu", "fc-lm10uu": "p-lm10uu", "fc-lm12uu": "p-lm12uu", "fc-corner-2020": "p-corner-2020",
  "fc-tnut-2020-m4": "p-tnut-6-M4", "fc-tnut-2020-m5": "p-tnut-6-M5", "fc-gt2-16t": "p-gt2-16t-5mm",
};
// 型材长度变体：截面取真实 STEP，只沿长度方向缩放（scripts/make-extrusion-variants.mjs 生成 GLB/meta）
export const EXT_BASES = {
  2020: ["fc-ext-2020b", "2020 B 型 6 槽铝型材"], 2040: ["fc-ext-2040b", "2040 B 型 6 槽铝型材"], 3030: ["fc-ext-3030b", "3030 B 型 8 槽铝型材"],
  3060: ["fc-ext-3060b", "3060 B 型 8 槽铝型材"], 4040: ["fc-ext-4040i", "4040 I 型 8 槽铝型材"], 4080: ["fc-ext-4080i", "4080 I 型 8 槽铝型材"],
};
export const EXT_LENGTHS = [50, 100, 150, 200, 250, 300, 400, 500, 600, 1000];

export function freecadEntries(LIB) {
  const sf = new URL("./freecad-sel.json", import.meta.url);
  if (!fs.existsSync(sf)) return [];
  const sel = JSON.parse(fs.readFileSync(sf, "utf8"));
  const au = Object.fromEntries(JSON.parse(fs.readFileSync(new URL("./freecad-authors.json", import.meta.url), "utf8")).map((a) => [a.id, a]));
  const out = [];
  for (const [id, p, name, name_zh, cat] of sel) {
    if (FC_SKIP[id] || !fs.existsSync(path.join(LIB, "freecad", p))) continue;
    const a = au[id] || {};
    out.push({ id, src: `freecad/${p}`, name, name_zh, cat, source: "FreeCAD-library", licence: "CC-BY-3.0",
      author: `${(a.authors || ["FreeCAD-library 贡献者"]).join("、")}（据 FreeCAD-library git 提交记录）`, first_commit: a.first,
      url: `https://github.com/FreeCAD/FreeCAD-library/blob/${FC_HEAD}/${p.split("/").map(encodeURIComponent).join("/")}`, replaces: FC_REPLACES[id] });
  }
  for (const [prof, [base, zh]] of Object.entries(EXT_BASES)) {
    const be = out.find((e) => e.id === base);
    if (!be) continue;
    for (const L of EXT_LENGTHS) {
      const id = `${base}-l${L}`;
      if (!fs.existsSync(path.join(LIB, "meta", id + ".json"))) continue;
      out.push({ ...be, id, name: `${be.name} ${L} mm`, name_zh: `${zh} ${L} mm`, derived_from: base, replaces: `p-ext-${prof}-${L}` });
    }
  }
  return out;
}
