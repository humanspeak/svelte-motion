<script lang="ts">
    import { AnimatePresence, PresenceChild } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'
    import UsePresenceCard from './UsePresenceCard.svelte'

    let visible = $state(true)
    let exitsCompleted = $state(0)

    // Defer the AnimatePresence subtree until after hydration so the SSR pass
    // doesn't try to register presence children without a window.
    let mounted = $state(false)
    onMount(() => (mounted = true))
</script>

<div class="flex min-h-[420px] flex-col items-center justify-center gap-4 p-8">
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
