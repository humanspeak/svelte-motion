# Guard report — 001 reorder and runtime parity

**Recommendation: PASS** — Motion 13.1 Reorder parity and inherited runtime outcomes are implemented, manually reviewed, and covered by green focused and CI gates.
**Reviewed at** `1fb2a4f` · 2026-08-12 18:16 · **Plan planned at** `1fb2a4f` (revised from `96b166c`)
**Integrated** — [PR #469](https://github.com/humanspeak/svelte-motion/pull/469) opened via the `pr` skill for the reviewed snapshot commit.

## Done criteria

| Criterion                                                                                                       | Result | Evidence                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json` resolves `motion` 13.1.0 and `motion-dom` 13.0.0 through the lockfile.                           | met    | `pnpm-lock.yaml:3471,7634` and `pnpm-lock.yaml:3465,7628`.                                                                                                                                       |
| Public `ReorderAxis` is documented and equals `'x' \| 'y' \| 'xy'`.                                             | met    | `src/lib/components/Reorder/types.ts:8`; exported from `src/lib/index.ts`.                                                                                                                       |
| Omitting `axis` automatically detects horizontal, vertical, and wrapped layouts.                                | met    | `detectAxis.spec.ts`, component coverage, and `axis-auto.spec.ts`; Reorder e2e 22/22.                                                                                                            |
| `axis="xy"` reorders within and across wrapped rows.                                                            | met    | `checkReorder.spec.ts`, `grid.spec.ts`, and operator review of `/tests/reorder/grid`.                                                                                                            |
| Horizontal and wrapped reordering behave correctly in RTL without reversing `values`.                           | met    | `rtl.spec.ts` covers two continuous swaps and sibling FLIP; operator reviewed `/tests/reorder/rtl`.                                                                                              |
| Unmeasured values, Svelte unregistration, item drag overrides, and edge auto-scroll remain covered and passing. | met    | `order.spec.ts`, `reorder.component.spec.ts`, `autoScroll.spec.ts`, and Reorder browser suite.                                                                                                   |
| Three new test/demo routes exist, are linked, and each has a passing e2e spec.                                  | met    | Links at `src/routes/+page.svelte:346,354,362`; `axis-auto`, `grid`, and `rtl` e2e passed.                                                                                                       |
| Public Reorder docs/examples describe and demonstrate Motion 13.1 behavior.                                     | met    | `/docs/reorder` and `/examples/reorder` include automatic axis, grid, and RTL demos; operator reviewed locally.                                                                                  |
| Motion 12.43/13.0 inherited SVG/color/presence outcomes have passing focused regression coverage.               | met    | SVG 27/27; exact final-style test 3/3 with hydration wait; presence 73/74 under load with the sole existing timing sample passing 3/3 isolated.                                                  |
| Repository release gates exit successfully.                                                                     | met    | PR #469: unit, build, docs-build, Trunk, and both e2e shards passed; local unit suite 815/815, direct `svelte-check` 0 errors, docs build passed, package/publint passed via installed binaries. |
| `git diff --check` exits 0 and scope is clean.                                                                  | met    | Reproduced after final source commit; all scope expansions are recorded operator-approved revisions.                                                                                             |
| Sibling batch status is updated.                                                                                | met    | Batch README marks Plan 001 DONE and carries the CLOSED note.                                                                                                                                    |

## Spirit

The diff delivers the compatibility promise behind the plan rather than merely
adding API surface. Automatic axis selection, wrapped rows, and nested RTL work
with logical consumer order, while repeated swaps preserve the dragged item under
the pointer and FLIP every newly displaced sibling. The inherited SVG change is
also observable rather than hidden in a test: the public Signal Dock example
shows the browser's committed opacity, transform, and fill.

## Scope & conduct

- In-scope only? Yes, including the operator-approved revision for shared
  projection continuity and the expanded SVG documentation/example.
- STOP conditions respected? Yes. The local pnpm native-wrapper identity failure
  was not worked around by changing the lockfile; equivalent installed binaries
  and GitHub CI supplied the release-gate evidence.
- Plan amendments during execution: 2026-08-12 operator-approved
  `_MotionContainer.svelte`/drag regression work and expanded SVG docs/demo;
  close-out baseline revised from `96b166c` to `1fb2a4f`.

## Residual risk / follow-ups

- The local pnpm wrapper still cannot verify `@pnpm/exe.darwin-x64`; this is an
  environment/tooling issue, while PR CI passes with the repository toolchain.
- One pre-existing AnimatePresence assertion samples opacity at a fixed 120 ms
  threshold and missed once under a 101-test local run; it passed 3/3 isolated
  and the PR e2e shards are green.
