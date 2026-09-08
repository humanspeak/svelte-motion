# Guard report — 001 transform-page-point

**NO-PASS / awaiting controls test amendment.** The approved Reorder amendment is complete. Feature runtime matches all 29 strict public React Motion 13.2.0 cases, and the supplementary controls comparison now matches too. Two existing controls assertions conflict with that React behavior and are outside the approved test scope. The full browser gate remains required.

Reviewed source snapshot: `0da2303`, 2026-09-08. Worktree: `/Users/jasonkummerl/Github/svelte-motion-transform-page-point`, branch `feat/motion-config-transform-page-point`. No push, PR, merge or plan closure.

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
| Full browser suite | **Pending**: 450 tests; gate retained | Existing controls tests require the proposed scope amendment before expectations can match React |
| Diff hygiene / scope | Source snapshot clean; scope restored; final artifact hygiene checked before commit | No changes to excluded projection/dependencies/workflows/controls route/tests; original intel edit preserved |

The six docs baseline errors are in unchanged PostHog, keyframes/Wildcard, and transform-template/Default files. They are not feature errors and have not been relabeled as a passing docs check. Generated unrelated animated-tabs class ordering was inspected and restored.

## Remaining decision

See [proposed controls test amendment](proposed-controls-test-amendment.md). Permit only the two failing tests in `e2e/drag/controls.spec.ts` and their necessary helpers:

1. The tiny two-pixel nudge does not start a React drag. It produces only the fractional snap alignment (-0.0078125px,0), conflicting with the existing minimum1px movement requirement. Preserve no-teleport/y checks and add real movement beyond the threshold.
2. React's repeated snap with initial x100/y40 is not position-consistent; it shifts -50/-50 between the two recorded gestures. Assert the matched sequence and preconditions instead of the existing equality assertion. Do not adopt the former mismatching Svelte output.

This is a concrete plan-scope decision, not permission to reduce verification. After approval, dispatch only the amendment, independently verify it, then run controls/gesture regressions and the full browser gate. Any full-suite failure still follows the repository's one-page-at-a-time review policy. In-app browser discovery currently returns no connected browsers; automated Playwright works, but no live in-app visual review is claimed.

## Conduct and evidence

Executor reports are preserved verbatim, including all three corrective reports and the Reorder report. Source snapshots were committed through the commit skill with hooks intact before guard review. Guard authored only plans/evidence/reports, ran checks and restored its own generated artifact churn. The feature branch has no upstream target; the original worktree's `.competitive-intel/state.json` edit remains intact. Earlier reports and failed traces remain in Git and the append-only guard log.

**What flips this to PASS:** approve and implement the narrowly scoped controls test correction, then complete every remaining browser/final gate without weakening assertions or expanding runtime scope. No implementation executor remains running at this review handoff.
