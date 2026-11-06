# Guard report — 001 bump-motion-14-10-1

**Recommendation: PASS** — pins at 14.10.1 and version 2.10.0. The three timeline pins are red on 14.9.1 and green on 14.10.1 (reproduced). The only e2e failures were load-induced frame-capture flakes.
**Reviewed at** 988f2e01 · 2026-11-06 14:16 · **Plan planned at** d66a17dd (amended 2026-11-06; originally f93a1d92)
**Integrated** — committed on `feat/motion-14.10.1`. No PR mid-batch.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Two `"14.10.1"` pins and version `2.10.0` | met | `grep -c` → 2; `2.10.0 14.10.1 14.10.1` |
| `pnpm check` 0 errors | met | 1829 files, 0 errors |
| `pnpm test:only` all pass incl. 3 timeline tests | met | 1584/1584 |
| Full chromium e2e no new failures | met (with note) | 920 passed / 2 failed under load. Both failures were re-run and classified as load flakes: frame recorder under-sampling, not jump or behaviour assertions. Fix-dispatch's run: 921/0. |
| Only in-scope files | met | pins, lockfile, `motionDomSsr.spec.ts`, `index.ts`, `timelineFixes.spec.ts`, changeset |
| Changeset exists | met | `.changeset/motion-14-10-1.md` |

## Spirit

The bump delivers the free 14.10.1 fixes and pins the user-visible ones with tests that fail on the old pin. The SSR mock fix keeps `start` and adds only `run`. Press types are exported for plan 002 and for vanilla users.

## Scope & conduct

- In scope: yes. The executor's tap-during-drag files were left out at integration, per the amendment.
- STOP respected: yes. The executor correctly stopped when tap-during-drag stayed red on 14.10.1.
- Plan amendments: 2026-11-06. Dropped tap-during-drag, because upstream React also fires onTap there (drag registers its capture-phase pointerup before press). Fixed the version-check command. Operator agreed.

## Residual risk / follow-ups

- Watch `pop-layout-scroll-siblings.spec.ts:909` in the batch-final quiet e2e run. It flaked 3 times under load on 14.10.1 and 0 of 6 times on 14.9.1. All failures were in frame capture, but confirm it once the machine is quiet.
