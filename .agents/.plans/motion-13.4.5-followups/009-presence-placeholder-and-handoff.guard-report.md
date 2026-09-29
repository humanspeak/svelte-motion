# Guard report — 009-presence-placeholder-and-handoff

**Recommendation: PASS** — placeholder keeps margins/placement after detach (40px mid-exit hop gone), same-update handoff parity pinned, demos linked
**Reviewed at** 9a3a8df5 · 2026-09-29 11:22 · **Plan planned at** 4b58380b
**Integrated** — committed on chore/motion-13.4.5; PR awaits maintainer sign-off

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Step 1 red then green | met | executor red output; guard rerun green ×3 |
| placeholder margin from snapshot when detached | met | presence.ts computed = lastLayoutStyle when !elementIsLive |
| shift-swap 3/3 | met | guard ×3 |
| pages linked; tester text | met | src/routes/+page.svelte, presence page TesterPanel |
| unit/check/build/full e2e; changeset | met | 1008/1008; 0 errors; full e2e 500 passed; .changeset/presence-placeholder-margins.md |

## Spirit

Removes the visible sibling hop the maintainer rejected, for every sync/wait exit with margins or flex/grid placement, not just the demo.

## Scope & conduct

- In scope; STOP respected (clone-freeze sites reported, not widened).

## Residual risk / follow-ups

- Exit clone style freeze reads the emptied live style after detach (presence.ts:980-985, :1037): detached exits' clones keep only inline styles/classes; parent-dependent styles (e.g. `.list > li` rules, inherited typography) can be lost during the fade.
