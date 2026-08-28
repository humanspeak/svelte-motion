# Guard log — Plan 001: MotionConfig `skipAnimations`

- **Date**: 2026-08-28
- **Executor**: Codex / GPT (`codex:codex-rescue`, `--write --fresh`)
- **Plan baseline**: `130f74c` (re-baselined from `dd838b1`; content-identical)
- **Branch**: `chore/plan-motion-config-skip-animations`
- **Commits**: `9aa97cd` (feature snapshot), `1578e0a` (fix round 1)
- **Verdict**: **PASS**

## Verification reproduced locally

Every gate below was run by guard, not taken from the executor's report.

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npx -y pnpm@11.22.0 run -s check` | 1336 files, **0 errors**, 39 warnings — none in any touched file |
| Unit suite | `npx -y pnpm@11.22.0 run -s test:only` | **75 files, 851 tests pass** |
| Format | `trunk fmt` | no issues |
| Lint | `trunk check --fix` | **no new issues** (1 pre-existing) |
| Build | `npx -y pnpm@11.22.0 run build` | exit 0 |
| New e2e spec | `npx playwright test e2e/utilities/motion-config-skip-animations.spec.ts` | **4/4 pass** |
| Regression sweep | `npx playwright test e2e/animate-presence e2e/utilities` | **167/167 pass** |

### Environment workarounds

- The repo's global `pnpm` fails with `Cannot verify the identity of the
  @pnpm/exe.darwin-x64 native binary: it is missing from pnpm-lock.yaml`. All
  pnpm gates were run via `npx -y pnpm@11.22.0`. This also breaks husky's
  pre-commit `svelte-check` step, so both commits used `--no-verify` with the
  gate run manually instead — recorded in each commit message.
- Playwright's `webServer` (`npm run build && npm run preview`) inherits the
  same pnpm failure through publint's `pnpm pack`. Worked around by building
  with the pinned pnpm and serving `npx vite preview --port 4198 --strictPort`,
  then running with `PW_REUSE_SERVER=1`.
- `pnpm run preview -- --port 4198` does **not** forward the flag; vite started
  on the shared port 4173, which collides with sibling repos. Killed
  immediately (verified the PID was ours, cwd `svelte-motion`) and invoked vite
  directly. Port 4198 was confirmed free before guard started its own server
  and released afterwards; no pre-existing server was ever touched.

## Red-test integrity

The plan required a failing reproduction before the fix. Guard confirmed both
red tests were genuine rather than trusting the executor:

- **Skip test** — executor reported `expected 10.2 to be 200` pre-change, and
  `expected 9.9 to be 200` still red after Step 3. Consistent with a 2s linear
  tween sampled at ~120 ms.
- **Nesting test** — the executor never confirmed this one red; it only
  reported 2/2 green afterwards. Guard closed the gap from source: at
  `83baf71`, `MotionConfig.svelte`'s context object exposes only
  `get transition()` and `get reducedMotion()` returning its **own** props,
  with no parent reference and no `skipAnimations` key. A nested config
  therefore yields `data-reduced="none"`, where the test asserts `"always"` —
  mechanically impossible to pass pre-change.

  A worktree replay at `83baf71` was attempted first and abandoned: a symlinked
  `node_modules` breaks vite/rolldown resolution (`Could not resolve
  'node:module'`). Proving it from source was cheaper and stronger.

## Scope audit

`git status` across both commits lists only the plan's in-scope paths plus the
four fix-round files the operator authorized. Specifically confirmed untouched:

- `src/lib/utils/visualElementCore.ts` — still exactly 3 `skipAnimations`
  matches; it already forwarded the option and needed no change.
- `src/lib/utils/presence.ts` — the clone exit was fixed from the
  `_MotionContainer` call site, not by editing presence.
- Layout/projection utilities, drag/inertia, `.competitive-intel/state.json`.
- `skipAnimations` was correctly kept **out** of the shared `mergedTransition`
  derived, which also feeds the projection adapter's `updateOptions`.

No Codex litter remained (`.codex/`, `test-results/`, `.pnpm-store/` all
absent or cleaned).

## Fix round 1 — nested-config regression

The plan's own STOP condition fired. Guard's regression sweep (beyond the
plan's letter) surfaced:

```
e2e/animate-presence/custom.spec.ts:590
AnimatePresence custom › usePresenceData demo can isolate itself from parent
MotionConfig defaults

Error: { "count": 2, "cloneCount": 1, "totalOpacity": 1.116,
  "rects": [ { "opacity": 0.87,  "clone": false },
             { "opacity": 0.246, "clone": true  } ] }
expect(received).toBeUndefined()   // badSample = any frame over 1.05
```

**Causation proved by bisecting the single file**: reverting only
`MotionConfig.svelte` → 16/16 pass; restoring it → deterministic failure. The
inherited 0.6s transition stretched the crossfade so outgoing clone and
incoming square overlapped at 1.116.

A second failure in the same sweep — `owned-child › retains and exits the
original node without creating a clone` — passed in isolation both with and
without the change. Classified as a **pre-existing flake**, not caused by this
work; it also passed in the final 167/167 run. Worth a separate issue.

**Root cause**: three sites used a bare `<MotionConfig>` as a reset barrier, a
pattern that only worked because nested configs used to shadow. Two are live
docs examples sitting under `docs/src/routes/examples/+layout.svelte:33`'s
`transition={{ duration: 0.6 }}`, so this was user-visible, not test-only.

**Operator decision**: keep full inheritance (upstream parity, and the docs
already claimed it), fix the three sites. Dispatched back to Codex — guard did
not edit source.

**Fix**: `<MotionConfig transition={{}}>` at each site. The getter is
`transition ?? parentConfig?.transition`, so `{}` is not nullish, wins, and
resolves to motion's per-value defaults — exactly what a bare config produced
before. Plus a "Resetting inherited defaults" docs subsection, since a bare
config is no longer a reset.

Converged in **1 round** of a 3-round budget.

## Deviations from the plan as written

- **Step 3 grew a follow-on fix.** The plan anticipated this and offered
  dropping inheritance as the escape; the operator chose upstream parity
  instead, which required the three call-site edits. Authorized, not drift.
- **`pnpm check` reported via `npx -y pnpm@11.22.0`**, not the bare `pnpm` in
  the plan's command table. Environment bug, not a plan defect.

## For the reviewer of this PR

- The riskiest hunk is `MotionConfig.svelte`'s parent inheritance — it changes
  behavior for **every** nested `<MotionConfig>`, not just skipAnimations ones.
- Confirm `skipAnimations` did not leak into the shared `mergedTransition`
  derived (it must not reach the projection adapter).
- Confirm the post-mount sync `$effect` in `_MotionContainer.svelte` is
  declared **after** the mount effect — `VisualElement.mount()` latches
  `shouldSkipAnimations` and would otherwise overwrite it.

## Outstanding for the operator

- **No changeset written.** `.changeset/` was out of the plan's scope, but the
  inheritance change is **breaking** for anyone using a bare nested
  `<MotionConfig>` as a reset. Needs a changeset and a release-note callout
  before publish.
- **`owned-child` e2e flake** — unrelated to this work; deserves its own issue.
- **No PR opened** — awaiting the operator's live sign-off.
