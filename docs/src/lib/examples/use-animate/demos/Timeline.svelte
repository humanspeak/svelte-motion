<script lang="ts">
    import { type Timeline, useAnimate } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'

    // Since Motion 14.7, `animate()` returns a mutable Timeline. Build it
    // paused, then add segments, play to a label and reverse while it lives.
    const [scope, animate] = useAnimate()

    let tl: Timeline | undefined
    let time = $state(0)
    let duration = $state(0)
    let added = $state(false)

    const sync = () => {
        if (!tl) return
        duration = tl.duration
        time = tl.time
    }

    onMount(() => {
        tl = animate(
            [
                ['.bar-1', { scaleX: [0, 1] }, { duration: 0.8 }],
                'mid',
                ['.bar-2', { scaleX: [0, 1] }, { duration: 0.8 }]
            ],
            {
                autoplay: false,
                defaultTransition: { ease: 'easeInOut' },
                onUpdate: (t) => (time = t)
            }
        )
        sync()
    })

    const add = () => {
        if (!tl || added) return
        // Half a second after the `mid` label: overlaps the second bar.
        tl.add(['.bar-3', { scaleX: [0, 1] }, { duration: 0.8 }], 'mid+0.5')
        added = true
        queueMicrotask(sync)
    }
    const playToLabel = () => void tl?.playTo('mid')
    const play = () => tl?.play()
    const reverse = () => void tl?.reverse()
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// timeline</span>
            <span class="micro state">{time.toFixed(2)}s / {duration.toFixed(2)}s</span>
        </div>

        <div {@attach scope} class="stage">
            <div class="track"><div class="bar bar-1"></div></div>
            <div class="label-row"><span class="micro">▼ mid</span></div>
            <div class="track"><div class="bar bar-2"></div></div>
            <div class="track" class:pending={!added}><div class="bar bar-3"></div></div>
        </div>

        <div class="strip-foot">
            <button type="button" class="ctrl" onclick={add} disabled={added}>Add</button>
            <button type="button" class="ctrl" onclick={playToLabel}>Play to label</button>
            <button type="button" class="ctrl primary" onclick={play}>Play</button>
            <button type="button" class="ctrl" onclick={reverse}>Reverse</button>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 320px;
    }

    .strip {
        width: 100%;
        max-width: 360px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .state {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
    }

    .strip-head,
    .strip-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .strip-foot {
        border-bottom: none;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
        padding-bottom: 0;
        justify-content: flex-start;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .stage {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.5rem 0;
    }

    .track {
        height: 1.25rem;
        background: var(--brut-bg-2, #eef4f1);
        border: 1px solid var(--brut-rule-2, #bbc4c0);
    }

    .track.pending {
        border-style: dashed;
        opacity: 0.5;
    }

    .label-row {
        padding-left: 0.25rem;
    }

    .bar {
        height: 100%;
        background: var(--brut-accent, #247768);
        transform: scaleX(0);
        transform-origin: left center;
    }

    .ctrl {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 0.5rem 0.875rem;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: transparent;
        color: var(--brut-ink-2, #525252);
        cursor: pointer;
    }

    .ctrl:disabled {
        opacity: 0.4;
        cursor: default;
    }

    .ctrl.primary {
        border-color: var(--brut-accent, #247768);
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        color: var(--brut-accent, #247768);
    }
</style>
