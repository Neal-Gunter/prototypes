// v13 搜索结果（我的补充，仿真得出，未上实机）：v10 紧凑版“同步划桨”步态
// 左右舷 6 条触手同相、镜像全幅扫 ±50°（固件默认是 cos(安装角) 加权 + 相位依次错 45°），正前 / 正后两条不动；1.1 Hz 三角波 duty 0.6。
// 由 scripts/gait-search.mjs 随机搜索 280 组 + 局部细化 210 组得出后取整；回程 100° / 0.36 s ≈ 275 °/s < 固件限速 300 °/s。
import { OCTO_NAMES, OCTO_SIDE, newJoint } from "./gait.js";
export const octoRowGait = () => ({ name: "同步划桨（v13 搜索）", joints: OCTO_NAMES.map((nm, a) => { const c = OCTO_SIDE[a], sg = Math.abs(c) < 1e-3 ? 0 : Math.sign(c); return newJoint(nm, { amp: 50 * sg, phase: 0, offset: 0, freq: 1.1, wave: "tri", duty: 0.6 }); }) });
// v14 搜索结果（我的补充，仿真得出，未上实机）：sep-CMA-ES，目标“速度优先”，种子 2，391 次评估（μ 0.5，左右对称 21 维），起点 = 上面的同步划桨。
// 和划桨比：右前 / 右 / 右后三条错开相位（8° / −35° / −50°）并向后偏 5–13°，正前 / 正后小幅摆动。日志：v14/logs/cma-speed-s2-mu0.5.json
const V14 = [[6.55, 53.4, 0, 0.511], [53.62, 8.1, -4.91, 0.581], [50.72, 324.9, 12.08, 0.574], [54.53, 309.6, 13.21, 0.556], [-13.45, 54.4, 0, 0.595]];
export const octoV14Gait = () => ({ name: "v14 搜索（速度优先）", joints: OCTO_NAMES.map((nm, a) => { const m = a <= 4 ? V14[a] : V14[8 - a], s = a <= 4 ? 1 : -1; return newJoint(nm, { amp: s * m[0], phase: m[1], offset: s * m[2], freq: 1.148, wave: "tri", duty: m[3] }); }) });
// v15 搜索结果（我的补充，仿真得出，未上实机）：多工况鲁棒目标（6 个训练工况，½ 平均 + ½ 最差 − 侧漂罚），定向小轮支点，舵机硬限 240 °/s（300 的 80%）。
// sep-CMA-ES 种子 1，391 次评估 × 6 工况，起点 = 同步划桨。最大角速度 234 °/s。日志：v15/robust-wheel-240.json
// 诚实结论见 README v15：留出工况上侧漂比 v14 小，但平均速度比 v14 慢约 20%；上坡 2° 基本走不动。
const V15 = [[-2.8, 0.3, 0, 0.704], [54.24, 199.5, -4.42, 0.565], [60, 129.2, 7.67, 0.482], [58.72, 144.9, -3.09, 0.502], [4.52, 340, 0, 0.575]];
export const octoV15Gait = () => ({ name: "v15 搜索（多工况鲁棒 · 240 °/s）", joints: OCTO_NAMES.map((nm, a) => { const m = a <= 4 ? V15[a] : V15[8 - a], s = a <= 4 ? 1 : -1; return newJoint(nm, { amp: s * m[0], phase: m[1], offset: s * m[2], freq: 0.938, wave: "tri", duty: m[3] }); }) });
