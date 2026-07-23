# Guard report — 001 standardize SEO titles

**Recommendation: PASS** — the title policy is implemented across the complete inventory and every amended verification gate is reproduced.
**Reviewed at** `b5cf316` · 2026-07-10 09:16 · **Plan planned at** `46bea77`
**Integrated** — PR <https://github.com/humanspeak/svelte-motion/pull/445> opened via the `pr` skill for the reviewed source snapshot.

## Done criteria

| Criterion                                                                                                                                                      | Result | Evidence                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homepage title is exactly `Svelte Motion — Framer Motion API for Svelte 5` (46 characters).                                                                    | met    | Source audit and production-preview browser read returned the exact value.                                                                                                             |
| `/svelte-animations` title is exactly `Svelte 5 Animation Patterns \| Svelte Motion` (43 characters).                                                          | met    | Source audit and production-preview browser read returned the exact value.                                                                                                             |
| Every example detail title ends in `\| Svelte Motion`, preceded by one space.                                                                                  | met    | Audit found 60 details and zero suffix violations.                                                                                                                                     |
| No example detail title contains `\| Examples \|`.                                                                                                             | met    | Audit found zero legacy category segments.                                                                                                                                             |
| `/examples` remains `Examples \| Svelte Motion`.                                                                                                               | met    | Source audit returned the exact index value.                                                                                                                                           |
| Every extracted literal `seo.title` is at most 60 characters and unique.                                                                                       | met    | Audit found zero over-budget or duplicate titles; assertions at `docs/src/lib/seo-title-policy.spec.ts:43-100` independently enforce discovery, budget, suffix, index, and uniqueness. |
| `pnpm --filter docs exec vitest run --project server` passes (current inventory: 2 files and 6 tests).                                                         | met    | Exit 0; 2 files and 6/6 tests passed.                                                                                                                                                  |
| `pnpm --filter docs check` introduces no diagnostics beyond the documented baseline of 1 unchanged PostHog environment typing error and 10 unchanged warnings. | met    | Post-build retry reproduced exactly 1 error/10 warnings; all diagnosed files are unchanged between `31225de` and `b5cf316`.                                                            |
| `pnpm --filter docs build` exits 0 and example mirror generation succeeds.                                                                                     | met    | Exit 0; registry, 226 social images, doc/example/LLM mirrors, client/server bundles, and Cloudflare adapter completed.                                                                 |
| `trunk check` and `git diff --check` exit 0.                                                                                                                   | met    | Both commands exited 0; the `b5cf316` snapshot hook also formatted and linted staged source without leaving changes.                                                                   |
| No product files outside the Scope list are modified.                                                                                                          | met    | Full `c89a3d5...HEAD` audit contains only the policy test, 61 planned route files, and guard-owned plan/index/log artifacts.                                                           |
| `.agents/.plans/seo-title-policy/README.md` status is updated.                                                                                                 | met    | Plan 001 status is DONE.                                                                                                                                                               |

## Spirit

The diff fixes the underlying inconsistent policy, not merely the reported warnings. All 60 example details now share one predictable brand suffix, the five long titles use the approved descriptive rewrites, the 56 mechanical migrations preserve their subjects, and the regression test prevents silent inventory or policy drift. Production-preview browser reads also match the six required live titles exactly.

## Scope & conduct

- In-scope only? Yes for final source: one policy test and the 61 planned title-only route edits. Plan, index, log, and report changes are guard-owned.
- STOP conditions respected? Yes. Execution stopped on both baseline-broken gates; guard resumed only after the operator approved narrow amendments. Checkpoint 2 preserves the wrong-worktree violation; primary was fully restored and no accidental commit remains.
- Plan amendments during execution: 2026-07-10 — replaced the baseline-invalid Vitest command with complete server-project coverage; 2026-07-10 — converted docs check to a non-regression gate against its proven unchanged 1-error/10-warning baseline.

## Residual risk / follow-ups

- Repair the baseline docs typecheck: one PostHog environment typing error and ten warnings remain in files untouched by this title-only change.
- Repair the invalid empty Vitest client project; no current client tests are waived, but the project should be valid before client tests are added.
- Request a fresh Ahrefs crawl after deployment and monitor Search Console title-link rewrites and click-through changes without inferring a ranking gain from this edit alone.
