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

const baseUrl = process.env.SVELTE_PARITY_URL ?? "http://127.0.0.1:4173"
const outputPath =
  process.env.SVELTE_PARITY_OUTPUT ?? path.join(fixtureRoot, "svelte-parity-results.json")
const referencePath = path.join(
  featureWorktree,
  ".agents/.plans/motion-config-transform-page-point/reference-results.json",
)
const reference = JSON.parse(fs.readFileSync(referencePath, "utf8"))
const expectedById = new Map(reference.cases.map((entry) => [entry.id, entry]))
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

const round = (value) => (Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : value)

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
  throw new Error(`Svelte server unavailable at ${baseUrl}: ${lastError?.message}`)
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
    const id = nextId++
    callbacks.set(id, callback)
    return id
  }
  window.cancelAnimationFrame = (id) => callbacks.delete(id)
  window.__PARITY_CLOCK__ = {
    advance(ms) {
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

async function advance(page, ms) {
  await page.evaluate((delta) => window.__PARITY_CLOCK__.advance(delta), ms)
  await settle(page)
}

async function snapshot(page, label) {
  return page.evaluate((value) => window.__PARITY__.actions.captureSnapshot(value), label)
}

async function center(page, testId) {
  const box = await page.locator(`[data-testid="${testId}"]`).boundingBox()
  if (!box) throw new Error(`No rendered box for ${testId}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function waitForScroll(page, target, action) {
  const delivery = await page.evaluate(({ target, action }) => {
    const runner = (window.__PARITY_RUNNER__ ??= { scrollEvents: [] })
    if (!runner.recordScroll) {
      runner.recordScroll = (event) => {
        const shell = document.querySelector('[data-testid="shell"]')
        runner.scrollEvents.push({
          sequence: runner.scrollEvents.length,
          target: event.target === document ? "document" : event.target === shell ? "shell" : "other",
          windowScroll: { x: window.scrollX, y: window.scrollY },
          shellScroll: shell ? { x: shell.scrollLeft, y: shell.scrollTop } : null,
        })
      }
      window.addEventListener("scroll", runner.recordScroll, true)
    }

    const element =
      target === "window" ? window : document.querySelector('[data-testid="shell"]')
    const before =
      target === "window"
        ? { x: window.scrollX, y: window.scrollY }
        : { x: element.scrollLeft, y: element.scrollTop }
    const expected =
      action.mode === "by"
        ? { x: before.x + action.x, y: before.y + action.y }
        : { x: action.x, y: action.y }
    const preActionSequence = runner.scrollEvents.at(-1)?.sequence ?? -1

    if (target === "window") {
      if (action.mode === "by") window.scrollBy(action.x, action.y)
      else window.scrollTo(action.x, action.y)
    } else if (action.mode === "by") {
      element.scrollBy(action.x, action.y)
    } else {
      element.scrollTo(action.x, action.y)
    }

    return {
      preActionSequence,
      target: target === "window" ? "document" : "shell",
      scrollField: target === "window" ? "windowScroll" : "shellScroll",
      expected,
    }
  }, { target, action })
  await settle(page)
  await page.waitForFunction(
    ({ preActionSequence, target, scrollField, expected }) =>
      window.__PARITY_RUNNER__.scrollEvents.some((entry) => {
        const scroll = entry[scrollField]
        return (
          entry.sequence > preActionSequence &&
          entry.target === target &&
          scroll?.x === expected.x &&
          scroll?.y === expected.y
        )
      }),
    delivery,
    { polling: 10, timeout: 2000 },
  )
}

function gestureSemantics(entries) {
  return entries.map((entry) => ({
    at: entry.at,
    type: entry.type,
    eventType: entry.event.type,
    info: entry.info,
    boundValues: entry.boundValues,
  }))
}

function snapshotSemantics(entry) {
  return {
    label: entry.label,
    mappingKind: entry.mappingKind,
    stableScale: entry.stableScale,
    visualScale: entry.visualScale,
    mounted: entry.mounted,
    scroll: entry.scroll,
    shellScroll: entry.shellScroll,
    rects: {
      shell: entry.rects.shell,
      stage: entry.rects.stage,
      board: entry.rects.board,
      slot: entry.rects.slot,
      target: entry.rects.target,
      handle: entry.rects.handle,
      follower: entry.rects.follower,
    },
    boundValues: entry.boundValues,
  }
}

const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected)

async function runCase(browser, spec) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })
  await context.addInitScript(clockInit)
  const page = await context.newPage()
  let pointer = { down: false, client: null }
  const captured = new Map()
  const result = { id: spec.id, status: "running", mismatches: [], output: null, error: null }

  try {
    const route = spec.kind === "pan" ? "pan" : "drag"
    await page.goto(`${baseUrl}/tests/transform-page-point/${route}?case=${encodeURIComponent(spec.id)}&@isPlaywright=true`, {
      waitUntil: "domcontentloaded",
    })
    await page.waitForFunction(() => window.__PARITY__?.ready === true, null, {
      polling: 10,
      timeout: 5000,
    })
    await advance(page, 16)
    await advance(page, 16)
    captured.set("runner-boot", await snapshot(page, "runner-boot"))

    for (const step of spec.steps) {
      switch (step.op) {
        case "snapshot":
          captured.set(step.label, await snapshot(page, step.label))
          break
        case "frame":
          await advance(page, step.ms)
          break
        case "pointerDown": {
          const point = await center(page, step.target)
          pointer = { down: true, client: point }
          await page.mouse.move(point.x, point.y)
          await page.mouse.down()
          break
        }
        case "pointerMove":
          if (!pointer.client) throw new Error("pointerMove has no preceding pointerDown")
          pointer.client = {
            x: pointer.client.x + step.dx,
            y: pointer.client.y + step.dy,
          }
          await page.mouse.move(pointer.client.x, pointer.client.y)
          break
        case "pointerUp":
          await page.mouse.up()
          pointer.down = false
          break
        case "pointerCancel":
          if (!pointer.client) throw new Error("pointerCancel has no pointer coordinates")
          await page.evaluate(({ x, y }) => {
            window.dispatchEvent(
              new PointerEvent("pointercancel", {
                bubbles: true,
                pointerId: 1,
                pointerType: "mouse",
                isPrimary: true,
                clientX: x,
                clientY: y,
                button: 0,
                buttons: 0,
              }),
            )
          }, pointer.client)
          await page.mouse.up()
          pointer.down = false
          break
        case "pageScroll":
          await waitForScroll(page, "window", step)
          break
        case "ancestorScroll":
          await waitForScroll(page, "shell", step)
          break
        case "setMapping":
          await page.evaluate((value) => window.__PARITY__.actions.setMapping(value), step.value)
          await settle(page)
          await page.waitForFunction(
            (value) => window.__PARITY__.actions.captureSnapshot("mapping-ready").mappingKind === value,
            step.value,
            { polling: 10, timeout: 2000 },
          )
          break
        case "setStableScale":
          await page.evaluate((value) => window.__PARITY__.actions.setStableScale(value), step.value)
          await page.waitForFunction(
            (value) =>
              Math.abs(
                new DOMMatrix(
                  getComputedStyle(document.querySelector('[data-testid="stage"]')).transform,
                ).a -
                  1 / value,
              ) < 0.0001,
            step.value,
            { polling: 10, timeout: 2000 },
          )
          captured.set("stable-scale-commit", await snapshot(page, "stable-scale-commit"))
          break
        case "resizeBoard":
          await page.evaluate((value) => window.__PARITY__.actions.resizeBoard(value), step.width)
          await page.waitForFunction(
            (width) => document.querySelector('[data-testid="board"]')?.offsetWidth === width,
            step.width,
            { polling: 10, timeout: 2000 },
          )
          await page.evaluate(() => window.dispatchEvent(new Event("resize")))
          break
        case "shiftLayout": {
          const before = await snapshot(page, "before-layout-action")
          await page.evaluate((value) => window.__PARITY__.actions.shiftLayout(value), step.px)
          await page.waitForFunction(
            ({ offset, px }) =>
              document.querySelector('[data-testid="slot"]')?.offsetLeft === offset + px,
            { offset: before.layout.slotOffsetLeft, px: step.px },
            { polling: 10, timeout: 2000 },
          )
          captured.set("layout-commit", await snapshot(page, "layout-commit"))
          break
        }
        case "unmount":
          await page.evaluate(() => window.__PARITY__.actions.unmount())
          await page.waitForFunction(
            () => document.querySelector('[data-testid="target"]') === null,
            null,
            { polling: 10, timeout: 2000 },
          )
          break
        default:
          throw new Error(`Unknown operation ${step.op}`)
      }
      await settle(page)
    }

    const output = await page.evaluate(() => ({
      clock: window.__PARITY_CLOCK__.read(),
      trace: window.__PARITY__.trace,
    }))
    result.output = output
    const expected = expectedById.get(spec.id)
    const actualCallbacks = gestureSemantics(
      output.trace.filter((entry) => entry.type.startsWith(spec.kind === "pan" ? "onPan" : "onDrag")),
    )
    const expectedCallbacks = gestureSemantics(expected.callbacks)
    if (!same(actualCallbacks, expectedCallbacks)) {
      result.mismatches.push({ kind: "callbacks", expected: expectedCallbacks, actual: actualCallbacks })
    }

    for (const expectedSnapshot of expected.snapshots) {
      const actualSnapshot = captured.get(expectedSnapshot.label)
      if (!actualSnapshot) {
        result.mismatches.push({ kind: "snapshot-missing", label: expectedSnapshot.label })
        continue
      }
      const expectedSemantic = snapshotSemantics(expectedSnapshot)
      const actualSemantic = snapshotSemantics(actualSnapshot)
      if (!same(actualSemantic, expectedSemantic)) {
        result.mismatches.push({
          kind: "snapshot",
          label: expectedSnapshot.label,
          expected: expectedSemantic,
          actual: actualSemantic,
        })
      }
    }
    result.status = result.mismatches.length ? "mismatch" : "matched"
  } catch (error) {
    result.status = "driver-failed"
    result.error = error instanceof Error ? error.stack : String(error)
    result.output = await page
      .evaluate(() => ({
        clock: window.__PARITY_CLOCK__?.read?.() ?? null,
        trace: window.__PARITY__?.trace ?? [],
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
const results = []
try {
  for (const [index, spec] of cases.entries()) {
    process.stderr.write(`[${index + 1}/${cases.length}] ${spec.id}: running\n`)
    const result = await runCase(browser, spec)
    results.push(result)
    process.stderr.write(`[${index + 1}/${cases.length}] ${spec.id}: ${result.status}\n`)
  }
} finally {
  await browser.close()
}

const report = {
  schemaVersion: 1,
  reference: "Svelte fixture compared with recorded public Motion 13.2.0 semantics",
  baseUrl,
  viewport: VIEWPORT,
  cases: results,
}
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
const summary = results.map(({ id, status, mismatches, error }) => ({
  id,
  status,
  mismatchCount: mismatches.length,
  error: error?.split("\n")[0] ?? null,
}))
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
if (results.some(({ status }) => status !== "matched")) process.exitCode = 1
