<script lang="ts">
    /**
     * Object-valued Reorder list updated immutably under a stable `{#each}`
     * key: the Replace buttons swap an entry for `{ ...entry, rev: rev + 1 }`,
     * which keeps the item component but hands it a new value object. The
     * item must re-register under the new object, as upstream does on every
     * render (Motion 14.14.0 `Reorder/Item.tsx:141`), so it stays reachable
     * with the arrow keys, keeps the tab stop and can still be moved.
     *
     * The ids and `data-testid`s are what
     * `e2e/reorder/immutable-values.spec.ts` drives; keep them stable.
     */
    import { Reorder } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    type Entry = { id: string; rev: number }

    let ready = $state(false)
    let items = $state<Entry[]>([
        { id: 'a', rev: 0 },
        { id: 'b', rev: 0 },
        { id: 'c', rev: 0 },
        { id: 'd', rev: 0 }
    ])

    onMount(() => {
        ready = true
    })

    /** Replace one entry with a copy: same key, new value object. */
    const replace = (id: string) =>
        (items = items.map((i) => (i.id === id ? { ...i, rev: i.rev + 1 } : i)))

    const groupStyle =
        'display: flex; flex-direction: column; gap: 10px; list-style: none; padding: 0;'

    // ---- Live readout (tester only; never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    let focusedId = $state('')

    onMount(() => {
        if (window.location.search.includes('@isPlaywright=true')) return
        isTester = true
        const timer = setInterval(() => {
            focusedId = document.activeElement?.id ?? ''
        }, 100)
        return () => clearInterval(timer)
    })

    const steps: TesterStep[] = [
        {
            text: 'Click Replace b, click before, press Tab, then ArrowDown.',
            expected: 'Focus goes a → b. It must not skip b.'
        },
        {
            text: 'Reload. Click Replace a, click before, press Tab.',
            expected: 'Focus lands on a, the first item.'
        },
        {
            text: 'Click Replace b, then drag b below c.',
            expected: 'The order reads a,c,b,d.'
        },
        {
            text: 'Click Replace b, focus b, press Space, ArrowDown, Space.',
            expected: 'b moves one slot down; the order reads a,c,b,d.'
        }
    ]
</script>

<svelte:head>
    <title>Reorder: replaced value objects</title>
</svelte:head>

<!-- The Replace buttons come first so Tab from "before" reaches the group. -->
<button id="replace-a" onclick={() => replace('a')}>Replace a</button>
<button id="replace-b" onclick={() => replace('b')}>Replace b</button>
<button data-testid="before" id="before">before</button>
<div data-testid="order" id="order" data-ready={ready ? '' : undefined}>
    {items.map((i) => i.id).join(',')}
</div>
<Reorder.Group axis="y" values={items} onReorder={(next) => (items = next)} style={groupStyle}>
    {#each items as item (item.id)}
        <Reorder.Item
            value={item}
            id={item.id}
            data-testid={item.id}
            whileDrag={{ opacity: 0.5, transition: { duration: 0 } }}
            transition={{ duration: 0 }}
            style="width: 80px; height: 40px; background: #eee;"
        >
            {item.id} r{item.rev}
        </Reorder.Item>
    {/each}
</Reorder.Group>

<TesterPanel
    eyebrow="Svelte port · upstream Item.tsx:141"
    title="Reorder: replaced value objects"
    {steps}
    status="Covered by e2e/reorder/immutable-values.spec.ts."
>
    {#snippet checks()}
        <p>
            Replace swaps an item's value for a new object under the same key, as an immutable
            update does. The item must re-register under the new object so arrow keys still reach
            it, the first item keeps the tab stop, and it can still be dragged or moved by keyboard.
        </p>
    {/snippet}
    {#snippet summary()}
        {#if isTester}
            Focused: <b>{focusedId || '—'}</b> · Order:
            <b>{items.map((i) => `${i.id}${i.rev}`).join(',')}</b>
        {/if}
    {/snippet}
</TesterPanel>
