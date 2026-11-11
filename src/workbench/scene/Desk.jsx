import { themeVars } from "../../ui/palette.js";
import { useTheme } from "../../theme.js";
import { Environment } from "@react-three/drei";
import { PLATE } from "../parts";
import { FlatLabel } from "./Models";
import { matTexture } from "./textures";
import { MAT_Y } from "./Tools";

// 维修桌：浅色/深蓝台面 + 深蓝网格底板 + 硅胶垫；HDRI 环境光（CC0）+ 主光阴影 + 接触阴影
const DESK_Y = MAT_Y - 0.25;
export default function Desk() {
  const [, , theme] = useTheme();
  const C = themeVars(theme);
  const dark = theme === "dark";
  const mat = matTexture();
  return (
    <group>
      <Environment files="/env/studio_small_09_1k.hdr" environmentIntensity={0.55} />
      <hemisphereLight args={dark ? ["#d5e0ee", "#0B2545", 0.5] : ["#f4f7fb", "#5C6F86", 0.55]} />
      <directionalLight
        position={[9, 26, 12]}
        intensity={dark ? 1.6 : 2.0}
        color={dark ? "#e8eef6" : "#f8fafc"}
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
        <meshStandardMaterial color={dark ? C.paper : "#E8EEF5"} roughness={0.92} />
      </mesh>
      {/* 硅胶垫（深蓝灰） */}
      <mesh position={[0, MAT_Y - 0.125, 1]} receiveShadow>
        <boxGeometry args={[42, 0.25, 28]} />
        <meshStandardMaterial attach="material-0" color="#2F4E70" roughness={0.9} />
        <meshStandardMaterial attach="material-1" color="#2F4E70" roughness={0.9} />
        <meshStandardMaterial attach="material-2" map={mat} roughness={0.88} />
        <meshStandardMaterial attach="material-3" color="#2F4E70" roughness={0.9} />
        <meshStandardMaterial attach="material-4" color="#2F4E70" roughness={0.9} />
        <meshStandardMaterial attach="material-5" color="#2F4E70" roughness={0.9} />
      </mesh>
      {/* 底板：浅色或深蓝表面，上面有网格 */}
      <mesh position={[0, MAT_Y / 2, 0]} receiveShadow castShadow name="plate">
        <boxGeometry args={[PLATE.w, -MAT_Y, PLATE.d]} />
        <meshStandardMaterial color={dark ? C.paper2 : "#F4F7FB"} roughness={0.9} />
      </mesh>
      <FlatLabel text="底板 24 × 16 cm（铅笔线：1 cm 网格）" position={[-7.2, 0.004, 7.4]} height={0.5} color={C.inkSoft} opacity={0.7} />
      <gridHelper args={[PLATE.w, PLATE.w, C.inkSoft, C.line]} position={[0, 0.002, 0]} scale={[1, 1, PLATE.d / PLATE.w]}>
        <lineBasicMaterial attach="material" color={C.line} transparent opacity={0.35} />
      </gridHelper>
    </group>
  );
}
