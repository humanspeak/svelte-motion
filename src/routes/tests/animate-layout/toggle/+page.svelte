<script lang="ts">
    import { animateLayout } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Motion 14.1's vanilla `animateLayout` on plain elements: each knob is a
     * `data-layout` div, and the switch flips `justify-content` through
     * Svelte `$state`. The knob should glide between ends instead of
     * snapping.
     *
     * - `global`: `animateLayout(update, options)` animates every tagged
     *   element in the document.
     * - `scoped` / `outside`: one call flips both switches, but its scope is
     *   the `scoped` switch, so only that knob glides; `outside` snaps.
     * - `async`: the update awaits before changing state, which exercises the
     *   wrapper's flush after an async update settles.
     *
     * The `data-testid`s are what `e2e/animate-layout/toggle.spec.ts`
     * drives; keep them stable.
     */
    const DURATION = 0.5
    type Id = 'global' | 'scoped' | 'outside' | 'async'

    let on = $state<Record<Id, boolean>>({
        global: false,
        scoped: false,
        outside: false,
        async: false
    })
    let settled = $state(0)
    let scope = $state<HTMLElement | null>(null)

    const flipGlobal = async () => {
        await animateLayout(() => (on.global = !on.global), { duration: DURATION })
        settled += 1
    }

    const flipScoped = async () => {
        if (!scope) return
        await animateLayout(
            scope,
            () => {
                on.scoped = !on.scoped
                on.outside = !on.outside
            },
            { duration: DURATION }
        )
        settled += 1
    }

    const flipAsync = async () => {
        await animateLayout(
            async () => {
                await new Promise((resolve) => setTimeout(resolve, 120))
                on.async = !on.async
            },
            { duration: DURATION }
        )
        settled += 1
    }

    // ---- Glide meter (tester only; never under `@isPlaywright=true`) ----
    type Verdict = { frames: number; glided: boolean }
    let isTester = $state(false)
    let verdicts = $state<Partial<Record<Id, Verdict>>>({})

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
    })

    /**
     * Counts the frames in which a knob sits strictly between where it
     * started and where it ended. A snap has none; a glide has many.
     */
    const watch = (ids: Id[]) => {
        if (!isTester) return
        const knob = (id: Id) => document.querySelector<HTMLElement>(`[data-testid="knob-${id}"]`)
        const series = new Map<Id, number[]>(ids.map((id) => [id, []]))
        const start = performance.now()
        const sample = () => {
            for (const id of ids) {
                const left = knob(id)?.getBoundingClientRect().left
                if (left !== undefined) series.get(id)!.push(left)
            }
            if (performance.now() - start < (DURATION + 0.4) * 1000) {
                requestAnimationFrame(sample)
                return
            }
            for (const [id, lefts] of series) {
                const from = lefts[0]
                const to = lefts[lefts.length - 1]
                const lo = Math.min(from, to) + 1
                const hi = Math.max(from, to) - 1
                const frames = lefts.filter((left) => left > lo && left < hi).length
                verdicts[id] = { frames, glided: frames >= 3 }
            }
        }
        sample()
    }

    const steps: TesterStep[] = [
        {
            text: 'Press "Toggle" on the Global switch.',
            expected: 'The knob glides to the other end over half a second. The chip reads GLIDED.',
            action: { label: 'Toggle', run: () => (watch(['global']), flipGlobal()) }
        },
        {
            text: 'Press "Flip both (scope: left switch)".',
            expected:
                'Both switches change state. The left knob glides (GLIDED); the right one, outside the scope, jumps straight to its new end (SNAPPED).',
            action: {
                label: 'Flip both',
                run: () => (watch(['scoped', 'outside']), flipScoped())
            }
        },
        {
            text: 'Press "Toggle after a delay" on the Async switch.',
            expected: 'Nothing moves for about a tenth of a second, then the knob glides (GLIDED).',
            action: { label: 'Toggle', run: () => (watch(['async']), flipAsync()) }
        }
    ]
</script>

<svelte:head>
    <title>animateLayout — toggle switches</title>
</svelte:head>

{#snippet knobSwitch(id: Id, label: string)}
    <div class="switch" class:on={on[id]} data-testid="switch-{id}" data-on={on[id]}>
        <div class="knob" data-layout data-testid="knob-{id}"></div>
    </div>
    <span class="caption">{label}</span>
    {#if isTester && verdicts[id]}
        <span class="verdict" class:ok={verdicts[id]!.glided} data-tester-verdict={id}>
            {verdicts[id]!.glided ? 'GLIDED' : 'SNAPPED'} · {verdicts[id]!.frames} frames
        </span>
    {/if}
{/snippet}

<main class="page">
    <header>
        <p class="kicker">animateLayout · Motion 14.1</p>
        <h1>Plain elements, animated layout.</h1>
        <p class="lede">
            Each knob is a plain <code>&lt;div data-layout&gt;</code>. Pressing a button changes
            Svelte state inside <code>animateLayout</code>; the knob animates from its old position
            to its new one.
        </p>
    </header>

    <section class="card">
        <h2>Global</h2>
        <div class="row">{@render knobSwitch('global', 'animateLayout(update)')}</div>
        <button
            type="button"
            data-testid="flip-global"
            onclick={() => (watch(['global']), flipGlobal())}
        >
            Toggle
        </button>
    </section>

    <section class="card">
        <h2>Scoped</h2>
        <div class="pair">
            <div class="row scope" bind:this={scope} data-testid="scope">
                {@render knobSwitch('scoped', 'inside the scope')}
            </div>
            <div class="row">{@render knobSwitch('outside', 'outside the scope')}</div>
        </div>
        <button
            type="button"
            data-testid="flip-scoped"
            onclick={() => (watch(['scoped', 'outside']), flipScoped())}
        >
            Flip both (scope: left switch)
        </button>
    </section>

    <section class="card">
        <h2>Async update</h2>
        <div class="row">{@render knobSwitch('async', 'await, then update')}</div>
        <button
            type="button"
            data-testid="flip-async"
            onclick={() => (watch(['async']), flipAsync())}
        >
            Toggle after a delay
        </button>
    </section>

    <p class="stats" data-testid="settled">settled:{settled}</p>
</main>

<TesterPanel
    eyebrow="animateLayout (Motion 14.1)"
    title="Knobs glide, except outside the scope"
    status="Expected to pass on this build: GLIDED everywhere except the right-hand Scoped switch, which should read SNAPPED."
    {steps}
>
    {#snippet checks()}
        <p>
            <code>animateLayout</code> measures every <code>data-layout</code> element, runs your
            update, then animates each one from its old box to its new one. svelte-motion's wrapper
            flushes the Svelte state change to the DOM before the new layout is measured, so plain
            <code>$state</code> assignment works. Passing a scope element limits which elements animate.
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
        margin-bottom: 20px;
        padding: 24px;
        border-radius: 16px;
        background: #1a1d24;
    }

    h2 {
        font-size: 16px;
    }

    .pair {
        display: flex;
        gap: 32px;
    }

    .row {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .scope {
        padding: 8px;
        border: 1px dashed #6366f1;
        border-radius: 12px;
    }

    .switch {
        display: flex;
        justify-content: flex-start;
        width: 96px;
        height: 48px;
        padding: 6px;
        border-radius: 999px;
        background: #374151;
        transition: background-color 0.3s;
    }

    .switch.on {
        justify-content: flex-end;
        background: #6366f1;
    }

    .knob {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: white;
    }

    .caption {
        font-family: monospace;
        font-size: 13px;
        opacity: 0.7;
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
        justify-self: start;
        padding: 10px 18px;
        border: none;
        border-radius: 10px;
        background: #6366f1;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }

    .stats {
        font-family: monospace;
        opacity: 0.6;
    }
</style>
