<script lang="ts">
    import { Reorder } from '@humanspeak/svelte-motion'

    let items = $state(['🍅 Tomato', '🥒 Cucumber', '🧀 Cheese', '🥬 Lettuce'])
</script>

<div class="flex flex-col items-center gap-4">
    <p class="text-text-muted text-sm">Drag items to reorder the list</p>
    <Reorder.Group
        axis="y"
        values={items}
        onReorder={(next: string[]) => (items = next)}
        class="m-0 w-64 list-none p-0"
    >
        {#each items as item (item)}
            <Reorder.Item
                value={item}
                whileDrag={{ scale: 1.03 }}
                class="mb-2 flex h-11 cursor-grab items-center rounded-lg bg-white px-4 text-sm font-medium text-neutral-900 shadow select-none"
            >
                {item}
            </Reorder.Item>
        {/each}
    </Reorder.Group>
</div>
