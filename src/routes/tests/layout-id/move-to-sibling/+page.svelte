<script lang="ts">
    import { motion } from '$lib'

    // Port of upstream motion `dev/react/src/tests/issue-1411-crossfade.tsx` @
    // v14.7.1 (https://github.com/motiondivision/motion/issues/1411, commits
    // 21bdf13d3 and fd97ac411).
    //
    // An element whose layoutId moves to a sibling must stay visible.
    //
    // Deviation: upstream sets `layoutCrossfade={false}`, so the new lead
    // hides the previous one as it would an unmounting element. svelte-motion
    // has no `layoutCrossfade` prop, so this page guards the default
    // (crossfading) path: the element that gave up the layoutId keeps
    // rendering and must not be left hidden.
    // e2e/layout-id/change-after-mount.spec.ts.

    let selected = $state('a')
</script>

<svelte:head>
    <title>layoutId · moved to a sibling (#1411)</title>
</svelte:head>

<div style="position: relative;">
    <button id="select-a" type="button" onclick={() => (selected = 'a')}>a</button>
    <button id="select-b" type="button" onclick={() => (selected = 'b')}>b</button>
    {#each ['a', 'b'] as id, i (id)}
        <motion.div
            {id}
            layout
            layoutId={selected === id ? 'selected' : undefined}
            transition={{ duration: 0.1 }}
            style="position: absolute; top: 50px; left: {i *
                300}px; width: 100px; height: 100px; background: red;"
        />
    {/each}
</div>
