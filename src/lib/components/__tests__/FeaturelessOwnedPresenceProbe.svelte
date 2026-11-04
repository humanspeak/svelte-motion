<script lang="ts">
    import { AnimatePresence, LazyMotion, domAnimation, m } from '$lib'

    // Plan 017. A featureless `m` in the owned form registers nothing with
    // its PresenceChild, so the wrapper leaves at once
    // (PresenceChild.tsx:104-113 @ v14.7.1). With `lazy` the same markup sits
    // in `<LazyMotion features={domAnimation}>` (the control).
    type Props = {
        /** Whether the owned child is present. */
        show?: boolean
        /** Wrap it in LazyMotion with features. */
        lazy?: boolean
        onExitComplete?: () => void
    }

    let { show = true, lazy = false, onExitComplete }: Props = $props()
</script>

{#snippet owned()}
    <AnimatePresence present={show} {onExitComplete}>
        {#snippet child()}
            <m.div data-testid="owned-leaver" exit={{ opacity: 0 }} transition={{ duration: 1 }} />
        {/snippet}
    </AnimatePresence>
{/snippet}

{#if lazy}
    <LazyMotion features={domAnimation}>
        {@render owned()}
    </LazyMotion>
{:else}
    {@render owned()}
{/if}
