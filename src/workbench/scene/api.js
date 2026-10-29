import * as THREE from "three";
import { PLATE } from "../parts";

// 场景和页面之间的桥：相机、渲染器、控制器、相机预设（拖放、测试、工具栏用）
export const sceneApi = { camera: null, gl: null, controls: null, flyTo: null, preset: null };

const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function screenToPlate(clientX, clientY) {
  const { camera, gl } = sceneApi;
  if (!camera || !gl) return null;
  const r = gl.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  if (Math.abs(hit.x) > PLATE.w / 2 || Math.abs(hit.z) > PLATE.d / 2) return { x: hit.x, y: hit.y, z: hit.z, outside: true };
  return hit;
}

export function worldToScreen([x, y, z]) {
  const { camera, gl } = sceneApi;
  if (!camera || !gl) return null;
  const v = new THREE.Vector3(x, y, z).project(camera);
  const r = gl.domElement.getBoundingClientRect();
  return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, behind: v.z > 1 };
}
