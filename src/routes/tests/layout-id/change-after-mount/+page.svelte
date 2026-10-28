<script lang="ts">
    import { page } from '$app/state'
    import { motion } from '$lib'
    import { onMount } from 'svelte'

    // Port of upstream motion `dev/react/src/tests/issue-1411.tsx` @ v14.7.1
    // (https://github.com/motiondivision/motion/issues/1411, fixed in Motion
    // 14.7.1 by commits 7f85889ed, 32abe31f7 and c3b7305ba).
    //
    // A layoutId changed after first render should be honoured.
    // - `?changed=true` (default): layoutId starts as "initial" and is set to
    //   "shared" after mount.
    // - `?changed=false`: layoutId is "shared" from the start (control).
    // - `?away=true`: layoutId starts as "shared" and is set to "other".
    // - `?late=true`: the change waits for a click on #change instead of mount.
    // - `?bid=<id>`: B's layoutId (default "shared").
    // e2e/layout-id/change-after-mount.spec.ts.

    const params = page.url.searchParams
    const changed = params.get('changed') !== 'false'
    const away = params.get('away') === 'true'
    const late = params.get('late') === 'true'
    const bid = params.get('bid') || 'shared'
    const target = away ? 'other' : 'shared'

    let layoutId = $state(changed && !away ? 'initial' : 'shared')
    let showB = $state(false)

    onMount(() => {
        if (!late) layoutId = target
    })

    const transition = { type: 'tween' as const, ease: 'linear' as const, duration: 10 }
</script>

<svelte:head>
    <title>layoutId · change after mount (#1411)</title>
</svelte:head>

<div id="stage" style="position: relative; width: 600px; height: 400px;">
    <button id="toggle" type="button" onclick={() => (showB = true)}>toggle</button>
    <button id="change" type="button" onclick={() => (layoutId = target)}>change</button>
    <span id="current-id">{layoutId}</span>
    {#if !showB}
        <motion.div
            id="a"
            {layoutId}
            {transition}
            style="position: absolute; top: 50px; left: 0; width: 100px; height: 100px; background: red;"
        />
    {:else}
        <motion.div
            id="b"
            layoutId={bid}
            {transition}
            style="position: absolute; top: 50px; left: 400px; width: 100px; height: 100px; background: blue;"
        />
    {/if}
</div>
