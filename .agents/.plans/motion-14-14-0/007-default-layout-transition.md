# Plan 007: A layout animation with no transition uses upstream's default (0.45 s, `[0.4, 0, 0.1, 1]`)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Never use `git stash`** (one stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4276**. Prefix every Playwright command with `PW_PORT=4276`. Port 4198 belongs to the maintainer; never use or kill it. Never set `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat 6c34537b..HEAD -- src/lib/html/_MotionContainer.svelte src/routes/+page.svelte e2e/layout src/routes/tests/layout`
> Expected: no output, or only changes from plans 001, 002 and 003 of this batch (002 edits `derivedAttrs`, 003 adds `tests/layout/velocity` and `e2e/layout/velocity.spec.ts` and a link after `overdamped-spring`). If the "Current state" excerpts below no longer match the live code, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED. The default duration of every un-configured `layout` / `layoutId` animation grows from about 0.3 s to 0.45 s, and its easing changes. Existing e2e specs with fixed waits tuned to the old default may fail (see Step 5).
- **Depends on**: 001 (the lane starts from a branch with the 14.14.0 bump)
- **Wave**: 2 (parallel with 002 and 003)
- **Category**: bug (upstream divergence)
- **Planned at**: commit `6c34537b` on `feat/motion-14.14.0`, 2026-11-14. Added by the dispatcher after the maintainer asked for open question 5 (the unexplained 352 ms layout tween) to be checked.

## Why this matters

`@humanspeak/svelte-motion` is a Svelte 5 port of Motion. Upstream gives a layout animation with no configured transition a 0.45 s tween eased with `[0.4, 0, 0.1, 1]`. Ours runs about 0.3 s with a different curve, because we always hand motion-dom a transition object, even an empty one, and an empty object is truthy. So the layout fallback never fires, and motion-dom falls through to its generic per-value default (a 0.3 s `ease` tween). The batch survey measured 352 ms between `onLayoutAnimationStart` and `onLayoutAnimationComplete` on both 14.12.0 and 14.14.0. The house rule is to adopt upstream wherever we diverge.

## Current state

**Upstream (`~/Github/motion`, tag `v14.14.0`; read with `git -C ~/Github/motion show v14.14.0:<path>`):**

- `packages/motion-dom/src/projection/node/create-projection-node.ts:670-673` picks the layout transition:
  ```ts
  const layoutTransition =
      this.options.transition ||
      visualElement.getDefaultTransition() ||
      defaultLayoutTransition
  ```
- Same file `:2926-2929`:
  ```ts
  const defaultLayoutTransition = {
      duration: 0.45,
      ease: [0.4, 0, 0.1, 1],
  }
  ```
- `packages/motion-dom/src/render/VisualElement.ts:807-809`: `getDefaultTransition() { return this.props.transition }`.
- `packages/motion-dom/src/animation/utils/default-transitions.ts:29-33`: the generic per-value fallback our empty object lands on, `{ type: "keyframes", ease: [0.25, 0.1, 0.35, 1], duration: 0.3 }`.
- `packages/framer-motion/src/motion/index.tsx:124-128`: React folds `MotionConfig` into the props, so `props.transition` is the component's own `transition`, or else `MotionConfig`'s, or else `undefined`:
  ```ts
  const configAndProps = {
      ...useContext(MotionConfigContext),
      ...props,
      layoutId,
  }
  ```

**Ours (this branch):**

- `src/lib/html/_MotionContainer.svelte:846-849` always produces an object:
  ```ts
  // Compute merged transition without mutating props to avoid effect write loops
  const mergedTransition = $derived<AnimationOptions>(
      mergeTransitions(motionConfig?.transition ?? {}, transitionProp ?? {})
  )
  ```
  With neither a `transition` prop nor a `MotionConfig` transition, `mergedTransition` is `{}` (`mergeTransitions` is `src/lib/utils/animation.ts:21`).
- The same file passes it to the projection adapter in two `adapter.updateOptions({...})` calls: `transition: mergedTransition as never,` at about `:2261` (the update effect that starts at about `:2246`) and about `:2299` (the mount path). Find both with `grep -n "transition: mergedTransition as never" src/lib/html/_MotionContainer.svelte`.
- `src/lib/utils/motionDomProjection.ts:603-636` (`updateOptions`) forwards `options.transition` to BOTH `this.visualElement.update({ ..., transition: options.transition, ... })` and `this.projection.setOptions({ ..., transition: options.transition, ... })`. So with `{}`, both `this.options.transition` and `getDefaultTransition()` are truthy in upstream's chain, and `defaultLayoutTransition` is never reached.
- `mergedTransition` has other consumers (`:979`, `:1077`, `:1644`) for non-layout animations. They must keep receiving `mergedTransition` unchanged. Only the two layout `updateOptions` calls change.

**Conventions:**

- The page under test follows `src/routes/tests/layout/overdamped-spring/+page.svelte` (177 lines), and its spec follows `e2e/layout/overdamped-spring.spec.ts`.
- Visually reviewed pages have a guided tester panel (steps, expected result, live verdict) hidden when the URL has `@isPlaywright=true`. See `src/routes/tests/pinch/vanilla/+page.svelte:48` (`isTester = !window.location.search.includes('@isPlaywright=true')`).
- Home-page links live in `src/routes/+page.svelte`, in `<li><a class="text-blue-300 hover:underline" href={resolve('/tests/...') + searchParams}>` blocks.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Types | `pnpm check` | `0 ERRORS` |
| Unit tests | `pnpm test:only` | all pass |
| Build | `pnpm build` | exit 0 |
| One e2e file | `PW_PORT=4276 pnpm exec playwright test --project=chromium <path>` | as stated per step |
| Full e2e | `PW_PORT=4276 pnpm exec playwright test --project=chromium` | see Step 5 |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

If the global `pnpm` cannot switch to 12.6.0, use `npx -y pnpm@12.6.0`. Trunk is the lint/format authority; do not run `prettier`, `eslint` or `pnpm lint` directly.

## Scope

**In scope:**
- `src/lib/html/_MotionContainer.svelte`: one new `$derived` next to `mergedTransition`, and the two layout `updateOptions` `transition:` lines
- `src/routes/tests/layout/default-transition/+page.svelte` (create)
- `e2e/layout/default-transition.spec.ts` (create)
- `src/routes/+page.svelte`: one link
- `.changeset/default-layout-transition.md` (create)

**Out of scope:**
- `src/lib/utils/motionDomProjection.ts`. Plans 003, 004 and 005 own it; the fix belongs at the call site.
- `mergeTransitions` and `mergedTransition`'s other consumers.
- How a `transition` prop combines with a `MotionConfig` transition (we merge; upstream's spread replaces). That is a separate divergence; mention it in your report, do not change it.
- Editing existing e2e specs (see Step 5).

## Git workflow

- Lane branch `lane/14140-default-layout-transition`, cut from `feat/motion-14.14.0` after plan 001 is merged.
- Conventional commits: `test: …` for the red step, then `fix: …`.
- End each commit with the co-author line the dispatcher gives you. Do not push.

## Steps

### Step 1: Red test page and spec

1. Create `src/routes/tests/layout/default-transition/+page.svelte`. Model it on `overdamped-spring`. It shows three boxes, each `layout`, each moving between `justify-content: flex-start` and `flex-end` in a 600 px wide row when one **Toggle** button is pressed:
   - `#default`: no `transition` prop, no `MotionConfig`.
   - `#configured`: wrapped in `<MotionConfig transition={{ duration: 0.2, ease: 'linear' }}>`.
   - `#explicit`: `transition={{ duration: 0.3, ease: 'linear' }}`.
   Each box records `performance.now()` in `onLayoutAnimationStart` and `onLayoutAnimationComplete`, and writes the rounded difference in ms to a `data-duration` attribute on itself, plus a visible readout.
   Add a tester panel, hidden under `@isPlaywright=true`:
   - Steps: press Toggle, then press it again.
   - Expected: default ≈ 450 ms, configured ≈ 200 ms, explicit ≈ 300 ms.
   - A live verdict per box: PASS when within ±60 ms of expected.
2. Create `e2e/layout/default-transition.spec.ts` (open the page with `?@isPlaywright=true`, as the exemplar spec does). One test per box: press Toggle, wait until that box's `data-duration` is set (`expect.poll` or `toHaveAttribute` with a timeout of about 2 s), then assert:
   - `#default`: duration ≥ 420 and ≤ 530 (upstream's own layout tests assert < 530 ms).
   - `#configured`: duration ≥ 170 and ≤ 280.
   - `#explicit`: duration ≥ 270 and ≤ 380.
3. Add a link to the page in `src/routes/+page.svelte`, directly **before** the `layoutScroll — single container` entry (`resolve('/tests/layout/scroll')`, about `:1360`). Label: `Default layout transition (0.45 s, upstream parity)`. Do not place it at the end of the Layout section; plan 003 adds links there.

**Verify** (unfixed code): `pnpm build` then `PW_PORT=4276 pnpm exec playwright test --project=chromium e2e/layout/default-transition.spec.ts`. `#default` FAILS with a duration of about 300–370 ms, below 420. `#configured` and `#explicit` PASS.

If `#default` already passes, the diagnosis is wrong: STOP. If `#configured` or `#explicit` fail before any fix, re-run once alone. If they still fail, STOP and report the numbers (the ±60 ms window may not fit this machine).

Commit: `test: pin upstream's 0.45 s default layout transition (red)`.

### Step 2: The fix

In `_MotionContainer.svelte`, directly after the `mergedTransition` `$derived`, add:

```ts
// Layout animations fall back to upstream's 0.45 s `defaultLayoutTransition`
// only when no transition is configured (create-projection-node.ts:670-673,
// :2926-2929 @ v14.14.0). `mergedTransition` is `{}` in that case, and `{}`
// is truthy, so hand the projection `undefined` instead.
const layoutTransition = $derived<AnimationOptions | undefined>(
    motionConfig?.transition === undefined && transitionProp === undefined
        ? undefined
        : mergedTransition
)
```

Change only the two `transition: mergedTransition as never,` lines inside the layout `adapter.updateOptions({...})` calls to `transition: layoutTransition as never,`. Leave every other use of `mergedTransition` alone.

**Verify**:
- `grep -c "transition: layoutTransition as never" src/lib/html/_MotionContainer.svelte` → `2`
- `pnpm check` → 0 errors
- `pnpm build` then the spec from Step 1 → all three PASS

### Step 3: Unit gate

`pnpm test:only` → all pass. A unit failure outside this plan's files is a STOP: report the file and assertion.

### Step 4: Changeset

Create `.changeset/default-layout-transition.md` with frontmatter `'@humanspeak/svelte-motion': patch`. Body: "Layout animations with no `transition` now use Motion's default layout transition (0.45 s, ease `[0.4, 0, 0.1, 1]`) instead of a 0.3 s tween, matching Motion."

### Step 5: Full e2e triage

Run the full chromium e2e on port 4276 while no other lane is running Playwright. Re-run each failing spec alone once, and say that you did.

- Failures that persist are NOT yours to fix. For each one, report:
  - the spec and the assertion;
  - whether its page has a `layout` / `layoutId` element without a `transition`, which would mean it was tuned to the old ~0.3 s default;
  - what timing it waits for.
  The maintainer reviews failed e2e pages one at a time. Do not edit any existing spec.
- `e2e/animate-presence/pop-layout-container-move.spec.ts:282` is a known intermittent failure; re-run it once and report the result.

Then `trunk fmt` and `trunk check` on the changed files → no new issues. Revert any change `pnpm build` makes to `docs/static/r/animated-tabs.json`.

## Test plan

- **Red-first anchor**: `#default` in `e2e/layout/default-transition.spec.ts` (about 352 ms before the fix, 420–530 ms after).
- **Guards**: `#configured` (`MotionConfig` still reaches layout) and `#explicit` (the prop still wins).
- No unit test: the behaviour lives in the projection node's transition choice, which only a running layout animation shows.

## Done criteria

- [ ] `PW_PORT=4276 pnpm exec playwright test --project=chromium e2e/layout/default-transition.spec.ts` → 3 passed
- [ ] `grep -c "transition: layoutTransition as never" src/lib/html/_MotionContainer.svelte` → `2`
- [ ] `pnpm check` → 0 errors; `pnpm test:only` → all pass
- [ ] Full chromium e2e run, with persistent failures listed as in Step 5 (or none)
- [ ] `git diff --name-only <lane base>..HEAD` lists only in-scope files
- [ ] `.changeset/default-layout-transition.md` exists

## STOP conditions

- `#default` passes before the fix.
- The fix needs a change in `motionDomProjection.ts` or to `mergedTransition` itself.
- `pnpm check` reports a type error in `src/lib`.
- A unit test outside this plan's files fails.

## Maintenance notes

- Sign-off needs an upstream twin: a React page on `motion` 14.14.0 with the same three boxes, the same **Toggle** button and the same readouts. The dispatcher builds it.
- Any future change that makes `mergedTransition` non-empty by default (for example a library-wide default transition) re-breaks this fallback. Keep `layoutTransition` keyed on whether a transition was configured, not on `mergedTransition`'s contents.
- Prop-versus-`MotionConfig` merging is a known separate divergence (we merge; upstream's spread replaces). If it is ever aligned, `layoutTransition` becomes simply "the prop, else the config, else undefined".
