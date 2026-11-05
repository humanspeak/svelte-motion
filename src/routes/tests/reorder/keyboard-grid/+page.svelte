<script lang="ts">
    /**
     * Keyboard reordering in a grid (Motion 14.9): port of upstream's
     * `dev/react/src/tests/reorder-keyboard-grid.tsx`. A four column CSS grid
     * of Reorder items with the axis detected from the layout (`xy`). The
     * group is one tab stop, arrows move focus, and Up/Down move by the row
     * as drawn, grabbed or not.
     *
     * The ids are what `e2e/reorder/keyboard-grid.spec.ts` drives; keep them
     * stable.
     */
    import { Reorder } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    const initial = Array.from({ length: 14 }, (_, i) => String(i + 1).padStart(2, '0'))
    let items = $state([...initial])
    let ready = $state(false)

    onMount(() => {
        ready = true
    })

    // ---- Live readouts (tester only; never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    let focusedId = $state('')
    let grabbedIds = $state('')
    let tabStops = $state('')

    onMount(() => {
        if (window.location.search.includes('@isPlaywright=true')) return
        isTester = true
        const timer = setInterval(() => {
            focusedId = document.activeElement?.id ?? ''
            const cells = Array.from(document.querySelectorAll<HTMLElement>('[id^="item-"]'))
            grabbedIds = cells
                .filter((element) => getComputedStyle(element).opacity === '0.5')
                .map((element) => element.id)
                .join(',')
            tabStops = cells
                .filter((element) => element.tabIndex === 0)
                .map((element) => element.id)
                .join(',')
        }, 100)
        return () => clearInterval(timer)
    })

    /** The group must have exactly one tab stop. */
    const oneTabStop = $derived(!!tabStops && !tabStops.includes(','))

    /** Focus an item and send it a key, as the keyboard would. */
    const press = (id: string, key: string) => {
        const element = document.getElementById(id)
        element?.focus()
        element?.dispatchEvent(
            new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
        )
    }
    const focusedItem = () =>
        document.activeElement?.id.startsWith('item-') ? document.activeElement.id : 'item-01'

    const steps: TesterStep[] = [
        {
            text: 'Click the "before" button, then press Tab once, then Tab again.',
            expected:
                'The first Tab focuses item 01; the second leaves the grid for "after". Tab stops reads one item.',
            action: { label: 'Focus 01', run: () => document.getElementById('item-01')?.focus() }
        },
        {
            text: 'Shift+Tab back into the grid, then press ArrowDown, ArrowRight, ArrowDown.',
            expected:
                'Focus moves 01 → 05 → 06 → 10, straight down the columns as drawn. The order does not change.',
            action: { label: 'ArrowDown', run: () => press(focusedItem(), 'ArrowDown') }
        },
        {
            text: 'Tab out and Shift+Tab back in.',
            expected: 'Focus returns to the item you focused last, not 01.'
        },
        {
            text: 'Focus 06, press Space, then ArrowDown.',
            expected:
                'Item 06 turns half transparent and drops one row, into the slot below it (between 10 and 11), not one place along.',
            action: {
                label: 'Grab 06 + ArrowDown',
                run: () => {
                    press('item-06', ' ')
                    press('item-06', 'ArrowDown')
                }
            }
        },
        {
            text: 'Press ArrowDown again, then ArrowUp a few times.',
            expected:
                'It goes into the short last row by the nearest column, then back up a row per press, stopping at the top row. Focus stays on 06.'
        },
        {
            text: 'Press Escape.',
            expected: 'The order goes back to what it was at Space, and 06 is opaque again.',
            action: { label: 'Escape', run: () => press(focusedItem(), 'Escape') }
        }
    ]
</script>

<div class="fixture">
    <button id="before">before</button>
    <div id="order" data-ready={ready ? '' : undefined}>{items.join(',')}</div>
    <Reorder.Group
        as="div"
        values={items}
        onReorder={(next) => (items = next)}
        style="display: grid; grid-template-columns: repeat(4, 60px); gap: 10px;"
    >
        {#each items as item (item)}
            <Reorder.Item
                as="div"
                value={item}
                id={'item-' + item}
                transition={{ duration: 0 }}
                whileDrag={{ opacity: 0.5, transition: { duration: 0 } }}
                style="height: 60px; background: #eee; color: #111;"
            >
                {item}
            </Reorder.Item>
        {/each}
    </Reorder.Group>
    <button id="after">after</button>
</div>

<TesterPanel
    eyebrow="Motion 14.9.1 · reorder-keyboard-grid.tsx"
    title="Reorder: keyboard in a grid"
    {steps}
    status="Covered by e2e/reorder/keyboard-grid.spec.ts."
>
    {#snippet checks()}
        <p>
            A <code>Reorder.Group</code> is one tab stop (a roving tabindex): Tab reaches the item focused
            last, or the first. Arrows move focus between items; once Space grabs an item they move it.
        </p>
        <p>
            In a grid (<code>axis="xy"</code>), Up and Down go to the row drawn above or below, to
            the item nearest across, rather than one place along the list.
        </p>
    {/snippet}
    {#snippet summary()}
        {#if isTester}
            <span class="verdict" class:ok={oneTabStop} class:bad={!oneTabStop}>
                {oneTabStop ? '✓ one tab stop' : '✗ tab stops'}
            </span>
            Focused: <b>{focusedId || '—'}</b> · Grabbed: <b>{grabbedIds || '—'}</b> · Tab stops:
            <b>{tabStops || '—'}</b>
        {/if}
    {/snippet}
</TesterPanel>

<style>
    .fixture {
        padding: 16px;
        max-width: 400px;
    }
    .verdict {
        display: inline-block;
        padding: 1px 8px;
        margin-right: 6px;
        border-radius: 999px;
        font-weight: 700;
    }
    .verdict.ok {
        background: #dcfce7;
        color: #166534;
    }
    .verdict.bad {
        background: #fee2e2;
        color: #991b1b;
    }
</style>
