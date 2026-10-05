# Guard log — 001 portable Chromium

## Checkpoint 1 — 2026-10-05 15:30 — VIOLATING

2aa90cec · round 1 snapshot; independent final verification in progress

- Snapshot committed before review using commit skill rules; executor contribution is nine in-scope paths against 768ece5e. Scoped drift from d40a038f contains only that implementation.
- Plan defect surfaced: restoring baseline `environment: 'browser'` through an ignored config probe fails project startup on installed Vitest 4.1.11, with instruction to use `test.browser.enabled`. The executor removed this option before seeking a plan amendment, exceeding the launch-configuration-only restriction. Evidence: docs/vite.config.ts diff and .temp/cloud-session-001/guard/baseline-browser.log.
- Required full docs unit gate fails: seo-title-policy.spec.ts:51 expects 67 detail pages, receives 68. Both 768ece5e and snapshot have 68 tracked detail pages; the policy test is unchanged. Independent run has 12 passing tests and this one failure.
- Independently green: 23 resolver/config tests; 1,137 root tests in 91 files; docs client smoke; external Chromium 149.0.7827.55 probe; publint; root types (zero errors); docs build; docs types (zero errors); root SSR/hydration e2e (two tests); scoped Trunk and diff integrity. Docs e2e still running at this checkpoint.
- Build produced unrelated tracked registry JSON churn in docs/static/r/animated-tabs.json; review confirms regenerated class order/content, excluded from source snapshot and staging. Executor cleanup required.
- Action: operator asked to approve a narrow amendment accepting the obsolete Vitest option removal and allowing only the exact SEO count correction 67 → 68 while preserving all title policy assertions. No approval received yet; plan unchanged. README marked BLOCKED, Plan 002 remains TODO. No PR opened.

## Checkpoint 2 — 2026-10-05 15:33 — VIOLATING

2aa90cec · independent verification complete

- Docs Chromium/Firefox e2e: 12 tests pass, exit 0. All other reproduced gates remain as recorded above.
- Full docs units remain failing on the pre-existing SEO count. Removal of obsolete browser environment remains a pending plan amendment; no operator answer received.
- Action: NO-PASS report written; Plan 002 gated. Executor cleanup will discard only generated registry churn. No source correction or plan amendment performed by guard.

## Checkpoint 3 — 2026-10-05 15:56 — PLAN AMENDED

9eedf490 · operator explicitly approved both corrections

- Accepted the necessary obsolete Vitest setting removal and added only the SEO exact count/message 67 → 68 to scope. All remaining assertions and full docs unit gate preserved; no timeout/watcher repair authorized.
- Prior snapshot gates may be reused for this assertion-only follow-up. Plan re-stamped at 9eedf490; README updated; Plan 002 remains gated.
- Cleanup task restored generated registry churn; independent git status was clean before this amendment.
- Action: amended contract committed before Sonnet round 2 dispatch.

## Checkpoint 4 — 2026-10-05 16:13 — DRIFTING

b2e23dc4 · round 2 correction snapshot and independent verification

- Snapshot committed before review; only approved count/message changed 67 → 68. Other SEO assertions intact. Independent focused SEO: five tests pass; scoped Trunk/diff pass. Normal commit hook root check passed.
- Combined docs units independently fail before assertions: ENOENT scanning docs/static/docs. Sonnet reported three failures reading animate-presence-custom.md. Prior round 1 independent run did not show this race; no claim of baseline reproduction is made.
- Installed docs-kit doc-mirrors.js:242 wipes/rebuilds mirror directory; llms-full.js:110 reads files after listing; watcher handler at :203 regenerates on add/change/unlink. Multiple test project servers share outputs.
- First ignored probe changed inheritance and omitted writer plugins: 13 tests pass. Inheritance-only control passed twice too; those runs do not isolate writer removal. A separate copied config retained self-referential project extension and omitted only docMirrorsPlugin/llmsFullPlugin; 13 tests pass. Absolute imports/probe paths preserve resolution; source untouched. Failed initial copy probe could not resolve docs dependencies; moved probe into ignored docs/node_modules/.cache, then passed.
- Action: NO-PASS remains on required combined docs unit gate; operator asked to allow only Vitest-mode omission of the two writers plus config coverage and production-output checks. No amendment yet; Plan 002 remains gated. Other verified runtime/browser checks reused as expressly approved for the count-only follow-up.

## Checkpoint 5 — 2026-10-05 16:53 — PLAN AMENDED

db7223a7 · operator approved test-mode isolation

- Allow only the two named writers to be omitted when installed Vitest sets VITEST=true, plus actual-config regression coverage and production output checks. Full combined suite remains required; all other plugin/project/production behavior retained.
- Source baseline re-stamped at db7223a7; README updated. Prior failed gate is not waived.
- Action: commit amendment before Sonnet round 3; no guard source edits.
