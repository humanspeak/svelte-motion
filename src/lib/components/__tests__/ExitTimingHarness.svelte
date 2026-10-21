<script lang="ts">
    import AnimatePresence from '$lib/components/AnimatePresence.svelte'
    import { motion } from '$lib/motion'
    import ExitTimingChild from './ExitTimingChild.svelte'
    import PresenceProbe from './PresenceProbe.svelte'

    /**
     * Records whether `#exit-timing-child` is still in the DOM when
     * `onExitComplete` fires (framer-motion #2538).
     *
     * - `variant="held"` (default): the `present` + `child` snippet form. The
     *   subtree is held by `PresenceChild` until the probe's `safeToRemove` is
     *   called (click the `probe` test id).
     * - `variant="clone"`: a plain `{#if}` motion child, which exits via the
     *   clone path.
     */
    let {
        present,
        log,
        variant = 'held'
    }: {
        present: boolean
        log: string[]
        variant?: 'held' | 'clone'
    } = $props()

    const onExitComplete = () =>
        log.push(
            document.getElementById('exit-timing-child')
                ? 'exitComplete:mounted'
                : 'exitComplete:unmounted'
        )
</script>

{#if variant === 'held'}
    <AnimatePresence {present} {onExitComplete}>
        {#snippet child()}
            <ExitTimingChild {log} />
            <PresenceProbe />
        {/snippet}
    </AnimatePresence>
{:else}
    <AnimatePresence {onExitComplete}>
        {#if present}
            <motion.div
                key="exit-timing-clone"
                exit={{ opacity: 0 }}
                transition={{ duration: 0.05 }}
            >
                <ExitTimingChild {log} />
            </motion.div>
        {/if}
    </AnimatePresence>
{/if}
