<script lang="ts">
    import { animate, inertia, motionValue, styleEffect } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'

    const TRACK = 300
    const BALL = 24
    const MAX = TRACK - BALL

    const x = motionValue(0)
    let position = $state(0)
    let snap = $state(false)
    let ball: HTMLElement | undefined = $state()

    onMount(() => {
        const stop = ball ? styleEffect(ball, { x }) : undefined
        const unsubscribe = x.on('change', (v) => (position = Math.round(v)))
        return () => {
            unsubscribe()
            stop?.()
        }
    })

    const fling = (velocity: number) => {
        x.jump(0)
        animate(x, [0], {
            type: inertia,
            velocity,
            min: 0,
            max: MAX,
            bounceStiffness: 400,
            bounceDamping: 25,
            modifyTarget: snap ? (target: number) => Math.round(target / 50) * 50 : undefined
        })
    }

    const speeds = [
        { label: 'slow', velocity: 250 },
        { label: 'medium', velocity: 600 },
        { label: 'fast', velocity: 2000 }
    ]
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <header>
            <span class="micro">// type: inertia</span>
            <span class="micro readout">x {position}px</span>
        </header>

        <div class="track" style:width="{TRACK}px">
            <div class="wall left"></div>
            <div class="ball" bind:this={ball} style:width="{BALL}px" style:height="{BALL}px"></div>
            <div class="wall right"></div>
        </div>

        <div class="controls">
            <span class="micro">fling</span>
            {#each speeds as speed (speed.label)}
                <button type="button" onclick={() => fling(speed.velocity)}>{speed.label}</button>
            {/each}
            <button type="button" class:active={snap} onclick={() => (snap = !snap)}>
                snap to 50px: {snap ? 'on' : 'off'}
            </button>
        </div>

        <footer>
            <span class="micro">power 0.8 · max {MAX}px</span>
            <span class="micro">fast flings bounce off the wall</span>
        </footer>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 310px;
        padding: 1.5rem;
    }

    .strip {
        display: flex;
        width: 100%;
        max-width: 390px;
        flex-direction: column;
        gap: 0.75rem;
    }

    header,
    footer,
    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
    }

    header,
    footer {
        justify-content: space-between;
    }

    header {
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    footer {
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.5rem;
    }

    .micro {
        color: var(--brut-ink-3, #6f7975);
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
        text-transform: none;
    }

    .track {
        position: relative;
        display: flex;
        align-items: center;
        height: 40px;
        background: var(--brut-paper-2, #eef1ef);
    }

    .wall {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--brut-ink, #1d2321);
    }

    .wall.left {
        left: -3px;
    }

    .wall.right {
        right: -3px;
    }

    .ball {
        border-radius: 50%;
        background: var(--brut-accent, #247768);
    }

    button {
        border: 1px solid var(--brut-ink-3, #6f7975);
        background: transparent;
        color: inherit;
        font-family: var(--brut-mono, monospace);
        font-size: 0.75rem;
        padding: 0.35rem 0.65rem;
        cursor: pointer;
    }

    button.active {
        background: var(--brut-accent, #247768);
        color: #fff;
    }
</style>
