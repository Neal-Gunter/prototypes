// v43：示波器光标换算（时间 / 电压）的单元测试。node scripts/scope-cursors-test.mjs
import { clamp01, pairOr, voltAtFrac, fracAtVolt, deltaV, timeAtFrac, deltaT, invDeltaT, CUR_DEFAULT, VCUR_DEFAULT } from "../src/repair/scopeCursors.js";
import { partTipText, highlightBox } from "../src/assembly/ui/partTip.js";

let pass = 0, fail = 0;
const ok = (n, c, info = "") => { if (c) pass++; else fail++; console.log(c ? "PASS" : "FAIL", n, info); };
const near = (a, b, e = 1e-9) => Number.isFinite(a) && Math.abs(a - b) <= e;

ok("clamp01 裁到 0–1", clamp01(-1) === 0 && clamp01(2) === 1 && clamp01(0.4) === 0.4);
ok("pairOr 缺省和裁剪", pairOr(null).join() === CUR_DEFAULT.join() && pairOr(["0.1", "1.5"]).join() === "0.1,1");
ok("VCUR 缺省", pairOr(undefined, VCUR_DEFAULT).join() === "0.3,0.7");

const ch = { vdiv: 1, off: 0 };
ok("屏幕顶 = +4 V（1 V/div、无偏移）", near(voltAtFrac(0, ch), 4));
ok("屏幕中 = 0 V", near(voltAtFrac(0.5, ch), 0));
ok("屏幕底 = −4 V", near(voltAtFrac(1, ch), -4));
ok("偏移 −2：中线读 +2 V", near(voltAtFrac(0.5, { vdiv: 1, off: -2 }), 2));
ok("fracAtVolt 是 voltAtFrac 的逆", near(fracAtVolt(voltAtFrac(0.25, ch), ch), 0.25) && near(voltAtFrac(fracAtVolt(1.5, { vdiv: 0.5, off: 0 }), { vdiv: 0.5, off: 0 }), 1.5));
ok("ΔV 与顺序有关（下减上）", near(deltaV(0.25, 0.75, ch), voltAtFrac(0.75, ch) - voltAtFrac(0.25, ch)));

ok("无抓波时 Δt = 时基×10×Δf", near(deltaT(0.3, 0.7, null, 1e-3), 0.004));
ok("1/Δt", near(invDeltaT(0.004), 250) && invDeltaT(0) == null);
const cap = { t: [0, 0.001, 0.002, 0.003, 0.004], W: 0.004 };
ok("有抓波时用采样时刻", near(timeAtFrac(0, cap, 1e-3), 0) && near(timeAtFrac(1, cap, 1e-3), 0.004) && near(deltaT(0, 1, cap, 1e-3), 0.004));

const tipZh = partTipText({ name: "LED 5 mm", name_zh: "5 mm 发光二极管", dims_mm: { x: 5, y: 8, z: 5 }, spec: "红 2.0 V typ" }, "zh");
const tipEn = partTipText({ name: "LED 5 mm", name_zh: "5 mm 发光二极管", dims_mm: { x: 5, y: 8, z: 5 }, spec: "红 2.0 V typ" }, "en");
ok("提示中文用 name_zh 且含尺寸和规格", tipZh.name === "5 mm 发光二极管" && /5 × 8 × 5 mm/.test(tipZh.spec) && /2\.0 V/.test(tipZh.spec));
ok("提示英文用 name", tipEn.name === "LED 5 mm" && /5 × 8 × 5 mm/.test(tipEn.spec));

const box = highlightBox({ colliders: [{ c: [0, 0.5, 0], h: [1, 0.5, 0.4] }] });
ok("描边盒子包住碰撞体并略放大", near(box.c[1], 0.5) && box.s[0] > 2 && box.s[0] < 2.2);

console.log(`\n合计 ${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
