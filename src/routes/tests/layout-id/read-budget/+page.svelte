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
    //
    // The spec relies on: #swap / data-testid="swap", #card / data-testid="card"
    // (one per slot, rendered with {#if}), card → slot → #slots nesting, both
    // slots sharing a top edge, and the 1s linear layout transition.
    let right = $state(false)

    const transition = { layout: { duration: 1, ease: 'linear' as const } }

    // ---- Tester readout (never under `@isPlaywright=true`, where the spec
    // installs its own counter). Read-only: counts getBoundingClientRect calls
    // on #card and notes when the page itself just moved something.

    /** Layout transition length plus a little slack for the last frames. */
    const GLIDE_MS = 1150
    /** A plain-DOM shift is noticed (and measured once) within this window. */
    const SHIFT_MS = 500
    /** Mount work (seed read, enter) settles within this window. */
    const LOAD_MS = 600

    let isTester = $state(false)
    let totalReads = $state(0)
    let idleReadsTotal = $state(0)
    let readsLastSecond = $state(0)
    let idleReadsLastSecond = $state(0)
    let movingNow = $state(true)

    /** Until when (performance.now()) reads are excused because the page moved. */
    let excusedUntil = 0
    const excuse = (ms: number) => {
        excusedUntil = Math.max(excusedUntil, performance.now() + ms)
    }

    onMount(() => {
        if (window.location.search.includes('@isPlaywright=true')) return
        isTester = true
        excuse(LOAD_MS)

        // Plain (non-$state) bookkeeping: the wrapper runs inside the
        // library's own measuring effects, and writing $state there makes
        // those effects re-run (and re-measure) until Svelte aborts with
        // effect_update_depth_exceeded. `tick` copies the counts out.
        const reads: { at: number; idle: boolean }[] = []
        let total = 0
        let idleTotal = 0
        const original = Object.getOwnPropertyDescriptor(
            Element.prototype,
            'getBoundingClientRect'
        )!.value as (this: Element) => DOMRect
        Element.prototype.getBoundingClientRect = function (this: Element) {
            if (this.id === 'card') {
                const at = performance.now()
                const idle = at > excusedUntil
                reads.push({ at, idle })
                total += 1
                if (idle) idleTotal += 1
            }
            return original.call(this)
        }

        // Any click on the fixture's Swap button (by hand or via a step)
        // starts a glide, so reads during it are expected.
        const onClick = (event: MouseEvent) => {
            if ((event.target as Element | null)?.closest?.('#swap')) excuse(GLIDE_MS)
        }
        document.addEventListener('click', onClick, true)

        const tick = () => {
            const now = performance.now()
            while (reads.length && reads[0].at < now - 1000) reads.shift()
            totalReads = total
            idleReadsTotal = idleTotal
            readsLastSecond = reads.length
            idleReadsLastSecond = reads.filter((read) => read.idle).length
            movingNow = now <= excusedUntil
        }
        tick()
        const interval = setInterval(tick, 100)
        return () => {
            clearInterval(interval)
            document.removeEventListener('click', onClick, true)
            Element.prototype.getBoundingClientRect = original
        }
    })

    const verdict = $derived(
        idleReadsLastSecond > 0 ? 'measuring' : movingNow ? 'moving' : ('idle' as const)
    )

    const swap = () => document.getElementById('swap')?.click()

    const steps: TesterStep[] = [
        {
            text: 'Don’t touch anything for 3 seconds. Just watch the number at the top of this panel.',
            expected: 'The number stays at 0 and the chip says IDLE ✓.'
        },
        {
            text: 'Press Swap.',
            expected:
                'The green square glides from the left slot to the right slot in about 1 second. The chip says MOVING while it glides, then goes back to IDLE ✓.',
            action: { label: 'Swap', run: swap }
        },
        {
            text: 'Press Swap, then press it again while the square is only halfway across.',
            expected:
                'The square turns around from where it is and glides back. It does not jump to either end first.',
            action: {
                label: 'Swap, then swap again halfway',
                run: () => {
                    swap()
                    setTimeout(swap, 450)
                }
            }
        },
        {
            text: 'Wait until the square is still. Then add a dashed box above the two slots.',
            expected:
                'The dashed box pushes the slots and the square down. The chip may say MOVING for a moment, then IDLE ✓.',
            action: {
                label: 'Add dashed box',
                run: () => {
                    excuse(SHIFT_MS)
                    const spacer = document.createElement('div')
                    spacer.style.height = '120px'
                    spacer.className = 'border-2 border-dashed border-slate-400 rounded'
                    document.getElementById('slots')?.before(spacer)
                }
            }
        },
        {
            text: 'Press Swap again.',
            expected:
                'The square glides straight sideways at its new height. It does not drop in from where it was before the dashed box appeared.',
            action: { label: 'Swap', run: swap }
        }
    ]
</script>

<svelte:head>
    <title>layoutId · idle read budget</title>
</svelte:head>

<main class="flex flex-col gap-6 p-8">
    <h1 class="text-2xl font-semibold">Green square: idle measurement check</h1>

    <button
        id="swap"
        class="w-fit rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow hover:bg-blue-700"
        data-testid="swap"
        onclick={() => (right = !right)}
    >
        Swap ⇄
    </button>

    <div id="slots" class="grid w-[480px] grid-cols-2 gap-8">
        <div
            class="relative flex h-32 items-start justify-start rounded border-2 border-slate-400 p-2"
        >
            <span class="pointer-events-none absolute bottom-1 left-2 text-sm text-slate-500"
                >Left slot</span
            >
            {#if !right}
                <motion.div
                    id="card"
                    layoutId="read-budget-card"
                    data-testid="card"
                    class="h-20 w-20 rounded-lg bg-emerald-500 shadow"
                    {transition}
                />
            {/if}
        </div>
        <div
            class="relative flex h-32 items-start justify-end rounded border-2 border-slate-400 p-2"
        >
            <span class="pointer-events-none absolute right-2 bottom-1 text-sm text-slate-500"
                >Right slot</span
            >
            {#if right}
                <motion.div
                    id="card"
                    layoutId="read-budget-card"
                    data-testid="card"
                    class="h-20 w-20 rounded-lg bg-emerald-500 shadow"
                    {transition}
                />
            {/if}
        </div>
    </div>
</main>

<TesterPanel
    eyebrow="Plan 008 · layoutId read budget"
    title="The green square should not keep measuring itself while nothing moves"
    status="Expected to pass on this build: IDLE ✓ whenever the square is still, MOVING only while it glides."
    {steps}
>
    {#snippet summary()}
        <div class="budget" class:bad={verdict === 'measuring'}>
            <p class="budget-line">
                Measurements in the last second:
                <strong class="budget-count">{readsLastSecond}</strong>
            </p>
            {#if verdict === 'measuring'}
                <span class="verdict measuring">MEASURING ✗</span>
            {:else if verdict === 'moving'}
                <span class="verdict moving">MOVING</span>
            {:else}
                <span class="verdict idle">IDLE ✓</span>
            {/if}
        </div>
    {/snippet}
    {#snippet checks()}
        <p>
            The green square is a moving element. When you press Swap it glides to the other slot.
            To do that it has to know where it is on screen, so it measures itself.
        </p>
        <p>
            It should only measure itself when something happens. While nothing moves the count at
            the top must stay at <strong>0</strong>. An older version measured itself about 60 times
            every second, forever.
        </p>
    {/snippet}
    {#if isTester}
        <p class="detail">
            Measurements since the page loaded: {totalReads}. Of those, taken while nothing was
            moving: <strong class:bad-text={idleReadsTotal > 0}>{idleReadsTotal}</strong>.
        </p>
        <p class="detail">
            Chips: <b>IDLE ✓</b> nothing is moving and nothing was measured.
            <b>MOVING</b> the square is gliding or was just pushed, so a few measurements are fine.
            <b>MEASURING ✗</b> the square measured itself while nothing was moving (a bug).
        </p>
        <p class="detail glossary">
            Glossary: “measuring” means the browser is asked for the square’s size and position (the
            <code>getBoundingClientRect</code> call).
        </p>
    {/if}
</TesterPanel>

<style>
    .budget {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
    }
    .budget-line {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #26364b;
    }
    .budget-count {
        display: inline-block;
        min-width: 1.4em;
        margin-left: 4px;
        font:
            800 26px/1 ui-monospace,
            SFMono-Regular,
            monospace;
        font-variant-numeric: tabular-nums;
        color: #16724c;
        vertical-align: -3px;
    }
    .budget.bad .budget-count {
        color: #b42318;
    }
    .verdict {
        padding: 3px 12px;
        border-radius: 999px;
        font:
            800 13px/1.5 system-ui,
            sans-serif;
        letter-spacing: 0.04em;
        color: #fff;
    }
    .verdict.idle {
        background: #16724c;
    }
    .verdict.moving {
        background: #2f6fb5;
    }
    .verdict.measuring {
        background: #b42318;
    }
    .detail {
        margin: 0 0 8px;
        font-size: 12px;
        color: #43536a;
    }
    .glossary {
        margin: 0;
        color: #647185;
    }
    .bad-text {
        color: #b42318;
    }
</style>
