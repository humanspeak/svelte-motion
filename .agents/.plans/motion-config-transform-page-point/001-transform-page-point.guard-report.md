# Guard report — 001 transform-page-point

**NO-PASS — user-requested repeated-start RED reproduced; runtime direction under review.** The two other controls tests pass. Repeated identical drags drift in both Svelte and public React Motion13.2.0. No runtime fix or upstream submission has been made.

Latest test snapshot:`6c6781b`; production snapshot:`0da2303`. Worktree:`/Users/jasonkummerl/Github/svelte-motion-transform-page-point`. Branch:`feat/motion-config-transform-page-point`.

## Current red-first gate

Guard independently ran the controls file:2passed,1failed in6.2s. The regression asserts each snap centers at the pointer and repeated real drags finish consistently within2px; second snap misses by50px. Positions after three identical drags:(750,427),(800,377),(850,327). Test captures all positions and preserves real lifecycle assertions. The first and tiny-nudge tests and shared helpers are byte-identical todf11fcc.

See controls-red-first-guard.log and controls-repeat-red-input-probe.json. The matching public React probe uses the same three inputs, verifies each button hit, and produces exactly identical boxes. Source has not changed since the previously verified runtime below. The previous acceptance of repeated drift is superseded by the user's red-first bug report.

## Verified changes

- Inherited `MotionConfig.transformPagePoint`, public types, gesture input capture, live measurement config, corrected callbacks/velocity, constraints, snap, scroll and layout behavior follow the pinned public React reference.
- Ordinary pan and drag use the existing local pan implementation with their distinct upstream scroll/lifetime behavior. No private imports, vendoring, patched exports, new dependencies or production projection changes.
- Parent callback replacements reach the normal VisualElement commit path. Matched Svelte fixtures explicitly replace public callback references when the corresponding React parent render does; the artificial fixture attribute was removed.
- Controlled snap no longer counts authored initial coordinates twice. Svelte and React start at the same (700,477) box and produce active (650,427), then (600,377), for the same repeated inputs.
- The five approved Reorder gesture tests retain their original numerical, axis, keyed-layout and callback assertions while using valid pointer metadata and controlled Motion frame sampling. All 14 Reorder tests pass in the full suite.
- The round2 out-of-scope component-test addition was removed. That file exactly matches its original version; coverage now resides in the approved config test/harness and verifies handler replacement during the same active session. The lock-contention regression now samples a move beyond the threshold before asserting the second drag is blocked.

## Guard verification

Commands use pinned pnpm11.24.0 through `npm exec --yes --package=pnpm@11.24.0 -- pnpm`.

| Gate | Result | Evidence |
| --- | --- | --- |
| Strict public React/Svelte matrix | **29/29 exact matches**, zero mismatches | `svelte-parity-fix3-summary.json`; full raw result `/tmp/svelte-motion-react-parity-1320/svelte-parity-fix3-guard.json` |
| Supplementary controls reference | **Matches**, with geometry and raw pointer preconditions verified | `react-controls-reference-fixed.json`, `react-controls-tiny-raw-guard.json`, `svelte-controls-fix3-guard.json` |
| Full unit suite, `pnpm test:only` | **906/906 pass**, 82 files | `/tmp/transform-page-point-round3-full-units.log` |
| New feature browser files | **15/15 pass** on a fresh build | `/tmp/transform-page-point-round3-targeted.log` |
| Root check | **0 errors / 39 existing warnings**, independently reproduced; source commit hook also passes | `/tmp/transform-page-point-round3-root-check.log`, `/tmp/transform-page-point-round3-snapshot-commit.log` |
| App build, package, publint | **Pass** during fresh browser-server startup | `/tmp/transform-page-point-round3-targeted.log` |
| Docs production build | **Pass**, including 252 generated social images and Cloudflare adapter output | `/tmp/transform-page-point-round3-docs-build.log` |
| Docs metadata coverage | **5/5 pass** | `/tmp/transform-page-point-round3-seo.log` |
| Docs typecheck | Same **6 baseline errors / 13 warnings**; exact error file/location/diagnostic comparison unchanged | `/tmp/transform-page-point-round3-docs-check.log`, earlier baseline comparison in `resume-environment.md` |
| Trunk formatting / lint | **Pass / no new issues**; one existing lint issue | `/tmp/transform-page-point-round3-trunk-fmt.log`, `/tmp/transform-page-point-round3-trunk-check.log` |
| Full browser suite | **Pending**: 450 tests; gate retained | Repeated-start regression now deliberately RED; full gate remains required after the chosen correction |
| Diff hygiene / scope | Source snapshot clean; scope restored; final artifact hygiene checked before commit | No changes to excluded projection/dependencies/workflows/controls route; approved controls test edits captured separately; original intel edit preserved |

The six docs baseline errors are in unchanged PostHog, keyframes/Wildcard, and transform-template/Default files. They are not feature errors and have not been relabeled as a passing docs check. Generated unrelated animated-tabs class ordering was inspected and restored.


## Remaining work

Resolve the intended bug correction against the earlier exact-React-parity instruction; the user is discussing offering the correction upstream. CONTRIBUTING welcomes bug fixes but GitHub currently shows issue/PR-creation restrictions. A local draft exists in upstream-report-draft.md; nothing has been submitted. RelatedPR3445 addresses the first snap, while this report reproduces repeated drift. No historical bisect has been performed.

After the runtime direction is settled, route source changes through an executor and verify RED-to-GREEN, remaining parity cases, appropriate unit/build/docs gates, and the full browser suite. Full-suite failures require one-page-at-a-time T3 review with the user. The public scaled-board walkthrough remains requested for completion. T3 browser is available; the controls test page is currently open. Earlier Codex iab unavailability is not a current browser blocker.

No plan closure, push, PR or merge. Guard owns only evidence/plans/commits; executor owns source. Historical passing gates above apply to unchanged production0da2303, not to a completed overall feature gate.
