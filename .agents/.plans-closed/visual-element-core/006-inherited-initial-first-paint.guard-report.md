# Guard report — 006 inherited-initial-first-paint

**Recommendation: PASS** — red-first discipline held (test failed exactly as
specified, then went green), the fix is upstream's own context split, and the
collateral surface is untouched.
**Reviewed at** `a100cbc` · 2026-07-25 13:14 · **Plan planned at** `9cdc0ee`
**Integrated** — no PR by operator policy; the operator's §2 tour re-check is
the final human gate for this plan.

## Done criteria

| Criterion                                                               | Result                                 | Evidence (guard-reproduced)                                                                                                                                   |
| ----------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` exits 0                                                    | met                                    | 0 errors, warnings at 33 baseline (executor-run, hooks green on all commits)                                                                                  |
| `pnpm test:only` exits 0                                                | met                                    | 813 passed (guard re-run)                                                                                                                                     |
| Red test failed at Step 1 for the specified reason, passes 3× after fix | met                                    | executor: `Expected: < 0.05, Received: 1` at `c708576`; 3/3 green after `3e49306`; guard re-ran the variants suite: **8/8** incl. the new spec                |
| `pnpm test:e2e e2e/variants e2e/motion e2e/animate-presence` exits 0    | met                                    | executor: 141 passed / 1 skipped / 0 failed; guard re-ran `e2e/variants` (the collateral core): 8/8 incl. notifications-stack first-click + stagger-interrupt |
| `context: {` carries `initial` alongside `animate`                      | met                                    | container passes `{ initial: inheritedInitial, animate: effectiveAnimate }`                                                                                   |
| `ve-signoff/` untouched                                                 | met — **after a self-caught incident** | guard verified: `git log --all -- src/routes/tests/ve-signoff/` → 0 commits; still untracked; 419 lines on disk                                               |
| README status row updated                                               | met                                    | 006 → DONE (`a100cbc`)                                                                                                                                        |

## Spirit

Delivered precisely. The canonical pattern (parent `initial="closed"`,
children with only `variants`) now first-paints children at the inherited
pose and animates the first expand — the operator-found sign-off blocker.
The fix is the missing half of upstream's `getCurrentTreeVariants` contract,
implemented as a plain (non-reactive) context value with the correct
rationale documented in-code, and `initial={false}` deliberately left on its
separate boolean channel — which is exactly why `notifications-stack` is
unaffected. SSR was verified already-correct by measurement (server HTML
carries `opacity: 0; transform: translateY(24px)`), so no serializer work.

## Scope & conduct

- In-scope only: yes — and `visualElementCore.ts` (explicitly fenced) is
  untouched.
- Red-first: honored, with the test commit (`c708576`) landing before the
  fix commit (`3e49306`).
- **Incident, self-caught and disclosed**: a `git add -A` swept the
  operator's untracked tour page into the fix commit; the executor caught it
  during done-criteria verification, `git rm --cached` + amended (its own
  commit — allowed), and verified the page byte-identical. Guard
  independently confirmed: zero commits anywhere reference the path, file
  intact. Lesson (explicit `git add` paths) noted by the executor itself.
- Judgment call endorsed: the executor DECLINED to add a misleading "SSR
  pin" to a jsdom-rendering harness and said why — the curl measurement is
  the honest evidence. Correct refusal.

## Residual risk / follow-ups

- The new context channel resolves once at creation (`untrack`ed), matching
  upstream's memoization — a future feature that makes `initial` labels
  reactive post-mount would need a store here (unlikely; upstream doesn't
  support it either).
- If a true server-render test harness is ever added, pin the SSR
  inherited-initial output there (deliberately not faked in the jsdom
  harness).
