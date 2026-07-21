<script lang="ts">
    import { usePresence } from '@humanspeak/svelte-motion'

    const presence = $derived(usePresence())
    const isPresent = $derived(presence[0])
    let node: HTMLElement | undefined = $state()

    $effect(() => {
        const [present, safeToRemove] = presence
        if (present || !node || !safeToRemove) return
        const el = node
        const onEnd = (e: TransitionEvent) => {
            if (e.target !== el) return
            safeToRemove()
        }
        el.addEventListener('transitionend', onEnd, { once: true })
        return () => el.removeEventListener('transitionend', onEnd)
    })
</script>

<div bind:this={node} class="card" class:exiting={!isPresent} data-is-present={isPresent}>
    <span class="card-label">// usePresence()</span>
    <strong class="card-value">{isPresent ? 'present' : 'exiting'}</strong>
</div>

<style>
    /* The exit is driven by THIS CSS transition — `usePresence` hands back
       `safeToRemove`, which the card calls on `transitionend`. Keep the
       transition intact; it is the API being demonstrated. */
    .card {
        width: 220px;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        padding: 1rem 1.125rem;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
        opacity: 1;
        transform: translateY(0);
        transition:
            opacity 300ms ease,
            transform 300ms ease;
    }

    .card.exiting {
        opacity: 0;
        transform: translateY(-12px);
    }

    .card-label {
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .card-value {
        font-family: var(--brut-mono, monospace);
        font-size: 0.875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--brut-accent, #247768);
    }
</style>
