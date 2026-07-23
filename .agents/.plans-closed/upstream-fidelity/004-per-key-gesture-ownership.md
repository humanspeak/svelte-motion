# Plan 004: Gesture priority protects keys per-key (upstream protectedKeys), not per-gesture

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-fidelity/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6746859..HEAD -- src/lib/utils/hover.ts src/lib/utils/interaction.ts src/lib/utils/gestureCoordinator.ts`
> Plans 001–003 intentionally modify `hover.ts`/`interaction.ts` before this
> one. Re-read the LIVE hover-start/hover-end gating and `buildTapResetRecord`
> call sites before starting; the SEMANTICS documented below are what must
> hold, not the exact line numbers.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 001, 002, 003 (same files; land those first)
- **Category**: bug
- **Planned at**: commit `6746859`, 2026-07-22

## Why this matters

Upstream framer-motion resolves gestures per-KEY: when `whileTap` is active it protects only the keys it actually animates (`animation-state.ts` `protectedKeys`/`encounteredKeys`); a simultaneously-active `whileHover` still owns every key tap doesn't touch. Our port gates per-GESTURE: while tap is active, the entire hover application/restore is skipped. Two observable divergences with `whileHover={{ opacity: 0.8 }}` + `whileTap={{ scale: 0.9 }}`:

1. Hovering _while pressed_ never applies the opacity change (upstream applies it — tap doesn't own `opacity`).
2. Hover ending _mid-press_ restores nothing (deferred wholesale to tap release), and tap release only restores keys in `whileTap` — so `opacity` stays stuck at 0.8 forever.

## Current state

- `src/lib/utils/gestureCoordinator.ts` — tracks `active: Set<GestureType>` and `stoppers: Set<() => void>`; no key ownership. Full file is ~100 lines; read it.
- `src/lib/utils/hover.ts` — hover start gates on `if (!coordinator?.isActive('tap'))` before `animateGestureTarget(keyframes, transition)`; hover end has:

```ts
// While pressed, the tap state owns these keys — its release path
// restores the correct target (base, now that hover is inactive).
if (coordinator?.isActive('tap')) {
    callbacks?.onEnd?.()
    return
}
```

- `src/lib/utils/interaction.ts` — tap release (`animateReset`) calls `reapplyHoverIfActive()` (re-applies the FULL hover def if hover still active) or `buildTapResetRecord(initial, animateDef, tapKeyframes)` which restores ONLY keys present in `whileTap` (interaction.ts:19-72).
- Upstream references (read-only, cite in comments): `~/Github/motion/packages/motion-dom/src/render/utils/animation-state.ts` (~lines 193, 281-341: `protectedKeys`, `encounteredKeys`, removed-key restore), `~/Github/motion/packages/framer-motion/src/motion/utils/variant-props.ts` (priority order: `animate < whileHover < whileTap`).
- Existing behavioral contracts that MUST NOT regress (each has an e2e spec): hover-exit mid-release-spring does not snap (`e2e/motion/hover-and-tap.test.ts`), press from hover seeds from visual scale (`e2e/motion/rapid-tap.test.ts`, `e2e/motion/tap-authored-transforms.spec.ts`), multi-channel hover renders both channels (`e2e/motion/hover-transform-channels.spec.ts`).

## Commands you will need

| Purpose       | Command                                                                                                       | Expected on success |
| ------------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck     | `pnpm check`                                                                                                  | exit 0              |
| Unit tests    | `pnpm vitest run src/lib/utils`                                                                               | all pass            |
| E2e           | `PW_REUSE_SERVER=1 npx playwright test <specs> --reporter=line` if 4198 has a listener, else drop the env var | pass                |
| Format / Lint | `trunk fmt <files>` / `trunk check <files>`                                                                   | clean               |

**NEVER kill any process listening on port 4198.**

## Scope

**In scope**:

- `src/lib/utils/gestureCoordinator.ts` (add per-key ownership)
- `src/lib/utils/gestureCoordinator.spec.ts` (extend)
- `src/lib/utils/hover.ts` (replace the all-or-nothing gates with key filtering)
- `src/lib/utils/interaction.ts` (tap release restores orphaned hover keys correctly)
- `src/routes/tests/motion/hover-tap-disjoint-keys/+page.svelte` (create)
- `e2e/motion/hover-tap-disjoint-keys.spec.ts` (create)

**Out of scope**:

- `whileDrag`/`whileFocus` priorities — only hover/tap exist in this coordinator today; do not extend the type union.
- Any change to `_MotionContainer.svelte` wiring.
- Full `createAnimationState` adoption (issue #449) — this plan is the minimal per-key port, not the wholesale rewrite.

## Git workflow

- Current branch; commits: `test(motion): …` red, then `fix(gestures): …`. Do NOT push.

## Steps

### Step 1: Failing e2e for both divergences

Page `src/routes/tests/motion/hover-tap-disjoint-keys/+page.svelte` (model: `src/routes/tests/motion/hover-transform-channels/+page.svelte`):

```svelte
<MotionConfig transition={{ duration: 0.3 }}>
    <motion.div
        whileHover={{ opacity: 0.5 }}
        whileTap={{ scale: 0.9 }}
        style="width: 100px; height: 100px; background: #247768; opacity: 1;"
        data-testid="motion-disjoint-keys"
    />
</MotionConfig>
```

Spec `e2e/motion/hover-tap-disjoint-keys.spec.ts` with two tests:

1. **hover-during-press applies non-owned keys**: `mouse.move` off-element → `mouse.down` on empty space? No — press must start ON the element without hover first being active: use keyboard-free path: `page.mouse.move` to the element (hover fires) is unavoidable with a mouse; instead press FIRST via `page.touchscreen`? Simplest deterministic order: move onto element (hover applies, opacity → 0.5), `mouse.down` (tap active), then assert opacity REMAINS ~0.5 while pressed (upstream keeps it; current code also keeps it — not the red case), then `mouse.move` AWAY while still pressed (hover ends mid-press) and back ON (hover re-enters mid-press): assert opacity returns to ~0.5. Current code skips application while tap is active → stays ~1. This is the red assertion.
2. **hover-exit mid-press restores non-owned keys on release**: hover on (opacity → 0.5), `mouse.down`, `mouse.move` away (hover exits mid-press), `mouse.up` off-element (tap cancels). Assert opacity settles back to ~1. Current code leaves it stuck at ~0.5 (red).

**Verify**: `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-tap-disjoint-keys.spec.ts --reporter=line` → both FAIL as described. If test 1's re-enter case does not reproduce (pointer-event ordering can differ headless), keep only test 2 as the red anchor and report the discrepancy.

### Step 2: Add key ownership to the coordinator

In `gestureCoordinator.ts`, extend the coordinator with per-gesture owned keys, mirroring upstream naming (`protectedKeys`):

```ts
setActive(type, isActive, ownedKeys?: string[])  // record keys on activate; clear on deactivate
ownedKeys(type): ReadonlySet<string>
isKeyProtected(key, below: GestureType): boolean // is `key` owned by a gesture with higher priority than `below`
```

Priority order constant: `['hover', 'tap']` (tap higher), cited to upstream `variant-props.ts`. Keep backward compatibility: `setActive('tap', true)` without keys owns nothing new. Extend `gestureCoordinator.spec.ts` with cases: activate-with-keys, deactivate-clears, protection is priority-directional (tap's keys protected from hover; hover's keys NOT protected from tap).

**Verify**: `pnpm vitest run src/lib/utils/gestureCoordinator.spec.ts` → all pass, including new cases.

### Step 3: Hover applies/restores the unprotected subset

In `hover.ts`:

- Hover start: `coordinator.setActive('hover', true, Object.keys(keyframes))`. Replace `if (!coordinator?.isActive('tap'))` with filtering: `const unprotected = filterRecord(keyframes, k => !coordinator?.isKeyProtected(k, 'hover'))`; animate only that subset (still through `animateGestureTarget`). When tap is active, tap-owned keys stay untouched (they re-apply via the existing tap-release `reapplyHoverIfActive` path).
- Hover end: same filtering on the baseline — restore keys NOT protected by tap, instead of returning early wholesale. Keys tap owns keep deferring to tap's release (unchanged contract for overlapping keys like `scale`).
- Update `setActive('hover', false)` to clear ownership.

**Verify**: `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-tap-disjoint-keys.spec.ts --reporter=line` → test 2 (and test 1 if kept) PASS.

### Step 4: Tap release restores orphaned hover keys

In `interaction.ts` `animateReset`: after `buildTapResetRecord`, when hover is NOT still active, extend the reset record with baseline values for any hover-def keys not present in `whileTap` that were applied while pressed (obtainable via `callbacks.hoverDef` keys minus tap keys, restored through the same animate-to-baseline mechanism hover-end uses — accept the hover system's baseline computation via a callback rather than duplicating `computeHoverBaseline` in interaction.ts; wire a `restoreHoverBaseline(keys: string[])` callback from `_MotionContainer`'s attach wiring if one does not exist — if that wiring requires touching `_MotionContainer.svelte`, STOP and report, since it is out of scope).

**Verify**: e2e spec fully green; `pnpm vitest run src/lib/utils` → all pass.

### Step 5: Full regression gate

`pnpm check` → 0. `pnpm vitest run src/lib/utils` → pass. `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-tap-disjoint-keys.spec.ts e2e/motion/hover-and-tap.test.ts e2e/motion/hover-transform-channels.spec.ts e2e/motion/hover-tap-multichannel-handoff.spec.ts e2e/motion/rapid-tap.test.ts e2e/motion/tap-authored-transforms.spec.ts e2e/motion/hover-authored-transforms.spec.ts e2e/motion/while-string-variants.spec.ts --reporter=line` → all pass. `trunk fmt`/`trunk check` → clean.

## Test plan

- Red anchor: disjoint-keys spec, test 2 (stuck opacity after hover-exit-mid-press + cancel) fails today, passes after.
- Unit: coordinator ownership semantics (Step 2 list).
- The eight-spec regression set is mandatory — this is the highest-blast-radius plan in the batch; every previously-fixed gesture snap has a spec in that set.

## Done criteria

- [ ] `pnpm check` exits 0; `pnpm vitest run src/lib/utils` exits 0
- [ ] Step 1 red spec exists and passes
- [ ] `grep -n "isActive('tap')" src/lib/utils/hover.ts` shows no remaining all-or-nothing application gate (protection is key-filtered)
- [ ] Eight-spec e2e regression set passes
- [ ] No out-of-scope files modified; README row updated

## STOP conditions

- Step 4 requires modifying `_MotionContainer.svelte` (out of scope) — report the wiring you need instead of doing it.
- Any spec in the regression set fails twice after a fix attempt — this plan touches the arbitration core; report rather than iterate blindly.
- The live gating code after plans 001–003 differs structurally from the "Current state" description (not just line numbers) — re-plan needed.

## Maintenance notes

- This is the last per-key gap before issue #449 (wholesale `createAnimationState` adoption); when #449 lands, this coordinator becomes redundant — keep its API surface minimal.
- Reviewer: focus on the overlapping-key case (`scale` in both hover and tap) — its arbitration must be IDENTICAL to before this plan (tap wins while pressed; release re-applies hover if active).
