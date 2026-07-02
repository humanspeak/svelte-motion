<script lang="ts">
    import { motion, Reorder } from '@humanspeak/svelte-motion'

    // A long list inside a fixed-height scroll container. `layoutScroll`
    // keeps layout measurements correct while the container scrolls, and
    // dragging an item near the top or bottom edge auto-scrolls the list
    // so the whole thing can be traversed in one gesture.

    let items = $state([
        'Aardvark',
        'Beaver',
        'Capybara',
        'Dingo',
        'Echidna',
        'Fennec',
        'Gecko',
        'Hedgehog',
        'Iguana',
        'Jackal'
    ])
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <motion.div
        layoutScroll
        style="height: 280px; width: 260px; overflow-y: scroll; padding: 10px; border-radius: 12px; background: rgba(120, 120, 140, 0.12);"
    >
        <Reorder.Group
            axis="y"
            values={items}
            onReorder={(next: string[]) => (items = next)}
            style="list-style: none; padding: 0; margin: 0;"
        >
            {#each items as item (item)}
                <Reorder.Item
                    value={item}
                    whileDrag={{ scale: 1.03, boxShadow: '0 6px 16px rgba(0,0,0,0.25)' }}
                    style="display: flex; align-items: center; height: 42px; padding: 0 16px; margin-bottom: 8px; background: white; color: #0f1115; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); cursor: grab; user-select: none; -webkit-user-select: none; font-weight: 500;"
                >
                    {item}
                </Reorder.Item>
            {/each}
        </Reorder.Group>
    </motion.div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 340px;
    }
</style>
