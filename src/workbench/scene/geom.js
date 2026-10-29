import { localToWorld, pinMeta, splitPinId } from "../parts";

// 引脚在世界坐标里的位置，以及导线从这里离开的方向
export function pinWorld(parts, id) {
  const [pid] = splitPinId(id);
  const part = parts.find((p) => p.id === pid);
  const meta = part && pinMeta(parts, id);
  if (!meta) return null;
  const pos = localToWorld(part, meta.local);
  let dirLocal = [0, 1, 0];
  if (meta.kind === "lead") dirLocal = part.type === "servo" ? [0, 0, 1] : [1, 0, 0];
  const d = localToWorld({ x: 0, z: 0, rot: part.rot || 0 }, dirLocal);
  return { pos, dir: [d[0], dirLocal[1], d[2]], meta, part };
}
