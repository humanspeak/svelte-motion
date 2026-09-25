# Plan 006: Publish complete Reorder declarations and verify consumer inference

> Executor: follow the steps in order, record red and green evidence, and update this batch's README status when finished unless a reviewer owns the index. Do not claim DONE from unit tests alone when a browser or package gate is listed.
>
> Drift check first: run `git diff --stat 6f0085ef..HEAD -- src/lib/reorder.ts tests/consumer-vite6/verify.mjs tests/consumer-vite6/verify-types.mjs tests/consumer-vite6/src/reorder-types.ts .changeset/reorder-declaration-output.md`. Compare the excerpts below against live code. Expected predecessor changes are described below; unrelated drift requires reconciliation before edits.

## Status

- Priority: P1
- Effort: S
- Fix risk: LOW
- Confidence: HIGH
- Depends on: 001-docs-verification.md; 002-ci-triggers.md ensures changed tests trigger CI
- Category: dx / bug
- Audit finding: 03
- Planned at: commit 6f0085ef, 2026-09-24
- State: TODO

## Why this matters

dist/index.d.ts currently re-exports missing dist/reorder.d.ts. With skipLibCheck, TypeScript silently treats Reorder as any, removing consumer validation. Runtime demos and publint alone cannot prove published generic component types work.

## Current state and conventions

src/lib/reorder.ts:22:
~~~ts
export const Reorder = {
    Group,
    Item
} as const
~~~
This inferred object contains Svelte generic component types with a private generated $$IsomorphicComponent name. dist/index.d.ts includes:
~~~ts
export { Reorder } from './reorder';
~~~
dist/reorder.d.ts is absent. A strict consumer with skipLibCheck accepted assigning imported Reorder to a number. A prior closed plan explicitly deferred the same omission; the audit did not rebuild.

Emitted Group.svelte.d.ts has the generic call signature:
~~~ts
<V>(internal: unknown, props: ReturnType<__sveltets_Render<V>['props']> & {}): ReturnType<__sveltets_Render<V>['exports']>;
~~~
ReorderGroupProps<V> has values: V[] and onReorder: (newOrder: V[]) => void; Item accepts value: V. Preserve these relationships.

tests/consumer-vite6/verify.mjs uses node:assert/strict and Vite SSR but currently verifies rendered root/optimized imports only. Its test script is node verify.mjs; CI already invokes pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test after build. Extend that entry point rather than creating an uncalled verifier.

This is @humanspeak/svelte-motion, a Svelte 5 library using motion/motion-dom as its animation engine. Keep upstream public API reuse; do not import private React modules or introduce another animation engine. Match existing TypeScript, single quotes, four-space indentation, Svelte runes, and Google-style JSDoc for public API additions. Trunk is the formatting/lint authority.

## Commands you will need

Run from the repository root unless a command specifies another directory. Use Node 24 and pnpm 11.24.0 from package.json. Check with `node --version` and `pnpm --version`; if the installed pnpm differs, the exact fallback is `npm exec --yes --package=pnpm@11.24.0 -- pnpm <arguments>`. Do not update the lockfile to accommodate a local tool mismatch.

| Purpose | Command | Expected |
| --- | --- | --- |
| Frozen setup, if needed in an isolated checkout | pnpm install --frozen-lockfile | Exit 0, no manifest/lockfile drift |
| Root types | pnpm check | Exit 0, no errors |
| Build package/declarations | pnpm package | Exit 0; inspect declaration diagnostics too |
| Docs types after package build | pnpm --dir docs check | Exit 0 after plan 001 |
| Complete root unit suite | pnpm test:only | All pass |
| Format changed source/config files | trunk fmt <changed in-scope files> | Only intended formatting changes |
| Lint | trunk check | Exit 0 |
| Patch integrity | git diff --check | Exit 0 |
| Artifact consumer typing | node tests/consumer-vite6/verify-types.mjs | Exit 0 after fix |
| Consumer gate | pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test | Runtime/type assertions pass |
| Reorder units | pnpm test:only src/lib/components/Reorder | All pass |
| Reorder browsers | pnpm exec playwright test e2e/reorder --project=chromium | All pass |

Fresh-checkout prerequisite discovered during execution: docs types import ignored generated demo loaders, registry data, and GitHub stats. Run the existing `pnpm --dir docs build` once after `pnpm package` and before the first docs typecheck in a fresh execution checkout. This reuses existing generators; never copy caches or environment files from another worktree. A successful build does not replace `pnpm --dir docs check`. Normal docs build does not deploy or enable the IndexNow submission mode.

Root Playwright uses port 4198 and builds the root app/package before starting preview. Do not terminate a user's running server. Run browser gates in an isolated checkout with that port available, or deliberately reconfigure an isolated verification instance; do not silently reuse a stale preview. PW_REUSE_SERVER=1 is allowed only after proving the running server serves the current checkout. If a full e2e run fails, open each affected route in the in-app browser and review the behavior with the user before changing assertions or code.

## Scope

Only modify these paths (plus this plan's README status):
- src/lib/reorder.ts
- tests/consumer-vite6/verify.mjs
- tests/consumer-vite6/verify-types.mjs
- tests/consumer-vite6/src/reorder-types.ts
- .changeset/reorder-declaration-output.md

Out of scope: generated dist edits, component runtime, stripping generics, widening to any/unknown, new dependencies/TypeScript versions, or changing exports. The root TypeScript devDependency is available through existing monorepo module resolution.

## Git workflow

Use a fresh branch named fix/upstream-reorder-declarations in an isolated checkout from freshly fetched origin/main. The audited baseline includes reviewed commits 31657b14, 207dd870, and 6f0085ef; before execution verify that main already contains them or integrate those reviewed changes into the isolated branch. Do not cherry-pick commits already present; do not reset, pop stashes, or overwrite the user's working tree. Apply required predecessor plans before starting. Record the actual execution base and any reconciliation in the index.

Use a conventional commit such as "fix(types): emit the public Reorder namespace declaration". Do not push, merge, publish, or open a PR as part of this plan unless separately instructed.

## Steps

### Step 1: Prove the emitted-artifact failure
Create verify-types.mjs using node:assert/strict and the TypeScript compiler API. Assert dist/reorder.d.ts exists. Compile src/reorder-types.ts as a strict noEmit consumer through the public @humanspeak/svelte-motion export with ESNext/Bundler resolution and skipLibCheck true. Do not alias source or import private components.
In the fixture define IsAny<T> = 0 extends (1 & T) ? true : false and Assert<T extends true>. Assert namespace and both components are not any. Use generic component call signatures with numeric and object values and assert inferred onReorder values. Add @ts-expect-error cases for invalid axis, absent required props, and incompatible callbacks; unused directives must fail the verifier. Never execute component calls at runtime.
**Verify:** node tests/consumer-vite6/verify-types.mjs fails on the missing declaration. Run pnpm package, then rerun the verifier to confirm a fresh artifact still fails for that declaration/type defect.

### Step 2: Give the namespace a nameable exported shape
Annotate Reorder explicitly with readonly Group: typeof Group and readonly Item: typeof Item, retaining imported symbols so declaration emit references exported component defaults instead of expanding private generated interfaces. Keep the runtime object unchanged; do not use a non-generic Component<Props<unknown>>.
**Verify:** pnpm package exits 0 without the Reorder $$IsomorphicComponent diagnostic; test -f dist/reorder.d.ts succeeds; node tests/consumer-vite6/verify-types.mjs passes. Inspect output to confirm component imports remain generic.

### Step 3: Enforce typing in the existing consumer gate
Invoke the verifier from verify.mjs alongside existing SSR assertions. Keep failures fatal. Test contextual inference from values as well as explicitly specialized numeric/object components without unsound casts. Negative cases must fail on invalid props, not missing modules.
**Verify:** pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test passes. In the isolated checkout temporarily remove the emitted declaration or make its namespace any; the verifier must fail. Restore with pnpm package before proceeding; do not commit generated output.

### Step 4: Complete package and regression gates
Add a patch changeset. Run pnpm check, pnpm package, pnpm --dir docs check, pnpm test:only, the consumer command, and the Reorder browser suite. Run trunk fmt on changed source, trunk check, and git diff --check.
**Verify:** all exit 0, fresh declarations exist, and runtime reorder behavior is unchanged.

## Test plan

Anchor at the package boundary. Verify declaration existence, namespace/Group/Item non-any, numeric/object generic inference, and negative props with active @ts-expect-error directives. Keep skipLibCheck true for the leak regression; also report diagnostics with it false when feasible without hiding unrelated baseline failures. Existing SSR and Reorder suites protect runtime stability.

## Done criteria

- [ ] Fresh package output includes dist/reorder.d.ts with no private-type emit errors.
- [ ] Public import tests reject invalid props and preserve generic callback values.
- [ ] Existing CI's consumer invocation runs the verifier and fails on missing/any declarations.
- [ ] Final verification commands from the last step pass, with red/green output summarized in the handoff.
- [ ] No accidental source, manifest, lockfile, or generated registry changes outside scope: inspect git diff --name-only and git status --short.
- [ ] Record commit, commands/results, and any limitations in the batch README; only then set this plan DONE.

## STOP conditions

- The baseline or source contract does not match these excerpts after accounting for the named predecessor plans.
- The red test passes before the fix, fails for an unrelated setup error, or a gate fails twice after a reasonable fix attempt.
- A fix requires files outside scope, a new dependency, a public API redesign, or a private upstream import.
- The typeof annotation still cannot emit, generic inference is lost, or repair requires changing generated components/public Reorder props. Report compiler diagnostics before widening scope.

## Maintenance notes

Svelte upgrades can change generated declaration shapes; retain the package-boundary check. Runtime imports and publint are necessary but insufficient evidence for generic export typing.

