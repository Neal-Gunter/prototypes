/**
 * 物理后端接口（MuJoCo WASM 的替换接口就在这里）。
 *
 * 现在用的是 simpleSpring：每根触手是一串关节，每个关节是一个简单的弹簧阻尼，
 * 只是为了让触手看起来“跟着舵机动”，不是真实的软体/刚体动力学。
 *
 * 想换成 MuJoCo WASM 时，实现同样的接口即可（见 mujocoAdapter.js）：
 *
 *   interface PhysicsBackend {
 *     name: string;
 *     simplified: boolean;            // true 时界面会显示“简化物理”
 *     // dt: 秒；drives[k]: 第 k 根触手的驱动角（弧度，舵机 90° 对应 0），没接舵机为 null
 *     step(dt: number, drives: (number|null)[]): void;
 *     // 每根触手每一节相对上一节的弯曲角（弧度），长度 = TENTACLES × SEGMENTS
 *     getPose(): { bend: Float32Array, twist: Float32Array };
 *     dispose(): void;
 *   }
 *
 * RobotScene 只调用 step() 和 getPose()，所以换后端不需要改渲染代码。
 */
import { createSimpleSpring } from "./simpleSpring";

export const TENTACLES = 8;
export const SEGMENTS = 12;

export async function createPhysicsBackend(kind = "simple") {
  if (kind === "mujoco") {
    const { createMujocoBackend } = await import("./mujocoAdapter");
    return createMujocoBackend({ tentacles: TENTACLES, segments: SEGMENTS });
  }
  return createSimpleSpring({ tentacles: TENTACLES, segments: SEGMENTS });
}

export function createPhysicsBackendSync() {
  return createSimpleSpring({ tentacles: TENTACLES, segments: SEGMENTS });
}
