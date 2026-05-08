<script lang="ts">
    import { AnimatePresence, PresenceChild } from '$lib'
    import CustomExit from './CustomExit.svelte'
    import WaitChild from './WaitChild.svelte'

    let visible = $state(true)
    let exitCompletes = $state(0)

    // Wait-mode swap demo
    let slot: 'a' | 'b' = $state('a')
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
