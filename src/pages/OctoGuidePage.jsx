// 八爪鱼装配指南：台面实际摆的物料（不含价格）+ md 原价（标“来自你的 md”）+ 接线 + 引脚表 + 对照现实 + 出处 + md 问题 + md 原文固件。
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { octoGuide, MD_PRICES, MD_SOURCES, REALITY, TRACE, MD_ISSUES, PLUS_CHANGES, PLUS_BOM, PLUS_SOURCES } from "../assembly/octopus/spec.js";
import { OctoSim } from "../assembly/octopus/sim.js";

const fmtTime = (iso) => new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) + "（北京时间）";
const save = (name, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
const T = ({ head, rows, t }) => (
  <table className="mt-2 w-full border-collapse text-xs" data-testid={t}><thead><tr>{head.map((h) => <th key={h} className="border border-line bg-paper-2 px-1 py-0.5 text-left">{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border border-line px-1 py-0.5 align-top">{c}</td>)}</tr>)}</tbody></table>
);

export default function OctoGuidePage() {
  const [params] = useSearchParams();
  const [file, setFile] = useState("body_firmware_A.ino");
  const [pfile, setPfile] = useState("octopus_plus/octopus_plus.ino");
  const g = useMemo(() => {
    if (params.get("src") === "bench") { try { const x = JSON.parse(localStorage.getItem("octo-guide") || "null"); if (x) return x; } catch { /* 用默认 */ } }
    return octoGuide(new OctoSim({ plan: params.get("plan") === "B" ? "B" : "A", phase: 3, variant: params.get("variant") === "plus" ? "plus" : "md" }), null);
  }, [params]);
  useEffect(() => { document.title = `${g.title} 装配指南 · 硬件工作台`; }, [g]);
  return (
    <article className="guide mx-auto w-full max-w-4xl px-4 py-6 text-sm leading-6" data-testid="octo-guide">
      <p className="text-xs"><Link to="/assembly?scene=octo" className="underline">← 回装配台</Link> · <button type="button" className="underline" onClick={() => window.print()}>打印</button> <span className="ml-1 border border-copper px-1.5 py-0.5 text-xs text-copper">早期原型，简化仿真</span></p>
      <h1 className="mt-2 text-2xl font-medium">{g.title} · 装配指南</h1>
      <p className="text-ink-soft">按你给的 md（octopus-ai 目录 9 个文件）复刻。{g.phaseZh}{g.fault ? ` · 场景：${g.fault}` : ""} · 固件{g.mode === "mcp" ? "：小智 MCP（模拟）" : "：蓝牙串口 .ino"} · 生成于 {fmtTime(g.created)}</p>
      <p className="text-xs"><a href="#plus" className="text-copper underline">→ 完善版（我的补充）：改动表、物料、修正后的固件和文档下载</a>{g.variant === "plus" ? "（台面当前就是完善版）" : ""}</p>
      {g.fixes?.length > 0 && <p className="text-xs text-ink-soft">台面打开的固件修正：{g.fixes.length} 项（见下面“md 里不对的地方”）</p>}

      <h2 className="mt-6 text-lg font-medium">1. 台面物料（不含价格）</h2>
      <T t="og-bom" head={["零件", "数量", "模型来源"]} rows={g.bom.map((b) => [b.zh, b.n, b.cable ? "导线（按走线长度）" : b.real ? `库里真实 CAD${b.licence ? `（${b.licence}）` : ""}` : "程序生成，尺寸估算"])} />

      <h2 className="mt-6 text-lg font-medium">2. 价格 <span className="text-sm text-copper">来自你的 md</span></h2>
      <p className="text-xs text-ink-soft">{MD_PRICES.note}</p>
      <p className="mt-2 text-xs font-medium">{MD_PRICES.readmeB.src}</p>
      <T t="og-prices" head={["类别", "型号", "数量", "价格（来自你的 md）"]} rows={MD_PRICES.readmeB.rows} />
      <p className="text-xs text-ink-soft">{MD_PRICES.readmeB.total}</p>
      <p className="mt-2 text-xs font-medium">{MD_PRICES.servoCost.src}</p>
      <T head={["方案", "舵机成本（来自你的 md）"]} rows={MD_PRICES.servoCost.rows} />
      <p className="mt-2 text-xs font-medium">{MD_PRICES.batches.src}</p>
      <T head={["批次", "物品", "价格（来自你的 md）"]} rows={MD_PRICES.batches.rows} />

      <h2 className="mt-6 text-lg font-medium">3. 接线表（{g.wires.length} 根）</h2>
      <T t="og-wires" head={["从", "到", "说明", "出处"]} rows={g.wires.map((w) => [w.a, w.b, w.why, w.md])} />

      <h2 className="mt-6 text-lg font-medium">4. 台面引脚表（ESP32‑S3‑DevKitC‑1）</h2>
      <T t="og-pins" head={["排针", "丝印", "接到", "作用", "出处"]} rows={g.pinmap.map((r) => [r.pin, r.gpio, r.to, r.why, r.md])} />
      {g.servos?.length > 0 && <T head={["舵机", "触手", "PCA9685 通道", "类型"]} rows={g.servos.map((s) => [s.role, `${s.arm} 号${s.slot ? "（俯仰）" : g.plan === "B" ? "（偏航）" : ""}`, s.ch, s.type === "360" ? "360°（故障场景）" : "180°"])} />}

      <h2 className="mt-6 text-lg font-medium">5. 对照现实（台面和真东西哪里不一样）</h2>
      <T t="og-reality" head={["项目", "说明", "标记"]} rows={REALITY} />

      <h2 className="mt-6 text-lg font-medium">6. 出处表（台面元素 → md 章节）</h2>
      <T t="og-trace" head={["台面元素", "md 出处"]} rows={TRACE} />

      <h2 className="mt-6 text-lg font-medium">7. md 里我觉得不对或没写清的地方（{MD_ISSUES.length} 条）</h2>
      <ol className="mt-2 list-decimal pl-5 text-xs leading-5" data-testid="og-issues">{MD_ISSUES.map((s) => <li key={s}>{s}</li>)}</ol>

      <h2 className="mt-6 text-lg font-medium">8. 固件（md 原文，一字未改）</h2>
      <p className="text-xs text-ink-soft">台面跑的是这份代码的 JS 移植；“修正”只在台面上开关，不改这里的原文。</p>
      <div className="mt-2 flex flex-wrap gap-1 text-xs">{Object.keys(MD_SOURCES).map((k) => <button key={k} type="button" onClick={() => setFile(k)} className={`border px-2 py-0.5 ${file === k ? "border-ink bg-ink text-paper-2" : "border-line bg-white"}`}>{k}</button>)}
        <button type="button" onClick={() => save(file, MD_SOURCES[file])} className="border border-copper px-2 py-0.5" data-testid="og-save">下载 {file}</button></div>
      <pre className="mt-2 max-h-[32rem] overflow-auto border border-line bg-white p-2 text-[11px] leading-4 print:max-h-none" data-testid="og-ino">{MD_SOURCES[file]}</pre>

      <h2 id="plus" className="mt-8 text-lg font-medium text-copper">9. 完善版改动表（我的补充）</h2>
      <p className="text-xs text-ink-soft">md 原样模式不受影响（上面第 8 节一字未改）。下面每一行都是我按自己的判断补的：“出处”里 datasheet＝芯片 / 模块资料查得到的事实，推理＝读 md 代码或简单计算，估算＝台面仿真或经验值、需要实物验证。没有编任何 datasheet 数字和价格。</p>
      <T t="og-plus-changes" head={["#", "md 问题", "完善版怎么改（我的补充）", "为什么", "出处"]} rows={PLUS_CHANGES.map((c) => [c.issues.map((i) => i + 1).join("、"), c.issues.map((i) => MD_ISSUES[i]).join(" ／ "), c.fix, c.reason, c.src])} />

      <h2 className="mt-6 text-lg font-medium text-copper">10. 完善版物料（我的补充）</h2>
      <p className="text-xs text-ink-soft">{PLUS_BOM.note}</p>
      <T t="og-plus-bom" head={["类别", "型号", "数量", "价格", "出处"]} rows={PLUS_BOM.rows} />
      <p className="text-xs text-ink-soft">{PLUS_BOM.total}</p>

      <h2 className="mt-6 text-lg font-medium text-copper">11. 完善版固件 + 文档下载（我的补充）</h2>
      <p className="text-xs text-ink-soft">octopus_plus 文件夹（.ino + 4 个头文件）已用 arduino-cli 1.5.1 + esp32 核心 3.3.12 按 ESP32S3 Dev Module 编译通过（OCTO_RIG 8 / 16），未上实物。xiaozhi/octopus_mcp.cpp 依赖 xiaozhi-esp32 工程，未编译。</p>
      <div className="mt-2 flex flex-wrap gap-1 text-xs">{Object.keys(PLUS_SOURCES).map((k) => <button key={k} type="button" onClick={() => setPfile(k)} className={`border px-2 py-0.5 ${pfile === k ? "border-copper bg-copper text-paper-2" : "border-line bg-white"}`}>{k}</button>)}
        <button type="button" onClick={() => save(pfile.split("/").pop(), PLUS_SOURCES[pfile])} className="border border-copper px-2 py-0.5" data-testid="og-plus-save">下载 {pfile.split("/").pop()}</button>
        <button type="button" onClick={() => Object.keys(PLUS_SOURCES).forEach((k, i) => setTimeout(() => save(k.split("/").pop(), PLUS_SOURCES[k]), i * 300))} className="border border-copper px-2 py-0.5" data-testid="og-plus-save-all">全部下载（{Object.keys(PLUS_SOURCES).length} 个文件）</button></div>
      <pre className="mt-2 max-h-[32rem] overflow-auto border border-line bg-white p-2 text-[11px] leading-4 print:max-h-none" data-testid="og-plus-src">{PLUS_SOURCES[pfile]}</pre>
    </article>
  );
}
