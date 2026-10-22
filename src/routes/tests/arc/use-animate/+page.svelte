<script lang="ts">
    /**
     * `arc()` driven by `useAnimate()` on a plain (non-motion) element.
     *
     * Svelte port of upstream's `UseAnimateArc`
     * (`dev/react/src/tests/transition-arc.tsx`, variant `use-animate`, commit
     * `72a1ee2ec`). From Motion 14.3.1, element animations (`animate(el, …)` /
     * `useAnimate`) honor `transition.path` through `MotionPath.animateValues`,
     * so the indicator deflects perpendicular to its x travel instead of moving
     * in a straight line. `?freeze` pins the ease at 0.5 (midpoint) for e2e.
     *
     * Upstream's fixture is one-way: it always animates to `x: 400`, so a
     * second press has nowhere to go. This page extends it into a round trip:
     * each Toggle alternates the target between `x: 400` and `x: 0`, reusing
     * the same `arc()` path both ways. The first press still goes to 400, so
     * the `?freeze` midpoint check is unchanged.
     *
     * The `data-testid`s are what `e2e/motion/arc-use-animate.spec.ts` drives;
     * keep them stable.
     *
     * @component
     */
    import { arc, useAnimate } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    const [scope, animate] = useAnimate()
    // Created once so the arc's direction-continuity closure survives clicks.
    const path = arc({ strength: 1 })

    let freeze = false
    let out = false

    // ---- Live verdict (tester only; never under `@isPlaywright=true`) ----
    type Verdict = { target: number; landed: number; deflection: number }
    let isTester = $state(false)
    let verdict = $state<Verdict | null>(null)
    let presses = $state(0)
    let sampling = 0
    // The indicator's resting box (x = 0, y = 0), measured before any press.
    let rest = { left: 0, top: 0 }

    onMount(() => {
        freeze = new URLSearchParams(location.search).has('freeze')
        isTester = !location.search.includes('@isPlaywright=true')
        if (scope.current) {
            const { left, top } = scope.current.getBoundingClientRect()
            rest = { left, top }
        }
    })

    /**
     * Samples the indicator every frame for the leg's duration, recording the
     * largest vertical deflection off the straight line and where it lands.
     */
    const watch = (el: HTMLElement, target: number) => {
        if (!isTester) return
        const id = ++sampling
        let deflection = 0
        const start = performance.now()
        const sample = () => {
            if (id !== sampling) return
            const rect = el.getBoundingClientRect()
            deflection = Math.max(deflection, Math.abs(rect.top - rest.top))
            if (performance.now() - start < 1400) {
                requestAnimationFrame(sample)
                return
            }
            verdict = {
                target,
                landed: Math.round(rect.left - rest.left),
                deflection: Math.round(deflection)
            }
        }
        requestAnimationFrame(sample)
    }

    const run = () => {
        const el = scope.current
        if (!el) return
        out = !out
        const target = out ? 400 : 0
        presses += 1
        animate(
            el,
            { x: target, y: 0 },
            freeze ? { duration: 4, ease: () => 0.5, path } : { duration: 1.2, path }
        )
        watch(el, target)
    }

    const verdictOk = $derived(
        verdict !== null && Math.abs(verdict.landed - verdict.target) < 2 && verdict.deflection > 50
    )

    const steps: TesterStep[] = [
        {
            text: 'Press "Toggle".',
            expected:
                'The red box travels right along a curved path (it bows off the straight line) and stops 400px to the right. The chip reads "at 400".',
            action: { label: 'Toggle', run }
        },
        {
            text: 'Press "Toggle" again.',
            expected:
                'The box curves back along an arc to where it started. The chip reads "returned to start".',
            action: { label: 'Toggle', run }
        },
        {
            text: 'Press "Toggle" several more times, waiting for each move to finish.',
            expected:
                'Every press moves the box: it alternates right and back, curving each way. It never sits still after a press.',
            action: { label: 'Toggle', run }
        }
    ]
</script>

<svelte:head>
    <title>arc() via useAnimate()</title>
</svelte:head>

<div class="container">
    <button type="button" class="toggle" data-testid="toggle" onclick={run}>Toggle</button>
    <div class="indicator" data-testid="indicator" {@attach scope}></div>
</div>

<TesterPanel
    eyebrow="dev/react/src/tests/transition-arc.tsx (Motion 14.5.0)"
    title="arc() path via useAnimate(), round trip"
    status="Expected on this build: every press moves the box along a curve, alternating between x = 400 and the start."
    {steps}
>
    {#snippet checks()}
        <p>
            <code>animate(el, &#123; x &#125;, &#123; path: arc() &#125;)</code> on a plain element
            should bend the x travel into an arc. Upstream's fixture only animates one way; this
            page toggles between <code>x: 400</code> and <code>x: 0</code> with the same
            <code>arc()</code> path, so the return leg curves too.
        </p>
    {/snippet}
    {#if isTester}
        <p class="readout">
            Presses: {presses}
            {#if verdict}
                <span class="verdict" class:ok={verdictOk}>
                    {verdict.target === 0 ? 'returned to start' : 'at 400'} · landed {verdict.landed}px
                    · arc {verdict.deflection}px
                </span>
            {/if}
        </p>
    {/if}
</TesterPanel>

<style>
    .container {
        position: relative;
        width: 100vw;
        height: 100vh;
    }

    .toggle {
        position: fixed;
        top: 16px;
        left: 16px;
        z-index: 1;
    }

    .indicator {
        position: absolute;
        top: 200px;
        left: 50px;
        width: 100px;
        height: 100px;
        background: red;
    }

    .readout {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        font-family: monospace;
    }

    .verdict {
        padding: 2px 8px;
        border-radius: 999px;
        background: #7f1d1d;
        color: white;
        font-size: 12px;
        font-weight: 600;
    }

    .verdict.ok {
        background: #14532d;
    }
</style>
