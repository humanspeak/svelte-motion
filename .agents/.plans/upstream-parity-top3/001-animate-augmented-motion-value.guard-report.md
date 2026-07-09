# Guard close-out report — Plan 001: Re-type `animate` for AugmentedMotionValue

- **Verdict: NO-PASS** — single blocker, and it is a plan defect, not a work defect. See "Flip condition."
- **Gate**: `guard parity 1 final`, 2026-07-08
- **Snapshot under review**: `65ef75f` (`fix(types): animate() accepts AugmentedMotionValue without casts`)
- **Base**: `45203c4` · **Branch**: `fix/animate-augmented-motion-value-typing` · **Plan `Planned at`**: `634983b`
- **PR**: none opened (NO-PASS earns no PR; the snapshot stays on the branch, unmerged).

## One-line

The work is a clean, faithful, zero-runtime-change implementation of the plan's
intent; the only failing Done criterion (`pnpm --filter docs check` exit 0) is
unachievable as written because of pre-existing unrelated docs errors. Flipping
to PASS needs one operator decision, not more code.

## Done criteria (reproduced at `65ef75f`)

| #   | Criterion                                             | Result                                                                    |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | `pnpm check` (root) exit 0                            | ✅ 0 errors, 32 pre-existing warnings; `@ts-expect-error` cases validated |
| 2   | `pnpm test` incl. `animateValue.spec.ts`              | ✅ 3/3                                                                    |
| 3   | `grep as unknown as RawMotionValue src/ docs/src` → 0 | ✅ 0 (one doc-comment mention only)                                       |
| 4   | `pnpm --filter docs check` exit 0                     | ❌ 10 errors — **all pre-existing/unrelated** (plan defect, below)        |
| 5   | e2e `e2e/utilities e2e/vanilla-values e2e/motion`     | ✅ 123 passed, 1 skipped, 0 failed (incl. a fresh package build)          |
| 6   | `git status` clean outside in-scope                   | ✅ scope audit exact (below)                                              |
| 7   | Batch README status row updated                       | ✅ 001 → DONE                                                             |

## Fidelity to intent ("Why this matters")

Kills the `as unknown as RawMotionValue` papercut with **zero runtime change**:

- `animateValue.ts:91` — `export const animate = animateCore as SvelteMotionAnimate`:
  pure type-level cast, no runtime wrapper. Proven by `animateValue.spec.ts:23`
  (`expect(animate).toBe(animateCore)`) and by the e2e suite (touched routes render
  identically). Mirrors the `effects.ts` exemplar the plan named; value overloads
  precede the object-target overload (`animateValue.ts:34-63`), fixing the exact
  misleading error.
- `index.ts:44` swaps the `animate` re-export to the wrapper (removed from the raw
  `from 'motion'` block); `animate.svelte.ts` re-types `useAnimate`'s scoped animate.
- All 10 casts removed; every cast-site diff is a pure cast/import removal — no logic
  changes, no weakening to `any` (audited).
- `animateValue.spec.ts` genuinely asserts (target-reaching + `@ts-expect-error`
  negatives) — not gamed.

## Scope audit

`git diff 45203c4...65ef75f` touches exactly the in-scope set: `animateValue.ts`
(+spec), `index.ts`, `animate.svelte.ts`, and the 10 cast sites. **No** edit to
`augmentMotionValue.svelte.ts` or `effects.ts` (both correctly out of scope). No
tampering with the plan or guard log.

## The blocker — criterion 4 is a PLAN DEFECT

`pnpm --filter docs check` cannot exit 0: all 10 errors pre-date this plan and live
in out-of-scope files (`shadcn/ui/tabs`, `use-animation-controls`,
`paraglide/server.js`, `vite.config.ts`, `transform-template`'s `TransformTemplate`).
None are in the 5 touched examples (verified 0 each). The wrapper in fact _removed_
5 pre-existing docs errors (15 → 10). The executor correctly did **not** touch
out-of-scope files to force it green — doing so would have been the exact anti-pattern
guard exists to catch. The criterion is a measurement error in the plan, not a gap in
the work.

Guard has **not** amended the criterion: that requires the operator's explicit
agreement (separation of powers). Absent it, the criterion stands and fails, so the
strict gate is NO-PASS.

## Flip condition (NO-PASS → PASS)

Reply **"amend criterion 4"** (agree the plan defect). Guard will then, in one pass:
re-scope criterion 4 to "introduces no _new_ docs-check errors in touched files,"
add a dated `Revision` note to plan 001, re-stamp `Planned at` to HEAD, update the
README, log a `PLAN AMENDED` entry, re-verify, flip this report to **PASS**, and open
the PR via the `pr` skill (merging remains yours).

Alternatively, fixing the pre-existing out-of-scope docs errors would satisfy the
criterion literally — but that is separate work, explicitly outside plan 001's scope.
