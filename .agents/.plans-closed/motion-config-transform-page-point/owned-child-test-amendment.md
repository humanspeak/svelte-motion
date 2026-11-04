# Approved owned-child timing amendment — 2026-09-08

User approved: “Yes, lets touch the test”. Reviewed baseline `b5a30a38`, production `2f191d3b`.

The first full-browser failure expected opacity <0.95 at a fixed 120 ms, observed 0.98175. T3 showed the correct fade of the original node, no clone, and completed removal; three unchanged focused repeats passed. See snap-integration-full-browser.log and owned-child-focused-repeat.log. The required user behavior-versus-test decision is resolved: treat this as timing-sensitive test sampling.

Write only the first test, `retains and exits the original node without creating a clone`, in e2e/animate-presence/owned-child.spec.ts. Replace the 120 ms wait plus immediate opacity sample with bounded polling for the same strict <0.95 threshold, up to 500 ms with short intervals. Check original-node identity and no clones while the fading node still exists, then retain eventual removal and exits completed:1. Preserve the initial 900 ms enter settle, mounting readiness and all other tests byte-identically. No runtime/demo/dependency or other test changes.

Guard snapshots the test, reads the diff, runs this file and resumes the full 450-test browser gate with max-failures=1. No new full-suite failure may be silently fixed; continue the repository one-page-at-a-time T3/user review process. Previously reproduced production parity, units, builds/docs and static gates remain valid because no production code changes. All verification gates remain mandatory; no PR/push without authorization.
