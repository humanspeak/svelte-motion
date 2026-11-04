import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { CASES, VIEWPORT } from "./src/cases.js"

const fixtureRoot = path.dirname(fileURLToPath(import.meta.url))
const featureWorktree =
  process.env.FEATURE_WORKTREE ?? "/Users/jasonkummerl/Github/svelte-motion-transform-page-point"
const requireFromWorktree = createRequire(path.join(featureWorktree, "package.json"))
let playwright
try {
  playwright = requireFromWorktree("@playwright/test")
} catch {
  playwright = requireFromWorktree("playwright")
}
const { chromium } = playwright

const round = (value) => (Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : value)
const close = (a, b, tolerance = 0.75) => Math.abs(a - b) <= tolerance
const baseUrl = process.env.REACT_PARITY_URL ?? "http://127.0.0.1:4299"
const outputPath =
  process.env.REACT_PARITY_OUTPUT ?? path.join(fixtureRoot, "react-parity-results.json")
const requestedCases = process.env.PARITY_CASES
  ? new Set(process.env.PARITY_CASES.split(",").map((value) => value.trim()))
  : null
const cases = requestedCases ? CASES.filter(({ id }) => requestedCases.has(id)) : CASES

if (requestedCases && cases.length !== requestedCases.size) {
  const found = new Set(cases.map(({ id }) => id))
  throw new Error(
    `Unknown PARITY_CASES: ${[...requestedCases].filter((id) => !found.has(id)).join(", ")}`,
  )
}

function packageMetadata(name) {
  const filename = path.join(fixtureRoot, "node_modules", name, "package.json")
  const metadata = JSON.parse(fs.readFileSync(filename, "utf8"))
  return {
    name,
    version: metadata.version,
    gitHead: metadata.gitHead ?? null,
    dependencies: metadata.dependencies ?? {},
  }
}

const packages = Object.fromEntries(
  ["react", "react-dom", "motion", "framer-motion", "motion-dom", "motion-utils", "vite"].map(
    (name) => [name, packageMetadata(name)],
  ),
)

const requiredVersions = {
  react: "19.1.1",
  "react-dom": "19.1.1",
  motion: "13.2.0",
  "framer-motion": "13.2.0",
  "motion-dom": "13.2.0",
  vite: "8.2.2",
}
for (const [name, expected] of Object.entries(requiredVersions)) {
  if (packages[name].version !== expected) {
    throw new Error(`${name} must resolve to ${expected}; found ${packages[name].version}`)
  }
}

async function assertServer() {
  let lastError
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Reference server unavailable at ${baseUrl}: ${lastError?.message}`)
}

const clockInit = () => {
  let now = 1000
  let nextId = 1
  let frameCount = 0
  const callbacks = new Map()
  Object.defineProperty(performance, "now", { configurable: true, value: () => now })
  const epoch = 1_800_000_000_000
  Date.now = () => epoch + now
  window.requestAnimationFrame = (callback) => {
    const id = nextId
    nextId += 1
    callbacks.set(id, callback)
    return id
  }
  window.cancelAnimationFrame = (id) => callbacks.delete(id)
  window.__PARITY_CLOCK__ = {
    advance(ms) {
      if (!Number.isFinite(ms) || ms < 0) throw new Error(`Invalid frame delta: ${ms}`)
      now += ms
      const queued = [...callbacks.values()]
      callbacks.clear()
      frameCount += 1
      for (const callback of queued) callback(now)
      return this.read()
    },
    read() {
      return { now, frameCount, queuedFrames: callbacks.size }
    },
  }
}

async function settle(page) {
  await page.evaluate(async () => {
    await Promise.resolve()
    await new Promise((resolve) => queueMicrotask(resolve))
  })
}

async function snapshot(page, label) {
  return page.evaluate((value) => window.__PARITY__.actions.captureSnapshot(value), label)
}

async function recordPrecondition(page, result, name, pass, actual, expected) {
  const entry = { name, pass: Boolean(pass), actual, expected }
  result.preconditions.push(entry)
  await page.evaluate((value) => window.__PARITY__.preconditions.push(value), entry)
  if (!pass) throw new Error(`Precondition failed: ${name}; actual=${JSON.stringify(actual)}`)
}

async function awaitScrollEventDelivery(
  page,
  result,
  { name, preActionTraceSequence, target, scrollField, expected },
) {
  let waitError = null
  try {
    await page.waitForFunction(
      ({ preActionTraceSequence, target, scrollField, expected }) =>
        window.__PARITY__.trace.some((entry) => {
          const scroll = entry[scrollField]
          return (
            entry.sequence > preActionTraceSequence &&
            entry.type === "dom:scroll" &&
            entry.target === target &&
            scroll?.x === expected.x &&
            scroll?.y === expected.y
          )
        }),
      { preActionTraceSequence, target, scrollField, expected },
      { polling: 10, timeout: 2000 },
    )
  } catch (error) {
    waitError = error instanceof Error ? error.message : String(error)
  }

  const evidence = await page.evaluate(
    ({ preActionTraceSequence, target, scrollField, expected }) => {
      const newScrollRecords = window.__PARITY__.trace.filter(
        (entry) => entry.sequence > preActionTraceSequence && entry.type === "dom:scroll",
      )
      const matchingRecord =
        newScrollRecords.find((entry) => {
          const scroll = entry[scrollField]
          return (
            entry.target === target &&
            scroll?.x === expected.x &&
            scroll?.y === expected.y
          )
        }) ?? null
      return { matchingRecord, newScrollRecords }
    },
    { preActionTraceSequence, target, scrollField, expected },
  )

  await recordPrecondition(
    page,
    result,
    name,
    Boolean(evidence.matchingRecord),
    { ...evidence, waitError },
    {
      newerThanSequence: preActionTraceSequence,
      type: "dom:scroll",
      target,
      [scrollField]: expected,
    },
  )
}

async function advanceFrame(page, result, ms, label) {
  const before = await page.evaluate(() => window.__PARITY_CLOCK__.read())
  const after = await page.evaluate((delta) => window.__PARITY_CLOCK__.advance(delta), ms)
  await settle(page)
  await recordPrecondition(
    page,
    result,
    `controlled frame ${label}`,
    after.frameCount === before.frameCount + 1 && close(after.now - before.now, ms, 0.0001),
    { before, after },
    { frameDelta: ms, frameCountDelta: 1 },
  )
}

async function targetCenter(page, testId) {
  const box = await page.locator(`[data-testid="${testId}"]`).boundingBox()
  if (!box) throw new Error(`No rendered box for ${testId}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box }
}

async function verifyPointerCoordinates(page, result, type, requestedClient) {
  const observed = await page.evaluate((eventType) => {
    const matches = window.__PARITY__.trace.filter((entry) => entry.type === `dom:${eventType}`)
    return matches.at(-1) ?? null
  }, type)
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
  const pass =
    observed &&
    close(observed.event.client.x, requestedClient.x) &&
    close(observed.event.client.y, requestedClient.y) &&
    close(observed.event.page.x, observed.event.client.x + scroll.x) &&
    close(observed.event.page.y, observed.event.client.y + scroll.y)
  await recordPrecondition(
    page,
    result,
    `${type} carries browser-derived page/client coordinates`,
    pass,
    observed ? { event: observed.event, scroll, requestedClient } : null,
    { pageEqualsClientPlusScroll: true },
  )
}

async function runCase(browser, spec) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })
  await context.addInitScript(clockInit)
  const page = await context.newPage()
  const result = {
    id: spec.id,
    status: "running",
    fixture: spec,
    preconditions: [],
    output: null,
    error: null,
  }
  let pointer = { down: false, client: null }

  try {
    await page.goto(`${baseUrl}/?case=${encodeURIComponent(spec.id)}`, {
      waitUntil: "domcontentloaded",
    })
    await page.waitForFunction(() => window.__PARITY__?.ready === true, null, {
      polling: 10,
      timeout: 5000,
    })
    await advanceFrame(page, result, 16, "boot-1")
    await advanceFrame(page, result, 16, "boot-2")
    const boot = await snapshot(page, "runner-boot")
    const motionFrameProbe = await page.evaluate(() =>
      window.__PARITY__.trace.find((entry) => entry.type === "motionFrameProbe"),
    )
    await recordPrecondition(
      page,
      result,
      "fixture id and deterministic clock ready",
      (await page.getAttribute('[data-testid="fixture"]', "data-case")) === spec.id &&
        (await page.evaluate(() => Boolean(window.__PARITY_CLOCK__))) &&
        boot.at === 1032,
      { case: spec.id, snapshotAt: boot.at },
      { case: spec.id, snapshotAt: 1032 },
    )
    await recordPrecondition(
      page,
      result,
      "public Motion frame scheduler uses the controlled browser timestamp",
      Boolean(motionFrameProbe) &&
        motionFrameProbe.performanceNow === motionFrameProbe.at &&
        [1016, 1032].includes(motionFrameProbe.at),
      motionFrameProbe,
      { performanceNowEqualsTraceTime: true, permittedBootFrameTimes: [1016, 1032] },
    )
    await recordPrecondition(
      page,
      result,
      "target has a finite rendered rectangle",
      Boolean(boot.rects.target) && Object.values(boot.rects.target).every(Number.isFinite),
      boot.rects.target,
      "finite DOMRect",
    )
    const expectedTargetSize = {
      width:
        (spec.kind === "pan" ? spec.geometry.panSurface.width : spec.geometry.card.width) *
        Math.abs(spec.geometry.transform.scaleX),
      height:
        (spec.kind === "pan" ? spec.geometry.panSurface.height : spec.geometry.card.height) *
        Math.abs(spec.geometry.transform.scaleY),
    }
    await recordPrecondition(
      page,
      result,
      "rendered target geometry matches the exported fixture geometry",
      close(boot.rects.target.width, expectedTargetSize.width) &&
        close(boot.rects.target.height, expectedTargetSize.height),
      { width: boot.rects.target.width, height: boot.rects.target.height },
      expectedTargetSize,
    )
    await recordPrecondition(
      page,
      result,
      "browser viewport matches the exported fixture viewport",
      page.viewportSize()?.width === VIEWPORT.width && page.viewportSize()?.height === VIEWPORT.height,
      page.viewportSize(),
      VIEWPORT,
    )
    if (spec.bounds === "ref" || spec.id === "drag-ref-resize-regrab") {
      await recordPrecondition(
        page,
        result,
        "ref constraint contains the draggable target",
        boot.layout.targetContainedByBoard === true,
        boot.layout,
        { targetContainedByBoard: true },
      )
    }

    for (const [index, step] of spec.steps.entries()) {
      const before = await snapshot(page, `before:${index}:${step.op}`)
      await page.evaluate(
        (entry) => window.__PARITY__.driver.push({ ...entry, at: performance.now() }),
        { index, ...step },
      )

      switch (step.op) {
        case "snapshot":
          await snapshot(page, step.label)
          break
        case "frame":
          await advanceFrame(page, result, step.ms, `${index}:${spec.id}`)
          break
        case "pointerDown": {
          const center = await targetCenter(page, step.target)
          await recordPrecondition(
            page,
            result,
            `${step.target} is inside the viewport before pointerdown`,
            center.x >= 0 && center.x <= VIEWPORT.width && center.y >= 0 && center.y <= VIEWPORT.height,
            center,
            VIEWPORT,
          )
          pointer = { down: true, client: { x: center.x, y: center.y } }
          await page.mouse.move(center.x, center.y)
          await page.mouse.down()
          await verifyPointerCoordinates(page, result, "pointerdown", pointer.client)
          break
        }
        case "pointerMove":
          if (!pointer.client) throw new Error("pointerMove has no preceding pointerDown")
          pointer.client = { x: pointer.client.x + step.dx, y: pointer.client.y + step.dy }
          await page.mouse.move(pointer.client.x, pointer.client.y)
          await verifyPointerCoordinates(page, result, "pointermove", pointer.client)
          break
        case "pointerUp":
          if (!pointer.client) throw new Error("pointerUp has no pointer coordinates")
          await page.mouse.up()
          pointer.down = false
          await verifyPointerCoordinates(page, result, "pointerup", pointer.client)
          break
        case "pointerCancel":
          if (!pointer.client) throw new Error("pointerCancel has no pointer coordinates")
          await page.evaluate(({ x: clientX, y: clientY }) => {
            window.dispatchEvent(
              new PointerEvent("pointercancel", {
                bubbles: true,
                cancelable: false,
                pointerId: 1,
                pointerType: "mouse",
                isPrimary: true,
                clientX,
                clientY,
                button: 0,
                buttons: 0,
              }),
            )
          }, pointer.client)
          await verifyPointerCoordinates(page, result, "pointercancel", pointer.client)
          await page.mouse.up()
          pointer.down = false
          break
        case "pageScroll": {
          const preActionTraceSequence = await page.evaluate(
            () => window.__PARITY__.trace.at(-1)?.sequence ?? -1,
          )
          const expected =
            step.mode === "by"
              ? { x: before.scroll.x + step.x, y: before.scroll.y + step.y }
              : { x: step.x, y: step.y }
          await page.evaluate((entry) => {
            if (entry.mode === "by") window.scrollBy(entry.x, entry.y)
            else window.scrollTo(entry.x, entry.y)
          }, step)
          await settle(page)
          const actual = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
          const afterScroll = await snapshot(page, `page-scroll-precondition:${index}`)
          await recordPrecondition(
            page,
            result,
            step.precondition,
            close(actual.x, expected.x, 0.01) &&
              close(actual.y, expected.y, 0.01) &&
              close(afterScroll.rects.stage.left - before.rects.stage.left, -(actual.x - before.scroll.x)) &&
              close(afterScroll.rects.stage.top - before.rects.stage.top, -(actual.y - before.scroll.y)),
            {
              scroll: actual,
              stageViewportDelta: {
                x: round(afterScroll.rects.stage.left - before.rects.stage.left),
                y: round(afterScroll.rects.stage.top - before.rects.stage.top),
              },
            },
            {
              scroll: expected,
              stageViewportDelta: {
                x: -(expected.x - before.scroll.x),
                y: -(expected.y - before.scroll.y),
              },
            },
          )
          await awaitScrollEventDelivery(page, result, {
            name: `${step.precondition} browser scroll event delivered`,
            preActionTraceSequence,
            target: "document",
            scrollField: "windowScroll",
            expected,
          })
          break
        }
        case "ancestorScroll": {
          const preActionTraceSequence = await page.evaluate(
            () => window.__PARITY__.trace.at(-1)?.sequence ?? -1,
          )
          const expected =
            step.mode === "by"
              ? { x: before.shellScroll.x + step.x, y: before.shellScroll.y + step.y }
              : { x: step.x, y: step.y }
          await page.evaluate((entry) => {
            const shell = document.querySelector('[data-testid="shell"]')
            if (entry.mode === "by") shell.scrollBy(entry.x, entry.y)
            else shell.scrollTo(entry.x, entry.y)
          }, step)
          await settle(page)
          const actual = await page.evaluate(() => {
            const shell = document.querySelector('[data-testid="shell"]')
            return { x: shell.scrollLeft, y: shell.scrollTop }
          })
          const afterScroll = await snapshot(page, `ancestor-scroll-precondition:${index}`)
          await recordPrecondition(
            page,
            result,
            step.precondition,
            actual.x === expected.x &&
              actual.y === expected.y &&
              close(afterScroll.rects.stage.left - before.rects.stage.left, -(actual.x - before.shellScroll.x)) &&
              close(afterScroll.rects.stage.top - before.rects.stage.top, -(actual.y - before.shellScroll.y)),
            {
              scroll: actual,
              stageViewportDelta: {
                x: round(afterScroll.rects.stage.left - before.rects.stage.left),
                y: round(afterScroll.rects.stage.top - before.rects.stage.top),
              },
            },
            {
              scroll: expected,
              stageViewportDelta: {
                x: -(expected.x - before.shellScroll.x),
                y: -(expected.y - before.shellScroll.y),
              },
            },
          )
          await awaitScrollEventDelivery(page, result, {
            name: `${step.precondition} browser scroll event delivered`,
            preActionTraceSequence,
            target: "shell",
            scrollField: "shellScroll",
            expected,
          })
          break
        }
        case "setMapping":
          await page.evaluate((value) => window.__PARITY__.actions.setMapping(value), step.value)
          await settle(page)
          await page.waitForFunction(
            (value) => window.__PARITY__.actions.captureSnapshot("mapping-commit").mappingKind === value,
            step.value,
            { polling: 10, timeout: 2000 },
          )
          await recordPrecondition(page, result, step.precondition, true, step.value, step.value)
          break
        case "setStableScale": {
          await page.evaluate((value) => window.__PARITY__.actions.setStableScale(value), step.value)
          await page.waitForFunction(
            (value) => {
              const stage = document.querySelector('[data-testid="stage"]')
              return Math.abs(new DOMMatrix(getComputedStyle(stage).transform).a - 1 / value) < 0.0001
            },
            step.value,
            { polling: 10, timeout: 2000 },
          )
          const actual = await snapshot(page, "stable-scale-commit")
          await recordPrecondition(
            page,
            result,
            step.precondition,
            actual.stableScale === step.value && close(actual.visualScale.x, 1 / step.value, 0.0001),
            { stableScale: actual.stableScale, visualScale: actual.visualScale },
            { stableScale: step.value, visualScale: { x: 1 / step.value, y: 1 / step.value } },
          )
          break
        }
        case "resizeBoard":
          await page.evaluate((value) => window.__PARITY__.actions.resizeBoard(value), step.width)
          await page.waitForFunction(
            (width) => document.querySelector('[data-testid="board"]')?.offsetWidth === width,
            step.width,
            { polling: 10, timeout: 2000 },
          )
          await page.evaluate(() => window.dispatchEvent(new Event("resize")))
          await recordPrecondition(page, result, step.precondition, true, step.width, step.width)
          break
        case "shiftLayout": {
          const previousOffset = before.layout.slotOffsetLeft
          await page.evaluate((value) => window.__PARITY__.actions.shiftLayout(value), step.px)
          await page.waitForFunction(
            ({ previousOffset, px }) =>
              document.querySelector('[data-testid="slot"]')?.offsetLeft === previousOffset + px,
            { previousOffset, px: step.px },
            { polling: 10, timeout: 2000 },
          )
          const shifted = await snapshot(page, "layout-commit")
          await recordPrecondition(
            page,
            result,
            step.precondition,
            shifted.layout.slotOffsetLeft === previousOffset + step.px,
            { before: previousOffset, after: shifted.layout.slotOffsetLeft },
            { delta: step.px },
          )
          break
        }
        case "unmount":
          await page.evaluate(() => window.__PARITY__.actions.unmount())
          await page.waitForFunction(
            () => document.querySelector('[data-testid="target"]') === null,
            null,
            { polling: 10, timeout: 2000 },
          )
          await recordPrecondition(page, result, step.precondition, true, null, null)
          break
        default:
          throw new Error(`Unknown operation ${step.op}`)
      }

      await settle(page)
      await snapshot(page, `after:${index}:${step.op}`)
    }

    result.output = await page.evaluate(() => ({
      clock: window.__PARITY_CLOCK__.read(),
      trace: window.__PARITY__.trace,
      snapshots: window.__PARITY__.snapshots,
      driver: window.__PARITY__.driver,
      fixturePreconditions: window.__PARITY__.preconditions,
    }))
    result.status = "observed"
  } catch (error) {
    result.status = "precondition-failed"
    result.error = error instanceof Error ? error.stack : String(error)
    result.output = await page
      .evaluate(() => ({
        clock: window.__PARITY_CLOCK__?.read?.() ?? null,
        trace: window.__PARITY__?.trace ?? [],
        snapshots: window.__PARITY__?.snapshots ?? [],
        driver: window.__PARITY__?.driver ?? [],
        fixturePreconditions: window.__PARITY__?.preconditions ?? [],
      }))
      .catch(() => null)
  } finally {
    if (pointer.down) await page.mouse.up().catch(() => {})
    await context.close()
  }
  return result
}

await assertServer()
const browser = await chromium.launch({ headless: true })
const startedAt = new Date().toISOString()
const results = []
try {
  for (const spec of cases) results.push(await runCase(browser, spec))
} finally {
  await browser.close()
}

const report = {
  schemaVersion: 1,
  reference: "public motion/react observable browser output",
  startedAt,
  finishedAt: new Date().toISOString(),
  baseUrl,
  viewport: VIEWPORT,
  deterministicClock: {
    initialPerformanceNow: 1000,
    note: "Every fixture frame operation explicitly advances requestAnimationFrame and performance.now; callback event.timeStamp is recorded but is not used as the velocity clock.",
  },
  packages,
  requiredVersions,
  cases: results,
}

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (results.some(({ status }) => status !== "observed")) process.exitCode = 1
