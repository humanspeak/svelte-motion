# Guard report — 001 arc-curved-motion-paths

**Recommendation: PASS** — `arc()` is exported, the runtime integration is pinned by unit + e2e tests that assert real curve geometry, docs/demos/compare rows ship; every done criterion reproduced green by guard.
**Reviewed at** `7498c80` (executor work `d91057f` + changeset wording `7498c80`) · 2026-08-19 05:54 · **Plan planned at** `526f503`, revised at `1ba2838` → `744d772`
**Integrated** — **PR deliberately NOT opened.** Standing operator instruction (memory `feedback-signoff-before-pr`): the operator drives the live demo in their own browser and gives explicit sign-off before any push / PR. The reviewed snapshot sits on `feat/arc`, unpushed. Demo URLs to drive are listed under "Residual risk / follow-ups".

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `grep -n "export { arc } from 'motion-dom'" src/lib/index.ts` → 1 match | met | `src/lib/index.ts:80` |
| `pnpm check` exits 0 | met | `COMPLETED 1325 FILES 0 ERRORS 39 WARNINGS` (warnings pre-existing) |
| `pnpm test` exits 0; `_MotionContainer.arc.spec.ts` 3 passing; `index.spec.ts` has the `arc` test | met | `Test Files 72 passed (72) · Tests 830 passed (830)`; spec asserts mid-flight `|y|>30`, `translateY(`+`rotate(` in transform, numeric `pathRotation`, exact settle strings; `index.spec.ts:140-145` |
| `pnpm build` exits 0 and `grep -c "arc" dist/index.js` ≥ 1 | met | publint `All good!`; grep → 3; `dist/index.d.ts:24-25` exports `arc` + `MotionPath as MotionPathDefinition` |
| `pnpm playwright test e2e/motion/arc-keyframes.spec.ts e2e/layout/arc-layout.spec.ts` exits 0 | met | `5 passed (43.2s)` — bulge/settle, cw↔ccw sign flip, rotate on/off via matrix `b`/`c`, layout + layoutId curved FLIP |
| `trunk check` exits 0 | met | `Checked 26 modified files ✔ No issues` |
| docs files exist (docs page, example page, 3 demos) | met | `ls` → all five present |
| `grep -c "/docs/arc" docsNav.ts` ≥ 1; `examplesIndex.ts` has arc entry | met | docsNav → 1 (`{ title: 'arc()', href: '/docs/arc', icon: Spline }`); examplesIndex `arc: { title: 'arc()', … }` (unquoted key — prettier; the plan's literal `'arc'` grep was an artifact) |
| `grep -c "arc/demos" docs/src/lib/demo-loaders.ts` ≥ 3 | met | → 3 (file is gitignored/regenerated; verified locally after `cd docs && pnpm check`) |
| `grep -c "Curved motion paths" docs/src/lib/compare-data.ts` = 3 | met | → 3 (framer-motion, motion, gsap rows) |
| new changeset present | met | `.changeset/curved-arc-paths.md` (minor) — wording corrected to `MotionPathDefinition` in `7498c80` |
| `src/routes/+page.svelte` links to `/tests/arc/keyframes` and `/tests/arc/layout` | met | lines 107, 662 |
| No files outside the in-scope list modified | met | `git diff --name-only 744d772..7498c80` → 22 files, all in scope; out-of-scope runtime files untouched |
| batch `README.md` status row updated | met | updated by guard (executor's sandbox cannot write `.agents/**`) |

Additional (plan "Verify" lines, not in the checklist): `cd docs && pnpm check` → 5 errors, all pre-existing and unrelated (`keyframes/demos/Wildcard.svelte`, `transform-template/demos/Default.svelte`); zero mention arc. Drift check `git diff --stat 526f503..744d772 -- <in-scope source>` → empty.

## Spirit

The plan's intent was to close the one visibly demo-able parity gap a Svelte rival holds, *without* re-porting runtime the installed `motion-dom@13.0.0` already provides. The diff does exactly that: the export surface (`arc`, `ArcOptions`, `MotionPathDefinition`, `PathInterpolator`, `PathState`, `Point2D`) from `motion-dom`, no runtime files touched, and — the part that matters for durability — tests that would fail on a straight-line implementation (geometric bulge thresholds, opposite-sign cw/ccw, rotation only when requested, exact settle with `pathRotation` cleared and user `rotate` preserved). The docs page carries the upstream semantics faithfully (option defaults, 20px layout floor, additive rotation, "reuse the instance — don't call `arc()` inline in the template"), and the test routes/demos follow that guidance themselves (`$derived` path keyed on option state; `const path = arc()` in script). Compare rows make the capability visible on the three `/compare` pages. No gap between checklist and intent.

## Scope & conduct

- In-scope only? **Yes** — 22 files, all enumerated in the plan's in-scope list; none of the out-of-scope files (`_MotionContainer.svelte`, `motionDomProjection.ts`, `visualElementCore.ts`, `animation.ts`, `types.ts`, `package.json`, `.competitive-intel/**`) changed.
- STOP conditions respected? **Yes** — round 1 halted correctly on "verification fails twice" (the `MotionPath` name collision) and reported rather than improvising; no other STOP triggered.
- Plan amendments during execution: **one**, 2026-08-19 (`744d772`): (1) export the type as `MotionPathDefinition` (plan defect — advisor missed the existing `MotionPath` component export); (2) the docs loader/manifest files are gitignored, so the "commit regenerated files" instruction was void; (3) note that corepack `pnpm` is unavailable in the Codex sandbox. None lowered the bar; all corrected facts about reality.
- Executor rounds: 1 (STOP) → fix-dispatch 1 (alias + `{#each}` key lint) → fix-dispatch 2 (changeset wording). All Codex, fresh threads, no commits by the executor. Litter `.pnpm-store/` removed by guard.

## Residual risk / follow-ups

- **Operator sign-off pending before push/PR.** Drive these in your browser (dev server serves `src/` live; docs need `pnpm build` first, already done for this review):
  - `http://localhost:4198/tests/arc/keyframes` — toggle, try Strength 1, CW/CCW, Rotate on
  - `http://localhost:4198/tests/arc/layout` — toggle; both the `layout` box and the `layoutId` bubble should curve
  - docs dev: `/docs/arc`, `/examples/arc` (Default / Rotate / Layout demos)
- e2e sampling is timing-based (16ms polls over ~1.1s). If CI flakes, widen the window before loosening the geometric thresholds.
- The strict final-transform assertions in `_MotionContainer.arc.spec.ts` are the tripwire for a future `motion-dom` bump changing `pathRotation` composition — intended.
- Deferred (outside this plan): stale README "Known gaps vs Framer Motion" section; `MotionConfig skipAnimations` prop (intel gap #2); moving `arc()` to `closed_gaps` in `.competitive-intel/state.json` (nightly digest owns it).
