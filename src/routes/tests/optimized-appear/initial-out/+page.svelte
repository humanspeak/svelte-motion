<script lang="ts">
    /**
     * The SSR optimized appear animation follows initial's `transition.out`
     * (#1725). Port of upstream `dev/html/public/optimized-appear/initial-out.html`
     * @ v14.7.1 (commits `ad11115e9`, `1a451de16`).
     *
     * The generator builds the appear animation from initial's `transition.out`
     * when it's set, otherwise from animate's own transition, the rule the
     * runtime's mount animation (and so the hydration handoff) follows. If the
     * two disagree, the hydrated runtime continues with a different duration
     * from the same start time and the box visibly jumps on hydration.
     *
     * - `initial-out-box`: initial's out (2.4 s linear) wins over the 0.6 s prop.
     * - `animate-transition-box`: animate's own transition (2.4 s linear) wins
     *   over the 0.6 s prop (the "otherwise" half).
     *
     * Both boxes are server-rendered so the inline appear bootstrap runs.
     *
     * @component
     */
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    const OUT_DURATION = 2.4
    const BOXES = ['initial-out-box', 'animate-transition-box'] as const
    type Box = (typeof BOXES)[number]

    type Verdict = 'waiting' | 'ok' | 'bad'
    const verdicts = $state<Record<Box, Verdict>>({
        'initial-out-box': 'waiting',
        'animate-transition-box': 'waiting'
    })
    const reasons = $state<Record<Box, string>>({
        'initial-out-box': '',
        'animate-transition-box': ''
    })

    // ---- Live verdict (tester only) ----
    //
    // Upstream's thresholds: opacity never drops more than 0.02 between frames
    // and never rises more than `dt / 2.4 s + 0.08`. Plus: 1 s after the box
    // starts fading in it is at most 0.75 (a 0.6 s animation would be at 1).
    // The sampler starts after hydration, so it misses the first frames.
    onMount(() => {
        if (window.location.search.includes('@isPlaywright=true')) return
        const prev: Partial<Record<Box, [number, number]>> = {}
        const startedAt: Partial<Record<Box, number>> = {}
        let raf = 0
        const sample = () => {
            const now = performance.now()
            let pending = false
            for (const box of BOXES) {
                if (verdicts[box] !== 'waiting') continue
                pending = true
                const element = document.querySelector(`[data-testid="${box}"]`)
                if (!element) continue
                const latest = Number(getComputedStyle(element).opacity)
                const last = prev[box]
                if (last) {
                    const [prevTime, prevOpacity] = last
                    const maxStep = (now - prevTime) / 1000 / OUT_DURATION + 0.08
                    if (latest < prevOpacity - 0.02) {
                        verdicts[box] = 'bad'
                        reasons[box] = `went back ${prevOpacity.toFixed(2)} → ${latest.toFixed(2)}`
                    } else if (latest - prevOpacity > maxStep) {
                        verdicts[box] = 'bad'
                        reasons[box] = `jumped ${prevOpacity.toFixed(2)} → ${latest.toFixed(2)}`
                    }
                }
                if (latest > 0.01 && startedAt[box] === undefined) startedAt[box] = now
                const start = startedAt[box]
                if (verdicts[box] === 'waiting' && start !== undefined && now - start >= 1000) {
                    if (latest > 0.75 && latest < 1) {
                        verdicts[box] = 'bad'
                        reasons[box] = `too fast: ${latest.toFixed(2)} after 1 s`
                    }
                }
                if (verdicts[box] === 'waiting' && latest >= 1) {
                    const tooFast = start === undefined || now - start < 1000
                    verdicts[box] = tooFast ? 'bad' : 'ok'
                    reasons[box] = tooFast ? 'reached 1 in under 1 s' : 'smooth, ~2.4 s'
                }
                prev[box] = [now, latest]
            }
            if (pending) raf = requestAnimationFrame(sample)
        }
        raf = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(raf)
    })

    const steps: TesterStep[] = [
        {
            text: 'Hard-reload the page (Cmd/Ctrl+Shift+R) and watch both boxes.',
            expected:
                'Each box fades in slowly and evenly over ~2.4 s, with no snap back or jump around hydration. Both chips read OK ✓.',
            action: { label: 'Reload', run: () => window.location.reload() }
        }
    ]

    const chip = (v: Verdict) => (v === 'ok' ? 'OK ✓' : v === 'bad' ? 'FAIL ✗' : 'WAITING')
</script>

<svelte:head>
    <title>Optimized appear · initial transition.out (#1725)</title>
</svelte:head>

<main class="page">
    <motion.div
        data-testid="initial-out-box"
        class="box"
        initial={{ opacity: 0, transition: { out: { duration: 2.4, ease: 'linear' } } }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: 'linear' }}
    >
        initial.out
    </motion.div>

    <motion.div
        data-testid="animate-transition-box"
        class="box"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 2.4, ease: 'linear' } }}
        transition={{ duration: 0.6, ease: 'linear' }}
    >
        animate.transition
    </motion.div>
</main>

<TesterPanel
    eyebrow="Motion 14.7 · #1725"
    title="SSR appear follows initial's transition.out"
    {steps}
>
    {#snippet summary()}
        {#each BOXES as box (box)}
            <span class="verdict {verdicts[box]}">
                {box}: {chip(verdicts[box])}{reasons[box] ? ` (${reasons[box]})` : ''}
            </span>
        {/each}
    {/snippet}
    {#snippet checks()}
        <p>
            The server starts each box's fade-in as a WAAPI animation before Svelte hydrates. Its
            timing must match the runtime's mount animation: <code>initial</code>'s
            <code>transition.out</code> when set, otherwise <code>animate</code>'s own
            <code>transition</code>, otherwise the <code>transition</code> prop.
        </p>
        <p>
            Both boxes have a 0.6 s <code>transition</code> prop but should take 2.4 s. A mismatch shows
            as a fast fade, or a jump when the runtime takes over.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .page {
        display: flex;
        gap: 48px;
        padding: 100px;
    }
    .page :global(.box) {
        width: 100px;
        height: 100px;
        background-color: #0077ff;
        color: #fff;
        font: 600 11px/1.3 system-ui;
        padding: 6px;
        box-sizing: border-box;
    }
    .verdict {
        display: inline-block;
        margin: 0 0.25rem 0.25rem 0;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
    }
    .verdict.ok {
        background: #dcfce7;
        color: #166534;
    }
    .verdict.bad {
        background: #fee2e2;
        color: #991b1b;
    }
    .verdict.waiting {
        background: #f1f5f9;
        color: #475569;
    }
</style>
