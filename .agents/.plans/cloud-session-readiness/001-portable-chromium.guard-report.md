# Guard report — 001 portable Chromium

**Recommendation: NO-PASS** — required full docs unit gate fails; accepting an obsolete browser-setting removal and fixing a baseline assertion requires a narrow plan amendment.

**Reviewed at** 2aa90cec · 2026-10-05 15:33 · **Plan planned at** d40a038f

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Named launch-options regression failed before config changes and passes afterward. | met | Executor historical red.log records undefined launchOptions assertion; independent focused.log: 23 pass. |
| Resolver branch/platform tests pass, and both Playwright configs use the shared helper. | met | 23 focused tests pass; complete diff read of both configs and helper. |
| Docs client project discovers/passes its browser smoke; configured provider uses helper output. | met | Independent docs-client.log: one browser test passes; provider diff inspected. |
| Existing root SSR/hydration smoke and docs Chromium/Firefox e2e pass. | met | Independent root-e2e.log: two pass; docs-e2e.log: 12 pass. |
| Real helper-selected browser smoke passes; actual cloud validation is distinguished from local simulation. | met | Independent fallback.log: external Chromium 149.0.7827.55 selected with deliberately absent pinned argument; page text verified. Actual cloud image untested. |
| pnpm test, docs tests, package, root/docs checks/build, scoped Trunk, and diff checks pass. | FAIL | Root 1,137 tests pass; client smoke, publint, root/docs checks (zero errors), docs build, scoped Trunk and diff checks pass. All docs units: 12 pass, one fails at seo-title-policy.spec.ts:51, expected 67 pages, received 68. |
| Each workflow filter includes shared helper; pinned installation remains unchanged. | met | One exact helper entry in each of three filters; existing browser install commands retained. |
| git diff -- package.json docs/package.json pnpm-lock.yaml is empty; no out-of-scope edits. | FAIL | Dependency diff empty; all nine changed paths allowed, but removing environment: browser exceeds launch-only config scope. Verification generated unstaged registry churn excluded from snapshot. |
| README status and verification evidence updated. | met | Guard marked BLOCKED, dependency 002 TODO; this report and running log record reproduced evidence. |

Local independent logs: `.temp/cloud-session-001/guard/`. Historical red evidence: `.temp/cloud-session-001/red.log`.

## Spirit

The implementation supplies a real optional installed Chromium path across all three consumers, retains pinned precedence and Firefox, and tests actual browser startup. It serves the cloud readiness goal. It cannot be declared complete while the required docs unit suite fails.

## Scope & conduct

- Executor touched only nine allowed paths and left plans, dependencies and runtime code unchanged. Temporary fixture files rather than filesystem mocks are confined to independently created temp directories and do not alter browser caches.
- The plan incorrectly assumed the existing browser environment setting could remain. An ignored probe restoring that setting reproduces Vitest 4.1.11 startup rejection; the executor removed it before obtaining an amendment, rather than stopping at the launch-only boundary.
- The SEO assertion is a baseline defect: both dispatch base 768ece5e and snapshot contain 68 example detail pages, and the policy test did not change. Scope currently excludes existing assertions.
- No execution-time amendment made. Operator asked to accept the setting removal and allow only the exact count change 67 to 68, retaining every title assertion. No answer received as of this report.
- No PR opened. Plan 002 remains dependent on Plan 001 PASS.

## Residual risk / follow-ups

- To reach PASS: obtain agreement to the narrow amendment, have Sonnet change the exact SEO count, snapshot its correction, then reproduce the failed docs unit gate and relevant checks. Do not waive it or broaden repairs silently.
- External browser compatibility is demonstrated locally, not in a Claude cloud image. Arbitrary Chromium builds remain unsupported by Playwright guarantees; pinned CI remains authoritative.
- Executor reported intermittent PostHog timeout and docs-kit watcher errors in earlier full runs. Neither reproduced in this independent full docs unit run; no timeout, assertion or watcher changes authorized.
- Docs builds regenerate unrelated registry JSON content. Keep this churn out of implementation commits; cleanup is assigned to the executor.
