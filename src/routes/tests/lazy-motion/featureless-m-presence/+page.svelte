<script lang="ts">
    import { AnimatePresence, LazyMotion, domAnimation, m, motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * A featureless `m` inside `AnimatePresence` (plan 016).
     *
     * Upstream (Motion 14.7.1) a child registers with its `PresenceChild` from
     * the exit feature (`motion/features/animation/exit.ts:73-83`), which needs
     * a VisualElement. An `m` without LazyMotion features has none, so it never
     * registers, and `PresenceChild` completes at once when it is removed
     * (`components/AnimatePresence/PresenceChild.tsx:104-113`). The element
     * leaves on the next frame, with no exit animation, and holds no
     * `mode="wait"` sibling. An entering featureless `m` renders `initial` and
     * stays there.
     *
     * Cards:
     * - exit: a bare `m.div` with `exit`, beside the same `m.div` inside
     *   `<LazyMotion features={domAnimation}>` (the control).
     * - wait-enter: `mode="wait"`; a `motion.div` swaps to a bare `m.div`.
     * - wait-leave: `mode="wait"`; a bare `m.div` swaps to a `motion.div`.
     *
     * Every card has a featured element so `window.MotionIsMounted` is set (a
     * featureless `m` never sets it). The `data-testid`s are what
     * `e2e/lazy-motion/featureless-m-presence.spec.ts` drives; keep them stable.
     */
    const transition = { duration: 0.6, ease: 'linear' } as const

    let showExit = $state(true)
    let enterSwapped = $state(false)
    let leaveSwapped = $state(false)

    const toggleExit = () => (showExit = !showExit)
    const swapEnter = () => (enterSwapped = !enterSwapped)
    const swapLeave = () => (leaveSwapped = !leaveSwapped)

    // ---- Live verdicts (tester only; never under `@isPlaywright=true`) ----
    type Verdict = { ok: boolean; text: string }
    let isTester = $state(false)
    let exitVerdict = $state<Verdict | null>(null)
    let enterVerdict = $state<Verdict | null>(null)
    let leaveVerdict = $state<Verdict | null>(null)

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
    })

    const byTestId = (id: string) =>
        document.querySelector<HTMLElement>(`[data-testid="${id}"]:not([data-clone="true"])`)
    const cloneOf = (id: string) =>
        document.querySelector<HTMLElement>(`[data-testid="${id}"][data-clone="true"]`)

    /** Calls `read` on each of the next `frames` animation frames. */
    const everyFrame = (frames: number, read: (index: number) => boolean | void) => {
        let index = 0
        const step = () => {
            if (read(index) === false || ++index >= frames) return
            requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
    }

    const runExit = () => {
        const leaving = showExit
        toggleExit()
        if (!isTester || !leaving) return
        let bareSeen = 0
        let controlFrames = 0
        everyFrame(60, (index) => {
            if (byTestId('exit-bare') || cloneOf('exit-bare')) bareSeen++
            if (cloneOf('exit-control') || byTestId('exit-control')) controlFrames++
            if (index === 59) {
                exitVerdict = {
                    ok: bareSeen === 0 && controlFrames >= 3,
                    text: `bare painted on ${bareSeen} frames (want 0) · control on ${controlFrames} (want ≥ 3)`
                }
            }
        })
    }

    const runEnter = () => {
        const entering = !enterSwapped
        swapEnter()
        if (!isTester || !entering) return
        const opacities: number[] = []
        everyFrame(240, () => {
            const el = byTestId('wait-new')
            if (!el || byTestId('wait-old') || cloneOf('wait-old')) return
            if (getComputedStyle(el).display === 'none') return
            opacities.push(Number(getComputedStyle(el).opacity))
            if (opacities.length >= 60) {
                const ok = opacities.every((value) => Math.abs(value - 0.4) < 0.01)
                enterVerdict = {
                    ok,
                    text: `revealed; opacity ${Math.min(...opacities).toFixed(2)}–${Math.max(...opacities).toFixed(2)} over 60 frames (want 0.40)`
                }
                return false
            }
        })
    }

    const runLeave = () => {
        const leaving = !leaveSwapped
        swapLeave()
        if (!isTester || !leaving) return
        everyFrame(1, () => {
            const oldGone = !byTestId('leave-old') && !cloneOf('leave-old')
            const next = byTestId('leave-new')
            const shown = !!next && getComputedStyle(next).display !== 'none'
            leaveVerdict = {
                ok: oldGone && shown,
                text: `first frame: old ${oldGone ? 'gone' : 'still painted'}, new ${shown ? 'shown' : 'hidden'}`
            }
        })
    }

    const steps: TesterStep[] = [
        {
            text: 'Exit card: press "Toggle exit" once.',
            expected:
                'The bare box disappears at once, with no fade. The control box fades and shrinks for about 0.6 s. The chip reads OK.',
            action: { label: 'Toggle exit', run: runExit }
        },
        {
            text: 'Wait-enter card: press "Swap (enter)" once.',
            expected:
                'The old box fades out over 0.6 s. Then the new bare box appears at opacity 0.4 and stays there (no fade-in). The chip reads OK.',
            action: { label: 'Swap (enter)', run: runEnter }
        },
        {
            text: 'Wait-leave card: press "Swap (leave)" once.',
            expected:
                'The old bare box is gone at once and the new box starts fading in right away, without waiting 0.6 s. The chip reads OK.',
            action: { label: 'Swap (leave)', run: runLeave }
        }
    ]
</script>

<svelte:head>
    <title>LazyMotion — featureless m in AnimatePresence</title>
</svelte:head>

{#snippet chip(verdict: Verdict | null)}
    {#if isTester && verdict}
        <span class="verdict" class:ok={verdict.ok}>
            {verdict.ok ? 'OK' : 'WRONG'} · {verdict.text}
        </span>
    {/if}
{/snippet}

{#snippet ready()}
    <motion.span class="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >featured</motion.span
    >
{/snippet}

<main class="page">
    <header>
        <p class="kicker">LazyMotion · Motion 14.7.1 exit.ts / PresenceChild.tsx</p>
        <h1>A featureless m never holds AnimatePresence.</h1>
        <p class="lede">
            Without a VisualElement an <code>m</code> has no exit feature, so it never registers
            with its presence child: it leaves at once and never blocks <code>mode="wait"</code>.
        </p>
    </header>

    <section class="card">
        <h2>Exit {@render chip(exitVerdict)}</h2>
        <button type="button" data-testid="toggle-exit" onclick={runExit}>Toggle exit</button>
        <div class="row">
            <div class="slot">
                <AnimatePresence>
                    {#if showExit}
                        <m.div
                            key="leaver"
                            data-testid="exit-bare"
                            class="box"
                            initial={{ opacity: 0.4 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            {transition}>bare</m.div
                        >
                    {/if}
                </AnimatePresence>
            </div>
            <div class="slot">
                <LazyMotion features={domAnimation}>
                    <AnimatePresence>
                        {#if showExit}
                            <m.div
                                key="leaver"
                                data-testid="exit-control"
                                class="box control"
                                initial={{ opacity: 0.4 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                {transition}>control</m.div
                            >
                        {/if}
                    </AnimatePresence>
                </LazyMotion>
            </div>
        </div>
    </section>

    <section class="card">
        <h2>Wait mode, featureless entrant {@render chip(enterVerdict)}</h2>
        <button type="button" data-testid="swap-enter" onclick={runEnter}>Swap (enter)</button>
        <div class="row">
            <div class="slot">
                <AnimatePresence mode="wait">
                    {#if !enterSwapped}
                        <motion.div
                            key="a"
                            data-testid="wait-old"
                            class="box control"
                            exit={{ opacity: 0 }}
                            {transition}>old</motion.div
                        >
                    {:else}
                        <m.div
                            key="b"
                            data-testid="wait-new"
                            class="box"
                            initial={{ opacity: 0.4 }}
                            animate={{ opacity: 1 }}
                            {transition}>new (bare)</m.div
                        >
                    {/if}
                </AnimatePresence>
            </div>
            {@render ready()}
        </div>
    </section>

    <section class="card">
        <h2>Wait mode, featureless leaver {@render chip(leaveVerdict)}</h2>
        <button type="button" data-testid="swap-leave" onclick={runLeave}>Swap (leave)</button>
        <div class="row">
            <div class="slot">
                <AnimatePresence mode="wait">
                    {#if !leaveSwapped}
                        <m.div
                            key="c"
                            data-testid="leave-old"
                            class="box"
                            exit={{ opacity: 0 }}
                            {transition}>old (bare)</m.div
                        >
                    {:else}
                        <motion.div
                            key="d"
                            data-testid="leave-new"
                            class="box control"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            {transition}>new</motion.div
                        >
                    {/if}
                </AnimatePresence>
            </div>
            {@render ready()}
        </div>
    </section>
</main>

<TesterPanel
    eyebrow="motion/features/animation/exit.ts (Motion 14.7.1)"
    title="A featureless m leaves AnimatePresence at once"
    status="Expected on this build: all three chips read OK."
    {steps}
>
    {#snippet checks()}
        <p>
            Upstream only the exit feature registers a child with its presence child, and that needs
            a VisualElement. A featureless <code>m</code> has none: when removed it leaves on the
            next frame, with no exit animation, and never holds a <code>mode="wait"</code>
            sibling. An entering featureless <code>m</code> appears at its <code>initial</code> and stays
            there.
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
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        font-size: 16px;
    }

    .row {
        display: flex;
        align-items: center;
        gap: 24px;
    }

    .slot {
        width: 120px;
        height: 80px;
    }

    :global(.box) {
        display: grid;
        place-items: center;
        width: 120px;
        height: 80px;
        border-radius: 12px;
        background: #6366f1;
        font-family: monospace;
    }

    :global(.box.control) {
        background: #0ea5e9;
    }

    :global(.ready) {
        font-size: 12px;
        opacity: 0.6;
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
        border: 0;
        border-radius: 8px;
        background: #6366f1;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }
</style>
