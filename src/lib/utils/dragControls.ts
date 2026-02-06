import type { DragControls } from '$lib/types'

/**
 * Creates imperative drag controls for programmatically starting and stopping drags.
 *
 * Use this factory to create a controls object that can trigger a drag from external
 * events (e.g., a button press or keyboard shortcut). Pass the controls to a motion
 * element via the `dragControls` prop, then call `controls.start(event)` to initiate
 * the drag as if the user had pressed down on the element.
 *
 * @returns {DragControls} An object with `start`, `cancel`, `stop`, and `subscribe` methods.
 * @see https://motion.dev/docs/react-motion-component#dragging
 *
 * @example
 * ```svelte
 * <script>
 *   import { motion, createDragControls } from '@humanspeak/svelte-motion'
 *
 *   const controls = createDragControls()
 *
 *   function startDrag(event) {
 *     controls.start(event, { snapToCursor: true })
 *   }
 * </script>
 *
 * <button onpointerdown={startDrag}>Drag handle</button>
 * <motion.div drag="x" dragControls={controls}>
 *   Draggable content
 * </motion.div>
 * ```
 */
export const createDragControls = (): DragControls => {
    let target: HTMLElement | null = null
    let starter: ((e: PointerEvent, snap?: boolean) => void) | null = null
    let cancelInertia: (() => void) | null = null

    const controls: DragControls = {
        start(event, options) {
            if (!target || !starter) return
            const snap = options?.snapToCursor ?? false
            starter(event, snap)
        },
        cancel() {
            cancelInertia?.()
        },
        stop() {
            cancelInertia?.()
        },
        subscribe(el: HTMLElement) {
            target = el
        }
    }

    // Internal hook used by attachDrag to wire controls to the element
    ;(
        controls as unknown as {
            _bind?: (
                el: HTMLElement,
                s: (e: PointerEvent, snap?: boolean) => void,
                c?: () => void
            ) => void
        }
    )._bind = (el, s, c) => {
        target = el
        starter = s
        cancelInertia = c ?? null
    }

    return controls
}
