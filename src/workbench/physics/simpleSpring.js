// 简化物理：每节一个弹簧阻尼关节，“跟随上一节” + 一点固定下垂。
// 不考虑质量分布、碰撞、水阻或重力的真实方向，只用来做可视化。
export function createSimpleSpring({ tentacles, segments }) {
  const n = tentacles * segments;
  const bend = new Float32Array(n);
  const vel = new Float32Array(n);
  const twist = new Float32Array(n);
  const REST = 0.07; // 每节固定下垂（弧度）

  for (let i = 0; i < n; i++) bend[i] = REST;

  return {
    name: "simple-spring",
    simplified: true,
    step(dt, drives) {
      const h = Math.min(dt, 1 / 30);
      const sub = 4;
      const sdt = h / sub;
      for (let s = 0; s < sub; s++) {
        for (let t = 0; t < tentacles; t++) {
          const drive = drives[t];
          for (let j = 0; j < segments; j++) {
            const i = t * segments + j;
            let target;
            if (j === 0) target = REST + (drive ?? 0) * 0.55;
            else target = REST + (bend[i - 1] - REST) * 0.82; // 跟随上一节，越往尖越弱
            const k = 260 - j * 16; // 根部更硬
            const c = 14 - j * 0.6;
            vel[i] += (k * (target - bend[i]) - c * vel[i]) * sdt;
            bend[i] += vel[i] * sdt;
          }
        }
      }
    },
    getPose() {
      return { bend, twist };
    },
    dispose() {},
  };
}
