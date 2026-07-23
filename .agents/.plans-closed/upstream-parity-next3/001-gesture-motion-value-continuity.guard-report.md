# Guard report — 001 gesture-motion-value-continuity

**Recommendation: PASS (with post-approval addendum)** — red velocity-signature
spec verified (no post-press climb under re-seeding), all done criteria
reproduced, contract specs green, docs example shipped and registered.
**Reviewed at** exec/parity-001 `2003b05` (integrated as `6cc5c82`) · 2026-07-23 · **Planned at** `0058f78`
**Integrated** — cherry-picked to feature-parity; shipped in PR #453.

## Done criteria (at review)

| Criterion                                     | Result | Evidence                                                                  |
| --------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| Unit suite green                              | met    | Guard reproduced: 669 (utils scope)                                       |
| Red spec failed at plan time, passed post-fix | met    | Guard red-run at `4ca6940` → both velocity tests failed; restored → green |
| Contract e2e set                              | met    | Guard reproduced: 7 passed (subset) + executor's 26 ×2                    |
| No computed-style seeding on animate path     | met    | `readChannelStart` creation-only                                          |
| Docs example registered + themed              | met    | velocity-interrupts page, pager slot verified                             |

## Spirit

Persistent per-channel MotionValues retargeted via `animateMotionValue`;
velocity carries through hover↔tap handoffs. Executor discovered and worked
around the upstream `isTransitionDefined` velocity trap; documented the
release-path residual honestly (deferred to #449).

## Post-approval addendum (defects found later, fixed on-branch)

The guard gates were too narrow; three defects in this plan's work surfaced
after approval, each fixed red-first in PR #453:

1. **Tap-cancel frozen-value snap** (maintainer eye-test): motion-dom defers
   hover-end past an active press; the deferred restore launched from a
   MotionValue frozen at press-interrupt (~0.59 one-frame snap). Fixed:
   idle-value jump-sync (`caf0e6f` + `45902ae`).
2. **Velocity handoff dropped value-specific transitions** (Codex adversarial
   review): `withHandoffVelocity` spread the whole base instead of resolving
   `base[key] ?? base.default ?? base`. Fixed (`345bc48` + `596d566`).
3. **Unit-spec debt**: `_MotionContainer.spec.ts` hover tests were never
   rewired from `animateValue` to `animateMotionValue` — silently red because
   guard gates ran utils-scope only. Repaired (`3eef5e9`).

**Process lesson recorded**: guard gates must include the FULL unit suite and
the cross-system spec set, not the plan's scoped subset.

## Scope & conduct

In-scope + authorized docs extension only; keyboard/synthetic-event red-test
methodology sound; port discipline held (4331, never 4198). Executor conduct
exemplary — both post-approval gesture defects were in territory the plan
explicitly deferred or under-specified, not deviations.
