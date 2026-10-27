# Guard report — 002-ref-retry-microtask-stall

**Recommendation: PASS** — every done criterion reproduced green by guard; the diff serves the plan's intent.
**Reviewed at** `48bbe49a` (lane/1460-refretry) · 2026-10-26 17:05 · **Plan planned at** `45a24c6e` (batch committed at `0422640d`)
**Integrated** — not yet: batch convention is one branch, one PR. Merges into `feat/motion-14.6.0` per the README order; the PR opens after the batch's final gate and the maintainer's live sign-off.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Both microtask specs + refRetry.spec.ts pass | met | `vitest run attachable.microtask.spec.ts scroll.svelte.microtask.spec.ts refRetry.spec.ts` → 9/9 |
| No `microtask.read` / `cancelMicrotask` left in attachable.ts, scroll.svelte.ts | met | grep → no matches |
| `pnpm test:only` passes | met | 94 files, 1160 tests |
| `pnpm build` exits 0 | met | publint "All good!" |
| `pnpm check` 0 errors | met | pre-commit svelte-check on 48bbe49a passed; executor's run 0 errors / 33 warnings (pre-existing) |
| Only in-scope files | met | `git diff --stat 0422640d..48bbe49a` → refRetry.ts/.spec, attachable.ts/.spec, scroll.svelte.ts, 2 microtask specs, changeset |

## Spirit

The stall came from re-scheduling a job on motion-dom's `microtask` batcher from inside its own flush. Ref retries no longer touch that batcher at all: `scheduleRefRetry` uses a plain microtask first, then rAF. The red specs reproduce the stall (`laterJobRan === false`) on the old code and pass on the new.

## Scope & conduct

In scope. No STOP fired. The executor left Steps 2-5 uncommitted (it read 'commit only where a step says'); guard snapshot-committed them as 48bbe49a with the plan's suggested message.

## Residual risk / follow-ups

- Retry cadence after the first attempt is now one rAF instead of a microtask, so a ref that resolves several microtasks late attaches a frame later. Upstream's `useScroll` still has the original pattern; reporting it is the maintainer's call.
