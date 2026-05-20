<script lang="ts">
    import { AnimatePresence, PresenceChild } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'
    import UsePresenceCard from './UsePresenceCard.svelte'

    // Custom exit driven from the child: `<PresenceChild present={…}>` holds the
    // card rendered after `present` flips to `false`. Inside the card, `usePresence`
    // returns `[false, safeToRemove]` once the hold begins — the card runs its own
    // CSS transition and calls `safeToRemove()` on `transitionend` so the wrapper
    // releases it.
    let visible = $state(true)
    let exitsCompleted = $state(0)

    // Defer the AnimatePresence subtree until after hydration — SSR doesn't have a
    // window to register presence children against.
    let mounted = $state(false)
    onMount(() => (mounted = true))
</script>

<!-- HUMANSPEAK: docs-kit positioning shell — stripped from the published code. -->
<div class="humanspeak-demo-shell">
    <div class="controls">
        <button type="button" class="primary" onclick={() => (visible = !visible)}>
            {visible ? 'Hide' : 'Show'}
        </button>
        <span class="status">exitsCompleted: {exitsCompleted}</span>
    </div>

    <div class="stage">
        {#if mounted}
            <AnimatePresence onExitComplete={() => exitsCompleted++}>
                <PresenceChild present={visible}>
                    <UsePresenceCard />
                </PresenceChild>
            </AnimatePresence>
        {/if}
    </div>
</div>

<style>
    .humanspeak-demo-shell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 2rem;
        min-height: 420px;
    }

    .controls {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .stage {
        min-height: 80px;
        display: flex;
        align-items: center;
    }

    button {
        font-size: 13px;
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid transparent;
        cursor: pointer;
    }

    button.primary {
        background: #2563eb;
        color: white;
    }

    .status {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.65);
    }
</style>
