// v11：工程存在本机浏览器的 IndexedDB 里（不上传）
const DB = "proto-modellab", STORE = "projects";
function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode), s = t.objectStore(STORE);
    const out = fn(s);
    t.oncomplete = () => { db.close(); res(out?.result ?? out); };
    t.onerror = () => { db.close(); rej(t.error); };
    t.onabort = () => { db.close(); rej(t.error || new Error("IndexedDB 写入被中止（可能是空间不够）")); };
  });
}
export const saveProject = (project, assets) => tx("readwrite", (s) => s.put({ id: project.id, name: project.name, updated: Date.now(), project, model: assets.model || null, diagram: assets.diagram || null }));
export const loadProject = (id) => tx("readonly", (s) => s.get(id));
export const deleteProject = (id) => tx("readwrite", (s) => s.delete(id));
export async function listProjects() {
  const all = await tx("readonly", (s) => s.getAll());
  return (all || []).map((r) => ({ id: r.id, name: r.name, updated: r.updated, builtin: r.project?.builtin, mods: r.project?.modules?.length || 0, fns: r.project?.functions?.length || 0 })).sort((a, b) => b.updated - a.updated);
}
