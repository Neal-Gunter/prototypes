/**
 * PHYSICS SEAM
 * createPhysicsAdapter() is the only physics factory the 3D scene imports.
 *
 * Interface:
 *   setTargets(angles: Array<number|null>)
 *     length 8. Degrees 0..180 for a driven tentacle, or null when that
 *     tentacle has no electrically connected servo.
 *   step(dtSeconds: number, reducedMotion: boolean): number[]
 *     eight curl values, about -1..1, already eased.
 *   dispose(): void
 *
 * MUJOCO WASM
 * To swap in MuJoCo later, add physics/mujocoAdapter.js that implements the
 * same three methods, load the WASM module inside that file, and return it
 * from createPhysicsAdapter(). Do not import MuJoCo anywhere else.
 * Do not describe the current adapter as MuJoCo.
 *
 * This adapter is a kinematic chain target plus a damped spring.
 * It is not a physical servo model and not a contact simulation.
 */

export const PHYSICS_ID = "simplified-kinematic-spring";

const REST = [0.22, -0.12, 0.16, -0.18, 0.1, -0.14, 0.2, -0.08];

export function restingCurls() {
  return REST.slice();
}

export class SimplifiedTentaclePhysics {
  constructor() {
    this.targets = REST.slice();
    this.curls = REST.slice();
  }

  setTargets(angles) {
    for (let index = 0; index < 8; index += 1) {
      const angle = angles && angles[index];
      this.targets[index] = typeof angle === "number" ? (angle - 90) / 90 : REST[index];
    }
  }

  step(dtSeconds, reducedMotion) {
    const dt = Math.min(Math.max(dtSeconds || 0, 0), 0.05);
    const gain = 6.5;
    for (let index = 0; index < 8; index += 1) {
      if (reducedMotion) this.curls[index] = this.targets[index];
      else {
        this.curls[index] +=
          (this.targets[index] - this.curls[index]) * (1 - Math.exp(-gain * dt));
      }
    }
    return this.curls.slice();
  }

  dispose() {
    this.targets = null;
    this.curls = null;
  }
}

export function createPhysicsAdapter() {
  return new SimplifiedTentaclePhysics();
}
