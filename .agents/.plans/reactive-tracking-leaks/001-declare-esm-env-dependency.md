# Plan 001: Every bare import the published package makes is a declared dependency

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a33531a2..HEAD -- package.json pnpm-lock.yaml src/lib/__tests__`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Wave**: 1
- **Category**: bug (packaging)
- **Planned at**: commit `4665b907`, 2026-11-13

## Revision notes

- **2026-11-20, pre-flight against `a33531a2`** (Motion 14.14.0, v2.14.0): the `package.json` excerpt now shows the `14.14.0` pins, and the drift check is based on `a33531a2`. `esm-env` is still only a devDependency, so the finding stands and the steps are unchanged.

## Why this matters

`@humanspeak/svelte-motion` imports `esm-env` at runtime from four shipped
modules, including `_MotionContainer.svelte`, which every `motion.*` component
uses. `esm-env` is listed only under `devDependencies`, so the published
package does not declare it. It resolves for most users only because `svelte`
itself depends on `esm-env` and npm and pnpm hoist it by default. Under strict
resolution (Yarn Plug'n'Play, pnpm with `hoist=false`) the import is
unresolvable, and the library is coupled to a private dependency of Svelte
that Svelte may drop. After this plan the dependency is declared, and a unit
spec fails whenever shipped code imports a package that is not declared.

## Current state

- `package.json`: the manifest. `dependencies` holds three entries and
  `esm-env` sits in `devDependencies`:

  ```json
  "dependencies": {
      "acorn": "^8.18.0",
      "motion": "14.14.0",
      "motion-dom": "14.14.0"
  },
  "devDependencies": {
      ...
      "esm-env": "^1.2.2",
      ...
  },
  "peerDependencies": {
      "svelte": "^5.0.0"
  },
  ```

- Shipped modules that import it (all under `src/lib`, none of them a spec):
  - `src/lib/html/_MotionContainer.svelte:17`: `import { BROWSER, DEV } from 'esm-env'`
  - `src/lib/utils/arc.ts:32`: `import { DEV } from 'esm-env'`
  - `src/lib/utils/log.ts:7`: `import { DEV } from 'esm-env'`
  - `src/lib/utils/usePresence.svelte.ts:2`: `import { DEV } from 'esm-env'`
- Bare package names imported by non-spec files under `src/lib` at this
  commit: `@humanspeak/svelte-motion` (inside JSDoc examples only), `acorn`,
  `esm-env`, `motion`, `motion-dom`, `svelte`, plus `@sveltejs/kit` and `vite`
  (check where those two come from in Step 1; they may be type-only or inside
  comments).
- `src/lib/__tests__/motionDependencies.spec.ts`: the existing spec that reads
  `package.json` and asserts on dependencies. Use it as the structural pattern
  for the new spec (how it finds the repo root, reads the manifest, and names
  its `describe`):

  ```ts
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
  }
  ```

- `files` in `package.json` excludes `*.spec.*`, `*.test.*` and `__tests__`
  from the published tarball, so those are not "shipped code".
- pnpm 12.6.0 with a 48-hour `minimumReleaseAge` (`pnpm-workspace.yaml`).
  `esm-env@1.2.2` is already in the lockfile, so moving it does not need a new
  download.

## Commands you will need

| Purpose             | Command                                                         | Expected on success      |
| ------------------- | --------------------------------------------------------------- | ------------------------ |
| Install             | `pnpm install --frozen-lockfile --config.engine-strict=false`   | exit 0                   |
| Build (needed once) | `pnpm build`                                                    | exit 0, publint clean    |
| Typecheck           | `pnpm check`                                                    | 0 errors                 |
| One unit file       | `pnpm exec vitest run src/lib/__tests__/declaredImports.spec.ts` | see steps                |
| All unit tests      | `pnpm test:only`                                                | all pass                 |
| Format              | `trunk fmt <files>`                                             | exit 0                   |
| Lint                | `trunk check <files>`                                           | no issues                |

Notes:

- Run `pnpm build` once before the first `vitest` run on a fresh checkout. The
  build runs `svelte-kit sync`, which generates the `tsconfig` Vitest needs.
- Trunk is the lint and format authority. Do not use `pnpm lint`,
  `pnpm format` or `prettier` directly.
- If the global `pnpm` cannot switch to the pinned version, use
  `npx -y pnpm@12.6.0 <args>`.
- Never use `git stash`. Never start, stop or bind anything on port 4198.

## Scope

**In scope** (the only files you should modify):

- `package.json`
- `pnpm-lock.yaml` (only the change `pnpm install` makes for the moved entry)
- `src/lib/__tests__/declaredImports.spec.ts` (create)
- `.changeset/declare-esm-env.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- The four modules that import `esm-env`. Do not replace the import with
  `import.meta.env` or anything else.
- `motion` and `motion-dom` versions. A Motion 14.14.0 bump is in progress
  elsewhere.
- The `svelte` peer range, the top-level `overrides` block, and unused
  devDependencies. They are separate findings (see the batch README).
- `docs/package.json` and `tests/consumer-vite6/package.json`.

## Git workflow

- Branch: `advisor/001-declare-esm-env` from `origin/main`.
- Conventional commits, as in `git log`: for example
  `fix(package): declare esm-env as a runtime dependency`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write a failing spec that checks shipped imports are declared

Create `src/lib/__tests__/declaredImports.spec.ts`. It must:

1. Find the repo root the same way `motionDependencies.spec.ts` does and read
   `package.json` (`dependencies` and `peerDependencies`).
2. Walk `src/lib` recursively with `node:fs`. Include files ending in `.ts`,
   `.js` or `.svelte`. Skip any path that contains a `__tests__` directory and
   any file whose name matches `.spec.` or `.test.`. These mirror the `files`
   exclusions in `package.json`.
3. For each file, strip comments before scanning, so JSDoc `@example` blocks
   (which import `@humanspeak/svelte-motion`) do not count. Removing
   `/* ... */` blocks and `//` line comments with two regular expressions is
   enough; `<!-- -->` in `.svelte` files too.
4. Collect bare specifiers from `import ... from '<spec>'`,
   `import '<spec>'`, `export ... from '<spec>'` and `import('<spec>')`.
   A specifier is bare when it does not start with `.`, `/`, `$` or `node:`.
   Ignore `import type` and `export type` statements: types are erased from
   the published JavaScript.
5. Reduce each specifier to its package name (`svelte/reactivity` → `svelte`,
   `@scope/name/sub` → `@scope/name`).
6. Assert that the sorted list of package names not present in
   `dependencies` ∪ `peerDependencies` equals `[]`, with a message that names
   the offenders and the first file that imports each.

Add one small extra test in the same file that feeds the scanner a few inline
strings (a JSDoc example, an `import type`, a subpath import, a scoped
package) and checks the extracted names, so the scanner itself is covered.
Export nothing from the spec; keep the scanner functions local to the file.

**Verify**: `pnpm exec vitest run src/lib/__tests__/declaredImports.spec.ts`
→ the "declared" test FAILS and its message lists `esm-env`.

If it lists other packages too (for example `vite`, `@sveltejs/kit` or
`three`), look at each import:

- A value import that ships in `dist` and is genuinely needed is a second
  undeclared dependency. STOP and report it; do not decide on your own whether
  it becomes a dependency or an optional peer.
- If it is type-only but written without the `type` keyword, that is a
  scanner gap. Tighten the scanner (for example treat
  `import { type A, type B }` with only `type` members as type-only); do not
  edit the source module.

If the test passes without listing `esm-env`, the reproduction is wrong: STOP.

### Step 2: Move `esm-env` to `dependencies`

In `package.json`, delete the `"esm-env": "^1.2.2"` line from
`devDependencies` and add it to `dependencies`, keeping the keys in
alphabetical order (`acorn`, `esm-env`, `motion`, `motion-dom`). Keep the same
range. Then run `pnpm install --config.engine-strict=false` (without
`--frozen-lockfile`) so the lockfile's importer entry moves.

**Verify**:

- `git diff --stat` → only `package.json` and `pnpm-lock.yaml` changed (plus
  the new spec). The lockfile diff is a few lines that move `esm-env` under the
  root importer's `dependencies`; no other package version changes. If more
  changes, STOP.
- `pnpm exec vitest run src/lib/__tests__/declaredImports.spec.ts` → all pass.

### Step 3: Add the changeset

Create `.changeset/declare-esm-env.md`, in the format the other files in
`.changeset/` use:

```md
---
'@humanspeak/svelte-motion': patch
---

`esm-env` is now a declared dependency. Installs with strict module resolution (Yarn Plug'n'Play, pnpm without hoisting) no longer fail to resolve it.
```

**Verify**: `ls .changeset/declare-esm-env.md` → the file exists.

### Step 4: Full gate

Run, in this order: `pnpm build`, `pnpm check`, `pnpm test:only`,
`pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test`, then
`trunk fmt package.json src/lib/__tests__/declaredImports.spec.ts .changeset/declare-esm-env.md`
and `trunk check` on the same files, then `git diff --check`.

**Verify**: every command exits 0; `trunk check` reports no issues.

## Test plan

- Red first: the Step 1 spec fails on current code with `esm-env` named as an
  undeclared import, and passes after Step 2.
- New tests, both in `src/lib/__tests__/declaredImports.spec.ts`:
  - every bare value import in shipped `src/lib` files is in `dependencies` or
    `peerDependencies`;
  - the scanner ignores comments, `import type`, relative and `$lib` imports,
    and reduces subpaths and scoped names correctly.
- Pattern: `src/lib/__tests__/motionDependencies.spec.ts`.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/__tests__/declaredImports.spec.ts` exits 0
- [ ] `node -e "const p=require('./package.json');process.exit(p.dependencies['esm-env']&&!p.devDependencies['esm-env']?0:1)"` exits 0
- [ ] `pnpm build`, `pnpm check` and `pnpm test:only` exit 0
- [ ] `trunk check` on the changed files reports no issues
- [ ] `git status --short` lists only the four in-scope files
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- The Step 1 spec reports an undeclared value import other than `esm-env`.
- `pnpm install` changes any lockfile entry other than moving `esm-env`.
- `package.json` no longer matches the excerpt above (for example the Motion
  14.14.0 bump landed and reshaped `dependencies`). Re-read it, and if the only
  difference is the `motion` / `motion-dom` version numbers, continue.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The Motion 14.14.0 bump edits `package.json` and `pnpm-lock.yaml` too.
  Whichever lands second will need a trivial lockfile rebase; regenerate it
  with `pnpm install`, do not hand-merge.
- The new spec is a tripwire: a future shipped import of an undeclared package
  fails CI. If a package is intentionally optional (an optional peer), add it
  to `peerDependencies` with `peerDependenciesMeta`, not to an ignore list in
  the spec.
- Deferred: raising the `svelte` peer floor (shipped code uses `$props.id()`
  and attachments, which need a later Svelte 5 minor than `^5.0.0` allows) is
  recorded in the batch README as its own finding.
