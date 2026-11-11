// v42：学习路径每一步的完成状态，存在本机 localStorage。键带版本号；坏数据就当成空白。
// v45：同一条记录里保存测验成绩和自学记录上的姓名（仍只留在本机，不外传）。早期原型。
import { PATHS, findPath, pathStepHref, stepKey } from "./paths.js";

export const PATH_PROGRESS_KEY = "wb-path-progress-v1";
export const PATH_PROGRESS_VERSION = 1;
export const PATH_PROGRESS_EVENT = "wb-path-progress";
export const PATH_NAME_MAX = 80;

export function emptyPathProgress() {
  return { v: PATH_PROGRESS_VERSION, paths: {} };
}

function memorySafeGet(storage, key) {
  try {
    if (!storage) return null;
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function memorySafeSet(storage, key, value) {
  try {
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function defaultStorage() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function sanitizeDone(raw) {
  const done = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return done;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k === "string" && k && v) done[k] = true;
  }
  return done;
}

export function sanitizeName(raw) {
  if (typeof raw !== "string") return "";
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return s.slice(0, PATH_NAME_MAX);
}

function sanitizeQuiz(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const answers = {};
  if (raw.answers && typeof raw.answers === "object" && !Array.isArray(raw.answers)) {
    for (const [k, v] of Object.entries(raw.answers)) {
      if (typeof k === "string" && k && typeof v === "string" && v) answers[k] = v.slice(0, 32);
    }
  }
  const correct = Math.max(0, Math.floor(Number(raw.correct) || 0));
  const total = Math.max(0, Math.floor(Number(raw.total) || 0));
  const at = typeof raw.at === "string" ? raw.at.slice(0, 40) : "";
  if (!Object.keys(answers).length && !total && !at) return null;
  const out = { answers, correct, total };
  if (at) out.at = at;
  return out;
}

function packPathRec(raw) {
  const rec = { done: sanitizeDone(raw && raw.done) };
  const quiz = sanitizeQuiz(raw && raw.quiz);
  if (quiz) rec.quiz = quiz;
  const name = sanitizeName(raw && raw.name);
  if (name) rec.name = name;
  return rec;
}

export function parsePathProgress(raw) {
  if (raw == null || raw === "") return emptyPathProgress();
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return emptyPathProgress();
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return emptyPathProgress();
  if (data.v !== PATH_PROGRESS_VERSION) return emptyPathProgress();
  if (!data.paths || typeof data.paths !== "object" || Array.isArray(data.paths)) return emptyPathProgress();
  const paths = {};
  for (const [id, rec] of Object.entries(data.paths)) {
    if (!id || !rec || typeof rec !== "object" || Array.isArray(rec)) continue;
    paths[id] = packPathRec(rec);
  }
  return { v: PATH_PROGRESS_VERSION, paths };
}

export function loadPathProgress(storage = defaultStorage()) {
  return parsePathProgress(memorySafeGet(storage, PATH_PROGRESS_KEY));
}

export function savePathProgress(prog, storage = defaultStorage()) {
  const clean = parsePathProgress(prog);
  memorySafeSet(storage, PATH_PROGRESS_KEY, JSON.stringify(clean));
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new Event(PATH_PROGRESS_EVENT));
    }
  } catch { /* ignore */ }
  return clean;
}

export function pathStats(path, prog = emptyPathProgress()) {
  if (!path) return { done: 0, total: 0, keys: [], nextIndex: -1, complete: false };
  const rec = prog.paths?.[path.id]?.done || {};
  const keys = path.steps.map((st, i) => stepKey(path.id, st, i));
  let nextIndex = -1;
  let done = 0;
  keys.forEach((k, i) => {
    if (rec[k]) done++;
    else if (nextIndex < 0) nextIndex = i;
  });
  if (nextIndex < 0 && keys.length) nextIndex = keys.length - 1;
  return { done, total: keys.length, keys, nextIndex, complete: keys.length > 0 && done === keys.length };
}

export function isStepDone(prog, pathId, key) {
  return !!(prog?.paths?.[pathId]?.done?.[key]);
}

export function setStepDone(pathId, key, done = true, storage = defaultStorage()) {
  if (!pathId || !key) return loadPathProgress(storage);
  const prog = loadPathProgress(storage);
  const rec = packPathRec(prog.paths[pathId] || {});
  if (done) rec.done[key] = true;
  else delete rec.done[key];
  prog.paths[pathId] = rec;
  return savePathProgress(prog, storage);
}

export function resetPathProgress(pathId, storage = defaultStorage()) {
  const prog = loadPathProgress(storage);
  if (pathId) delete prog.paths[pathId];
  else prog.paths = {};
  return savePathProgress(prog, storage);
}

function markMatchingSteps(match, storage) {
  let prog = loadPathProgress(storage);
  let changed = false;
  for (const path of PATHS) {
    path.steps.forEach((st, i) => {
      if (!match(st)) return;
      const key = stepKey(path.id, st, i);
      if (!prog.paths[path.id]) prog.paths[path.id] = packPathRec({});
      if (!prog.paths[path.id].done) prog.paths[path.id].done = {};
      if (!prog.paths[path.id].done[key]) {
        prog.paths[path.id].done[key] = true;
        changed = true;
      }
    });
  }
  return changed ? savePathProgress(prog, storage) : prog;
}

export function markItemDone(itemId, storage = defaultStorage()) {
  if (!itemId) return loadPathProgress(storage);
  return markMatchingSteps((st) => st.kind === "bank" && st.id === itemId, storage);
}

export function markPathStep(pathId, index, done = true, storage = defaultStorage()) {
  const path = findPath(pathId);
  if (!path || index < 0 || index >= path.steps.length) return loadPathProgress(storage);
  return setStepDone(pathId, stepKey(pathId, path.steps[index], index), done, storage);
}

export function markRepairSceneDone(sceneId, storage = defaultStorage()) {
  if (!sceneId) return loadPathProgress(storage);
  return markMatchingSteps((st) => st.kind === "repair" && st.scene === sceneId, storage);
}

export function pathQuizResult(prog, pathId) {
  return prog?.paths?.[pathId]?.quiz || null;
}

export function pathRecordName(prog, pathId) {
  return sanitizeName(prog?.paths?.[pathId]?.name);
}

export function setPathQuiz(pathId, quiz, storage = defaultStorage()) {
  if (!pathId) return loadPathProgress(storage);
  const prog = loadPathProgress(storage);
  const rec = packPathRec(prog.paths[pathId] || {});
  const clean = sanitizeQuiz(quiz);
  if (clean) rec.quiz = clean;
  else delete rec.quiz;
  prog.paths[pathId] = rec;
  return savePathProgress(prog, storage);
}

export function setPathRecordName(pathId, name, storage = defaultStorage()) {
  if (!pathId) return loadPathProgress(storage);
  const prog = loadPathProgress(storage);
  const rec = packPathRec(prog.paths[pathId] || {});
  const clean = sanitizeName(name);
  if (clean) rec.name = clean;
  else delete rec.name;
  prog.paths[pathId] = rec;
  return savePathProgress(prog, storage);
}

export function resumeHref(path, prog) {
  if (!path) return "/bank";
  const st = pathStats(path, prog);
  const step = path.steps[st.nextIndex] || path.steps[0];
  return pathStepHref(step, path.id);
}
