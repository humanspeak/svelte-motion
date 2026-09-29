# Guard report — 001 release baseline

**Recommendation: PASS** — the actual default release selection and pnpm version command produce 1.4.6.

**Reviewed at** `09c69f4b` · 2026-09-29 19:31 · **Plan planned at** `5f12abf2`.

Prepared locally only; no PR or release created, as scoped by the plan and dispatch workflow.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Root version is 1.4.5. The same disposable-manifest test with actual pnpm yields 1.4.6, without changing real files. | met | Independent Node assertions and actual pnpm12.6.0: PASS, 1.4.5 to 1.4.6. Real manifest equality verified after simulation. |
| Publish command includes explicit `--tag latest` and retains all existing flags. | met | Workflow exact-content comparison against baseline passed; line 612 retains provenance/access/no-git-checks. |
| `trunk check package.json .github/workflows/npm-publish.yml` and `git diff --check` pass. | met | Independently reproduced: two files checked, no issues, both exit 0. |
| Full diff against baseline changes only the two fields/commands specified above (excluding conductor plan records). | met | Exact-content comparisons and complete snapshot diff review show two lines changed in two files. |
| Conductor snapshots changes, reproduces verification, and records PASS. No npm release occurs. | met | Snapshot 09c69f4b; red/green evidence and this independent report. No publish command executed. |

## Spirit

The manifest deliberately represents the baseline before the next release increment. This avoids setting it directly to 1.4.6 and accidentally publishing 1.4.7. The explicit latest tag expresses the intended npm tag despite the previously published higher version.

## Scope & conduct

- Only package.json version and workflow publish tag changed. Dependencies, lockfile and runtime implementation remain unchanged by this follow-up.
- No STOP conditions encountered; no plan amendments or executor edits to review records.
- Earlier Motion plans remain historical records of their reviewed snapshots; this user-requested follow-up supersedes their version-preservation requirement.

## Residual risk / follow-ups

- The next release must select patch: no major/minor PR labels, or choose patch when manually dispatching. The existing label-selection mechanism was preserved.
- Nothing has been published. A read-only registry query showed no 1.4.6, and the remote tag query showed no v1.4.6 at review time.
- Validation covers version calculation, scope and workflow lint; no runtime changes required another browser or unit-suite run.
