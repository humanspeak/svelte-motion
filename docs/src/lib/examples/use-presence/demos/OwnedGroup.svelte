<script lang="ts">
    import {
        AnimatePresence,
        motion,
        useMotionValue,
        useReducedMotion
    } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'

    const reduced = useReducedMotion()
    let mounted = $state(false)
    onMount(() => (mounted = true))
    let present = $state(true)
    let generation = $state(0)
    let exitCycle = 0
    let exitLabel = $state('exit-0')
    let groupNode = $state<HTMLDivElement>()
    let completions = $state(0)
    let fast = $state('ready')
    let slow = $state('ready')
    const fastX = useMotionValue(0)
    const slowX = useMotionValue(0)
    const fastProgress = $derived(fast === 'finished' ? 100 : present ? 0 : progress(fastX.current))
    const slowProgress = $derived(slow === 'finished' ? 100 : present ? 0 : progress(slowX.current))

    function show() {
        present = true
        fast = slow = 'ready'
    }

    function hide() {
        exitLabel = `exit-${++exitCycle}`
        fast = slow = 'exiting'
        present = false
    }

    function reset() {
        show()
        generation += 1
        fastX.jump(0)
        slowX.jump(0)
        completions = 0
    }

    function progress(x: number) {
        return Math.round(Math.max(0, Math.min(100, x)))
    }
</script>

<div class="group-demo">
    <p>
        Click <strong>Hide group</strong>. Fast finishes first; the wrapper stays mounted while Slow
        finishes. Both are removed together. Show during exit to cancel, or Reset to start over.
    </p>
    <div class="controls">
        <button type="button" data-testid="group-hide" onclick={hide} disabled={!present}
            >Hide group</button
        >
        <button type="button" data-testid="group-show" onclick={show} disabled={present}
            >Show group</button
        >
        <button type="button" data-testid="group-reset" onclick={reset}>Reset</button>
    </div>
    <dl class="metrics" aria-live="polite">
        <div>
            <dt>Fast · {reduced.current ? 'instant' : '0.6 s'}</dt>
            <dd data-testid="group-fast-state">{fast}</dd>
        </div>
        <div>
            <dt>Slow · {reduced.current ? 'instant' : '2.4 s'}</dt>
            <dd data-testid="group-slow-state">{slow}</dd>
        </div>
        <div>
            <dt>Wrapper</dt>
            <dd data-testid="group-mounted">{groupNode ? 'mounted' : 'removed'}</dd>
        </div>
        <div>
            <dt>Completed groups</dt>
            <dd data-testid="group-completions">{completions}</dd>
        </div>
    </dl>
    <div class="stage">
        {#if mounted}
            {#key generation}
                <AnimatePresence
                    {present}
                    onExitComplete={() => {
                        if (!present) {
                            completions += 1
                            fast = slow = 'finished'
                        }
                    }}
                >
                    {#snippet child()}
                        <div bind:this={groupNode} class="cards" data-testid="owned-group-wrapper">
                            <motion.div
                                data-testid="group-fast-card"
                                initial={false}
                                animate="visible"
                                exit={exitLabel}
                                variants={{
                                    visible: { opacity: 1, x: 0 },
                                    [exitLabel]: { opacity: 0.15, x: reduced.current ? 0 : 100 }
                                }}
                                transition={{
                                    duration: reduced.current ? 0 : 0.6,
                                    ease: 'linear'
                                }}
                                onAnimationComplete={(definition) => {
                                    if (!present && (definition as unknown) === exitLabel) {
                                        fast = 'finished'
                                    }
                                }}
                                style={{
                                    x: fastX,
                                    padding: '18px',
                                    borderRadius: '8px',
                                    background: 'var(--brut-accent, #247768)',
                                    color: 'white'
                                }}>Fast exit</motion.div
                            >
                            <motion.div
                                data-testid="group-slow-card"
                                initial={false}
                                animate="visible"
                                exit={exitLabel}
                                variants={{
                                    visible: { opacity: 1, x: 0 },
                                    [exitLabel]: { opacity: 0.15, x: reduced.current ? 0 : 100 }
                                }}
                                transition={{
                                    duration: reduced.current ? 0 : 2.4,
                                    ease: 'linear'
                                }}
                                onAnimationComplete={(definition) => {
                                    if (!present && (definition as unknown) === exitLabel) {
                                        slow = 'finished'
                                    }
                                }}
                                style={{
                                    x: slowX,
                                    padding: '18px',
                                    borderRadius: '8px',
                                    background: 'var(--brut-ink, #222)',
                                    color: 'white'
                                }}>Slow exit</motion.div
                            >
                        </div>
                    {/snippet}
                </AnimatePresence>
            {/key}
        {/if}
    </div>
    <div class="progress">
        <label>Fast <progress max="100" value={fastProgress}></progress> {fastProgress}%</label>
        <label>Slow <progress max="100" value={slowProgress}></progress> {slowProgress}%</label>
    </div>
    <p class="note">
        Progress follows the animated position. Completion states come from animation callbacks; the
        mounted state follows the actual wrapper.
    </p>
</div>

<style>
    .group-demo {
        width: 100%;
        max-width: 640px;
        margin: auto;
        padding: 24px;
        color: var(--brut-ink, #222);
    }
    p {
        line-height: 1.6;
        margin: 0 0 16px;
    }
    .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 20px;
    }
    button {
        font: inherit;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-accent-soft, #edf6f3);
        color: inherit;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .metrics {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin: 0 0 20px;
    }
    .metrics div {
        padding: 12px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        border-radius: 6px;
    }
    dt {
        font-size: 12px;
        opacity: 0.7;
    }
    dd {
        margin: 6px 0 0;
        font-weight: 600;
    }
    .stage {
        min-height: 152px;
        overflow: hidden;
    }
    .cards {
        display: grid;
        gap: 12px;
        padding-right: 100px;
    }
    .progress {
        display: grid;
        gap: 10px;
        margin: 16px 0;
    }
    label {
        display: flex;
        align-items: center;
        gap: 10px;
        font-variant-numeric: tabular-nums;
    }
    progress {
        flex: 1;
        min-width: 0;
        accent-color: var(--brut-accent, #247768);
    }
    .note {
        font-size: 12px;
        opacity: 0.7;
    }
</style>
