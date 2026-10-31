// v25：从完成的台面生成可打印 / 可下载的制作单（Markdown + HTML 打印版）。不写价格（全部未核实）。早期原型，简化仿真。
import * as P from "./octoProject.js";
import * as Mz from "./measure.js";
import { V10_SAFETY, V10_LIMITS, V10_FW, V10_BUILD } from "../assembly/octopus/guide-v10.js";
import { SRC_ZH, LIC_ZH } from "../assembly/partsSearch.js";
const PROC = { "p-octo-frame-v10": "PLA 骨架 Ø9 cm + 上层板 Ø8 cm（v10）", "p-octo-arm-v10": "PLA 短触手（v10）", "p-octo-vdiv-1s": "100k/100k 电池检测分压小板" };
const LINKS = { ada: (id) => `https://www.adafruit.com/product/${id.slice(4)}`, kicad: () => "https://gitlab.com/kicad/libraries/kicad-packages3D" };

export function buildSheet(state, rows, { now = new Date(), fw = null } = {}) {
  const st = state || P.emptyState();
  const prog = P.progress(st, { dims: Object.fromEntries((rows || []).map((r) => [r[0], r[4]])), fw });
  const complete = ["bom", "assemble", "wire", "solder"].every((k, i) => prog.done[i]);
  // 没做完就按参考设计出单（并写明）
  const use = complete ? st : P.autoStep(P.autoStep(P.autoStep(P.autoStep(P.emptyState(), "bom"), "assemble"), "wire"), "solder");
  const byId = Object.fromEntries((rows || []).map((r) => [r[0], r]));
  const bom = Object.entries(P.bomRequired()).map(([id, qty]) => {
    const r = byId[id]; const proc = id.startsWith("p-");
    return { id, qty, name: r ? (r[1] !== r[2] ? `${r[1]}（${r[2]}）` : r[1]) : PROC[id] || id, why: P.BOM_WHY[id] || "", lic: proc ? LIC_ZH.CC0 : LIC_ZH[r?.[5]] || r?.[5] || "?", src: proc ? SRC_ZH.proc : SRC_ZH[r?.[6]] || r?.[6] || "", url: !proc && LINKS[r?.[6]] ? LINKS[r[6]](id) : "", dims: r?.[4] };
  });
  const wiring = P.refConnections().filter((c) => use.wires.some((w) => P.keyOf(w.a, w.b) === P.keyOf(c.a, c.b))).map((c, i) => ({ i: i + 1, a: P.nodeLabel(c.a), b: P.nodeLabel(c.b), how: c.jst ? "插头（不焊）" : /^S\d:/.test(c.a) ? "舵机线焊到焊盘 / 杜邦线" : "焊接", why: c.why, color: c.color }));
  const solder = P.solderSequence(use).map((x, i, a) => ({ i: i + 1, pad: P.nodeLabel(x.n), why: i && a[i - 1].why === x.why ? "〃" : x.why }));
  const meter = P.meterTable({ ...P.autoStep(use, "check"), measure: st.measure });
  const measure = Mz.measureReport({ ...use, measure: st.measure });
  return {
    title: "八爪鱼 v10 紧凑无线版 · 制作单", generated: new Date(now.getTime() + 8 * 3600e3).toISOString().slice(0, 16).replace("T", " "), complete,
    autoSteps: st.auto || [], bom, wiring, solder, meter, measure,
    fw: V10_FW, build: V10_BUILD,
    safety: [
      ...V10_SAFETY,
      ["烙铁（我的补充）", ["烙铁架放稳，烙铁头 300–350 °C（有铅锡）/ 350–380 °C（无铅），每个焊点加热不超过 3 s（本台面估算阈值同上）。", "手别碰烙铁头和刚焊完的焊点；不用时放回烙铁架、用完断电。", "戴护目镜：剪舵机线、剪引脚时线头会飞。", "焊之前拔掉电池 JST，焊完先用万用表通断档查短路（下面测试清单 ①），再插电池。"]],
      ["通风（我的补充）", ["助焊剂烟雾有刺激性：开窗或用排烟风扇 / 吸烟仪，别对着脸吹。", "焊完洗手，焊锡（尤其有铅锡）别碰食物。"]],
    ],
    notValidated: [
      ...V10_LIMITS.filter((r) => ["没验证", "电压", "开关", "电池线", "欠压", "电流模型", "物理简化"].includes(r[0])).map((r) => `${r[0]}：${r[1]}（${r[2]}）`),
      "我的补充：焊接质量（虚焊 / 连锡 / 焊盘翘起）是按加热时间和助焊剂估算的简化模型，不代表真实烙铁和焊锡。",
      "我的补充：万用表读数是电路求解器的直流估算（理想导线、理想开关）；电池电压取标称 3.85 V，实测随电量在 3.0–4.2 V。",
      "我的补充：零件摆放只按库里外形尺寸的矩形检查重叠，没算导线走线和螺丝。",
      "我的补充：固件只在本机编译通过（见固件编译状态），没有烧到实物上运行过。",
    ],
    sources: ["Adafruit 商品页 / 引脚图：5426 QT Py ESP32‑S3、2201 SG51R、258 LiPo、4410 充电板、4654 MiniBoost、805 开关", "KiCad 3D 模型库（电容封装，CC BY‑SA 4.0）", "本项目：bench.js / circuit.js（接线与求解器）、parts.js（引脚名）、octopus_plus 固件（OCTO_V10）", "/workspace/zipx/octopus-ai/ 原始设计 md（只读参考）"],
  };
}
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pipe = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const head = (sh) => [
  `生成时间：${sh.generated}（北京时间）· 早期原型，简化仿真`,
  sh.complete ? "按你在引导项目里完成的台面生成。" : "⚠️ 引导项目还没做完：这份制作单按参考设计（v10）生成。",
  sh.autoSteps.length ? `用了“示范：自动完成”的步骤：${sh.autoSteps.join("、")}` : "",
  sh.measure?.example ? "⚠️ 实测对比里填的是示例数据（不是实测）：不代表任何真实硬件。" : "",
  sh.measure && Object.keys(sh.measure.cal).length ? `用户校准生效中：${Object.entries(sh.measure.cal).map(([k, c]) => `${Mz.PARAM_ZH[k]} = ${c.value} ${Mz.PARAM_UNIT[k]}`).join("、")}（按实测反推，第 4b 节；第 4 节的期望值已按它重算）` : "",
  "价格：不写（全部未核实）。标“我的补充”的是本项目补充的内容，标“估算”的是模型算出来的、没有实测。",
].filter(Boolean);
export function sheetMarkdown(sh) {
  const L = [`# ${sh.title}`, "", ...head(sh).map((x) => `> ${x}`), ""];
  L.push("## 1. 零件清单（BOM）", "", "| # | 零件 | id | 数量 | 用途 | 3D 模型许可证 | 模型来源 / 商品页 |", "|---|---|---|---|---|---|---|");
  sh.bom.forEach((b, i) => L.push(`| ${i + 1} | ${pipe(b.name)} | ${b.id} | ${b.qty} | ${pipe(b.why)} | ${b.lic} | ${pipe(b.src)}${b.url ? ` ${b.url}` : ""} |`));
  L.push("", "许可证指库里 3D 模型 / 封装的许可证，不是硬件本身的。", "", "另需（我的补充，台面里没画）：万向珠 × 3（估算）、杜邦线 / 硅胶线、热缩管、双面胶 / 扎带、M2 螺丝（舵机自带）。", "");
  L.push("## 2. 接线表（引脚到引脚）", "", "引脚名来自 Adafruit 引脚图（parts.js）；GPIO 来自固件 OCTO_V10。", "", "| # | 从 | 到 | 方式 | 说明 |", "|---|---|---|---|---|");
  sh.wiring.forEach((w) => L.push(`| ${w.i} | ${pipe(w.a)} | ${pipe(w.b)} | ${w.how} | ${pipe(w.why)} |`));
  L.push("", "## 3. 焊接顺序（我的补充）", "", "先拔电池。先小板、再电源主路、最后 QT Py；JST 电池插头最后插。", "", "| # | 焊盘 | 为什么在这一步 |", "|---|---|---|");
  sh.solder.forEach((s) => L.push(`| ${s.i} | ${pipe(s.pad)} | ${pipe(s.why)} |`));
  L.push("", "## 4. 测试清单（万用表）", "", "期望读数来自电路求解器；标“估算”的是模型值，实测会有偏差。按 ① → ② → ③ 的顺序，前一步不对就别往下做。", "", "| 阶段 | 测哪里 | 档位 | 期望 | 依据 | 实测 ☐ |", "|---|---|---|---|---|---|");
  sh.meter.forEach((m) => L.push(`| ${m.stage} | ${pipe(m.where)} | ${m.mode} | ${pipe(m.expect)} | ${m.basis} | |`));
  L.push("", ...measureMd(sh.measure));
  L.push("", `固件编译状态：${sh.fw.result}`, "", "上电后（V10 制作步骤）：", "");
  sh.build.slice(2, 7).forEach((b) => L.push(`${b[0]}. **${b[1]}**：${b[2]}`));
  L.push("", "## 5. 安全", "");
  for (const [t, list] of sh.safety) { L.push(`### ${t}`, ""); list.forEach((x) => L.push(`- ${x}`)); L.push(""); }
  L.push("## 6. 没有在实物上验证的部分", "", ...sh.notValidated.map((x) => `- ⚠️ ${x}`), "");
  L.push("## 7. 来源", "", ...sh.sources.map((x) => `- ${x}`), "");
  return L.join("\n");
}
export function sheetHtml(sh) {
  const tbl = (hd, rows) => `<table><thead><tr>${hd.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(sh.title)}</title>
<style>
body{font:13px/1.5 system-ui,"PingFang SC","Noto Sans CJK SC",sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#111}
h1{font-size:22px}.st-ok{color:#166534}.st-dev{color:#b91c1c;font-weight:600}.st-cal{color:#1d4ed8}.st-est{color:#666}.ex{background:#fff1d6;border:2px solid #d97706;padding:6px 10px;font-weight:600}h2{font-size:17px;border-bottom:2px solid #333;margin-top:28px}h3{font-size:14px}
table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid #999;padding:3px 6px;text-align:left;vertical-align:top}th{background:#eee}
.note{background:#fff7e0;border:1px solid #e0b000;padding:6px 10px}.warn li{color:#8a3b00}
@media print{body{margin:0;max-width:none;font-size:11px}h2{page-break-after:avoid}tr{page-break-inside:avoid}.noprint{display:none}}
</style></head><body>
<h1>${esc(sh.title)}</h1><div class="note">${head(sh).map(esc).join("<br>")}</div>
<p class="noprint"><button onclick="print()">打印 / 存成 PDF</button></p>
<h2>1. 零件清单（BOM）</h2>${tbl(["#", "零件", "id", "数量", "用途", "3D 模型许可证", "模型来源 / 商品页"], sh.bom.map((b, i) => [i + 1, b.name, b.id, b.qty, b.why, b.lic, b.src + (b.url ? " " + b.url : "")]))}
<p>另需（我的补充，台面里没画）：万向珠 × 3（估算）、杜邦线 / 硅胶线、热缩管、双面胶 / 扎带、M2 螺丝（舵机自带）。</p>
<h2>2. 接线表（引脚到引脚）</h2><p>引脚名来自 Adafruit 引脚图（parts.js）；GPIO 来自固件 OCTO_V10。</p>${tbl(["#", "从", "到", "方式", "说明"], sh.wiring.map((w) => [w.i, w.a, w.b, w.how, w.why]))}
<h2>3. 焊接顺序（我的补充）</h2><p>先拔电池。先小板、再电源主路、最后 QT Py；JST 电池插头最后插。</p>${tbl(["#", "焊盘", "为什么在这一步"], sh.solder.map((s) => [s.i, s.pad, s.why]))}
<h2>4. 测试清单（万用表）</h2><p>期望读数来自电路求解器；标“估算”的是模型值。按 ① → ② → ③ 的顺序。</p>${tbl(["阶段", "测哪里", "档位", "期望", "依据", "实测 ☐"], sh.meter.map((m) => [m.stage, m.where, m.mode, m.expect, m.basis, ""]))}
${measureHtml(sh.measure, tbl)}
<p>固件编译状态：${esc(sh.fw.result)}</p><ol start="3">${sh.build.slice(2, 7).map((b) => `<li><b>${esc(b[1])}</b>：${esc(b[2])}</li>`).join("")}</ol>
<h2>5. 安全</h2>${sh.safety.map(([t, l]) => `<h3>${esc(t)}</h3><ul>${l.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`).join("")}
<h2>6. 没有在实物上验证的部分</h2><ul class="warn">${sh.notValidated.map((x) => `<li>⚠️ ${esc(x)}</li>`).join("")}</ul>
<h2>7. 来源</h2><ul>${sh.sources.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
</body></html>`;
}

// v26：4b 实测对比
const mIntro = (m) => [
  "只有你在“实测对比”里填的值算实测；没填的写“仅估算”。容差也是估算。",
  m.example ? "⚠️ 示例数据（不是实测）：下表的“实测”列是演示用的示例值，不代表任何真实硬件。" : "",
  `合计：已在实物上验证 ${m.counts.ok} · 已按这条实测校准 ${m.counts.cal} · 有偏差 ${m.counts.dev} · 仅估算 ${m.counts.est}（共 ${m.counts.n} 项）`,
].filter(Boolean);
const mRow = (r) => [r.stage, r.where, r.kind === "open" ? "OL" : `${Mz.fmt(r.est, r.unit === "mA" ? 0 : 2)} ${r.unit}`, r.entry?.raw ? `${r.entry.raw}${r.kind === "open" ? "" : " " + r.unit}${r.entry.example ? "（示例数据）" : ""}${r.photo ? " · 有照片（只在本机）" : ""}` : "—", Mz.statusText(r.status, r.example), r.txt];
const stepZh = (k) => P.STEPS.find((s) => s.k === k)?.zh || k;
function measureMd(m) {
  if (!m) return [];
  const L = ["## 4b. 实测对比（我的补充）", "", ...mIntro(m).map((x) => `> ${x}`), "", "| 阶段 | 测哪里 | 估算 | 实测 | 标记 | 对比 |", "|---|---|---|---|---|---|"];
  m.rows.forEach((r) => L.push(`| ${mRow(r).map(pipe).join(" | ")} |`));
  L.push("", "每一步的标记：" + Object.entries(m.steps).map(([k, s]) => `${stepZh(k)} = ${Mz.statusText(s.status, s.example)}`).join("；"), "");
  if (m.suggestions.length) { L.push("### 校准建议", ""); m.suggestions.forEach((s) => L.push(`- **${pipe(s.title)}** — 该查：${s.param ? Mz.PARAM_ZH[s.param] : "接线 / 焊点（不是参数）"}。${s.check}${s.apply ? ` 建议值：${Mz.PARAM_ZH[s.param]} = ${s.value} ${Mz.PARAM_UNIT[s.param]}（${s.how}）。` : ""}`)); L.push(""); }
  const cal = Object.entries(m.cal);
  L.push("### 用户校准", "", cal.length ? "下面的参数在仿真里换成了按实测反推的值（随时可以在页面上撤销）：" : "没有应用用户校准：仿真用默认估算。", "");
  cal.forEach(([k, c]) => L.push(`- ${Mz.PARAM_ZH[k]} = ${c.value} ${Mz.PARAM_UNIT[k]}（来自 ${c.from}${c.example ? "，示例数据（不是实测）" : ""}）`));
  return L;
}
function measureHtml(m, tbl) {
  if (!m) return "";
  const rows = m.rows.map(mRow);
  const cls = Object.fromEntries([...Object.entries(Mz.STATUS_ZH), ...Object.entries(Mz.EXAMPLE_ZH)].map(([k, v]) => [esc(v), `st-${k}`]));
  const t = tbl(["阶段", "测哪里", "估算", "实测", "标记", "对比"], rows).replace(/<td>([^<]*)<\/td>/g, (m0, x) => (cls[x] ? `<td class="${cls[x]}">${x}</td>` : m0));
  const cal = Object.entries(m.cal);
  return `<h2>4b. 实测对比（我的补充）</h2>${mIntro(m).map((x) => `<p class="${x.startsWith("⚠️") ? "ex" : ""}">${esc(x)}</p>`).join("")}${t}
<p>每一步的标记：${esc(Object.entries(m.steps).map(([k, s]) => `${stepZh(k)} = ${Mz.statusText(s.status, s.example)}`).join("；"))}</p>
${m.suggestions.length ? `<h3>校准建议</h3><ul>${m.suggestions.map((s) => `<li><b>${esc(s.title)}</b> — 该查：${esc(s.param ? Mz.PARAM_ZH[s.param] : "接线 / 焊点（不是参数）")}。${esc(s.check)}${s.apply ? esc(` 建议值：${Mz.PARAM_ZH[s.param]} = ${s.value} ${Mz.PARAM_UNIT[s.param]}（${s.how}）。`) : ""}</li>`).join("")}</ul>` : ""}
<h3>用户校准</h3>${cal.length ? `<ul>${cal.map(([k, c]) => `<li>${esc(`${Mz.PARAM_ZH[k]} = ${c.value} ${Mz.PARAM_UNIT[k]}（来自 ${c.from}${c.example ? "，示例数据（不是实测）" : ""}）`)}</li>`).join("")}</ul>` : "<p>没有应用用户校准：仿真用默认估算。</p>"}`;
}
