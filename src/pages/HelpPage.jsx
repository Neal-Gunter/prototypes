// v27（我的补充）：使用说明页。中文 / English 两套都是手写（不是机翻），跟着右上角的语言开关切换。
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { containerClass } from "../container";
import { useLang, tr } from "../i18n";

const T = (zh, en) => ({ zh, en });
const QUICK = [
  T("右上角 EN / 中文 切换界面语言；Ctrl/⌘ K 打开“搜索跳转”，输入页面、零件或关卡名直接跳过去。", "Use EN / 中文 at the top right to switch the UI language. Press Ctrl/⌘ K to open the command palette and jump to any page, part or repair level by name."),
  T("想先看看能做什么：打开「示例」，或者在装配台载入一个示例场景（下面有链接）。", "To see what the site can do, open Example, or load one of the example scenes on the assembly bench (links below)."),
  T("想从零做一只八爪鱼机器人：打开「动手做」，按步骤走，最后生成制作单和实测对比表。", "To build the octopus robot from scratch, open Build and follow the steps. At the end you get a build sheet and a measurement check sheet."),
  T("想练排错：打开「维修关卡」，从 1 星开始。每关都有 3 级提示（会扣分）。", "To practise troubleshooting, open Repair levels and start with the 1-star levels. Every level has 3 hints (each costs points)."),
  T("所有数据只存在你这台浏览器里（localStorage / IndexedDB），不会上传。", "Everything you make is stored only in this browser (localStorage / IndexedDB). Nothing is uploaded."),
];
const MODES = [
  { id: "bench", to: "/assembly", t: T("装配台（物理台面）", "Assembly bench (physics)"), d: T("把零件库里的零件拖到桌面上，零件有碰撞体、不会互相穿过。可以把零件插进面包板孔、接杜邦线、接 USB，然后看简化电路仿真（LED 亮不亮、舵机转不转）。“导入”框可以粘贴一份文字清单重建整个电路。", "Drag parts from the library onto the desk. Parts have colliders and do not pass through each other. Plug parts into breadboard holes, add Dupont wires and USB, then watch a simplified circuit simulation (does the LED light, does the servo move). The Import box rebuilds a whole circuit from a text list.") },
  { id: "model", to: "/assembly/model", t: T("模型实验室（上传模型 + 功能图）", "Model lab (upload a model + function map)"), d: T("上传自己的 GLB / STL 模型，把网格分成模块，画功能图，标出关节，再把它放到装配台上一起仿真。也有内置示例模型。", "Upload your own GLB / STL model, split the mesh into modules, draw a function map, mark joints, then drop it onto the assembly bench and simulate it with everything else. Built-in demo models are included.") },
  { id: "joints", to: "/assembly?scene=octo", t: T("关节和步态", "Joints and gaits"), d: T("模型实验室的“关节”模式里给模块加转动 / 滑动关节；装配台的八爪鱼面板里有步态编辑器（每条腿的相位、幅度、频率），可以看它在桌面上走。", "In the model lab's Joint mode, add revolute or sliding joints between modules. The octopus panel on the assembly bench has a gait editor (phase, amplitude and frequency per leg) so you can watch the robot walk on the desk.") },
  { id: "link", to: "/assembly?scene=octo", t: T("串口 / 蓝牙连接实物", "Serial / Bluetooth link to real hardware"), d: T("八爪鱼面板里的“连接实物”用浏览器的 Web Serial / Web Bluetooth（需要 Chrome 或 Edge，并且你自己点授权）。没有实物时可以用内置的模拟设备测试。按 Esc 是急停。", "Connect to real hardware from the octopus panel. It uses the browser's Web Serial / Web Bluetooth (Chrome or Edge only, and you grant access yourself). Without hardware you can test against the built-in simulated device. Esc is the emergency stop.") },
  { id: "repair", to: "/repair", t: T("维修关卡", "Repair levels"), d: T("每关是一块有故障的板子和一段客户描述。用万用表、放大镜、镊子、烙铁等工具找出故障并修好，最后交付。评分看用时、是否带电焊接、换错零件和提示次数。还有关卡编辑器，可以自己出题、导出 / 导入。", "Each level is a faulty board plus a customer complaint. Use the multimeter, magnifier, tweezers, soldering iron and other tools to find the fault, fix it, then deliver. The score counts time, soldering while powered, wrong parts and hints used. The level editor lets you write your own levels and export or import them.") },
  { id: "scope", to: "/repair", t: T("示波器", "Oscilloscope"), d: T("维修关卡里有需要示波器的关卡（工具 7）；装配台的电路也可以打开示波器看开机波形、把探头夹在任意导线端点上。波形来自简化模型，不是实测。", "Some repair levels need the oscilloscope (tool 7). Circuits on the assembly bench can also open a scope to see power-up waveforms, with probes on any wire end. The waveforms come from a simplified model and are not measured.") },
  { id: "solder", to: "/workbench", t: T("焊接和返修（工作台）", "Soldering and rework (workbench)"), d: T("剥线、上助焊剂、加热焊盘、送锡、用吸锡带 / 吸锡器返修，并用万用表检查。装配台还有贴片转接板练习（TSSOP / SOIC / SOT-23 / 0805）。", "Strip wire, apply flux, heat a pad, feed solder, rework with braid or a solder pump, then check with the multimeter. The assembly bench also has an SMD breakout practice scene (TSSOP / SOIC / SOT-23 / 0805).") },
  { id: "parts", to: "/parts", t: T("零件库", "Parts browser"), d: T("2500 多个零件，每个都有尺寸来源、许可和碰撞体信息。可以按名称、类别、接口搜索，点开看 3D 模型和引脚。", "Over 2,500 parts, each with its dimension source, licence and collider details. Search by name, category or interface, then open a part to see its 3D model and pins.") },
  { id: "teardown", to: "/teardown", t: T("拆解模式（v29）", "Teardown mode (v29)"), d: T("一步一步拆开微型舵机、单节 18650 充电宝和 USB 小风扇：先读安全提示（有电池先处理电池、防静电、停止点），勾选材料和完成的步骤（存在本机），看本项目自绘的插图和交互爆炸图，最后把拆下的模块存进本机的零件库（零件库里选“拆解所得”），拿到装配台上用。指南按公开资料整理，未经实物验证；零件库里没有的模块用标明“近似件”的程序生成件代替。", "Take apart a micro servo, a one-cell 18650 power bank and a USB desk fan step by step. Read the safety notes first (battery first, ESD, stop points), tick off materials and finished steps (saved in this browser), look at the diagrams and the interactive exploded view drawn by this project, then save the removed modules to the parts library in this browser (choose 'From teardowns' in the parts list) and use them on the assembly bench. The guides are compiled from public information and not verified on real devices. Modules the library does not have are stood in for by procedural parts marked 'approximate'.") },
  { id: "project", to: "/project", t: T("动手做 + 实测对比", "Build project + measurement check"), d: T("引导项目一步一步做出八爪鱼：选方案、生成 BOM 和制作单；做好后在“实测对比”里填万用表读数，和估算值对比，并可以按你的实测校准。", "The guided project builds the octopus step by step: choose a plan, then generate a BOM and a build sheet. Once it is built, enter your multimeter readings in the measurement check to compare them with the estimates and calibrate to your own measurements.") },
];
const SCENES = [
  ["electrics", T("电路练习：Pico + LED + 按键 + 电位器 + 舵机", "Circuit practice: Pico + LED + button + pot + servo")],
  ["fault", T("排错练习：1 个虚焊、1 个装反", "Fault practice: 1 cold joint, 1 reversed part")],
  ["smd", T("贴片转接板练习", "SMD breakout practice")],
  ["blink", T("入门：Pico 点亮一个 LED（v27 新）", "Starter: Pico lights one LED (new in v27)")],
  ["button", T("按键 + LED（v27 新）", "Button + LED (new in v27)")],
  ["potservo", T("电位器控制舵机角度（v27 新）", "Potentiometer sets servo angle (new in v27)")],
  ["fault2", T("排错练习 2：舵机信号脚虚焊（v27 新）", "Fault practice 2: cold joint on the servo signal pin (new in v27)")],
  ["octo", T("八爪鱼（走路 + 连接实物）", "Octopus robot (walking + real-hardware link)")],
];
const KEYS = [
  [T("全站", "Everywhere"), [["Ctrl/⌘ K", T("打开 / 关闭搜索跳转", "Open / close the command palette")], ["Esc", T("关闭弹窗", "Close a dialog")]]],
  [T("装配台（拖着零件时）", "Assembly bench (while dragging a part)"), [["R / Shift+R", T("旋转 90°（反向）", "Rotate 90° (reverse)")], ["Q / PageUp", T("抬高", "Lift")], ["E / PageDown", T("放低", "Lower")]]],
  [T("工作台（焊接）", "Workbench (soldering)"), [["1–9", T("选工具：手、剥线钳、导线、助焊剂、烙铁、吸锡带、吸锡器、万用表、螺丝刀", "Pick a tool: hand, wire stripper, wire, flux, iron, braid, solder pump, multimeter, screwdriver")], [T("空格（按住）", "Space (hold)"), T("送锡", "Feed solder")], ["Ctrl/⌘ Z", T("撤销", "Undo")], ["Ctrl/⌘ Y, Ctrl/⌘ Shift Z", T("重做", "Redo")], ["Esc", T("回到“手”", "Back to the hand tool")]]],
  [T("维修关卡", "Repair levels"), [["1–8", T("选工具：手、万用表、镊子、烙铁、吸锡带、放大镜、示波器、压线钳", "Pick a tool: hand, multimeter, tweezers, iron, braid, magnifier, scope, crimper")]]],
  [T("连接实物", "Hardware link"), [["Esc", T("急停（连接中）", "Emergency stop (while connected)")]]],
  [T("导览", "Tour"), [["← / →", T("上一步 / 下一步", "Previous / next step")]]],
];
const FAQ = [
  [T("这些读数是真的吗？", "Are these readings real?"), T("不是。电路、物理和示波器都是简化仿真，数值是估算，用来学方法，不能代替实测和规格书。", "No. The circuit, physics and scope are simplified simulations. The numbers are estimates for learning the method; they do not replace real measurements or datasheets.")],
  [T("英文界面为什么有些句子不通顺？", "Why do some English sentences read oddly?"), T("菜单和常用按钮是手写翻译；指南正文、零件说明、提示和仿真消息是离线机器辅助翻译（Argos Translate），会有错。零件名用的是原库的英文名。", "Menus and common buttons are translated by hand. Guide text, part notes, hints and simulation messages use offline machine-assisted translation (Argos Translate) and will contain mistakes. Part names use the original English names from the source libraries.")],
  [T("连接实物没反应？", "The hardware link does nothing?"), T("Web Serial / Web Bluetooth 只在 Chrome / Edge 桌面版（以及安卓 Chrome 的蓝牙）里能用，页面必须是 https，而且要你自己在弹窗里选设备。", "Web Serial / Web Bluetooth only work in desktop Chrome / Edge (and Bluetooth in Chrome on Android), the page must be https, and you choose the device yourself in the browser prompt.")],
  [T("3D 页面很卡？", "3D pages are slow?"), T("关掉阴影或换小一点的窗口；手机上建议先看示例和说明页。没有独立显卡时浏览器会用软件渲染。", "Turn off shadows or use a smaller window. On phones, start with the example and help pages. Without a GPU the browser falls back to software rendering.")],
  [T("我的工程丢了？", "My project disappeared?"), T("数据存在浏览器本地。清理浏览器数据、换浏览器或用无痕窗口都会看不到。重要的工程请用“导出”存成文件。", "Data lives in this browser only. Clearing browser data, switching browsers or using a private window hides it. Export important projects to a file.")],
];
const LIMITS = [
  T("拆解模式（v29）的指南按公开资料整理，未经实物验证：你手上的设备螺丝数量、卡扣、电芯接法都可能不同，以实物为准；有电池的设备务必先处理电池。", "Teardown guides (v29) are compiled from public information and not verified on real devices. Your device may have different screws, clips or cell wiring: trust what you see, and always deal with the battery first."),
  T("拆解模式里的“近似件”（td- 开头）尺寸全是估算、形状是示意；爆炸图位置也是示意。拆解所得的库存只存在这台浏览器里。", "Teardown 'approximate' parts (ids starting with td-) have estimated sizes and illustrative shapes, and exploded-view positions are illustrative too. The teardown inventory lives only in this browser."),
  T("早期原型，简化仿真：电路是直流 / 简化瞬态模型，物理是刚体近似；没有热、没有电磁干扰。", "Early prototype, simplified simulation: the circuit is a DC / simplified transient model and the physics is rigid-body approximation. No heat, no EMI."),
  T("零件碰撞体是凸包 / 方块近似，少数零件的误差超过 3 mm（零件详情里有标注）。", "Part colliders are convex hulls or boxes. A few parts are off by more than 3 mm (noted on the part page)."),
  T("3D 画布里画出来的文字（工具标签、零件标签、万用表屏、串口绘图图例）v28 起也跟着 EN 开关走，最显眼的是手写译文，其余是机翻；机翻部分会有错，可读性测试只能抓明显的坏句，抓不到意思错。", "Since v28, text drawn in the 3D canvas (tool labels, part labels, the meter screen, plot legends) follows the EN toggle too. The most visible labels are hand-translated and the rest is machine-assisted. Machine-translated text will contain errors; the readability test only catches obvious breakage, not wrong meaning."),
  T("八爪鱼指南里的固件源码（含中文注释）有意不翻译，标成中文原文。", "Firmware source code in the octopus guide (with Chinese comments) is deliberately left untranslated and marked as Chinese."),
  T("碰撞体分级（v28）：零件附近没有别的零件时只用外凸包，靠近时换细凸包。零件挤得很密的重场景里几乎所有零件都在接触，省不了多少时间；最大穿透仍比 v26 大（估算）。", "Collider level of detail (v28): a part uses only its outer hull until another part comes close, then switches to its fine hulls. In a dense heavy scene almost every part is in contact, so the saving is small, and maximum penetration is still larger than in v26 (estimate)."),
  T("连接实物只在支持 Web Serial / Web Bluetooth 的浏览器里能用，网站不提供固件烧录以外的设备管理。", "The hardware link needs a browser with Web Serial / Web Bluetooth. The site does no device management beyond flashing firmware."),
  T("费用、价格和规格书数值没有编出来：没有来源的地方都标了“估算”。", "Costs, prices and datasheet values are never made up. Anything without a source is marked as an estimate."),
];

export default function HelpPage() {
  const [lang] = useLang(); const en = lang === "en"; const L = (x) => (en ? x.en : x.zh);
  useEffect(() => { document.title = en ? "Help · prototype" : "使用说明 · 原型"; }, [en]);
  const H2 = ({ id, children }) => <h2 id={id} className="mt-10 border-b border-line pb-1 text-lg font-semibold">{children}</h2>;
  return (
    <div className={containerClass + " py-8"} data-testid="help-page" data-lang={lang} data-no-mt="">
      <p className="text-xs text-ink-soft">{en ? "Early prototype, simplified simulation" : "早期原型，简化仿真"}</p>
      <h1 className="mt-1 text-2xl font-semibold">{en ? "Help" : "使用说明"}</h1>
      <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={en ? "Contents" : "目录"} data-testid="help-toc">
        {[["quick", T("快速上手", "Quick start")], ["modes", T("各个模式", "Modes")], ["scenes", T("示例场景", "Example scenes")], ["keys", T("快捷键", "Keyboard shortcuts")], ["faq", T("常见问题", "FAQ")], ["limits", T("老实说：限制", "Honest limits")]].map(([id, t]) => <a key={id} href={"#" + id} className="inline-flex min-h-6 items-center underline">{L(t)}</a>)}
      </nav>
      <H2 id="quick">{L(T("快速上手", "Quick start"))}</H2>
      <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm" data-testid="help-quick">{QUICK.map((q, i) => <li key={i}>{L(q)}</li>)}</ol>
      <H2 id="modes">{L(T("各个模式", "Modes"))}</H2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {MODES.map((m) => (
          <section key={m.id} className="border border-line p-3" data-testid={"help-mode-" + m.id}>
            <h3 className="font-semibold"><Link to={m.to} className="underline">{L(m.t)}</Link></h3>
            <p className="mt-1 text-sm text-ink-soft">{L(m.d)}</p>
          </section>
        ))}
      </div>
      <H2 id="scenes">{L(T("示例场景", "Example scenes"))}</H2>
      <ul className="mt-3 list-disc space-y-1 pl-6 text-sm" data-testid="help-scenes">{SCENES.map(([k, t]) => <li key={k}><Link to={"/assembly?scene=" + k} className="underline" data-testid={"help-scene-" + k}>{L(t)}</Link></li>)}</ul>
      <H2 id="keys">{L(T("快捷键", "Keyboard shortcuts"))}</H2>
      <div className="mt-3 space-y-4 text-sm" data-testid="help-keys">
        {KEYS.map(([g, rows], i) => (
          <table key={i} className="w-full border-collapse text-left">
            <caption className="text-left font-semibold">{L(g)}</caption>
            <tbody>{rows.map(([k, d], j) => <tr key={j} className="border-t border-line"><td className="w-48 py-1 font-mono text-xs">{typeof k === "string" ? k : L(k)}</td><td className="py-1">{L(d)}</td></tr>)}</tbody>
          </table>
        ))}
      </div>
      <H2 id="faq">{L(T("常见问题", "FAQ"))}</H2>
      <dl className="mt-3 space-y-3 text-sm" data-testid="help-faq">{FAQ.map(([q, a], i) => <div key={i}><dt className="font-semibold">{L(q)}</dt><dd className="text-ink-soft">{L(a)}</dd></div>)}</dl>
      <H2 id="limits">{L(T("老实说：限制", "Honest limits"))}</H2>
      <ul className="mt-3 list-disc space-y-1 pl-6 text-sm" data-testid="help-limits">{LIMITS.map((x, i) => <li key={i}>{L(x)}</li>)}</ul>
      <p className="mt-8 text-xs text-ink-soft">{en ? "This page is written by hand in both languages." : "本页中英文都是手写的。"} <Link to="/credits" className="underline">{tr("素材与许可")}</Link></p>
    </div>
  );
}
export const HELP_COUNTS = { modes: MODES.length, keys: KEYS.reduce((a, [, r]) => a + r.length, 0), faq: FAQ.length, scenes: SCENES.length };
