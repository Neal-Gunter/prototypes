// v24（我的补充）：界面语言切换（中文默认，English 可选，记在本机 localStorage）。
// 词典按“中文原文 → 英文”查；没翻译的字符串原样显示中文，并记进 window.__i18nMissing（走查时如实列出没翻译的地方）。
import { useSyncExternalStore } from "react";

export const LANG_KEY = "ui-lang";
const read = () => { try { return localStorage.getItem(LANG_KEY) === "en" ? "en" : "zh"; } catch { return "zh"; } };
let lang = typeof window === "undefined" ? "zh" : read();
const subs = new Set();
const applyDoc = () => { if (typeof document !== "undefined") document.documentElement.lang = lang === "en" ? "en" : "zh-Hans"; };
applyDoc();
export function getLang() { return lang; }
export function setLang(l) {
  lang = l === "en" ? "en" : "zh";
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* 隐私模式 */ }
  applyDoc();
  for (const f of subs) f();
}
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export function useLang() { return [useSyncExternalStore(subscribe, getLang, () => "zh"), setLang]; }
const missing = typeof window !== "undefined" ? (window.__i18nMissing ||= new Set()) : new Set();
// tr(中文, 可选英文)：英文模式下优先用第二个参数，其次查词典，都没有就显示中文
export function tr(zh, en) {
  if (lang !== "en") return zh;
  if (en != null) return en;
  const v = EN[zh];
  if (v == null) { missing.add(zh); return zh; }
  return v;
}
export function useT() { useLang(); return tr; }

export const EN = {
  // 外框
  "跳到内容": "Skip to content",
  "硬件验证": "Hardware check",
  "概念": "Concept",
  "页面": "Pages",
  "首页": "Home",
  "示例": "Example",
  "工作台": "Workbench",
  "装配台": "Assembly bench",
  "模型 + 功能图": "Model + function map",
  "维修关卡": "Repair levels",
  "零件库": "Parts library",
  "引脚表": "Pinouts",
  "素材与许可": "Credits & licenses",
  "搜索跳转": "Search / jump",
  "命令面板：跳到页面、零件、场景": "Command palette: jump to pages, parts, scenes",
  "早期原型，简化仿真": "Early prototype, simplified simulation",
  "概念演示，不是成品": "Concept demo, not a finished product",
  "硬件验证 · 概念演示": "Hardware check · concept demo",
  "切换界面语言": "Switch UI language",
  // 命令面板
  "首页 ": "Home",
  "模型 + 功能图（上传模型）": "Model + function map (upload a model)",
  "装配台说明": "Assembly bench guide",
  "八爪鱼装配指南": "Octopus build guide",
  "维修关卡编辑器": "Repair level editor",
  "出处与许可": "Credits & licenses",
  "电路练习：Pico + LED + 按键 + 电位器 + 舵机": "Circuit practice: Pico + LED + button + pot + servo",
  "排错练习：1 个虚焊、1 个装反": "Fault finding: 1 cold joint, 1 reversed part",
  "八爪鱼（走路 + 连接实物）": "Octopus (walking + real hardware link)",
  "八爪鱼方案 A": "Octopus plan A",
  "八爪鱼方案 B（小巧版）": "Octopus plan B (compact)",
  "场景": "Scene",
  "零件": "Part",
  "命令面板": "Command palette",
  "搜索页面、零件、场景": "Search pages, parts, scenes",
  "跳到页面、零件、场景…（↑↓ 选，回车打开，Esc 关）": "Jump to a page, part or scene… (↑↓ select, Enter open, Esc close)",
  "结果": "Results",
  "没找到": "No match",
  "正在加载零件索引…": "Loading the parts index…",
  "我的补充 · Ctrl/⌘ + K 随时打开 · 早期原型，简化仿真": "My addition · Ctrl/⌘ + K anytime · early prototype, simplified simulation",
  // 导览
  "新手导览": "Tour",
  "装配": "Assemble",
  "用“手”把零件拖到桌面。零件按真实尺寸，有物理碰撞，不会穿模。": "Use the hand tool to drag parts onto the bench. Parts are real size with physical collisions; nothing passes through anything else.",
  "接线": "Wiring",
  "选一个练习或写装配清单，杜邦线插到真实引脚位置。鼠标停在引脚上能看到引脚名和间距。": "Pick a practice circuit or write a build list; jumper wires go into real pin positions. Hover a pin to see its name and pitch.",
  "万用表": "Multimeter",
  "选“表笔”：左键红笔、右键黑笔，读数在“通电”页。": "Pick the probes: left click = red, right click = black. Readings are on the Power tab.",
  "示波器": "Oscilloscope",
  "看开机、舵机起步时的电压波形（简化仿真）。": "Voltage waveforms at power-up and servo start (simplified simulation).",
  "维修模式": "Repair mode",
  "维修关卡：用表笔和烙铁找出虚焊、装反、断线。": "Repair levels: find cold joints, reversed parts and broken wires with probes and iron.",
  "两千多个真实 CAD 零件，可看尺寸、引脚和碰撞体。": "Over two thousand real CAD parts with sizes, pins and colliders.",
  "上传模型": "Upload a model",
  "上传自己的模型和功能图，拆成模块，再放回装配台。": "Upload your own model and function map, split it into modules, bring it back to the bench.",
  "连接实物": "Real hardware",
  "“八爪鱼”页可以连真实板子，把实测和仿真画在一起对比。": "The Octopus tab can link a real board and plot measurements against the simulation.",
  "上一步": "Back",
  "下一步": "Next",
  "完成": "Done",
  "跳过": "Skip",
  "新手导览（我的补充）": "Tour (my addition)",
  // 装配台
  "零件有真实尺寸（毫米），由 Rapier 刚体引擎做碰撞：零件不会互相穿过去，拖着的零件会被挡住或推开别的零件。": "Parts are real size (mm) and collide through the Rapier rigid-body engine: they never pass through each other, and a dragged part is blocked by or pushes other parts.",
  "排针翻面放（长针朝下，用来插面包板）": "Place headers flipped (long pins down, for the breadboard)",
  "上传自己的 3D 模型 + 功能图 →": "Upload your own 3D model + function map →",
  "（拆模块、绑定功能，再放到这里做碰撞）": "(split modules, bind functions, then collide them here)",
  "打开完整零件库（看尺寸、孔位、许可）": "Open the full parts library (sizes, holes, licenses)",
  "正在加载物理引擎…": "Loading the physics engine…",
  "工具与装配": "Tools",
  "通电": "Power",
  "八爪鱼": "Octopus",
  "练习电路（自动装配到桌面上）": "Practice circuits (auto-assembled on the bench)",
  "导入清单（粘贴文字清单，照着装配）": "Import a build list (paste a text list and build it)",
  "照清单装配": "Build from list",
  "生成装配指南（物料清单、接线表、步骤、.ino，可打印）": "Make a build guide (BOM, wiring table, steps, .ino, printable)",
  "工具": "Tools",
  "手": "Hand",
  "螺丝刀": "Screwdriver",
  "烙铁": "Iron",
  "拆焊": "Desolder",
  "表笔": "Probes",
  "左键拖动零件；右键按住 = 用手拧铜柱 / 螺母（Shift 反拧）": "Left-drag moves parts; hold right = turn a standoff / nut by hand (Shift reverses)",
  "按住螺丝拧紧，Shift + 按住 拧松": "Hold on a screw to tighten, Shift + hold to loosen",
  "按住穿过针脚的焊盘孔焊接；Shift + 按住 = 拆焊（吸掉焊锡）": "Hold on a pad with a pin through it to solder; Shift + hold = desolder",
  "v24 拆焊模式：按住焊点加热吸锡（直插用吸锡器，贴片用吸锡带），约 1 秒松开；按住超过 4 s 焊盘会翘起（估算）": "v24 desolder mode: hold on a joint to heat and remove solder (pump for through-hole, wick for SMD), release after about 1 s; over 4 s lifts the pad (estimate)",
  "左键 = 红表笔，右键或 Shift+左键 = 黑表笔；读数在“通电”页": "Left = red probe, right or Shift+left = black probe; readings are on the Power tab",
  "先涂助焊剂（不涂：焊得慢 2 倍多，提示可能虚焊）": "Apply flux first (without it soldering takes over 2× longer and may leave cold joints)",
  "操作": "Controls",
  "拖动时：滚轮或 Q / E 抬高 / 放低，R 转 90°（Shift+R 反转），按住 Shift 拖 = 用力推开挡路的零件。空白处拖动 = 转视角。": "While dragging: wheel or Q / E raise / lower, R rotates 90° (Shift+R reverses), Shift-drag pushes parts out of the way. Drag empty space to orbit.",
  "自动装配演示": "Auto-assembly demo",
  "停止": "Stop",
  "清空桌面": "Clear bench",
  "显示碰撞盒（调试）": "Show colliders (debug)",
  "这里简化了什么": "What is simplified here",
  "选中：": "Selected: ",
  "拆焊返修": "Desolder & rework",
  "（我的补充 · 简化规则，阈值为估算）": "(my addition · simplified rules, thresholds are estimates)",
  "拿下来复用": "Lift off to reuse",
  "没有焊点": "No joints",
  "飞线补救": "Jumper-wire repair",
  "贴到转接板上": "Mount on breakout",
  "已在转接板上": "On a breakout",
  // 说明页标题
  "装配台说明（早期原型，简化仿真）": "Assembly bench guide (early prototype, simplified simulation)",
};
