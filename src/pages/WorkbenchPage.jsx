import "../lib/three-base";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Link } from "react-router-dom";
import BenchScene, { sceneApi, screenToPlate, worldToScreen } from "../workbench/scene/BenchScene";
import RobotScene from "../workbench/scene/RobotScene";
import Tray from "../workbench/panels/Tray";
import { InspectCard, MeterHud, SolderHud, Toast, Toolbar, TOOLS } from "../workbench/panels/Toolbar";
import CheckPanel from "../workbench/panels/CheckPanel";
import GuidePanel from "../workbench/panels/GuidePanel";
import RepairPanel, { useRepairWatcher } from "../workbench/panels/RepairPanel";
import { CodeEditor, FirmwareControls, PinTable, SerialMonitor, SerialPlotter } from "../workbench/panels/FirmwarePanel";
import { useBench } from "../workbench/store";
import { analyze } from "../workbench/circuit";
import { sim } from "../workbench/sim";
import { pinWorld } from "../workbench/scene/geom";
import { stopFirmware } from "../workbench/firmware/runner";

// 给自动化测试用的小接口：把 3D 位置换成屏幕坐标
function installTestHook() {
  const box = new THREE.Box3();
  const c = new THREE.Vector3();
  window.__wb = {
    pinScreen(id) {
      const pw = pinWorld(useBench.getState().parts, id);
      return pw ? worldToScreen(pw.pos) : null;
    },
    partScreen(id) {
      const part = useBench.getState().parts.find((p) => p.id === id);
      return part ? worldToScreen([part.x, 0.3, part.z]) : null;
    },
    plateScreen(x, z) {
      return worldToScreen([x, 0, z]);
    },
    worldScreen: (p) => worldToScreen(p),
    objScreen(name) {
      const o = sceneApi.scene?.getObjectByName(name);
      if (!o) return null;
      box.setFromObject(o);
      box.getCenter(c);
      return worldToScreen([c.x, box.max.y - (box.max.y - box.min.y) * 0.25, c.z]);
    },
    wireScreen(id, t = 0.5) {
      const o = sceneApi.scene?.getObjectByName(`wire:${id}`);
      const path = o?.geometry?.parameters?.path;
      if (!path) return null;
      const v = path.getPoint(t);
      o.localToWorld(v);
      return worldToScreen([v.x, v.y, v.z]);
    },
    preset: (n) => sceneApi.preset?.(n),
    camera: (pos, target) => {
      const cam = sceneApi.camera;
      cam.position.set(...pos);
      sceneApi.controls.target.set(...target);
      sceneApi.controls.update();
    },
    state: () => useBench.getState(),
    sim: () => sim,
    servoAngle: (id) => sim.servoAngle[id],
  };
}

const MODES = [
  ["build", "自由搭建（引导）"],
  ["repair", "维修任务：机器人不动"],
];

export default function WorkbenchPage() {
  const parts = useBench((s) => s.parts);
  const wires = useBench((s) => s.wires);
  const joints = useBench((s) => s.joints);
  const usb = useBench((s) => s.usb);
  const tool = useBench((s) => s.tool);
  const mode = useBench((s) => s.mode);
  const fwStatus = useBench((s) => s.fw.status);
  const wrap = useRef();

  const analysis = useMemo(() => analyze(parts, wires, joints, { usb }), [parts, wires, joints, usb]);
  const wiringOnly = useMemo(() => analyze(parts, wires, joints, { ignoreSolder: true, usb }), [parts, wires, joints, usb]);
  sim.analysis = analysis;
  useRepairWatcher(analysis);

  // 运行中拔掉 USB 或者出现电源短路：开发板掉电
  useEffect(() => {
    if (fwStatus !== "running" && fwStatus !== "flashing") return;
    const st = useBench.getState();
    if (!usb) st.powerFail("USB‑C 拔掉了，开发板断电，程序停止");
    else if (analysis.railShort) st.powerFail("3V 和 GND 短路，稳压器保护，开发板复位后不再运行");
  }, [usb, analysis.railShort, fwStatus]);

  useEffect(() => {
    document.title = "硬件工作台 · 早期原型";
    installTestHook();
    const up = () => {
      const st = useBench.getState();
      if (st.op) st.endOp();
      if (st.screwOp) st.endScrew();
      if (st.dragging) st.setDragging(null);
      if (sceneApi.controls) sceneApi.controls.enabled = true;
    };
    const isField = (e) => /^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName);
    const down = (e) => {
      if (isField(e)) return;
      const st = useBench.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        st.redo();
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        if (!e.repeat) st.setFeeding(true);
        return;
      }
      if (e.key === "Escape") st.setTool("select");
      const t = TOOLS.find((x) => x.key === e.key);
      if (t && !e.ctrlKey && !e.metaKey && !e.altKey) st.setTool(t.id);
    };
    const keyup = (e) => {
      if (e.key === " " && !isField(e)) {
        e.preventDefault(); // 不让空格去“点”刚刚按过的按钮
        useBench.getState().setFeeding(false);
      }
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", keyup);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", keyup);
      stopFirmware();
    };
  }, []);

  const onPointerMove = (e) => {
    const d = useBench.getState().dragging;
    if (!d) return;
    const hit = screenToPlate(e.clientX, e.clientY);
    if (hit) useBench.getState().movePart(d.id, hit.x - d.dx, hit.z - d.dz);
  };

  const onDrop = (e) => {
    const type = e.dataTransfer.getData("text/x-part");
    if (!type) return;
    e.preventDefault();
    const hit = screenToPlate(e.clientX, e.clientY);
    if (!hit || hit.outside) {
      useBench.getState().say("要放在木底板上", "warn");
      return;
    }
    useBench.getState().addPart(type, { x: hit.x, z: hit.z });
  };

  const cursor = { iron: "cursor-crosshair", wick: "cursor-crosshair", pump: "cursor-crosshair", meter: "cursor-crosshair", wire: "cursor-cell", strip: "cursor-pointer", flux: "cursor-pointer", screw: "cursor-pointer" }[tool] || "";

  return (
    <div className="mx-auto w-full max-w-[1640px] px-3 py-4 md:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">硬件工作台</h1>
          <p className="text-sm text-ink-soft">
            示例：八触手机器人，Adafruit Feather ESP32‑S3 + 微型舵机。剪线 → 剥线 → 焊接 → 固定 → 烧录 → 看它动；或者接一个坏掉的机器人来修。
          </p>
        </div>
        <p data-testid="honest-label" className="border border-mark px-2 py-1 text-sm text-mark">
          早期原型，简化仿真 <span lang="en">· Early prototype, simplified simulation</span>
        </p>
      </div>
      <p className="mt-2 border border-copper bg-white px-2 py-1 text-sm" data-testid="assembly-banner">
        新版在<Link to="/assembly?scene=electrics" className="mx-1 underline">装配台</Link>：真实尺寸的零件、碰撞、焊点质量、按接线通电和固件都在一处，还能导出照着做的<Link to="/assembly/guide" className="mx-1 underline">装配指南</Link>。这个页面保留作对照。
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="模式">
        {MODES.map(([m, l]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            data-mode={m}
            onClick={() => (m === "repair" ? useBench.getState().loadRepair() : useBench.getState().loadBuild())}
            className={`min-h-9 border px-3 text-sm ${mode === m ? "border-ink bg-ink text-paper-2" : "border-line bg-paper-2 hover:border-ink"}`}
          >
            {l}
          </button>
        ))}
        <span className="text-xs text-ink-soft">切换模式会清空台面。</span>
      </div>

      <div className="mt-2 border border-line bg-paper">
        {mode === "build" && <GuidePanel analysis={analysis} wiringOnly={wiringOnly} />}
        <div className="grid gap-0 lg:grid-cols-[200px_minmax(0,1fr)_360px]">
          <div className="border-b border-line p-3 lg:border-b-0 lg:border-r">
            <Tray />
          </div>
          <div className="flex min-w-0 flex-col">
            <Toolbar />
            <div
              ref={wrap}
              data-testid="bench"
              className={`relative h-[620px] ${cursor}`}
              onPointerMove={onPointerMove}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={onDrop}
              onContextMenu={(e) => e.preventDefault()}
            >
              <BenchScene />
              <SolderHud />
              <MeterHud />
              <InspectCard />
              <Toast />
              {parts.length === 0 && (
                <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-paper-2 drop-shadow">
                  把左边的零件拖到这块木底板上
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col border-t border-line lg:border-l lg:border-t-0">
            <div className="relative h-64 border-b border-line" data-testid="robot">
              <RobotScene />
              <div className="pointer-events-none absolute left-2 top-2 bg-paper-2/90 px-2 py-1 text-xs leading-5">
                <div className="font-medium">八触手机器人（简化物理）</div>
                <div className="text-ink-soft">触手 1/2/3 ← 舵机 1/2/3；舵机没拧螺丝时触手几乎不动</div>
              </div>
            </div>
            <div className="flex flex-col gap-3 p-3">
              <RepairPanel />
              <CheckPanel analysis={analysis} />
            </div>
          </div>
        </div>
        <div className="grid gap-4 border-t border-line p-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">固件</h2>
            <CodeEditor />
            <FirmwareControls />
          </div>
          <div className="flex flex-col gap-3">
            <SerialMonitor />
            <SerialPlotter />
            <PinTable analysis={analysis} />
          </div>
        </div>
      </div>

      <section className="mt-4 grid gap-4 text-xs leading-5 text-ink-soft md:grid-cols-3">
        <div>
          <h2 className="font-medium text-ink">哪些是简化的</h2>
          <ul className="mt-1 list-disc pl-4">
            <li>焊接用的是一个简单热模型：焊盘温度按指数曲线追烙铁温度，过 217 °C 才化锡；锡量、助焊剂、加热时间决定好焊点 / 虚焊 / 桥连 / 烧坏。不是流体或真实传热仿真。</li>
            <li>焊锡形状是几种预先做好的形状按锡量缩放，不是真的液体。</li>
            <li>万用表只有通断档和直流电压档，按理想电源算（电池 6.00 V，USB 5.00 V，3V 3.30 V），不算电阻、压降和电流。</li>
            <li>电路检查是规则判断，不算功耗；舵机电流、电池放电都没有模拟。</li>
            <li>剥线只分“剥好 / 伤铜丝 / 剥不下来”三种；螺丝只看拧没拧到底。</li>
            <li>开发板、舵机、电池盒外形来自 Adafruit 开源 CAD（简化了面数）；桌上的工具（烙铁、万用表、螺丝刀等）都是程序生成的简化模型。</li>
          </ul>
        </div>
        <div>
          <h2 className="font-medium text-ink">固件</h2>
          <p className="mt-1">
            烧录进度和 esptool 风格的日志是模拟的；代码由网页里的 JS 迷你解释器（Web Worker）运行，不是 ESP32‑S3 仿真。硬件状态会影响运行：没插 USB 烧不进去，信号线不通舵机不动，拔掉 USB 程序停止。舵机角度变化速度按约
            0.1 秒 / 60° 估算。
          </p>
        </div>
        <div>
          <h2 className="font-medium text-ink">物理和素材</h2>
          <p className="mt-1">
            触手是弹簧阻尼链条，只用来示意“跟着舵机动”。开发板、舵机和电池盒外形来自 Adafruit 开源 CAD（MIT），HDRI 和木纹贴图来自 Poly Haven（CC0）。详见
            <Link to="/credits" className="underline">
              素材与许可
            </Link>
            。
          </p>
        </div>
      </section>
    </div>
  );
}
