import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createRoot } from "react-dom/client"
import {
  MotionConfig,
  motion,
  useAnimationFrame,
  useDragControls,
  useMotionValue,
} from "motion/react"
import { CASE_BY_ID } from "./cases.js"
import "./style.css"

const h = React.createElement
const selectedId = new URLSearchParams(window.location.search).get("case")
const caseSpec = CASE_BY_ID.get(selectedId)

const round = (value) => (Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : value)
const point = (value) => ({ x: round(value.x), y: round(value.y) })
const rect = (element) => {
  if (!element) return null
  const value = element.getBoundingClientRect()
  return {
    x: round(value.x),
    y: round(value.y),
    top: round(value.top),
    right: round(value.right),
    bottom: round(value.bottom),
    left: round(value.left),
    width: round(value.width),
    height: round(value.height),
  }
}

const eventRecord = (event) => ({
  type: event.type,
  pointerId: event.pointerId,
  pointerType: event.pointerType,
  isPrimary: event.isPrimary,
  button: event.button,
  buttons: event.buttons,
  client: { x: round(event.clientX), y: round(event.clientY) },
  page: { x: round(event.pageX), y: round(event.pageY) },
  screen: { x: round(event.screenX), y: round(event.screenY) },
  eventTimeStamp: round(event.timeStamp),
})

const infoRecord = (info) => ({
  point: point(info.point),
  delta: point(info.delta),
  offset: point(info.offset),
  velocity: point(info.velocity),
})

function initializeParity(spec) {
  const parity = {
    schemaVersion: 1,
    library: "React Motion public motion/react fixture",
    case: spec?.id ?? selectedId,
    caseSpec: spec ?? null,
    ready: false,
    trace: [],
    snapshots: [],
    driver: [],
    preconditions: [],
    actions: {},
  }
  window.__PARITY__ = parity
  return parity
}

const parity = initializeParity(caseSpec)

function App({ spec }) {
  const geometry = spec.geometry
  const [mappingKind, setMappingKind] = useState(
    ["double", "stable", "inherit-double", "identity-under-double", "undefined-under-double"].includes(
      spec.config,
    )
      ? "double"
      : spec.config,
  )
  const [mounted, setMounted] = useState(true)
  const [boardWidth, setBoardWidth] = useState(geometry.board.width)
  const [layoutShift, setLayoutShift] = useState(0)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [visualScale, setVisualScale] = useState({
    x: geometry.transform.scaleX,
    y: geometry.transform.scaleY,
  })
  const stableScale = useRef(2)
  const targetRef = useRef(null)
  const boardRef = useRef(null)
  const shellRef = useRef(null)
  const stageRef = useRef(null)
  const slotRef = useRef(null)
  const handleRef = useRef(null)
  const followerRef = useRef(null)
  const frameProbeRecorded = useRef(false)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const dragControls = useDragControls()

  const trace = useCallback((type, data = {}) => {
    parity.trace.push({
      sequence: parity.trace.length,
      at: round(performance.now()),
      type,
      ...data,
    })
  }, [])

  const recordMotionFrame = useCallback(
    (elapsed, delta) => {
      if (frameProbeRecorded.current) return
      frameProbeRecorded.current = true
      trace("motionFrameProbe", {
        elapsed: round(elapsed),
        delta: round(delta),
        performanceNow: round(performance.now()),
      })
    },
    [trace],
  )
  useAnimationFrame(recordMotionFrame)

  const makeTransform = useCallback(
    (identity, transform) => (input) => {
      const output = transform(input)
      trace("transformPagePoint", {
        identity,
        input: point(input),
        output: point(output),
        stableScale: stableScale.current,
      })
      return output
    },
    [trace],
  )

  const transforms = useMemo(
    () => ({
      double: makeTransform("double", ({ x: px, y: py }) => ({ x: px * 2, y: py * 2 })),
      triple: makeTransform("triple", ({ x: px, y: py }) => ({ x: px * 3, y: py * 3 })),
      nonuniformAffine: makeTransform("nonuniform-affine", ({ x: px, y: py }) => ({
        x: px * 2 + 37,
        y: py * 0.5 - 23,
      })),
      stable: makeTransform("stable-closure", ({ x: px, y: py }) => ({
        x: px * stableScale.current,
        y: py * stableScale.current,
      })),
      identity: makeTransform("identity", ({ x: px, y: py }) => ({ x: px, y: py })),
    }),
    [makeTransform],
  )

  const activeTransform =
    spec.config === "stable"
      ? transforms.stable
      : mappingKind === "triple"
        ? transforms.triple
        : mappingKind === "nonuniform-affine"
          ? transforms.nonuniformAffine
          : transforms.double

  const captureSnapshot = useCallback(
    (label) => {
      const snapshot = {
        sequence: parity.snapshots.length,
        at: round(performance.now()),
        label,
        mappingKind,
        stableScale: stableScale.current,
        visualScale,
        mounted,
        scroll: { x: round(window.scrollX), y: round(window.scrollY) },
        shellScroll: shellRef.current
          ? { x: shellRef.current.scrollLeft, y: shellRef.current.scrollTop }
          : null,
        rects: {
          shell: rect(shellRef.current),
          stage: rect(stageRef.current),
          board: rect(boardRef.current),
          slot: rect(slotRef.current),
          target: rect(targetRef.current),
          handle: rect(handleRef.current),
          follower: rect(followerRef.current),
        },
        layout: {
          boardOffsetWidth: boardRef.current?.offsetWidth ?? null,
          boardOffsetHeight: boardRef.current?.offsetHeight ?? null,
          slotOffsetLeft: slotRef.current?.offsetLeft ?? null,
          slotOffsetTop: slotRef.current?.offsetTop ?? null,
          targetContainedByBoard:
            Boolean(targetRef.current) && Boolean(boardRef.current?.contains(targetRef.current)),
        },
        boundValues: {
          x: round(x.get()),
          y: round(y.get()),
          panOffset: point(panOffset),
        },
      }
      parity.snapshots.push(snapshot)
      return snapshot
    },
    [mappingKind, mounted, panOffset, visualScale, x, y],
  )

  useLayoutEffect(() => {
    parity.actions = {
      captureSnapshot,
      setMapping(value) {
        trace("action:setMapping", { from: mappingKind, to: value })
        setMappingKind(value)
      },
      setStableScale(value) {
        const previous = stableScale.current
        stableScale.current = value
        setVisualScale({ x: 1 / value, y: 1 / value })
        trace("action:setStableScale", { from: previous, to: value })
      },
      resizeBoard(width) {
        trace("action:resizeBoard", { from: boardWidth, to: width })
        setBoardWidth(width)
      },
      shiftLayout(px) {
        trace("action:shiftLayout", { from: layoutShift, to: px })
        setLayoutShift(px)
      },
      unmount() {
        trace("action:unmount")
        setMounted(false)
      },
    }
    parity.ready = true
  }, [boardWidth, captureSnapshot, layoutShift, mappingKind, trace])

  useEffect(() => {
    const recordPointer = (event) =>
      trace(`dom:${event.type}`, {
        event: eventRecord(event),
        targetTestId: event.target?.closest?.("[data-testid]")?.dataset.testid ?? null,
      })
    const recordScroll = (event) =>
      trace("dom:scroll", {
        target:
          event.target === document ? "document" : event.target === shellRef.current ? "shell" : "other",
        windowScroll: { x: window.scrollX, y: window.scrollY },
        shellScroll: shellRef.current
          ? { x: shellRef.current.scrollLeft, y: shellRef.current.scrollTop }
          : null,
      })
    for (const name of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
      window.addEventListener(name, recordPointer, true)
    }
    window.addEventListener("scroll", recordScroll, true)
    return () => {
      for (const name of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
        window.removeEventListener(name, recordPointer, true)
      }
      window.removeEventListener("scroll", recordScroll, true)
    }
  }, [trace])

  const recordGesture = useCallback(
    (name, event, info) => {
      trace(name, {
        event: eventRecord(event),
        info: infoRecord(info),
        callbackRenderState: { mappingKind, stableScale: stableScale.current },
        rendered: { target: rect(targetRef.current), follower: rect(followerRef.current) },
        boundValues: { x: round(x.get()), y: round(y.get()) },
      })
      if (spec.kind === "pan" && (name === "onPanStart" || name === "onPan" || name === "onPanEnd")) {
        setPanOffset(point(info.offset))
      }
    },
    [mappingKind, spec.kind, trace, x, y],
  )

  const wrapConfig = (child) => {
    switch (spec.config) {
      case "none":
        return child
      case "inherit-double":
        return h(MotionConfig, { transformPagePoint: transforms.double }, h(MotionConfig, null, child))
      case "identity-under-double":
        return h(
          MotionConfig,
          { transformPagePoint: transforms.double },
          h(MotionConfig, { transformPagePoint: transforms.identity }, child),
        )
      case "undefined-under-double":
        return h(
          MotionConfig,
          { transformPagePoint: transforms.double },
          h(MotionConfig, { transformPagePoint: undefined }, child),
        )
      default:
        return h(MotionConfig, { transformPagePoint: activeTransform }, child)
    }
  }

  const panTarget = h(
    motion.div,
    {
      ref: targetRef,
      "data-testid": "target",
      className: "panTarget",
      onPanSessionStart: (event, info) => recordGesture("onPanSessionStart", event, info),
      onPanStart: (event, info) => recordGesture("onPanStart", event, info),
      onPan: (event, info) => recordGesture("onPan", event, info),
      onPanEnd: (event, info) => recordGesture("onPanEnd", event, info),
    },
    h("div", {
      ref: followerRef,
      "data-testid": "follower",
      className: "follower",
      style: { transform: `translate(${panOffset.x}px, ${panOffset.y}px)` },
    }),
    "pan surface",
  )

  const constraints =
    spec.bounds === "numeric"
      ? { left: -90, right: 110, top: -60, bottom: 70 }
      : spec.bounds === "ref" || spec.id === "drag-ref-resize-regrab"
        ? boardRef
        : false

  const dragTarget = h(
    motion.div,
    {
      ref: targetRef,
      "data-testid": "target",
      className: "dragTarget",
      drag: true,
      dragListener: !spec.controls,
      dragControls,
      dragConstraints: constraints,
      dragElastic: 0,
      dragMomentum: false,
      layout: Boolean(spec.layout),
      style: { x, y },
      onMeasureDragConstraints: (bounds) => {
        trace("onMeasureDragConstraints", { bounds: { ...bounds } })
      },
      onDragStart: (event, info) => recordGesture("onDragStart", event, info),
      onDrag: (event, info) => recordGesture("onDrag", event, info),
      onDragEnd: (event, info) => recordGesture("onDragEnd", event, info),
    },
    "drag card",
  )

  const content =
    spec.kind === "pan"
      ? h("div", { className: "panPlacement" }, wrapConfig(mounted ? panTarget : null))
      : h(
          "div",
          {
            ref: boardRef,
            "data-testid": "board",
            className: "board",
            style: { width: `${boardWidth}px`, height: `${geometry.board.height}px` },
          },
          h(
            "div",
            { className: "layoutRow" },
            h("div", { "data-testid": "layout-spacer", style: { width: `${layoutShift}px` } }),
            h("div", { ref: slotRef, "data-testid": "slot", className: "slot" }, wrapConfig(mounted ? dragTarget : null)),
          ),
        )

  const transform = geometry.transform
  const stage = h(
    "div",
    {
      ref: stageRef,
      "data-testid": "stage",
      className: `stage ${spec.ancestor ? "stageInShell" : ""}`,
      style: {
        left: `${spec.ancestor ? 280 : geometry.stage.left}px`,
        top: `${spec.ancestor ? 220 : geometry.stage.top}px`,
        transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${visualScale.x}, ${visualScale.y})`,
      },
    },
    content,
  )

  const fixture = spec.ancestor
    ? h(
        "div",
        {
          ref: shellRef,
          "data-testid": "shell",
          className: "shell",
          style: {
            left: `${geometry.shell.left}px`,
            top: `${geometry.shell.top}px`,
            width: `${geometry.shell.width}px`,
            height: `${geometry.shell.height}px`,
          },
        },
        h(
          "div",
          {
            className: "shellContent",
            style: { width: `${geometry.shell.contentWidth}px`, height: `${geometry.shell.contentHeight}px` },
          },
          stage,
        ),
      )
    : stage

  const handle = spec.controls
    ? h(
        "button",
        {
          ref: handleRef,
          "data-testid": "handle",
          className: "controlHandle",
          onPointerDown: (event) => {
            trace("controls.start", { event: eventRecord(event.nativeEvent) })
            dragControls.start(event, { snapToCursor: true })
          },
        },
        "snap handle",
      )
    : null

  return h(
    "main",
    { "data-testid": "fixture", "data-case": spec.id, "data-ready": parity.ready },
    h("div", { className: "caseLabel" }, spec.id),
    fixture,
    handle,
  )
}

if (!caseSpec) {
  createRoot(document.getElementById("root")).render(
    h("pre", null, `Unknown or missing ?case=. Received: ${String(selectedId)}`),
  )
} else {
  createRoot(document.getElementById("root")).render(h(App, { spec: caseSpec }))
}
