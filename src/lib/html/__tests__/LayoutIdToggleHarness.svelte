<script lang="ts">
    import { LayoutGroup } from '$lib'
    import { motion } from '$lib/motion'

    /**
     * Harness for plan 006 finding 2: a `layoutId`-only element inside a
     * `LayoutGroup`, whose `layoutId` (and so upstream's `MeasureLayout`) can
     * be turned off and on, and whose class can change.
     */
    let { on = true, className = 'a' }: { on?: boolean; className?: string } = $props()
</script>

<LayoutGroup>
    <motion.div layoutId={on ? 'toggle-harness' : undefined} class={className}>probe</motion.div>
</LayoutGroup>
