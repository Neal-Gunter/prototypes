/**
 * MuJoCo WASM 替换接口（占位，未实现，也没有加载任何 MuJoCo 代码）。
 *
 * 以后接入的大致步骤：
 * 1. 安装官方的 MuJoCo WASM 绑定（例如 npm 上的 mujoco / @mujoco/mujoco 一类包，按当时官方文档为准）。
 * 2. 写一个 MJCF 模型：身体是一个 body，8 根触手各是一串 hinge 关节的 capsule，
 *    每根触手根部关节挂一个 position actuator（对应一个舵机）。
 * 3. step(dt, drives)：把 drives[k]（弧度）写进 data.ctrl[k]，按 model.opt.timestep 多次 mj_step。
 * 4. getPose()：从 data.qpos 读出每个 hinge 的角度，填进 bend（长度 tentacles × segments）。
 * 5. 在 physics/index.js 里调用 createPhysicsBackend("mujoco")。
 */
export async function createMujocoBackend() {
  throw new Error("MuJoCo WASM 后端还没有接入：现在只用简化弹簧模型（simpleSpring.js）。");
}
