# Plan 011: Cancel the projection adapter's stray rAF and unregister composed animations on cleanup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-fidelity/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6746859..HEAD -- src/lib/utils/motionDomProjection.ts src/lib/utils/hover.ts`
> Plans 001–004 rework `hover.ts`; re-locate the registration/cleanup code by
> symbol name, not line number. If `refreshCachedLayout` differs from the
> excerpt, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001–004 for the hover.ts half (execute after them); the projection half has no dependency
- **Category**: bug (cleanup/leak)
- **Planned at**: commit `6746859`, 2026-07-22

## Why this matters

Two small cleanup gaps diverge from upstream's frame-cancellation discipline (`create-projection-node.ts` `unmount` → `cancelFrame(this.updateProjection)`):

1. `MotionDomProjectionAdapter.refreshCachedLayout` schedules a `requestAnimationFrame` that is never stored or cancelled. `unmount()` clears `this.lastLayout`, but a pending callback fires afterward and resurrects it from `this.projection.layout` — a post-unmount state write that can seed a remount's first commit with a stale snapshot.
2. The hover system's composed channel animations register stoppers with the gesture coordinator, but teardown (`stopChannelAnimations` + the attachment's cleanup) only calls `animation.stop()` — the stored `unregister` runs only from `onComplete`, so stopped animations' closures stay in the coordinator's `stoppers` Set until the element is GC'd.

## Current state

- `src/lib/utils/motionDomProjection.ts:679-684` — verbatim:

```ts
    private refreshCachedLayout(): void {
        this.lastLayout = cloneMeasurements(this.projection.layout)
        requestAnimationFrame(() => {
            this.lastLayout = cloneMeasurements(this.projection.layout)
        })
    }
```

- `unmount()` is at `:232-241` (sets `this.lastLayout = undefined` among other teardown). `refreshCachedLayout` is called from `didUpdate`/`commitObservedLayoutChange` paths (grep `refreshCachedLayout` for the exact call sites).
- `src/lib/utils/hover.ts` — in `animateComposedChannel` (post-plan-001 shape), the pattern at plan time:

```ts
        const registration: { unregister?: () => void } = {}
        const animation = animateValue({ ..., onComplete: () => { ...; registration.unregister?.() } })
        channelAnimations.set(key, animation)
        registration.unregister = coordinator?.register(() => { ... })
```

and `stopChannelAnimations` iterates `channelAnimations.values()` calling only `animation.stop?.()`.

- `gestureCoordinator.ts` `register` returns an unregister closure deleting from the `stoppers` Set (lines 84-87).

## Commands you will need

| Purpose        | Command                                                                                                                                                         | Expected on success |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck      | `pnpm check`                                                                                                                                                    | exit 0              |
| Unit tests     | `pnpm vitest run src/lib/utils`                                                                                                                                 | all pass            |
| E2e regression | `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-and-tap.test.ts e2e/motion/layout-align-toggle.spec.ts --reporter=line` if 4198 occupied, else drop env | pass                |

**NEVER kill any process listening on port 4198.**

## Scope

**In scope**:

- `src/lib/utils/motionDomProjection.ts` (`refreshCachedLayout`, `unmount`, plus a private rAF-handle field)
- `src/lib/utils/hover.ts` (track unregister alongside each channel animation; call it in `stopChannelAnimations`)
- Unit specs: `src/lib/utils/motionDomProjection.spec.ts` (check whether it exists — `ls src/lib/utils/*.spec.ts`; create the minimal cases if absent), `src/lib/utils/hover.spec.ts`

**Out of scope**:

- `gestureCoordinator.ts` API.
- Any behavior change to WHEN `refreshCachedLayout` runs.

## Git workflow

- Current branch; single pair of commits: `test(utils): …` then `fix(utils): cancel stray adapter rAF and unregister stopped gesture animations`. Do NOT push.

## Steps

### Step 1: Failing unit tests

(a) Adapter rAF: in the motionDomProjection spec, with jsdom + a controllable rAF stub (`vi.stubGlobal('requestAnimationFrame', ...)` capturing callbacks; the repo's vitest setup already runs jsdom — model stubbing on existing specs that mock timers, `grep -rln "stubGlobal\|useFakeTimers" src/lib/utils/*.spec.ts` for an exemplar): construct an adapter (or the smallest harness its constructor allows — if constructing requires heavy projection scaffolding, instead test via its public methods with a mock projection object; report if not feasible within ~30 lines of setup and convert this half to e2e-observation instead per STOP conditions), trigger the path that calls `refreshCachedLayout`, call `unmount()`, then flush the captured rAF callback, and assert `lastLayout` REMAINS undefined. Current code: the flush resurrects it — red.

(b) Coordinator retention: in `hover.spec.ts`, using a fake coordinator (implement the `GestureCoordinator` type inline with a real Set so retention is observable), attach hover, start a composed animation (hover-enter on a jsdom element — if `animateValue` doesn't run under jsdom's clock, drive the check at the `register`/`unregister` level: assert that after calling the attachment's returned cleanup, the fake coordinator's stopper Set is empty). Current code leaves entries — red.

**Verify**: `pnpm vitest run src/lib/utils` → both new cases FAIL for the described reasons.

### Step 2: Fix both leaks

(a) Add `private refreshRafId: number | null = null` to the adapter; store the handle in `refreshCachedLayout` (cancelling any prior pending one first), cancel it in `unmount()` (`cancelAnimationFrame` guarded for SSR the same way the file already guards window APIs — copy the existing guard style found in the file), and no-op the callback when the adapter is unmounted (check whatever field `unmount()` nulls, e.g. `this.element`).

(b) In `hover.ts`, store `{ animation, unregister }` in `channelAnimations` (or a parallel map); `stopChannelAnimations` calls both `stop()` and `unregister()`; keep `onComplete`'s unregister (idempotent — Set deletion).

**Verify**: `pnpm vitest run src/lib/utils` → Step 1 cases PASS.

### Step 3: Full gate

`pnpm check` → 0. `pnpm vitest run src/lib/utils` → pass. Two-spec e2e regression → pass. `trunk fmt`/`trunk check` → clean.

## Test plan

- Red anchors: post-unmount rAF resurrection; coordinator Set retention after cleanup. Both unit-level (the leaks are not e2e-observable).
- Regression: hover-and-tap + layout-align-toggle e2e cover the touched systems' happy paths.

## Done criteria

- [ ] `pnpm check` exits 0; `pnpm vitest run src/lib/utils` green incl. both new cases
- [ ] `grep -n "requestAnimationFrame" src/lib/utils/motionDomProjection.ts` shows the handle stored and cancelled
- [ ] Two-spec e2e green; no out-of-scope files modified; README row updated

## STOP conditions

- The adapter cannot be unit-constructed with reasonable mocks (report the constructor's dependency list; the rAF fix itself is safe to ship with only the e2e regression set, but say so explicitly in the report rather than silently skipping the red test).
- `stopChannelAnimations` no longer exists after plans 001–004 (renamed/restructured) — re-locate by searching for the coordinator `register` call in hover.ts and adapt; if the registration pattern itself changed, STOP.

## Maintenance notes

- Reviewer: unregister-on-stop must be idempotent with onComplete's unregister (Set semantics make it so today — keep it that way).
- The adapter's other scheduled work should be audited for the same pattern if new `requestAnimationFrame`/`frame.*` calls are added later.
