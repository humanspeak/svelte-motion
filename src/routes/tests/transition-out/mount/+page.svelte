<script lang="ts">
    /**
     * `transition.out` on `initial` (#1725): the mount animation only.
     *
     * Ports the mount cases of upstream
     * `packages/framer-motion/src/motion/__tests__/transition-out.test.tsx` @ v14.7.1:
     * "the issue's example" (`mount-out`), "initial's out transition from a
     * variant label" + "variant children use the inherited initial's out
     * transition on mount" (`mount-label` / `mount-label-child`), and "initial's
     * out doesn't apply to values initial doesn't change on mount"
     * (`mount-unchanged`). Upstream's `delay: 10` is `delay: 2` here, and
     * `{ type: false }` is "instant".
     *
     * Every card renders client-only (`{#if mounted}`). Rendered on the server,
     * they would emit an optimized-appear script from the SSR generator, and
     * these results would depend on hydration timing. The SSR appear behaviour
     * is tested on `/tests/optimized-appear/initial-out` instead.
     *
     * @component
     */
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    let mounted = $state(false)
    let remountKey = $state(0)
    let target = $state(0)

    const labelVariants = {
        hidden: { opacity: 0, transition: { out: { type: false as const } } },
        visible: { opacity: 1, transition: { delay: 2 } }
    }

    const remount = () => {
        target = 0
        remountKey += 1
        startRun()
    }

    // ---- Live verdicts (tester only) ----

    type Verdict = 'waiting' | 'ok' | 'bad'
    const verdicts = $state<Record<'mount' | 'hoverEnd' | 'label' | 'unchanged', Verdict>>({
        mount: 'waiting',
        hoverEnd: 'waiting',
        label: 'waiting',
        unchanged: 'waiting'
    })

    let isTester = false
    let mountedAt = 0
    let leftAt = -1
    let movedAt = -1

    const read = (testId: string) => {
        const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
        if (!element) return null
        const style = getComputedStyle(element)
        const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform)
        return { scale: matrix.a, x: matrix.e, opacity: Number(style.opacity) }
    }

    const startRun = () => {
        mountedAt = performance.now()
        leftAt = -1
        movedAt = -1
        verdicts.mount = 'waiting'
        verdicts.hoverEnd = 'waiting'
        verdicts.label = 'waiting'
        verdicts.unchanged = 'waiting'
    }

    const onHoverEnd = () => {
        if (isTester) leftAt = performance.now()
    }

    const moveUnchanged = () => {
        target = 100
        movedAt = performance.now()
    }

    onMount(() => {
        mounted = true
        isTester = !window.location.search.includes('@isPlaywright=true')
        if (!isTester) return

        startRun()
        let raf = 0
        const sample = () => {
            raf = requestAnimationFrame(sample)
            const now = performance.now()
            const sinceMount = now - mountedAt

            const card = read('mount-out')
            if (card && verdicts.mount === 'waiting' && sinceMount > 600) {
                // The 1.5 s mount delay from initial's out still holds.
                verdicts.mount = card.scale < 0.05 ? 'ok' : 'bad'
            }
            if (card && leftAt >= 0) {
                if (Math.abs(card.scale - 1) < 0.01) {
                    verdicts.hoverEnd = now - leftAt <= 600 ? 'ok' : 'bad'
                    leftAt = -1
                } else if (now - leftAt > 600) {
                    verdicts.hoverEnd = 'bad'
                    leftAt = -1
                }
            }

            const parent = read('mount-label')
            const child = read('mount-label-child')
            if (parent && child && verdicts.label === 'waiting') {
                if (parent.opacity === 1 && child.opacity === 1) {
                    verdicts.label = sinceMount <= 500 ? 'ok' : 'bad'
                } else if (sinceMount > 500) {
                    verdicts.label = 'bad'
                }
            }

            const unchanged = read('mount-unchanged')
            if (unchanged && movedAt >= 0 && now - movedAt > 500) {
                verdicts.unchanged = unchanged.x === 0 ? 'ok' : 'bad'
                movedAt = -1
            }
        }
        raf = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(raf)
    })

    const steps: TesterStep[] = [
        {
            text: 'Load the page (or press "Remount"). Watch the blue "mount-out" card.',
            expected:
                'It stays invisible for ~1.5 s, then pops in quickly. The "Mount delay" chip reads OK ✓.'
        },
        {
            text: 'Once it is in, hover it, then move the pointer away.',
            expected:
                'It grows quickly on hover and shrinks back right away on leave (no 1.5 s wait). "Hover end" reads OK ✓.',
            action: { label: 'Remount', run: () => remount() }
        },
        {
            text: 'Watch the two green "label" cards on load or remount.',
            expected: 'Both are fully visible immediately, not after 2 s. "Label" reads OK ✓.'
        },
        {
            text: 'Click "Move" under the orange card.',
            expected:
                'It waits ~2 s before sliding right: initial’s instant out only covered the mount. "Unchanged" reads OK ✓.'
        }
    ]

    const chip = (v: Verdict) => (v === 'ok' ? 'OK ✓' : v === 'bad' ? 'FAIL ✗' : 'WAITING')
</script>

<svelte:head>
    <title>transition.out · mount (#1725)</title>
</svelte:head>

<main class="page">
    <button type="button" data-testid="remount" onclick={remount}>Remount</button>

    {#if mounted}
        {#key remountKey}
            <div class="grid">
                <div class="cell">
                    <motion.div
                        data-testid="mount-out"
                        class="card blue"
                        initial={{ scale: 0, transition: { out: { delay: 1.5 } } }}
                        animate={{ scale: 1, transition: { duration: 0.15 } }}
                        whileHover={{ scale: 1.3, transition: { duration: 0.15 } }}
                        {onHoverEnd}
                    >
                        mount-out
                    </motion.div>
                </div>

                <div class="cell">
                    <motion.div
                        data-testid="mount-label"
                        class="card green"
                        variants={labelVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        mount-label
                        <motion.div
                            data-testid="mount-label-child"
                            class="child"
                            variants={labelVariants}
                        >
                            child
                        </motion.div>
                    </motion.div>
                </div>

                <div class="cell">
                    <motion.div
                        data-testid="mount-unchanged"
                        class="card orange"
                        initial={{ x: 0, transition: { out: { type: false } } }}
                        animate={{ x: target }}
                        transition={{ delay: 2 }}
                    >
                        mount-unchanged
                    </motion.div>
                    <button type="button" data-testid="move-unchanged" onclick={moveUnchanged}>
                        Move
                    </button>
                </div>
            </div>
        {/key}
    {/if}
</main>

<TesterPanel
    eyebrow="Motion 14.7 · #1725"
    title="transition.out on initial times the mount only"
    {steps}
>
    {#snippet summary()}
        <span class="verdict {verdicts.mount}">Mount delay: {chip(verdicts.mount)}</span>
        <span class="verdict {verdicts.hoverEnd}">Hover end: {chip(verdicts.hoverEnd)}</span>
        <span class="verdict {verdicts.label}">Label: {chip(verdicts.label)}</span>
        <span class="verdict {verdicts.unchanged}">Unchanged: {chip(verdicts.unchanged)}</span>
    {/snippet}
    {#snippet checks()}
        <p>
            <code>initial</code>'s <code>transition.out</code> is the transition of the mount
            animation, and only that: later returns to <code>animate</code> (hover end, prop changes)
            use their own transitions.
        </p>
        <p>
            A variant child inherits its parent's <code>initial</code> label, so it uses the same
            <code>out</code>. Values <code>initial</code> doesn't change on mount aren't affected.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .page {
        padding: 32px;
    }
    .grid {
        display: flex;
        gap: 48px;
        margin-top: 32px;
    }
    .cell {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 160px;
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
    .page :global(.green) {
        background: #16a34a;
    }
    .page :global(.orange) {
        background: #ea580c;
    }
    .page :global(.child) {
        margin-top: 8px;
        width: 60px;
        height: 40px;
        border-radius: 8px;
        background: #052e16;
        padding: 4px;
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
