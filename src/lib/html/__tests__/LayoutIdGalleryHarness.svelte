<script lang="ts">
    import { motion } from '$lib/motion'

    /**
     * Harness for plan 006 (#1411): upstream's gallery
     * (`layout-id-change.test.tsx` @ v14.7.1, "changing an open card's
     * layoutId"). Thumbnails `one` and `two` each have their own `layoutId`;
     * an open detail card has `layoutId={open}`. `thumbLayoutId` replaces
     * thumbnail one's id, for "shows a follower again once it loses its
     * layoutId" (pass `null` for no id: `undefined` falls back to `'one'`).
     *
     * The spec mocks `getBoundingClientRect` from each element's `data-box`.
     */
    let { open, thumbLayoutId = 'one' }: { open?: string; thumbLayoutId?: string | null } = $props()

    const transition = { type: 'tween', ease: 'linear', duration: 10 } as const
</script>

<motion.div id="one" data-box="one" layoutId={thumbLayoutId ?? undefined} {transition} />
<motion.div id="two" data-box="two" layoutId="two" {transition} />
{#if open}
    <motion.div id="card" data-box="card" layoutId={open} {transition} />
{/if}
