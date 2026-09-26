<script lang="ts">
    import { AnimatePresence, PresenceChild, motion, useMotionValue, useReducedMotion } from '$lib'
    import { onDestroy, onMount } from 'svelte'
    import CustomExit from './CustomExit.svelte'
    import WaitChild from './WaitChild.svelte'

    let visible = $state(true)
    let exitCompletes = $state(0)

    // Wait-mode swap demo
    let slot: 'a' | 'b' = $state('a')

    let ownedPresent = $state(true)
    let ownedPhase = $state('ready')
    let ownedCompletions = $state(0)
    let replaying = $state(false)
    let sequenceTimers: ReturnType<typeof setTimeout>[] = []

    function clearSequence() {
        sequenceTimers.forEach(clearTimeout)
        sequenceTimers = []
        replaying = false
    }

    function toggleOwned() {
        ownedPresent = !ownedPresent
        ownedPhase = ownedPresent ? 'shown' : 'exiting'
    }

    function replayOwned() {
        if (replaying) return
        clearSequence()
        replaying = true
        ownedPresent = true
        ownedPhase = 'preparing'
        sequenceTimers = [
            setTimeout(() => {
                ownedPresent = false
                ownedPhase = 'exit A'
            }, 200),
            setTimeout(() => {
                ownedPresent = true
                ownedPhase = 'reentered'
            }, 450),
            setTimeout(() => {
                ownedPresent = false
                ownedPhase = 'exit B'
            }, 700)
        ]
    }

    function resetOwned() {
        clearSequence()
        ownedPresent = true
        ownedPhase = 'ready'
    }

    function completeOwned() {
        // A cancelled exit also balances the parent's pending-exit counter.
        ownedCompletions += 1
        if (!ownedPresent) {
            ownedPhase = 'removed'
            clearSequence()
        }
    }

    onDestroy(clearSequence)

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

<svelte:head>
    <title>usePresence Test</title>
</svelte:head>

<div class="page">
    <header>
        <h1>usePresence</h1>
        <p>
            <code>PresenceChild</code> holds the child rendered until <code>safeToRemove()</code>
            fires. The exit animation here is a CSS transition driven from inside the child via the hook.
        </p>
    </header>

    <section class="block">
        <h2>Basic toggle (mode='sync')</h2>
        <button
            type="button"
            data-testid="toggle-basic"
            onclick={() => (visible = !visible)}
            class="primary"
        >
            {visible ? 'Hide' : 'Show'}
        </button>
        <span data-testid="exits-completed">exitsCompleted: {exitCompletes}</span>

        <div class="stage" data-testid="stage-basic">
            <AnimatePresence onExitComplete={() => exitCompletes++}>
                <PresenceChild present={visible}>
                    <CustomExit />
                </PresenceChild>
            </AnimatePresence>
        </div>
    </section>

    <section class="block">
        <h2>Owned motion child: interrupted exit</h2>
        <p class="hint">
            Hide, show, then hide again during the one-second fade. The same real node must survive
            re-entry, and the interrupted first exit must not remove the second exit early.
            Completion notifications include cancelled exits.
        </p>
        <div class="controls">
            <button
                type="button"
                class="primary"
                data-testid="toggle-owned"
                disabled={replaying}
                onclick={toggleOwned}
            >
                {ownedPresent ? 'Hide' : 'Show'}
            </button>
            <button
                type="button"
                class="primary"
                data-testid="replay-owned"
                disabled={replaying}
                onclick={replayOwned}
            >
                Replay hide / show / hide
            </button>
            <button type="button" class="primary" data-testid="reset-owned" onclick={resetOwned}
                >Reset</button
            >
        </div>
        <span data-testid="owned-phase">{ownedPhase}</span>
        <span data-testid="owned-completions">completion notifications: {ownedCompletions}</span>
        <div class="stage">
            <AnimatePresence present={ownedPresent} onExitComplete={completeOwned}>
                {#snippet child()}
                    <motion.div
                        data-testid="owned-motion-card"
                        initial={false}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 80 }}
                        transition={{ duration: 1, ease: 'linear' }}
                        style="padding: 20px; border-radius: 8px; background: #2563eb; color: white"
                    >
                        Same node until the current exit completes
                    </motion.div>
                {/snippet}
            </AnimatePresence>
        </div>
    </section>

    <section class="block">
        <h2>Owned group: wait for every descendant exit</h2>

        <div class="group-demo">
            <p>
                Click <strong>Hide group</strong>. Fast finishes first; the wrapper stays mounted
                while Slow finishes. Both are removed together. Show during exit to cancel, or Reset
                to start over.
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
            <div class="group-stage">
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
                                <div
                                    bind:this={groupNode}
                                    class="cards"
                                    data-testid="owned-group-wrapper"
                                >
                                    <motion.div
                                        data-testid="group-fast-card"
                                        initial={false}
                                        animate="visible"
                                        exit={exitLabel}
                                        variants={{
                                            visible: { opacity: 1, x: 0 },
                                            [exitLabel]: {
                                                opacity: 0.15,
                                                x: reduced.current ? 0 : 100
                                            }
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
                                            [exitLabel]: {
                                                opacity: 0.15,
                                                x: reduced.current ? 0 : 100
                                            }
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
                <label
                    >Fast <progress max="100" value={fastProgress}></progress>
                    {fastProgress}%</label
                >
                <label
                    >Slow <progress max="100" value={slowProgress}></progress>
                    {slowProgress}%</label
                >
            </div>
            <p class="note">
                Progress follows the animated position. Completion states come from animation
                callbacks; the mounted state follows the actual wrapper.
            </p>
        </div>
    </section>

    <section class="block">
        <h2>mode='wait' integration with motion.* enter</h2>
        <p class="hint">
            Click <code>swap</code> — the new motion element waits for the old PresenceChild's
            <code>safeToRemove</code> before its enter animation runs.
        </p>
        <button
            type="button"
            data-testid="toggle-wait"
            onclick={() => (slot = slot === 'a' ? 'b' : 'a')}
            class="primary"
        >
            swap (current: {slot})
        </button>

        <div class="stage" data-testid="stage-wait">
            <AnimatePresence mode="wait">
                <PresenceChild present={slot === 'a'}>
                    <WaitChild label="A" />
                </PresenceChild>
                <PresenceChild present={slot === 'b'}>
                    <WaitChild label="B" />
                </PresenceChild>
            </AnimatePresence>
        </div>
    </section>
</div>

<style>
    .page {
        padding: 24px;
        max-width: 640px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 24px;
    }

    .block {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        border: 1px solid #d4d4d8;
        border-radius: 10px;
    }

    .stage {
        min-height: 80px;
        display: flex;
        align-items: center;
    }

    .hint {
        color: #555;
        font-size: 13px;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    button:disabled {
        opacity: 0.5;
        cursor: default;
    }

    button.primary {
        align-self: flex-start;
        background: #2563eb;
        color: white;
        font-size: 14px;
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid transparent;
        cursor: pointer;
    }

    span {
        font-size: 13px;
        color: #555;
    }

    .group-demo {
        width: 100%;
        max-width: 640px;
        margin: auto;
        padding: 24px;
        color: var(--brut-ink, #222);
    }
    .group-demo p {
        line-height: 1.6;
        margin: 0 0 16px;
    }
    .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 20px;
    }
    .group-demo button {
        font: inherit;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-accent-soft, #edf6f3);
        color: inherit;
        cursor: pointer;
    }
    .group-demo button:disabled {
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
    .group-demo dt {
        font-size: 12px;
        opacity: 0.7;
    }
    .group-demo dd {
        margin: 6px 0 0;
        font-weight: 600;
    }
    .group-stage {
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
    .group-demo label {
        display: flex;
        align-items: center;
        gap: 10px;
        font-variant-numeric: tabular-nums;
    }
    .group-demo progress {
        flex: 1;
        min-width: 0;
        accent-color: var(--brut-accent, #247768);
    }
    .note {
        font-size: 12px;
        opacity: 0.7;
    }
</style>
