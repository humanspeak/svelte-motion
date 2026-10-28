<script lang="ts">
    /**
     * `transition.out` on gestures (#1725): the transition a value uses when it
     * leaves a state for a lower-priority one.
     *
     * Ports the gesture cases of upstream
     * `packages/framer-motion/src/motion/__tests__/transition-out.test.tsx` @ v14.7.1:
     * "out: true reuses whileHover's transition when hover ends" (`out-true`),
     * "without out, the state being entered defines the transition" (`no-out`,
     * control), "whileTap out applies when returning to whileHover"
     * (`tap-to-hover`), "with a list of labels, the last label that sets out
     * applies to all its values" (`label-list`), "setting only out keeps the
     * value's default transition into the state" (`out-only`), "is used once"
     * (`used-once`) and "exiting while hovered uses exit's transition, not
     * hover's out" (`exit-hovered`). Upstream's `delay: 10` is `delay: 2` here,
     * and `{ type: false }` is "instant".
     *
     * `exit-hovered` uses the owned `AnimatePresence` form (`present` + `child`
     * snippet), so the real node exits through its animation state rather than
     * a static clone.
     *
     * @component
     */
    import { AnimatePresence, motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    let usedOnceTarget = $state(0.5)
    let exitVisible = $state(true)

    const labelVariants = {
        rest: { opacity: 0.5, x: 0, transition: { delay: 2 } },
        fade: { opacity: 1, transition: { type: false as const, out: true } },
        move: { x: 40, transition: { type: false as const } }
    }

    // ---- Live verdicts (tester only) ----

    type Verdict = 'waiting' | 'ok' | 'bad'
    type Key = 'outTrue' | 'noOut' | 'tapToHover' | 'labelList' | 'outOnly' | 'usedOnce' | 'exit'
    const verdicts = $state<Record<Key, Verdict>>({
        outTrue: 'waiting',
        noOut: 'waiting',
        tapToHover: 'waiting',
        labelList: 'waiting',
        outOnly: 'waiting',
        usedOnce: 'waiting',
        exit: 'waiting'
    })

    type Reading = { opacity: number; scale: number; x: number } | null
    type Watch = {
        testId: string
        reached: (reading: Reading) => boolean
        withinMs: number
        /** `true`: reaching in time passes. `false`: still not reached after `withinMs` passes. */
        expectReach: boolean
        startedAt: number
    }

    let isTester = false
    const watches: Partial<Record<Key, Watch>> = {}
    let outOnlyMax = Number.NEGATIVE_INFINITY

    const read = (testId: string): Reading => {
        const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
        if (!element) return null
        const style = getComputedStyle(element)
        const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform)
        return { opacity: Number(style.opacity), scale: matrix.a, x: matrix.e }
    }

    const arm = (key: Key, watch: Omit<Watch, 'startedAt'>) => {
        if (!isTester) return
        verdicts[key] = 'waiting'
        watches[key] = { ...watch, startedAt: performance.now() }
    }

    const near = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) < 0.01

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        if (!isTester) return
        let raf = 0
        const sample = () => {
            raf = requestAnimationFrame(sample)
            const now = performance.now()
            const outOnly = read('out-only')
            if (outOnly) outOnlyMax = Math.max(outOnlyMax, outOnly.x)
            for (const [key, watch] of Object.entries(watches) as [Key, Watch][]) {
                const reached = watch.reached(read(watch.testId))
                const late = now - watch.startedAt > watch.withinMs
                if (reached) {
                    verdicts[key] = watch.expectReach && !late ? 'ok' : 'bad'
                } else if (late) {
                    verdicts[key] = watch.expectReach ? 'bad' : 'ok'
                } else {
                    continue
                }
                delete watches[key]
            }
        }
        raf = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(raf)
    })

    const steps: TesterStep[] = [
        {
            text: 'Hover "out-true", then move away.',
            expected: 'It brightens instantly and dims back instantly (no 2 s wait).'
        },
        {
            text: 'Hover "no-out" (control), then move away.',
            expected: 'It brightens instantly, but stays bright for ~2 s after you leave.'
        },
        {
            text: 'Hover "tap-to-hover", press and hold, then release (still hovering).',
            expected:
                'Pressing shrinks it instantly; releasing grows it straight to the hover size, using whileTap’s out.'
        },
        {
            text: 'Hover "label-list", then move away.',
            expected:
                'It brightens and slides right instantly, then both dim and slide back instantly on leave.'
        },
        {
            text: 'Hover "out-only" near its right edge (it slides 100px right, out from under a centred pointer), then move away.',
            expected:
                'It springs right with a slight overshoot (x’s default spring), and snaps back instantly on leave.'
        },
        {
            text: 'Hover "used-once", move away, then click "Change animate".',
            expected:
                'It dims instantly on leave, then waits ~2 s before fading to 0: hover’s out was used once.'
        },
        {
            text: 'Hover "exit-hovered", then press Tab until "Toggle exit" is focused and press Enter without moving the mouse.',
            expected:
                'The card stays bright for ~1.5 s (exit’s own delay), then fades out. Toggle again to bring it back.'
        }
    ]

    const chip = (v: Verdict) => (v === 'ok' ? 'OK ✓' : v === 'bad' ? 'FAIL ✗' : 'WAITING')
    const labels: Record<Key, string> = {
        outTrue: 'out-true',
        noOut: 'no-out',
        tapToHover: 'tap-to-hover',
        labelList: 'label-list',
        outOnly: 'out-only',
        usedOnce: 'used-once',
        exit: 'exit-hovered'
    }
</script>

<svelte:head>
    <title>transition.out · gestures (#1725)</title>
</svelte:head>

<main class="page">
    <div class="grid">
        <div class="cell">
            <motion.div
                data-testid="out-true"
                class="card blue"
                initial={false}
                animate={{ opacity: 0.5, transition: { delay: 2 } }}
                whileHover={{ opacity: 1, transition: { type: false, out: true } }}
                onHoverEnd={() =>
                    arm('outTrue', {
                        testId: 'out-true',
                        reached: (r) => near(r?.opacity, 0.5),
                        withinMs: 400,
                        expectReach: true
                    })}
            >
                out-true
            </motion.div>
        </div>

        <div class="cell">
            <motion.div
                data-testid="no-out"
                class="card slate"
                initial={false}
                animate={{ opacity: 0.5, transition: { delay: 2 } }}
                whileHover={{ opacity: 1, transition: { type: false } }}
                onHoverEnd={() =>
                    arm('noOut', {
                        testId: 'no-out',
                        reached: (r) => near(r?.opacity, 0.5),
                        withinMs: 400,
                        expectReach: false
                    })}
            >
                no-out (control)
            </motion.div>
        </div>

        <div class="cell">
            <motion.div
                data-testid="tap-to-hover"
                class="card violet"
                initial={false}
                animate={{ scale: 1 }}
                transition={{ delay: 2 }}
                whileHover={{ scale: 1.5 }}
                whileTap={{ scale: 0.5, transition: { type: false, out: true } }}
                onTap={() =>
                    arm('tapToHover', {
                        testId: 'tap-to-hover',
                        reached: (r) => near(r?.scale, 1.5),
                        withinMs: 400,
                        expectReach: true
                    })}
            >
                tap-to-hover
            </motion.div>
        </div>

        <div class="cell">
            <motion.div
                data-testid="label-list"
                class="card green"
                variants={labelVariants}
                initial={false}
                animate="rest"
                whileHover={['fade', 'move']}
                onHoverEnd={() =>
                    arm('labelList', {
                        testId: 'label-list',
                        reached: (r) => near(r?.opacity, 0.5) && near(r?.x, 0),
                        withinMs: 400,
                        expectReach: true
                    })}
            >
                label-list
            </motion.div>
        </div>

        <div class="cell">
            <motion.div
                data-testid="out-only"
                class="card orange"
                initial={false}
                animate={{ x: 0 }}
                whileHover={{ x: 100, transition: { out: { type: false } } }}
                onHoverStart={() => (outOnlyMax = Number.NEGATIVE_INFINITY)}
                onHoverEnd={() => {
                    const overshot = outOnlyMax > 100
                    arm('outOnly', {
                        testId: 'out-only',
                        reached: (r) => overshot && near(r?.x, 0),
                        withinMs: 300,
                        expectReach: true
                    })
                }}
            >
                out-only
            </motion.div>
        </div>

        <div class="cell">
            <motion.div
                data-testid="used-once"
                class="card pink"
                initial={false}
                animate={{ opacity: usedOnceTarget, transition: { delay: 2 } }}
                whileHover={{ opacity: 1, transition: { type: false, out: true } }}
            >
                used-once
            </motion.div>
            <button
                type="button"
                data-testid="used-once-change"
                onclick={() => {
                    usedOnceTarget = 0
                    arm('usedOnce', {
                        testId: 'used-once',
                        reached: (r) => (r?.opacity ?? 1) < 0.49,
                        withinMs: 500,
                        expectReach: false
                    })
                }}
            >
                Change animate
            </button>
        </div>

        <div class="cell">
            <div class="slot">
                <AnimatePresence present={exitVisible}>
                    {#snippet child()}
                        <motion.div
                            data-testid="exit-hovered"
                            class="card teal"
                            initial={false}
                            animate={{ opacity: 0.5 }}
                            whileHover={{ opacity: 1, transition: { type: false, out: true } }}
                            exit={{ opacity: 0, transition: { delay: 1.5, duration: 0.2 } }}
                        >
                            exit-hovered
                        </motion.div>
                    {/snippet}
                </AnimatePresence>
            </div>
            <button
                type="button"
                data-testid="exit-toggle"
                onclick={() => {
                    exitVisible = !exitVisible
                    if (!exitVisible) {
                        arm('exit', {
                            testId: 'exit-hovered',
                            reached: (r) => r === null || r.opacity < 0.99,
                            withinMs: 600,
                            expectReach: false
                        })
                    }
                }}
            >
                Toggle exit
            </button>
        </div>
    </div>
</main>

<TesterPanel eyebrow="Motion 14.7 · #1725" title="transition.out on gestures" {steps}>
    {#snippet summary()}
        {#each Object.keys(labels) as Key[] as key (key)}
            <span class="verdict {verdicts[key]}">{labels[key]}: {chip(verdicts[key])}</span>
        {/each}
    {/snippet}
    {#snippet checks()}
        <p>
            <code>transition.out</code> sets the transition a value uses when it <em>leaves</em> a
            state for a lower-priority one. <code>out: true</code> reuses the state's own transition;
            an object is a separate one.
        </p>
        <p>
            Without <code>out</code>, the state being entered chooses (the control card). A list of
            labels uses the last label that sets <code>out</code>. Setting only <code>out</code>
            keeps the value's default transition on the way in. An <code>out</code> is used once,
            and exit always uses <code>exit</code>'s own transition.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .page {
        padding: 48px 32px;
    }
    .grid {
        display: grid;
        grid-template-columns: repeat(4, 160px);
        gap: 64px 128px;
    }
    .cell {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 160px;
    }
    .slot {
        width: 160px;
        height: 100px;
    }
    .page :global(.card) {
        width: 160px;
        height: 100px;
        border-radius: 12px;
        color: #fff;
        font: 600 12px/1.4 system-ui;
        padding: 8px;
        box-sizing: border-box;
    }
    .page :global(.blue) {
        background: #0077ff;
    }
    .page :global(.slate) {
        background: #475569;
    }
    .page :global(.violet) {
        background: #7c3aed;
    }
    .page :global(.green) {
        background: #16a34a;
    }
    .page :global(.orange) {
        background: #ea580c;
    }
    .page :global(.pink) {
        background: #db2777;
    }
    .page :global(.teal) {
        background: #0d9488;
    }
    button {
        border: 1px solid #ccd6e2;
        border-radius: 8px;
        padding: 6px 12px;
        background: #fff;
        color: #34465d;
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
