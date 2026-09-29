<script lang="ts">
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Plan 008 regression page (e2e/layout-id/read-budget.spec.ts).
    //
    // A `layoutId` card swapped between two slots with a plain `{#if}`. While
    // nothing changes the card must not measure itself (upstream measures a
    // layoutId node only when an update touches it, plus once on unmount);
    // it used to call getBoundingClientRect every animation frame just to keep
    // a handoff rect at hand. The swap must still animate from where the card
    // was drawn.
    let right = $state(false)

    const transition = { layout: { duration: 1, ease: 'linear' as const } }

    // Tester readout only (never under `@isPlaywright=true`, where the spec
    // installs its own counter): getBoundingClientRect calls on #card.
    let reads = $state(0)
    let readsLastSecond = $state(0)
    let isTester = $state(false)
    onMount(() => {
        if (window.location.search.includes('@isPlaywright=true')) return
        isTester = true
        const original = Object.getOwnPropertyDescriptor(
            Element.prototype,
            'getBoundingClientRect'
        )!.value as (this: Element) => DOMRect
        Element.prototype.getBoundingClientRect = function (this: Element) {
            if (this.id === 'card') reads += 1
            return original.call(this)
        }
        let previous = 0
        const interval = setInterval(() => {
            readsLastSecond = reads - previous
            previous = reads
        }, 1000)
        return () => {
            clearInterval(interval)
            Element.prototype.getBoundingClientRect = original
        }
    })

    const steps: TesterStep[] = [
        {
            text: 'Leave the page alone for a few seconds.',
            expected: '"Reads in the last second" stays at 0 while nothing moves.'
        },
        {
            text: 'Click "Swap".',
            expected:
                'The card glides (about 1 second) from the left slot to the right slot. A few reads happen during the swap, then the count goes back to 0.',
            action: { label: 'Swap', run: () => document.getElementById('swap')?.click() }
        },
        {
            text: 'Click "Swap" again halfway through the glide.',
            expected: 'The card turns around from where it is drawn, with no jump.',
            action: { label: 'Swap', run: () => document.getElementById('swap')?.click() }
        },
        {
            text: 'Wait for the card to settle. Then insert a plain (non-motion) spacer above the slots, and click "Swap".',
            expected:
                'The spacer pushes the card down, costing about one read. The swap then glides straight across from the new position. It does not drop in from where the card was before the spacer.',
            action: {
                label: 'Insert spacer',
                run: () => {
                    const spacer = document.createElement('div')
                    spacer.style.height = '120px'
                    spacer.className = 'border border-dashed border-slate-500'
                    document.getElementById('slots')?.before(spacer)
                }
            }
        }
    ]
</script>

<svelte:head>
    <title>layoutId · idle read budget</title>
</svelte:head>

<main class="flex flex-col gap-6 p-8">
    <h1 class="text-2xl font-semibold">layoutId · idle read budget</h1>

    <button
        id="swap"
        class="w-fit rounded bg-blue-600 px-3 py-2 text-white"
        data-testid="swap"
        onclick={() => (right = !right)}
    >
        Swap
    </button>

    <div id="slots" class="grid w-[480px] grid-cols-2 gap-8">
        <div class="flex h-24 items-start justify-start border border-slate-500 p-2">
            {#if !right}
                <motion.div
                    id="card"
                    layoutId="read-budget-card"
                    data-testid="card"
                    class="h-12 w-12 rounded bg-emerald-400"
                    {transition}
                />
            {/if}
        </div>
        <div class="flex h-24 items-start justify-end border border-slate-500 p-2">
            {#if right}
                <motion.div
                    id="card"
                    layoutId="read-budget-card"
                    data-testid="card"
                    class="h-12 w-12 rounded bg-emerald-400"
                    {transition}
                />
            {/if}
        </div>
    </div>
</main>

<TesterPanel
    eyebrow="Plan 008 · layoutId read budget"
    title="An idle layoutId card never measures itself"
    status="Plan 008: the per-frame capture loop is gone. The handoff rect comes from the projection's cached on-screen box, which is read without touching the DOM. A read-free IntersectionObserver notices plain-DOM moves."
    {steps}
>
    {#snippet checks()}
        <p>
            The green card has a <code>layoutId</code>. It needs its last on-screen position when it
            is removed, so the card in the other slot can glide from there.
        </p>
        <p>
            It must not call <code>getBoundingClientRect</code> while nothing changes. It used to do that
            on every animation frame.
        </p>
    {/snippet}
    {#if isTester}
        <p>Reads in the last second: <strong>{readsLastSecond}</strong></p>
        <p>Total reads of #card: {reads}</p>
    {/if}
</TesterPanel>
