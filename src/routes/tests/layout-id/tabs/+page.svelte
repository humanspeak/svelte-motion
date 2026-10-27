<script lang="ts">
    import { page } from '$app/state'
    import { motion } from '$lib'

    // Port of upstream motion `dev/react/src/tests/issue-1411-tabs.tsx` @
    // v14.7.1 (https://github.com/motiondivision/motion/issues/1411, commits
    // 7f85889ed and 32abe31f7).
    //
    // Tabs where every tab renders its highlight, and only the selected one
    // has the layoutId. When the selection changes, the new highlight animates
    // from the old one, with or without `layout` (`?layout=true`).
    // e2e/layout-id/tabs.spec.ts.

    const layout = page.url.searchParams.get('layout') === 'true'

    let selected = $state('a')
</script>

<svelte:head>
    <title>layoutId · tabs without conditional rendering (#1411)</title>
</svelte:head>

<div style="position: relative;">
    {#each ['a', 'b'] as id, i (id)}
        <button
            id={'select-' + id}
            type="button"
            onclick={() => (selected = id)}
            style="position: absolute; top: 0; left: {i * 300}px;"
        >
            {id}
        </button>
    {/each}
    {#each ['a', 'b'] as id, i (id)}
        <motion.div
            {id}
            layout={layout || undefined}
            layoutId={selected === id ? 'highlight' : undefined}
            transition={{ duration: 1, ease: 'linear' }}
            style="position: absolute; top: 50px; left: {i *
                300}px; width: 100px; height: 100px; background: {selected === id
                ? 'red'
                : 'transparent'};"
        />
    {/each}
</div>
