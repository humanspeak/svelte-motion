<script lang="ts">
    import { LayoutGroup } from '$lib'
    import { motion } from '$lib/motion'

    /**
     * Harness for plan 006 (#1411): a keyed list of `motion.div`s whose
     * `layoutId` (and `layout` / `layoutDependency`) can change after mount,
     * optionally inside a `LayoutGroup`. Port of the components rendered by
     * upstream `layout-id-change.test.tsx` @ v14.7.1.
     */
    type Item = { key: string; layoutId?: string; layout?: boolean; layoutDependency?: unknown }

    let { items, group }: { items: Item[]; group?: string } = $props()
</script>

{#snippet list()}
    {#each items as item (item.key)}
        <motion.div
            id={item.key}
            layoutId={item.layoutId}
            layout={item.layout}
            layoutDependency={item.layoutDependency}
        />
    {/each}
{/snippet}

{#if group}
    <LayoutGroup id={group}>
        {@render list()}
    </LayoutGroup>
{:else}
    {@render list()}
{/if}
