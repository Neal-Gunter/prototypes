// 装配指南：把台面上的装配“搬到现实”——物料清单、接线表、步骤、对照读数、固件下载。可直接打印。
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SAFETY } from "../assembly/guide.js";

const save = (name, text, type = "text/plain") => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
const fmtTime = (iso) => new Date(iso).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) + "（北京时间）";

export default function GuidePage() {
  const [params, setParams] = useSearchParams();
  const [g, setG] = useState(null);
  const [err, setErr] = useState(null);
  const local = (() => { try { return JSON.parse(localStorage.getItem("asm-guide") || "null"); } catch { return null; } })();
  const src = params.get("src") || (local ? "bench" : "default");
  useEffect(() => {
    document.title = "装配指南 · 硬件工作台";
    if (src === "bench" && local) { setG(local); return; }
    fetch("/guides/electrics.json").then((r) => r.json()).then(setG).catch((e) => setErr(String(e)));
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (g && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView(); }, [g]);
  if (err) return <p className="p-8 text-red-700">指南加载失败：{err}</p>;
  if (!g) return <p className="p-8 text-ink-soft">正在加载装配指南…</p>;
  const pcs = g.bom.reduce((n, b) => n + b.qty, 0);
  return (
    <article className="guide mx-auto w-full max-w-4xl px-4 py-6 text-sm leading-6" data-testid="guide">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link to="/assembly" className="underline">← 回装配台</Link>
        <span className="text-ink-soft">来源：</span>
        <button type="button" onClick={() => setParams({ src: "default" })} aria-pressed={src === "default"} className={`min-h-8 border px-2 ${src === "default" ? "border-ink bg-ink text-paper-2" : "border-line bg-white"}`}>默认电路练习</button>
        <button type="button" disabled={!local} onClick={() => setParams({ src: "bench" })} aria-pressed={src === "bench"} className={`min-h-8 border px-2 disabled:opacity-40 ${src === "bench" ? "border-ink bg-ink text-paper-2" : "border-line bg-white"}`} title={local ? "" : "先在装配台点“生成装配指南”"}>我桌面上的电路</button>
        <span className="flex-1" />
        <button type="button" onClick={() => window.print()} className="min-h-8 border border-ink px-3" data-testid="guide-print">打印 / 存成 PDF</button>
        {g.sketch && <button type="button" onClick={() => save("sketch.ino", g.sketch)} className="min-h-8 border border-ink bg-ink px-3 text-paper-2" data-testid="guide-ino">下载 .ino</button>}
        {g.listText && <button type="button" onClick={() => save("装配清单.txt", g.listText)} className="min-h-8 border border-line bg-white px-3">下载清单</button>}
      </div>

      <header className="border-b border-line pb-3">
        <p className="text-xs text-copper">早期原型，简化仿真 · 读数是模拟值，不是实测</p>
        <h1 className="text-2xl font-medium">装配指南：{g.title}</h1>
        <p className="text-ink-soft">生成于 {fmtTime(g.made)} · {g.bom.length} 种 / {pcs} 件物料 · {g.nets.length} 条接线 · 从装配台上实际装好的状态导出（同一套插接、焊接、碰撞规则）</p>
      </header>

      <section className="mt-5 break-inside-avoid">
        <h2 className="text-lg font-medium">1. 物料清单（BOM）</h2>
        <p className="text-xs text-ink-soft">尺寸取自 3D 模型的包围盒（长 × 宽 × 高），标“估算”的没有查到原始资料。链接是资料或模型来源，不是购买推荐，也不含价格。</p>
        <table className="mt-2 w-full border-collapse text-left text-xs" data-testid="guide-bom">
          <thead><tr className="border-b border-ink"><th className="py-1 pr-2">#</th><th className="pr-2">名称 / 规格</th><th className="pr-2">数量</th><th className="pr-2">位号</th><th className="pr-2">尺寸</th><th>资料</th></tr></thead>
          <tbody>
            {g.bom.map((b, i) => (
              <tr key={b.id} className="border-b border-line align-top">
                <td className="py-1 pr-2">{i + 1}</td>
                <td className="pr-2"><span className="font-medium">{b.name}</span>{b.spec && <span className="block text-ink-soft">{b.spec}</span>}</td>
                <td className="pr-2">{b.qty}</td>
                <td className="pr-2">{b.refs.join(" ")}</td>
                <td className="pr-2">{b.dims}{/估算/.test(b.dims_src || b.dims) && <span className="text-copper"> 估算</span>}</td>
                <td>{b.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="mr-2 block break-all underline">{l.zh}</a>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-ink-soft">另外需要：电烙铁和烙铁架、焊锡丝、助焊剂、斜口钳、万用表、一台装好 Arduino IDE 的电脑（具体型号不限）。</p>
      </section>

      <section className="mt-6 break-inside-avoid">
        <h2 className="text-lg font-medium">2. 接线表（开发板针脚 → 连到哪里）</h2>
        <table className="mt-2 w-full border-collapse text-left text-xs" data-testid="guide-nets">
          <thead><tr className="border-b border-ink"><th className="py-1 pr-2">开发板针脚</th><th className="pr-2">物理脚号</th><th className="pr-2">连到</th><th>模拟电压</th></tr></thead>
          <tbody>
            {g.nets.map((n, i) => (
              <tr key={i} className="border-b border-line align-top"><td className="py-1 pr-2 font-mono">{n.pin}</td><td className="pr-2">{n.phys}</td><td className="pr-2">{n.to.join("，")}</td><td className="font-mono">{n.v == null ? "—" : `${n.v.toFixed(2)} V`}</td></tr>
            ))}
          </tbody>
        </table>
        {g.holes.length > 0 && <>
          <h3 className="mt-4 font-medium">逐个零件插在哪个孔</h3>
          <p className="text-xs text-ink-soft">面包板孔名：a–j 行 + 1–30 列；a–e 一组、f–j 一组，同一列的 5 个孔是通的。</p>
          <table className="mt-1 w-full border-collapse text-left text-xs" data-testid="guide-holes">
            <tbody>{g.holes.map((h, i) => <tr key={i} className="border-b border-line align-top"><td className="py-1 pr-2 font-mono">{h.ref}</td><td className="pr-2">{h.what}</td><td className="font-mono">{h.where}</td></tr>)}</tbody>
          </table>
        </>}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">3. 装配和焊接步骤</h2>
        <ol className="mt-2 list-decimal pl-5" data-testid="guide-steps">
          {g.steps.map((s, i) => <li key={i} className="mb-2 break-inside-avoid"><span className="font-medium">{s.t}</span>{s.solder && <span className="ml-1 border border-copper px-1 text-[10px] text-copper">焊接</span>}<br /><span className="text-ink-soft">{s.d}</span></li>)}
        </ol>
      </section>

      <section className="mt-6 break-inside-avoid">
        <h2 className="text-lg font-medium">4. 对照现实：用万用表量一量</h2>
        <p className="text-xs text-ink-soft">左边是模拟算出来的值，右边是在实物上怎么量。差得很多，通常是接错孔、虚焊或零件规格不同；差一点是正常的（元件误差、USB 电压、万用表精度）。</p>
        <table className="mt-2 w-full border-collapse text-left text-xs" data-testid="guide-real">
          <thead><tr className="border-b border-ink"><th className="py-1 pr-2">量什么</th><th className="pr-2">模拟读数</th><th>实物上怎么量 / 正常范围</th></tr></thead>
          <tbody>{g.real.map((r, i) => <tr key={i} className="border-b border-line align-top"><td className="py-1 pr-2">{r.what}</td><td className="pr-2 font-mono">{r.sim}</td><td>{r.how}</td></tr>)}</tbody>
        </table>
      </section>

      {g.sketch && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">5. 固件（Arduino 风格，按接线自动生成）</h2>
          <pre className="mt-2 overflow-x-auto border border-line bg-white p-2 font-mono text-[11px] leading-4" data-testid="guide-code">{g.sketch}</pre>
        </section>
      )}

      <section id="model-lab" className="mt-6 border border-line bg-white p-3" data-testid="guide-model-lab">
        <h2 className="text-lg font-medium">模型 + 功能图 + 关节（v11–v12，早期原型，简化仿真）</h2>
        <p className="text-xs text-ink-soft">在 <Link className="underline" to="/assembly/model">/assembly/model</Link> 上传自己的 3D 模型和一张功能图，把“哪个功能由哪些模块组成”画出来，再把模型放到装配台上做碰撞。🔒 文件只在本机浏览器里解析，不上传；工程存在本机 IndexedDB。</p>
        <ol className="mt-2 list-decimal pl-5 text-xs leading-5">
          <li><b>上传 3D 模型</b>：GLB / glTF（内嵌资源）/ OBJ / STL / STEP。上限：GLB 40 MB、STEP 15 MB。检查“尺寸和单位”：单位（毫米 / 厘米 / 米 / 英寸）、缩放、哪个轴朝上；旁边的蓝色卡片是一张银行卡（85.60 × 53.98 mm），用来目测尺寸对不对。</li>
          <li><b>模块</b>：按组 / 网格自动拆成模块。可以“按连通块拆网格”、在“选网格”模式点网格再“拆成新模块”、勾选多个“合并”、改名、改颜色、选碰撞体（凸包 / 方块）、材料（算估算质量）或直接填实测质量。</li>
          <li><b>上传功能图</b>：PNG / JPG / SVG（含脚本或外链的 SVG 会被拒绝），或 PDF 的某一页（转成图片）。在“画热点框”模式拖出矩形 → 新功能，填名称、类型、引脚 / 信号标注。</li>
          <li><b>绑定</b>：“绑定”模式下先点热点（或左边的功能），再点 3D 里的模块（再点一次取消）；也可以在“从列表里选模块”里勾。</li>
          <li><b>双向高亮</b>：点热点 → 3D 高亮它的模块；点 3D 模块 → 热点和左边的树高亮它属于的功能。</li>
          <li><b>看法</b>：隐藏 / 隔离选中模块、隔离一个功能、按模块或按功能爆炸。左边的树是 功能 → 模块 → 网格。</li>
          <li><b>导出 / 导入</b>：“导出工程 .zip”= project.json + 模型 + 功能图，可以在别的电脑上“导入工程 .zip”。</li>
          <li><b>放到装配台</b>：整个模型作为一个刚体放上桌面，每个模块一个凸包或方块碰撞体，和桌面、其他零件碰撞，不穿模。</li>
          <li><b>内置示例</b>：“内置示例：八爪鱼”= v10 紧凑无线版，27 个模块、9 个功能（示意图，不是原理图），质量按 v10 质量表约 117 g（估算）。</li>
          <li><b>关节（v12）</b>：点“加关节”，依次点父模块（不动的，比如底座）→ 子模块（会动的）→ 表面上的铰接点。类型：转动 / 滑动 / 球关节 / 固定。右边改铰接点（mm）、轴（X / Y / Z 或数字）、限位、驱动（MG90S / SG51R 用 datasheet 数字，自定义的标估算）。</li>
          <li><b>运动</b>：点“▶ 运动”，每个关节一个滑块和“测试”；“放测试方块”看能不能推动东西；压到地面会显示“堵转 / 被挡住”。</li>
          <li><b>功能 ↔ 关节 / 姿态 / 时间轴</b>：在功能面板勾关节，选中功能就播放它的关节；“存当前姿态”，再用关键帧排成时间轴播放。关节、姿态、时间轴都跟着工程 .zip 导出，放到装配台后也能操作。</li>
        </ol>
        <p className="mt-2 text-xs text-ink-soft">简化：球关节没有马达，限位是软的（硬扳能超出几度）；关节两侧那一对不互相碰撞；碰撞是凸包 / 方块（凹处被填平）；质量是体积 × 密度的估算；功能绑定只是标签，不做电路仿真；单位靠猜，猜错请手动改；贴图、动画忽略；Draco 压缩和引用外部文件的 glTF 不支持。</p>
      </section>

      <section id="repair" className="mt-6 border border-line bg-white p-3" data-testid="guide-repair">
        <h2 className="text-lg font-medium">维修关卡（v17，早期原型，简化仿真）</h2>
        <p className="text-xs text-ink-soft">在 <Link className="underline" to="/repair">/repair</Link> 练习排查故障：客户描述 → 看现象 → 量电压 / 电阻 / 通断 → 找到根本原因 → 断电拔电池后再动烙铁 → 交付验收。读数来自仿真，不是实测；<b>不替代真实安全培训</b>。</p>
        <ol className="mt-2 list-decimal pl-5 text-xs leading-5">
          <li><b>先简单后复杂</b>：电池 / 电源 → 开关 / 插头 → 焊点 → 零件。量电压比换零件快。</li>
          <li><b>断电再动手</b>：关开关不等于没电，电池还接着就还有电。带电焊接会被拦下并扣分。</li>
          <li><b>量电阻要断电</b>：通电时电阻档读数不准，还可能伤表。</li>
          <li><b>看清再换</b>：放大镜读色环和芯片丝印；换件按丝印的阻值、方向和型号。</li>
          <li><b>细线压降</b>：线越细越长电阻越大（实心铜线 20 °C：22AWG 约 0.053 Ω/m，30AWG 约 0.339 Ω/m），舵机一起动就把电压拉低。</li>
          <li><b>自己出题</b>：编辑器里选板子、挑故障、写提示；也能把装配台上的电路直接导入成关卡，导出 JSON 给别人玩。</li>
        </ol>
        <p className="mt-2 text-xs text-red-800">所有关卡都是低压直流。永远不要用表笔去碰 220 V 市电（插座、适配器里面、电源板的高压一侧）——那需要专门的培训和工具。</p>
      </section>

      <section id="scope" className="mt-6 border border-line bg-white p-3" data-testid="guide-scope">
        <h2 className="text-lg font-medium">示波器和时域模式（v18，早期原型，简化仿真）</h2>
        <p className="text-xs text-ink-soft">万用表只看平均值；电压“一下子”跌下去、纹波、噪声要用示波器看。在 <Link className="underline" to="/repair">/repair</Link> 打开“时域”，或玩“示波器关卡”。读数来自仿真，不是实测；<b>不替代真实安全培训</b>。</p>
        <ol className="mt-2 list-decimal pl-5 text-xs leading-5">
          <li><b>夹探头</b>：选示波器（键 7），点测试点或零件脚，依次夹到 CH1…CH4。</li>
          <li><b>选抓法</b>：一直开着（稳态）/ 抓开机那一下 / 抓舵机起步那一下；时基调到 1–5 µs/div 才看得到升压的开关纹波，配合 AC 耦合把每格电压调小。</li>
          <li><b>触发</b>：选通道、上升 / 下降沿、电平；“单次”等不到边沿时会显示“等待触发”。</li>
          <li><b>光标和数学</b>：点屏幕放光标读 Δt、ΔV；数学 CH1 − CH2 看两块板之间的地压差。</li>
          <li><b>地夹</b>：探头的地在仪器里互相连通并接大地，只能夹在地上；测两块板的地差用两个通道 + 数学，不要把地夹夹到别的节点。</li>
          <li><b>储能电容</b>：舵机起步电流大，靠近舵机的大电解电容顶住瞬间；电解电容有极性，会老化（容量掉、ESR 变大）。</li>
          <li><b>板间连线</b>：插头端子压不好会有接触电阻，大电流时压降明显；“重新插拔”修不好，要重新压端子。</li>
        </ol>
        <p className="mt-2 text-xs text-ink-soft">简化（我的补充）：理想元件，没有 EMI、温度、PCB 寄生，只算写明的 ESR、线阻、端子接触电阻、电池内阻；升压和舵机是行为模型，数值多为估算。</p>
      </section>

      <section id="bench-netlist" className="mt-6 border border-line bg-white p-3" data-testid="guide-bench-netlist">
        <h2 className="text-lg font-medium">示波器看我的电路（v19，早期原型，简化仿真）</h2>
        <p className="text-xs text-ink-soft">在 <Link className="underline" to="/assembly?scene=electrics">装配台</Link> 的“电”页签打开示波器，默认是“我的电路（台面）”：程序按你在 3D 台面上实际放的零件和接的线生成电路再仿真。原来的参考板示波器保留为“备用”，它不是你的台面电路。</p>
        <ol className="mt-2 list-decimal pl-5 text-xs leading-5">
          <li><b>先看网表检查</b>：有<b>悬空</b>网络（线没接到电源或地）、短路、缺地、不支持的零件会直接写出来；有致命错误就不仿真。</li>
          <li><b>探头</b>：任意零件脚或导线端点都能夹。</li>
          <li><b>实时改</b>：换电容、电池新旧、每根线的线规、拔掉一根线，波形自动重抓；灰色虚线是改之前的波形；“撤销”一步步退回。</li>
          <li><b>自适应步长</b>：勾上后求解器按误差自己调步长，并在开关、欠压复位、限流这些事件处对齐；结果和固定步长接近，但不一定更快。</li>
          <li><b>八爪鱼 what-if</b>：选电容 / 电池 / 线规组合，表里给出复位次数、最低电压、舵机起步跌落、电池峰值电流。</li>
        </ol>
        <p className="mt-2 text-xs text-ink-soft">简化（我的补充）：线阻、端子接触电阻、主控和 LDO 电流、舵机电流、电池老化内阻都是<b>估算</b>；面包板上的传感器等未建模零件只提示、不参与仿真；同一台面多块主控时只有第一块驱动舵机信号。读数不是实测，<b>不替代真实安全培训</b>。</p>
      </section>
      <section className="mt-6 break-inside-avoid border border-copper p-3" data-testid="guide-safety">
        <h2 className="font-medium">安全提示</h2>
        <p className="text-xs text-copper">{SAFETY[0]}</p>
        <ul className="mt-1 list-disc pl-5 text-xs">{SAFETY.slice(1).map((s) => <li key={s}>{s}</li>)}</ul>
      </section>
      <p className="mt-4 text-xs text-ink-soft">本指南由早期原型自动生成，模拟做了简化（见装配台“这里简化了什么”）。动手前请以零件数据手册为准。</p>
    </article>
  );
}
