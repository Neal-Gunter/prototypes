import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DefaultLoadingManager } from "three";
import App from "./App";
import { BASE, pub } from "./lib/base";
import "./index.css";

// 子路径部署：fetch 和 three.js 加载器（GLB、贴图、HDR）都走同一个前缀
if (BASE !== "/") {
  const f = window.fetch.bind(window);
  window.fetch = (u, o) => f(typeof u === "string" ? pub(u) : u, o);
  DefaultLoadingManager.setURLModifier(pub);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
