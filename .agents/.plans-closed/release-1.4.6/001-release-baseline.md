# Plan 001: Prepare the next patch release as 1.4.6

> Executor: Sol. Do not edit plans or commit. The conductor commits and independently verifies.

## Status

Planned at: `5f12abf2`, 2026-09-29. Branch: `chore/motion-13.4.6`.

## Why this matters

The user explicitly wants the next package release to be 1.4.6. The workflow increments the manifest before publishing, defaulting to patch when neither major nor minor labels are present. Therefore the correct manifest baseline is 1.4.5. Setting it to 1.4.6 would publish 1.4.7. Keep the intended release explicitly assigned to npm's latest tag even when a higher version has existed.

## Scope and steps

1. Change only the root package.json version from 1.5.0 to 1.4.5.
2. Add `--tag latest` to the existing pnpm publish command in `.github/workflows/npm-publish.yml`.
3. Preserve all other manifest fields, dependencies, lockfile, source, tests, docs, version-bump logic, and toolchain settings. Main's pnpm 12.6.0 update has already been merged.

No remote or registry mutations. Do not run publish, unpublish, version against the real package, push, or tag. PR release selection must remain patch: no major/minor labels.

## Red-first evidence

Before dispatch the conductor copied the current name/version to a disposable standalone manifest and ran `pnpm version patch --no-git-tag-version`. Assertion expecting 1.4.6 failed: baseline 1.5.0 produced 1.5.1 (exit 1). Temporary manifest was removed; real files stayed untouched.

## Done criteria

- Root version is 1.4.5. The same disposable-manifest test with actual pnpm yields 1.4.6, without changing real files.
- Publish command includes explicit `--tag latest` and retains all existing flags.
- `trunk check package.json .github/workflows/npm-publish.yml` and `git diff --check` pass.
- Full diff against baseline changes only the two fields/commands specified above (excluding conductor plan records).
- Conductor snapshots changes, reproduces verification, and records PASS. No npm release occurs.

## STOP conditions

Unexpected drift to either scoped file since baseline, inability to run pnpm 12.6.0, or a need for unrelated implementation changes. Report rather than widening scope.
