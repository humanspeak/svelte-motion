# Guard report — 002 fresh-session setup

**Recommendation: NO-PASS** — tests/config pass; three setup/permission descriptions need precise wording.

**Reviewed at** 7ae63ac1 · 2026-10-05 17:29 · **Plan planned at** 15f93ed7

| Done criterion | Result | Evidence |
| --- | --- | --- |
| Guide contains versioned setup, browser/fallback limits, exact checks/order, Trunk and cloud boundaries. | FAIL | Commands match manifests/config/CI, but Trunk anycurrentrelease conflicts with configuredCLI1.25.0; permission onlyskipaprompt wording conflicts with documented network effect. |
| README/CLAUDE link to guide and preserve content. | met | Additions only; independent previous-line-order audit passes. New CLAUDE silently wording contradicts actual printed hook warnings and needs correction. |
| Shared JSON parses; exact four-rule contract tests pass. | met | Independent five tests on Node24 and actual JSON shape/rules inspection. |
| Shared settings not ignored; local explicitly ignored; no personal config copied. | met | Ignore exit1for shared, exit0forlocal; only sharedfile read/staged. |
| Settings tests, full root units, rootcheck, scopedTrunk/diff pass. | met | Node24:5focused/1147full,0checkerrors; scopedTrunk/diff clean. |
| Fallback docs refer to reviewed001; cloud/platform limits stated. | met | Resolver precedence matches source and reviewed001; guide explicitly says actualClaudeclouduntested. |
| No dependency/runtime/out-of-scope changes; status/evidence updated. | met | Six allowed paths, emptymanifest/lockdiff; guard updatesREADME/status. |

Independent logs: `.temp/cloud-session-002/guard/`. Browser/docs/package evidence reused from reviewed001 because those files/runtime remain unchanged, as plan permits. No claim that a realClaudecloud session or freshdisposableclone was verified.

To reach PASS, executor changes only prose: Trunk version row names configured1.25.0pin; remove only from prompt-effect claim while retaining sandboxnetwork caveat and hostpolicy limits; remove silently from missingTrunk hook statement. All prior instruction content and rule/test/source scope preserved. No additional runtime tests required for prose-only follow-up; scoped format/lint and diff checks mandatory. Guard never edits source; no PR opened.
