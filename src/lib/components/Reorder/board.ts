/**
 * `Reorder.Board`'s logic: a near line-for-line port of Motion 14.10.1
 * `components/Reorder/Board.tsx` `createBoard` and its helpers, pointer
 * and keyboard paths. Deviations are marked `// Svelte:`, so the next upstream diff
 * (`git -C ~/Github/motion diff <old> <new> -- packages/framer-motion/src/components/Reorder/Board.tsx`)
 * maps onto this file.
 */
import {
    elementDragControls,
    microtask,
    visualElementStore,
    type AnyResolvedKeyframe,
    type VisualElement,
    type VisualElementDragControls
} from 'motion-dom'
import { getContext, setContext } from 'svelte'
import type { ReorderBoardContextProps, ReorderContextProps } from './context'
import type { ReorderAxis } from './types'

/** A point in client or page coordinates. */
export interface Point {
    x: number
    y: number
}

/**
 * The board's latest props, read through a getter.
 */
export interface BoardProps {
    /**
     * Whether `value` can move from the group whose values are `from` to
     * the group whose values are `to`. Return `false` to leave it where it
     * is.
     */
    canMove?: (value: never, from: never[], to: never[]) => boolean
}

// Svelte: a group is identified by its context object, not its `groupRef`.
type Group = ReorderContextProps<unknown>
type DragEvent = MouseEvent | TouchEvent | PointerEvent

/**
 * An item moved to another group, to be picked up by its new component
 * (`Board.tsx:46-67`).
 */
interface Handoff {
    value: unknown
    to: Group
    /**
     * The element it was moved from, and its centre in page coordinates.
     */
    element: Element
    centre: Point
    /**
     * Svelte: the element's VisualElement, captured when it moves. Svelte
     * destroys the old row in the same flush that mounts the new one, and
     * its teardown deletes the element's `visualElementStore` entry, so
     * `receive` can't look it up by element as upstream does.
     */
    visualElement?: VisualElement
    /**
     * When dragged: the gesture, and its latest event to continue it from.
     */
    controls?: VisualElementDragControls
    event?: DragEvent
    /**
     * When moved with the keyboard: the values to keep it grabbed with, if
     * it's still grabbed.
     */
    keys?: boolean
    from?: unknown[]
}

/**
 * An element's centre in client coordinates (`Board.tsx:69-72`).
 *
 * @param element - The element.
 * @returns Its centre.
 */
export const centre = (element: Element): Point => {
    const { left, top, width, height } = element.getBoundingClientRect()
    return { x: left + width / 2, y: top + height / 2 }
}

/**
 * An element's centre in page coordinates (`Board.tsx:74-81`).
 *
 * @param element - The element.
 * @returns Its centre, plus the window's scroll.
 */
export const pageCentre = (element: Element): Point => {
    const { x, y } = centre(element)
    const { scrollX, scrollY } = element.ownerDocument.defaultView!
    return { x: x + scrollX, y: y + scrollY }
}

/**
 * Whether `point` comes before `element` in its group's order: before its
 * centre on `axis` or, on `'xy'`, above its line or before its centre on
 * it (`Board.tsx:83-104`).
 *
 * @param point - A point in client coordinates.
 * @param element - An item in the group.
 * @param axis - The group's axis.
 * @param isRTL - Whether the group is right-to-left.
 * @returns Whether `point` goes before `element`.
 */
export function isBefore(point: Point, element: Element, axis: ReorderAxis, isRTL: boolean) {
    const { left, right, top, bottom } = element.getBoundingClientRect()
    const x = isRTL ? point.x > (left + right) / 2 : point.x <= (left + right) / 2
    const y = point.y <= (top + bottom) / 2

    return axis === 'x' ? x : axis === 'y' ? y : point.y < top || (point.y < bottom && x)
}

/**
 * Whether one group is, or holds, the other: like a list of columns and
 * the list of cards in one of them. Items only move between unrelated
 * groups (`Board.tsx:106-114`).
 *
 * @param a - A group.
 * @param b - Another group.
 * @returns Whether either group's element contains the other's.
 */
export const isNested = (a: Group, b: Group) => {
    // Svelte: `getGroupElement()` replaces `groupRef.current`.
    const x = a.getGroupElement()!
    const y = b.getGroupElement()!
    return x.contains(y) || y.contains(x)
}

/**
 * Create a board: the context that lets the `Reorder.Group`s inside a
 * `Reorder.Board` move dragged items between them. Port of
 * `Board.tsx:116-439` `createBoard`.
 *
 * @param getProps - Returns the board's latest props. Svelte: a getter
 *   replaces upstream's `props.current` ref.
 * @returns The board context.
 */
export function createBoard(getProps: () => BoardProps): ReorderBoardContextProps {
    const groups = new Set<Group>()
    let handoff: Handoff | undefined

    /**
     * Whether `value` can move between these groups, if the app lets it.
     */
    const canMove = (from: Group, to: Group, value: unknown) =>
        !isNested(from, to) &&
        getProps().canMove?.(value as never, from.values as never[], to.values as never[]) !== false

    /**
     * Where the latest keyboard grab began, for Escape to return it there
     * (`Board.tsx:129-132`). Svelte: the group is its context object.
     */
    let origin: { group: Group; from: unknown[] } | undefined

    /**
     * Move `value` from one group to another: to `index` in its values or,
     * by default, the slot under the item's centre (`Board.tsx:134-191`).
     */
    const move = (
        from: Group,
        to: Group,
        value: unknown,
        element: Element,
        props: Partial<Handoff>,
        index?: number
    ) => {
        const point = centre(element)
        const { values } = to

        if (index === undefined) {
            /**
             * Only the items it shows: a group keeps unmounted (e.g.
             * virtualized) items' data while their values remain.
             *
             * Svelte: items' elements are getters in `to.elements`.
             */
            const itemElement = (item: unknown) => to.elements.get(item)?.()
            const order = to.getOrder().filter((item) => itemElement(item.value)?.isConnected)
            const isRTL = getComputedStyle(to.getGroupElement()!).direction === 'rtl'
            const next = order.find((item) =>
                isBefore(point, itemElement(item.value)!, to.axis, isRTL)
            )
            const last = order[order.length - 1]
            index = next
                ? values.indexOf(next.value)
                : last
                  ? values.indexOf(last.value) + 1
                  : values.length
        }

        handoff = {
            value,
            to,
            element,
            centre: pageCentre(element),
            ...props
        }

        /**
         * The release that ends a drag lands over the new group.
         *
         * Svelte: `markReordered()` replaces `to.hasReordered.current = true`.
         */
        to.markReordered()

        from.onReorder(
            from.values.filter((item) => item !== value),
            value
        )
        to.onReorder([...values.slice(0, index), value, ...values.slice(index)], value)
    }

    return {
        add: (group) => {
            groups.add(group)
            return () => groups.delete(group)
        },

        drag: (from, value, element, event) => {
            /**
             * The item can unmount mid-drag (e.g. the app removed it), while
             * its gesture carries on until release.
             */
            if (!element?.isConnected) return false

            /**
             * Wait for the item to arrive in its new group before moving
             * it again, keeping up with where it's dragged meanwhile, for
             * its drag to carry on from there. If the groups don't take
             * it, it stays here until this gesture ends.
             */
            if (handoff?.controls?.isDragging) {
                if (handoff.value === value) {
                    handoff.centre = pageCentre(element)
                    handoff.event = event
                }
                return true
            }

            const point = centre(element)
            let to: Group | undefined

            for (const hit of element.ownerDocument.elementsFromPoint(point.x, point.y)) {
                // Skip the item, which is drawn above everything else
                if (element.contains(hit)) continue

                for (const group of groups) {
                    if (group.getGroupElement() === hit) to = group
                }

                if (to) break
            }

            if (!to || !canMove(from, to, value)) return false

            const visualElement = visualElementStore.get(element)
            move(from, to, value, element, {
                // Svelte: keep the VisualElement itself (see `Handoff`).
                visualElement,
                controls: visualElement && elementDragControls.get(visualElement),
                event
            })

            return true
        },

        key: (from, value, keyIndex, element, grabbed) => {
            const point = centre(element)
            const axis = keyIndex % 2 ? 'x' : 'y'
            const direction = keyIndex > 1 ? 1 : -1
            let to: Group | undefined
            let nearest = Infinity

            for (const group of groups) {
                // Svelte: `getGroupElement()` replaces `groupRef.current`.
                const target = group.getGroupElement()
                if (!target) continue

                const { left, right, top, bottom, width, height } = target.getBoundingClientRect()

                // Hidden, e.g. display: none
                if (!width && !height) continue

                /**
                 * Its near edge is past the item that way, so a group beside
                 * this one isn't below its last item, whatever their heights.
                 */
                const edge = [bottom, right, top, left][keyIndex]
                if ((edge - point[axis]) * direction <= 0) continue

                const x = Math.max(left - point.x, 0, point.x - right)
                const y = Math.max(top - point.y, 0, point.y - bottom)
                if (x * x + y * y < nearest && canMove(from, group, value)) {
                    nearest = x * x + y * y
                    to = group
                }
            }

            if (!to) return false

            if (origin?.from !== grabbed) {
                origin = { group: from, from: grabbed }
            }
            move(from, to, value, element, { keys: true, from: grabbed })

            return true
        },

        restore: (from, value, element, grabbed) => {
            const to =
                origin?.from === grabbed && [...groups].find((group) => group === origin!.group)

            if (!to || to === from) return false

            /**
             * Before the first value that followed it when it was grabbed,
             * and is still there.
             */
            const after = grabbed.slice(grabbed.indexOf(value) + 1)
            const index = to.values.findIndex((item) => after.includes(item))

            origin = undefined
            move(from, to, value, element, { keys: true }, index < 0 ? to.values.length : index)

            return true
        },

        end: (value) => {
            if (handoff?.value === value) handoff = undefined
        },

        isMoving: (element) => handoff?.element === element,

        receive: (to, value, element, grab) => {
            const visualElement = visualElementStore.get(element)
            const nextControls = visualElement && elementDragControls.get(visualElement)

            /**
             * React 19's Strict Mode remounts a new item, which resets its
             * whileDrag, after its drag may already have carried on.
             */
            if (nextControls?.isDragging) {
                void visualElement!.animationState?.setActive('whileDrag', true)
            }

            const latest = handoff
            // Svelte: the group is its context object.
            if (!latest || latest.value !== value || latest.to !== to) {
                return false
            }

            const { keys, from, controls } = latest
            /**
             * Whether the groups moved the item, rather than copied it.
             */
            const isMoved = !latest.element.isConnected

            if (keys) {
                handoff = undefined
                /**
                 * Unless focus has moved on since, e.g. the groups took it
                 * much later.
                 */
                const { activeElement, body } = element.ownerDocument
                if (isMoved && (!activeElement || activeElement === body)) {
                    ;(element as HTMLElement).focus()
                    grab(element as HTMLElement, from)
                }
                return false
            }

            if (!nextControls || !controls?.isDragging) return false

            /**
             * Once the commit that moved the item has been measured, and
             * before it's drawn. Until then, the item's drag in its
             * previous group waits.
             */
            microtask.read(() => {
                if (handoff !== latest) return
                handoff = undefined

                /**
                 * Start it where, and as, the item was dragged to (e.g.
                 * mid-way through its whileDrag animation), and carry on
                 * dragging it from there. Values are read from the item
                 * first, for its whileDrag to return to on release.
                 *
                 * Svelte: from the VisualElement captured on the move, as
                 * the old element's store entry is gone by now.
                 */
                latest.visualElement?.values.forEach((motionValue, key) => {
                    const current = motionValue.get() as AnyResolvedKeyframe
                    const initial = visualElement.readValue(key, current) as AnyResolvedKeyframe
                    visualElement.getValue(key, initial)?.set(current)
                })

                /**
                 * Into the item's own coordinates, e.g. in a scaled parent.
                 */
                const transform =
                    (visualElement.getTransformPagePoint() as
                        ((point: Point) => Point) | undefined) || ((p: Point) => p)
                const a = transform(latest.centre)
                const b = transform(pageCentre(element))
                visualElement.getValue('x')!.set(a.x - b.x)
                visualElement.getValue('y')!.set(a.y - b.y)
                visualElement.render()

                /**
                 * If the item is still in its previous group, animate it
                 * back to its slot there.
                 */
                if (isMoved) controls.cancel()
                else controls.stop()
                nextControls.start(latest.event as PointerEvent, { immediate: true })
            })

            /**
             * Its drag already started in its previous group.
             */
            return isMoved
        },

        column: (group) => {
            // Svelte: `getGroupElement()` replaces `groupRef.current`.
            let element: Element | null = group.getGroupElement()
            const holdsOther = (ancestor: Element) =>
                [...groups].some((other) => {
                    const otherElement = other.getGroupElement()
                    return other !== group && !!otherElement && ancestor.contains(otherElement)
                })

            while (element?.parentElement?.parentElement && !holdsOther(element.parentElement)) {
                element = element.parentElement
            }

            return element
        }
    }
}

const REORDER_BOARD_CONTEXT_KEY = Symbol('reorder-board')

/**
 * Publish a board for the `Reorder.Group`s and `Reorder.Item`s inside it.
 * Called once by `Reorder.Board` during component init.
 *
 * @param board - The board, from `createBoard`.
 */
export const setReorderBoardContext = (board: ReorderBoardContextProps): void => {
    setContext<ReorderBoardContextProps>(REORDER_BOARD_CONTEXT_KEY, board)
}

/**
 * Read the nearest `Reorder.Board`, or `undefined` outside one.
 *
 * @returns The board, if any.
 */
export const getReorderBoardContext = (): ReorderBoardContextProps | undefined => {
    return getContext<ReorderBoardContextProps | undefined>(REORDER_BOARD_CONTEXT_KEY)
}
