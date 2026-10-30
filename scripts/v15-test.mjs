// v15：多工况鲁棒搜索 + 横坡侧滑补偿（定向小轮 / 路径保持）+ 评估池 + 240 °/s 限速 + 导出常量
import { runGait } from "../src/gait/octo-measure.js";
import { octoRowGait, octoV14Gait, octoV15Gait } from "../src/gait/octo-best.js";
import { toCtrlHeader, OCTO_CTRL, OCTO_CTRL_WHEEL } from "../src/gait/ctrl.js";
import { toFirmwareHeader } from "../src/gait/gait.js";
import { OCTO_PROCEDURAL } from "../src/assembly/octopus/parts.js";
import { CASTERS } from "../src/assembly/octopus/loco.js";
import { trainConds, heldOutConds, gaitMaxRate, ratePenalty, multiScore, OBJECTIVES, RATE_CAP, SERVO_RATE_MAX } from "../src/gait/search.js";
import { runJob } from "../src/gait/search-job.js";
import { nodePool } from "./node-pool.mjs";
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "  ok " : "  FAIL ") + m); };
const R = async (g, o = {}) => { const r = await runGait({ gait: g, sec: 10, ...o }); r.lp?.world?.free?.(); return r; };
const s3 = (d) => ({ deg: 3, dir: d });
// 1. 支点种类 + 零件
ok(["ball", "lock", "rubber", "wheel"].every((k) => CASTERS[k]), "CASTERS 有 ball / lock / rubber / wheel");
for (const id of ["p-octo-caster-wheel", "p-octo-caster-lock"]) { const p = OCTO_PROCEDURAL.find((q) => q.id === id); ok(p && p.est.length > 0 && /估算/.test(p.dims_src) && /我的补充/.test(p.name_zh), `${id} 在零件库里，尺寸标“估算”、名字标“我的补充”`); }
// 2. 平地：定向小轮不拖慢；锁死万向珠走不动
const rowB = await R(octoRowGait()), rowW = await R(octoRowGait(), { caster: "wheel" }), rowL = await R(octoRowGait(), { caster: "lock" });
ok(Math.abs(rowB.speed - 3.757) < 0.01, `v13 划桨基准 3.757 cm/s 不变（${rowB.speed.toFixed(3)}）`);
ok(Math.abs(rowW.speed - rowB.speed) / rowB.speed < 0.03, `平地定向小轮速度 ${rowW.speed.toFixed(3)} ≈ 万向珠 ${rowB.speed.toFixed(3)}`);
ok(rowL.speed < 0.5, `锁死万向珠平地走不动（${rowL.speed.toFixed(3)} cm/s，诚实结论）`);
// 3. 3° 横坡：定向小轮把侧漂压到 1/3 以下，路径保持再压一半
const cB = await R(octoRowGait(), { slope: s3("cross") }), cW = await R(octoRowGait(), { slope: s3("cross"), caster: "wheel" }), cP = await R(octoRowGait(), { slope: s3("cross"), caster: "wheel", ctrl: OCTO_CTRL_WHEEL });
console.log(`  3° 横坡 row：万向珠 dx ${cB.dx.toFixed(2)} → 定向小轮 ${cW.dx.toFixed(2)} → +路径保持 ${cP.dx.toFixed(2)} cm（速度 ${cB.speed.toFixed(2)} / ${cW.speed.toFixed(2)} / ${cP.speed.toFixed(2)}）`);
ok(Math.abs(cW.dx) < Math.abs(cB.dx) / 3, "定向小轮：横坡侧漂降到万向珠的 1/3 以下");
ok(Math.abs(cP.dx) < Math.abs(cW.dx) * 0.6, "路径保持 PI：再降 40% 以上");
const vP = await R(octoV14Gait(), { slope: s3("crossL"), caster: "wheel", ctrl: OCTO_CTRL_WHEEL }), vW = await R(octoV14Gait(), { slope: s3("crossL"), caster: "wheel" });
ok(Math.abs(vP.dx) < Math.abs(vW.dx) * 0.6 && Math.sign(vW.dx) < 0, `往左的横坡也对（v14：${vW.dx.toFixed(2)} → ${vP.dx.toFixed(2)} cm，路径保持符号正确）`);
// 4. 万向珠上控制拦不住（诚实结论）
const bP = await R(octoRowGait(), { slope: s3("cross"), ctrl: { ...OCTO_CTRL, kPath: 2, kiPath: 0.5 } });
ok(Math.abs(bP.dx) > 20, `万向珠 + 路径保持仍漂 ${bP.dx.toFixed(1)} cm（控制补不了支点往下滚）`);
// 5. 限速 240 °/s
ok(RATE_CAP === 240 && SERVO_RATE_MAX === 300 && OBJECTIVES.robust.rateLimit === 240, "鲁棒目标的限速 240 °/s = 300 的 80%");
ok(gaitMaxRate(octoV15Gait()) <= 240 && gaitMaxRate(octoV14Gait()) > 240, `v15 最大角速度 ${gaitMaxRate(octoV15Gait()).toFixed(0)} ≤ 240；v14 ${gaitMaxRate(octoV14Gait()).toFixed(0)} 超`);
ok(ratePenalty(octoV15Gait(), 240) === 0 && ratePenalty(octoV14Gait(), 240) > 1, "ratePenalty：未超限 0，超限罚分");
const v14cap = await R(octoV14Gait(), { servoRate: 240 }), v14n = await R(octoV14Gait());
ok(v14cap.speed < v14n.speed && v14cap.speed > v14n.speed * 0.9, `固件限速 240 让 v14 变慢 ${(100 * (1 - v14cap.speed / v14n.speed)).toFixed(1)}%（<10%）`);
// 6. 训练 / 留出工况不重叠
const key = (c) => JSON.stringify({ ...c, tag: undefined }), tr = new Set(trainConds(8).map(key));
ok(trainConds(8).length === 6 && heldOutConds(8).length === 11 && heldOutConds(8).every((c) => !tr.has(key(c))), "6 个训练工况、11 个留出工况，互不重叠");
// 7. multiScore：侧漂罚分生效
const fake = (dx) => ({ speed: 3, dx, dh: 0, fwd: 30, straight: 1, slip: 0, energyJ: 1, tiltMax: 0, sec: 10 });
const w = OBJECTIVES.robust.w;
ok(multiScore([fake(0), fake(0)], w, "mix") > multiScore([fake(0), fake(10)], w, "mix"), "multiScore：侧漂大的分数低");
// 8. 评估池：结果和单线程逐位相同
const job = { kind: "octo", gait0: octoRowGait(), weights: OBJECTIVES.speed.w, seed: 3, maxEvals: 14, maxSec: 999 };
const a = await runJob(job), pool = nodePool(job, 4), b = await runJob(job, { pool }); pool.terminate();
ok(a.best.score === b.best.score && a.evals === b.evals, `评估池（4 线程）结果和单线程逐位相同（${a.best.score.toFixed(4)}）`);
// 9. 导出常量
const h = toCtrlHeader(OCTO_CTRL_WHEEL, { source: "test" });
ok(/OCTO_CTRL_V15 1/.test(h) && /kKPath = 2\.0+f/.test(h) && /kKiPath = 0\.50*f/.test(h) && /kSlopeFlipDeg = 0/.test(h), "闭环头文件含 v15 路径保持常量");
ok(/#define OCTO_SERVO_RATE_DPS 240\.0f/.test(toFirmwareHeader(octoV15Gait(), { servoRate: 240 })) && !/OCTO_SERVO_RATE_DPS/.test(toFirmwareHeader(octoV15Gait())), "步态头文件按需带 OCTO_SERVO_RATE_DPS 240");
console.log(`v15-test: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
