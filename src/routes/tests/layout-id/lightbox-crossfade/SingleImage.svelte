<script lang="ts">
    import { motion, useIsPresent } from '$lib'
    import type { MotionTransition } from '$lib/types'

    /**
     * The lightbox of `layout-shared-lightbox-crossfade.tsx` @ v14.7.1: an
     * overlay plus a `layoutId={color}` card holding a
     * `layoutId="child-{color}"` dot. Rendered as the owned `AnimatePresence`
     * child of `+page.svelte`.
     *
     * @prop color The colour latched while the lightbox was open (plan 012 M3).
     * @prop transition The shared transition.
     * @prop close Closes the lightbox.
     */
    let {
        color,
        transition,
        close
    }: { color: string; transition: MotionTransition; close: () => void } = $props()

    const isPresent = $derived(useIsPresent())
</script>

<motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    style={{
        background: 'rgba(0,0,0,0.6)',
        position: 'fixed',
        top: '0',
        left: '0',
        bottom: '0',
        right: '0',
        pointerEvents: isPresent ? 'auto' : 'none'
    }}
    id="overlay"
    {transition}
    onclick={close}
/>
<div
    style="position: absolute; top: 0; left: 0; bottom: 0; right: 0; display: flex; justify-content: center; align-items: center; pointer-events: none;"
>
    <motion.div
        id="parent"
        layoutId={color}
        style={{
            width: '500px',
            height: '300px',
            padding: 50,
            backgroundColor: '#fff',
            borderRadius: 50
        }}
        {transition}
    >
        <motion.div
            style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                opacity: 0.5,
                backgroundColor: 'black'
            }}
            id="child"
            layoutId="child-{color}"
            {transition}
        />
    </motion.div>
</div>
