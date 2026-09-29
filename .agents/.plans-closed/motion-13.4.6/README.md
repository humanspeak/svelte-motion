# Motion 13.4.6 release alignment

> **CLOSED 2026-09-29.** Both plans DONE with independent guard PASS: 001 at cd900593 (completion-boundary characterization and reset-isolation red/green), 002 at61c00d15 (Motion13.4.6 dependency alignment). Delivered focused regression demo/tests/root link, minimal manifest/lock update and accurate patch note. Full units1,029; new browser repetitions12; neighbor browsers12; final upgraded browser smoke16; root/docs types, build/package/publint, consumer and scoped Trunk gates passed. Remaining for the maintainer: PR/release decision. Nothing pushed, published or deployed.

Generated with improve on 2026-09-29 against `07a1b1ae` on `chore/motion-13.4.6`, created from freshly fetched origin/main. The maintainer selected both audit findings and requested dispatch to Sol. Run serially on this branch; the conductor owns commits, plan changes, verification records, and this index. No push, PR, publication, or deployment is part of this batch.

PR label correction (2026-09-29): the maintainer retracted the `skip-publish` instruction because it belonged to another window. No label override applies to this batch and no PR labels were changed.

| Plan | Title | Priority | Effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [001](001-wait-exit-key-change.md) | Characterize latest-key wins at wait exit completion | P2 | S–M | — | DONE — cd900593; guard PASS, meaningful reset red/green |
| [002](002-motion-dependency-refresh.md) | Align Motion with 13.4.6 and verify the release | P3 | S | 001 | DONE —61c00d15; guard PASS, all integration gates reproduced |

## Dependency and execution notes

- 001 establishes Svelte behavior on Motion 13.4.5 before 002 changes the dependency baseline. A runtime defect is not established by the audit; 001 is coverage work, not permission for a speculative presence rewrite.
- The maintainer explicitly reaffirmed red tests first during guard review. For the newly identified reset-isolation defect in the fixture, demonstrate stale generation acceptance with the generation-rejection fix disabled, then restore the fix and prove green. A missing-telemetry failure does not count as that regression proof.
- Use native Sol subagents with completion reports delivered to the conductor. The dispatch reference's Claude-hosted Codex companion is unnecessary in this native Codex environment. Executors can run local commands, install dependencies and browsers here; they must not commit, edit plans, or change files outside their plan. Guard independently reproduces gates.
- The system pnpm launcher cannot obtain a darwin-x64 native 11.24.0 binary. `npm exec --yes --package=pnpm@11.24.0 -- pnpm --version` works. The cached launcher is `/Users/jasonkummerl/.npm/_npx/0c20c093bc303280/node_modules/.bin/pnpm`; prepend its directory to PATH for commands/hooks so subprocesses also use 11.24.0. Do not change repo packageManager declarations to work around this host.
- Execution correction: also export process-local `pnpm_config_pm_on_fail=ignore` and `pnpm_config_verify_deps_before_run=false`. The first prevents nested git-dependency preparation switching to an unavailable native executable; the second prevents test commands unexpectedly repairing dependencies. Guard performs the actual frozen install separately. Both plans document this environment-only amendment.
- Branch has no upstream configured; upstream safety must be checked again before each commit.
- Audit baseline: 83 focused presence tests passed with installed Vitest. Broader build/browser gates were not run during the read-only audit.
- The user's failed-full-e2e workflow applies: inspect each failing page in the collaborative in-app browser, explain the intended behavior/assertion/visible result, and obtain the user's behavior-versus-test decision before changing it. Targeted failures are diagnosed normally; never weaken an assertion without evidence.

## Findings considered and rejected

- Port React's cached-child reconciliation patch directly: our Svelte `AnimatePresence` renders the current snippet and has no React rendered/diffed child arrays.
- Claim the dependency bump fixes Svelte wait mode: Motion's main entry reexports `framer-motion/dom`; the changed React component is not our implementation.
- Bump motion-dom to 13.4.6: upstream did not publish that version; remain at 13.4.5.
- Add scroll rangeStart/rangeEnd: the intermediate upstream change was reverted before this release.
- Reopen the archived 13.4.5 batches, replace the presence architecture, or restore removed JSON animation dedup flags: unrelated and already decided.
- Add product features/public docs pages: this batch adds regression coverage and dependency alignment, no public API or feature.

## Upstream evidence

- https://github.com/motiondivision/motion/compare/v13.4.5...v13.4.6
- https://github.com/motiondivision/motion/blob/v13.4.6/dev/react/src/tests/animate-presence-wait-exit-key-change.tsx
- https://github.com/motiondivision/motion/blob/v13.4.6/packages/framer-motion/cypress/integration/animate-presence-wait-exit-key-change.ts

Audit was limited to the release delta, presence lifecycle/coverage, dependency graph and existing verification gates. It was not a whole-repository security or architecture audit.
