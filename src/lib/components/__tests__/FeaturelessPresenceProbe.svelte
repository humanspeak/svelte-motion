<script lang="ts">
    import { AnimatePresence, m } from '$lib'

    type Props = {
        /** Whether the bare `m.div` with `exit` is rendered. */
        show?: boolean
    }

    let { show = true }: Props = $props()
</script>

<AnimatePresence>
    {#if show}
        <m.div key="a" data-testid="leaver" exit={{ opacity: 0 }} transition={{ duration: 1 }} />
    {/if}
</AnimatePresence>
