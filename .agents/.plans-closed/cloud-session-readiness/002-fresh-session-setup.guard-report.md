# Guard report — 002 fresh-session setup

**Recommendation: PASS** — reproducible contributor instructions and exactly four scoped Claude fetch rules shipped; independent configuration, units, types and lint checks pass.

**Reviewed at** 1d9828c6 · 2026-10-05 17:33 · **Plan planned at** 15f93ed7

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| CONTRIBUTING.md contains versioned setup, standard browser install, fallback precedence/limits, exact verification commands/order, Trunk authority and cloud settings boundaries. | met | Full diff/manual command reconciliation with root/docs/consumer manifests, workspace, configs/helper and CI. Node24.18.0/pnpm12.6.0/TrunkCLI1.25.0, frozen setup, ordered checks and cloud limits present; corrected wording matches sources. |
| README and CLAUDE link to guide without losing existing consumer/instruction content. | met | Independent previous-line-order audit at final snapshot passes both files; short additions only. |
| Shared JSON parses and its contract tests pass with exactly four scoped fetch rules. | met | Actual JSON equals explicit four-rule permissions.allow object; independent Node24 five tests pass. |
| Shared settings not ignored; local settings explicitly ignored; no personal secrets/config copied. | met | Ignore exit1/nooutput for shared; exit0/path for local. Explicit shared-file staging/read only; no personal contents accessed. |
| Settings tests, full root units, root check, scoped Trunk and diff integrity pass. | met | Independent Node24.18.0:5focused,93files/1147root tests,rootcheck0errors33existingwarnings. Six-file Trunk/diff pass; final prose-only two-file Trunk/diff pass. |
| Browser fallback documentation refers to reviewed Plan001 behavior; cloud/platform verification limits are stated. | met | Guide reconciled with helper/configs and predecessor PASS7cdf6076; actual Claude cloud/fresh disposable image explicitly untested. |
| No dependency/runtime/out-of-scope edits; index status/evidence updated. | met | Exactly six implementation paths; empty manifest/lock diff, no runtime changes, independent clean tree before artifacts. README002DONE. |

## Spirit

A fresh session can find exact tool versions, install prerequisites and the correct verification order. Claude fetch configuration is a bounded shared project file with executable contract tests, while other providers can follow the same setup guide. The guide accurately explains applicability and does not claim that configuration or a local browser probe proves cloud execution.

## Scope & conduct

- Initial six-path source snapshot7ae63ac1, final prose correction snapshot1d9828c6. Source corrections came through selectedSonnet; guard wrote only plans/review artifacts and committed snapshots.
- Three wording findings corrected: repo TrunkCLIpin, approval versus network effects, and visible missingTrunk hook warning. No plan amendment required; changes stayed inside existing prose scope.
- Previous README/CLAUDE content, exact shared rules and all test assertions preserved. No dependencies, runtime, hooks, CI, MCP, Bash grants, bypass mode, credentials or publishing added.
- No STOP condition unresolved, no PR opened, no push. Batch remains local until separately requested.

## Verification and reuse

Independent logs: `.temp/cloud-session-002/guard/`. New tests/full root/check/scopedTrunk/JSON/ignore/diff were actually executed under pinnedNode24. Extra independent Vite6consumer command exited0, reporting publishedReorder type checks, tree-shaking and SSR regression checks passed.

Prior Plan001's independently reproduced package/publint, docs build/check/units/e2e, root SSR/hydration and externalChromium probe reused exactly as Step4 permits for unchanged runtime/configs. Executor also ran rootbuild/publint, but no independent rootbuild claim is made for this prose/config-only plan; its command/order is reconciled with scripts/CI. Final prose-only follow-up did not rerun unchanged unit/type/browser gates.

Primary Claude descriptions were independently checked against official settings-in-cloud-sessions and WebFetch docs and linked in CONTRIBUTING.md. No actual cloud session, fresh disposable clone, full root e2e suite or live fetch smoke was performed for this plan.

## Residual limits

- Actual Claude cloud-host policies/fetch behavior and arbitrary external Chromium remain host-dependent; this is local readiness evidence.
- Plan001 records an existing PostHog first-import timeout during concurrentbuild; quiet full docs suite passed afterward. This plan does not alter that harness.
- Contributor commands deliberately keep current Motion14.0.0 pins. Runtime14.0.1 parity remains separate.
