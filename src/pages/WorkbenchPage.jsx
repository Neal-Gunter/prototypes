import { useEffect, useMemo, useRef } from "react";
import BenchScene, { sceneApi, screenToPlate, worldToScreen } from "../workbench/scene/BenchScene";
import RobotScene from "../workbench/scene/RobotScene";
import Tray from "../workbench/panels/Tray";
import { SolderMeter, Toast, Toolbar } from "../workbench/panels/Toolbar";
import CheckPanel from "../workbench/panels/CheckPanel";
import GuidePanel from "../workbench/panels/GuidePanel";
import { CodeEditor, FirmwareControls, PinTable, SerialMonitor } from "../workbench/panels/FirmwarePanel";
import { useBench } from "../workbench/store";
import { analyze } from "../workbench/circuit";
import { sim } from "../workbench/sim";
import { localToWorld, pinsOfType, splitPinId } from "../workbench/parts";
import { stopFirmware } from "../workbench/firmware/runner";

// 给自动化测试用的小接口：把引脚的 3D 位置换成屏幕坐标
function installTestHook() {
  window.__wb = {
    pinScreen(id) {
      const [pid, n] = splitPinId(id);
      const part = useBench.getState().parts.find((p) => p.id === pid);
      const meta = part && pinsOfType(part.type).find((p) => p.name === n);
      return meta ? worldToScreen(localToWorld(part, meta.local)) : null;
    },
    partScreen(id) {
      const part = useBench.getState().parts.find((p) => p.id === id);
      return part ? worldToScreen([part.x, 0.3, part.z]) : null;
    },
    plateScreen(x, z) {
      return worldToScreen([x, 0, z]);
    },
    state: () => useBench.getState(),
    servoAngle: (id) => sim.servoAngle[id],
  };
}

export default function WorkbenchPage() {
  const parts = useBench((s) => s.parts);
  const wires = useBench((s) => s.wires);
  const joints = useBench((s) => s.joints);
  const tool = useBench((s) => s.tool);
  const wrap = useRef();

  const analysis = useMemo(() => analyze(parts, wires, joints), [parts, wires, joints]);
  const wiringOnly = useMemo(() => analyze(parts, wires, joints, { ignoreSolder: true }), [parts, wires, joints]);
  sim.analysis = analysis;

  useEffect(() => {
    document.title = "硬件工作台 · 早期原型";
    installTestHook();
    const up = () => {
      const st = useBench.getState();
      st.endSolder();
      if (st.dragging) st.setDragging(null);
      if (sceneApi.controls) sceneApi.controls.enabled = true;
    };
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointerup", up);
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
      useBench.getState().say("要放在绿色底板上", "warn");
      return;
    }
    useBench.getState().addPart(type, { x: hit.x, z: hit.z });
  };

  return (
    <div className="mx-auto w-full max-w-[1560px] px-3 py-4 md:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">硬件工作台</h1>
          <p className="text-sm text-ink-soft">示例：八触手机器人，ESP32‑S3 + MG90S 类舵机。放零件 → 连线 → 焊接 → 烧录 → 看它动。</p>
        </div>
        <p data-testid="honest-label" className="border border-mark px-2 py-1 text-sm text-mark">
          早期原型，简化仿真 <span lang="en">· Early prototype, simplified simulation</span>
        </p>
      </div>

      <div className="mt-3 border border-line bg-paper">
        <GuidePanel analysis={analysis} wiringOnly={wiringOnly} />
        <div className="grid gap-0 lg:grid-cols-[190px_minmax(0,1fr)_350px]">
          <div className="border-b border-line p-3 lg:border-b-0 lg:border-r">
            <Tray />
          </div>
          <div className="flex min-w-0 flex-col">
            <Toolbar />
            <div
              ref={wrap}
              data-testid="bench"
              className={`relative h-[560px] ${tool === "iron" ? "cursor-crosshair" : ""}`}
              onPointerMove={onPointerMove}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={onDrop}
            >
              <BenchScene />
              <SolderMeter />
              <Toast />
              {parts.length === 0 && (
                <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-paper-2">
                  把左边的零件拖到这块绿色底板上
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col border-t border-line lg:border-l lg:border-t-0">
            <div className="relative h-64 border-b border-line" data-testid="robot">
              <RobotScene />
              <div className="pointer-events-none absolute left-2 top-2 bg-paper-2/90 px-2 py-1 text-xs leading-5">
                <div className="font-medium">八触手机器人（简化物理）</div>
                <div className="text-ink-soft">触手 1/2/3 ← 舵机 1/2/3（铜色 = 已有舵机）</div>
              </div>
            </div>
            <div className="p-3">
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
            <PinTable analysis={analysis} />
          </div>
        </div>
      </div>

      <section className="mt-4 grid gap-3 text-xs leading-5 text-ink-soft md:grid-cols-3">
        <div>
          <h2 className="font-medium text-ink">哪些是简化的</h2>
          <ul className="mt-1 list-disc pl-4">
            <li>零件外形是程序生成的简化模型，不是厂家 CAD；引脚位置不是真实开发板的。</li>
            <li>每个接线点都当作焊点；焊接只看按住的时间。</li>
            <li>电路检查是规则判断，不算电压、电流和功耗。</li>
          </ul>
        </div>
        <div>
          <h2 className="font-medium text-ink">固件</h2>
          <p className="mt-1">JS 写的迷你解释器，在 Web Worker 里运行，不是 ESP32‑S3 仿真。舵机角度变化速度按约 0.1 秒 / 60° 估算。</p>
        </div>
        <div>
          <h2 className="font-medium text-ink">物理</h2>
          <p className="mt-1">触手是弹簧阻尼链条，只用来示意“跟着舵机动”。代码里留了换成 MuJoCo WASM 的接口（src/workbench/physics/）。</p>
        </div>
      </section>
    </div>
  );
}
