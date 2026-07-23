# Plan 002: Hover↔tap handoffs reseed every externally-written transform channel, not just scale

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-fidelity/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6746859..HEAD -- src/lib/utils/hover.ts src/lib/utils/interaction.ts src/lib/utils/gestureCoordinator.ts`
> Plan 001 intentionally edits `hover.ts` first — re-read the live
> `animateComposedChannel`/`writeComposedChannels` before proceeding. If
> `interaction.ts`'s `seedStaleScale` excerpt below doesn't match, STOP.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: 001-hover-composed-default-transitions.md
- **Category**: bug
- **Planned at**: commit `6746859`, 2026-07-22

## Why this matters

The hover system's composed transform writer writes `el.style.transform` directly, bypassing motion's internal motion values. To prevent the next motion-element animation from snapping to a stale internal value, the writer flags each channel it writes (`coordinator.markExternalWrite(key)`), and the tap system seeds its animation start from the element's _visual_ value. But the seeding only exists for `scale` (`seedStaleScale`). After the recent multi-channel composed-writer change, hover also writes `x`/`y`/`rotate`/`scaleX`/… externally — so a tap interrupting a `whileHover={{ scale: 1.2, y: -8 }}` starts with scale seeded smoothly but `y` snapping to motion's stale value on frame one. Upstream framer-motion never has this problem because every key is a persistent motion value. Side effect of the same gap: the flags for non-scale keys are marked but never consumed, so they accumulate in the coordinator's Set for the element's lifetime.

## Current state

- `src/lib/utils/interaction.ts` — tap attachment; `seedStaleScale` at lines 186-197 (excerpt below) is called at three sites: `animateTap` (~line 230), `reapplyHoverIfActive` (~line 282), `animateReset` (~line 320).
- `src/lib/utils/hover.ts` — exports `readTransformScale` (computed-matrix scale reader, lines 56-66); the composed writer marks external writes for every owned channel inside `writeComposedChannels`.
- `src/lib/utils/gestureCoordinator.ts` — `markExternalWrite` adds to a `Set<string>`; `consumeExternalWrite` deletes-and-returns (lines 75-78).

`src/lib/utils/interaction.ts:186-197` (verbatim at plan time):

```ts
// When the hover system's composed writer was the last to touch `scale`,
// motion's internal motion value is stale — seed the keyframes from the
// element's VISUAL scale so the animation starts where the eye left off
// instead of snapping to the stale value on frame one.
const seedStaleScale = (record: Record<string, unknown>): Record<string, unknown> => {
    if (!coordinator?.consumeExternalWrite('scale')) return record
    const target = record.scale
    if (typeof target !== 'number') return record
    const current = readTransformScale(el)
    if (Math.abs(current - target) < 0.001) return record
    return { ...record, scale: [current, target] }
}
```

`src/lib/utils/hover.ts:56-66` — `readTransformScale` parses `getComputedStyle(el).transform` matrix `a,b` via `Math.hypot`. There is NO equivalent reader for translate/rotate yet; the 2D matrix gives `e,f` for translation and `atan2(b,a)` for rotation.

Upstream reference (read-only): upstream avoids this class of bug entirely via persistent motion values (`~/Github/motion/packages/motion-dom/src/render/utils/animation-state.ts` + motion values); our seeding is the port-specific substitute. The fidelity goal: an interrupted multi-channel hover must hand off to tap with NO first-frame jump on ANY channel.

## Commands you will need

| Purpose       | Command                                                                                                                      | Expected on success |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck     | `pnpm check`                                                                                                                 | exit 0              |
| Unit tests    | `pnpm vitest run src/lib/utils`                                                                                              | all pass            |
| One e2e spec  | `PW_REUSE_SERVER=1 npx playwright test e2e/motion/<spec> --reporter=line` if port 4198 has a listener, else drop the env var | pass                |
| Format / Lint | `trunk fmt <files>` / `trunk check <files>`                                                                                  | clean               |

**NEVER kill any process listening on port 4198.**

## Scope

**In scope**:

- `src/lib/utils/interaction.ts` (generalize `seedStaleScale` → `seedStaleChannels`)
- `src/lib/utils/hover.ts` (add/export a general channel reader next to `readTransformScale`)
- `src/lib/utils/hover.spec.ts` or a new `src/lib/utils/interaction.spec.ts` (unit tests for the matrix readers/seeder as pure functions)
- `src/routes/tests/motion/hover-tap-multichannel-handoff/+page.svelte` (create)
- `e2e/motion/hover-tap-multichannel-handoff.spec.ts` (create)

**Out of scope**:

- `gestureCoordinator.ts` — its Set API is sufficient; do not add per-channel APIs there.
- The composed writer's own animation logic (plan 001 owns it).
- 3D transforms (`rotateX/rotateY/z`) — matrix2d decomposition doesn't cover them; leave those channels unseeded with a comment.

## Git workflow

- Current branch (`style/brutalist-examples`); red-test commit (`test(motion): …`) then fix commit (`fix(gestures): …`), matching `git log` convention. Do NOT push.

## Steps

### Step 1: Failing e2e reproducing the non-scale snap

Create `src/routes/tests/motion/hover-tap-multichannel-handoff/+page.svelte` modeled on `src/routes/tests/motion/hover-transform-channels/+page.svelte`:

```svelte
<MotionConfig transition={{ duration: 0.6 }}>
    <motion.div
        whileHover={{ scale: 1.2, y: -20 }}
        whileTap={{ scale: 0.9, y: 0 }}
        style="width: 100px; height: 100px; background-color: #247768;"
        data-testid="motion-multichannel-handoff"
    />
</MotionConfig>
```

Spec `e2e/motion/hover-tap-multichannel-handoff.spec.ts` (reuse the matrix-parsing `readTransform` helper pattern from `e2e/motion/hover-transform-channels.spec.ts`, extended to also return `y` from matrix `f`): hover the element, wait ~250ms (mid-hover, y is between 0 and −20), then `page.mouse.down()`. Sample `y` every frame (`requestAnimationFrame` loop via `page.evaluate`, or 10ms polling) for the first ~100ms of the press. Assert no discontinuity: the first post-press sample of `y` must be within 3px of the last pre-press sample (currently it snaps toward motion's stale internal `y` — expect a jump well beyond 3px). Model the frame-sampling technique on `e2e/_helpers/transform.ts` (`sampleRectLeftSeries`) if a per-frame series helper is needed.

**Verify**: `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-tap-multichannel-handoff.spec.ts --reporter=line` → FAILS with a first-frame `y` jump > 3px.

### Step 2: Add a general transform-channel reader in hover.ts

Next to `readTransformScale`, add and export `readTransformChannels(el): { scale: number; x: number; y: number; rotate: number } | null` that parses the computed 2D matrix once: `x = e`, `y = f`, `scale = hypot(a,b)`, `rotate = atan2(b,a) * (180/Math.PI)`. Return `null` for `matrix3d` (out of scope) and `none` → identity values. Google-style JSDoc. Add pure unit tests in `src/lib/utils/hover.spec.ts` (construct elements in jsdom with inline `transform` and assert decomposition; model on existing specs in `src/lib/utils/*.spec.ts`).

**Verify**: `pnpm vitest run src/lib/utils/hover.spec.ts` → new tests pass.

### Step 3: Generalize the seeder in interaction.ts

Replace `seedStaleScale` with `seedStaleChannels(record)`: for each key of `record` in `['scale','scaleX','scaleY','x','y','rotate']` where `coordinator.consumeExternalWrite(key)` is true and `record[key]` is a number, read the current visual value from `readTransformChannels(el)` (`scaleX`/`scaleY` seed from the uniform `scale` reading — document that approximation) and replace the target with `[current, target]` (skip when `|current - target| < 0.001`, same tolerance as today). Consume the flag for EVERY key in the list regardless of whether reseeding applied (fixes the Set accumulation). Update all three call sites. Keep the function's existing comment style — constraint-stating, citing the composed writer.

**Verify**: `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-tap-multichannel-handoff.spec.ts --reporter=line` → PASSES.

### Step 4: Full gate

`pnpm check` → 0. `pnpm vitest run src/lib/utils` → all pass. `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-tap-multichannel-handoff.spec.ts e2e/motion/hover-transform-channels.spec.ts e2e/motion/hover-and-tap.test.ts e2e/motion/rapid-tap.test.ts e2e/motion/tap-authored-transforms.spec.ts --reporter=line` → all pass. `trunk fmt` / `trunk check` on touched files → clean.

## Test plan

- Red anchor: Step 1's mid-hover press shows a `y` discontinuity > 3px against current code; ≤ 3px after Step 3.
- Unit: matrix decomposition (`readTransformChannels`) — identity, translate-only, rotate+scale combined, `matrix3d` → null.
- Regression: rapid-tap and tap-authored-transforms specs guard the existing scale-seeding behavior this generalization replaces.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm vitest run src/lib/utils` exits 0, including new decomposition tests
- [ ] Step 1 spec exists and passes (failed at plan time)
- [ ] `grep -n "seedStaleScale" src/lib/utils/interaction.ts` returns no matches (renamed/generalized)
- [ ] Five-spec e2e set passes
- [ ] No files outside scope modified; README row updated

## STOP conditions

- `seedStaleScale` no longer matches the excerpt (interaction.ts drifted beyond plan 001's expected hover.ts changes).
- The red test does NOT fail (the snap may already be masked by plan 001's changes — report; the seeding fix is still required for the Set-consumption issue, but the test needs a new observable).
- Rotation decomposition sign conventions disagree with what the browser reports (report samples rather than fudging signs).

## Maintenance notes

- Plan 004 (per-key ownership) will change WHEN these handoffs occur but not the seeding mechanism; it consumes `seedStaleChannels` as-is.
- Reviewer: check that flags are consumed even when no reseed applies — the Set must not accumulate.
- Deferred: velocity carry-over across the handoff (needs per-key motion values — issue #449); 3D channels.
