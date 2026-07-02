<script lang="ts">
    import { motion, Reorder } from '$lib'

    let items = $state(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'])

    let scroller = $state<HTMLElement | null>(null)
    let scrollTop = $state(0)

    const handleScroll = () => {
        scrollTop = scroller?.scrollTop ?? 0
    }
</script>

<div class="page">
    <h1>Reorder — inside a scrollable container</h1>
    <p>
        The list lives in a 300px <code>overflow-y: scroll</code> container marked with
        <code>layoutScroll</code>. Reordering must stay correct when the container is pre-scrolled,
        and dragging near its edges auto-scrolls it.
    </p>

    <motion.div
        bind:ref={scroller}
        layoutScroll
        onscroll={handleScroll}
        data-testid="scroller"
        style="height: 300px; width: 340px; overflow-y: scroll; border: 1px solid #374151; border-radius: 12px; padding: 10px; background: #111827;"
    >
        <Reorder.Group
            axis="y"
            values={items}
            onReorder={(next: string[]) => (items = next)}
            data-testid="reorder-group"
            style="list-style: none; padding: 0; margin: 0;"
        >
            {#each items as item (item)}
                <Reorder.Item
                    value={item}
                    data-testid={`item-${item}`}
                    style="display: flex; align-items: center; height: 50px; padding: 0 16px; margin-bottom: 10px; background: white; color: #0f1115; border-radius: 10px; cursor: grab; user-select: none; -webkit-user-select: none;"
                >
                    {item}
                </Reorder.Item>
            {/each}
        </Reorder.Group>
    </motion.div>

    <div data-testid="order">{items.join(',')}</div>
    <div data-testid="scroll-top">{Math.round(scrollTop)}</div>
</div>

<style>
    .page {
        min-height: 100vh;
        padding: 48px;
        background: #0f1115;
        color: #e5e7eb;
        font-family: system-ui, sans-serif;
    }

    h1 {
        font-size: 20px;
        margin-bottom: 8px;
    }

    p {
        margin-bottom: 24px;
        max-width: 480px;
        color: #9ca3af;
    }

    code {
        color: #93c5fd;
    }

    [data-testid='order'],
    [data-testid='scroll-top'] {
        margin-top: 16px;
        font-family: monospace;
        color: #6b7280;
    }
</style>
