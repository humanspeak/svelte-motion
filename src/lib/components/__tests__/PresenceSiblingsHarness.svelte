<script module lang="ts">
    // Constant objects: a new transition object counts as a prop change and
    // re-snapshots the items.
    const fastExit = { duration: 0.05 }
    const slowExit = { duration: 2 }
</script>

<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import LayoutGroup from '$lib/components/LayoutGroup.svelte'
    import { motion } from '$lib/motion'

    /**
     * Plan 015b: `layout` siblings around an exit, for
     * `presenceSiblingSnapshots.spec.ts`.
     *
     * `#head-wrap > motion.div layout #header`, then a `motion.ul #list` of
     * `items` `motion.li layout #item-N` (N from 1), then
     * `#foot-wrap > motion.div layout #footer`. Every box carries `data-box`
     * so the spec can lay it out (jsdom has no layout).
     *
     * - `clone`: one `AnimatePresence` around a keyed `{#each}` (exit clones).
     *   Otherwise each item sits in its own `<AnimatePresence present>` (the
     *   owned path: the real element exits).
     * - `remove`: the ids that are leaving.
     * - `addLast`: appends item `items + 1`, in the same update as the props
     *   change.
     * - `layoutGroup`: wraps everything in one `LayoutGroup`.
     * - `footerInList`: the footer sits directly in the list's parent.
     * - `nested`: item 2 holds an inner `AnimatePresence` with
     *   `motion.div layout #inner`.
     * - `gateItem2`: `layoutDependency={1}` on item 2.
     * - `slow`: a 2s exit tween instead of 50ms.
     */
    let {
        items = 3,
        remove = [],
        addLast = false,
        mode = 'popLayout',
        clone = false,
        layoutGroup = false,
        footerInList = false,
        nested = false,
        gateItem2 = false,
        slow = false
    }: {
        items?: number
        remove?: number[]
        addLast?: boolean
        mode?: 'popLayout' | 'sync'
        clone?: boolean
        layoutGroup?: boolean
        footerInList?: boolean
        nested?: boolean
        gateItem2?: boolean
        slow?: boolean
    } = $props()

    const ids = $derived([
        ...Array.from({ length: items }, (_, index) => index + 1),
        ...(addLast ? [items + 1] : [])
    ])
    const shown = $derived(ids.filter((id) => !remove.includes(id)))
</script>

{#snippet item(id: number)}
    <motion.li
        key={String(id)}
        id="item-{id}"
        data-box="item-{id}"
        layout
        layoutDependency={gateItem2 && id === 2 ? 1 : undefined}
        exit={{ opacity: 0 }}
        transition={slow ? slowExit : fastExit}
    >
        {#if nested && id === 2}
            <AnimatePresence>
                <motion.div key="inner" id="inner" data-box="inner" layout />
            </AnimatePresence>
        {/if}
    </motion.li>
{/snippet}

{#snippet footer()}
    <motion.div id="footer" data-box="footer" layout />
{/snippet}

{#snippet body()}
    <div id="head-wrap">
        <motion.div id="header" data-box="header" layout />
    </div>
    <motion.ul id="list">
        {#if clone}
            <AnimatePresence {mode}>
                {#each shown as id (id)}
                    {@render item(id)}
                {/each}
            </AnimatePresence>
        {:else}
            {#each ids as id (id)}
                <AnimatePresence present={!remove.includes(id)} {mode}>
                    {#snippet child()}
                        {@render item(id)}
                    {/snippet}
                </AnimatePresence>
            {/each}
        {/if}
    </motion.ul>
    {#if footerInList}
        {@render footer()}
    {:else}
        <div id="foot-wrap">
            {@render footer()}
        </div>
    {/if}
{/snippet}

<div id="root">
    {#if layoutGroup}
        <LayoutGroup>
            {@render body()}
        </LayoutGroup>
    {:else}
        {@render body()}
    {/if}
</div>
