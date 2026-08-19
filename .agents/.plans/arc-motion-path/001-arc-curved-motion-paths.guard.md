# Guard log — 001 arc-curved-motion-paths

## Checkpoint 1 — 2026-08-19 05:30 — PLAN AMENDED

`744d772` · executor round 1 (Codex, fresh thread) stopped on a STOP condition; guard triage.

- Executor report: `src/lib/index.ts` failed typecheck twice — motion-dom's `MotionPath` **type** collides with the package's pre-existing `MotionPath` **component** export (`export { default as MotionPath } from '$lib/html/Path.svelte'`). Second attempt (`import type … as MotionPathDefinition` + `export type MotionPath = …`) → `src/lib/index.ts:290:10 Export declaration conflicts with exported declaration of 'MotionPath'`. Correctly halted per "verification fails twice".
- Classification: **plan defect** (advisor missed the existing component export). Amended with operator-authorised dispatch flow: export the type as `MotionPathDefinition`.
- Second plan defect surfaced: `docs/src/lib/demo-loaders.ts`, `demo-manifest.json`, `sitemap-manifest.json` are gitignored (`docs/.gitignore:36-40`); plan's "commit the regenerated files" + `git status` verify were void. Amended.
- Environment fact: corepack `pnpm` fails in the Codex sandbox (`@pnpm/exe` identity check); `./node_modules/.bin/*` equivalents work. Noted in revision.
- Executor litter: untracked `.pnpm-store/` (pnpm cache from the failed launcher) — removed by guard; not source.
- Pre-commit hook (trunk) on the plan-amendment commit surfaced one lint issue in executor output: `docs/src/lib/examples/arc/demos/Default.svelte:47:13 eslint/svelte/require-each-key`. Folded into fix-dispatch 1.
- Action: plan amended (`> Revision 2026-08-19` block, re-stamped at `1ba2838`), committed `744d772` (`--no-verify`, plan path is trunk-ignored; hook failure was the executor's uncommitted file). Fix-dispatch 1 sent to Codex.

## Checkpoint 2 — 2026-08-19 05:47 — ON TRACK

working tree (pre-snapshot) · after fix-dispatch 1 (Codex, fresh thread).

- Executor report: only `src/lib/index.ts` and `docs/src/lib/examples/arc/demos/Default.svelte` touched; `svelte-check` → `0 ERRORS 39 WARNINGS`; `vitest` index.spec + `_MotionContainer.arc.spec` → 16/16; `trunk fmt` clean.
- Action: proceed to `final` — snapshot + full reproduction.

## Checkpoint 3 — 2026-08-19 05:53 — ON TRACK (final pass, verification)

`d91057f` · executor snapshot committed via `commit` skill (hooks: format/lint/svelte-check green); every done criterion reproduced by guard.

- Scope: `git diff --name-only 744d772..d91057f` → 22 files, all in the plan's in-scope list; none of the out-of-scope files (`_MotionContainer.svelte`, `motionDomProjection.ts`, `visualElementCore.ts`, `animation.ts`, `types.ts`, `package.json`, `.competitive-intel/**`) touched.
- Drift check: `git diff --stat 526f503..744d772 -- <in-scope source paths>` → empty (no source drift between plan baseline and execution).
- `grep -n "export { arc } from 'motion-dom'" src/lib/index.ts` → `80:…` ✔
- `pnpm check` → `COMPLETED 1325 FILES 0 ERRORS 39 WARNINGS` ✔
- `pnpm test` → `Test Files 72 passed (72)`, `Tests 830 passed (830)` ✔ (includes 3 new arc spec tests + 1 index.spec test)
- `pnpm build` → svelte-package + publint `All good!`; `grep -c arc dist/index.js` → 3; `dist/index.d.ts:24-25` carries `arc` + `MotionPath as MotionPathDefinition` ✔
- `trunk check` → `Checked 26 modified files ✔ No issues` ✔
- `pnpm playwright test e2e/motion/arc-keyframes.spec.ts e2e/layout/arc-layout.spec.ts` → `5 passed (43.2s)` ✔ (port 4198 was free; Playwright brought up its own preview)
- Docs: `cd docs && pnpm check` → 5 errors, all pre-existing and unrelated (`keyframes/demos/Wildcard.svelte`, `transform-template/demos/Default.svelte`); none mention arc ✔. Files exist: `docs/arc/+page.svx`, `examples/arc/+page.svelte`, 3 demos ✔. `grep -c "/docs/arc" docsNav.ts` → 1 ✔; `examplesIndex.ts` has `arc: {…}` entry (unquoted key after prettier — the plan's literal `'arc'` grep is an artifact, entry present) ✔; `grep -c "arc/demos" demo-loaders.ts` → 3 ✔; sitemap-manifest has `/docs/arc` + `/examples/arc` ✔.
- `grep -c "Curved motion paths" compare-data.ts` → 3 ✔; README bullet present ✔; `.changeset/curved-arc-paths.md` present ✔; homepage links at `src/routes/+page.svelte:107,662` ✔.
- Assertions read, not just run: unit spec asserts mid-flight `|y|>30`, `translateY(`/`rotate(` in the inline transform, numeric `pathRotation`, exact settle `translateX(200px)` / `translateX(200px) rotate(45deg)`; e2e asserts geometric bulge (`|ty|>30` at `60<tx<140`), cw/ccw opposite sign, matrix `b`/`c` rotation only with `rotate:true`, identity settle on layout/layoutId. Not gameable by a straight-line implementation.
- Nit (drift, cosmetic, user-facing): `.changeset/curved-arc-paths.md` names the type `MotionPath`; it ships as `MotionPathDefinition`. Routed as fix-dispatch 2 (Codex) — guard does not edit source.
- Action: fix-dispatch 2 sent; final snapshot + report after it lands.

## Checkpoint 4 — 2026-08-19 05:54 — ON TRACK (final close-out)

`7498c80` · fix-dispatch 2 (changeset wording → `MotionPathDefinition`) snapshot-committed; close-out report written.

- Verdict: **PASS** — see `001-arc-curved-motion-paths.guard-report.md`.
- PR intentionally not opened: operator's standing sign-off-before-PR instruction. Branch `feat/arc` unpushed; demo URLs in the report.
- Action: batch README status → DONE (guard-maintained); reported to operator.
