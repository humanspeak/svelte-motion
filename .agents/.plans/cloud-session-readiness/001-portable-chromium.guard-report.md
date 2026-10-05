# Guard report — 001 portable Chromium

**Recommendation: NO-PASS** — approved baseline corrections are complete; combined docs units hit a shared docs-kit mirror-generation race.

**Reviewed at** b2e23dc4 · 2026-10-05 16:13 · **Plan planned at** 9eedf490

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Named launch-options regression failed before config changes and passes afterward. | met | Round 1 historical red and independent 23-test focused run, source unchanged this round. |
| Resolver branch/platform tests pass, and both Playwright configs use the shared helper. | met | Round 1 full diff review and focused run reused per approved amendment. |
| Docs client project discovers/passes its browser smoke; configured provider uses helper output. | met | Round 1 independent client smoke and provider review; source unchanged. |
| Existing root SSR/hydration smoke and docs Chromium/Firefox e2e pass. | met | Round 1 independent root two and docs 12 tests, unchanged config/runtime after snapshot. |
| Real helper-selected browser smoke passes; actual cloud validation is distinguished from local simulation. | met | Round 1 independent external Chromium 149.0.7827.55 text probe; actual cloud image untested. |
| pnpm test, docs tests, package, root/docs checks/build, scoped Trunk, and diff checks pass. | FAIL | Prior reproduced gates reused for assertion-only follow-up. Independent SEO five tests, Trunk/diff and snapshot commit root-check pass. Required combined docs unit command exits 1 on mirror-directory ENOENT. |
| Each workflow filter includes shared helper; pinned installation remains unchanged. | met | Round 1 verified filters/install commands; unchanged. |
| git diff -- package.json docs/package.json pnpm-lock.yaml is empty; no out-of-scope edits. | met | Only approved count/message change in round 2; dependency diff empty. Obsolete Vitest option removal accepted by operator amendment. |
| README status and verification evidence updated. | met | BLOCKED on watcher race; this report and append-only log record evidence. |

Logs: `.temp/cloud-session-001/guard-round2/`; predecessor independent logs under `.temp/cloud-session-001/guard/`. This review reuses prior gates only as explicitly permitted for the count-only follow-up; it does not count alternative configuration probes as passing the required command.

## Spirit

The resolver serves optional installed-browser verification and preserves pinned CI. The combined browser/server unit workflow must also start reliably. Passing split projects or an ignored probe cannot satisfy the normal integrated command.

## Scope & conduct

- Approved count correction exactly matches scope: message/assertion 67 → 68, all title assertions preserved. Snapshot b2e23dc4; plan amendment a97c05bd records explicit operator agreement.
- No source edits by guard. Only ignored verification configs and guard artifacts written. No dependency, timeout, watcher or production config correction by executor in round 2.
- Combined-run failure is independently reproduced, while focused SEO passes. Code inspection shows non-atomic mirror wiping versus watcher reads in installed docs-kit. Prior round 1 did not reproduce this error; no baseline-checkout claim is made.
- Sonnet ran the failing full command three times and separately verified client/server, but those split results do not waive the contract gate. No additional source repair was attempted.
- Plan 002 remains gated and no PR opened.

## Proposed next move

Operator asked to approve only omission of docMirrorsPlugin and llmsFullPlugin during Vitest mode, focused config coverage, and production build/output verification retaining both plugins for regular dev/build. The required combined suite and every assertion stay intact. No approval received yet; plan remains unchanged.

An ignored copied config retained project self-extension and omitted these two generators: four files / 13 tests passed. An earlier imported-config probe also changed inheritance, so its success and the inheritance-only controls are diagnostic, not proof of a source fix. First copied probe failed module resolution; rerunning from ignored docs/node_modules/.cache resolved normal docs dependencies and passed.

## Residual risk / follow-ups

- To reach PASS: approved narrow repair through Sonnet, new snapshot, independent normal full docs units and targeted config checks, plus production build/output verification. No retries/tolerances may replace the failure.
- External Chromium is locally proven, not a tested Claude cloud image.
- Docs-kit watcher coordination may also need upstream work outside this batch; test-mode isolation would leave normal publishing behavior unchanged.
