# Guard report — 001 effect-registry-public-api

**Recommendation: PASS** — every done criterion reproduced green by guard on the snapshot; the diff delivers the plan's intent inside scope, after one guard-approved plan amendment (generic signature instead of `AnimateEffect<any>`).
**Reviewed at** 7d09c0d · 2026-09-03 10:15 · **Plan planned at** 82c6971 (revised from 47b7149 at checkpoint 1)
**Integrated** — no PR: batch convention is one branch → one PR when the last plan passes. Snapshot commit `7d09c0d` sits on `chore/upstream-motion-13.2.0`, unpushed.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `pnpm check` exits with `0 ERRORS` | met | `COMPLETED 1337 FILES 0 ERRORS 39 WARNINGS` (warnings pre-existing) |
| `pnpm test:only` exits 0; `index.spec.ts` and `animateValue.spec.ts` contain the new tests and they pass | met | `Test Files 75 passed`, `Tests 862 passed` (857 before this plan); `index.spec.ts (16 tests)`, `animateValue.spec.ts (5 tests)` |
| `grep -n "addEffect" src/lib/utils/animateValue.ts` shows the interface member | met | `70:    addEffect<Subject extends object>(effect: AnimateEffect<Subject>): void` |
| `grep -n "MotionValueState, createEffect" src/lib/index.ts` returns a match | met | `51:export { MotionValueState, createEffect } from 'motion'` |
| `expect(animate).toBe(animateCore)` still passes (no wrapper introduced) | met | test present at `animateValue.spec.ts:21-23`, suite green; `export const animate = animateCore as SvelteMotionAnimate` unchanged |
| `pnpm package` prints `All good!` | met | publint `All good!` (pre-existing `reorder.ts` d.ts warning unchanged) |
| `.changeset/effect-registry-api.md` exists with `minor` | met | file present, front matter `'@humanspeak/svelte-motion': minor` |
| No files outside the in-scope list are modified | met | `git show --stat 7d09c0d`: exactly the six in-scope files (118+/7−) |
| Status row updated in batch README | met | updated by guard (executor's `.agents/**` is read-only) |

Additional: `trunk check --no-progress` on the five changed source files → `✔ No issues`; the pre-commit hook (trunk fmt, trunk check --fix, svelte-check) passed on the snapshot commit.

## Spirit

The plan's "Why this matters" named three gaps: `animate.addEffect`/`removeEffect` erased by the re-type, `createEffect`/`MotionValueState`/effect types not re-exported, and `propEffect` losing `.get()`. All three are closed in the snapshot: the interface gains the two statics (`animateValue.ts:65-72`) while `animate` remains a pure cast; the barrel re-exports the two values from `motion` and eight types from `motion-dom` (`index.ts:49-61`); `propEffect` is re-typed as `typeof propEffectCore & (widened signature)` (`effects.ts:67-68`). The runtime test drives a registry-claimed plain object to `x === 100` through `animate()` and confirms the unclaimed-object fallback, which is the behaviour a consumer registering `threeEffect` relies on. The compile-only block exercises `addEffect`/`removeEffect` and the widened `ObjectTarget` so a future `motion` bump that regresses either fails `pnpm check`. No gap.

## Scope & conduct

- In-scope only? Yes for the snapshot. During run 1 the executor's `trunk fmt` reformatted `.competitive-intel/config.json` (whitespace only); the executor flagged it as unintended, guard classified it as tool litter and restored it before snapshotting.
- STOP conditions respected? Yes — run 1 stopped at Step 6 exactly as the plan's STOP list directed when lint rejected `AnimateEffect<any>`; it did not improvise a disable comment.
- Plan amendments during execution: 2026-09-03 (checkpoint 1) — Step 2 changed from `AnimateEffect<any>` to generic `addEffect<Subject extends object>(…)` because the repo's eslint enforces `no-explicit-any` at error level with no disable precedent (an environment fact the run disproved); done-criteria grep reordered to `MotionValueState, createEffect` to match trunk's export sorting; `Planned at` re-stamped `47b7149` → `82c6971`. Rationale recorded in the guard log; the fix was executed by Codex in a second, surgical dispatch touching only the two signatures.

## Residual risk / follow-ups

- `SvelteMotionAnimate` is a hand-mirrored copy of upstream's `animate` shape; future `motion` bumps must diff `packages/framer-motion/src/animation/animate/index.ts` against it (the file header says so).
- The generic signature is slightly stricter than upstream's `any` form: an `AnimateEffect<T>` still infers, but a value typed as bare `AnimateEffect` (default `object`) also works because `object` satisfies the constraint. No consumer-facing narrowing observed.
- Pre-existing, unrelated: `dist/reorder.d.ts` is still not emitted (`$$IsomorphicComponent` cannot be named). Not introduced here; tracked in the batch README's rejected/known list.
- Plans 002 and 003 depend on this snapshot; guard re-baselined 003's drift SHA and 002's precondition grep at close-out.
