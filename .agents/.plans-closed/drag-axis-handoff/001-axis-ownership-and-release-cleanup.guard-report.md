# Guard report — drag-axis-handoff 001

**Recommendation: PASS** — both Codex HIGH findings repaid red-first with
upstream-verified semantics; the plan's verify-don't-assume clause worked
exactly as designed, falsifying the plan's own sketch and correcting it to
what upstream actually does.
**Reviewed at** `226ee22` · 2026-07-26 08:06 · **Plan planned at** `41b2b20`
**Integrated** — pushed to PR #459 after this gate (see below); merging
remains the operator's call.

## Done criteria

| Criterion                                            | Result | Evidence (guard-reproduced)                                                                                                                                                                                                   |
| ---------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck/trunk/unit green                           | met    | 0 errors; trunk "No issues" (40 files); guard re-run unit **781 passed**                                                                                                                                                      |
| Three red specs, named signatures, now pass (b/c 3×) | met    | red evidence: (a) drift 203.5px with samples; (b) y settled 0.0 with trace; (c) x froze 315.1 vs 420 target; red commit `6c40703` FIRST in history; executor 3× green; guard re-run axis-handoff 4/4 + hover-during-glide 2/2 |
| `e2e/drag e2e/reorder` green; full directory green   | met    | guard re-run **87/1/0**; executor full sweep **388/2/0** (one transient flake in guard's first chained run, absent on focused re-run — known load-flake class, ledgered previously)                                           |
| Drag-start ownership stop with upstream citation     | met    | per-axis `value.stop()` before origin capture (`8b19f7a`); `stale-velocity`/`settle-cancel`/`snap-to-origin` all green (re-grab continuity intact)                                                                            |
| `setWhileDragActive(false)` precedes release starts  | met    | `5613be7`, upstream cancel-then-startAnimation order                                                                                                                                                                          |
| One idempotent cleanup, four routes pinned           | met    | `f76a912`; routes 3–4 verified red against `5613be7`, 1–2 characterization; disarm identity-guarded                                                                                                                           |
| README row updated; nothing pushed pre-gate          | met    | DONE row; push happens post-gate by guard                                                                                                                                                                                     |

## Spirit

Delivered, and the run's centerpiece is epistemically exactly right: the
plan sketched "`onDragTransitionEnd` fires exactly once on interruption" but
ordered the executor to verify motion-dom's promise semantics and match
upstream. Verification (guard re-confirmed both citations): `JSAnimation.stop()`
fires `onStop`, never `onComplete`; `MotionValue.start()` resolves only from
`onComplete`; therefore upstream's `Promise.all(...).then(onDragTransitionEnd)`
NEVER fires for an interrupted release — upstream SKIPS it. The landed specs
assert 0-on-interruption, matching upstream, with the mechanism being the
plan's sanctioned fallback (the value's `animationStart`/`animationCancel`
events). The inherited artifacts from the interrupted predecessor were
assessed, kept where sound, and re-tuned where the failure was fixture
physics rather than code (probed: y still travelling at 627px when the old
fixture's assertion ran). One beyond-letter fix, endorsed: a handed-off axis
is not painted by the departing gesture ("only an owner paints",
`226ee22`) — found by reading, validated by the second full sweep.

## Scope & conduct

- In-scope only; PR #459's pre-existing commits untouched; `isSync`
  byte-identical (verified: `dragInertia.ts` not in the diff).
- Red-first literal: red commit precedes every fix commit in history; (b)'s
  retuned form was re-verified red against pre-fix code so the evidence
  isn't stale.
- Scenario (c) consolidation (inherited stale-cancel framing folded into
  ONE spec covering all three plan clauses + upstream-matched semantics):
  endorsed — the plan's "three specs, all red" holds literally.
- Disclosed incident: a `git checkout` revert-probe discarded an uncommitted
  edit; re-applied and re-verified before committing; later probes used a
  scratchpad copy. No committed damage.
- Continuity note: this plan was executed by a FRESH runner after the
  veteran runner was cut down by four consecutive server-side 529s — the
  self-contained-plan design carried the handoff with zero context loss.

## Residual risk / follow-ups

- `onDragTransitionEnd` now matches upstream's skip-on-interruption — if
  consumers relied on our (never-documented) always-fires behavior, that is
  an upstream-parity change; note in PR #459.
- The transient drag/reorder flake seen once in the guard chain joins the
  ledgered sampling-flake follow-up (batch 004's finding).
