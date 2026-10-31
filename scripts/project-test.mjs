// v25 引导项目单元测试：参考流程能全部通过；常见错误能被检查出来；制作单包含必需章节、不含价格。
import fs from "node:fs";
import * as P from "../src/project/octoProject.js";
import { buildSheet, sheetMarkdown, sheetHtml } from "../src/project/buildSheet.js";
const idx = JSON.parse(fs.readFileSync("public/lib/index.json", "utf8"));
const dims = Object.fromEntries(idx.parts.map((r) => [r[0], r[4]]));
const fw = P.firmwarePins(fs.readFileSync("src/assembly/octopus/plus/octopus_plus/octopus_body.h", "utf8"), fs.readFileSync("src/assembly/octopus/plus/octopus_plus/octopus_batt.h", "utf8"));
const ctx = { dims, fw }; let fail = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fail++; console.log("FAIL", m); } else console.log("ok  ", m); };
const bad = (list) => list.filter((c) => !c.ok && c.level !== "warn").map((c) => c.zh);
ok(JSON.stringify(fw) === JSON.stringify({ servo: [18, 17, 9, 7, 6, 5, 16, 36], batt: 8 }), `固件引脚从源码解析 ${JSON.stringify(fw)}`);
let s = P.emptyState();
ok(P.progress(s, ctx).first === 0, "空状态停在第 1 步");
for (const st of P.STEPS) { s = P.autoStep(s, st.k); const c = P.stepChecks(s, ctx)[st.k]; ok(P.passed(c), `示范完成后 ${st.zh} 通过 ${bad(c).join("；")}`); }
ok(P.progress(s, ctx).all, "参考流程全部通过");
const req = P.bomRequired(); ok(req["ada-2201"] === 8 && req["ada-4654"] === 2 && req["p-octo-arm-v10"] === 8 && req["ada-5426"] === 1, `BOM 数量 ${JSON.stringify(req)}`);
ok(P.padsInUse(s).length >= 20, `焊点数 ${P.padsInUse(s).length}`);
const full = s;
// 故障 1：BOM 少一个舵机
{ const t = structuredClone(full); t.bom["ada-2201"] = 7; ok(!P.passed(P.checkBom(t)), "少一个舵机 → BOM 不通过"); }
// 故障 2：放错位置 + 重叠
{ const t = structuredClone(full); t.placed.BST1 = "BST2"; t.placed.BST2 = "BST2"; const c = P.checkAssemble(t, dims); ok(!P.passed(c) && c.some((x) => /重叠/.test(x.zh)) && c.some((x) => /位置/.test(x.zh)), `放错位置 → ${bad(c).join("；")}`); }
{ const t = structuredClone(full); t.order = ["FRAME", "QTPY", ...P.SLOTS.filter((x) => x !== "FRAME" && x !== "QTPY")]; ok(P.checkAssemble(t, dims).some((x) => /比电池先放/.test(x.zh)), "QT Py 比电池先放 → 提示"); }
ok(P.passed(P.checkAssemble(full, dims)), `参考摆放无重叠、不超出上层板`);
// 故障 3：少一根线
{ const t = structuredClone(full); t.wires = t.wires.filter((w) => !(w.a === "S3:PWM")); const c = P.checkWire(t); ok(!P.passed(c) && /S3|舵机 S3/.test(c[0].hint), `少 S3 PWM → ${c[0].hint}`); const r = P.checkSim(t, fw).checks; ok(r.some((x) => !x.ok && /固件里 S3/.test(x.zh)), "固件引脚检查发现 S3 没接通"); }
// 故障 4：PWM 接错焊盘（S0 → A2）
{ const t = structuredClone(full); const w = t.wires.find((w) => w.a === "S0:PWM"); w.b = "QTPY:A2"; const c = P.checkWire(t); ok(!P.passed(c), `S0 橙线接错到 A2 → 接线不通过 ${bad(c).join("；")}`); }
// 故障 5：BAT 和 GND 短路线
{ const t = structuredClone(full); t.wires.push({ a: "CHG:BAT", b: "CHG:GND" }); const c = P.checkWire(t); ok(c.some((x) => /短路/.test(x.zh)), "BAT–GND 跨接 → 短路警告"); ok(/导通（短路/.test(P.meterTable(t)[0].expect), "万用表表格第一行显示短路"); }
// 故障 6：虚焊 → 网表断开；补焊恢复
{ let t = structuredClone(full); t.batPlugged = false; t.joints["BST1:EN"] = { q: null, wear: 0 }; t = P.solderOp(t, "BST1:EN", { t: 0.8, flux: false }).state; ok(t.joints["BST1:EN"].q === "cold", "0.8 s 无助焊剂 → 虚焊"); t.batPlugged = true; const r = P.checkSim(t, fw); ok(r.checks.some((x) => !x.ok && /升压 1 输出/.test(x.zh)), `虚焊 EN → 升压 1 不工作 (${r.idle.rails.boost.BST1.v} V)`); t.batPlugged = false; t = P.solderOp(t, "BST1:EN", { t: 1.6 }).state; ok(t.joints["BST1:EN"].q === "good", "补焊 1.6 s → 合格"); }
// 故障 7：连锡 → 短路；助焊剂补焊拉开
{ let t = structuredClone(full); t.batPlugged = false; t.joints["BST2:IN"] = { q: null, wear: 0 }; t = P.solderOp(t, "BST2:IN", { t: 2.6, flux: false }).state; ok(t.joints["BST2:IN"].q === "bridge" && t.joints["BST2:IN"].to === "BST2:GND", `2.6 s 无助焊剂 → 连锡到 ${t.joints["BST2:IN"].to}`); t.batPlugged = true; const r = P.checkSim(t, fw); ok(r.checks.some((x) => !x.ok && /没有短路/.test(x.zh)), "连锡 → 网表短路"); t.batPlugged = false; t = P.solderOp(t, "BST2:IN", { t: 1, flux: true }).state; ok(t.joints["BST2:IN"].q === "good", "助焊剂补焊 → 拉开"); }
// 故障 8：插着电池焊 → 拒绝；拆焊过热 → 翘起；换新板
{ let t = structuredClone(full); t.batPlugged = true; const r = P.solderOp(t, "SW:COM", { t: 1 }); ok(!r.ok && /拔电池/.test(r.msg), "插着电池焊 → 拒绝"); t.batPlugged = false; t = P.solderOp(t, "SW:COM", { t: 5, desolder: true }).state; ok(t.joints["SW:COM"].q === "lifted", "拆焊 5 s → 焊盘翘起"); ok(!P.passed(P.checkSolder(t)), "翘起 → 焊接不通过"); t = P.replaceBoard(t, "SW"); t = P.solderOp(t, "SW:COM", { t: 1, flux: true }).state; ok(t.joints["SW:COM"].q === "good", "换新板后重焊合格"); }
{ let t = structuredClone(full); t.batPlugged = false; for (let i = 0; i < 3; i++) { t = P.solderOp(t, "DIV:IN", { t: 1, desolder: true }).state; t = P.solderOp(t, "DIV:IN", { t: 1, flux: true }).state; } ok(t.joints["DIV:IN"].wear === 3 && t.joints["DIV:IN"].q === "good", "返修 3 次还能焊"); t = P.solderOp(t, "DIV:IN", { t: 1, desolder: true }).state; ok(t.joints["DIV:IN"].q === "lifted", "第 4 次返修 → 翘起"); }
// 万用表表格
{ const m = P.meterTable(full); ok(m.length >= 10 && /OL/.test(m[0].expect) && m.some((r) => /5\.2 V/.test(r.expect)) && m.some((r) => /估算/.test(r.expect)), `万用表 ${m.length} 行`); }
// 制作单
{ const sh = buildSheet(full, idx.parts); const md = sheetMarkdown(sh), html = sheetHtml(sh);
  for (const k of ["零件清单", "接线表", "焊接顺序", "测试清单", "安全", "没有在实物上验证", "来源"]) ok(md.includes(k) && html.includes(k), `制作单含 “${k}”`);
  ok(!/[$¥￥]\s*\d|\d\s*(元|USD|美元)|price|价格：\s*\d/i.test(md), "制作单不含价格");
  ok(/我的补充/.test(md) && /估算/.test(md) && /MIT/.test(md), "含 我的补充 / 估算 / 许可证");
  ok(/A0（GPIO18）/.test(md) && /SCK（GPIO36）/.test(md), "接线表用真实引脚名 + GPIO");
  ok(/<style[^>]*>[\s\S]*@media print/.test(html), "HTML 有打印样式");
  const part = buildSheet(P.emptyState(), idx.parts); ok(/参考设计/.test(sheetMarkdown(part)), "未完成时注明按参考设计生成");
  fs.mkdirSync("/tmp/proj", { recursive: true }); fs.writeFileSync("/tmp/proj/sheet.md", md); fs.writeFileSync("/tmp/proj/sheet.html", html); }
console.log(`\nproject-test: ${n - fail}/${n} 通过`); process.exit(fail ? 1 : 0);
