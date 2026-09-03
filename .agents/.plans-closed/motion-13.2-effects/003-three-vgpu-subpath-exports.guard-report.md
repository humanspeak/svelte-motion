# Guard report — 003 three-vgpu-subpath-exports

**Recommendation: PASS** — both adapter subpaths are published, typed for augmented values, tested for identity and claim behaviour, and verified free of any runtime `three`/`vgpu` import; every done criterion reproduced green by guard.
**Reviewed at** 315c929 · 2026-09-03 13:10 · **Plan planned at** 7d09c0d (re-baselined from 47b7149; revision 2 made the docs step unconditional)
**Integrated** — no PR: batch convention is one branch → one PR when the last plan passes. Snapshot `315c929` on `chore/upstream-motion-13.2.0`, unpushed.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `pnpm exec vitest run src/lib/three.spec.ts src/lib/vgpu.spec.ts` → all pass | met | 2 + 2 tests green inside the full run |
| `pnpm check` → `0 ERRORS`; `pnpm test:only` → all pass | met | svelte-check 0 errors (pre-commit hook on snapshot); 77 files / 866 tests |
| `pnpm package` → `All good!`; the four `dist/three.*` / `dist/vgpu.*` files exist | met | publint `All good!`; `ls` lists all four |
| `grep -n '"./three"'` and `'"./vgpu"'` in `package.json` each match | met | lines 78 and 82 |
| `grep -c "from 'three'" dist/three.js` → `0` | met | 0 for single and double quotes |
| `.changeset/three-vgpu-subpaths.md` exists | met | present, `minor` |
| No files outside the in-scope list modified | met | `git show --stat 315c929`: exactly the seven in-scope files |
| Status row updated in batch README | met | updated by guard (executor's `.agents/**` is read-only) |

Additional: `trunk check` on the seven files `✔ No issues`; docs typecheck shows no errors in the edited `custom-effects` page.

## Spirit

The plan's intent was to let Svelte consumers reach Motion 13.2's `threeEffect` and `vgpuEffect` without installing `motion` themselves (which would risk a second `motion-dom` copy and a split registry/frameloop), while keeping the adapters off the root bundle. Delivered: `src/lib/three.ts` and `src/lib/vgpu.ts` are pure casts of the upstream exports using the intersection re-type from 001, re-exporting upstream's helper types; `package.json` maps `./three` and `./vgpu` with `types` + `default` conditions exactly like the existing `./vite` subpath; nothing is added to `src/lib/index.ts`. The identity tests guarantee runtime equality with upstream, the claim matrix guards upstream's duck-typing contract, and the dist grep is the tripwire for a future runtime dependency. The docs section teaches the import path and that `three`/`vgpu` remain consumer dependencies. No gap.

## Scope & conduct

- In-scope only? Yes — seven files, all listed in Scope.
- STOP conditions respected? None triggered.
- Plan amendments during execution: none beyond the two pre-dispatch revisions (baseline re-stamp; docs step unconditional).
- The executor noted it could not re-create the Step 1 red state after implementing; guard accepts the ordered-run capture (`Cannot find module './three.js'`) since the step order is inherent to the plan and the post-state is fully verified.

## Residual risk / follow-ups

- On future `motion` bumps, re-run `grep -nE '^export' node_modules/motion/dist/three.d.ts` and mirror new named exports (plan's maintenance note).
- `vgpu` is pre-1.0; the subpath tracks upstream's adapter only — no example until it stabilises (batch README rejection list).
- Plan 004 consumes `@humanspeak/svelte-motion/three` for the flagship example.
