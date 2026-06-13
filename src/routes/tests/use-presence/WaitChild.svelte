<script lang="ts">
    import { usePresence } from '$lib'

    type Props = { label: string }
    const { label }: Props = $props()

    const presence = $derived(usePresence())
    const isPresent = $derived(presence[0])
    let node: HTMLElement | undefined = $state()

    $effect(() => {
        const [present, safeToRemove] = presence
        if (present || !node || !safeToRemove) return
        const el = node
        let done = false
        const finish = () => {
            if (done) return
            done = true
            safeToRemove()
        }
        const onEnd = (e: TransitionEvent) => {
            if (e.target !== el) return
            finish()
        }
        const timeout = window.setTimeout(finish, 360)
        el.addEventListener('transitionend', onEnd, { once: true })
        return () => {
            window.clearTimeout(timeout)
            el.removeEventListener('transitionend', onEnd)
        }
    })
</script>

<div
    bind:this={node}
    class="wait-card"
    class:exiting={!isPresent}
    data-testid={`wait-${label.toLowerCase()}`}
    data-is-present={isPresent}
>
    {label}
</div>

<style>
    .wait-card {
        width: 120px;
        padding: 16px;
        border-radius: 10px;
        background: linear-gradient(135deg, #db2777 0%, #f59e0b 100%);
        color: white;
        font-weight: 600;
        text-align: center;
        opacity: 1;
        transform: translateX(0);
        transition:
            opacity 300ms ease,
            transform 300ms ease;
    }

    .wait-card.exiting {
        opacity: 0;
        transform: translateX(12px);
    }
</style>
