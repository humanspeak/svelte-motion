# Plan 001: Adopt recommendedTypeChecked with scoped carve-outs for deliberate any-bridging

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/typed-lint/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 8491bd3..HEAD -- eslint.config.mjs tsconfig.json e2e/tsconfig.json src/lib/utils/drag.ts src/lib/utils/layout.ts src/lib/utils/optimizedAppear.ts src/lib/utils/svg.ts src/lib/html/_MotionContainer.svelte`
> On any change, compare the "Current state" excerpts against live code;
> mismatch ⇒ STOP.
>
> **Revision 2026-07-09 (operator)**: The first draft enabled only three
> typed promise rules and deferred the full preset. The operator overruled:
> adopt `ts.configs.recommendedTypeChecked` wholesale, suppress the
> *deliberate* violations (the `any`-bridging into motion-dom internals), and
> make the suppression mechanism hide **future** occurrences of those
> deliberate patterns too — i.e. scoped config-level rule-offs on test globs,
> not per-site ignore comments. All violation counts below were re-measured at
> `8491bd3` with the corrected dry-run config (the `.svelte` parser is wired,
> so `.svelte` files are included). `Planned at` stays `8491bd3`.
>
> **Provenance**: Adapted 2026-07-09 from svelte-markdown's plan
> `streaming-component-hardening/009-lint-test-files-and-typed-lint.md`. Its
> finding #1 ("test files are ignored by ESLint") does **not** apply here —
> this repo already lints its ~152 unit/spec files. Finding #2 (no type-aware
> linting) applies identically and is what this plan fixes.

## Status

- **Priority**: P2
- **Effort**: L (mostly mechanical: ~241 autofixable + ~30 manual sites)
- **Risk**: MED
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `8491bd3`, 2026-07-09

## Why this matters

This is an animation library built on promises: `animate()` controls,
`element.animate().finished`, WAAPI `ready` promises, rAF scheduling, and 89
Playwright e2e files where an unawaited web-first assertion silently never
runs. Yet `eslint.config.mjs` uses `ts.configs.recommended` (untyped) and
never wires `parserOptions.projectService`, so every type-aware rule —
including `no-floating-promises`, which catches a dropped `await` on an
animation control — is off everywhere. A dry run found 13 promise-rule
errors, several in library source, plus 241 auto-fixable unnecessary type
assertions. Additionally, `e2e/`, `scripts/`, and root config files are
covered by **no tsconfig at all** (the generated `.svelte-kit/tsconfig.json`
includes only `src/`, `test(s)/`, and the vite configs), so they can't get
type-aware linting until that's fixed. After this plan: the full
`recommendedTypeChecked` preset is live, deliberate `any`-bridges in tests
stay quiet by design (now and for future test code), and library source keeps
the full safety rails.

## Current state

Relevant files:

- `eslint.config.mjs` — flat config; the main target of this plan.
- `tsconfig.json` — extends `./.svelte-kit/tsconfig.json`; do not change.
- `e2e/` — 89 Playwright spec files, in no tsconfig (fixed by a new
  `e2e/tsconfig.json`).
- `.trunk/trunk.yaml` — Trunk manages `eslint@10.5.0` + `prettier`; lint runs
  through Trunk, never raw.
- `docs/` — separate workspace with its own **generated, gitignored**
  `docs/eslint.config.mjs` (from docs-kit). ESLint v10 resolves configs
  nearest-file-first, but the generated config may be absent on a fresh
  clone/CI, so Step 2 adds a `disableTypeChecked` guard for `docs/**` and
  plain JS files.

`eslint.config.mjs:30-44` (abridged, as of `8491bd3`):

```js
js.configs.recommended,
...ts.configs.recommended,               // line 31: NOT type-checked
...svelte.configs['flat/recommended'],
prettier,
...svelte.configs['flat/prettier'],
{
    languageOptions: {
        globals: { ...globals.browser, ...globals.node },
        parserOptions: {
            tsconfigRootDir: import.meta.dirname   // lines 41-43: no projectService
        }
    },
```

There is also an existing block at `eslint.config.mjs:79-89` scoping
`ts.parser` to `**/*.svelte` / `**/*.svelte.ts` files — leave it in place; the
dry run confirmed typed rules fire inside `.svelte` files with this block plus
`extraFileExtensions: ['.svelte']`.

Conventions that apply:

- **Lint via Trunk only**: `trunk fmt` then `trunk check`. Never run
  `pnpm lint`, `pnpm format`, `npx prettier`, or raw `npx eslint`.
- **Suppressions use Trunk inline ignores** —
  `// trunk-ignore(eslint/@typescript-eslint/rule-name): reason` — not
  `eslint-disable` comments. Exemplars: `src/lib/html/_MotionContainer.svelte:203`
  and `src/lib/utils/style.spec.ts:68`. There is exactly one legacy
  `eslint-disable-next-line` in the repo (`src/lib/utils/animateValue.spec.ts:51`);
  the dry run flags it as an *unused* directive — Step 5 removes it.
- Conventional commits (`chore(lint): …`, `fix(drag): …` — see `git log`).
- CI lint gate is `.github/workflows/trunk-check.yml` (Trunk annotations).

### Dry-run violation inventory (full `recommendedTypeChecked`, commit `8491bd3`, all of `src/`)

| Rule | Count | Disposition |
| ---- | ----- | ----------- |
| `no-unnecessary-type-assertion` | 241 (137 `.ts` + 104 `.svelte`; 103 of the `.svelte` hits are in `_MotionContainer.svelte`) | **Autofix** (Step 4) |
| `no-unsafe-member-access` / `-assignment` / `-call` / `-argument` / `-return` + `no-explicit-any` | ~113 — of which ~95 in `*.spec.ts` files (top: `projection.spec.ts` ×32, `_MotionContainer.spec.ts` ×17, `hookVanillaParity.svelte.spec.ts` ×10), ~11 in internal demo routes (`src/routes/tests/**`), ~14 in library source (`_MotionContainer.svelte` ~10, plus 1 each in `hover.ts`, `style.ts`, `svg.ts`, `variants.ts`) | **Scoped off** for tests/demo routes (Step 2); **fix or trunk-ignore per site** in library source (Step 5) |
| `no-floating-promises` / `no-misused-promises` | 13 (site list below) | **Fix** (Step 5) |
| `no-base-to-string` | 4 (`svg.ts` ×3, `motionTemplate.svelte.ts` ×1) | Triage: real stringification bug vs. type with meaningful `toString` (Step 5) |
| `require-await` | 3 (spec files) | Drop `async` or add `await` (Step 5) |
| `unbound-method` | 2 (`svg.spec.ts`) | Wrap in arrow fn (Step 5) |
| `await-thenable` | 1 (`optimizedAppear.ts`) | Fix (Step 5) |
| `no-duplicate-type-constituents` | 1 (`style.ts`) | Mechanical (Step 5) |

Note: ~9 of the `no-explicit-any` hits (e.g. `style.spec.ts`) already carry
`trunk-ignore` comments today — raw ESLint counts them, Trunk filters them.
Step 2's test carve-out makes those comments dead; Step 5 deletes them.

e2e counts are unknown until Step 1 gives `e2e/` a tsconfig — a heuristic grep
found **zero** unawaited web-first assertions, so expect few; the Step 2
carve-out already covers `e2e/**` for the unsafe family.

Promise-rule sites (line numbers are leads from `8491bd3`; re-derive from your
own lint run). Library-source fixes should be flagged prominently in your
report — they are latent-bug fixes, not cosmetics:

| Site | Rule | What's there / suggested fix |
| ---- | ---- | ---------------------------- |
| `src/lib/utils/drag.ts:794` | no-floating-promises | `Promise.allSettled(restorePromises).then(finishRestore)` — allSettled never rejects; prefix `void` with one-line rationale |
| `src/lib/utils/layout.ts:40` | no-floating-promises | `animation.finished?.finally(() => {…})` — the returned promise is dropped; prefix `void` |
| `src/lib/utils/optimizedAppear.ts:253` | no-misused-promises | `if (readyAnimation.ready)` — truthiness test on a Promise used as feature detection; change to `if (readyAnimation.ready !== undefined)` |
| `src/lib/html/_MotionContainer.svelte:1886` | no-floating-promises | `animateTemplatedTransformPayload(…)` call statement drops its promise; `void` + rationale (fire-and-forget enter animation) |
| `src/lib/html/_MotionContainer.svelte:2707` | no-floating-promises | `runKeyTransition()` async fn called bare inside `$effect`; `void` + rationale ($effect can't await) |
| `src/lib/html/_MotionContainer.svelte:2900,2972` | no-misused-promises | `requestAnimationFrame(async () => {…})` — async callback where void expected; see Step 5 for the sanctioned options |
| `src/routes/tests/will-change/+page.svelte:16` | no-floating-promises | `controls.start(…)` unawaited → `void` |
| `src/routes/tests/mobile-drawer/DragCloseDrawer.svelte:71` | no-floating-promises | `handleClose()` in `onDragEnd` → `void` |
| `src/lib/utils/hookVanillaParity.svelte.spec.ts:151,166` | no-floating-promises | Svelte's `unmount()` returns a Promise → `void unmount(probe)` |
| `src/lib/utils/animateView.spec.ts:74` | no-floating-promises | same `unmount()` pattern |
| `src/lib/utils/animation.spec.ts:52` | no-misused-promises | `animateMock.mockImplementationOnce(() => Promise.resolve())` returns a Promise where the mock signature expects void; fix the mock's typing, don't suppress |

## Commands you will need

| Purpose            | Command                                    | Expected on success |
| ------------------ | ------------------------------------------ | ------------------- |
| Lint (changed)     | `trunk fmt && trunk check`                 | exit 0              |
| Lint one file      | `trunk check <path>`                       | exit 0              |
| Lint all           | `trunk check --all`                        | exit 0              |
| Lint autofix       | `trunk check --fix <path…>`                | fixes applied       |
| Typecheck          | `pnpm check`                               | 0 errors            |
| Unit tests         | `pnpm test:only`                           | all pass            |
| e2e transpile+list | `pnpm exec playwright test --list`         | lists tests, exit 0 |
| e2e smoke (1 file) | `pnpm exec playwright test e2e/view/basic.spec.ts` | passes      |

Never run `pnpm lint` / raw `eslint` / raw `prettier` — Trunk is the source of
truth. Plain `trunk check` inspects files changed vs upstream (covers new
untracked scratch files); because this plan turns on repo-wide rules, also run
`trunk check --all` once before declaring done. Note: sibling repos share vite
preview ports; this repo's e2e is pinned to port 4198 — don't run e2e in two
repos at once.

## Scope

**In scope** (the only files you should modify):

- `eslint.config.mjs` — preset switch, projectService wiring, carve-out blocks.
- `e2e/tsconfig.json` — **create** (new file).
- Files with violations per the inventory above, plus whatever the e2e/full
  passes surface — minimal, mechanical fixes only (autofix, add `await`/`void`,
  fix a mock type, change a truthiness check, delete dead trunk-ignore
  comments, add per-site trunk-ignores in library source where the `any`-bridge
  is deliberate).

**Out of scope** (do NOT touch, even though they look related):

- `docs/**` — separate workspace; its ESLint config is generated by docs-kit
  and gitignored.
- `tsconfig.json` and `.svelte-kit/**` — the build's type story must not change.
- `.trunk/trunk.yaml` — no linter version bumps or new linters.
- Prettier config, `package.json` scripts.
- Re-typing the motion-dom bridges to *eliminate* the `any`s (that's the
  deliberate pattern being carved out, not a bug to fix here).
- Rewriting tests or refactoring animation logic beyond what a violation
  strictly requires.

## Git workflow

- Branch: `chore/typed-lint-recommended` off `main` (repo uses
  `feat/…`/`chore/…` conventional branch names).
- Three commits: (1) `chore(lint): adopt recommendedTypeChecked with scoped
  test carve-outs`, (2) `chore(lint): autofix unnecessary type assertions`,
  (3) `fix(lint): resolve typed-lint violations in library source and specs`.
- Do NOT push or open a PR unless instructed. The maintainer signs off live
  before any PR (house rule).

## Steps

### Step 1: Give e2e a tsconfig

Create `e2e/tsconfig.json`:

```json
{
    "extends": "../tsconfig.json",
    "include": ["./**/*.ts"]
}
```

The typescript-eslint project service discovers the nearest tsconfig by
walking up from each file, so this brings all 89 spec files under typed
linting. Playwright also reads the nearest tsconfig for `paths` mapping — the
e2e suite imports only `@playwright/test` and relative `../_helpers/*` (no
aliases), so this is safe, but verify it:

**Verify**: `pnpm exec playwright test --list` → prints the test list and
exits 0 (proves Playwright still transpiles and resolves every spec).

### Step 2: Switch the preset and wire type information

In `eslint.config.mjs`:

**(a)** Replace line 31:

```js
...ts.configs.recommended,
```

with:

```js
...ts.configs.recommendedTypeChecked,
```

**(b)** Append, after the existing `**/*.svelte` parser block (lines 79-89),
the type-info wiring — scoped by `files` so it can never reach `docs/**`:

```js
{
    // Type-aware parsing — root package only, never docs/** (docs has its
    // own generated ESLint config owned by docs-kit).
    files: [
        'src/**/*.ts',
        'src/**/*.svelte',
        'src/**/*.svelte.ts',
        'e2e/**/*.ts',
        'scripts/**/*.ts',
        '*.ts'
    ],
    languageOptions: {
        parserOptions: {
            projectService: {
                // Root config files + scripts live in no tsconfig; shallow
                // globs only — projectService rejects `**` here.
                allowDefaultProject: ['*.ts', 'scripts/*.ts']
            },
            tsconfigRootDir: import.meta.dirname,
            extraFileExtensions: ['.svelte']
        }
    }
}
```

**(c)** Because the preset in (a) applies its typed rules to **every** file
while (b) wires type info only for the scoped paths, every file outside (b)'s
globs would error with "rule requires type information". Guard them:

```js
{
    // No type info here (plain JS, and docs/** when its generated config is
    // absent) — typed rules off, untyped recommended still applies.
    files: ['**/*.js', '**/*.mjs', '**/*.cjs', 'docs/**'],
    ...ts.configs.disableTypeChecked
}
```

**(d)** Add the deliberate-pattern carve-out. Tests and internal demo routes
bridge motion-dom internals through `any` on purpose (~106 current hits); this
block silences the family there **including all future occurrences**, which is
the operator's chosen mechanism (config-level scope, not per-site comments):

```js
{
    // Tests + internal demo routes deliberately bridge motion-dom internals
    // through `any`; the unsafe-* family is noise there — now and for
    // future test code. Library source (src/lib non-spec) keeps these rules.
    files: [
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/__tests__/**',
        'src/routes/tests/**',
        'e2e/**'
    ],
    rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off'
    }
}
```

Notes verified by the dry run at `8491bd3`:

- `extraFileExtensions: ['.svelte']` is required or the project service
  rejects `.svelte` files.
- With block (b) plus the existing svelte-parser block, typed rules fire
  inside `.svelte` files (confirmed: violations reported in
  `_MotionContainer.svelte`).
- `allowDefaultProject` covers `playwright.config.ts`, `vitest.config.ts`,
  `vitest.setup.ts`, `vitest-setup-client.ts`, `tailwind.config.ts`, and
  `scripts/generate-html.ts` (5 files failed the project service without it).

**Verify**: `trunk check eslint.config.mjs` → exit 0 (config parses). Then
`trunk check src/lib/utils/drag.ts` → reports
`@typescript-eslint/no-floating-promises` at/near line 794 (typed rules are
live). Then `trunk check src/lib/utils/projection.spec.ts` → reports **no**
`no-unsafe-*` violations (carve-out works).

### Step 3: Prove the wiring in every parser path (guard)

Type info reaches files through four different paths here (plain TS via
tsconfig, spec TS, `.svelte` via svelte-eslint-parser, e2e TS via the new
`e2e/tsconfig.json`) and any one can be silently inactive. Create four scratch
files, each containing a bare `Promise.resolve()` statement:

1. `src/lib/utils/__scratch.ts`
2. `src/lib/utils/__scratch.spec.ts`
3. `src/routes/tests/__scratch.svelte` (the statement inside `<script lang="ts">`)
4. `e2e/__scratch.spec.ts`

Run `trunk check <path>` on each → each must report
`@typescript-eslint/no-floating-promises` (the promise rules stay ON in the
carve-out — only the unsafe family is off there). Record the four results in
your report, then **delete all four scratch files**.

**Verify**: all four flagged; after deletion `git status` shows no scratch
files.

### Step 4: Autofix the unnecessary type assertions (own commit)

241 `no-unnecessary-type-assertion` hits are auto-fixable (the rule is
type-aware; it only removes assertions that don't change the type — a
type-level no-op). First confirm the flag exists: `trunk check --help` must
list `--fix`; if it does not, STOP and report (the operator decides whether a
one-time raw `eslint --fix` is acceptable). Then:

`trunk check --fix --all`

Review the diff — it should be overwhelmingly `as X` removals (103 in
`_MotionContainer.svelte`). Commit separately so the mechanical noise doesn't
bury the real fixes.

**Verify**: `pnpm check` → 0 errors and `pnpm test:only` → all pass
(assertion removal must be behavior-neutral). `git diff --stat` touches only
`src/**`.

### Step 5: Fix the remaining violations

Work through the inventory plus whatever `trunk check --all` still surfaces.
Rules of engagement:

- Prefer `await` where the caller is already async and ordering matters.
- Use `void promise` **with a one-line rationale comment** for genuinely
  fire-and-forget animation promises.
- Library-source `unsafe-*`/`no-explicit-any` sites (~14: `_MotionContainer.svelte`,
  `hover.ts`, `style.ts`, `svg.ts`, `variants.ts`): fix with a cheap real type
  if one is at hand; otherwise
  `// trunk-ignore(eslint/@typescript-eslint/<rule>): <why the bridge is deliberate>`.
  These stay per-site on purpose — the rails remain up for future library code.
- Never add `eslint-disable` comments; never switch additional rules `'off'`
  beyond Step 2(d). If triage convinces you another rule needs a scoped off
  (e.g. e2e surfaces something systemic), list it in your report with a
  one-line rationale and its violation count — the done criteria require it.
- For the two `requestAnimationFrame(async () => {…})` sites
  (`_MotionContainer.svelte:2900,2972`): extract a named `async function` and
  call it with `void` inside the rAF callback. If this async-callback pattern
  recurs across many sites (>5), the sanctioned fallback is configuring
  `no-misused-promises` as `['error', { checksVoidReturn: { arguments: false } }]`
  — document that choice and its trade-off in your report instead of wrapping
  each site.
- `no-base-to-string` (`svg.ts` ×3, `motionTemplate.svelte.ts` ×1): inspect
  each — if the stringified type has a meaningful custom `toString` (e.g. a
  MotionValue), trunk-ignore with that rationale; if it can actually produce
  `[object Object]` output, it's a real bug — fix it and flag it in your
  report.
- `require-await` (3 spec sites): drop the needless `async` keyword.
  `unbound-method` (`svg.spec.ts` ×2): wrap in an arrow function.
  `no-duplicate-type-constituents` (`style.ts`): delete the duplicate.
- Delete the now-dead suppressions in spec files: the
  `trunk-ignore(eslint/@typescript-eslint/no-explicit-any)` comments (e.g.
  `style.spec.ts` ×7) made obsolete by Step 2(d), and the unused
  `eslint-disable-next-line` at `animateValue.spec.ts:51` (keep the
  compile-time-only `typeAssertions` function compiling — `void typeAssertions`
  at the end of the file or an export, whichever keeps `pnpm check` and lint
  both green).

**Verify**: `trunk fmt && trunk check` → exit 0, then `trunk check --all` →
exit 0.

### Step 6: Full gates

**Verify**: `pnpm check` → 0 errors; `pnpm test:only` → all pass;
`pnpm exec playwright test --list` → exit 0;
`pnpm exec playwright test e2e/view/basic.spec.ts` → passes (smoke: the new
e2e tsconfig didn't break Playwright's transpile/path story). Running the full
e2e suite is NOT required for this plan — CI covers it.

## Test plan

- No new unit tests (tooling change). The guard is Step 3 — the promise rules
  provably fire in all four parser paths — plus green `pnpm test:only` after
  Steps 4–5 (the autofix and several fixes touch spec files; their assertions
  must still pass unchanged).
- Verification: `trunk fmt && trunk check` and `trunk check --all` → exit 0;
  `pnpm check` → 0 errors; `pnpm test:only` → all pass.

## Done criteria

ALL must hold:

- [ ] `eslint.config.mjs` spreads `ts.configs.recommendedTypeChecked` (line 31
      replacement) and contains blocks (b), (c), (d) from Step 2; `docs/**`
      matches only the `disableTypeChecked` guard.
- [ ] `e2e/tsconfig.json` exists and `pnpm exec playwright test --list` exits 0.
- [ ] Step 3's four-path guard was run and all four paths flagged the scratch
      floating promise (recorded in your report), scratch files deleted.
- [ ] `trunk fmt && trunk check` exits 0 and `trunk check --all` exits 0.
- [ ] The ONLY config-level rule-offs are Step 2(d)'s six rules on the
      test/demo globs; any additional rule configured off or downgraded is
      listed in your report with a one-line rationale and its violation count.
- [ ] Every `void`-marked promise and every new library-source `trunk-ignore`
      has a one-line rationale comment.
- [ ] `grep -rn "eslint-disable" src e2e` returns nothing (the one legacy hit
      at `animateValue.spec.ts:51` is removed).
- [ ] `grep -rn "trunk-ignore(eslint/@typescript-eslint/no-explicit-any)" src/lib/utils/style.spec.ts`
      returns nothing (dead suppressions cleaned up).
- [ ] `pnpm check` → 0 errors; `pnpm test:only` → all pass.
- [ ] Only in-scope files modified (`git status`).
- [ ] `.agents/.plans/typed-lint/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `eslint.config.mjs` or any inventory site no longer matches the "Current
  state" excerpts (drift since `8491bd3`).
- `pnpm exec playwright test --list` fails after Step 1 — the e2e tsconfig is
  interfering with Playwright's transpilation; do not start editing spec files
  to compensate.
- `trunk check` lacks a `--fix` flag (Step 4) — report; the operator decides
  the autofix vehicle.
- Typed linting pushes `trunk check --all` runtime past ~10 minutes on this
  machine, or the project service cannot resolve `.svelte` files despite the
  Step 2 config — the dry run at `8491bd3` showed neither, so either means
  drift worth human eyes.
- After Step 2's carve-outs, `trunk check --all` still reports more than ~120
  violations outside the autofixable assertion rule — that contradicts the
  dry-run inventory and suggests the carve-out globs aren't matching or the
  e2e suite has a systemic pattern; that deserves a decision, not mass edits.
- Step 4's autofix diff contains anything other than type-assertion removals
  and formatting — abort the commit and report.
- Fixing any library-source site (`drag.ts`, `layout.ts`, `optimizedAppear.ts`,
  `svg.ts`, `_MotionContainer.svelte`) changes observable animation behavior
  (a unit or smoke e2e test starts failing) — that's a real bug either way;
  report it as a correctness find rather than forcing green.

## Maintenance notes

- The type-info block's `files` globs are the coverage boundary: a new
  top-level source directory (e.g. a future `packages/`) must be added there
  **and** be reachable by a tsconfig, or it silently gets no type-aware
  linting.
- **Future preset growth**: typescript-eslint minor bumps can add rules to
  `recommendedTypeChecked`. Those arrive via dependency-bump PRs and surface
  in the `trunk-check` CI gate — triage them at bump time (fix, or extend the
  Step 2(d) carve-out if they're noise-in-tests-by-design). Don't pre-disable
  rules that don't exist yet.
- The Step 2(d) carve-out means new test code can accumulate genuinely-unsafe
  `any` usage silently — that is the operator's accepted trade-off. If a
  test bug traceable to an `any`-bridge ever ships, revisit the carve-out
  scope (e.g. drop `e2e/**` from it) before revisiting the preset.
- Reviewer should scrutinize: every `void`-marked promise (each needs a
  rationale and must be genuinely safe to not await); every new library-source
  trunk-ignore (deliberate bridge, not laziness); the `no-base-to-string`
  triage in `svg.ts` (possible real `[object Object]` bug); and that no rule
  beyond Step 2(d)'s six was quietly disabled.
- If `checksVoidReturn: { arguments: false }` was adopted (Step 5 fallback),
  future unawaited async callbacks into `addEventListener`/rAF will NOT be
  caught — revisit if a bug in that class ever ships.
