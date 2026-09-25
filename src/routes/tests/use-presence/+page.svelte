<script lang="ts">
    import { AnimatePresence, PresenceChild, motion } from '$lib'
    import { onDestroy } from 'svelte'
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
</style>
