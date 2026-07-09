<!--
    Drag-to-close drawer — a 1:1 port of the Framer Motion "DragCloseDrawer"
    pattern (issue #421). Visual design credit:
    https://www.hover.dev/components/modals
-->
<script lang="ts">
    import { motion, useMotionValue, useAnimate, createDragControls } from '$lib'
    import type { ElementOrSelector } from 'motion'
    import type { Snippet } from 'svelte'

    let {
        open,
        setOpen,
        children
    }: {
        open: boolean
        setOpen: (value: boolean) => void
        children: Snippet
    } = $props()

    const [scope, animate] = useAnimate()

    // react-use-measure → bind:ref + offsetHeight read at close time. We only
    // need the drawer's measured height to slide it fully off the bottom.
    let drawerRef = $state<HTMLElement | null>(null)

    const y = useMotionValue(0)
    const controls = createDragControls()

    const handleClose = async () => {
        animate(scope.current as ElementOrSelector, {
            opacity: [1, 0]
        })

        const yStart = typeof y.get() === 'number' ? y.get() : 0
        const height = drawerRef?.offsetHeight ?? 0

        await animate('#drawer', {
            y: [yStart, height]
        })

        setOpen(false)
    }
</script>

{#if open}
    <motion.div
        {@attach scope}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onclick={handleClose}
        data-testid="drawer-overlay"
        class="fixed inset-0 z-50 bg-neutral-950/70"
    >
        <motion.div
            id="drawer"
            data-testid="drawer"
            bind:ref={drawerRef}
            onclick={(e: MouseEvent) => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: '0%' }}
            transition={{
                ease: 'easeInOut'
            }}
            class="absolute bottom-0 h-[75vh] w-full overflow-hidden rounded-t-3xl bg-neutral-900"
            style={{ y }}
            drag="y"
            dragControls={controls}
            onDragEnd={() => {
                if (y.get() >= 100) {
                    // Fire-and-forget: onDragEnd expects a void return.
                    void handleClose()
                }
            }}
            dragListener={false}
            dragConstraints={{
                top: 0,
                bottom: 0
            }}
            dragElastic={{
                top: 0,
                bottom: 0.5
            }}
        >
            <div class="absolute left-0 right-0 top-0 z-10 flex justify-center bg-neutral-900 p-4">
                <button
                    aria-label="Drag handle"
                    data-testid="drag-handle"
                    onpointerdown={(e: PointerEvent) => {
                        controls.start(e)
                    }}
                    class="h-2 w-14 cursor-grab touch-none rounded-full bg-neutral-700 active:cursor-grabbing"
                ></button>
            </div>
            <div class="relative z-0 h-full overflow-y-scroll p-4 pt-12">
                {@render children()}
            </div>
        </motion.div>
    </motion.div>
{/if}
