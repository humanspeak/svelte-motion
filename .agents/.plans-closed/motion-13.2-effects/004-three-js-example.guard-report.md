# Guard report — 004 three-js-example

**Recommendation: PASS** — the Three.js flagship example, demo route, e2e, docs page and example all landed inside scope after one guard amendment (rotation shorthands are degrees); every gate the executor could not run was reproduced green by guard, with the same docs-typecheck caveat as plan 002.
**Reviewed at** 90e17bc · 2026-09-03 13:45 · **Plan planned at** 25036f0 (re-baselined from 47b7149; revision 2 corrected the degrees contract)
**Integrated** — no PR yet: this is the LAST plan of the batch, so the one-branch → one-PR step is now the operator's decision after visual sign-off. Snapshot `90e17bc` on `chore/upstream-motion-13.2.0`, unpushed.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `three` and `@types/three` only under `devDependencies` in root and docs manifests | met | `package.json:196/168`, `docs/package.json:74/50`; not in `dependencies`/`peerDependencies` (guard-installed at `25036f0`) |
| `pnpm exec playwright test e2e/effects --reporter=line` → 5 passed | met | 5 passed in 31.2 s (build + preview on 4198) |
| `/tests/effects/three` linked from `src/routes/+page.svelte` | met | `+page.svelte:312` |
| `docs/src/routes/docs/three-effect/+page.svx` and `docs/src/routes/examples/three-effect/+page.svelte` exist; nav + examples index entries | met | files in snapshot; `three-effect` ×1 in `docsNav.ts` and `examplesIndex.ts` |
| `grep -n "three-effect" docs/src/routes/docs/custom-effects/+page.svx` → match | met | Related link present |
| `pnpm check`, `cd docs && pnpm check`, `cd docs && pnpm build` all clean | partially met | root check 0 errors (pre-commit hook on snapshot); docs build exit 0, `✓ built in 20.84s`; docs check shows only the 5 pre-existing errors recorded in 002's report — none in `three-effect` or `custom-effects` |
| `grep -n "Three.js" README.md` → one table row | met | `README.md:53` |
| No files outside the in-scope list modified | met | `git show --stat 90e17bc`: exactly the 14 in-scope files (736+/4−); `src/lib/three.ts` and `vgpu.ts` diffs are JSDoc text only |
| Status row updated in batch README | met | updated by guard |

Additional: `pnpm test:only` 77 files / 866 tests; `trunk check` on the 14 files `✔ No issues`; Step 2b grep `Math.PI` → no matches in the three corrected files; docs client build emits `three` as a standalone 724 KB (182 KB gzip) chunk referenced by no route node, so the `/examples` index and every other route are unaffected (plan's bundle STOP condition not triggered); regenerated `demo-loaders.ts` / `sitemap-manifest.json` include `three-effect`.

## Spirit

The plan's intent was the visible payoff of Motion 13.2 in Svelte: `animate(mesh, …)` through the registry plus a shader uniform bound with `threeEffect`, with e2e that does not depend on WebGL. Delivered: the demo route dynamically imports `three` in `onMount`, registers `threeEffect`, animates `{ x: 1.5, rotateY: 360 }` with a spring and `progress` with a tween, exposes numeric readouts driven from `frame.update`, wraps `WebGLRenderer` in `try/catch` with a visible fallback, and tears everything down (frame callbacks, effect registration, uniform binding, renderer/geometry/material dispose). The e2e asserts `mesh.rotation.y ≈ 6.28` and `progress === '1.00'` on readouts only. The docs page documents claimed subjects, shorthand keys, the **degrees** contract, uniform binding and `frame.preRender` timing; the example page follows the `arc`/`custom-effects` pattern. Step 2b corrected the three radian-based examples plan 003 shipped. No gap.

## Scope & conduct

- In-scope only? Yes — 14 files, all listed (scope was extended by revision 2 to allow JSDoc-only edits in `src/lib/three.ts` and `src/lib/vgpu.ts`).
- STOP conditions respected? Yes — run 1 stopped at Step 2 on the radians/degrees mismatch (a plan defect; verified by guard against upstream `three.ts:178-179`) instead of improvising; run 2 (fresh thread) completed after the amendment.
- Plan amendments during execution: revision 2 (degrees contract, Step 2b, scope note). Recorded in the guard log with the upstream citation.
- Guard housekeeping: restored the generator-rewritten `docs/static/r/animated-tabs.json` again after the docs build.

## Residual risk / follow-ups

- The advisor's own plans (003, 004) carried the radians mistake; the batch's lesson is that JSDoc/markdown examples are not executed by any gate — worth a doc-snippet typecheck someday.
- Pre-existing docs typecheck errors (5) remain — see 002's report; separate hygiene PR.
- `docs/static/r/animated-tabs.json` is stale versus its generator; regenerate and commit separately.
- `three` 724 KB chunk is loaded only on `/examples/three-effect` and `/docs/three-effect`; keep the dynamic import if the demo is ever refactored.
- Operator visual sign-off of `/tests/effects/three`, `/examples/three-effect`, `/docs/three-effect` (and the 002 pages) precedes the batch PR.
