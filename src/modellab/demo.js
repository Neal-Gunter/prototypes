// v11 内置示例：v10 八爪鱼（从装配台导出的 GLB + 自制功能图 + 绑定）。只从本站同源取，不访问其他网站
import { sanitize } from "./project.js";
const base = () => (import.meta.env?.BASE_URL || "/").replace(/\/?$/, "/");
export async function loadBuiltinDemo() {
  const get = async (f) => { const r = await fetch(base() + "demo/" + f); if (!r.ok) throw new Error(`示例文件 ${f} 读取失败（${r.status}）`); return r; };
  const j = await (await get("octo-v10.project.json")).json();
  const project = sanitize(j);
  const [model, diagram] = await Promise.all([get("octo-v10.glb").then((r) => r.arrayBuffer()), get("octo-v10-functions.svg").then((r) => r.blob())]);
  return { project, assets: { model, diagram: new Blob([diagram], { type: "image/svg+xml" }) } };
}
