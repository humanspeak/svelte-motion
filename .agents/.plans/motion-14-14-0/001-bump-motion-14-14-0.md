# Plan 001: Pin Motion 14.14.0, set the version to 2.13.0, allowlist `getSpringOptions`, and pin what arrives free with tests

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Never use `git stash`** (one stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4271**. Prefix every Playwright command with `PW_PORT=4271`. Port 4198 belongs to the maintainer; never use or kill it. Never set `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat 4665b907..HEAD -- package.json pnpm-lock.yaml src/lib/index.spec.ts src/lib/__tests__/motionExportAllowlist.ts src/lib/utils/springVelocity.spec.ts e2e/pinch/vanilla.spec.ts src/routes/tests/pinch/vanilla .changeset`
> Expected: no output (the batch's own `.agents/.plans/motion-14-14-0/` commit is not in that path list). If any listed path changed, compare the "Current state" excerpts against the live code. On a mismatch, STOP.

## Status

- **Priority**: P1 (every other plan in the batch needs motion-dom 14.14.0, except 002)
- **Effort**: S–M
- **Risk**: LOW. At planning time a scratch bump to 14.14.0 gave `pnpm check` 0 errors and `pnpm test:only` 1710 of 1711 passing; the one failure was the export tripwire, as expected (see "Current state").
- **Depends on**: none
- **Wave**: 1
- **Category**: migration
- **Planned at**: commit `4665b907` (`origin/main`, v2.12.0, Motion 14.12.0), 2026-11-14

## Why this matters

`@humanspeak/svelte-motion` is a Svelte 5 port of Motion. It depends on the `motion` and `motion-dom` npm packages, both pinned to one exact version (currently 14.12.0). Upstream has released 14.13.0 and 14.14.0. Three things arrive with the pin alone, because we call motion-dom unchanged for them:

1. **`mass: "auto"` is a valid spring mass** (14.13): the type widens to `number | "auto"` and the spring generator stops warning about it. In a layout animation, motion-dom's projection node turns it into a mass taken from the element's size.
2. **A drag that starts while a pinch snaps back no longer freezes scale and rotate** (14.13, upstream #4076).
3. **One new runtime export, `getSpringOptions`** (14.14 "internal exports for use inside Motion UI"). Our export tripwire fails on any new `motion` runtime export we neither re-export nor allowlist, so the bump and the allowlist entry have to land together.

This plan adds tests that are red on 14.12.0 and green on 14.14.0, so a later bump cannot silently lose 1 or 2.

The maintainer's default for this batch is to release it as **svelte-motion 2.14.0** using a `minor` label from 2.13.x. So this plan sets `"version": "2.13.0"`. It is the only plan in the batch that touches `"version"`. **Never add PR labels**: the maintainer does that.

## Current state

- `package.json:3`: `"version": "2.12.0",`
- `package.json:152-153` holds the runtime pins. They are exact, with no caret, and `src/lib/__tests__/motionDependencies.spec.ts` enforces that they are equal:
  ```json
  "motion": "14.12.0",
  "motion-dom": "14.12.0"
  ```
- `package.json:211`: `"packageManager": "pnpm@12.6.0"`. If the global `pnpm` cannot switch to it (`@pnpm/exe` verify error), run every `pnpm` command as `npx -y pnpm@12.6.0 …`.
- `pnpm-workspace.yaml` has a 48-hour `minimumReleaseAge` but excludes `motion`, `motion-dom`, `motion-utils` and `framer-motion`, so 14.14.0 (published 2026-11-13) installs. `npm view motion@14.14.0 version` answered `14.14.0` at planning time.
- **Upstream source** is a local clone at `~/Github/motion`, with tags `v14.12.0`, `v14.13.0` and `v14.14.0`. Read files with `git -C ~/Github/motion show v14.14.0:<path>`.
- **Export tripwire.** `src/lib/index.spec.ts:96-112` ("re-exports or deliberately skips every runtime export of motion") fails when `motion` gains a runtime export that is neither re-exported from `src/lib/index.ts` nor listed in `src/lib/__tests__/motionExportAllowlist.ts`. A scratch bump at planning time reported exactly:
  ```
  motion exports that are neither re-exported nor allowlisted: expected [ 'getSpringOptions' ] to deeply equal []
  ```
  `getSpringOptions` became exported in `packages/motion-dom/src/animation/generators/spring.ts:217` at v14.14.0 (it was a module-private function at v14.12.0), and `packages/motion-dom/src/index.ts:42` does `export * from "./animation/generators/spring"`. It has no `@public` tag and no docs; upstream's only caller is `packages/motion-dom/src/projection/animation/layout-velocity.ts:29`. It is an internal: allowlist it, do not re-export it.
- `src/lib/__tests__/motionExportAllowlist.ts:163` starts the group it belongs in: `// [c] Animation engine classes and helpers (JS/WAAPI animations, generators, transitions)`. Entries in a group are alphabetical.
- **The `mass: "auto"` change** (upstream commits `ddf846689`, `62e6f45a6`, `e846c6938`). At v14.14.0:
  - `packages/motion-dom/src/animation/types.ts:339`: `mass?: number | "auto"` (was `mass?: number`).
  - `packages/motion-dom/src/animation/generators/spring.ts:206-211`: the `spring-invalid-physics` warning is skipped when the value is `"auto"`:
    ```ts
    warning(
        value === undefined || (value as unknown) === "auto",
        "Spring stiffness and mass must be positive, damping 0 or greater",
        "spring-invalid-physics"
    )
    ```
  - Measured at planning time on 14.12.0: `spring({ keyframes: [0, 100], stiffness: 100, damping: 10, mass: 'auto' })` calls `console.warn` once ("Spring stiffness and mass must be positive, damping 0 or greater…"). On 14.14.0 it must not.
  - Our transition type is motion's own: `src/lib/types.ts:306` `export type MotionTransition = AnimationOptions | undefined`, so the wider type arrives with the pin.
- **The pinch fix** (upstream commit `5e243b4a4`, issue #4076). `packages/motion-dom/src/gestures/pinch/index.ts` at v14.12.0 `:487-488`, inside the snap-back `tick`:
  ```ts
  const tick = () => {
      if (dragControls()?.isDragging) return stopSnap()
  ```
  A drag starting mid-snap stopped the whole snap, leaving scale past its limit. At v14.14.0 (`:487-500`) the line is gone and only the x/y writes are skipped while dragging:
  ```ts
  // A drag that starts mid-snap owns x/y from then on.
  if (moves && !dragControls()?.isDragging) {
  ```
  We re-export motion's `pinch()` unchanged (`src/lib/index.ts`) and the `pinch` prop calls motion-dom's `addPinchListeners` (`src/lib/utils/pinchFeature.ts`), so nothing needs porting.
  - Upstream's unit test: `packages/motion-dom/src/gestures/pinch/__tests__/pinch.test.ts`, "a drag during the spring back still settles scale (#4076)" (in `describe("pinch with drag")`).
- **Our pinch browser tests.** `e2e/pinch/vanilla.spec.ts` drives `src/routes/tests/pinch/vanilla/+page.svelte`. The page reads its options from the query string: `?drag` attaches `drag(box, { momentum: false })` (`:75`), `?rotate` enables rotation (`:97`), and `?min=…&max=…` set scale limits (`:55`). The spec's helpers are in `e2e/pinch/_helpers.ts` (`frames`, `rect`, `touch`, `twoFinger`), and the spec's own `open(page, query)` (`:23-29`). Its ctrl + wheel test (`:262-287`) shows how a trackpad zoom is sent:
  ```ts
  await page.mouse.move(110, 110)
  await page.keyboard.down('Control')
  for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, -7)
      await frames(page, 1)
  }
  await page.keyboard.up('Control')
  ```
- **The LazyMotion fix** (14.14.0, upstream `4851330cb`) is React-only: it wraps a `setState` in `startTransition` so React keeps the server HTML of a pending `Suspense` boundary. Our `src/lib/components/LazyMotion.svelte:99` renders `{@render children?.()}` unconditionally and never re-creates its children when an async bundle resolves, so there is nothing to port. `src/lib/components/LazyMotion.spec.ts:91` ("gives m no VisualElement until an async loader resolves") already covers the async path. This plan adds one guard test for node identity (Step 2).
- Conventions:
  - Unit tests use Vitest (`describe`/`it`/`expect`/`vi`). Specs under `src/lib/utils/` import the library through `'../index.js'` (see `src/lib/utils/springVelocity.spec.ts`).
  - Changesets: `.changeset/motion-14-12-0.md` is the model (frontmatter `'@humanspeak/svelte-motion': minor`, a lead sentence, then one bullet per arriving change).
  - Commits are conventional (`chore(deps): …`, `test: …`), as in `git log`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install` | exit 0 |
| Types | `pnpm check` | `0 ERRORS` |
| All unit tests | `pnpm test:only` | all pass |
| One unit file | `pnpm exec vitest run <path>` | as stated per step |
| Build | `pnpm build` | exit 0, publint "All good!" |
| One e2e file | `PW_PORT=4271 pnpm exec playwright test --project=chromium <path>` | as stated per step |
| Full e2e | `PW_PORT=4271 pnpm exec playwright test --project=chromium` | all pass (known skips only) |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Trunk is this repo's lint and format authority. Do not run `prettier`, `eslint` or `pnpm lint` directly. In zsh, pass file lists through `xargs`, not a `$files` variable.

## Scope

**In scope:**
- `package.json`: the `"version"` field and the two pins only
- `pnpm-lock.yaml`: regenerated by `pnpm install`
- `src/lib/__tests__/motionExportAllowlist.ts`: one allowlist entry
- `src/lib/utils/springAutoMass.spec.ts` (create)
- `src/lib/components/LazyMotion.spec.ts`: one new test
- `e2e/pinch/vanilla.spec.ts`: one new test
- `.changeset/motion-14-14-0.md` (create)

**Out of scope:**
- Any `src/lib` runtime code. If a test only passes with a runtime change, that is a STOP.
- Layout velocity (plans 003, 004, 005), the `fx` prop (plan 002), docs (plan 006).
- `src/lib/index.ts`: nothing is re-exported in this release.
- Editing an existing e2e or unit test to make it pass after the bump. Report it instead.
- PR labels.

## Git workflow

- Lane branch `lane/14140-bump`, cut from the wave-0 SHA (the commit that adds this batch folder on `feat/motion-14.14.0`).
- Conventional commits, for example `test: pin the 14.14.0 spring auto-mass and pinch snap changes (red on 14.12.0)` and `chore(deps): pin motion and motion-dom to 14.14.0`.
- End each commit message with the co-author line the dispatcher gives you.
- Do not push.

## Steps

### Step 0: Install the current lockfile

Run `pnpm install --frozen-lockfile`, then `pnpm exec svelte-kit sync`.

**Verify**: `node -p "require('./node_modules/motion/package.json').version + ' ' + require('./node_modules/motion-dom/package.json').version"` → `14.12.0 14.12.0`. If it prints anything else, STOP.

### Step 1: Write the red tests (red on 14.12.0)

**1a. `src/lib/utils/springAutoMass.spec.ts`** (create). Header comment: cite upstream `spring.ts:206-211` and `animation/types.ts:339` at v14.14.0. Import `spring` from `'../index.js'`.

1. **Red anchor.** "a spring with mass 'auto' does not warn":
   ```ts
   const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
   spring({ keyframes: [0, 100], stiffness: 100, damping: 10, mass: 'auto' as never })
   expect(warn).not.toHaveBeenCalled()
   warn.mockRestore()
   ```
   Keep the `as never` only while it is needed: after Step 3, remove it. If `pnpm check` then fails on this line, the type did not widen: STOP.
2. **Guard (green on both).** "an invalid mass still warns": the same call with `mass: -1` calls `console.warn` at least once.
3. **Guard (green on both).** "outside a layout animation, mass 'auto' behaves like the default mass": `spring({ keyframes: [0, 100], stiffness: 100, damping: 10, mass: 'auto' as never }).next(100).value` equals the same spring without `mass`, to 6 decimal places.

**1b. `e2e/pinch/vanilla.spec.ts`**: add one test to the "pinch with a trackpad" `describe`, a port of upstream's "a drag during the spring back still settles scale (#4076)":

```ts
test('a drag during the snap back still settles scale (#4076)', async ({ page }) => {
    await open(page, '?drag&max=1.5')
    // A trackpad zoom past max; it ends once the wheels stop.
    await page.mouse.move(150, 150)
    await page.keyboard.down('Control')
    for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, -7)
        await frames(page, 1)
    }
    await page.keyboard.up('Control')
    expect((await rect(page, '#box')).width).toBeGreaterThan(150)
    // Wait for the wheel gesture to end and the snap back to start.
    await page.waitForTimeout(200)
    // A drag starts while scale springs back.
    await page.mouse.down()
    await page.mouse.move(180, 150, { steps: 3 })
    await page.waitForTimeout(1500)
    expect((await rect(page, '#box')).width).toBeCloseTo(150, 0)
    await page.mouse.up()
})
```

Before relying on it, read `src/routes/tests/pinch/vanilla/+page.svelte:50-100` and confirm that `?max=1.5` reaches `pinch()` as `scale: { max: 1.5 }` and that `?drag` and `?max` can be combined. If the page reads the limits differently, adapt the query only.

**Verify** (on 14.12.0):
- `pnpm exec vitest run src/lib/utils/springAutoMass.spec.ts` → test 1 FAILS ("expected "warn" to not be called at all, but actually been called 1 times"); tests 2 and 3 PASS.
- `PW_PORT=4271 pnpm exec playwright test --project=chromium e2e/pinch/vanilla.spec.ts -g "4076"` → FAILS: the box's width stays above 150 (scale is stuck past `max`).

If test 1 passes on 14.12.0, the reproduction is wrong: STOP. If the e2e test passes on 14.12.0, check with a 400 ms wait in place of 200 ms and with the drag starting 100 ms after the last wheel; if it still passes, do not delete it. Keep it as a guard, say so in your report, and continue (the unit-level fix is upstream's own test, which we do not run).

Commit: `test: pin the 14.14.0 spring auto-mass and pinch snap changes (red on 14.12.0)`.

### Step 2: LazyMotion node-identity guard (green on both versions)

In `src/lib/components/LazyMotion.spec.ts`, next to "gives m no VisualElement until an async loader resolves" (`:91`), add `it('keeps the rendered element when an async loader resolves', …)`. Copy that test's setup (same probe component and deferred loader). Capture the `m` element before the loader resolves, resolve it, flush as that test does, and assert the element is the same node (`toBe`) and is still connected. Comment: upstream 14.14.0 fixed React discarding server HTML here (`components/LazyMotion/index.tsx:63-68`); Svelte never re-creates the children, and this test keeps it that way.

**Verify**: `pnpm exec vitest run src/lib/components/LazyMotion.spec.ts` → all PASS.

### Step 3: Set the version and move the pins

In `package.json`, change `"version": "2.12.0"` to `"version": "2.13.0"`, and set `"motion": "14.14.0"` and `"motion-dom": "14.14.0"`. pnpm 12 ignores `--save-exact`, so edit the file by hand and keep the versions without a caret. Then run `pnpm install`.

**Verify**:
- `node -p "require('./package.json').version"` → `2.13.0`
- `grep -n '"motion\(-dom\)\?": ' package.json` → both show `14.14.0`, no caret.
- `node -p "require('./node_modules/motion/package.json').version + ' ' + require('./node_modules/motion-dom/package.json').version"` → `14.14.0 14.14.0`
- `pnpm exec vitest run src/lib/__tests__/motionDependencies.spec.ts` → PASS
- `git diff --stat pnpm-lock.yaml` touches only `motion`, `motion-dom`, `framer-motion` and `motion-utils` entries.

### Step 4: Satisfy the export tripwire

1. Run `pnpm exec vitest run src/lib/index.spec.ts`. Expect the tripwire to FAIL listing exactly `getSpringOptions`. Any other name is a STOP.
2. In `src/lib/__tests__/motionExportAllowlist.ts`, add `'getSpringOptions',` to the "[c] Animation engine classes and helpers" group (starts at `:163`), in alphabetical position.

**Verify**: `pnpm exec vitest run src/lib/index.spec.ts` → all PASS.

### Step 5: Flip the red tests green

Remove the `as never` casts in `springAutoMass.spec.ts`.

**Verify**:
- `pnpm exec vitest run src/lib/utils/springAutoMass.spec.ts` → all PASS.
- `pnpm check` → 0 errors.
- `PW_PORT=4271 pnpm exec playwright test --project=chromium e2e/pinch/vanilla.spec.ts` → all PASS.

### Step 6: Changeset

Create `.changeset/motion-14-14-0.md` with frontmatter `'@humanspeak/svelte-motion': minor`. The body starts with "Update Motion and motion-dom to 14.14.0. What arrives with the update:" and then one line each:
- `mass: "auto"` is accepted on spring transitions. In a layout animation it sets the spring's mass from the element's size, so bigger elements move heavier.
- `pinch`: a drag that starts while the element is snapping back to its limits no longer stops scale and rotate.

Do not mention plans, and do not mention layout velocity here (plan 003 adds its own changeset).

### Step 7: Unit gate

Run `pnpm check`, `pnpm test:only`, `pnpm build`.

**Verify**: 0 errors; all unit tests pass; build exit 0. If a unit test outside this plan's files fails, STOP and report the file, the assertion and the upstream commit you suspect (`git -C ~/Github/motion log --oneline v14.12.0..v14.14.0 -- <path>`).

### Step 8: Full e2e triage

Run the full chromium e2e on port 4271 while no other lane is running Playwright. Then `trunk fmt` and `trunk check` on the changed files.

**Verify**:
- e2e → all pass except known skips. Re-run a failing spec alone once before reporting it, and say that it was re-run.
- A failure that the bump causes is a STOP, not something to fix here. The likely area is layout springs: every `layout`/`layoutId` element whose transition has `type: 'spring'` now runs through motion-dom's new `startAnimation` (`create-projection-node.ts:2042-2202` at v14.14.0). Report the spec, the assertion, and what the page shows. The maintainer reviews failed e2e pages one at a time.
- `e2e/animate-presence/pop-layout-container-move.spec.ts:282` is a known intermittent failure on `main` (7 of 60 runs at `d1719573`). A failure there alone is not a STOP; re-run it once and report the result.
- trunk → no new issues.

Revert any change `pnpm build` makes to `docs/static/r/animated-tabs.json`.

## Test plan

- **Red-first anchors**: `springAutoMass.spec.ts` test 1 (warns on 14.12.0, silent on 14.14.0) and the `#4076` e2e test (scale stuck past `max` on 14.12.0).
- **Guards** (green on both): invalid mass still warns; `"auto"` outside layout equals default mass; LazyMotion keeps its rendered element.
- `index.spec.ts`'s tripwire is the "bump breaks it" check: it fails after Step 3 and passes after Step 4.
- Not ported: upstream's `layout-velocity.test.ts` (`resolveAutoMass`, `pointToProgressVelocity`) tests functions motion-dom does not export; plan 003 covers their effect in a browser. Upstream's `LazyMotion/__tests__/hydration.test.tsx` tests React `Suspense` and has no Svelte equivalent.

## Done criteria

- [ ] `grep -c '"14.14.0"' package.json` → `2`, and `node -p "require('./package.json').version"` → `2.13.0`
- [ ] `pnpm check` → 0 errors
- [ ] `pnpm test:only` → all pass, including `springAutoMass.spec.ts` and the new `LazyMotion.spec.ts` test
- [ ] `grep -n "getSpringOptions" src/lib/__tests__/motionExportAllowlist.ts` → one line; `grep -n "getSpringOptions" src/lib/index.ts` → no output
- [ ] `e2e/pinch/vanilla.spec.ts` passes, including the `#4076` test
- [ ] Full chromium e2e → no new failures (or a STOP report)
- [ ] `git diff --name-only <wave-0 SHA>..HEAD` lists only in-scope files
- [ ] `.changeset/motion-14-14-0.md` exists

## STOP conditions

- After Step 0, `motion-dom` is not 14.12.0.
- `springAutoMass.spec.ts` test 1 passes on 14.12.0.
- After the bump, the tripwire reports any name other than `getSpringOptions`.
- After the bump, any existing unit or e2e test fails (other than the known intermittent one). Report it; do not edit it.
- `pnpm install` changes dependencies other than `motion`, `motion-dom`, `framer-motion` and `motion-utils`. (If the `reactive-tracking-leaks` batch's plan 001 landed first, `esm-env` is already in `dependencies`; that is expected and not a STOP.)
- `pnpm check` reports a type error in `src/lib`.

## Maintenance notes

- Every future bump trips `src/lib/index.spec.ts` when upstream adds runtime exports. Allowlist internals and re-export public API.
- The `"version"` edit is the maintainer's default for this batch: 2.13.0 plus a `minor` label publishes 2.14.0. It is flagged for confirmation in the batch README; if the maintainer chooses otherwise, only Step 3's version line changes.
- `package.json` and `pnpm-lock.yaml` are also edited by the `reactive-tracking-leaks` batch's plan 001 (`esm-env` moves to `dependencies`). Whichever lands second re-runs `pnpm install`.
- Reviewer: check that no existing spec was edited to make the bump pass.
