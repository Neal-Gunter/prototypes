import { useMemo } from "react";
import { Environment, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { PLATE } from "../parts";
import { FlatLabel } from "./Models";
import { matTexture } from "./textures";
import { MAT_Y } from "./Tools";

// 维修桌：木桌面（CC0 贴图）+ 蓝灰硅胶垫 + 胶合板底板；HDRI 环境光（CC0）+ 主光阴影 + 接触阴影
const DESK_Y = MAT_Y - 0.25;
export default function Desk() {
  const [diff, nor, rough] = useTexture([
    "/textures/wood_table_001_diff_1k.jpg",
    "/textures/wood_table_001_nor_gl_1k.jpg",
    "/textures/wood_table_001_rough_1k.jpg",
  ]);
  const desk = useMemo(() => {
    const set = (t, srgb, r) => {
      const c = t.clone();
      c.wrapS = c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(r[0], r[1]);
      c.anisotropy = 8;
      if (srgb) c.colorSpace = THREE.SRGBColorSpace;
      c.needsUpdate = true;
      return c;
    };
    return {
      deskMap: set(diff, true, [3, 2]),
      deskNor: set(nor, false, [3, 2]),
      deskRough: set(rough, false, [3, 2]),
      plyNor: set(nor, false, [1.2, 0.8]),
      plyRough: set(rough, false, [1.2, 0.8]),
    };
  }, [diff, nor, rough]);
  const mat = matTexture();
  return (
    <group>
      <Environment files="/env/studio_small_09_1k.hdr" environmentIntensity={0.55} />
      <hemisphereLight args={["#fff6e8", "#3b3328", 0.35]} />
      <directionalLight
        position={[9, 26, 12]}
        intensity={2.1}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* 桌面 */}
      <mesh position={[0, DESK_Y - 1, 0]} receiveShadow>
        <boxGeometry args={[90, 2, 60]} />
        <meshStandardMaterial map={desk.deskMap} normalMap={desk.deskNor} roughnessMap={desk.deskRough} roughness={1} />
      </mesh>
      {/* 硅胶垫 */}
      <mesh position={[0, MAT_Y - 0.125, 1]} receiveShadow>
        <boxGeometry args={[42, 0.25, 28]} />
        <meshStandardMaterial attach="material-0" color="#35565f" roughness={0.9} />
        <meshStandardMaterial attach="material-1" color="#35565f" roughness={0.9} />
        <meshStandardMaterial attach="material-2" map={mat} roughness={0.88} />
        <meshStandardMaterial attach="material-3" color="#35565f" roughness={0.9} />
        <meshStandardMaterial attach="material-4" color="#35565f" roughness={0.9} />
        <meshStandardMaterial attach="material-5" color="#35565f" roughness={0.9} />
      </mesh>
      {/* 底板（胶合板），零件固定在上面 */}
      <mesh position={[0, MAT_Y / 2, 0]} receiveShadow castShadow name="plate">
        <boxGeometry args={[PLATE.w, -MAT_Y, PLATE.d]} />
        <meshStandardMaterial roughnessMap={desk.plyRough} normalMap={desk.plyNor} normalScale={[0.35, 0.35]} color="#d8bf98" roughness={0.85} />
      </mesh>
      <FlatLabel text="底板 24 × 16 cm（铅笔线：1 cm 网格）" position={[-7.2, 0.004, 7.4]} height={0.5} color="#4b4339" opacity={0.65} />
      <gridHelper args={[PLATE.w, PLATE.w, "#8f7d66", "#8f7d66"]} position={[0, 0.002, 0]} scale={[1, 1, PLATE.d / PLATE.w]}>
        <lineBasicMaterial attach="material" color="#7b6a55" transparent opacity={0.22} />
      </gridHelper>
    </group>
  );
}
