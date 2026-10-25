<script lang="ts">
    import { animate, drag } from '@humanspeak/svelte-motion'

    // A slider knob on a plain <div>. drag() makes it draggable on x and keeps
    // it inside the track; "Reset" animates the same x back to 0 with
    // animate(), because drag() and animate() share the element's x value.
    // No motion component.

    let track = $state<HTMLElement | null>(null)
    let knob = $state<HTMLElement | null>(null)
    let value = $state(0)

    /** Knob position along the track, as 0–100. */
    const measure = () => {
        if (!track || !knob) return
        const t = track.getBoundingClientRect()
        const k = knob.getBoundingClientRect()
        const travel = t.width - k.width
        value = travel > 0 ? Math.round(((k.left - t.left) / travel) * 100) : 0
    }

    // Follow the knob through the drag and its release glide.
    let raf = 0
    const follow = () => {
        cancelAnimationFrame(raf)
        const tick = () => {
            measure()
            raf = requestAnimationFrame(tick)
        }
        tick()
    }
    const stopFollowing = () => {
        cancelAnimationFrame(raf)
        measure()
    }

    $effect(() => {
        if (!knob || !track) return
        const stop = drag(knob, {
            axis: 'x',
            constraints: track,
            elastic: 0.15,
            onStart: follow,
            onTransitionEnd: stopFollowing
        })
        return () => {
            stop()
            cancelAnimationFrame(raf)
        }
    })

    const reset = async () => {
        if (!knob) return
        follow()
        await animate(knob, { x: 0 }, { type: 'spring', visualDuration: 0.4, bounce: 0.2 })
        stopFollowing()
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// slider knob</span>
            <span class="micro readout">value · {value}</span>
        </div>

        <div class="stage">
            <div class="track" bind:this={track}>
                <div class="fill" style:width="{value}%"></div>
                <div class="knob" bind:this={knob} aria-hidden="true"></div>
            </div>
        </div>

        <div class="strip-foot">
            <span class="micro">drag(knob, &#123; axis: 'x', constraints: track &#125;)</span>
            <button type="button" onclick={reset}>Reset</button>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 400px;
    }

    .strip {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        width: min(100%, 360px);
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
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
    }

    .readout {
        color: var(--brut-accent, #247768);
    }

    .stage {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
    }

    .track {
        position: relative;
        box-sizing: border-box;
        width: 100%;
        height: 48px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg, #f8fcfb);
    }

    .fill {
        position: absolute;
        inset: 0 auto 0 0;
        background: var(--brut-accent, #247768);
        opacity: 0.25;
        pointer-events: none;
    }

    .knob {
        position: absolute;
        top: -1px;
        left: -1px;
        box-sizing: border-box;
        width: 48px;
        height: 48px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-ink, #0a0a0a);
        cursor: grab;
    }

    .knob:active {
        cursor: grabbing;
    }

    button {
        padding: 0.5rem 1rem;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-ink, #0a0a0a);
        color: var(--brut-bg, #f8fcfb);
        font-family: var(--brut-mono, monospace);
        font-size: 0.75rem;
        text-transform: uppercase;
        cursor: pointer;
    }
</style>
