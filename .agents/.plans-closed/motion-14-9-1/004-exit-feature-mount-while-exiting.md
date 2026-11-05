# Plan 004: `ExitAnimationFeature` matches Motion 14.9.1 `exit.ts` (an element that mounts already exiting)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do not edit the batch `README.md`.
>
> **Revision 2026-11-04 (operator-approved):** After the Step 2 port, `src/lib/html/_MotionContainer.spec.ts:961` ("a motion descendant mounted during owned descendant exits joins the current barrier") fails with `expected null to be truthy` at `:985`. Its harness wraps `ExitAnimationFeature.prototype.mount`, calls `mount.call(this)` and only then installs its `setActive` spy, but under 14.9.1 `mount()` starts the exit itself. **In scope now:** in that one test, move the `setActive` spy so it is installed *before* `mount.call(this)`. Change nothing else in `_MotionContainer.spec.ts`. The `pop-layout-scroll-siblings` 9-vs-10 frame-count failures are being checked against the baseline by the guard; don't act on them.
>
> **Drift check (run first)**: `git diff --stat fb9ed218..HEAD -- src/lib/utils/visualElementCore.ts src/lib/utils/visualElementCore.spec.ts`. Expect no output. Otherwise compare the excerpts below with the live code and STOP on a mismatch.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (it touches the exit lifecycle that every `AnimatePresence` exit uses)
- **Depends on**: none
- **Wave**: 1
- **Category**: bug (upstream parity)
- **Planned at**: commit `fb9ed218`, 2026-11-04

## Why this matters

`ExitAnimationFeature` turns a presence flip (`isPresent: false`) into the element's `exit` animation, then tells `AnimatePresence` when it's done. Motion 14.9.1 (commit b8944fd6b, issue #4049) reworked upstream's version (`framer-motion/src/motion/features/animation/exit.ts`):
- It compares presence with **its own exit state** (`isPresent === !this.exit`) instead of the previous presence context. An element that mounts already exiting has `isPresent: false` in both contexts, so with the old comparison it never started its exit.
- `mount()` no longer reports `onExitComplete` straight away. It registers, then calls `this.update()` so that an element mounting already exiting starts its exit at once.
- The exit is always `setActive("exit", true)`, and completion is always attached.

Our port follows 14.7.1, plus a special-case guard for "a descendant mounted during an active exit". The maintainer's rule is to adopt upstream wherever we diverge. Upstream's version is simpler, and it makes our early `onExitComplete` in `mount()` (harmless today only because the registry ignores unknown ids) go away.

## Current state

- `src/lib/utils/visualElementCore.ts:179-269`, `class ExitAnimationFeature`. The key parts:
  ```ts
  private id: number = exitFeatureId++
  private isExitComplete = false
  private exitAnimation?: Promise<unknown>

  update(): void {
      const presenceContext = this.node.presenceContext
      if (!presenceContext) return
      const { isPresent, onExitComplete } = presenceContext
      const { isPresent: prevIsPresent } = this.node.prevPresenceContext ?? {}
      if (!this.node.animationState) return
      // A descendant mounted during an active exit starts absent. ...
      if (isPresent === prevIsPresent && (isPresent || this.exitAnimation)) return

      if (isPresent && prevIsPresent === false) {
          if (this.isExitComplete) { /* rewind to initial via jump(), blockInitialAnimation = false, reset(), animateChanges() */ }
          else { void this.node.animationState.setActive('exit', false) }
          this.isExitComplete = false
          this.exitAnimation = undefined
          return
      }

      const exitAnimation = (this.exitAnimation = this.node.animationState.setActive('exit', !isPresent))
      if (onExitComplete && !isPresent) {
          void exitAnimation.then(() => {
              if (this.exitAnimation !== exitAnimation) return
              this.isExitComplete = true
              onExitComplete(this.id)
          })
      }
  }

  mount(): void {
      const { register, onExitComplete } = this.node.presenceContext ?? {}
      if (onExitComplete) onExitComplete(this.id)
      if (register) this.unmount = register(this.id, this.node)
  }
  ```
  The JSDoc above the class (`:164-178`) says "`mount()` reports completion for the previous occupant of this id". Upstream dropped that.
- Upstream v14.9.1 `exit.ts` (read with `git -C ~/Github/motion show v14.9.1:packages/framer-motion/src/motion/features/animation/exit.ts`):
  - It holds `private exit?: Promise<unknown> | true` (the running exit, or `true` once complete).
  - `update()`:
    - `if (!presenceContext || !animationState) return`
    - `if (isPresent === !this.exit) return`
    - If `isPresent`, it re-enters: when `this.exit === true` it rewinds to `initial`, sets `blockInitialAnimation = false`, calls `reset()` and `animateChanges()`; otherwise it calls `setActive("exit", false)`. Then it sets `this.exit = undefined` and returns.
    - Otherwise: `const exit = (this.exit = animationState.setActive("exit", true))`, then `if (onExitComplete) exit.then(() => { if (this.exit !== exit) return; this.exit = true; onExitComplete(this.id) })`.
  - `mount()`:
    - `const { register } = this.node.presenceContext || {}`
    - `if (register) this.unmount = register(this.id, this.node)`
    - `this.update()`
  - The diff from 14.7.1: `git -C ~/Github/motion diff v14.7.1 v14.9.1 -- packages/framer-motion/src/motion/features/animation/exit.ts`.
- Upstream tests: `packages/framer-motion/src/components/AnimatePresence/__tests__/mount-while-exiting.test.tsx`:
  - "exits when removed without suspending"
  - "exits when removed by the render that reveals a Suspense boundary"
  - "exits from the values it showed before the boundary suspended"
  - "a motion component first rendered by an exiting child exits"

  Svelte has no Suspense. The last case maps to our existing coverage of a motion element that first renders inside an exiting `PresenceChild`, at `src/lib/html/_MotionContainer.spec.ts:961`.
- Our presence registry ignores completions from ids that never registered (`src/lib/utils/presenceExitRegistry.ts:84-88`: `const participant = participants.get(id); if (!participant) return`). That is why the early `onExitComplete` in `mount()` is harmless today.
- Exemplar tests: `src/lib/utils/visualElementCore.spec.ts:200-280`, `describe('ExitAnimationFeature')`, with the `mountWithExit(presence)` helper. It builds a VE with `createMotionVisualElement`, calls `ve.mount(element)` and `ve.updateFeatures()`, and spies `animationState.setActive` / `animateChanges`.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Exit unit | `pnpm test:only src/lib/utils/visualElementCore.spec.ts` | as per step |
| Container unit | `pnpm test:only src/lib/html/_MotionContainer.spec.ts` | all pass |
| Unit suite | `pnpm test:only` | all pass |
| Types | `pnpm check` | `0 ERRORS` |
| Presence e2e | `PW_PORT=4234 pnpm exec playwright test --project=chromium e2e/animate-presence e2e/utilities e2e/layout-id e2e/lazy-motion` | all pass (1 known skip) |
| Format / lint | `trunk fmt <files>`; `trunk check <files>` | no new issues |

Never use port 4198, never set `PW_REUSE_SERVER`, never `git stash`.

## Scope

**In scope:**
- `src/lib/utils/visualElementCore.ts`: `ExitAnimationFeature` and its JSDoc only
- `src/lib/utils/visualElementCore.spec.ts`
- `src/lib/html/_MotionContainer.spec.ts`: the `:961` harness spy order only (see the revision note)
- `.changeset/exit-feature-mount-while-exiting.md` (create)

**Out of scope:**
- `presence.ts`, `PresenceChild.svelte`, `presenceExitRegistry.ts`, `_MotionContainer.svelte` (the component; its spec's `:961` harness is the one exception). If a test only passes with a change there, STOP.
- Our extras beyond upstream: keep the `custom` argument to `resolveVariant` and the `null`/`undefined` skip when rewinding (upstream's typing allows them; they don't change behaviour for valid input).

## Git workflow

- Lane branch `lane/1491-exit`. Use conventional commits, e.g. `test(presence): pin 14.9.1 exit.ts mount-while-exiting (red)` and `fix(presence): align ExitAnimationFeature with Motion 14.9.1 exit.ts`.
- End each commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not push.

## Steps

### Step 1: Red unit tests

In `describe('ExitAnimationFeature')`, add the following. Build each with `createMotionVisualElement` the way `mountWithExit` does, but spy on `setActive` *before* `ve.mount(element)` where the case needs to observe mount. For example, mock `animationState` creation by spying on the prototype, or mount and then observe the first `updateFeatures`. Pick the approach that matches the file.

1. `it("doesn't report completion when it mounts", …)`: give it a presence context with `isPresent: true`, an `onExitComplete` spy and a `register` spy. After `ve.mount(element)` and `ve.updateFeatures()`, expect `onExitComplete` not to have been called and `register` to have been called once.
2. `it('starts the exit when it mounts already exiting, without a further update', …)`:
   - Give it a presence context with `isPresent: false`, an `onExitComplete` spy and a `register` returning a no-op.
   - Mount the VE, then call `updateFeatures()` exactly once (the feature's mount runs inside it).
   - Expect `setActive` to have been called with `('exit', true)` exactly once.
   - After the promise settles, expect `onExitComplete` to have been called once with the feature's id.
3. `it('starts the exit once when presence stays false across updates', …)`: same setup, then call `ve.update(props, sameContext)` and `ve.updateFeatures()` again. Expect `setActive('exit', true)` to still have been called once.

**Verify**: `pnpm test:only src/lib/utils/visualElementCore.spec.ts` → case 1 FAILS (`onExitComplete` called once on mount). Case 2 FAILS or passes depending on mount timing. Record which. At least case 1 must be red.

### Step 2: Port `exit.ts` v14.9.1

Rewrite the class body to upstream's shape:
- Replace `isExitComplete` and `exitAnimation` with one `private exit?: Promise<unknown> | true`.
- `update()`:
  - `if (!presenceContext || !animationState) return`
  - `if (isPresent === !this.exit) return`
  - The re-enter branch keys on `this.exit === true` and keeps our existing rewind body.
  - Otherwise `const exit = (this.exit = animationState.setActive('exit', true))`.
  - Then `if (onExitComplete) void exit.then(() => { if (this.exit !== exit) return; this.exit = true; onExitComplete(this.id) })`.
- `mount()`:
  - `const { register } = this.node.presenceContext ?? {}`
  - `if (register) this.unmount = register(this.id, this.node)`
  - `this.update()`
- Update the class JSDoc and the inline comments to cite `exit.ts` at v14.9.1 (#4049). Remove the "reports completion for the previous occupant" bullet.

**Verify**: `pnpm test:only src/lib/utils/visualElementCore.spec.ts` → all pass, both old and new cases. If an old case asserted the early `onExitComplete` from `mount()`, update it to the upstream contract and say so in the commit message.

### Step 3: Gate

**Verify**:
- `pnpm test:only src/lib/html/_MotionContainer.spec.ts` → all pass. The `:961` "motion component first rendered by an exiting child" case is the Svelte twin of upstream's fourth test.
- `pnpm check`, then `pnpm test:only`, then the presence e2e command in the table → all pass.
- trunk on the changed files.

### Step 4: Changeset

Create `.changeset/exit-feature-mount-while-exiting.md` with frontmatter `'@humanspeak/svelte-motion': patch`. Body: "An element that mounts while its `AnimatePresence` child is already exiting now starts its exit animation straight away, as in Motion 14.9.1 (#4049)."

## Test plan

- Red-first: case 1 fails on current code (`mount()` calls `onExitComplete`). Cases 2 and 3 pin the 14.9.1 contract (exit starts once on mount while absent, and never restarts).
- Regression: the existing re-enter cases (rewind to `initial`, stale promise after re-entry) must pass unchanged. They cover the `this.exit === true` and `this.exit !== exit` branches.
- e2e: `animate-presence`, `utilities` (use-presence) and `layout-id` cover the real exit paths.

## Maintenance note

`mount()` now calls `update()`. Our `_MotionContainer` also calls `updateFeatures()` after mount. The `isPresent === !this.exit` check makes the second call a no-op, so the order doesn't matter. Keep that check if `_MotionContainer`'s mount order changes.

## STOP conditions

- Case 1 passes before Step 2.
- After Step 2, any `animate-presence` / `utilities` / `layout-id` / `lazy-motion` e2e fails, or a `presence.ts` clone exit never completes. Report the spec and the assertion. Don't patch `presence.ts`.
