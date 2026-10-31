// v26 实测对比单元测试：没填 = 仅估算；容差内 = 验证；容差外 = 有偏差；校准建议按实测反推；
// 用户校准可应用 / 撤销，撤销后和 v25 默认结果完全一样；导出 / 导入往返；示例数据处处标明；制作单含 4b 节。
import * as P from "../src/project/octoProject.js";
import * as Mz from "../src/project/measure.js";
import { evaluateV10, v10PathR } from "../src/assembly/octopus/circuit.js";
import { buildSheet, sheetMarkdown, sheetHtml } from "../src/project/buildSheet.js";
let fail = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fail++; console.log("FAIL", m); } else console.log("ok  ", m); };
let s = ["bom", "assemble", "wire", "solder"].reduce((a, k) => P.autoStep(a, k), P.emptyState());
const base = s;
// 默认不变
const b = P.userBench(s, { batPlugged: true, swOn: true });
ok(JSON.stringify(evaluateV10(b, { servoI: 0.8 }).rails) === JSON.stringify(evaluateV10(b, { servoI: 0.8, cal: {} }).rails), "空校准 = v25 默认结果");
ok(Math.abs(v10PathR(3.85, { rWire: 0.03 }).total - 0.15) < 1e-9 && v10PathR(3.4).total === 0.3, "内阻拆成三段，默认之和 0.15 / 0.3 Ω 不变");
ok(P.calOf(s) === undefined, "没有 measure → calOf undefined");
let r = Mz.measureReport(s);
ok(r.counts.est === r.counts.n && r.counts.n >= 14, `没填实测：${r.counts.n} 项全是仅估算`);
ok(Object.values(r.steps).every((x) => x.status === "est"), "每一步都是仅估算");
ok(!r.suggestions.length, "没偏差就没建议");
// 解析
ok(Mz.parseReading("OL") === Infinity && Mz.parseReading("3,92") === 3.92 && Mz.parseReading("5.2 V") === 5.2 && Number.isNaN(Mz.parseReading("abc")) && Mz.parseReading("") === null, "读数解析：OL / 逗号 / 单位 / 读不懂 / 空");
// 单项对比
const item = r.rows.find((x) => x.id === "v-bst1-on");
ok(Mz.compare(item, { raw: "5.25" }).status === "ok" && Mz.compare(item, { raw: "4.9" }).status === "dev", "升压 5.25 V 验证、4.9 V 有偏差");
const open = r.rows.find((x) => x.id === "c-bat-short");
ok(Mz.compare(open, { raw: "OL" }).status === "ok" && Mz.compare(open, { raw: "0.3" }).status === "dev", "该 OL 的读到 0.3 Ω → 有偏差");
const gnd = r.rows.find((x) => x.id === "c-gnd");
ok(Mz.compare(gnd, { raw: "OL" }).status === "dev", "共地读到 OL → 有偏差");
ok(Mz.compare(r.rows.find((x) => x.id === "i-idle"), { raw: "110" }).status === "ok" && Mz.compare(r.rows.find((x) => x.id === "i-idle"), { raw: "200" }).status === "dev", "静态电流相对容差 ±40%");
// 真实输入流程（这里是测试用的假想读数，不是实测）
s = Mz.setReading(base, "v-bat-off", "4.10"); s = Mz.setReading(s, "i-load", "1500"); s = Mz.setReading(s, "v-bat-load", "3.50");
r = Mz.measureReport(s);
ok(!r.example && r.rows.find((x) => x.id === "v-bat-off").status === "ok", "用户填的值不是示例");
const sg = r.suggestions.find((x) => x.id === "v-bat-load");
ok(sg && sg.param === "rint" && Math.abs(sg.value - (4.1 - 3.5) / 1.5) < 1e-3, `负载压降 → 建议电池内阻 ${sg?.value} Ω`);
ok(r.steps.finish.status === "dev", "④ 那一步标有偏差");
s = Mz.applyCal(s, sg); r = Mz.measureReport(s);
ok(r.cal.rint?.value === sg.value && r.rows.find((x) => x.id === "v-bat-load").status === "cal", "应用校准后：那一条标“已按这条实测校准”（不算独立验证）");
const chk = (x) => P.checkSim(P.autoStep(x, "check"), null);
const simCal = chk(s), simDef = chk(base);
ok(simCal.stall.rails.vbat < simDef.stall.rails.vbat, `校准进了仿真：堵转电池 ${simDef.stall.rails.vbat} → ${simCal.stall.rails.vbat} V`);
ok(JSON.stringify(P.meterTable(Mz.applyCal(base, { id: "x", apply: { vbat0: 4.1 } }))) !== JSON.stringify(P.meterTable(base)), "万用表表按校准重算（电量）");
s = Mz.undoCal(s, "rint");
ok(JSON.stringify(chk(s).stall.rails) === JSON.stringify(simDef.stall.rails), "撤销后和默认完全一样");
// 接触电阻
s = Mz.setReading(base, "c-gnd", "2.5"); r = Mz.measureReport(s);
const sc = r.suggestions.find((x) => x.id === "c-gnd");
ok(sc?.param === "rContact" && Math.abs(sc.value - (2.5 - 0.03) / 2) < 1e-3, `GND 2.5 Ω → 接触电阻 ${sc?.value}`);
// 导线 vs 接触
s = Mz.setReading(Mz.setReading(Mz.setReading(base, "i-load", "1000"), "v-bat-load", "3.70"), "v-bin-load", "3.40"); r = Mz.measureReport(s);
ok(r.suggestions.find((x) => x.id === "v-bin-load")?.param === "rContact", "插头到升压 IN 0.3 Ω → 归到接触电阻");
s = Mz.setReading(Mz.setReading(Mz.setReading(base, "i-load", "1000"), "v-bat-load", "3.70"), "v-bin-load", "3.58"); r = Mz.measureReport(s);
ok(r.suggestions.find((x) => x.id === "v-bin-load")?.param === "rWire", "0.12 Ω → 归到导线电阻");
// 短路没有参数校准
s = Mz.setReading(base, "c-bat-short", "0.2"); r = Mz.measureReport(s);
ok(r.suggestions[0]?.param === null && !r.suggestions[0].apply, "短路只提示检查，不校准");
// 示例数据
s = Mz.loadExample(base); r = Mz.measureReport(s);
ok(r.example && r.rows.every((x) => !x.entry || x.entry.example), "示例数据每项都标 example");
ok(r.rows.filter((x) => x.status !== "est").every((x) => Mz.statusText(x.status, x.example).includes("示例数据")), "示例数据从不显示“已在实物上验证”");
for (const g of r.suggestions) s = Mz.applyCal(s, g);
r = Mz.measureReport(s); ok(Object.values(r.cal).every((c) => c.example), "从示例数据来的校准也标 example");
// 导出 / 导入
s = Mz.setPhotoFlag(s, "v-bat-off", true);
const js = Mz.exportMeasure(s, { photos: { "v-bat-off": "data:image/jpeg;base64,AAAA", "v-33-on": "javascript:alert(1)" } });
const back = Mz.importMeasure(base, js);
ok(back.ok && JSON.stringify(back.state.measure.items) === JSON.stringify(s.measure.items) && JSON.stringify(back.state.measure.cal) === JSON.stringify(s.measure.cal), "导出 → 导入往返一致");
ok(back.photos["v-bat-off"]?.startsWith("data:image/jpeg") && back.photos["v-33-on"] === undefined, "勾选导出的照片能导回；不是 data:image 的丢弃");
ok(!Mz.exportMeasure(s).includes('"photos"'), "默认不导出照片");
ok(!Mz.importMeasure(base, "{").ok && !Mz.importMeasure(base, '{"kind":"x"}').ok, "坏文件不导入");
const weird = Mz.importMeasure(base, JSON.stringify({ kind: "octo-measure", items: { "zzz": { raw: "1" }, "v-33-on": { raw: "abc" }, "v-bst1-on": { raw: "5.2" } }, cal: { rint: { value: -1 }, evil: { value: 1 } } }));
ok(weird.ok && Object.keys(weird.state.measure.items).join() === "v-bst1-on" && !Object.keys(weird.state.measure.cal).length && weird.skipped.length === 2, "导入跳过未知 / 读不懂的项和非法校准");
// 制作单
const sh = buildSheet(s, []); const md = sheetMarkdown(sh), html = sheetHtml(sh);
ok(md.includes("## 4b. 实测对比") && html.includes("4b. 实测对比"), "制作单有 4b 实测对比");
ok(md.includes("示例数据（不是实测）") && html.includes("示例数据（不是实测）"), "制作单标明示例数据");
ok(md.includes("用户校准生效中") && md.includes("### 校准建议") === r.suggestions.length > 0 || md.includes("### 用户校准"), "制作单写了用户校准");
ok(!/已在实物上验证 \|/.test(md.split("## 4b")[1].split("###")[0].split("\n").slice(5).join("\n")), "示例数据的行里没有“已在实物上验证”");
const sh0 = sheetMarkdown(buildSheet(base, []));
ok(sh0.includes("仅估算") && !sh0.includes("示例数据（不是实测）") && sh0.includes("没有应用用户校准"), "没填实测的制作单：全是仅估算、没有示例标记");
ok(!/[¥$]\s?\d|价格：\d/.test(md), "不含价格");
console.log(`\nmeasure-test: ${n - fail}/${n} 通过`); process.exit(fail ? 1 : 0);
