# Guard report — 002 motion-dependency-refresh

**Recommendation: PASS** — minimal version alignment; every integration gate independently reproduced green.

**Reviewed at** `61c00d15` · 2026-09-29 19:10 · **Plan planned at** `c48fa24f` (source baseline07a1b1ae; dispatch base4ae4daa3).

No PR opened: dispatch batch close requires a later explicit PR request. No label override applies; the earlier skip-publish message was retracted.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Manifest requires motion ^13.4.6; root version1.5.0 and motion-dom ^13.4.5 unchanged; lock/tree resolve Motion/framer13.4.6, DOM13.4.5 and utils13.3.0. | met | Full three-file diff and independent pnpm list depth3 |
| Frozen install passes without tracked-file mutation. | met | Independent pnpm11.24 frozen install: Already up to date, exit0; source diff unchanged |
| Release note names the actual versions without claiming a Svelte runtime fix. | met | Existing patch changeset says update Motion13.4.6, retain DOM13.4.5 |
| `pnpm build`, `pnpm check`, `pnpm test:only`, and consumer test pass. | met | Independent production webServer build/package/publint; root0errors33warnings;86files/1,029tests; emitted types and Vite6SSR checks passed |
| Docs build/check and the focused browser-smoke command pass. | met | Independent docs build/favicon pass, docs0errors13warnings; Chromium16/16 |
| Scoped `trunk check` and `git diff --check` pass; executor ran scoped `trunk fmt`. | met | Independent Trunk3files/noissues and diff0; executor scoped formatting plus normal commit hooks |
| Only the three scoped files changed relative to dispatch baseline; plan001 remains intact. | met |4ae4daa3→61c00d15 diff exactly manifest/lock/changeset; src/lib/routes/e2e diff empty |
| Conductor records independent evidence and marks README DONE. | met | This report/log and index |

## Spirit

This refresh changes the tested Motion baseline without inventing an adapter fix. The DOM engine stays at13.4.5, the library's release version stays1.5.0, and the new completion-boundary characterization continues to pass. The existing release note accurately distinguishes the dependency versions. No broad dependency, source, API or CI changes were introduced.

## Scope & conduct

- Executor changed exactly the three authorized files and did not edit plans, commit or publish.
- Source snapshot61c00d15 was committed before independent guard verification. Every done-criterion command was reproduced, using the actual package/app build inside Playwright's production webServer for the build gate.
- Environment-only amendment uses pinned JavaScript pnpm11.24 and process-local settings; frozen lock validation is preserved. No tracked toolchain edits.
- Docs build generated a class-order-only registry difference. Guard inspected it and restored only its own generated artifact, leaving all user/conductor changes intact.

## Residual risk / follow-ups

- Existing33root and13docs warnings remain; they are not new errors.
- Focused Chromium coverage was run, not the entire root/browser matrix. No Firefox/WebKit-specific runtime changed in this patch.
- No direct source port of React's concurrent AnimatePresence implementation was warranted; our characterization explicitly uses the supported aggregate clone-exit callback.
- Batch is ready to retire. PR/release/deployment remain unperformed.
