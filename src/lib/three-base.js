// v21：子路径部署时 three.js 加载器（GLB、贴图、HDR）走同一个前缀。
// 原来在 main.jsx 里静态 import three，整个 three.js 被打进首页入口包；现在只由用到 3D 的懒加载页面引入。
import { DefaultLoadingManager } from "three";
import { BASE, pub } from "./base";
if (BASE !== "/") DefaultLoadingManager.setURLModifier(pub);
