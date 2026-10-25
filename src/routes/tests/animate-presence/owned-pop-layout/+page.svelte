<script lang="ts">
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * `mode="popLayout"` for content held by `PresenceChild` (the
     * `present` + `{#snippet child()}` form). Port of Motion 14.3.1 #2503.
     *
     * Each row is a flex row: the exiting card, then a sibling. In the
     * popLayout row the card is taken out of flow the moment `present` flips
     * false, so the sibling slides left straight away while the card fades out
     * over a second. The sync row is a control: its sibling stays put until
     * the exit finishes.
     *
     * The `data-testid`s are what `e2e/animate-presence/owned-pop-layout.spec.ts`
     * drives; keep them stable.
     */
    type Row = 'popLayout' | 'sync'

    let show = $state(true)

    // ---- Live verdict (tester only; never under `@isPlaywright=true`) ----
    type Verdict = { moved: number; popped: boolean }
    let isTester = $state(false)
    let verdicts = $state<Partial<Record<Row, Verdict>>>({})

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
    })

    /**
     * Samples each row's sibling for 300 ms after an exit starts and records
     * the largest leftward move seen while the exiting card is still visible.
     */
    const watch = () => {
        if (!isTester) return
        const rows: Row[] = ['popLayout', 'sync']
        const suffix = (row: Row) => (row === 'sync' ? '-sync' : '')
        const query = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
        const x = (row: Row) => query(`sibling${suffix(row)}`)?.getBoundingClientRect().x
        const startX: Record<Row, number | undefined> = {
            popLayout: x('popLayout'),
            sync: x('sync')
        }
        const moved: Record<Row, number> = { popLayout: 0, sync: 0 }
        const start = performance.now()
        const sample = () => {
            for (const row of rows) {
                const exiting = query(`exiting${suffix(row)}`)
                const now = x(row)
                const before = startX[row]
                if (!exiting || Number(getComputedStyle(exiting).opacity) <= 0) continue
                if (now === undefined || before === undefined) continue
                moved[row] = Math.max(moved[row], before - now)
            }
            if (performance.now() - start < 300) {
                requestAnimationFrame(sample)
                return
            }
            for (const row of rows) {
                const distance = Math.round(moved[row])
                verdicts[row] = { moved: distance, popped: distance > 100 }
            }
        }
        requestAnimationFrame(sample)
    }

    const toggle = () => {
        const exiting = show
        show = !show
        if (exiting) watch()
    }

    const steps: TesterStep[] = [
        {
            text: 'Press "Toggle" once to start both exits.',
            expected:
                'Top row (popLayout): the grey box slides left into the card’s spot straight away while the card fades out. The chip reads POPPED. Bottom row (sync): the grey box stays put until the card has faded, then jumps. The chip reads HELD.',
            action: { label: 'Toggle', run: toggle }
        },
        {
            text: 'Press "Toggle" again to bring both cards back.',
            expected: 'Both cards reappear in their original spot, with the grey boxes after them.',
            action: { label: 'Toggle', run: toggle }
        },
        {
            text: 'Press "Toggle" twice quickly (exit, then re-enter mid-exit).',
            expected:
                'The top card returns to the row in its original place, not stuck absolutely positioned over the grey box.',
            action: { label: 'Toggle', run: toggle }
        }
    ]
</script>

<svelte:head>
    <title>AnimatePresence popLayout — owned child</title>
</svelte:head>

{#snippet verdictChip(row: Row)}
    {#if isTester && verdicts[row]}
        <span class="verdict" class:ok={verdicts[row]!.popped === (row === 'popLayout')}>
            {verdicts[row]!.popped ? 'POPPED' : 'HELD'} · moved {verdicts[row]!.moved}px
        </span>
    {/if}
{/snippet}

<main class="page">
    <header>
        <p class="kicker">AnimatePresence · Motion 14.3.1 #2503</p>
        <h1>popLayout pops the held child.</h1>
        <p class="lede">
            Both rows use <code>&lt;AnimatePresence present&gt;</code> with a
            <code>child</code> snippet, so the exiting card is the real node held by
            <code>PresenceChild</code>. In popLayout the card leaves the layout as soon as it starts
            exiting.
        </p>
    </header>

    <button type="button" data-testid="toggle" onclick={toggle}>Toggle</button>

    <section class="card">
        <h2>mode="popLayout" {@render verdictChip('popLayout')}</h2>
        <div class="row">
            <AnimatePresence mode="popLayout" present={show}>
                {#snippet child()}
                    <motion.div
                        data-testid="exiting"
                        class="exiting"
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        style="width:120px;height:80px"
                    >
                        exiting
                    </motion.div>
                {/snippet}
            </AnimatePresence>
            <div class="sibling" data-testid="sibling" style="width:80px;height:80px">sibling</div>
        </div>
    </section>

    <section class="card">
        <h2>mode="sync" (control) {@render verdictChip('sync')}</h2>
        <div class="row">
            <AnimatePresence mode="sync" present={show}>
                {#snippet child()}
                    <motion.div
                        data-testid="exiting-sync"
                        class="exiting"
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        style="width:120px;height:80px"
                    >
                        exiting
                    </motion.div>
                {/snippet}
            </AnimatePresence>
            <div class="sibling" data-testid="sibling-sync" style="width:80px;height:80px">
                sibling
            </div>
        </div>
    </section>
</main>

<TesterPanel
    eyebrow="AnimatePresence/PopChild.tsx (Motion 14.3.1)"
    title="popLayout reflows siblings immediately"
    status="Expected on this build: the popLayout row reads POPPED and the sync row reads HELD."
    {steps}
>
    {#snippet checks()}
        <p>
            When <code>present</code> flips false in <code>mode="popLayout"</code>, the
            <code>PresenceChild</code> measures the outermost motion element and pins it with
            <code>position: absolute</code> where it stood, so its siblings reflow while it fades
            out. <code>mode="sync"</code> keeps the exiting card in flow.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .page {
        min-height: 100vh;
        padding: 48px;
        background: #0f1115;
        color: #e5e7eb;
        font-family: system-ui, sans-serif;
    }

    .kicker {
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.6;
    }

    h1 {
        margin: 4px 0 8px;
        font-size: 24px;
    }

    .lede {
        max-width: 560px;
        margin-bottom: 24px;
        opacity: 0.75;
    }

    .card {
        display: grid;
        gap: 16px;
        max-width: 560px;
        margin: 20px 0;
        padding: 24px;
        border-radius: 16px;
        background: #1a1d24;
    }

    h2 {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 16px;
    }

    .row {
        position: relative;
        display: flex;
        gap: 8px;
    }

    :global(.exiting) {
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: #6366f1;
        font-family: monospace;
    }

    .sibling {
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: #4b5563;
        font-family: monospace;
    }

    .verdict {
        padding: 2px 8px;
        border-radius: 999px;
        background: #7f1d1d;
        font-size: 12px;
        font-weight: 600;
    }

    .verdict.ok {
        background: #14532d;
    }

    button {
        padding: 10px 18px;
        border: none;
        border-radius: 10px;
        background: #6366f1;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }
</style>
