import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { BASE, pub } from "./lib/base";
import "./index.css";

// 子路径部署：fetch 走同一个前缀（three.js 加载器的前缀在 lib/three-base.js，由 3D 页面懒加载引入，首页不再带 three.js）
if (BASE !== "/") {
  const f = window.fetch.bind(window);
  window.fetch = (u, o) => f(typeof u === "string" ? pub(u) : u, o);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
