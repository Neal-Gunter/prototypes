// v13 搜索结果（我的补充，仿真得出，未上实机）：v10 紧凑版“同步划桨”步态
// 左右舷 6 条触手同相、镜像全幅扫 ±50°（固件默认是 cos(安装角) 加权 + 相位依次错 45°），正前 / 正后两条不动；1.1 Hz 三角波 duty 0.6。
// 由 scripts/gait-search.mjs 随机搜索 280 组 + 局部细化 210 组得出后取整；回程 100° / 0.36 s ≈ 275 °/s < 固件限速 300 °/s。
import { OCTO_NAMES, OCTO_SIDE, newJoint } from "./gait.js";
export const octoRowGait = () => ({ name: "同步划桨（v13 搜索）", joints: OCTO_NAMES.map((nm, a) => { const c = OCTO_SIDE[a], sg = Math.abs(c) < 1e-3 ? 0 : Math.sign(c); return newJoint(nm, { amp: 50 * sg, phase: 0, offset: 0, freq: 1.1, wave: "tri", duty: 0.6 }); }) });
