# Plan 016: Retire the dead Coveralls job, correct CONTRIBUTING.md, and drop stale plan copies

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a33531a2..HEAD -- .github/workflows/coveralls.yml CONTRIBUTING.md .agents/.plans/motion-14-2-0 .agents/.plans/motion-14-5-0 .agents/.plans/motion-14-6-0 .agents/.plans-closed/motion-14-2-0 .agents/.plans-closed/motion-14-5-0 .agents/.plans-closed/motion-14-6-0`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live files before proceeding; on a
> mismatch, treat it as a STOP condition. A change to `CONTRIBUTING.md` that
> is exactly PR #518's diff (see "Current state") is expected and not a STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (CI config, docs and planning files only; nothing shipped)
- **Depends on**: none
- **Wave**: 1
- **Category**: dx / docs
- **Planned at**: commit `a33531a2`, 2026-11-20

## Why this matters

Three small rots, one plan. The weekly Coveralls workflow has failed on every
one of its last 40 runs, so a red scheduled job is the norm and real failures
hide behind it. `CONTRIBUTING.md` is the guide `CLAUDE.md` sends every fresh
session to, and it states four false things that make a new agent install the
wrong Trunk, believe Motion is on 14.0.0, look for Vitest projects that do not
exist, and run unit tests before the step that makes them work. And three
already-shipped plan batches sit in `.agents/.plans/` (the directory the
`dispatch` skill reads for live work) as older duplicates of their
`.plans-closed/` copies. After this plan the scheduled job is gone (coverage
keeps flowing from the release workflow), the guide is true, and the active
plans directory lists only live work.

**Red-test exemption**: this plan changes no runtime behaviour (a CI workflow
deletion, prose in a Markdown guide, and deleting planning Markdown). There is
nothing to reproduce with a failing test; each step's verification is a
`grep`/`ls`/`gh` check instead.

## Current state

### Finding 20: the Coveralls workflow

- `.github/workflows/coveralls.yml` (66 lines), triggered by
  `schedule: cron 0 0 * * 0` and `workflow_dispatch`. Lines 34–38:

  ```yaml
              - name: Install
                run: pnpm install --frozen-lockfile

              - name: Test
                run: pnpm test
  ```

- Every run fails. `gh run list --workflow Coveralls --limit 40 --json conclusion`
  on 2026-11-20 returned 40 × `failure`, newest
  `43656201292` (2026-11-15). Its log shows why: the full-workspace install
  runs `docs`' `prepare` (`svelte-kit sync`), which cannot load
  `docs/vite.config.ts` because `@humanspeak/svelte-motion/dist/vite.js` is
  not built; then `pnpm test` starts Vitest with no root `.svelte-kit/`, so
  `vite-tsconfig-paths` reports "An error occurred while parsing
  .../tsconfig.json" (it `extends` `./.svelte-kit/tsconfig.json`) and Vitest
  exits with a Startup Error. Nothing in the job runs `svelte-kit sync`
  (`pnpm build` or `pnpm check`) first.

- Coverage is already uploaded on every release.
  `.github/workflows/npm-publish.yml:359-392` (job `build`, on push to `main`
  touching `src/**`, `package.json`, lockfile, configs) runs
  `pnpm install --filter . ... --ignore-scripts`, `pnpm run check`,
  `pnpm build`, `pnpm test`, then `coverallsapp/github-action@v2` with
  `fail-on-error: false`; `:450-457` sends `parallel-finished`. The last three
  completed publish runs (`43521159335`, `42585812577`, `42042315164`)
  succeeded, including `coverage-report`. Coverage only measures
  `src/lib/**` (`vitest.config.ts`, `coverage.include`), and any change there
  triggers the publish workflow, so a weekly re-run of unchanged code adds no
  information.

- The README badge (`README.md:6`) reads `coveralls.io/...badge.svg?branch=main`,
  which the publish workflow keeps current. Leave it.

- The shared docs-kit sync does not manage this file for pnpm repos:
  `~/Github/docs-kit/.github/release-workflows/sync.py:304-306` only rewrites
  `coveralls.yml` `if coverage.exists() and policy['manager'] == 'npm'`, and
  svelte-motion's policy is `"manager": "pnpm"` (`consumers.json`). It is not
  listed in `.github/release-source.json`. Deleting it will not be undone by a
  sync.

- **Decision: delete the workflow.** Fixing it would mean copying the publish
  job's install filter, `check` and `build` steps into a second workflow that
  uploads the same numbers for the same commit, plus keeping a Node 22/24
  matrix and an `ACTIONS_KEY` checkout token alive for it. Deleting removes a
  permanently red job and a secret consumer at no loss of coverage data.

### Finding 21: `CONTRIBUTING.md` (105 lines)

Four false statements, re-verified at `a33531a2`:

1. Trunk version, line 13 (table row) and line 17 (prose):

   ```
   | Trunk   | 1.25.0 (CLI pin in `.trunk/trunk.yaml`)    | `trunk --version` |
   ```

   `Install Trunk with its [official instructions](https://docs.trunk.io/cli); the repository configures CLI `1.25.0` in `.trunk/trunk.yaml`.`

   Truth: `.trunk/trunk.yaml:4-5` is `cli:` / `version: 1.29.0`.

2. Motion pin, line 85:

   `- Motion dependencies (`motion`, `motion-dom`) stay on their pinned 14.0.0 versions; do not change them as part of setup.`

   Truth: `package.json:152-153` pins `"motion": "14.14.0"` and
   `"motion-dom": "14.14.0"`, and
   `src/lib/__tests__/motionDependencies.spec.ts:31-34` enforces that both
   are the same exact version.

3. Vitest layout, line 72:

   `- Root Vitest runs a `client` project in JSDOM and a `server` project in Node. Files under `src/testing` are tests and helpers, not public library exports.`

   Truth: Vitest reads `vitest.config.ts` (it takes precedence over
   `vite.config.ts`), which defines one test run: `environment: 'jsdom'`,
   `setupFiles: ['vitest.setup.ts']`, `include: ['src/**/*.{test,spec}.{js,ts}']`.
   The `client`/`server` `workspace` block in `vite.config.ts:31-55` is never
   read (that dead block is a separate finding, 28, not fixed here). The
   `src/testing` half of the sentence is true (`src/testing/` holds
   `chromiumLaunchOptions.spec.ts` and `claudeProjectSettings.spec.ts`); keep
   it.

4. Unit command without its prerequisite, line 45 (Focused development
   table):

   `| One root unit file         | `pnpm exec vitest run <path>`                                              |`

   Truth: Vitest resolves `$lib` and the root `tsconfig.json` through
   `.svelte-kit/tsconfig.json`, which exists only after `svelte-kit sync`
   (run by `pnpm check` and by `pnpm build`). On a fresh checkout the command
   fails with the same Startup Error as the Coveralls job above. The Full
   verification table already runs `pnpm build` (step 1) before `pnpm test`
   (step 4), so only the focused path is missing the note.

**Open PR #518** (branch `ci/playwright-firefox-blacksmith`) also edits this
file. Its whole `CONTRIBUTING.md` diff:

- line 64, step 11 of the Full verification table:
  `pnpm exec playwright test --project=chromium` →
  `pnpm exec playwright test` (Chromium and Firefox);
- line 68, the "Ordering matters." paragraph: inserts a sentence about CI
  running root e2e in Chromium and Firefox inside the
  `mcr.microsoft.com/playwright` image.

This plan must not edit lines 52–68 (the Full verification table and the
"Ordering matters." paragraph). Prettier (via `trunk fmt`) realigns a whole
Markdown table when one cell changes width, so do not edit any cell of the
Full verification table either. Editing the Prerequisites table (lines 9–13)
and the Focused development table area is safe: they are separate tables.

### Finding 22: stale plan copies

- `.agents/.plans/` holds `clone-exit-migration`, `motion-14-2-0`,
  `motion-14-5-0`, `motion-14-6-0` and this batch, `reactive-tracking-leaks`.
- `motion-14-2-0`, `motion-14-5-0` and `motion-14-6-0` were moved to
  `.agents/.plans-closed/` by `fb9ed218` (#512, 2026-11-04) and older drafts
  were re-added under `.agents/.plans/` by `d3cea700` (#516, 2026-11-13).
- A per-file diff at `a33531a2` (stale copy vs closed copy):
  - every file in each stale directory also exists in the closed directory;
  - 13 files are byte-identical;
  - the rest differ, and every line found only in the stale copy is an older
    version of a line the closed copy rewrote: README status rows reading
    `TODO` (closed: `DONE`), drift-check and "Planned at" lines before
    re-stamping, and instructions later revised by guard pre-flight
    (for example motion-14-2-0 plan 001's "Do NOT change `"version"`", which
    the closed copy replaces with the maintainer's `2.1.0` decision);
  - the closed copies also carry files the stale ones lack (plans 004–006 of
    motion-14-2-0, `006-spike-report.md` of motion-14-5-0, every
    `*.guard.md` / `*.guard-report.md` of motion-14-6-0).
  Nothing in the stale copies is lost by deleting them.
- `clone-exit-migration` exists only under `.agents/.plans/` (no closed
  copy). Its README marks plan 001 (spike) DONE and plan 002 "NOT YET
  WRITTEN", and the batch README of this audit calls it a pending decision
  that will reshape `presence.ts`. It may be live. **Do not move or delete
  it**; this plan only reports it.
- Closed plans in `.agents/.plans-closed/motion-14-5-0/` mention their old
  path (`.agents/.plans/motion-14-5-0/README.md`) in their executor
  instructions. That is historical text; leave it.

## Commands you will need

| Purpose                 | Command                                                              | Expected on success   |
| ----------------------- | -------------------------------------------------------------------- | --------------------- |
| Confirm Coveralls state | `gh run list --workflow Coveralls --limit 5` (read-only)             | 5 × `failure`         |
| Diff a stale batch      | `diff -rq .agents/.plans/<b> .agents/.plans-closed/<b>`              | see Step 3            |
| Format / lint           | `trunk fmt CONTRIBUTING.md` then `trunk check CONTRIBUTING.md`       | no issues             |
| Whitespace              | `git diff --check`                                                   | no output             |

No install, build, unit or e2e run is needed: no code changes. This plan uses
no Playwright port. Trunk is the format authority; do not use `prettier`
directly. Never use `git stash`. Do not run `gh workflow run` or any other
`gh` command that changes state.

## Scope

**In scope** (the only changes you should make):

- `.github/workflows/coveralls.yml` (delete)
- `CONTRIBUTING.md` (lines 13, 17, 45 area, 72 and 85 only)
- `.agents/.plans/motion-14-2-0/` (delete the directory)
- `.agents/.plans/motion-14-5-0/` (delete the directory)
- `.agents/.plans/motion-14-6-0/` (delete the directory)
- `.changeset/repo-housekeeping.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- `CONTRIBUTING.md` lines 52–68 (Full verification table and the
  "Ordering matters." paragraph): PR #518 edits them.
- `.github/workflows/npm-publish.yml`: managed by docs-kit's sync; its
  coverage upload is what replaces the deleted job.
- `README.md` (the Coveralls badge stays valid).
- `vite.config.ts` and `vitest-setup-client.ts` (the dead `workspace` block is
  finding 28, not this plan).
- `.agents/.plans/clone-exit-migration/` (report only).
- `.agents/.plans-closed/**` (the closed copies are the record; do not edit
  them).
- `.agents/.plans/reactive-tracking-leaks/` except your status row in its
  README.

## Git workflow

- Branch: `advisor/016-repo-housekeeping` from the batch commit.
- One commit per finding, conventional style, e.g.
  `ci: remove the weekly Coveralls workflow`,
  `docs(contributing): correct the Trunk and Motion pins and the Vitest layout`,
  `docs(plans): remove stale copies of closed plan batches`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the Coveralls job still fails, then delete it

Run `gh run list --workflow Coveralls --limit 5`.

**Verify**: all five rows show `failure`. If any row since 2026-11-15 shows
`success`, STOP and report: someone fixed it and the decision changes.

Then confirm coverage still uploads from the release workflow:

```bash
grep -n "coverallsapp/github-action" .github/workflows/npm-publish.yml
```

**Verify**: two matches (the `build` job upload and the `Coveralls Finished`
step). If there are none, STOP: deleting the weekly job would stop coverage.

Delete the workflow: `git rm .github/workflows/coveralls.yml`.

**Verify**: `ls .github/workflows/coveralls.yml` fails with "No such file";
`grep -rn "coveralls.yml" .github` prints nothing.

### Step 2: Correct CONTRIBUTING.md

Make exactly these edits:

1. Line 13, Prerequisites table: `1.25.0 (CLI pin in `.trunk/trunk.yaml`)`
   → `1.29.0 (CLI pin in `.trunk/trunk.yaml`)`. Same width, so the table does
   not reflow.
2. Line 17: replace `the repository configures CLI `1.25.0` in `.trunk/trunk.yaml`.`
   with `the repository pins the CLI version in `.trunk/trunk.yaml` (`cli.version`).`
   (Naming the file, not the number, keeps the prose from going stale again.)
3. Directly after the Focused development table (after line 48, before the
   blank line and `### Full verification`), add one paragraph, outside the
   table:

   `Vitest needs `.svelte-kit/tsconfig.json`, which `svelte-kit sync` generates. On a fresh checkout run `pnpm check` (or `pnpm build`) once before `pnpm exec vitest run`; without it Vitest fails at startup with a tsconfig parse error. Run `pnpm build` first as well when a test or the docs import the built package from `dist/`.`

   Do not change the table rows themselves.
4. Line 72, Test layout: replace the first sentence with
   `Root Vitest runs one JSDOM test run configured in `vitest.config.ts` (setup file `vitest.setup.ts`), covering `src/**/*.{test,spec}.{js,ts}`.`
   Keep the second sentence about `src/testing` unchanged.
5. Line 85: replace with
   `- Motion dependencies (`motion`, `motion-dom`) are pinned to the same exact version in `package.json`, and `src/lib/__tests__/motionDependencies.spec.ts` enforces it. Do not change them as part of setup.`

Run `trunk fmt CONTRIBUTING.md`.

**Verify**:

- `grep -c "1.25.0" CONTRIBUTING.md` → `0`
- `grep -c "14.0.0" CONTRIBUTING.md` → `0`
- `grep -c "server. project" CONTRIBUTING.md` → `0`
- `grep -c "svelte-kit sync" CONTRIBUTING.md` → `1`
- `grep -c "1.29.0" CONTRIBUTING.md` → `1`, and `grep -n "version: " .trunk/trunk.yaml | head -1` shows `1.29.0`
- `git diff -U0 CONTRIBUTING.md | grep '^@@'` shows no hunk touching lines
  52–68 of the original file
- `trunk check CONTRIBUTING.md` → no issues

If `trunk fmt` reflows the Full verification table, STOP: a change leaked
into it.

### Step 3: Re-verify and delete the stale plan copies

For each of `motion-14-2-0`, `motion-14-5-0`, `motion-14-6-0`:

```bash
b=motion-14-2-0   # then motion-14-5-0, motion-14-6-0
diff -rq .agents/.plans/$b .agents/.plans-closed/$b | grep "Only in .agents/.plans/$b"
for f in .agents/.plans/$b/*; do
  n=$(basename "$f")
  cmp -s "$f" ".agents/.plans-closed/$b/$n" || { echo "== $n"; diff "$f" ".agents/.plans-closed/$b/$n" | grep '^<'; }
done
```

**Verify**: the first command prints nothing (no file exists only in the stale
copy). Every `<` line printed by the loop is an older version of a line the
closed copy rewrote: a status cell reading `TODO`, a drift-check or "Planned
at" line, or an instruction the closed copy revised. Compare against the list
in "Current state". If a `<` line carries information that appears nowhere in
the closed copy (a decision, finding or result, not a stale status), STOP and
report the file and line.

Then:

```bash
git rm -r -q .agents/.plans/motion-14-2-0 .agents/.plans/motion-14-5-0 .agents/.plans/motion-14-6-0
```

**Verify**: `ls .agents/.plans` prints exactly `clone-exit-migration` and
`reactive-tracking-leaks`; `ls .agents/.plans-closed | grep -c "motion-14-[256]-0"`
prints `3`.

### Step 4: Changeset

Create `.changeset/repo-housekeeping.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

Repository maintenance only, no change to the published package: removed the always-failing weekly Coveralls workflow (coverage is still uploaded on every release), corrected CONTRIBUTING.md, and removed stale copies of closed plan batches.
```

### Step 5: Final gate

`trunk check CONTRIBUTING.md .changeset/repo-housekeeping.md`, then
`git diff --check`, then `git status --short`.

**Verify**: Trunk reports no issues; `git diff --check` prints nothing;
`git status --short` lists only the deletions and edits in Scope (plus your
status row in the batch README).

## Test plan

- Exempt from red-first: no runtime behaviour changes. A CI workflow is
  deleted, a Markdown guide is corrected and planning files are removed.
- Evidence instead of tests: Step 1's `gh run list` (still failing) and the
  `npm-publish.yml` upload grep (coverage keeps flowing); Step 2's greps
  against `.trunk/trunk.yaml`, `package.json` and `vitest.config.ts`; Step 3's
  per-file diff showing nothing unique in the stale copies.

## Done criteria

- [ ] `test ! -e .github/workflows/coveralls.yml` exits 0
- [ ] `grep -c "coverallsapp/github-action" .github/workflows/npm-publish.yml` prints `2` (unchanged)
- [ ] `grep -cE "1\.25\.0|14\.0\.0" CONTRIBUTING.md` prints `0`
- [ ] `grep -c "svelte-kit sync" CONTRIBUTING.md` prints `1`
- [ ] `git diff a33531a2 -- CONTRIBUTING.md` changes none of original lines 52–68
- [ ] `ls .agents/.plans` prints only `clone-exit-migration` and `reactive-tracking-leaks`
- [ ] `trunk check` on `CONTRIBUTING.md` and the changeset reports no issues
- [ ] `git status --short` lists only the in-scope paths
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- A Coveralls run since 2026-11-15 succeeded, or `npm-publish.yml` no longer
  uploads coverage.
- `.trunk/trunk.yaml` no longer pins `1.29.0`, or `package.json` no longer
  pins `motion`/`motion-dom` to one exact version: the replacement text would
  be wrong.
- `CONTRIBUTING.md` lines 13, 17, 45, 72 or 85 do not match the excerpts and
  the difference is not PR #518's diff.
- `trunk fmt` changes the Full verification table or the "Ordering matters."
  paragraph.
- A stale plan file holds content found nowhere in its closed copy.
- Anything suggests `clone-exit-migration` should be moved: report it, do
  not move it.

## Maintenance notes

- **PR #518 overlap**: #518 edits `CONTRIBUTING.md` lines 64 and 68; this plan
  edits lines 13, 17, 45–48 (a new paragraph after the table), 72 and 85.
  The hunks do not touch, so git should merge them cleanly. Whichever lands
  second rebases onto the other and re-runs `trunk fmt CONTRIBUTING.md`; if
  that reflows a table, resolve by hand.
- **`clone-exit-migration`** (flag for the maintainer): plan 001 is DONE and
  its spike report recommends Candidate B, but plan 002 was never written. It
  is either live (write 002) or abandoned (close it with a note and
  `git mv` it to `.plans-closed/`). That is the maintainer's call.
- **Root cause of the re-added batches**: #516 re-added the three stale
  directories after #512 closed them, most likely from a branch cut before
  #512. When closing a batch, check that open feature branches do not carry
  the old `.agents/.plans/<batch>` path, or rebase them first.
- **Changeset**: the brief requires one per plan, but this plan ships nothing
  in the package. If the maintainer prefers no CHANGELOG line for repository
  maintenance, drop `.changeset/repo-housekeeping.md` before merging.
- Related, not fixed: finding 28 (the dead `workspace` block in
  `vite.config.ts` and the orphan `vitest-setup-client.ts`) is what the false
  Test layout sentence was describing. Removing it would be a separate small
  plan.
