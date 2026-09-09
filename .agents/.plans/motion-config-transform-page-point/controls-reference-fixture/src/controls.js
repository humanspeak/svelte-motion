import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { motion, useDragControls } from "motion/react";
import "./controls.css";

const h = React.createElement;
const round = (value) =>
  Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : value;
const point = (value) => ({ x: round(value.x), y: round(value.y) });
const rect = (element) => {
  if (!element) return null;
  const value = element.getBoundingClientRect();
  return {
    x: round(value.x),
    y: round(value.y),
    top: round(value.top),
    right: round(value.right),
    bottom: round(value.bottom),
    left: round(value.left),
    width: round(value.width),
    height: round(value.height),
  };
};
const eventRecord = (event) => ({
  type: event.type,
  pointerId: event.pointerId,
  pointerType: event.pointerType,
  isPrimary: event.isPrimary,
  button: event.button,
  buttons: event.buttons,
  client: { x: round(event.clientX), y: round(event.clientY) },
  page: { x: round(event.pageX), y: round(event.pageY) },
});

const probe = {
  schemaVersion: 1,
  library: "React Motion public motion/react controls fixture",
  ready: false,
  inputTrace: [],
  trace: [],
  snapshots: [],
  actions: {},
};
window.__CONTROLS_PARITY__ = probe;
for (const type of [
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
]) {
  document.addEventListener(
    type,
    (event) => {
      probe.inputTrace.push({
        sequence: probe.inputTrace.length,
        at: round(performance.now()),
        targetTestId: event.target?.getAttribute?.("data-testid") ?? null,
        event: eventRecord(event),
      });
    },
    true,
  );
}

function App() {
  const controls = useDragControls();
  const initialControls = useDragControls();
  const plainRef = useRef(null);
  const initialRef = useRef(null);
  const handleRef = useRef(null);
  const initialHandleRef = useRef(null);

  const trace = (target, type, event, info) => {
    probe.trace.push({
      sequence: probe.trace.length,
      at: round(performance.now()),
      target,
      type,
      event: eventRecord(event),
      info: {
        point: point(info.point),
        delta: point(info.delta),
        offset: point(info.offset),
        velocity: point(info.velocity),
      },
      rect: rect(target === "plain" ? plainRef.current : initialRef.current),
    });
  };

  useEffect(() => {
    probe.actions.captureSnapshot = (label) => {
      const snapshot = {
        sequence: probe.snapshots.length,
        at: round(performance.now()),
        label,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        scroll: { x: window.scrollX, y: window.scrollY },
        rects: {
          plain: rect(plainRef.current),
          handle: rect(handleRef.current),
          initial: rect(initialRef.current),
          initialHandle: rect(initialHandleRef.current),
        },
        transforms: {
          plain: getComputedStyle(plainRef.current).transform,
          initial: getComputedStyle(initialRef.current).transform,
        },
      };
      probe.snapshots.push(snapshot);
      return snapshot;
    };
    probe.ready = true;
  }, []);

  const callbacks = (target) => ({
    onDragStart: (event, info) => trace(target, "onDragStart", event, info),
    onDrag: (event, info) => trace(target, "onDrag", event, info),
    onDragEnd: (event, info) => trace(target, "onDragEnd", event, info),
  });

  return h(
    "div",
    { style: { height: 360, display: "grid", placeItems: "center", gap: 24 } },
    h(
      "section",
      { style: { display: "grid", placeItems: "center", gap: 8 } },
      h(
        "button",
        {
          ref: handleRef,
          "data-testid": "handle",
          onPointerDown: (event) =>
            controls.start(event, { snapToCursor: true }),
        },
        "Start Drag",
      ),
      h(motion.div, {
        ref: plainRef,
        drag: "x",
        dragControls: controls,
        dragListener: false,
        "data-testid": "drag-controls",
        style: {
          width: 100,
          height: 100,
          background: "#ef4444",
          borderRadius: 8,
        },
        ...callbacks("plain"),
      }),
    ),
    h(
      "section",
      { style: { display: "grid", placeItems: "center", gap: 8 } },
      h(
        "button",
        {
          ref: initialHandleRef,
          "data-testid": "initial-handle",
          onPointerDown: (event) =>
            initialControls.start(event, { snapToCursor: true }),
        },
        "Start Initial Drag",
      ),
      h(motion.div, {
        ref: initialRef,
        drag: true,
        dragControls: initialControls,
        dragListener: false,
        dragMomentum: false,
        initial: { x: 100, y: 40 },
        "data-testid": "drag-controls-initial",
        style: {
          width: 80,
          height: 80,
          background: "#38bdf8",
          borderRadius: 8,
        },
        ...callbacks("initial"),
      }),
    ),
  );
}

createRoot(document.getElementById("controls-root")).render(h(App));
