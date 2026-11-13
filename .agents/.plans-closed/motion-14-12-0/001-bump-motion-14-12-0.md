# Plan 001: Pin Motion 14.12.0, set the version to 2.11.0, re-export `pinch()`, and pin the spring-velocity change with tests

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Never use `git stash`** (one stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4261**. Prefix every Playwright command with `PW_PORT=4261`. Port 4198 belongs to the maintainer; never use or kill it. Never set `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat 82bf6e74..HEAD -- package.json pnpm-lock.yaml src/lib/index.ts src/lib/index.spec.ts src/lib/__tests__/motionExportAllowlist.ts src/lib/utils/spring.svelte.spec.ts .changeset`
> Expected: no output (the batch's own `.agents/.plans/motion-14-12-0/` commit is not in that path list). If any listed path changed, compare the "Current state" excerpts against the live code. On a mismatch, STOP.

## Status

- **Priority**: P1 (plans 002, 003, 004 and 005 depend on it)
- **Effort**: M
- **Risk**: MED. The bump changes how every `visualDuration`/`bounce` spring behaves when it interrupts another animation, so the full e2e triage in Step 8 is the real gate.
- **Depends on**: none
- **Wave**: 1
- **Category**: migration
- **Planned at**: commit `82bf6e74` (`feat/motion-14.12.0`, one commit ahead of `origin/main` `d1719573`, v2.10.1, Motion 14.10.1), 2026-11-12

## Why this matters

`@humanspeak/svelte-motion` is a Svelte 5 port of Motion. It depends on the `motion` and `motion-dom` npm packages, both pinned to one exact version (currently 14.10.1). Upstream has released 14.11.0, 14.11.1 and 14.12.0. Two things arrive:

1. **A vanilla `pinch()` gesture** (14.11): a new public runtime export of `motion`. Our export tripwire test fails on any new `motion` runtime export we neither re-export nor allowlist, so the bump and the re-export have to land together.
2. **`visualDuration`/`bounce` springs inherit velocity** (14.12): reversing such a spring mid-flight used to stop dead before moving back. It now carries its momentum, like a `stiffness`/`damping` spring. We call motion-dom's spring unchanged, so it arrives with the pin. This plan adds tests that are red on 14.10.1 and green on 14.12.0, so a later bump cannot silently lose it.

The maintainer will release this batch as **svelte-motion 2.12.0** using a `minor` label from 2.11.x. So this plan sets `"version": "2.11.0"`. It is the only plan in the batch that touches `"version"`. **Never add PR labels**: the maintainer does that.

## Current state

- `package.json:3`: `"version": "2.10.1",`
- `package.json:152-153` holds the runtime pins. They are exact, with no caret, and `src/lib/__tests__/motionDependencies.spec.ts` enforces that they are equal:
  ```json
  "motion": "14.10.1",
  "motion-dom": "14.10.1"
  ```
- `pnpm-workspace.yaml` has a 48-hour `minimumReleaseAge` but excludes `motion`, `motion-dom`, `motion-utils` and `framer-motion`, so 14.12.0 (published 2026-11-10) installs. `npm view motion@14.12.0 version` and `npm view motion-dom@14.12.0 version` both answered `14.12.0` at planning time.
- **Upstream source** is a local clone at `~/Github/motion`, with tags `v14.10.1` and `v14.12.0`. Read files with `git -C ~/Github/motion show v14.12.0:<path>`.
- `src/lib/index.ts:22-44` re-exports the vanilla layer from `motion`:
  ```ts
  export {
      MotionGlobalConfig,
      cancelFrame,
      delay,
      frame,
      frameData,
      hover,
      inView,
      isMotionValue,
      press,
      processFrame,
      resize,
      scroll,
      scrollInfo,
      spring,
      stagger,
      transform
  } from 'motion'
  ```
- `src/lib/index.ts:53-59` is the press types block. The new pinch types block goes directly after it:
  ```ts
  // Motion 14.10: press() count/hold/repeat options and handlers.
  export type {
      OnPressStartEvent,
      PointerEventOptions,
      PressHandlers,
      PressOptions
  } from 'motion-dom'
  ```
- **Export tripwire.** `src/lib/index.spec.ts:96-112` ("re-exports or deliberately skips every runtime export of motion") fails when `motion` gains a runtime export that is neither re-exported from `src/lib/index.ts` nor listed in `src/lib/__tests__/motionExportAllowlist.ts`. Between `v14.10.1` and `v14.12.0` the only change to `packages/motion-dom/src/index.ts` is one added line, `export * from "./gestures/pinch"`. That module's runtime exports are exactly two functions: `pinch` and `addPinchListeners`. `motion` re-exports all of `motion-dom` (`packages/framer-motion/src/dom.ts:1`). So after the bump, expect the tripwire to report exactly `['addPinchListeners', 'pinch']`.
  - `pinch` is public (`@public` in its JSDoc, `pinch("img", { scale: { min: 1, max: 4 } })`): re-export it.
  - `addPinchListeners` is the lower-level building block the React `pinch` prop is built on (like `PanSession`): allowlist it. Plan 004 imports it straight from `motion-dom`.
- `src/lib/__tests__/motionExportAllowlist.ts:134-149` is the group it belongs in:
  ```ts
      // [b] Gesture, pointer and drag internals
      'addDomEvent',
      'addPointerEvent',
      'addPointerInfo',
      'elementDragControls',
  ```
  and `:354-360` lists public names re-exported as motion's own binding:
  ```ts
  export const MOTION_PUBLIC_REEXPORTS: readonly string[] = [
      'animateMini',
      'createScopedAnimate',
      'inertia',
      'keyframes',
      'resolveElements'
  ]
  ```
- **The spring change** (upstream commits `1287885cd`, `6dbbe7c1e`, `3459c563e`). In `packages/motion-dom/src/animation/generators/spring.ts`:
  - v14.10.1 `:310-311`: `const inheritVelocity = (velocity: number) => isTimeDefined ? 0 : -millisecondsToSeconds(velocity)`. Any spring with `duration`, `visualDuration` or `bounce` ignored inherited velocity.
  - v14.12.0 `:311-312`: `isResolvedFromDuration ? 0 : -millisecondsToSeconds(velocity)`. Only a spring resolved from `duration` starts from rest (so it still ends exactly at its duration). A `visualDuration` spring inherits velocity.
  - `JSAnimation.stop()` (`packages/motion-dom/src/animation/JSAnimation.ts:541-555` at v14.12.0) now marks the motion value as updated "now" before its catch-up tick, so the velocity an interrupting animation inherits is measured from the previous frame, not from a sub-millisecond gap.
  - The generator's `toTransition` member was removed. Nothing in this repo uses it (`grep -rn toTransition src docs/src` is empty).
- Upstream tests to port (read them with `git -C ~/Github/motion show v14.12.0:<path>`):
  - `packages/motion-dom/src/animation/generators/__tests__/spring.test.ts`: the `describe.each` block "visualDuration spring %o" (three tests) and "Duration spring keeps its exact duration with velocity".
  - `packages/framer-motion/src/animation/animate/__tests__/spring-velocity.test.ts`: "Interrupted springs inherit velocity" (four option sets) and "duration springs start from rest to keep their duration".
- Our code that passes spring options through untouched: `src/lib/utils/spring.svelte.ts` (`useSpring`), `src/lib/utils/vanillaValues.svelte.ts` (`springValue`), and every `transition={{ type: 'spring', visualDuration, bounce }}` on a motion component. None of them needs an edit.
- Conventions:
  - Unit tests use Vitest (`describe`/`it`/`expect`/`vi`). For tests that run real animations in jsdom, copy the `beforeEach` in `src/lib/utils/animate.spec.ts:12-20`, which replaces `requestAnimationFrame` with a 16 ms `setTimeout`.
  - Import the library through `'../index.js'` in specs under `src/lib/utils/`, as `src/lib/utils/animate.spec.ts:7` does.
  - Changesets: `.changeset/motion-14-10-1.md` is the model (frontmatter `'@humanspeak/svelte-motion': minor`, a lead sentence, then one bullet per arriving change).
  - Commits are conventional (`chore(deps): …`, `test: …`, `feat: …`), as in `git log`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install` | exit 0 |
| Types | `pnpm check` | `0 ERRORS` |
| All unit tests | `pnpm test:only` | all pass |
| One unit file | `pnpm exec vitest run <path>` | as stated per step |
| Build | `pnpm build` | exit 0, publint "All good!" |
| Full e2e | `PW_PORT=4261 pnpm exec playwright test --project=chromium` | all pass (known skips only) |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Trunk is this repo's lint and format authority. Do not run `prettier`, `eslint` or `pnpm lint` directly. In zsh, pass file lists through `xargs`, not a `$files` variable.

## Scope

**In scope:**
- `package.json`: the `"version"` field and the two pins only
- `pnpm-lock.yaml`: regenerated by `pnpm install`
- `src/lib/utils/springVelocity.spec.ts` (create)
- `src/lib/index.ts`: add `pinch` to the `from 'motion'` block, and one new `export type { … } from 'motion-dom'` block
- `src/lib/index.spec.ts`: one new test
- `src/lib/__tests__/motionExportAllowlist.ts`: one allowlist entry, one `MOTION_PUBLIC_REEXPORTS` entry
- `.changeset/motion-14-12-0.md` (create)

**Out of scope:**
- Any other `src/lib` runtime code. If a test only passes with a runtime change, that is a STOP.
- The `pinch` prop, `whilePinch` and `pinchFeatures` (plan 004); test pages (plans 002, 003); docs (plans 002, 005).
- Editing an existing e2e spec or unit spec to make it pass after the bump. Report it instead (see STOP conditions).
- PR labels.

## Git workflow

- Lane branch `lane/14120-bump`, cut from the wave-0 SHA (the commit that adds this batch folder on `feat/motion-14.12.0`).
- Conventional commits, for example `test: pin the 14.12.0 spring velocity change (red on 14.10.1)` and `chore(deps): pin motion and motion-dom to 14.12.0`.
- End each commit message with the co-author line the dispatcher gives you.
- Do not push.

## Steps

### Step 0: Install the current lockfile

Run `pnpm install --frozen-lockfile`, then `pnpm exec svelte-kit sync`.

**Verify**: `node -p "require('./node_modules/motion/package.json').version + ' ' + require('./node_modules/motion-dom/package.json').version"` → `14.10.1 14.10.1`. If it prints anything else, STOP.

### Step 1: Write the spring-velocity tests (red on 14.10.1)

Create `src/lib/utils/springVelocity.spec.ts`. Its header comment cites the three upstream commits and the two upstream test files from "Current state". Import `spring`, `animate` and `frame` from `'../index.js'` and `motionValue` from `'motion'`. Use the fake-rAF `beforeEach` from `src/lib/utils/animate.spec.ts:12-20`.

Tests:

1. **Generator, red anchor.** "a visualDuration spring moves ahead of the same spring without velocity":
   ```ts
   const options = { visualDuration: 0.5, bounce: 0.2, keyframes: [0, 100] }
   const withVelocity = spring({ ...options, velocity: 1000 })
   const withoutVelocity = spring(options)
   expect(withVelocity.next(50).value).toBeGreaterThan(withoutVelocity.next(50).value)
   ```
   Run it for the three upstream option sets: `{ visualDuration: 0.5, bounce: 0.2 }`, `{ visualDuration: 0.5, bounce: 0 }`, `{ visualDuration: 0.5, bounce: -0.5 }` (use `it.each`).
2. **Generator, ported.** The three tests of upstream's `describe.each` "visualDuration spring %o": "starts with the inherited velocity", "resolves the same physics with or without velocity", "settles at its target with inherited velocity". Upstream uses `calcGeneratorDuration` and `maxGeneratorDuration`; import both from `'motion-dom'`. If either is not exported there, replace the settle test's duration lookup with a loop that calls `generator.next(t)` in 10 ms steps until `done`, capped at 20 000 ms.
3. **Generator, guards (green on both versions).** "a duration spring ignores velocity" (`{ keyframes: [500, 10], bounce: 0.2, duration: 800 }` with and without `velocity: 1000` give equal values at 0 and 100 ms) and upstream's "Duration spring keeps its exact duration with velocity".
4. **`animate()`, red anchor.** Port "Interrupted springs inherit velocity" from upstream's `spring-velocity.test.ts` for the four option sets. Define `nextFrame` as `new Promise<void>((resolve) => frame.postRender(() => resolve()))`. The key assertions after reversing mid-flight and waiting one frame: `x.get()` is greater than `before`, and `x.getVelocity()` is greater than 0. Then `await animation` and expect `x.get()` to be `0`.
5. **`animate()`, guard.** Port "duration springs start from rest to keep their duration".

**Verify**: `pnpm exec vitest run src/lib/utils/springVelocity.spec.ts` on 14.10.1:
- test 1 FAILS for all three option sets (the two values are equal);
- test 4 FAILS for the three `visualDuration` sets and PASSES for `{ stiffness: 200, damping: 20 }`;
- tests 3 and 5 PASS.

Record which of test 2's cases fail. If test 1 or the `visualDuration` cases of test 4 pass on 14.10.1, the reproduction is wrong: STOP.

Commit: `test: pin the 14.12.0 spring velocity change (red on 14.10.1)`.

### Step 2: Set the version

In `package.json`, change `"version": "2.10.1"` to `"version": "2.11.0"`. Change nothing else in this step.

**Verify**: `node -p "require('./package.json').version"` → `2.11.0`

### Step 3: Move the pins

In `package.json`, set `"motion": "14.12.0"` and `"motion-dom": "14.12.0"`, then run `pnpm install`. pnpm 12 ignores `--save-exact`, so edit the file by hand and keep the versions without a caret.

**Verify**:
- `grep -n '"motion\(-dom\)\?": ' package.json` → both show `14.12.0`, no caret.
- `node -p "require('./node_modules/motion/package.json').version + ' ' + require('./node_modules/motion-dom/package.json').version"` → `14.12.0 14.12.0`
- `pnpm exec vitest run src/lib/__tests__/motionDependencies.spec.ts` → PASS
- `git diff --stat pnpm-lock.yaml` touches only `motion`, `motion-dom`, `framer-motion` and `motion-utils` entries.

### Step 4: Satisfy the export tripwire by re-exporting `pinch`

1. Run `pnpm exec vitest run src/lib/index.spec.ts`. Expect the tripwire to FAIL listing exactly `addPinchListeners` and `pinch`. Any other name is a STOP.
2. In `src/lib/index.ts`, add `pinch` to the `from 'motion'` block between `isMotionValue` and `press`. Extend the comment above the block to mention it (`pinch()` is Motion 14.11's multitouch pinch and rotate gesture).
3. Directly after the press types block, add:
   ```ts
   // Motion 14.11: pinch() options, handlers and gesture info.
   export type {
       OnPinchEvent,
       OnPinchStartEvent,
       PinchHandlers,
       PinchInfo,
       PinchLimits,
       PinchOptions,
       PinchProps,
       PinchRotateOptions
   } from 'motion-dom'
   ```
4. In `src/lib/__tests__/motionExportAllowlist.ts`, add `'addPinchListeners',` to the "[b] Gesture, pointer and drag internals" group, in alphabetical position (after `'addDomEvent'`). Add `'pinch'` to `MOTION_PUBLIC_REEXPORTS`, in alphabetical position.
5. In `src/lib/index.spec.ts`, add a test next to the other "re-exports Motion …" tests: `it('re-exports Motion 14.11 pinch', …)` asserting `typeof pinch === 'function'` (import `pinch` from `'./index.js'` in the existing import list).

**Verify**: `pnpm exec vitest run src/lib/index.spec.ts` → all PASS. `pnpm check` → 0 errors.

### Step 5: Flip the red tests green

**Verify**: `pnpm exec vitest run src/lib/utils/springVelocity.spec.ts` → all PASS.

### Step 6: Changeset

Create `.changeset/motion-14-12-0.md` with frontmatter `'@humanspeak/svelte-motion': minor`. The body starts with "Update Motion and motion-dom to 14.12.0. What arrives with the update:" and then one line each:
- `pinch()`: a vanilla multitouch gesture that scales, rotates and moves an element with two touches, a trackpad pinch or Safari's gesture events. Its option and handler types are exported.
- Springs set with `visualDuration` (and `bounce`) now carry the velocity of the animation they interrupt, so reversing one mid-flight no longer stops dead. Springs set with `duration` still start from rest and end exactly on time.
- A press no longer ends when a second, non-primary touch lifts.

Do not mention plans.

### Step 7: Unit gate

Run `pnpm check`, `pnpm test:only`, `pnpm build`.

**Verify**: 0 errors; all unit tests pass; build exit 0. If a unit test outside this plan's files fails, STOP and report the file, the assertion and the upstream commit you suspect (`git -C ~/Github/motion log --oneline v14.10.1..v14.12.0 -- <path>`).

### Step 8: Full e2e triage

Run the full chromium e2e on port 4261. Then `trunk fmt` and `trunk check` on the changed files.

**Verify**:
- e2e → all pass except known skips. Re-run a failing spec alone once before reporting it, and say that it was re-run.
- A failure that the bump causes is a STOP, not something to fix here. The most likely area is specs that reverse or interrupt a `visualDuration`/`bounce` spring (hover/tap interrupts under `e2e/motion/`, layout springs under `e2e/layout*/`). Report the spec, the assertion, and what the page shows. The maintainer reviews failed e2e pages one at a time.
- trunk → no new issues.

Revert any change `pnpm build` makes to `docs/static/r/animated-tabs.json`.

## Test plan

- **Red-first anchors**: in `springVelocity.spec.ts`, test 1 (three option sets) and the `visualDuration` cases of test 4 fail on 14.10.1 and pass on 14.12.0.
- **Guards** (green on both): duration springs ignore velocity and keep their exact duration.
- `index.spec.ts`'s tripwire is the "bump breaks it" check: it fails after Step 3 and passes after Step 4.
- `stop-velocity.test.ts` (the `JSAnimation.stop()` change) is not ported: it needs motion-dom's internal `Driver` type and hand-set `frameData.isProcessing`. Test 4 covers its user-visible effect.

## Done criteria

- [ ] `grep -c '"14.12.0"' package.json` → `2`, and `node -p "require('./package.json').version"` → `2.11.0`
- [ ] `pnpm check` → 0 errors
- [ ] `pnpm test:only` → all pass, including `src/lib/utils/springVelocity.spec.ts` and the new `index.spec.ts` test
- [ ] `grep -n "pinch" src/lib/index.ts` shows the runtime export and the types block
- [ ] Full chromium e2e → no new failures (or a STOP report)
- [ ] `git diff --name-only <wave-0 SHA>..HEAD` lists only in-scope files
- [ ] `.changeset/motion-14-12-0.md` exists

## STOP conditions

- After Step 0, `motion-dom` is not 14.10.1.
- Test 1, or a `visualDuration` case of test 4, passes on 14.10.1.
- After the bump, the tripwire reports any name other than `addPinchListeners` and `pinch`.
- After the bump, any existing unit or e2e test fails. Report it; do not edit it.
- `pnpm install` changes dependencies other than `motion`, `motion-dom`, `framer-motion` and `motion-utils`.
- `pnpm check` reports a type error in `src/lib` that this plan's edits did not introduce.

## Maintenance notes

- Every future bump trips `src/lib/index.spec.ts` when upstream adds runtime exports. Allowlist internals and re-export public API.
- The `"version"` edit is a one-off the maintainer asked for: 2.11.0 plus a `minor` label publishes 2.12.0.
- `pinch` is re-exported as motion's own binding (no wrapper). Unlike `drag()`, its options take no motion values, so there is nothing to re-type.
- Reviewer: check that no existing spec was edited to make the bump pass.
