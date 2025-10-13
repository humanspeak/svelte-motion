import type { DragControls } from '$lib/types'

/**
 * Create imperative controls to start/cancel/stop a drag on a target element.
 */
export function createDragControls(): DragControls {
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
