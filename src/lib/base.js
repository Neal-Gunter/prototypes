// 部署在子路径（GitHub Pages：/prototypes/）时，把站内绝对路径（/lib、/models、/guides…）补上前缀；本地 dev 时 BASE = "/"，原样返回
export const BASE = import.meta.env.BASE_URL || "/";
export const pub = (u) => (typeof u === "string" && BASE !== "/" && u.startsWith("/") && !u.startsWith("//") && !u.startsWith(BASE) ? BASE.slice(0, -1) + u : u);
