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

const TOC = [["s1", "1. 台面物料"], ["s2", "2. 价格（来自 md）"], ["s3", "3. 接线表"], ["s4", "4. 引脚表"], ["s5", "5. 对照现实"], ["s6", "6. 出处表"], ["s7", "7. md 问题清单"], ["s8", "8. md 原文固件"], ["plus", "9. 完善版改动表"], ["s10", "10. 完善版物料"], ["s11", "11. 完善版固件 + 下载"], ["s12", "12. 如何实际动手做"]];
// 12 节：把台面指南的每一节对到现实里的动手步骤。只用 md 原文和 datasheet 能查到的事实；通用安全常识标“我的补充”，不编数字。
const BUILD = [
  ["0", "先在台面跑通", "先在装配台点“一键开始”看完整流程，再按 md 的阶段顺序做实物：小智语音链路 → 1 个舵机 + 最小 MCP → PCA9685 + 降压 + 电池 → 组装 → 调步态 → 升级（md 路线图；完善版同）。", "md README §7 推进顺序；完善版 §7"],
  ["1", "买件", "按第 2 节（md 价格）/ 第 10 节（完善版物料）下单。舵机一定要 180° 版 MG90S，别买成 360° 连续旋转版（md 故障表：舵机抖动、抽搐的原因之一就是买成了 360°）。MG90S 标称 4.8–6.0 V。", "md 采购清单 故障表、力矩校验一节"],
  ["2", "舵机先回中再装舵盘", "每个舵机单独接上、上传固件，等它转到中位后再装舵盘和触手；装歪的几度用软件 SetTrim 补，不要拆结构。", "md 采购清单「先在 Arduino 里验证」；md README §8 已知的坑"],
  ["3", "接线", "照第 3 节接线表、第 4 节引脚表接。舵机 V+ 只能从 PCA9685 的螺丝端子进，绝不能从 ESP32 的 3V3 / 5V 取；电池 GND、ESP32 GND、PCA9685 GND 必须共地（不共地 = 舵机不动或抽搐）。", "md README §4 接线；md 采购清单「必须共地」"],
  ["4", "先调压、后接负载", "降压模块先空载，用万用表把输出调到 6.0 V（舵机）和 5.0 V（ESP32）再接上。XL4015 输入范围 8–36 V（datasheet），所以完善版用 3S（9.6–12.6 V）而不是 2S。", "完善版 §2 供电、§7；XL4015 datasheet"],
  ["5", "第一次通电只接 4 路", "先只接 4 个舵机，用万用表看电池电流，确认 SoftHome 分时回中（约 1–2 秒）正常，再接满 8 / 16 路。台面里的电流数字是估算，以你的实测为准。", "md 手机控制指南 第 2 步、故障表；完善版 §7"],
  ["6", "调步态", "用第 9 节的默认步态起步，在台面上调频率 / 摆幅 / 相位，满意了再写进 GaitParams。方案 B 相邻模块的间隙（13°）是台面 3D 模型量的，你的打印件尺寸不同就要重新量。", "md README §7 第 4 步；完善版改动表（v8 实测间隙）"],
];
const SAFETY = [
  ["锂电池（md / 完善版写到的）", ["电池必须带保护板（防过放）；md 的 2S 方案和完善版的 3S 方案都这么要求。", "用对应串数的平衡充电器；md 明确说别用普通单芯充（会充坏），完善版说不要用 TP4056。", "低压就停：md 2S 低于 6.4 V 停运动；完善版 3S 低于 9.6 V 停运动（固件 GPIO10 检测，阈值估算）。舵机开始抖、板子反复重启，先 STOP 再充电。", "完善版在电池后面加主开关 + 保险丝（保险丝规格 5 A 是估算）。"]],
  ["锂电池（通用安全常识，我的补充）", ["接线、改线之前先断开电池；裸露的电池线头先用胶布或热缩管包住，正负极绝不能碰在一起。", "充电时人要在旁边，放在不可燃的表面上（或锂电防爆袋里），别在床上、沙发上充。", "电池鼓包、漏液、外皮破损、摔过变形，就停用，按当地规定回收，不要扔进普通垃圾。"]],
  ["焊接（md 基础版全程免焊；电池线、开关、保险丝如果要焊，看这里 · 通用安全常识，我的补充）", ["焊之前断开电池和所有电源；电池线一次只处理一根，焊完马上套热缩管。", "烙铁放在烙铁架上，烙铁头别碰电线外皮和自己；开窗或开风扇，别直接吸焊烟。", "剪线脚时戴护目镜；用含铅焊锡后洗手。", "焊完先用万用表通断档确认没有短路，再接电池。"]],
];
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
      <nav className="mt-3 border border-line bg-white p-2 text-xs print:hidden" data-testid="og-toc"><b>目录</b>
        <ol className="mt-1 grid grid-cols-1 gap-x-4 sm:grid-cols-2">{TOC.map(([id, zh]) => <li key={id}><a href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ block: "start" }); history.replaceState(history.state, "", `${location.pathname}${location.search}#${id}`); }} className={`underline ${id === "plus" || id === "s10" || id === "s11" || id === "s12" ? "text-copper" : ""}`}>{zh}</a></li>)}</ol></nav>
      {g.fixes?.length > 0 && <p className="text-xs text-ink-soft">台面打开的固件修正：{g.fixes.length} 项（见下面“md 里不对的地方”）</p>}

      <h2 id="s1" className="mt-6 text-lg font-medium">1. 台面物料（不含价格）</h2>
      <T t="og-bom" head={["零件", "数量", "模型来源"]} rows={g.bom.map((b) => [b.zh, b.n, b.cable ? "导线（按走线长度）" : b.real ? `库里真实 CAD${b.licence ? `（${b.licence}）` : ""}` : "程序生成，尺寸估算"])} />

      <h2 id="s2" className="mt-6 text-lg font-medium">2. 价格 <span className="text-sm text-copper">来自你的 md</span></h2>
      <p className="text-xs text-ink-soft">{MD_PRICES.note}</p>
      <p className="mt-2 text-xs font-medium">{MD_PRICES.readmeB.src}</p>
      <T t="og-prices" head={["类别", "型号", "数量", "价格（来自你的 md）"]} rows={MD_PRICES.readmeB.rows} />
      <p className="text-xs text-ink-soft">{MD_PRICES.readmeB.total}</p>
      <p className="mt-2 text-xs font-medium">{MD_PRICES.servoCost.src}</p>
      <T head={["方案", "舵机成本（来自你的 md）"]} rows={MD_PRICES.servoCost.rows} />
      <p className="mt-2 text-xs font-medium">{MD_PRICES.batches.src}</p>
      <T head={["批次", "物品", "价格（来自你的 md）"]} rows={MD_PRICES.batches.rows} />

      <h2 id="s3" className="mt-6 text-lg font-medium">3. 接线表（{g.wires.length} 根）</h2>
      <T t="og-wires" head={["从", "到", "说明", "出处"]} rows={g.wires.map((w) => [w.a, w.b, w.why, w.md])} />

      <h2 id="s4" className="mt-6 text-lg font-medium">4. 台面引脚表（ESP32‑S3‑DevKitC‑1）</h2>
      <T t="og-pins" head={["排针", "丝印", "接到", "作用", "出处"]} rows={g.pinmap.map((r) => [r.pin, r.gpio, r.to, r.why, r.md])} />
      {g.servos?.length > 0 && <T head={["舵机", "触手", "PCA9685 通道", "类型"]} rows={g.servos.map((s) => [s.role, `${s.arm} 号${s.slot ? "（俯仰）" : g.plan === "B" ? "（偏航）" : ""}`, s.ch, s.type === "360" ? "360°（故障场景）" : "180°"])} />}

      <h2 id="s5" className="mt-6 text-lg font-medium">5. 对照现实（台面和真东西哪里不一样）</h2>
      <T t="og-reality" head={["项目", "说明", "标记"]} rows={REALITY} />

      <h2 id="s6" className="mt-6 text-lg font-medium">6. 出处表（台面元素 → md 章节）</h2>
      <T t="og-trace" head={["台面元素", "md 出处"]} rows={TRACE} />

      <h2 id="s7" className="mt-6 text-lg font-medium">7. md 里我觉得不对或没写清的地方（{MD_ISSUES.length} 条）</h2>
      <ol className="mt-2 list-decimal pl-5 text-xs leading-5" data-testid="og-issues">{MD_ISSUES.map((s) => <li key={s}>{s}</li>)}</ol>

      <h2 id="s8" className="mt-6 text-lg font-medium">8. 固件（md 原文，一字未改）</h2>
      <p className="text-xs text-ink-soft">台面跑的是这份代码的 JS 移植；“修正”只在台面上开关，不改这里的原文。</p>
      <div className="mt-2 flex flex-wrap gap-1 text-xs">{Object.keys(MD_SOURCES).map((k) => <button key={k} type="button" onClick={() => setFile(k)} className={`border px-2 py-0.5 ${file === k ? "border-ink bg-ink text-paper-2" : "border-line bg-white"}`}>{k}</button>)}
        <button type="button" onClick={() => save(file, MD_SOURCES[file])} className="border border-copper px-2 py-0.5" data-testid="og-save">下载 {file}</button></div>
      <pre className="mt-2 max-h-[32rem] overflow-auto border border-line bg-white p-2 text-[11px] leading-4 print:max-h-none" data-testid="og-ino">{MD_SOURCES[file]}</pre>

      <h2 id="plus" className="mt-8 text-lg font-medium text-copper">9. 完善版改动表（我的补充）</h2>
      <p className="text-xs text-ink-soft">md 原样模式不受影响（上面第 8 节一字未改）。下面每一行都是我按自己的判断补的：“出处”里 datasheet＝芯片 / 模块资料查得到的事实，推理＝读 md 代码或简单计算，估算＝台面仿真或经验值、需要实物验证。没有编任何 datasheet 数字和价格。</p>
      <T t="og-plus-changes" head={["#", "md 问题", "完善版怎么改（我的补充）", "为什么", "出处"]} rows={PLUS_CHANGES.map((c) => [c.issues.map((i) => i + 1).join("、"), c.issues.map((i) => MD_ISSUES[i]).join(" ／ "), c.fix, c.reason, c.src])} />

      <h2 id="s10" className="mt-6 text-lg font-medium text-copper">10. 完善版物料（我的补充）</h2>
      <p className="text-xs text-ink-soft">{PLUS_BOM.note}</p>
      <T t="og-plus-bom" head={["类别", "型号", "数量", "价格", "出处"]} rows={PLUS_BOM.rows} />
      <p className="text-xs text-ink-soft">{PLUS_BOM.total}</p>

      <h2 id="s11" className="mt-6 text-lg font-medium text-copper">11. 完善版固件 + 文档下载（我的补充）</h2>
      <p className="text-xs text-ink-soft">octopus_plus 文件夹（.ino + 4 个头文件）v8（2026-10-30）用免费的 arduino-cli 1.5.1 + esp32 核心 3.3.12 按 ESP32S3 Dev Module 重新编译通过：OCTO_RIG 8 / 16 均为程序 620 776 B（47%）、全局变量 30 720 B（9%），我们的文件 0 个 warning；未上实物。xiaozhi/octopus_mcp.cpp 只做了<b>桩编译</b>（上游 mcp_server.h @ addb1ed + 空实现 McpServer，通过、0 warning），不等于在小智工程里真编译。md 原样的 body_firmware_A.ino 在 ESP32‑S3 上编译失败（无经典蓝牙 BluetoothSerial；OctopusBody / Pca9685 缺无参构造）。复现：scripts/fw-compile.sh。</p>
      <div className="mt-2 flex flex-wrap gap-1 text-xs">{Object.keys(PLUS_SOURCES).map((k) => <button key={k} type="button" onClick={() => setPfile(k)} className={`border px-2 py-0.5 ${pfile === k ? "border-copper bg-copper text-paper-2" : "border-line bg-white"}`}>{k}</button>)}
        <button type="button" onClick={() => save(pfile.split("/").pop(), PLUS_SOURCES[pfile])} className="border border-copper px-2 py-0.5" data-testid="og-plus-save">下载 {pfile.split("/").pop()}</button>
        <button type="button" onClick={() => Object.keys(PLUS_SOURCES).forEach((k, i) => setTimeout(() => save(k.split("/").pop(), PLUS_SOURCES[k]), i * 300))} className="border border-copper px-2 py-0.5" data-testid="og-plus-save-all">全部下载（{Object.keys(PLUS_SOURCES).length} 个文件）</button></div>
      <pre className="mt-2 max-h-[32rem] overflow-auto border border-line bg-white p-2 text-[11px] leading-4 print:max-h-none" data-testid="og-plus-src">{PLUS_SOURCES[pfile]}</pre>

      <h2 id="s12" className="mt-8 text-lg font-medium text-copper">12. 如何实际动手做（我的补充）</h2>
      <p className="text-xs text-ink-soft">把上面每一节对到现实里的步骤。事实只取自你的 md 和 datasheet；没有出处的只写做法，不写数字。台面是简化仿真，实物以实测为准。</p>
      <T t="og-build" head={["步骤", "做什么", "怎么做", "出处"]} rows={BUILD} />
      {SAFETY.map(([h, items]) => <div key={h} className="mt-3" data-testid="og-safety"><h3 className="font-medium text-red-800">⚠️ {h}</h3><ul className="ml-5 list-disc text-xs leading-5">{items.map((x) => <li key={x}>{x}</li>)}</ul></div>)}
    </article>
  );
}
