<script lang="ts">
    import { Reorder } from '@humanspeak/svelte-motion'

    // The motion.dev Reorder demo: drag items vertically to reorder the
    // list. Dragged items pin under the cursor while siblings FLIP out
    // of the way; releasing springs the item into its new slot.

    let items = $state(['🍅 Tomato', '🥒 Cucumber', '🧀 Cheese', '🥬 Lettuce'])
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <Reorder.Group
        axis="y"
        values={items}
        onReorder={(next: string[]) => (items = next)}
        style="list-style: none; padding: 0; margin: 0; width: 260px;"
    >
        {#each items as item (item)}
            <Reorder.Item
                value={item}
                whileDrag={{ scale: 1.03, boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }}
                style="display: flex; align-items: center; height: 44px; padding: 0 16px; margin-bottom: 10px; background: white; color: #0f1115; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); cursor: grab; user-select: none; -webkit-user-select: none; font-weight: 500;"
            >
                {item}
            </Reorder.Item>
        {/each}
    </Reorder.Group>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 320px;
    }
</style>
