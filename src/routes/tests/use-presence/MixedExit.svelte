<script lang="ts">
    import { motion, usePresence } from '$lib'

    // Plan 017. This component is one `usePresence()` participant and the
    // motion card is another. Upstream, `safeToRemove` completes only this
    // participant (use-presence.ts:59-62 @ v14.7.1), so the CSS card's 0.3 s
    // fade does not cut the 1.2 s motion exit short: both stay until the
    // motion card is done.
    const presence = usePresence()
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
            // Marks that this consumer got and used its callback (plan 017).
            el.dataset.released = 'true'
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

<div class="mixed">
    <div
        bind:this={node}
        class="css-card"
        class:exiting={!isPresent}
        data-testid="mixed-css"
        data-is-present={isPresent}
    >
        CSS 0.3 s
    </div>
    <motion.div
        data-testid="mixed-motion"
        class="motion-card"
        initial={false}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.2, ease: 'linear' }}
    >
        motion 1.2 s
    </motion.div>
</div>

<style>
    .mixed {
        display: flex;
        gap: 12px;
    }

    .css-card,
    :global(.motion-card) {
        width: 140px;
        padding: 16px;
        border-radius: 10px;
        color: white;
        font-weight: 600;
        text-align: center;
    }

    .css-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        opacity: 1;
        transition: opacity 300ms ease;
    }

    .css-card.exiting {
        opacity: 0;
    }

    :global(.motion-card) {
        background: #2563eb;
    }
</style>
