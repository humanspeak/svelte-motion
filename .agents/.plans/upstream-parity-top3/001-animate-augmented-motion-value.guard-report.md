# Guard close-out report — Plan 001: Re-type `animate` for AugmentedMotionValue

- **Verdict: PASS** — all Done criteria reproduced green; work faithful to intent with zero runtime change.
- **Gate**: `guard parity 1 final` (re-run), 2026-07-08
- **Plan-001 code snapshot**: `65ef75f` (`fix(types): animate() accepts AugmentedMotionValue without casts`) — unchanged since the first final pass.
- **Branch tip at gate**: `5fd3b38` · **Branch**: `fix/animate-augmented-motion-value-typing` · **Plan `Planned at`**: `634983b`
- **PR**: pending base decision (branch is stacked — see "Publication").

## One-line

A clean, faithful, zero-runtime-change fix that kills the
`as unknown as RawMotionValue` papercut at all 10 sites. The one criterion that
failed at the first final pass (docs-check) is now green — the maintainer fixed
the pre-existing unrelated errors rather than us amending the criterion.

## Done criteria (reproduced at branch tip `5fd3b38`)

| #   | Criterion                                             | Result                                                                                      |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | `pnpm check` (root) exit 0                            | ✅ 0 errors (root `src/` byte-identical to 65ef75f: `git diff 65ef75f..HEAD -- src/` empty) |
| 2   | `pnpm test` incl. `animateValue.spec.ts`              | ✅ 3/3 (root unchanged)                                                                     |
| 3   | `grep as unknown as RawMotionValue src/ docs/src` → 0 | ✅ 0                                                                                        |
| 4   | `pnpm --filter docs check` exit 0                     | ✅ **0 errors** (was 10)                                                                    |
| 5   | e2e `e2e/utilities e2e/vanilla-values e2e/motion`     | ✅ 123 passed, 1 skipped, 0 failed (root unchanged)                                         |
| 6   | `git status` clean outside in-scope                   | ✅ scope audit exact                                                                        |
| 7   | Batch README status row updated                       | ✅ 001 → DONE                                                                               |

## Fidelity to intent ("Why this matters")

Zero runtime change, proven: `animateValue.ts:91` is a pure type-level cast
(`animate = animateCore as SvelteMotionAnimate`); `animateValue.spec.ts:23`
asserts `animate === animateCore`; the e2e suite renders the touched routes
identically. Mirrors the `effects.ts` exemplar; value overloads precede the
object-target overload. All 10 casts removed — pure cast/import deletions, no
logic changes, no `any`. Spec genuinely asserts (target-reaching +
`@ts-expect-error`).

## Scope audit

`git diff 45203c4...65ef75f` = in-scope only (`animateValue.ts` +spec, `index.ts`,
`animate.svelte.ts`, 10 cast sites). No edit to `augmentMotionValue.svelte.ts` or
`effects.ts`. No plan/log tampering by the executor.

## Criterion 4 resolution (was the sole blocker)

At the first final pass, `docs check` failed on 10 pre-existing errors unrelated
to plan 001 (a plan defect — criterion over-scoped to the whole repo). Rather than
amend the criterion, the maintainer fixed the underlying errors in separate,
out-of-plan-001-scope commits:

- `7d1e0b2` `build(docs)` — drop paraglide i18n, bump docs-kit → 2026.7.2, switch
  vitest browser provider (clears `paraglide/server.js` ×2 + `vite.config.ts`).
- `5fd3b38` `fix(docs)` — type the loose motion props/callbacks (clears
  `transform-template`, `use-animation-controls`, `shadcn/tabs` ×3).

`pnpm --filter docs check` now exits 0. Criterion 4 passes literally; no plan
amendment was made.

## Publication (operator decision required)

Work is verified and committed. The PR is **not yet opened** because the base is
undecided: `fix/animate-augmented-motion-value-typing` is stacked on the _unmerged_
`feat/ai-gradient-animation-card` feature (`73a8524`) plus the parity-plan commits,
so a PR to `main` would bundle the feature + plans + docs tooling, not just the
animate fix. Guard will open the PR via the `pr` skill on the operator's base call
(`main`, the feature branch once pushed, or as-is) and record the URL here. Merging
remains the operator's.
