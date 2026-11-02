// v29（我的补充）：拆解模式里拆下来、零件库没有对应件的模块 —— 程序生成的近似件（尺寸全是估算，形状是示意）。
// 坐标同 procedural.js：y 朝上、底面 y = 0、xz 居中，单位 cm；dims_mm 给人看。
const box = (c, h, m = "white") => ({ k: "box", c, h, m });
const cyl = (c, r, h, m = "white", ax = "y") => ({ k: "cyl", c, r, h, ax, m });
function make(id, name_zh, name, cat, prims, spec) {
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  const colliders = prims.map((p) => {
    const h = p.k === "box" ? p.h : p.ax === "x" ? [p.h / 2, p.r, p.r] : p.ax === "z" ? [p.r, p.r, p.h / 2] : [p.r, p.h / 2, p.r];
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p.c[i] - h[i]); hi[i] = Math.max(hi[i], p.c[i] + h[i]); }
    return { c: p.c, h };
  });
  const dims_mm = { x: +((hi[0] - lo[0]) * 10).toFixed(1), y: +((hi[1] - lo[1]) * 10).toFixed(1), z: +((hi[2] - lo[2]) * 10).toFixed(1) };
  return {
    id, name_zh: `${name_zh}（近似件 · 拆解模式）`, name: `${name} (approximate, teardown)`, cat, approx: true, teardown: true,
    proc: { type: "prims", prims }, colliders, dims_mm, density: 1.3,
    dims_src: "按公开资料的常见尺寸估算，未经实物测量", spec, est: ["全部尺寸", "形状（示意）"], anchors: [],
  };
}
export const TD_PROCEDURAL = [
  make("td-servo-case-top", "微型舵机上盖", "Micro servo top cover", "enclosure",
    [box([0, 0.3, 0], [1.15, 0.3, 0.6], "blue"), cyl([0.55, 0.75, 0], 0.32, 0.3, "blue")], "SG90 一类微型舵机的上盖，内侧有齿轮轴孔。"),
  make("td-servo-case-mid", "微型舵机中壳（带安装耳）", "Micro servo middle case with mounting ears", "enclosure",
    [box([0, 0.8, 0], [1.15, 0.8, 0.6], "blue"), box([0, 1.45, 0], [1.6, 0.12, 0.6], "blue")], "中壳装电机和控制板，两侧安装耳各有一个螺丝孔。"),
  make("td-servo-case-bot", "微型舵机底盖", "Micro servo bottom cover", "enclosure",
    [box([0, 0.2, 0], [1.15, 0.2, 0.6], "blue")], "底盖，两颗长螺丝从这里穿到上盖。"),
  make("td-servo-gearset", "微型舵机齿轮组（4 级）", "Micro servo gear set (4 stages)", "motor",
    [cyl([-0.35, 0.1, 0], 0.55, 0.2), cyl([0.1, 0.35, 0], 0.5, 0.2), cyl([0.45, 0.6, 0], 0.45, 0.2), cyl([0.55, 0.9, 0], 0.4, 0.35), cyl([0.55, 1.2, 0], 0.15, 0.3, "steel")], "塑料（或金属）减速齿轮，最上面一个是带花键的输出齿轮。"),
  make("td-servo-board", "舵机控制板 + 反馈电位器", "Servo control board + feedback potentiometer", "driver",
    [box([0, 0.08, 0], [0.55, 0.08, 0.5], "green"), cyl([0, 0.4, 0], 0.4, 0.5, "black"), box([-0.3, 0.2, 0.2], [0.15, 0.05, 0.12], "black")], "控制芯片读电位器的位置，和输入脉冲比较后驱动电机；电位器的轴就是输出轴。"),
  make("td-pb-board", "充电宝控制板（充电 + 升压 + 保护）", "Power bank board (charge + boost + protection)", "power",
    [box([0, 0.08, 0], [2.6, 0.08, 1.0], "green"), box([2.2, 0.45, 0], [0.4, 0.33, 0.65], "steel"), box([-2.3, 0.2, 0.3], [0.35, 0.12, 0.45], "steel"), cyl([0, 0.3, -0.4], 0.3, 0.3, "black"), box([0.9, 0.15, 0.5], [0.2, 0.08, 0.15], "black")], "常见是一颗集成芯片：USB 充电管理、升压到 5 V、电量指示灯；有的另有保护板。USB-A 输出口 + USB-C 或 Micro-USB 输入口。"),
  make("td-pb-case", "充电宝外壳（单节 18650）", "Power bank shell (one 18650)", "enclosure",
    [box([0, 0.12, 0], [4.8, 0.12, 1.25], "white"), box([0, 1.25, 1.15], [4.8, 1.25, 0.1], "white"), box([0, 1.25, -1.15], [4.8, 1.25, 0.1], "white"), box([0, 2.38, 0], [4.8, 0.12, 1.25], "white")], "两半卡扣外壳，接缝处常有胶。"),
  make("td-fan-blade", "小风扇扇叶（5 叶）", "Mini fan blade (5 blades)", "motor",
    [cyl([0, 0.4, 0], 0.6, 0.8, "white"), ...[0, 1, 2, 3, 4].map((i) => box([Math.cos(i * 1.2566) * 2.6, 0.4, Math.sin(i * 1.2566) * 2.6], [0.9, 0.05, 0.9], "white"))], "压在电机轴上的塑料扇叶；中心孔和电机轴是过盈配合。"),
  make("td-fan-grille", "小风扇前后网罩", "Mini fan front/back grille", "enclosure",
    [cyl([0, 0.1, 0], 4.5, 0.2, "white"), cyl([0, 0.5, 0], 0.9, 0.6, "white")], "卡扣或螺丝固定的网罩，示意成一个圆盘。"),
  make("td-fan-usb-cable", "USB-A 供电线（只有 5 V 和 GND）", "USB-A power lead (5 V and GND only)", "wire",
    [box([0, 0.35, 0], [0.6, 0.22, 0.8], "black"), box([0, 0.35, 1.2], [0.6, 0.2, 0.4], "steel"), box([0, 0.2, -3], [0.15, 0.15, 2.3], "black")], "便宜 USB 风扇的线通常只接红（5 V）黑（GND）两根，没有数据线。"),
];
