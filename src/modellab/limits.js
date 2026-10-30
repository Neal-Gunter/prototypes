// v11 模型 + 功能图：上传限制（我的补充：按浏览器内存和解析时间定的保守值）
export const LIMITS = {
  modelBytes: 40 * 1024 * 1024, // 单个模型文件 40 MB
  stepBytes: 15 * 1024 * 1024, // STEP 在浏览器里三角化很慢，15 MB
  imageBytes: 15 * 1024 * 1024, // 功能图（PNG/JPG/SVG）
  pdfBytes: 25 * 1024 * 1024,
  projectBytes: 80 * 1024 * 1024, // 导入的工程包
  triangles: 1_500_000, // 总三角形数
  meshes: 2000, // 网格个数
  imagePx: 8192, // 功能图最长边（像素）
};
export const mb = (n) => (n / 1024 / 1024).toFixed(n < 1024 * 1024 ? 2 : 1) + " MB";
export const MODEL_EXT = { glb: "glb", gltf: "gltf", obj: "obj", stl: "stl", step: "step", stp: "step" };
export const IMAGE_EXT = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", pdf: "application/pdf" };
export const extOf = (name) => (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";
export class UserError extends Error {
  constructor(msg) { super(msg); this.user = true; }
}
