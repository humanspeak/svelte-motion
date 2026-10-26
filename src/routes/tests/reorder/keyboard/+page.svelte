<script lang="ts">
    /**
     * Keyboard reordering (Motion 14.6.0, #2658): port of upstream's
     * `dev/react/src/tests/issue-2658.tsx`.
     *
     * Query params (read on mount):
     * - `?axis=x` lays the items out in a row.
     * - `?rtl` flips the row (`direction: rtl`).
     * - `?layout` animates the reorder (1s linear).
     * - `?transition` applies the new order after `await Promise.resolve()`.
     *   Upstream wraps the update in React's `startTransition`; Svelte has
     *   none, so a microtask-deferred update is the closest equivalent.
     * - `?deferred` applies the new order 120ms later, like
     *   `tests/reorder/deferred` (Svelte-specific: focus must survive a late
     *   re-render).
     *
     * The page is tall enough to scroll. The ids and `data-testid`s are what
     * `e2e/reorder/keyboard.spec.ts` drives; keep them stable.
     */
    import { Reorder } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    let axis = $state<'x' | 'y'>('y')
    let rtl = $state(false)
    let layout = $state(false)
    let mode = $state<'sync' | 'transition' | 'deferred'>('sync')
    let ready = $state(false)
    let items = $state(['a', 'b', 'c', 'd'])

    onMount(() => {
        const params = new URL(window.location.href).searchParams
        axis = params.get('axis') === 'x' ? 'x' : 'y'
        rtl = params.has('rtl')
        layout = params.has('layout')
        mode = params.has('deferred')
            ? 'deferred'
            : params.has('transition')
              ? 'transition'
              : 'sync'
        ready = true
    })

    const onReorder = async (next: string[]) => {
        if (mode === 'deferred') {
            setTimeout(() => (items = next), 120)
        } else if (mode === 'transition') {
            await Promise.resolve()
            items = next
        } else {
            items = next
        }
    }

    const groupStyle = $derived(
        `display: flex; flex-direction: ${axis === 'x' ? 'row' : 'column'}; direction: ${
            rtl ? 'rtl' : 'ltr'
        }; gap: 10px; list-style: none; padding: 0;`
    )
    const itemTransition = $derived(
        layout ? { duration: 1, ease: 'linear' as const } : { duration: 0 }
    )

    // ---- Live readouts (tester only; never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    let focusedId = $state('')
    let grabbedIds = $state('')

    onMount(() => {
        if (window.location.search.includes('@isPlaywright=true')) return
        isTester = true
        const timer = setInterval(() => {
            focusedId = document.activeElement?.id ?? ''
            grabbedIds = Array.from(document.querySelectorAll('li'))
                .filter((element) => getComputedStyle(element).opacity === '0.5')
                .map((element) => element.id)
                .join(',')
        }, 100)
        return () => clearInterval(timer)
    })

    /** While an item is grabbed, focus must be on that same item. */
    const focusKept = $derived(!grabbedIds || grabbedIds === focusedId)

    const steps: TesterStep[] = [
        {
            text: 'Click the "before" button, then press Tab.',
            expected: 'Item "a" gets the focus ring. Focused reads "a".'
        },
        {
            text: 'Press ArrowDown without grabbing.',
            expected: 'The page scrolls; the order stays a,b,c,d. Scroll back up.'
        },
        {
            text: 'With "a" focused, press Space.',
            expected: 'Item "a" turns half transparent (whileDrag). Grabbed reads "a".'
        },
        {
            text: 'Press ArrowDown a few times, then ArrowUp.',
            expected:
                'Item "a" moves one slot per press and stops at the end. Focus and the grab stay on "a" (verdict ✓). The page does not scroll.'
        },
        {
            text: 'Press Escape.',
            expected:
                'The order goes back to what it was when you pressed Space. Item "a" is opaque again but still focused.'
        },
        {
            text: 'Press Space, ArrowDown, then Tab (or click empty space).',
            expected: 'The grab drops (item opaque) and the moved order is kept.'
        },
        {
            text: 'Try again with ?axis=x, ?axis=x&rtl, ?layout and ?deferred added to the URL.',
            expected:
                'x axis: Left/Right move (swapped in RTL), Up/Down are ignored. layout: moves animate. deferred: the order updates ~120ms later and focus stays.'
        }
    ]
</script>

<button data-testid="before" id="before">before</button>
<div data-testid="order" id="order" data-ready={ready ? '' : undefined}>{items.join(',')}</div>
<Reorder.Group {axis} values={items} {onReorder} style={groupStyle}>
    {#each items as item (item)}
        <Reorder.Item
            value={item}
            id={item}
            whileDrag={{ opacity: 0.5, transition: { duration: 0 } }}
            transition={itemTransition}
            style="width: 80px; height: 40px; background: #eee;"
        >
            {item}
            <input id="{item}-input" style="width: 30px" />
        </Reorder.Item>
    {/each}
</Reorder.Group>
<button id="after">after</button>
<div style="height: 3000px"></div>

<TesterPanel
    eyebrow="Motion 14.6.0 · issue-2658.tsx"
    title="Reorder: keyboard"
    {steps}
    status="Covered by e2e/reorder/keyboard.spec.ts."
>
    {#snippet checks()}
        <p>
            Every <code>Reorder.Item</code> is keyboard reorderable: Tab focuses it, Space grabs and drops
            it, arrows along the axis move it, Escape restores the order from the grab.
        </p>
        <p>
            Svelte's keyed each moves DOM nodes, which can drop focus. The grabbed item must keep
            focus and its grab after every move.
        </p>
    {/snippet}
    {#snippet summary()}
        {#if isTester}
            <span class="verdict" class:ok={focusKept} class:bad={!focusKept}>
                {focusKept ? '✓' : '✗ focus lost'}
            </span>
            Focused: <b>{focusedId || '—'}</b> · Grabbed: <b>{grabbedIds || '—'}</b> · Order:
            <b>{items.join(',')}</b>
        {/if}
    {/snippet}
</TesterPanel>

<style>
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
