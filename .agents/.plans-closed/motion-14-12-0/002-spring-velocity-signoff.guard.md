# Guard log: plan 002 (spring velocity sign-off)

- **Executor**: Claude Opus 5.5, harness worktree `t3/feed35c0`, cut from `dd040bf0`.
- **Guard**: session agent, 2026-11-12.
- **Commits judged**: `9e66fc4d`, `8d15e040`.

## Final pass

| Done criterion | Reproduced by guard | Result |
| --- | --- | --- |
| `pnpm check` → 0 errors | 0 errors, 34 warnings (none in the new files) | PASS |
| `e2e/motion/spring-velocity.spec.ts` → 4 passed | 4/4 on three runs, `PW_PORT=4265`, after the merge with plan 003 | PASS |
| Index links the page | one link in the Motion section | PASS |
| Docs notes in `use-spring` and gestures "Interrupts carry momentum" | read in the diff | PASS |
| `pnpm build`, `pnpm --dir docs check` | build exit 0, publint "All good!"; docs check 0 errors, 13 warnings | PASS |
| `pnpm --dir docs build` | Not re-run by guard; the executor reported exit 0. The batch's full verification runs it. | executor's run |
| Only in-scope files changed | `git diff --stat dd040bf0..8d15e040` lists the five in-scope files | PASS |

## Fidelity to upstream

The spec ports `tests/animate/time-spring-velocity.spec.ts` at `v14.12.0` (three transitions, upstream's assertions) and adds a `duration: 0.8` guard.

## Deviations

- The `data-testid="stage"` container is created in `onMount` and appended to `document.body`, because Trunk's `svelte/no-dom-manipulating` rejected appending into a markup node. This matches upstream's fixture. No lint-disable, no config change. Accepted.

## Open for sign-off

Not driven by hand yet. The twin (three rows with "Go right" / "Reverse", built on `animate()` from `motion` 14.12.0) is the dispatcher's to build.

## Verdict

PASS. Merged onto `feat/motion-14.12.0` at `5e1c1634` (merge commit; `+page.svelte` auto-merged with plan 003's section).

## Reopened 2026-11-12: the `duration` guard was timing-dependent

While guarding plan 006, guard re-ran this spec and "a duration spring starts from rest and turns back at once" failed, then failed 4 of 10 under `--repeat-each=10` (`after` 1.7 to 12 px above `before`). The first final pass used three single runs, which did not expose it. That pass was too weak.

**Cause** (confirmed by the fix executor with measurements): since Motion 14.12.0 the interrupted animation's `stop()` catches up to now before the reversal starts, so the reversal starts 19 to 29 px right of `before` (the last painted frame). A from-rest spring eases in, so 32 ms later it can still be right of `before`.

**Fix** (`fbe7baa1`, Claude Opus 5.5, worktree `t3/dfe996f2`): `run` also returns `atReverse`, read synchronously after the reversing `animate()`. The duration guard asserts `after < atReverse` for x and opacity. The page's live verdict uses `atReverse` too, and counts "kept moving right" if the box passed it in either of the first two frames. `before`, `after`, `final` and the three ported tests are unchanged.

**Guard verification**: `pnpm check` 0 errors; `--repeat-each=30` on `PW_PORT=4265` → 120 passed, with another lane running Playwright. Only the page and the spec changed. Executor's scripted clicks (12 per row, twice): physics 12/0, visualDuration 12/0, duration 0/12.

**Known weakness, not fixed**: the three upstream-ported "inherits velocity" tests assert `after > before`. The executor measured that a spring which does NOT inherit velocity meets that on x in 3 of 7 runs, because of the same catch-up. So they cannot reliably catch a regression; the deterministic unit tests in `src/lib/utils/springVelocity.spec.ts` are the real guard. Follow-up: add our own `after > atReverse` assertion beside upstream's.

**Verdict**: PASS (second pass). Fast-forwarded onto `feat/motion-14.12.0` at `fbe7baa1`.
