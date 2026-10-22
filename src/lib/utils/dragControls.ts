import type { DragControls } from '$lib/types'
import type { VisualElementDragControls } from 'motion-dom'

/**
 * Creates imperative drag controls for programmatically starting and stopping drags.
 *
 * Port of framer-motion's `DragControls` (`gestures/drag/use-drag-controls.ts` @ v14.5.0):
 * a set of the `VisualElementDragControls` of every `motion` element that received these
 * controls via its `dragControls` prop. `start`, `cancel` and `stop` fan out to every
 * subscribed element.
 *
 * Pass the controls to one or more motion elements via the `dragControls` prop, then call
 * `controls.start(event)` to initiate the drag as if the user had pressed down on them.
 *
 * @returns {DragControls} An object with `start`, `cancel`, `stop`, and the internal `subscribe` method.
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
    const componentControls = new Set<VisualElementDragControls>()

    return {
        subscribe(controls) {
            componentControls.add(controls)
            return () => {
                componentControls.delete(controls)
            }
        },
        start(event, options) {
            componentControls.forEach((controls) => controls.start(event, options))
        },
        cancel() {
            componentControls.forEach((controls) => controls.cancel())
        },
        stop() {
            componentControls.forEach((controls) => controls.stop())
        }
    }
}
