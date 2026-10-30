// 页面和 3D 场景共用的一个“通电”控制器
import { engine } from "./engine.js";
import { BenchElectrics } from "./electrics.js";
export const elec = new BenchElectrics(engine);
if (typeof window !== "undefined") window.__elec = elec;
