# Guard log: plan 010 (a clone exit restores the parent's `position`)

## 2026-11-20, final: PASS

- **Executor:** opus 5.5, lane `lane/2141-010`. Its first session ended while its e2e run was in flight; a continuation finished and reported. No STOP conditions fired.
- **Red reproduced by the guard:** with `presence.ts` reverted, `vitest run src/lib/utils/presence.spec.ts` → 10 failed, 113 passed. All of the failures were plan-010 restore cases.
- **Green reproduced:** 123/123.
- **Full gate run independently by the guard** (task `budqp1oyw`):
  - `pnpm test:only` 124 files, 1744 passed;
  - `PW_PORT=4220 … e2e/animate-presence` 210 passed in 10.7 min;
  - `trunk check` no issues;
  - `git diff --check` clean;
  - only in-scope files changed.
- **The executor's own gate matched:** 1744 unit tests, 210/210 e2e, `pnpm check` 0 errors, `pnpm build` ok.
- **Diff read in full:**
  - `holdContainingBlock` uses a module `WeakMap` refcount and saves the inline value and priority. Its release is idempotent and keeps any value the app wrote during the exit.
  - `ActiveExit.releaseContainingBlock` is called right after `clone.remove()` at all four sites.
  - The old line-366 spec was updated as Step 3 says.
- **Integrated:** `d1f78549` on `fix/2.14.1`. It edits regions of `presence.ts` separate from plan 005's.
