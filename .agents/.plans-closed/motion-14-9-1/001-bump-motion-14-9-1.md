# Plan 001: Pin Motion 14.9.1, set the version to 2.9.0, and pin the free fixes with regression tests

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Drift check (run first)**: `git diff --stat fb9ed218..HEAD -- package.json pnpm-lock.yaml src/lib/__tests__/motionExportAllowlist.ts src/lib/index.spec.ts src/routes/tests/layout-id src/routes/tests/motion e2e/layout-id e2e/motion src/routes/+page.svelte`
> The only expected change is this batch folder. If any listed path changed, compare the "Current state" excerpts against the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (the dependency bump can surface e2e regressions anywhere)
- **Depends on**: none
- **Wave**: 1
- **Category**: migration
- **Planned at**: commit `fb9ed218`, 2026-11-04

## Why this matters

`@humanspeak/svelte-motion` is a Svelte 5 port of Motion. It depends on the `motion` and `motion-dom` npm packages, pinned to one exact version. Upstream has released 14.7.2, 14.8.0, 14.9.0 and 14.9.1. Most of their fixes live in `motion-dom` and reach us just by moving the pin, because our code calls that code rather than copying it. This plan does three things:
- It moves the pin.
- It sets the package version so the release lands on 2.9.1. The publish workflow patch-bumps `2.9.0` to `2.9.1`, and the maintainer asked for exactly that.
- It adds regression tests that fail on 14.7.1 and pass on 14.9.1, so that a later bump can't silently lose these fixes.

## Current state

- `package.json:3`: `"version": "2.5.1",`
- `package.json:152-153`, the runtime pins (exact, no caret; a spec enforces they are equal):
  ```json
  "motion": "14.7.1",
  "motion-dom": "14.7.1"
  ```
- `src/lib/index.spec.ts:96-112`: a test fails when `motion` exports a runtime name that we neither re-export nor allowlist:
  ```ts
  it('re-exports or deliberately skips every runtime export of motion', async () => {
      const motionExports = Object.keys(await import('motion')).sort()
      ...
      expect(unaccounted, 'motion exports that are neither re-exported nor allowlisted').toEqual([])
  ```
- `src/lib/__tests__/motionExportAllowlist.ts:18` holds `MOTION_EXPORTS_NOT_REEXPORTED`. Layout internals are listed alphabetically around lines 92-110 (`'HTMLProjectionNode'`, `'LayoutAnimationBuilder'`, `'parseAnimateLayoutArgs'`, …). Motion 14.9.1's `motion-dom/src/index.ts` adds two runtime exports, `acquireProjectionNode` and `flushLayoutSnapshots`, in the same block as `LayoutAnimationBuilder`. These are layout internals, so they get allowlisted the same way.
- **#4042, exit stuck after an open `layoutId` card switches item.** This is upstream's dev page `dev/react/src/tests/issue-4042.tsx` and spec `tests/react/issue-4042.spec.ts` (in `~/Github/motion` at tag `v14.9.1`; read them with `git -C ~/Github/motion show v14.9.1:<path>`). The setup:
  - Two gallery squares, `red` and `blue`. Each is a `motion.div` with `layoutId={color}` and a nested `motion.div` dot with `layoutId={`dot-${color}`}`. Each has `transition={{ duration: 1 }}`.
  - Clicking a square opens a card: an `AnimatePresence` child `motion.div` with `id="card"`, `layoutId={open}`, `position: absolute; top: 200px; left: 200px; width: 300px; height: 200px`, and a nested dot with `layoutId={`dot-${open}`}`.
  - A `#close` button sets `open = null`.
  - The spec opens red, waits 1.5 s, clicks blue (switching the card's layoutIds), and checks that red's dot animates home: after 300 ms its x and y are each more than 20 px past its rest box, and after 1.2 s more it is exactly at rest. It then clicks close and expects `#card` to be gone within 2.5 s, with no page errors.
  - On 14.7.1 the card never leaves. Our `switchLayoutId` (`src/lib/utils/motionDomProjection.ts:677-730`) reaches that state.
- **#4027, `jump()` during a running animation.** Upstream's unit test `packages/framer-motion/src/value/__tests__/motion-value.test.ts`, `describe("MotionValue.jump")` (added in e8a4e8088), does the following:
  - It mocks `Element.prototype.animate` to return a running animation.
  - It starts a `NativeAnimationExtended` opacity 0→1 on a `motionValue(0)`.
  - It calls `value.jump(0)`, then expects `isAnimating()` to be false and `get()` to be 0.

  Our key-change rewind and `set()` controls both go through `jump()` (`src/lib/html/_MotionContainer.svelte:3663,3780`).
- Conventions:
  - Tester pages use `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`). The panel is hidden under `?@isPlaywright=true`, and each step has an `expected` and an action button.
  - Copy the structure of `src/routes/tests/layout-id/open-change/+page.svelte` and its spec `e2e/layout-id/open-change.spec.ts`. The spec is a port of an upstream spec with a header comment that cites it, and it uses `URL = '/tests/layout-id/open-change?@isPlaywright=true'`.
  - Index links in `src/routes/+page.svelte` look like `href={resolve('/tests/layout-id/scrolled') + searchParams}` (around line 1165).
  - Unit tests use Vitest (`describe`/`it`/`expect`/`vi`). See `src/lib/utils/visualElementCore.spec.ts:1-30` for imports from `motion-dom`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install (after the pin edit) | `pnpm install` | exit 0, lockfile updated |
| Types | `pnpm check` | `0 ERRORS` |
| Unit tests | `pnpm test:only` | all pass |
| One unit file | `pnpm test:only src/lib/utils/jumpStopsAnimation.spec.ts` | as stated per step |
| Build | `pnpm build` | exit 0, publint "All good!" |
| One e2e file | `PW_PORT=4231 pnpm exec playwright test --project=chromium e2e/layout-id/card-switch.spec.ts` | as stated per step |
| Full e2e | `PW_PORT=4231 pnpm exec playwright test --project=chromium` | all pass (2 known skips) |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Never use port 4198 and never set `PW_REUSE_SERVER`. Never use `git stash`.

## Scope

**In scope:**
- `package.json`: the `"version"` field and the two pins only
- `pnpm-lock.yaml`: regenerated by `pnpm install`
- `src/lib/__tests__/motionExportAllowlist.ts`
- `src/lib/utils/jumpStopsAnimation.spec.ts` (create)
- `src/routes/tests/layout-id/card-switch/+page.svelte` (create)
- `e2e/layout-id/card-switch.spec.ts` (create)
- `src/routes/tests/motion/accelerated-remount/+page.svelte` (create)
- `e2e/motion/accelerated-remount.spec.ts` (create)
- `src/routes/+page.svelte` (two links)
- `.changeset/motion-14-9-1.md` (create)

**Out of scope:**
- Any `src/lib` runtime code. If a test only passes with a runtime change, that is a STOP.
- `src/lib/utils/transform.svelte.ts` (plan 002), `src/lib/components/Reorder/**` (plan 003), `src/lib/utils/visualElementCore.ts` (plan 004), `src/lib/types.ts` (plan 005), and docs (plan 006).
- PR labels. Never add `minor` or `major`.

## Git workflow

- Lane branch `lane/1491-bump`, cut from the wave-0 SHA.
- Use conventional commits, as in `git log`. For example: `test(layout-id): pin the #4042 card-switch exit (red on 14.7.1)` and `chore(deps): pin motion and motion-dom to 14.9.1`.
- End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not push.

## Steps

### Step 1: Write the regression tests (red on 14.7.1)

1. `src/lib/utils/jumpStopsAnimation.spec.ts`: port upstream's `describe("MotionValue.jump")` cases from `packages/framer-motion/src/value/__tests__/motion-value.test.ts` at `v14.9.1`. There are two: "ends at the jumped value when stopping a running animation" and the overdue JS-animation case added in db88ba821.
   - Import `motionValue` and `NativeAnimationExtended` from `motion-dom`. Use `vi.fn()` in place of `jest.fn()`.
   - Delete the `Element.prototype.animate` mock in `afterEach` rather than setting it to `undefined` (`supportsWaapi()` checks for an own property).
2. `src/routes/tests/layout-id/card-switch/+page.svelte`: a Svelte port of `issue-4042.tsx` with the same ids (`red`, `blue`, `dot-red`, `dot-blue`, `close`, `card`), the same sizes and `transition={{ duration: 1 }}`.
   - Use `AnimatePresence` with `{#if open}` and `motion.div` with `layoutId`.
   - Add a `TesterPanel` with three steps: "Open red", then "Switch to blue", then "Close". The expected text for "Switch to blue" is "red's dot animates home from the card"; for "Close" it is "the card shrinks into blue and is removed".
   - Add a live chip reading `#card` presence 2.5 s after Close: `REMOVED` or `STUCK`.
3. `e2e/layout-id/card-switch.spec.ts`: port `tests/react/issue-4042.spec.ts`. Keep both loop cases (switch and no switch) and the dot-midway and dot-at-rest assertions. Header comment: cite the upstream spec at `v14.9.1` and issue #4042.
4. `src/routes/tests/motion/accelerated-remount/+page.svelte`: a `motion.div` `#box` with `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `transition={{ duration: 0.1 }}`, and a `key` prop bound to a `$state` number.
   - On mount, after two `requestAnimationFrame`s, post to a `MessageChannel`. In its handler, busy-wait 300 ms (`while (performance.now() - start < 300) {}`), then increment the key and render `<div id="remounted">`.
   - This is the Svelte equivalent of upstream's `dev/react/src/tests/suspense-remount-running-animation.tsx`: the key change rewinds through `jump()`.
   - Add a TesterPanel with one step, "Reload the page; the box ends fully opaque", and a chip that reads the final opacity.
5. `e2e/motion/accelerated-remount.spec.ts`: wait for `#remounted`, then wait 500 ms, then expect `#box` computed opacity to be `1`. Cite upstream's Cypress `suspense-remount-running-animation.ts` and #4027 in the header.
6. Add both pages to `src/routes/+page.svelte`, next to the existing layout-id and motion entries, in the same format.

**Verify**:
- `pnpm test:only src/lib/utils/jumpStopsAnimation.spec.ts` → FAILS. At least the first case gets `get()` ≠ 0, or `isAnimating()` true.
- `PW_PORT=4231 pnpm exec playwright test --project=chromium e2e/layout-id/card-switch.spec.ts` → the "after switching" case FAILS at `toHaveCount(0)`, because the card is never removed.
- `PW_PORT=4231 pnpm exec playwright test --project=chromium e2e/motion/accelerated-remount.spec.ts` → record the result. If it passes on 14.7.1, keep it as a guard and say so in the commit message. That is acceptable, because the Svelte key path may not reach the overdue state.

Commit the red tests: `test: pin the 14.9.1 jump() and #4042 fixes (red on 14.7.1)`.

### Step 2: Set the version

In `package.json`, change `"version": "2.5.1"` to `"version": "2.9.0"`. Change nothing else in that step. The publish workflow patch-bumps this to 2.9.1 on merge.

**Verify**: `node -p "require('./package.json').version"` → `2.9.0`

### Step 3: Move the pins

In `package.json`, set `"motion": "14.9.1"` and `"motion-dom": "14.9.1"`. Run `pnpm install`. pnpm 12 ignores `--save-exact`, so edit the file by hand and keep it without a caret.

**Verify**:
- `grep -n '"motion\(-dom\)\?": ' package.json` → both `14.9.1`, no caret.
- `node -p "require('motion/package.json').version + ' ' + require('motion-dom/package.json').version"` → `14.9.1 14.9.1`

### Step 4: Account for the new runtime exports

Run `pnpm test:only src/lib/index.spec.ts`. Expect the first test to fail with unaccounted `acquireProjectionNode` and `flushLayoutSnapshots`. Add both names to `MOTION_EXPORTS_NOT_REEXPORTED` in `src/lib/__tests__/motionExportAllowlist.ts`, in alphabetical order among the layout internals, matching the surrounding style.

**Verify**: `pnpm test:only src/lib/index.spec.ts` → all pass.

### Step 5: Flip the red tests green

**Verify**:
- `pnpm test:only src/lib/utils/jumpStopsAnimation.spec.ts` → PASS
- `PW_PORT=4231 pnpm exec playwright test --project=chromium e2e/layout-id/card-switch.spec.ts e2e/motion/accelerated-remount.spec.ts` → all PASS

### Step 6: Changeset

Create `.changeset/motion-14-9-1.md` with frontmatter `'@humanspeak/svelte-motion': minor`, the same as `.changeset/motion-14-7-1.md`. The body says "Update Motion and motion-dom to 14.9.1." and then lists, as user-visible effects, one line each:
- `jump()` during a running animation ends at the jumped value (#4027).
- An open `layoutId` card that switches to another item can still exit (#4042).
- SVG path data is written to the `d` attribute.
- Accelerated transform animations finish and clean up correctly, including in WebKit.
- Timeline changes stay inside their `scopeMotion` scope.

Do not mention plans.

### Step 7: Full gate

Run `pnpm check`, then `pnpm test:only`, then `pnpm build`, then the full e2e. Then run `trunk fmt` and `trunk check` on the changed files.

**Verify**:
- `pnpm check` → 0 errors
- `pnpm test:only` → all pass
- `pnpm build` → exit 0
- full e2e → all pass except the 2 known skips. Triage any failure one at a time. A failure that a bump causes outside this plan's scope is a STOP: report the spec, the assertion and the upstream commit you suspect.
- trunk → no new issues

Revert any change `pnpm build` makes to `docs/static/r/animated-tabs.json`.

## Test plan

- Red-first anchors:
  - `jumpStopsAnimation.spec.ts` fails on 14.7.1 because `get()` ≠ jumped value.
  - `card-switch.spec.ts` "after switching" fails on 14.7.1 with "card still present".
  - Both pass on 14.9.1.
- `accelerated-remount.spec.ts` may already pass on 14.7.1. It is then a guard; record which.
- The export test is the tripwire for new upstream names on every future bump.

## Maintenance note

Every future bump will trip `src/lib/index.spec.ts` when upstream adds runtime exports. Allowlist internals and re-export public API. The `"version"` edit here is a one-off the maintainer asked for. Future plans must not change `"version"`.

## STOP conditions

- `jumpStopsAnimation.spec.ts` or the card-switch "after switching" case passes on 14.7.1. The reproduction is wrong; report it.
- After the bump, `index.spec.ts` lists unaccounted names other than `acquireProjectionNode` and `flushLayoutSnapshots`.
- Any test outside this plan's new files fails after the bump.
- `pnpm install` changes dependencies other than `motion`, `motion-dom` and their own `motion-utils`.
