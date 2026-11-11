// v44：核对浅色 / 深色两套 token 的对比度（正文 ≥ 4.5:1，焦点环和描边 ≥ 3:1）。早期原型，简化仿真。
import { LIGHT, DARK, CH_COLOR, CH_INK, CHART_INK, CHART_ON_DARK } from "../src/ui/palette.js";

const lum = (hex) => {
  const h = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = rgb.map(f);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const cr = (a, b) => {
  const L1 = lum(a), L2 = lum(b);
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
};

const MATH_INK = "#8a4a14", MATH_COLOR = "#e09a5a";
const pairs = [];
const add = (theme, kind, min, fg, bg, label) => pairs.push({ theme, kind, min, fg, bg, label, r: cr(fg, bg) });

for (const [name, C] of [["light", LIGHT], ["dark", DARK]]) {
  for (const bg of [["paper", C.paper], ["paper-2", C.paper2]]) {
    add(name, "text", 4.5, C.ink, bg[1], `ink on ${bg[0]}`);
    add(name, "text", 4.5, C.inkSoft, bg[1], `ink-soft on ${bg[0]}`);
    add(name, "text", 4.5, C.copper, bg[1], `copper on ${bg[0]}`);
    add(name, "text", 4.5, C.copperDeep, bg[1], `copper-deep on ${bg[0]}`);
    add(name, "text", 4.5, C.mask, bg[1], `mask on ${bg[0]}`);
    add(name, "text", 4.5, C.mark, bg[1], `mark on ${bg[0]}`);
    add(name, "border", 3, C.line, bg[1], `line on ${bg[0]}`);
    add(name, "border", 3, C.copperDeep, bg[1], `focus outer (copper-deep) on ${bg[0]}`);
  }
  add(name, "text", 4.5, C.paper, C.copper, "paper on copper (button label)");
  add(name, "text", 4.5, C.paper2, C.mask, "paper-2 on mask");
  add(name, "text", 4.5, C.paper2, C.mark, "paper-2 on mark");
}

// 浅色焦点内环：paper-2 描边在墨底 / 铜底上 ≥ 3:1
add("light", "border", 3, LIGHT.paper2, LIGHT.ink, "focus inner (paper-2) on ink");
add("light", "border", 3, LIGHT.paper2, LIGHT.copper, "focus inner (paper-2) on copper");
// 深色焦点：内环 paper（深）对外环铜深（浅），至少一边对当前底 ≥ 3:1
add("dark", "border", 3, DARK.paper, DARK.copper, "focus inner (paper) on copper");
add("dark", "border", 3, DARK.copperDeep, DARK.paper, "focus outer (copper-deep) on paper");
add("dark", "border", 3, DARK.copperDeep, DARK.paper2, "focus outer (copper-deep) on paper-2");

for (const [i, c] of CH_INK.entries()) add("light", "text", 4.5, c, LIGHT.paper2, `CH_INK[${i}] on paper-2`);
for (const [i, c] of CH_COLOR.entries()) add("dark", "text", 4.5, c, DARK.paper2, `CH_COLOR[${i}] on paper-2`);
for (const [i, c] of CHART_INK.entries()) add("light", "text", 4.5, c, LIGHT.paper2, `CHART_INK[${i}] on paper-2`);
for (const [i, c] of CHART_ON_DARK.entries()) add("dark", "text", 4.5, c, DARK.paper2, `CHART_ON_DARK[${i}] on paper-2`);
add("light", "text", 4.5, MATH_INK, LIGHT.paper2, "MATH_INK on paper-2");
add("dark", "text", 4.5, MATH_COLOR, DARK.paper2, "MATH_COLOR on paper-2");

// 警示底（深色里的手动映射）
add("dark", "text", 4.5, "#f0d08a", "#3a2e18", "amber text on remapped amber-50");
add("dark", "text", 4.5, "#f0a098", "#3a201c", "red text on remapped red-50");
add("dark", "text", 4.5, "#8fd4a0", "#1c3224", "green text on remapped green-50");
add("dark", "text", 4.5, DARK.ink, "#3a2e18", "ink on remapped amber-50");

let fail = 0;
for (const p of pairs) {
  const ok = p.r + 1e-9 >= p.min;
  if (!ok) fail++;
  const mark = ok ? "✓" : "✗";
  if (!ok || process.env.VERBOSE) console.log(`${mark} ${p.theme} ${p.kind} ${p.label}: ${p.r.toFixed(2)} (min ${p.min})`);
}
if (!process.env.VERBOSE) {
  const bad = pairs.filter((p) => p.r + 1e-9 < p.min);
  for (const p of bad) console.log(`✗ ${p.theme} ${p.kind} ${p.label}: ${p.r.toFixed(2)} (min ${p.min})`);
}
console.log(`theme-contrast-test：${pairs.length - fail} 通过 / ${fail} 失败，共 ${pairs.length} 组`);
process.exit(fail ? 1 : 0);
