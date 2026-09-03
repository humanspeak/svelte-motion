# Guard log — 003 three-vgpu-subpath-exports

Plan: `.agents/.plans/motion-13.2-effects/003-three-vgpu-subpath-exports.md`
Executor: Codex (fresh thread, `codex-dispatch-003.txt`), dispatched 2026-09-03 13:02 at branch tip `317ea87`.

## Checkpoint 1 — 2026-09-03 13:10 — ON TRACK (final)

`315c929` · single-run completion; guard snapshot then local reproduction of every done criterion.

- Executor report: all four steps completed, no STOP hit; executor could not run `trunk fmt` (sandbox cache) or any browser/docs visual check. Relayed verbatim.
- Pre-flight (before dispatch): drift baseline `7d09c0d` verified empty for `package.json`, `src/lib/utils/effects.ts`, `src/lib/vite.ts`; docs step made unconditional (revision 2) because `/docs/custom-effects` landed in 002.
- Snapshot: exactly the seven in-scope files (107 insertions, 0 deletions) committed as `315c929`; pre-commit hook (trunk + svelte-check) passed.
- Reproduced by guard:
  - `pnpm test:only` → 77 files / 866 tests (862 + 4 new); `three.spec.ts` 2, `vgpu.spec.ts` 2.
  - `pnpm package` → publint `All good!`; `dist/three.{js,d.ts}` and `dist/vgpu.{js,d.ts}` present.
  - `grep -c "from 'three'" dist/three.js` → 0 (both quote styles) — no runtime Three.js dependency leaked.
  - `package.json` exports `./three` at line 78 and `./vgpu` at line 82, `types` + `default` conditions mirroring `./vite`.
  - `.changeset/three-vgpu-subpaths.md` present, `minor`.
  - `trunk check --no-progress` on the seven files → `✔ No issues`.
  - `cd docs && pnpm check` → zero errors attributable to `custom-effects` (the five pre-existing errors in unrelated demos remain, as recorded in 002's report).
  - `pnpm check` → 0 errors (hook run on the snapshot tree).
- Read the whole diff: both subpath modules are pure casts using the `typeof core & (widened signature)` house pattern from 001; JSDoc explains claim rules, `frame.preRender` timing, and that `three`/`vgpu` stay consumer dependencies; the three spec's claim matrix exercises `isObject3D`, `isMaterial`, a uniforms object, and a negative; the docs section sits before `## Related` as required. No wrapper functions, no root-barrel export (by design).
- Verdict: **PASS** — see the guard report. No PR (one branch → one PR at batch end).
- Action: README row → DONE; plan 004 pre-flight (guard runs its Step 1 dependency install, re-baselines drift to the deps commit).
