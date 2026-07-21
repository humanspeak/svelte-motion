<script lang="ts">
    import { useAnimationFrame } from '@humanspeak/svelte-motion'

    // `useAnimationFrame(cb)` calls `cb(time, delta)` every animation frame
    // and hands back a cleanup. Wrap it in `$effect` so Svelte runs and
    // tears down the loop in sync with the component's lifecycle.
    let cubeRef: HTMLDivElement
    // Mirror the live rotateY into $state purely for the head readout.
    let rotateYReadout = $state(0)

    $effect(() => {
        return useAnimationFrame((time) => {
            if (!cubeRef) return

            const rotateX = Math.sin(time / 10000) * 20
            const rotateY = (time / 20) % 360
            const y = Math.sin(time / 1000) * 30
            cubeRef.style.transform = `translateY(${y}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
            rotateYReadout = Math.round(rotateY)
        })
    })
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// use-animation-frame</span>
            <span class="micro readout">rotateY {rotateYReadout}°</span>
        </div>

        <div class="stage">
            <div class="container">
                <div class="cube" bind:this={cubeRef}>
                    <div class="side front"></div>
                    <div class="side left"></div>
                    <div class="side right"></div>
                    <div class="side top"></div>
                    <div class="side bottom"></div>
                    <div class="side back"></div>
                </div>
            </div>
        </div>

        <div class="strip-foot">
            <span class="micro">writes element.style.transform per frame</span>
            <span class="micro">raf loop</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 500px;
    }

    .strip {
        width: 100%;
        max-width: 420px;
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

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
        text-transform: none;
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

    .stage {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 320px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }

    .container {
        perspective: 1000px;
        width: 250px;
        height: 250px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .cube {
        width: 150px;
        height: 150px;
        position: relative;
        transform-style: preserve-3d;
    }

    .side {
        position: absolute;
        width: 100%;
        height: 100%;
        opacity: 0.92;
        border: 1px solid var(--brut-ink, #0a0a0a);
        backface-visibility: visible;
    }

    .front {
        transform: rotateY(0deg) translateZ(75px);
        background: var(--brut-accent, #247768);
    }

    .right {
        transform: rotateY(90deg) translateZ(75px);
        background: var(--brut-bg-2, #eef4f1);
    }

    .back {
        transform: rotateY(180deg) translateZ(75px);
        background: var(--brut-accent, #247768);
    }

    .left {
        transform: rotateY(-90deg) translateZ(75px);
        background: var(--brut-bg-2, #eef4f1);
    }

    .top {
        transform: rotateX(90deg) translateZ(75px);
        background: var(--brut-accent, #247768);
    }

    .bottom {
        transform: rotateX(-90deg) translateZ(75px);
        background: var(--brut-bg-2, #eef4f1);
    }
</style>
