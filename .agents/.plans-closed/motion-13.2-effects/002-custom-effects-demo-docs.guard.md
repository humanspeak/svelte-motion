# Guard log — 002 custom-effects-demo-docs

Plan: `.agents/.plans/motion-13.2-effects/002-custom-effects-demo-docs.md`
Executor: Codex (fresh thread, `codex-dispatch-002.txt`), dispatched 2026-09-03 10:18 at branch tip `7f083a7`.

## Checkpoint 1 — 2026-09-03 13:00 — ON TRACK (final)

`c46aee4` · single-run completion; guard snapshot then full local verification of the gates the sandbox could not run.

- Executor report: all six steps completed, no STOP hit; blocked locally on `trunk fmt` cache, docs build (`tsx` IPC `listen EPERM`), docs check (generated loader stale), and every browser gate. Relayed verbatim to the operator.
- Snapshot: 14 executor files (704 insertions, 0 deletions) committed as `72b2a31`; then amended to `c46aee4` at the operator's mid-run instruction to include `.competitive-intel/state.json` (the 2026-09-03 nightly intel run that re-validated comparison claims against 13.2.0). The amendment is operator content, not executor scope; the executor's diff is unchanged.
- Reproduced by guard:
  - `pnpm check` (pre-commit hook on the snapshot) → 0 errors.
  - `pnpm test:only` → 75 files / 862 tests. A first run that overlapped a concurrent `pnpm build` reported 73/833; rerun in isolation was 862/862 — `.svelte-kit` churn from the build, not a test defect.
  - `pnpm build` → publint `All good!`; `cd docs && pnpm build` → exit 0, regenerated the gitignored `demo-loaders.ts` (custom-effects loader present) and `sitemap-manifest.json` (`/docs/custom-effects`, `/examples/custom-effects` dated 2026-09-03) — the example card will appear on `/examples`.
  - `pnpm exec playwright test e2e/effects e2e/vanilla-values` (build + preview on 4198, port was free) → 7 passed in 37 s.
  - `trunk check --no-progress` on the 14 files → `✔ No issues`.
  - Done-criteria greps: `custom-effects` ×1 in `docsNav.ts` and `examplesIndex.ts`; `Custom effects` row in `README.md:52`; link at `src/routes/+page.svelte:304`.
  - `cd docs && pnpm check` → **5 errors, all pre-existing**: `examples/keyframes/demos/Wildcard.svelte:36` and `examples/transform-template/demos/Default.svelte:14,19`. Both files are byte-identical to `main` (`git diff --stat main -- …` empty) and untouched on this branch. No new errors from this plan.
- Generator churn: the docs build rewrote `docs/static/r/animated-tabs.json` (Tailwind class order inside a registry blob). Unrelated to the plan; guard restored it with `git checkout --`. Worth a separate hygiene commit some day — the committed blob no longer matches its generator's output.
- Read the whole diff: demo route registers/unregisters the effect and cancels the keep-alive draw in `onMount` cleanup; e2e asserts numeric readouts (270, 0, 100) not pixels; docs page covers `test`/`read`/`step`, registration order, `.get()`; two `dialEffect` copies identical except import source, as the plan required. Executor's docs-page footer attribution and SEO block match the `arc` exemplar.
- Verdict: **PASS** with one caveat (docs typecheck criterion unmet only by pre-existing errors outside scope) — see the guard report. No PR (one branch → one PR at batch end).
- Action: README row → DONE; plan 003's conditional docs step made unconditional now that `/docs/custom-effects` exists.
