<script lang="ts">
    /**
     * Reorder whose order update doesn't apply straight away — port of
     * upstream Motion's `dev/react/src/tests/reorder-transition.tsx`.
     *
     * `onReorder` records the proposal and applies it ~120ms later (the
     * Svelte analogue of upstream's `startTransition` / `useDeferredValue`
     * modes), so the pending order is still unapplied when the next
     * pointermoves arrive. Reorder.Group must not call `onReorder` again
     * with the same order before `values` changes.
     */
    import { Reorder } from '$lib'
    import { onMount } from 'svelte'

    const itemHeight = 60
    const applyDelay = 120

    let items = $state(['0', '1', '2', '3', '4', '5'])

    type ReorderWindow = Window & { reorderCalls: string[]; dragDone: boolean }
    const win = () => window as unknown as ReorderWindow

    onMount(() => {
        win().reorderCalls = []
        win().dragDone = false
    })

    const onReorder = (next: string[]) => {
        win().reorderCalls.push(next.join(''))
        setTimeout(() => (items = next), applyDelay)
    }

    const dispatch = (type: string, target: EventTarget, x: number, y: number) => {
        target.dispatchEvent(
            new PointerEvent(type, {
                clientX: x,
                clientY: y,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
                button: 0,
                buttons: type === 'pointerup' ? 0 : 1,
                bubbles: true,
                cancelable: true
            })
        )
    }

    /** Drag the first item 3.5 rows down with a pointermove every 16ms. */
    const drag = () => {
        const el = document.getElementById('item-0')
        if (!el) return
        const { left, top } = el.getBoundingClientRect()
        const x = left + 20
        const startY = top + 20
        const moves = 40
        const distance = itemHeight * 3.5

        dispatch('pointerdown', el, x, startY)
        for (let i = 1; i <= moves; i++) {
            setTimeout(
                () => dispatch('pointermove', window, x, startY + (distance * i) / moves),
                i * 16
            )
        }
        setTimeout(
            () => {
                dispatch('pointerup', window, x, startY + distance)
                setTimeout(() => (win().dragDone = true), 500)
            },
            moves * 16 + 300
        )
    }
</script>

<div class="page">
    <h1>Reorder — deferred order update</h1>
    <p>
        <code>onReorder</code> applies the new order {applyDelay}ms later. Dragging must not propose
        the same order twice while it is pending (Motion 13.4.5 parity).
    </p>

    <button id="drag" data-testid="drag" onclick={drag}>drag</button>

    <Reorder.Group
        axis="y"
        values={items}
        {onReorder}
        data-testid="reorder-group"
        style="list-style: none; padding: 0; margin: 0; width: 200px;"
    >
        {#each items as item (item)}
            <Reorder.Item
                value={item}
                id={`item-${item}`}
                data-testid={`item-${item}`}
                transition={{ duration: 0.2 }}
                style="height: {itemHeight}px; background: #eee; color: #0f1115; border-bottom: 1px solid #999; box-sizing: border-box; user-select: none; -webkit-user-select: none;"
            >
                {item}
            </Reorder.Item>
        {/each}
    </Reorder.Group>

    <div data-testid="order">{items.join('')}</div>
</div>

<style>
    .page {
        min-height: 100vh;
        padding: 20px;
        background: #0f1115;
        color: #e5e7eb;
        font-family: system-ui, sans-serif;
    }

    h1 {
        font-size: 20px;
        margin-bottom: 8px;
    }

    p {
        margin-bottom: 16px;
        color: #9ca3af;
    }

    button {
        margin-bottom: 16px;
        padding: 4px 12px;
        border: 1px solid #6b7280;
        border-radius: 6px;
    }

    [data-testid='order'] {
        margin-top: 24px;
        font-family: monospace;
        color: #6b7280;
    }
</style>
