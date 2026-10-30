// 内置示例（只从本站同源取，不访问其他网站）：
// v11 octo：v10 八爪鱼（从装配台导出的 GLB + 自制功能图 + 绑定）；v12 起带 8 个偏航关节
// v13 fourbar：自制四连杆（闭环，scripts/make-fourbar-demo.mjs 生成，CC0）
// v12 arm：自制 2 自由度机械臂（OBJ，CC0，scripts/make-arm-demo.mjs 生成），两个 MG90S 关节 + 推板 + 测试方块
import { sanitize } from "./project.js";
const base = () => (import.meta.env?.BASE_URL || "/").replace(/\/?$/, "/");
// v13 quad：自制四足爬行器（8 个 MG90S 关节，scripts/make-quad-demo.mjs 生成，CC0），带一份对角小跑步态
export const DEMOS = {
  quad: { zh: "四足爬行", project: "quad.project.json", model: "quad.obj", diagram: "quad-functions.svg", msg: "内置示例：四足爬行器（8 个关节，自制，CC0）。打开“运动”，在下面的步态编辑器里点“在台面上跑”或“测量”，改幅度 / 相位看速度怎么变" },
  octo: { zh: "八爪鱼", project: "octo-v10.project.json", model: "octo-v10.glb", diagram: "octo-v10-functions.svg", msg: "内置示例：v10 八爪鱼（8 个偏航关节）。点功能图上的框，或点 3D 里的零件试试双向高亮；打开“运动”再点“触手”功能看关节" },
  fourbar: { zh: "四连杆", project: "fourbar.project.json", model: "fourbar.obj", diagram: "fourbar-functions.svg", msg: "内置示例：四连杆（曲柄摇杆，闭环，自制，CC0）。打开“运动”，拖曲柄滑块或播放时间轴，看摇杆跟着摆；关节面板里有自由度检查" },
  arm: { zh: "2 自由度机械臂", project: "arm2dof.project.json", model: "arm2dof.obj", diagram: "arm2dof-functions.svg", msg: "内置示例：2 自由度机械臂（两个 MG90S 关节，自制，CC0）。打开“运动”，拖滑块、点“测试”，或放测试方块再播放时间轴" },
};
export async function loadBuiltinDemo(name = "octo") {
  const D = DEMOS[name] || DEMOS.octo;
  const get = async (f) => { const r = await fetch(base() + "demo/" + f); if (!r.ok) throw new Error(`示例文件 ${f} 读取失败（${r.status}）`); return r; };
  const j = await (await get(D.project)).json();
  const project = sanitize(j);
  const [model, diagram] = await Promise.all([get(D.model).then((r) => r.arrayBuffer()), get(D.diagram).then((r) => r.blob())]);
  return { project, assets: { model, diagram: new Blob([diagram], { type: "image/svg+xml" }) }, msg: D.msg };
}
