import { isMotionValue } from 'motion-dom'

/**
 * Motion values that can be rendered as live text children.
 *
 * Mirrors upstream Motion's DOM child support, where a `MotionValue<number |
 * string>` passed as `children` renders its current value and writes later
 * changes to `textContent`.
 */
export type MotionValueChild<T extends number | string = number | string> = {
    /** Read the latest child value. */
    get(): T
    /** Subscribe to future child value changes. */
    on(event: 'change', callback: (latest: T) => void): () => void
}

/**
 * Checks whether a value is a renderable MotionValue child.
 *
 * @param value Value to inspect.
 * @returns Whether the value is a `MotionValue<number | string>`.
 */
export const isMotionValueChild = (value: unknown): value is MotionValueChild => {
    return isMotionValue(value)
}

/**
 * Reads the initial text for a MotionValue child.
 *
 * @param child MotionValue child to sample.
 * @returns String form of the child's current value.
 */
export const renderMotionValueChild = <T extends number | string>(
    child: MotionValueChild<T>
): string => `${child.get()}`

/**
 * Subscribes a DOM element's text to a MotionValue child.
 *
 * @param child MotionValue child to observe.
 * @param element Element whose `textContent` should mirror the child.
 * @param onRender Optional callback fired with every rendered text value.
 * @returns Unsubscribe callback.
 */
export const bindMotionValueChild = (
    child: MotionValueChild,
    element: HTMLElement | SVGElement,
    onRender?: (value: string) => void
): (() => void) => {
    return child.on('change', (latest) => {
        const text = `${latest}`
        onRender?.(text)
        element.textContent = text
    })
}
