<script lang="ts">
    import { usePresence } from '$lib'

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

<div
    bind:this={node}
    class="card"
    class:exiting={!isPresent}
    data-testid="card"
    data-is-present={isPresent}
>
    {isPresent ? 'present' : 'exiting'}
</div>

<style>
    .card {
        width: 200px;
        padding: 16px 20px;
        border-radius: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-weight: 500;
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
</style>
