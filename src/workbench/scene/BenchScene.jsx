import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  MOUSE,
  TOUCH,
  LinearFilter,
  QuadraticBezierCurve3,
  TubeGeometry,
  Vector2,
  Vector3,
  Raycaster,
  Plane,
  CanvasTexture,
  MeshStandardMaterial,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createPhysicsAdapter, restingCurls } from "../physics/adapter.js";
import {
  PARTS,
  SLOTS,
  getPart,
  nearestSlot,
  partPosition,
  pinWorld,
  wireColor,
} from "../model.js";

export const CAMERA_HOME = {
  position: [2.35, 3.45, 3.55],
  target: [0.1, 0.32, -0.15],
};

const plane = new Plane(new Vector3(0, 1, 0), 0);
const raycaster = new Raycaster();
const ndc = new Vector2();
const hitPoint = new Vector3();

function pointerOnPlane(event, camera, dom) {
  const rect = dom.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.intersectPlane(plane, hitPoint) ? hitPoint.clone() : null;
}

const labelCache = new Map();

function labelSprite(text) {
  if (labelCache.has(text)) return labelCache.get(text);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const font = "22px 'WenQuanYi Micro Hei', 'Droid Sans Fallback', sans-serif";
  context.font = font;
  const width = Math.max(8, Math.ceil(context.measureText(text).width) + 16);
  canvas.width = width;
  canvas.height = 32;
  context.font = font;
  context.fillStyle = "#f7f3ea";
  context.fillRect(0, 0, width, 32);
  context.strokeStyle = "#1b1814";
  context.lineWidth = 2;
  context.strokeRect(1, 1, width - 2, 30);
  context.fillStyle = "#1b1814";
  context.fillText(text, 8, 23);
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  const value = { texture, aspect: width / 32 };
  labelCache.set(text, value);
  return value;
}

function SpriteLabel({ text, position, height = 0.11 }) {
  const sprite = useMemo(() => labelSprite(text), [text]);
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.raycast = () => {};
  }, []);
  return (
    <sprite ref={ref} position={position} scale={[height * sprite.aspect, height, 1]}>
      <spriteMaterial map={sprite.texture} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

function Silent({ children, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.raycast = () => {};
  }, []);
  return (
    <mesh ref={ref} {...props}>
      {children}
    </mesh>
  );
}

function Controls({ controlsRef, reducedMotion }) {
  const { camera, gl } = useThree();
  const local = useRef(null);
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enablePan = false;
    controls.enableDamping = !reducedMotion;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.minPolarAngle = 0.28;
    controls.minDistance = 2.2;
    controls.maxDistance = 8;
    controls.mouseButtons = { LEFT: -1, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE };
    controls.touches = { ONE: -1, TWO: TOUCH.DOLLY_ROTATE };
    controls.target.set(...CAMERA_HOME.target);
    controls.update();
    local.current = controls;
    controlsRef.current = controls;
    return () => {
      controls.dispose();
      if (controlsRef.current === controls) controlsRef.current = null;
    };
  }, [camera, gl, controlsRef, reducedMotion]);
  useFrame(() => local.current?.update());
  return null;
}

function DragController({ sessionRef, handlersRef }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    function onMove(event) {
      const session = sessionRef.current;
      if (!session) return;
      const point = pointerOnPlane(event, camera, gl.domElement);
      if (!point) return;
      const dx = event.clientX - session.clientX;
      const dy = event.clientY - session.clientY;
      if (!session.moved && dx * dx + dy * dy < 16) return;
      session.moved = true;
      handlersRef.current.preview(session.partId, point.x - session.grabX, point.z - session.grabZ);
    }
    function onUp(event) {
      const session = sessionRef.current;
      if (!session) return;
      sessionRef.current = null;
      if (!session.moved) {
        handlersRef.current.cancel();
        return;
      }
      const point = pointerOnPlane(event, camera, gl.domElement);
      if (!point) {
        handlersRef.current.cancel();
        return;
      }
      handlersRef.current.drop(session.partId, point.x - session.grabX, point.z - session.grabZ);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [camera, gl, sessionRef, handlersRef]);
  return null;
}

function pinFill(pin, selected) {
  if (selected) return "#b45324";
  if (pin.role === "pwm" || pin.role === "sig") return "#b45324";
  if (pin.role === "gpio") return "#8a8075";
  if (pin.role === "gnd" || pin.role === "bat-") return "#1b1814";
  if (pin.role === "3v3") return "#c6a15b";
  return "#8e2f2a";
}

function useBoardTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 416;
    const context = canvas.getContext("2d");
    context.fillStyle = "#16352c";
    context.fillRect(0, 0, 512, 416);
    context.fillStyle = "#0e241e";
    context.fillRect(186, 156, 140, 100);
    context.strokeStyle = "#c6a15b";
    context.lineWidth = 4;
    context.strokeRect(186, 156, 140, 100);
    context.fillStyle = "#f7f3ea";
    context.font = "32px 'WenQuanYi Micro Hei', 'Droid Sans Fallback', sans-serif";
    context.fillText("ESP32-S3", 168, 78);
    context.font = "20px 'WenQuanYi Micro Hei', 'Droid Sans Fallback', sans-serif";
    context.fillText("simplified", 196, 112);
    const map = new CanvasTexture(canvas);
    map.anisotropy = 4;
    map.needsUpdate = true;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function Esp32({ part, origin, pendingPin, onPin, onDrag }) {
  const texture = useBoardTexture();
  const materials = useMemo(() => {
    const side = new MeshStandardMaterial({ color: "#0e241e", roughness: 0.9 });
    const top = new MeshStandardMaterial({ map: texture, roughness: 0.82 });
    const bottom = new MeshStandardMaterial({ color: "#091611", roughness: 0.95 });
    return [side, side, top, bottom, side, side];
  }, [texture]);
  useEffect(
    () => () => {
      materials.forEach((material) => material.dispose());
    },
    [materials],
  );
  return (
    <group position={origin}>
      <mesh
        position={[0, 0.04, 0]}
        material={materials}
        onPointerDown={(event) => onDrag(event, origin)}
      >
        <boxGeometry args={part.size} />
      </mesh>
      <mesh position={[0, 0.09, 0.46]} onPointerDown={(event) => onDrag(event, origin)}>
        <boxGeometry args={[0.28, 0.08, 0.1]} />
        <meshStandardMaterial color="#c8c2b8" metalness={0.25} roughness={0.4} />
      </mesh>
      {part.pins.map((pin) => {
        const selected = pendingPin?.partId === part.id && pendingPin?.pinId === pin.id;
        const outward = pin.position[0] < 0 ? -0.68 : 0.68;
        return (
          <group key={pin.id}>
            <mesh
              position={pin.position}
              onPointerDown={(event) => {
                event.stopPropagation();
                onPin(part.id, pin.id);
              }}
            >
              <sphereGeometry args={[selected ? 0.055 : 0.04, 12, 12]} />
              <meshStandardMaterial color={pinFill(pin, selected)} />
            </mesh>
            <SpriteLabel text={pin.label} position={[pin.position[0] + outward, 0.22, pin.position[2]]} height={0.09} />
          </group>
        );
      })}
      <SpriteLabel text="ESP32-S3 · 简化" position={[0, 0.48, 0]} height={0.13} />
    </group>
  );
}

function Servo({ part, origin, angle, pendingPin, onPin, onDrag }) {
  return (
    <group position={origin}>
      <mesh position={[0, 0.15, 0]} onPointerDown={(event) => onDrag(event, origin)}>
        <boxGeometry args={part.size} />
        <meshStandardMaterial color="#2a2622" roughness={0.78} />
      </mesh>
      <mesh position={[-0.32, 0.05, 0]} onPointerDown={(event) => onDrag(event, origin)}>
        <boxGeometry args={[0.12, 0.045, 0.28]} />
        <meshStandardMaterial color="#1b1814" />
      </mesh>
      <mesh position={[0.32, 0.05, 0]} onPointerDown={(event) => onDrag(event, origin)}>
        <boxGeometry args={[0.12, 0.045, 0.28]} />
        <meshStandardMaterial color="#1b1814" />
      </mesh>
      <group position={[0, 0.32, 0]} rotation={[0, ((angle - 90) * Math.PI) / 180, 0]}>
        <mesh>
          <boxGeometry args={[0.3, 0.035, 0.07]} />
          <meshStandardMaterial color="#f4efe4" />
        </mesh>
        <mesh>
          <boxGeometry args={[0.07, 0.035, 0.3]} />
          <meshStandardMaterial color="#f4efe4" />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.03, 12]} />
          <meshStandardMaterial color="#b45324" />
        </mesh>
      </group>
      {part.pins.map((pin) => {
        const selected = pendingPin?.partId === part.id && pendingPin?.pinId === pin.id;
        return (
          <group key={pin.id}>
            <mesh
              position={pin.position}
              onPointerDown={(event) => {
                event.stopPropagation();
                onPin(part.id, pin.id);
              }}
            >
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshStandardMaterial color={pinFill(pin, selected)} />
            </mesh>
            <SpriteLabel text={pin.label} position={[pin.position[0], pin.position[1] + 0.14, pin.position[2] + 0.12]} />
          </group>
        );
      })}
      <SpriteLabel text={`${part.name} · 简化`} position={[0, 0.58, 0]} height={0.12} />
    </group>
  );
}

function Battery({ part, origin, pendingPin, onPin, onDrag }) {
  return (
    <group position={origin}>
      <mesh position={[0, 0.11, 0]} onPointerDown={(event) => onDrag(event, origin)}>
        <boxGeometry args={part.size} />
        <meshStandardMaterial color="#4a433a" roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.23, 0]}>
        <boxGeometry args={[0.7, 0.02, 0.02]} />
        <meshStandardMaterial color="#1b1814" />
      </mesh>
      {part.pins.map((pin) => {
        const selected = pendingPin?.partId === part.id && pendingPin?.pinId === pin.id;
        return (
          <group key={pin.id}>
            <mesh
              position={pin.position}
              onPointerDown={(event) => {
                event.stopPropagation();
                onPin(part.id, pin.id);
              }}
            >
              <cylinderGeometry args={[0.055, 0.055, 0.08, 12]} />
              <meshStandardMaterial color={pinFill(pin, selected)} />
            </mesh>
            <SpriteLabel text={pin.label} position={[pin.position[0], pin.position[1] + 0.16, pin.position[2]]} />
          </group>
        );
      })}
      <SpriteLabel text="电池 · 简化" position={[0, 0.52, 0]} height={0.12} />
    </group>
  );
}

function PartMesh(props) {
  if (props.part.kind === "esp32") return <Esp32 {...props} />;
  if (props.part.kind === "servo") return <Servo {...props} />;
  return <Battery {...props} />;
}

function jointColor(wire) {
  if (wire.solder === "good" || wire.solder === "heating") return "#b45324";
  if (wire.solder === "cold") return "#3d4c57";
  return "#6b6258";
}

function WireMesh({ wire, start, end, beginHeat, endHeat }) {
  const geometry = useMemo(() => {
    const a = new Vector3(start[0], start[1], start[2]);
    const b = new Vector3(end[0], end[1], end[2]);
    const mid = a.clone().lerp(b, 0.5);
    mid.y += 0.34 + Math.min(0.2, a.distanceTo(b) * 0.05);
    const curve = new QuadraticBezierCurve3(a, mid, b);
    return { tube: new TubeGeometry(curve, 20, 0.012, 5, false), joint: [mid.x, mid.y, mid.z] };
  }, [start[0], start[1], start[2], end[0], end[1], end[2]]);
  useEffect(() => () => geometry.tube.dispose(), [geometry]);
  const from = getPart(wire.from.partId).pins.find((pin) => pin.id === wire.from.pinId);
  const to = getPart(wire.to.partId).pins.find((pin) => pin.id === wire.to.pinId);
  const color = wireColor(from?.role, to?.role);
  const scale = 0.045 + (wire.solder === "good" ? 0.02 : wire.heat * 0.03);
  return (
    <group>
      <mesh geometry={geometry.tube}>
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      <mesh
        position={geometry.joint}
        scale={scale}
        onPointerDown={(event) => {
          event.stopPropagation();
          beginHeat(wire.id);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          endHeat(wire.id);
        }}
      >
        <sphereGeometry args={[1, 14, 14]} />
        <meshStandardMaterial color={jointColor(wire)} />
      </mesh>
    </group>
  );
}

function Tentacle({ index, curl }) {
  const yaw = (index / 8) * Math.PI * 2;
  const accent = index === 0;
  const bend = curl * 0.34;
  const length = 0.13;
  const segments = 4;
  let node = (
    <mesh position={[0, length, 0]}>
      <sphereGeometry args={[accent ? 0.07 : 0.04, 12, 12]} />
      <meshStandardMaterial color={accent ? "#d46a32" : "#8a8075"} />
    </mesh>
  );
  for (let segment = segments - 1; segment >= 0; segment -= 1) {
    const radiusTop = (accent ? 0.045 : 0.03) + (segments - segment) * 0.006;
    node = (
      <group rotation={[bend, 0, 0]}>
        <mesh position={[0, length / 2, 0]}>
          <cylinderGeometry args={[radiusTop, radiusTop + 0.012, length, 8]} />
          <meshStandardMaterial color={accent ? "#c4622a" : "#1b1814"} roughness={0.5} />
        </mesh>
        <group position={[0, length, 0]}>{node}</group>
      </group>
    );
  }
  return (
    <group rotation={[0, yaw, 0]}>
      <group position={[0, 0.38, 0.18]} rotation={[1.12, 0, 0]}>
        {node}
      </group>
    </group>
  );
}

function Robot({ angles, reducedMotion }) {
  const adapter = useMemo(() => createPhysicsAdapter(), []);
  const invalidate = useThree((state) => state.invalidate);
  const [curls, setCurls] = useState(() => restingCurls());
  const anglesRef = useRef(angles);
  const shown = useRef(restingCurls());
  anglesRef.current = angles;
  useEffect(() => () => adapter.dispose(), [adapter]);
  useEffect(() => {
    invalidate();
  }, [angles, reducedMotion, invalidate]);
  useFrame((_, dt) => {
    adapter.setTargets(anglesRef.current);
    const next = adapter.step(dt, reducedMotion);
    const moving = next.some((value, index) => Math.abs(value - shown.current[index]) > 0.004);
    if (!moving) return;
    shown.current = next;
    setCurls(next);
    const settled = next.every((value, index) => Math.abs(value - adapter.targets[index]) < 0.01);
    if (!settled) invalidate();
  });
  return (
    <group position={[0.45, 0, -0.35]}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.34, 0.4, 0.12, 20]} />
        <meshStandardMaterial color="#1b1814" />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.28, 24, 18]} />
        <meshStandardMaterial color="#1b1814" roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.48, 0.22]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color="#b45324" />
      </mesh>
      {curls.map((curl, index) => (
        <Tentacle key={index} index={index} curl={curl} />
      ))}
      <SpriteLabel text="1 号触手 · 简化" position={[0.72, 0.72, 0.15]} height={0.12} />
    </group>
  );
}

function SceneBody({
  placements,
  dragPreview,
  wires,
  pendingPin,
  servoAngles,
  tentacles,
  reducedMotion,
  controlsRef,
  onPin,
  onPreview,
  onDrop,
  onCancelDrag,
  onClearPin,
  beginHeat,
  endHeat,
}) {
  const sessionRef = useRef(null);
  const handlersRef = useRef({});
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  handlersRef.current = { preview: onPreview, drop: onDrop, cancel: onCancelDrag };
  const redrawToken = [
    dragPreview?.x,
    dragPreview?.z,
    wires.map((wire) => `${wire.id}${wire.solder}${Math.round(wire.heat * 20)}`).join(),
    tentacles.join(),
  ].join("|");
  useEffect(() => {
    invalidate();
  }, [redrawToken, invalidate]);

  const activeSlot = dragPreview
    ? nearestSlot(dragPreview.x, dragPreview.z, placements, dragPreview.partId)
    : null;

  function startDrag(partId, event, origin) {
    if (event.nativeEvent.button !== 0) return;
    event.stopPropagation();
    const point = pointerOnPlane(event.nativeEvent, camera, gl.domElement);
    if (!point) return;
    sessionRef.current = {
      partId,
      clientX: event.nativeEvent.clientX,
      clientY: event.nativeEvent.clientY,
      grabX: point.x - origin[0],
      grabZ: point.z - origin[2],
      moved: false,
    };
  }

  return (
    <>
      <color attach="background" args={["#f7f3ea"]} />
      <hemisphereLight args={["#f7f3ea", "#6b4a32", 0.72]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[4, 7, 5]} intensity={1.15} />
      <Controls controlsRef={controlsRef} reducedMotion={reducedMotion} />
      <DragController sessionRef={sessionRef} handlersRef={handlersRef} />
      <mesh
        position={[0, -0.06, -0.15]}
        onPointerDown={(event) => {
          if (event.nativeEvent.button !== 0) return;
          onClearPin();
        }}
      >
        <boxGeometry args={[5.05, 0.1, 3.25]} />
        <meshStandardMaterial color="#cbbda6" roughness={0.94} />
      </mesh>
      <mesh position={[0, -0.24, -0.15]}>
        <boxGeometry args={[5.3, 0.26, 3.5]} />
        <meshStandardMaterial color="#6b4a32" roughness={0.88} />
      </mesh>
      {SLOTS.map((slot) => (
        <Silent
          key={slot.id}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[slot.x, 0.002, slot.z]}
        >
          <ringGeometry args={[0.18, 0.21, 4]} />
          <meshBasicMaterial color={activeSlot?.id === slot.id ? "#b45324" : "#1b1814"} />
        </Silent>
      ))}
      {PARTS.map((part) => {
        const origin = partPosition(part.id, placements, dragPreview);
        if (!origin) return null;
        const angle = servoAngles[part.id] ?? 90;
        return (
          <PartMesh
            key={part.id}
            part={part}
            origin={origin}
            angle={angle}
            pendingPin={pendingPin}
            onPin={onPin}
            onDrag={(event, at) => startDrag(part.id, event, at)}
          />
        );
      })}
      {wires.map((wire) => {
        const from = pinWorld(wire.from.partId, wire.from.pinId, partPosition(wire.from.partId, placements, dragPreview));
        const to = pinWorld(wire.to.partId, wire.to.pinId, partPosition(wire.to.partId, placements, dragPreview));
        if (!from || !to) return null;
        return (
          <WireMesh
            key={wire.id}
            wire={wire}
            start={from}
            end={to}
            beginHeat={beginHeat}
            endHeat={endHeat}
          />
        );
      })}
      <Robot angles={tentacles} reducedMotion={reducedMotion} />
    </>
  );
}

export default function BenchScene(props) {
  return (
    <Canvas
      className="h-full w-full"
      frameloop="demand"
      camera={{ position: CAMERA_HOME.position, fov: 32, near: 0.1, far: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ camera }) => {
        camera.lookAt(...CAMERA_HOME.target);
      }}
      onPointerMissed={() => props.onClearPin()}
    >
      <SceneBody {...props} />
    </Canvas>
  );
}
