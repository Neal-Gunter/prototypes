// v20 零件数据校验：node scripts/parts-validate.mjs（OUT=目录 时写 parts-validate.json）
//   每个零件：必填字段、id 唯一、许可证在白名单、尺寸 > 0、GLB / 缩略图文件存在（真实 CAD）、来源链接、
//   碰撞盒全部落在零件包围盒内（允许 0.3 mm + 2% 误差）、碰撞盒总体积不超过包围盒体积的 1.05 倍（防止默认碰撞盒互相重叠堆出“实心块”），
//   LICENSES.md 和署名页（CreditsPage.jsx）里每个来源都有署名条目。
import fs from "node:fs";
import path from "node:path";
import { PROCEDURAL } from "../src/assembly/procedural.js";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const LIB = path.join(ROOT, "public/lib");
const OK_LIC = new Set(["MIT", "CC0", "CC-BY-3.0", "CC-BY-4.0", "CC-BY-SA-4.0", "Apache-2.0", "本项目自制（程序生成，CC0）"]);
let pass = 0, fail = 0; const bad = []; const results = [];
const ok = (name, c, info = "") => { results.push({ name, ok: !!c, info: String(info) }); if (c) pass++; else fail++; console.log(c ? "✓" : "✗", name, info ? "— " + info : ""); };
const index = JSON.parse(fs.readFileSync(path.join(LIB, "index.json"), "utf8"));
const real = [];
for (const c of index.cats) { const f = path.join(LIB, "catalog", c.key + ".json"); if (fs.existsSync(f)) real.push(...JSON.parse(fs.readFileSync(f, "utf8"))); }
const all = [...real.map((e) => ({ ...e, _real: true })), ...PROCEDURAL.map((e) => ({ ...e, _real: false }))];
const err = (e, why) => { bad.push({ id: e.id, why }); };
const ids = new Map();
for (const e of all) ids.set(e.id, (ids.get(e.id) || 0) + 1);
const dup = [...ids].filter(([, n]) => n > 1);
ok("id 全部唯一", dup.length === 0, dup.slice(0, 5).map((d) => d[0]).join(", "));
ok("index.json 条数 = 分类文件里的真实零件条数", index.total === real.length && index.parts.length === real.length, `${index.total} / ${real.length}`);
const warnOver = []; let nColl = 0, nOutside = 0, nOver = 0, nMiss = 0, nLic = 0, nDim = 0, nUrl = 0, nField = 0;
for (const e of all) {
  if (!e.id || !e.cat || !(e.name_zh || e.name)) { nField++; err(e, "缺必填字段"); }
  const lic = e._real ? String(e.licence).split("（")[0] : "本项目自制（程序生成，CC0）";
  if (!OK_LIC.has(lic)) { nLic++; err(e, "许可证不在白名单：" + lic); }
  const d = e.dims_mm;
  if (!d || !(d.x > 0 && d.y > 0 && d.z > 0)) { nDim++; err(e, "尺寸缺失或 ≤ 0"); continue; }
  if (e._real) {
    if (!e.url || !/^https:\/\//.test(e.url) || !e.author || !e.source) { nUrl++; err(e, "缺来源链接 / 作者 / 来源名"); }
    for (const k of ["glb", "thumb"]) if (!e[k] || !fs.existsSync(path.join(ROOT, "public", e[k]))) { nMiss++; err(e, "文件不存在：" + k + " " + e[k]); }
  }
  const cs = e.colliders || [];
  if (!cs.length) { nColl++; err(e, "没有碰撞盒"); continue; }
  // 包围盒（cm）：所有碰撞盒的外包络
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; let vol = 0;
  for (const c of cs) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], c.c[i] - c.h[i]); hi[i] = Math.max(hi[i], c.c[i] + c.h[i]); }
  for (const c of cs) vol += 8 * c.h[0] * c.h[1] * c.h[2];
  const span = [0, 1, 2].map((i) => hi[i] - lo[i]).sort((a, b) => a - b), dm = [d.x, d.y, d.z].map((v) => v / 10).sort((a, b) => a - b);
  if (span.some((s, i) => s > dm[i] * 1.02 + 0.03)) { nOutside++; err(e, `碰撞盒超出包围盒：${span.map((v) => (v * 10).toFixed(1)).join("×")} mm vs ${dm.map((v) => (v * 10).toFixed(1)).join("×")} mm`); }
  const bv = dm[0] * dm[1] * dm[2];
  if (vol > bv * 1.05 + 1e-4 && cs.length > 1) { if (e._real) { warnOver.push(e.id); continue; } nOver++; err(e, `碰撞盒体积和 ${(vol * 1000).toFixed(0)} mm³ > 包围盒 ${(bv * 1000).toFixed(0)} mm³（有重叠）`); }
}
ok("必填字段齐全", nField === 0, nField);
ok("许可证都在白名单（MIT / CC0 / CC BY / CC BY-SA / Apache）", nLic === 0, nLic);
ok("尺寸都 > 0", nDim === 0, nDim);
ok("真实 CAD 都有来源链接、作者、来源名", nUrl === 0, nUrl);
ok("真实 CAD 的 GLB 和缩略图文件都存在", nMiss === 0, nMiss);
ok("每个零件都有碰撞盒", nColl === 0, nColl);
ok("碰撞盒都在包围盒内（0.3 mm + 2% 容差）", nOutside === 0, nOutside + (nOutside ? "：" + bad.filter((b) => /超出/.test(b.why)).slice(0, 3).map((b) => b.id + " " + b.why).join("；") : ""));
ok("程序生成零件的默认碰撞盒不重叠（体积和 ≤ 包围盒 × 1.05）", nOver === 0, nOver + (nOver ? "：" + bad.filter((b) => /重叠/.test(b.why)).slice(0, 3).map((b) => b.id + " " + b.why).join("；") : ""));
console.log(`  提示：${warnOver.length} 个真实 CAD 的自动碰撞盒（同一刚体的复合盒）内部有重叠，不影响和别的零件碰撞：${warnOver.join(", ")}`);
// 署名：每个来源在 LICENSES.md 和 CreditsPage 都要出现
const licMd = fs.readFileSync(path.join(ROOT, "LICENSES.md"), "utf8");
const credits = fs.readFileSync(path.join(ROOT, "src/pages/CreditsPage.jsx"), "utf8");
const srcs = [...new Set(real.map((e) => e.source))];
for (const s of srcs) {
  const n = real.filter((e) => e.source === s).length, lics = [...new Set(real.filter((e) => e.source === s).map((e) => e.licence))];
  ok(`署名：${s}（${n} 个，${lics.join("/")}）在 LICENSES.md 和署名页都有`, licMd.includes(s) && credits.includes(s) && lics.every((l) => { const b = l.split("（")[0]; return licMd.includes(b) || licMd.includes(b.replace(/^CC-BY-SA-/, "CC BY-SA ").replace(/^CC-BY-/, "CC BY ")); }));
}
// 统计
// 统计只算零件库里能浏览 / 放置的（两件手工具 notPlaceable 只在装配动画里用，仍参与上面的校验）
const shown = all.filter((e) => !e.notPlaceable), procShown = shown.length - real.length;
const byCat = {}, bySrc = {};
for (const e of shown) { byCat[e.cat] = (byCat[e.cat] || 0) + 1; const s = e._real ? e.source : "程序生成（CC0）"; bySrc[s] = (bySrc[s] || 0) + 1; }
console.log("\n分类：", JSON.stringify(byCat)); console.log("来源：", JSON.stringify(bySrc));
console.log(`\n零件库 ${shown.length}（真实 CAD ${real.length} + 程序生成 ${procShown}；另有 ${all.length - shown.length} 件只用于动画的工具）· ${pass} 通过 / ${fail} 失败`);
if (process.env.OUT) { fs.mkdirSync(process.env.OUT, { recursive: true }); fs.writeFileSync(path.join(process.env.OUT, "parts-validate.json"), JSON.stringify({ pass, fail, warnOver, total: shown.length, real: real.length, proc: procShown, checked: all.length, byCat, bySrc, results, bad: bad.slice(0, 500) }, null, 1)); }
process.exit(fail ? 1 : 0);
