<script lang="ts">
    import { motion } from '$lib'

    // Port of upstream motion `dev/react/src/tests/issue-1411-takeover.tsx` @
    // v14.7.1 (https://github.com/motiondivision/motion/issues/1411, commits
    // c3b7305ba and 518b90659).
    //
    // Element A's layoutId changes to "shared" while element B, which already
    // has layoutId "shared", is mounted. A is already on screen, so it takes
    // over as lead instantly, staying where it is, and B, now a follower, is
    // hidden.
    //
    // B has a constant `layoutDependency` so its own update doesn't
    // `willUpdate()` it. The takeover itself must hide B.
    //
    // Deviation: upstream renders this in a nested React root to escape the
    // dev harness's StrictMode double render. Svelte has neither: B's props
    // don't change, so it doesn't update at all.
    // e2e/layout-id/takeover.spec.ts.

    let layoutId = $state('a')

    const transition = { type: 'tween' as const, ease: 'linear' as const, duration: 10 }
</script>

<svelte:head>
    <title>layoutId · takeover (#1411)</title>
</svelte:head>

<div style="position: relative; width: 600px; height: 400px;">
    <button id="change" type="button" onclick={() => (layoutId = 'shared')}>change</button>
    <motion.div
        id="a"
        {layoutId}
        {transition}
        style="position: absolute; top: 50px; left: 0; width: 100px; height: 100px; background: red;"
    />
    <motion.div
        id="b"
        layoutId="shared"
        layoutDependency={1}
        {transition}
        style="position: absolute; top: 50px; left: 400px; width: 100px; height: 100px; background: blue;"
    />
</div>
