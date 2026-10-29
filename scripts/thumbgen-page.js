// 零件缩略图生成页（开发时用：npx vite → scripts/thumbgen.html；由 scripts/make-thumbs.mjs 驱动）
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
const S = 128;
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
r.setSize(S, S);
r.setClearColor("#ffffff");
document.body.appendChild(r.domElement);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
window.renderThumb = async (url) => {
  const g = await loader.loadAsync(url);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#ffffff", "#777777", 2.2));
  const d = new THREE.DirectionalLight("#ffffff", 1.6); d.position.set(3, 5, 4); scene.add(d);
  scene.add(g.scene);
  const box = new THREE.Box3().setFromObject(g.scene);
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length() || 1;
  const cam = new THREE.PerspectiveCamera(30, 1, size / 100, size * 10);
  cam.position.copy(c).add(new THREE.Vector3(0.9, 0.8, 1.1).normalize().multiplyScalar(size * 1.75));
  cam.lookAt(c);
  r.render(scene, cam);
  const out = r.domElement.toDataURL("image/webp", 0.8);
  g.scene.traverse((o) => { o.geometry?.dispose(); });
  return out;
};
window.thumbReady = true;
