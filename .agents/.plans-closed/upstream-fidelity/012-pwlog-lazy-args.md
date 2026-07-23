# Plan 012: pwLog stops forcing layout/style reads in production

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-fidelity/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6746859..HEAD -- src/lib/utils/log.ts src/lib/utils/interaction.ts`
> Plans 002/004 edit `interaction.ts` — expected; the pwLog call-site pattern
> survives those plans. If `log.ts` itself has changed, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 002, 004 (interaction.ts churn — land those first to avoid conflicts)
- **Category**: perf
- **Planned at**: commit `6746859`, 2026-07-22

## Why this matters

`pwLog` is a no-op outside DEV+Playwright, but JavaScript evaluates its arguments eagerly. The gesture files pass argument objects containing `el.getBoundingClientRect()` and `getComputedStyle(el).transform` — each a forced reflow/style-recalc — at ~19 call sites covering every press-start, press-end, tap-apply, reset, and hover-reapply. Shipped consumers pay 2+ discarded synchronous layout passes per interaction event on interaction-heavy pages. Not a fidelity divergence — pure wasted work upstream doesn't do.

## Current state

- `src/lib/utils/log.ts:24-30` — `pwLog` guards on DEV+Playwright INSIDE the function; arguments are already evaluated by then.
- `src/lib/utils/interaction.ts` — representative call site (verbatim, `animateTap`):

```ts
pwLog('[tap] animate-tap', {
    w: el.getBoundingClientRect().width,
    h: el.getBoundingClientRect().height,
    transform: getComputedStyle(el).transform,
    whileTap,
    gestureActive: gestureCtl !== null
})
```

- Sites: `grep -n "pwLog" src/lib/utils/interaction.ts src/lib/utils/*.ts` (~19 in interaction.ts at plan time; check other utils too).
- Convention note: `pwLog`'s call sites are load-bearing for Playwright debugging — the LOGGED CONTENT must remain identical when logging is active.

## Commands you will need

| Purpose    | Command                                                                                                                                               | Expected on success |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck  | `pnpm check`                                                                                                                                          | exit 0              |
| Unit tests | `pnpm vitest run src/lib/utils`                                                                                                                       | all pass            |
| E2e smoke  | `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-and-tap.test.ts e2e/motion/rapid-tap.test.ts --reporter=line` if 4198 occupied, else drop env | pass                |

**NEVER kill any process listening on port 4198.**

## Scope

**In scope**:

- `src/lib/utils/log.ts`
- Every `pwLog` call site passing eager DOM reads (interaction.ts primarily; grep-driven)
- `src/lib/utils/log.spec.ts` (create or extend)

**Out of scope**:

- Removing pwLog calls or changing their messages/payload shapes.

## Git workflow

- Current branch; `test(utils): …` then `perf(utils): …` commits. Do NOT push.

## Steps

### Step 1: Failing unit test — laziness contract

In `src/lib/utils/log.spec.ts`: with the DEV/Playwright detection forced OFF (mock however `log.ts` detects it — read the file and mock that exact mechanism, e.g. `vi.stubEnv` or stubbing the window flag), call the NEW thunk form `pwLog('msg', () => probe())` where `probe` is a `vi.fn()`; assert `probe` was NOT called. With detection forced ON, assert `probe` IS called and its return value is what gets logged (spy on `console.log` or whatever sink `log.ts` uses). The first assertion fails until Step 2 adds thunk support (current signature evaluates everything eagerly; write the test against the intended new API — for a new-API red test the "failure" is a type/`TypeError` failure, acceptable here since the perf issue itself is not observable in vitest; note this in the spec's comment).

**Verify**: `pnpm vitest run src/lib/utils/log.spec.ts` → thunk-laziness test FAILS (thunk unsupported/logged as a function).

### Step 2: Support lazy payloads in pwLog

In `log.ts`: accept `(message: string, payload?: unknown | (() => unknown))`. When inactive → return immediately (unchanged). When active → if `typeof payload === 'function'`, invoke it and log the result; else log as today. Keep the exported signature backward-compatible (plain objects still work). Google-style JSDoc update.

**Verify**: Step 1 tests PASS.

### Step 3: Convert the expensive call sites

Grep every `pwLog(` site whose payload contains `getBoundingClientRect`, `getComputedStyle`, or any function call on DOM (`grep -n "pwLog" src/lib/utils/*.ts` then inspect each): wrap those payloads in `() => ({ ... })`, byte-identical inner object. Leave cheap payloads (plain locals) as-is — churn without benefit.

**Verify**: `grep -n "pwLog('\[tap\]" src/lib/utils/interaction.ts | wc -l` unchanged from before (no sites dropped); `pnpm check` → 0 (thunk types accepted); manual spot check: `grep -B1 -A6 "animate-tap" src/lib/utils/interaction.ts` shows the thunk wrapper.

### Step 4: Full gate

`pnpm check` → 0. `pnpm vitest run src/lib/utils` → pass. Two-spec e2e smoke (hover-and-tap, rapid-tap — they rely on pwLog output paths under Playwright, proving active-mode logging still works) → pass. `trunk fmt`/`trunk check` → clean.

## Test plan

- Red anchor: laziness contract test (inactive → thunk never invoked). The production reflow cost itself isn't measurable in vitest; the thunk contract is the proxy — stated here as the justified exemption from a behavioral red test.
- Active-mode test: thunk invoked, payload logged intact.
- E2e smoke proves Playwright-mode logging still functions.

## Done criteria

- [ ] `pnpm check` exits 0; `pnpm vitest run src/lib/utils` green incl. new log tests
- [ ] `grep -rn "getBoundingClientRect\(\)" src/lib/utils/interaction.ts` shows every hit inside a `() =>` pwLog thunk or in non-logging code only
- [ ] Two-spec e2e smoke green; no out-of-scope files modified; README row updated

## STOP conditions

- `log.ts`'s activation detection is not mockable in vitest (report the mechanism found).
- Any pwLog payload turns out to be relied on for side effects (a call site whose evaluation matters beyond logging) — report it; do not wrap it.

## Maintenance notes

- New pwLog call sites with DOM reads must use the thunk form — worth one line in the `pwLog` JSDoc (add it).
- Reviewer: diff should show ONLY thunk-wrapping at call sites; any payload content change is a red flag.
