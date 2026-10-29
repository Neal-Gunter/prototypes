import {
  PARTS,
  endpointLabel,
  getPart,
  pinKey,
} from "./model.js";

const POWER_LEAVE = new Set(["bat+", "vin", "vcc"]);
const GROUND_LEAVE = new Set(["bat-", "gnd"]);

function pinMeta(ref) {
  const part = getPart(ref.partId);
  const pin = part.pins.find((item) => item.id === ref.pinId);
  if (!pin) return null;
  return { ...pin, partId: part.id, partName: part.name, key: pinKey(part.id, pin.id) };
}

export function wireProblem(wire) {
  const a = pinMeta(wire.from);
  const b = pinMeta(wire.to);
  if (!a || !b) return { code: "signal-bad", text: "这根线的引脚不在简化模型里" };
  const roles = new Set([a.role, b.role]);
  if (a.role === "sig" || b.role === "sig") {
    const other = a.role === "sig" ? b : a;
    if (other.role === "pwm") return null;
    if (other.role === "gpio") {
      return { code: "signal-non-pwm", text: `信号线接在非 PWM 引脚 ${other.label} 上` };
    }
    if (["vin", "bat+", "vcc", "3v3"].includes(other.role)) {
      return { code: "signal-on-power", text: "信号线接在电源上" };
    }
    if (["gnd", "bat-"].includes(other.role)) {
      return { code: "signal-on-ground", text: "信号线接在地上" };
    }
    if (other.role === "sig") return { code: "sig-to-sig", text: "两个舵机信号接到了一起" };
    return { code: "signal-bad", text: "信号线的另一端不合适" };
  }
  const power = roles.has("vcc") || roles.has("bat+") || roles.has("vin");
  if (power && (roles.has("gpio") || roles.has("pwm"))) {
    return { code: "servo-power-on-signal", text: "电源接到了信号引脚上" };
  }
  if (roles.has("3v3") && (roles.has("gpio") || roles.has("pwm"))) {
    return { code: "power-on-signal", text: "3V3 接到了信号引脚上" };
  }
  if (roles.has("vcc") && roles.has("3v3")) {
    return { code: "servo-on-3v3", text: "舵机电源接到了 3V3" };
  }
  if ((roles.has("bat+") || roles.has("vin")) && roles.has("3v3")) {
    return {
      code: "board-via-3v3",
      text: "供电接到了 3V3，简化规则只把 5V 脚当作开发板电源输入",
    };
  }
  const powerRoles = ["vcc", "bat+", "vin", "3v3"];
  const groundRoles = ["gnd", "bat-"];
  if (powerRoles.some((role) => roles.has(role)) && groundRoles.some((role) => roles.has(role))) {
    return { code: "short", text: "电源和地接到了一起" };
  }
  if (
    (a.role === "gpio" || a.role === "pwm") &&
    (b.role === "gpio" || b.role === "pwm")
  ) {
    return { code: "gpio-short", text: "两个信号脚接到了一起" };
  }
  return null;
}

function wiresTouching(wires, partId, pinId) {
  return wires.filter(
    (wire) =>
      (wire.from.partId === partId && wire.from.pinId === pinId) ||
      (wire.to.partId === partId && wire.to.pinId === pinId),
  );
}

function connectedKeys(wires, startKey, canLeave, solderedOnly) {
  const adjacent = new Map();
  for (const wire of wires) {
    if (solderedOnly && wire.solder !== "good") continue;
    const a = pinKey(wire.from.partId, wire.from.pinId);
    const b = pinKey(wire.to.partId, wire.to.pinId);
    if (!adjacent.has(a)) adjacent.set(a, []);
    if (!adjacent.has(b)) adjacent.set(b, []);
    adjacent.get(a).push(b);
    adjacent.get(b).push(a);
  }
  const seen = new Set();
  const stack = [startKey];
  while (stack.length) {
    const current = stack.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    const split = current.indexOf("::");
    const meta = pinMeta({ partId: current.slice(0, split), pinId: current.slice(split + 2) });
    if (!meta || !canLeave(meta.role)) continue;
    for (const next of adjacent.get(current) || []) stack.push(next);
  }
  return seen;
}

function reaches(wires, start, goal, canLeave, solderedOnly) {
  const seen = connectedKeys(wires, pinKey(start.partId, start.pinId), canLeave, solderedOnly);
  return seen.has(pinKey(goal.partId, goal.pinId));
}

function leavePower(role) {
  return POWER_LEAVE.has(role);
}

function leaveGround(role) {
  return GROUND_LEAVE.has(role);
}

function servoSignal(wires, servoId) {
  return wiresTouching(wires, servoId, "SIG");
}

function describeServo(part, wires) {
  const name = part.name;
  const sigWires = servoSignal(wires, part.id);
  const problemWire = sigWires.map((wire) => ({ wire, problem: wireProblem(wire) })).find((item) => item.problem);
  const pwmWire = sigWires.find((wire) => {
    const problem = wireProblem(wire);
    return !problem;
  });
  let signalPin = null;
  if (pwmWire) {
    const other = pwmWire.from.partId === part.id ? pwmWire.to : pwmWire.from;
    if (other.partId === "esp32") signalPin = other.pinId;
  } else if (sigWires.length === 1) {
    const other = sigWires[0].from.partId === part.id ? sigWires[0].to : sigWires[0].from;
    if (other.partId === "esp32" && other.pinId.startsWith("GPIO")) signalPin = other.pinId;
  }

  const powerOk = reaches(
    wires,
    { partId: part.id, pinId: "VCC" },
    { partId: "battery", pinId: "BAT+" },
    leavePower,
    false,
  );
  const groundOk = reaches(
    wires,
    { partId: part.id, pinId: "GND" },
    { partId: "battery", pinId: "BAT-" },
    leaveGround,
    false,
  );
  const powerSoldered = reaches(
    wires,
    { partId: part.id, pinId: "VCC" },
    { partId: "battery", pinId: "BAT+" },
    leavePower,
    true,
  );
  const groundSoldered = reaches(
    wires,
    { partId: part.id, pinId: "GND" },
    { partId: "battery", pinId: "BAT-" },
    leaveGround,
    true,
  );
  const signalSolder = pwmWire ? pwmWire.solder : sigWires[0]?.solder;

  return {
    id: part.id,
    name,
    tentacle: part.tentacle,
    signalPin,
    sigWires,
    problemWire,
    powerOk,
    groundOk,
    powerSoldered,
    groundSoldered,
    signalSolder,
    pwmWire,
  };
}

function boardPaths(wires, solderedOnly) {
  return {
    power: reaches(
      wires,
      { partId: "battery", pinId: "BAT+" },
      { partId: "esp32", pinId: "5V" },
      leavePower,
      solderedOnly,
    ),
    ground:
      reaches(
        wires,
        { partId: "battery", pinId: "BAT-" },
        { partId: "esp32", pinId: "GND" },
        leaveGround,
        solderedOnly,
      ) ||
      reaches(
        wires,
        { partId: "battery", pinId: "BAT-" },
        { partId: "esp32", pinId: "GND2" },
        leaveGround,
        solderedOnly,
      ),
  };
}

export function analyzeBench(state) {
  const placements = state.placements || {};
  const wires = state.wires || [];
  const partsReady = Boolean(placements.esp32 && placements.battery && placements["servo-0"]);
  const issues = [];
  const servoParts = PARTS.filter((part) => part.kind === "servo" && placements[part.id]);
  const servoDetails = servoParts.map((part) => describeServo(part, wires));
  const board = placements.battery && placements.esp32 ? boardPaths(wires, false) : { power: false, ground: false };
  const boardSoldered =
    placements.battery && placements.esp32 ? boardPaths(wires, true) : { power: false, ground: false };

  for (const wire of wires) {
    const label = `${endpointLabel(wire.from)} → ${endpointLabel(wire.to)}`;
    const problem = wireProblem(wire);
    if (problem) {
      issues.push({
        id: `wire-${wire.id}-problem`,
        level: "bad",
        text: `${label}：${problem.text}（简化规则）`,
      });
    } else if (wire.solder === "cold") {
      issues.push({
        id: `wire-${wire.id}-cold`,
        level: "bad",
        text: `${label}：冷焊，按住时间不够。`,
      });
    } else if (wire.solder === "heating") {
      issues.push({
        id: `wire-${wire.id}-heat`,
        level: "warn",
        text: `${label}：正在加热。`,
      });
    } else if (wire.solder !== "good") {
      issues.push({
        id: `wire-${wire.id}-open`,
        level: "warn",
        text: `${label}：还没焊。`,
      });
    }
  }

  if (!partsReady) {
    issues.push({
      id: "parts",
      level: "info",
      text: "先把 ESP32-S3、电池和舵机 A 放到基板上。",
    });
  } else {
    const arm = servoDetails.find((item) => item.id === "servo-0");
    if (arm && arm.sigWires.length === 0) {
      issues.push({ id: "missing-signal", level: "bad", text: "舵机 A 还没有信号线。" });
    }
    if (arm && !arm.powerOk) {
      issues.push({
        id: "missing-servo-power",
        level: "bad",
        text: "舵机 A 的电源没有接到电池正极。",
      });
    }
    if (arm && !arm.groundOk) {
      issues.push({
        id: "missing-ground",
        level: "bad",
        text: "舵机 A 没有和电池负极共地。",
      });
    }
    if (!board.power) {
      issues.push({
        id: "missing-board-power",
        level: "bad",
        text: "开发板 5V 没有接到电池正极。",
      });
    }
    if (!board.ground) {
      issues.push({
        id: "missing-board-ground",
        level: "bad",
        text: "开发板没有和电池负极共地。",
      });
    }
  }

  for (const servo of servoDetails) {
    if (servo.id === "servo-0") continue;
    if (servo.sigWires.length === 0 && !wiresTouching(wires, servo.id, "VCC").length) {
      issues.push({
        id: `${servo.id}-idle`,
        level: "info",
        text: `${servo.name} 在基板上，还没有接线，简化模型不会动它。`,
      });
    }
  }

  const arm = servoDetails.find((item) => item.id === "servo-0");
  const noWireProblems = wires.every((wire) => !wireProblem(wire));
  const topologyReady = Boolean(
    partsReady &&
      arm &&
      arm.pwmWire &&
      arm.powerOk &&
      arm.groundOk &&
      board.power &&
      board.ground &&
      noWireProblems,
  );
  const jointsClear = wires.length > 0 && wires.every((wire) => wire.solder === "good");
  const electrical = Boolean(
    topologyReady &&
      jointsClear &&
      arm &&
      arm.signalSolder === "good" &&
      arm.powerSoldered &&
      arm.groundSoldered &&
      boardSoldered.power &&
      boardSoldered.ground,
  );

  const servoList = servoDetails.map((servo) => {
    const servoElectrical =
      servo.id === "servo-0"
        ? electrical
        : Boolean(
            servo.pwmWire &&
              servo.pwmWire.solder === "good" &&
              servo.powerSoldered &&
              servo.groundSoldered &&
              boardSoldered.power &&
              boardSoldered.ground &&
              !servo.problemWire &&
              wires.filter((wire) => wireTouchesPart(wire, servo.id)).every((wire) => wire.solder === "good" && !wireProblem(wire)),
          );
    return {
      id: servo.id,
      name: servo.name,
      tentacle: servo.tentacle,
      signalPin: servo.signalPin,
      electrical: servoElectrical,
      reason: servoReason(servo, {
        board,
        boardSoldered,
        electrical: servoElectrical,
      }),
    };
  });

  const bad = issues.some((issue) => issue.level === "bad");
  const warn = issues.some((issue) => issue.level === "warn");
  let summary = "等待放置零件";
  let tone = "idle";
  if (electrical && !bad && !warn) {
    summary = "按简化规则可以通过";
    tone = "ok";
    issues.unshift({
      id: "ok",
      level: "ok",
      text: "舵机 A 的 PWM 信号、舵机电源、共地和开发板供电都接上了，焊点也过了这一页的加热。这不是真实电路验证。",
    });
  } else if (partsReady) {
    summary = "检查未通过";
    tone = "bad";
  }

  const pinReason = {};
  for (const servo of servoList) {
    if (servo.signalPin) pinReason[servo.signalPin] = servo.electrical ? "" : servo.reason;
  }

  return {
    partsReady,
    topologyReady,
    powerReady: electrical,
    passed: electrical && !bad && !warn,
    summary,
    tone,
    issues,
    servoList,
    pinReason,
  };
}

function wireTouchesPart(wire, partId) {
  return wire.from.partId === partId || wire.to.partId === partId;
}

function servoReason(servo, context) {
  if (context.electrical) return "";
  if (servo.problemWire) return servo.problemWire.problem.text;
  if (servo.sigWires.length === 0) return "没有信号线";
  if (!servo.pwmWire) return "信号没有接到 PWM 脚";
  if (!servo.powerOk) return "舵机电源没有接到电池正极";
  if (!servo.groundOk) return "没有和电池负极共地";
  if (!context.board.power) return "开发板没有接到电池正极";
  if (!context.board.ground) return "开发板没有和电池负极共地";
  if (servo.signalSolder === "cold") return "信号焊点是冷焊";
  if (servo.signalSolder !== "good") return "信号线还没焊好";
  if (!servo.powerSoldered) return "电源焊点还没焊好";
  if (!servo.groundSoldered) return "地线焊点还没焊好";
  if (!context.boardSoldered.power || !context.boardSoldered.ground) return "开发板供电的焊点还没焊好";
  return "";
}

export function rejectionForPin(analysis, pinNumber) {
  const pinName = `GPIO${pinNumber}`;
  const known = ["GPIO1", "GPIO2", "GPIO4", "GPIO5", "GPIO6", "GPIO7", "GPIO15", "GPIO16"];
  if (!known.includes(pinName)) return `${pinName} 不在这块简化开发板上`;
  const servo = analysis.servoList.find((item) => item.signalPin === pinName);
  if (!servo) return `${pinName} 没有接到舵机信号`;
  if (servo.electrical) return "";
  return servo.reason || `${servo.name} 还没有按简化规则接通`;
}

export function tentacleAngles(servoAngles, analysis) {
  const angles = [null, null, null, null, null, null, null, null];
  for (const servo of analysis.servoList) {
    if (!servo.electrical) continue;
    const angle = servoAngles[servo.id];
    if (typeof angle === "number" && servo.tentacle >= 0 && servo.tentacle < 8) {
      angles[servo.tentacle] = angle;
    }
  }
  return angles;
}

export function singlePinTaken(wires, ref) {
  const part = getPart(ref.partId);
  const pin = part.pins.find((item) => item.id === ref.pinId);
  if (!pin) return false;
  const single = pin.role === "sig" || pin.role === "gpio" || pin.role === "pwm";
  if (!single) return false;
  return wires.some(
    (wire) =>
      (wire.from.partId === ref.partId && wire.from.pinId === ref.pinId) ||
      (wire.to.partId === ref.partId && wire.to.pinId === ref.pinId),
  );
}
