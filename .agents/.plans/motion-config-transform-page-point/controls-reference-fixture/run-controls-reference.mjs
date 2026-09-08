import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const fixtureRoot = path.dirname(fileURLToPath(import.meta.url));
const featureWorktree =
  process.env.FEATURE_WORKTREE ??
  "/Users/jasonkummerl/Github/svelte-motion-transform-page-point";
const requireFromWorktree = createRequire(
  path.join(featureWorktree, "package.json"),
);
let playwright;
try {
  playwright = requireFromWorktree("@playwright/test");
} catch {
  playwright = requireFromWorktree("playwright");
}
const { chromium } = playwright;

const baseUrl =
  process.env.REACT_CONTROLS_URL ?? "http://127.0.0.1:4299/controls.html";
const outputPath =
  process.env.REACT_CONTROLS_OUTPUT ??
  path.join(fixtureRoot, "react-controls-reference.json");
const viewport = { width: 1280, height: 720 };
const round = (value) =>
  Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : value;
const center = (box) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});
const matrixTranslation = (transform) => {
  const values = transform
    .match(/^matrix\(([^)]+)\)$/)?.[1]
    .split(",")
    .map(Number);
  return values?.length === 6 ? { x: values[4], y: values[5] } : null;
};
const packageVersions = Object.fromEntries(
  ["react", "react-dom", "motion", "framer-motion", "motion-dom"].map(
    (name) => [
      name,
      JSON.parse(
        fs.readFileSync(
          path.join(fixtureRoot, "node_modules", name, "package.json"),
          "utf8",
        ),
      ).version,
    ],
  ),
);
const requiredVersions = {
  react: "19.1.1",
  "react-dom": "19.1.1",
  motion: "13.2.0",
  "framer-motion": "13.2.0",
  "motion-dom": "13.2.0",
};
for (const [name, expected] of Object.entries(requiredVersions)) {
  if (packageVersions[name] !== expected) {
    throw new Error(
      `${name} must resolve to ${expected}; found ${packageVersions[name]}`,
    );
  }
}

async function assertServer() {
  const response = await fetch(baseUrl);
  if (!response.ok)
    throw new Error(`Reference server returned HTTP ${response.status}`);
}

async function openFixture(page, result) {
  await page.goto(baseUrl);
  await page.waitForFunction(() => window.__CONTROLS_PARITY__?.ready === true);
  const boot = await page.evaluate(() =>
    window.__CONTROLS_PARITY__.actions.captureSnapshot("boot"),
  );
  const checks = [
    [
      "viewport is the Playwright Desktop Chrome default",
      boot.viewport.width === 1280 && boot.viewport.height === 720,
      boot.viewport,
      viewport,
    ],
    [
      "plain target is exactly 100x100",
      boot.rects.plain.width === 100 && boot.rects.plain.height === 100,
      boot.rects.plain,
      { width: 100, height: 100 },
    ],
    [
      "initial target is exactly 80x80",
      boot.rects.initial.width === 80 && boot.rects.initial.height === 80,
      boot.rects.initial,
      { width: 80, height: 80 },
    ],
    [
      "initial public x/y is rendered before input",
      matrixTranslation(boot.transforms.initial)?.x === 100 &&
        matrixTranslation(boot.transforms.initial)?.y === 40,
      boot.transforms.initial,
      "matrix translation (100,40)",
    ],
  ];
  for (const [name, pass, actual, expected] of checks) {
    result.preconditions.push({ name, pass, actual, expected });
    if (!pass)
      throw new Error(
        `Precondition failed: ${name}; actual=${JSON.stringify(actual)}`,
      );
  }
  return boot;
}

async function box(page, testId) {
  const value = await page.locator(`[data-testid="${testId}"]`).boundingBox();
  if (!value) throw new Error(`No rendered box for ${testId}`);
  return Object.fromEntries(
    Object.entries(value).map(([key, number]) => [key, round(number)]),
  );
}

async function assertPointerDown(page, result, targetTestId, requested) {
  const actual = await page.evaluate(
    ({ targetTestId, requested }) => {
      const entries = window.__CONTROLS_PARITY__.inputTrace.filter(
        (entry) =>
          entry.targetTestId === targetTestId &&
          entry.event.type === "pointerdown",
      );
      const entry = entries.at(-1);
      return {
        entry: entry ?? null,
        requested,
        scroll: { x: window.scrollX, y: window.scrollY },
      };
    },
    { targetTestId, requested },
  );
  const event = actual.entry?.event;
  const pass =
    event?.pointerType === "mouse" &&
    event?.isPrimary === true &&
    event?.client.x === requested.x &&
    event?.client.y === requested.y &&
    event?.page.x === requested.x + actual.scroll.x &&
    event?.page.y === requested.y + actual.scroll.y;
  result.preconditions.push({
    name: `${targetTestId} receives the real mouse pointerdown coordinates`,
    pass,
    actual,
    expected: { requested, pointerType: "mouse", isPrimary: true },
  });
  if (!pass)
    throw new Error(
      `Pointer precondition failed for ${targetTestId}: ${JSON.stringify(actual)}`,
    );
}

async function runTinyNudge(page) {
  const result = {
    id: "tiny-right-nudge",
    preconditions: [],
    output: null,
    error: null,
  };
  try {
    const boot = await openFixture(page, result);
    const targetBefore = await box(page, "drag-controls");
    const handle = await box(page, "handle");
    const start = center(handle);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 2, start.y, { steps: 2 });
    await page.mouse.up();
    const targetAfter = await box(page, "drag-controls");
    await assertPointerDown(page, result, "handle", start);
    const final = await page.evaluate(() => ({
      trace: window.__CONTROLS_PARITY__.trace,
      inputTrace: window.__CONTROLS_PARITY__.inputTrace,
      snapshots: window.__CONTROLS_PARITY__.snapshots,
    }));
    result.output = {
      boot,
      input: { handle, start, move: { x: start.x + 2, y: start.y }, steps: 2 },
      positions: {
        before: targetBefore,
        after: targetAfter,
        deltaX: round(targetAfter.x - targetBefore.x),
        deltaY: round(targetAfter.y - targetBefore.y),
      },
      ...final,
    };
  } catch (error) {
    result.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return result;
}

async function runRepeatedInitial(page) {
  const result = {
    id: "initial-100-40-repeated-snap",
    preconditions: [],
    output: null,
    error: null,
  };
  try {
    const boot = await openFixture(page, result);
    const drags = [];
    for (let index = 0; index < 2; index += 1) {
      const handle = await box(page, "initial-handle");
      const start = center(handle);
      const before = await box(page, "drag-controls-initial");
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + 50, start.y + 50, { steps: 5 });
      await page.waitForTimeout(50);
      const active = await box(page, "drag-controls-initial");
      await page.mouse.up();
      await page.waitForTimeout(100);
      await assertPointerDown(page, result, "initial-handle", start);
      drags.push({
        index,
        handle,
        start,
        move: { x: start.x + 50, y: start.y + 50 },
        steps: 5,
        before,
        active,
      });
    }
    const final = await page.evaluate(() => ({
      trace: window.__CONTROLS_PARITY__.trace,
      inputTrace: window.__CONTROLS_PARITY__.inputTrace,
      snapshots: window.__CONTROLS_PARITY__.snapshots,
    }));
    result.output = {
      boot,
      drags,
      repeatedActiveDelta: {
        x: round(drags[1].active.x - drags[0].active.x),
        y: round(drags[1].active.y - drags[0].active.y),
      },
      ...final,
    };
  } catch (error) {
    result.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return result;
}

await assertServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport });
const page = await context.newPage();
const report = {
  schemaVersion: 1,
  reference: "public motion/react 13.2.0 drag controls",
  baseUrl,
  viewport,
  packages: packageVersions,
  cases: [await runTinyNudge(page), await runRepeatedInitial(page)],
};
await browser.close();
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
if (
  report.cases.some(
    (entry) => entry.error || entry.preconditions.some((check) => !check.pass),
  )
) {
  process.exitCode = 1;
}
console.log(outputPath);
