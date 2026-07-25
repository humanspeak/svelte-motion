import { frame, type VisualElement } from 'motion-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    attachFocusGesture,
    attachHoverGesture,
    attachInViewGesture,
    attachPressGesture
} from './gestures.js'

/**
 * Thin gesture attachers (#449 plan 003).
 *
 * The whole contract under test is "flip one flag, fire one callback": each
 * gesture must call `animationState.setActive(type, bool)` with the right type
 * and direction, and must NOT call it when the matching `while*` prop is absent
 * (upstream guards on the prop so a callback-only element never starts an empty
 * animation). Animation behaviour itself belongs to the animationState and is
 * covered by the e2e suites.
 */

/** A minimal VisualElement stand-in exposing the two members the attachers use. */
const makeNode = (props: Record<string, unknown>) => {
    const setActive = vi.fn(() => Promise.resolve())
    const node = {
        getProps: () => props,
        animationState: { setActive }
    } as unknown as VisualElement
    return { node, setActive }
}

/** Flush motion-dom's postRender step so queued callbacks run. */
const flushPostRender = async () => {
    await new Promise<void>((resolve) => frame.postRender(() => resolve()))
}

const pointer = (type: string) =>
    new PointerEvent(type, {
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: type === 'pointerdown' ? 1 : 0,
        bubbles: true
    })

describe('attachHoverGesture', () => {
    let element: HTMLElement

    beforeEach(() => {
        vi.useRealTimers()
        element = document.createElement('div')
        document.body.appendChild(element)
    })

    afterEach(() => {
        element.remove()
    })

    it('sets whileHover active on enter and inactive on leave, firing callbacks', async () => {
        const { node, setActive } = makeNode({ whileHover: { scale: 1.1 } })
        const onHoverStart = vi.fn()
        const onHoverEnd = vi.fn()
        const stop = attachHoverGesture(element, node, { onHoverStart, onHoverEnd })

        element.dispatchEvent(pointer('pointerenter'))
        expect(setActive).toHaveBeenCalledWith('whileHover', true)
        await flushPostRender()
        expect(onHoverStart).toHaveBeenCalledTimes(1)

        element.dispatchEvent(pointer('pointerleave'))
        expect(setActive).toHaveBeenCalledWith('whileHover', false)
        await flushPostRender()
        expect(onHoverEnd).toHaveBeenCalledTimes(1)

        stop()
    })

    it('does NOT setActive without a whileHover prop, but still fires callbacks', async () => {
        const { node, setActive } = makeNode({})
        const onHoverStart = vi.fn()
        const stop = attachHoverGesture(element, node, { onHoverStart })

        element.dispatchEvent(pointer('pointerenter'))
        expect(setActive).not.toHaveBeenCalled()
        await flushPostRender()
        expect(onHoverStart).toHaveBeenCalledTimes(1)

        stop()
    })

    it('ignores hover while a drag owns the element', () => {
        const { node, setActive } = makeNode({ whileHover: { scale: 1.1 } })
        // The guard our drag writer already maintains; plan 005 replaces it with
        // motion-dom's global drag lock.
        element.dataset.svelteMotionDragActive = 'true'
        const stop = attachHoverGesture(element, node)

        element.dispatchEvent(pointer('pointerenter'))
        expect(setActive).not.toHaveBeenCalled()

        stop()
    })

    it('detaches on cleanup', () => {
        const { node, setActive } = makeNode({ whileHover: { scale: 1.1 } })
        const stop = attachHoverGesture(element, node)
        stop()

        element.dispatchEvent(pointer('pointerenter'))
        expect(setActive).not.toHaveBeenCalled()
    })
})

describe('attachPressGesture', () => {
    let element: HTMLElement

    beforeEach(() => {
        vi.useRealTimers()
        element = document.createElement('div')
        document.body.appendChild(element)
    })

    afterEach(() => {
        element.remove()
    })

    it('sets whileTap active on press and inactive on release, firing onTap for a success', async () => {
        const { node, setActive } = makeNode({ whileTap: { scale: 0.9 } })
        const onTapStart = vi.fn()
        const onTap = vi.fn()
        const onTapCancel = vi.fn()
        const stop = attachPressGesture(element, node, { onTapStart, onTap, onTapCancel })

        element.dispatchEvent(pointer('pointerdown'))
        expect(setActive).toHaveBeenCalledWith('whileTap', true)
        await flushPostRender()
        expect(onTapStart).toHaveBeenCalledTimes(1)

        // Releasing ON the element is a successful tap.
        element.dispatchEvent(pointer('pointerup'))
        expect(setActive).toHaveBeenCalledWith('whileTap', false)
        await flushPostRender()
        expect(onTap).toHaveBeenCalledTimes(1)
        expect(onTapCancel).not.toHaveBeenCalled()

        stop()
    })

    it('fires onTapCancel when the release lands outside the element', async () => {
        const { node, setActive } = makeNode({ whileTap: { scale: 0.9 } })
        const onTap = vi.fn()
        const onTapCancel = vi.fn()
        const stop = attachPressGesture(element, node, { onTap, onTapCancel })

        element.dispatchEvent(pointer('pointerdown'))
        // Releasing on the window, not the element → cancel.
        window.dispatchEvent(pointer('pointerup'))

        expect(setActive).toHaveBeenCalledWith('whileTap', false)
        await flushPostRender()
        expect(onTapCancel).toHaveBeenCalledTimes(1)
        expect(onTap).not.toHaveBeenCalled()

        stop()
    })

    it('skips disabled buttons entirely', () => {
        const button = document.createElement('button')
        button.disabled = true
        document.body.appendChild(button)
        const { node, setActive } = makeNode({ whileTap: { scale: 0.9 } })
        const onTapStart = vi.fn()
        const stop = attachPressGesture(button, node, { onTapStart })

        button.dispatchEvent(pointer('pointerdown'))
        expect(setActive).not.toHaveBeenCalled()
        expect(onTapStart).not.toHaveBeenCalled()

        stop()
        button.remove()
    })

    it('ignores press while a drag owns the element', () => {
        const { node, setActive } = makeNode({ whileTap: { scale: 0.9 } })
        element.dataset.svelteMotionDragActive = 'true'
        const stop = attachPressGesture(element, node)

        element.dispatchEvent(pointer('pointerdown'))
        expect(setActive).not.toHaveBeenCalled()

        stop()
    })
})

describe('attachFocusGesture', () => {
    let element: HTMLElement

    beforeEach(() => {
        vi.useRealTimers()
        element = document.createElement('div')
        element.tabIndex = 0
        document.body.appendChild(element)
    })

    afterEach(() => {
        element.remove()
    })

    it('sets whileFocus on a :focus-visible focus and clears it on blur', async () => {
        const { node, setActive } = makeNode({ whileFocus: { scale: 1.05 } })
        const onFocusStart = vi.fn()
        const onFocusEnd = vi.fn()
        vi.spyOn(element, 'matches').mockReturnValue(true)
        const stop = attachFocusGesture(element, node, { onFocusStart, onFocusEnd })

        element.dispatchEvent(new FocusEvent('focus'))
        expect(setActive).toHaveBeenCalledWith('whileFocus', true)
        await flushPostRender()
        expect(onFocusStart).toHaveBeenCalledTimes(1)

        element.dispatchEvent(new FocusEvent('blur'))
        expect(setActive).toHaveBeenCalledWith('whileFocus', false)
        await flushPostRender()
        expect(onFocusEnd).toHaveBeenCalledTimes(1)

        stop()
    })

    it('treats a THROWING :focus-visible match as visible (upstream fallback)', () => {
        const { node, setActive } = makeNode({ whileFocus: { scale: 1.05 } })
        // Engines that do not know the selector throw; there the browser paints
        // its own outline, so upstream applies the variant anyway
        // (`focus.ts:14-20`).
        vi.spyOn(element, 'matches').mockImplementation(() => {
            throw new Error('unsupported pseudo-selector')
        })
        const stop = attachFocusGesture(element, node)

        element.dispatchEvent(new FocusEvent('focus'))
        expect(setActive).toHaveBeenCalledWith('whileFocus', true)

        stop()
    })

    it('ignores focus that is not :focus-visible', () => {
        const { node, setActive } = makeNode({ whileFocus: { scale: 1.05 } })
        // Report a real (non-throwing) negative match.
        vi.spyOn(element, 'matches').mockReturnValue(false)
        const stop = attachFocusGesture(element, node)

        element.dispatchEvent(new FocusEvent('focus'))
        expect(setActive).not.toHaveBeenCalled()

        stop()
    })

    it('does not clear on a blur that had no matching focus', () => {
        const { node, setActive } = makeNode({ whileFocus: { scale: 1.05 } })
        const stop = attachFocusGesture(element, node)

        element.dispatchEvent(new FocusEvent('blur'))
        expect(setActive).not.toHaveBeenCalled()

        stop()
    })
})

describe('attachInViewGesture', () => {
    let element: HTMLElement
    let observers: {
        callback: IntersectionObserverCallback
        disconnect: ReturnType<typeof vi.fn>
        unobserve: ReturnType<typeof vi.fn>
    }[]

    beforeEach(() => {
        vi.useRealTimers()
        element = document.createElement('div')
        document.body.appendChild(element)
        observers = []
        vi.stubGlobal(
            'IntersectionObserver',
            class {
                constructor(callback: IntersectionObserverCallback) {
                    const entry = {
                        callback,
                        disconnect: vi.fn(),
                        unobserve: vi.fn()
                    }
                    observers.push(entry)
                    Object.assign(this, {
                        observe: vi.fn(),
                        unobserve: entry.unobserve,
                        disconnect: entry.disconnect,
                        takeRecords: vi.fn(() => [])
                    })
                }
            }
        )
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        element.remove()
    })

    /** Drive the most recently created observer. */
    const intersect = (isIntersecting: boolean) => {
        const observer = observers.at(-1)
        observer?.callback(
            [{ target: element, isIntersecting } as unknown as IntersectionObserverEntry],
            {} as IntersectionObserver
        )
    }

    it('toggles whileInView on enter and leave, firing callbacks', async () => {
        const { node, setActive } = makeNode({ whileInView: { opacity: 1 } })
        const onInViewStart = vi.fn()
        const onInViewEnd = vi.fn()
        const stop = attachInViewGesture(element, node, undefined, {
            onInViewStart,
            onInViewEnd
        })

        intersect(true)
        expect(setActive).toHaveBeenCalledWith('whileInView', true)
        await flushPostRender()
        expect(onInViewStart).toHaveBeenCalledTimes(1)

        intersect(false)
        expect(setActive).toHaveBeenCalledWith('whileInView', false)
        await flushPostRender()
        expect(onInViewEnd).toHaveBeenCalledTimes(1)

        stop()
    })

    it('latches on first entry when `once` is set: no leave, observer detached', async () => {
        const { node, setActive } = makeNode({ whileInView: { opacity: 1 } })
        const onInViewEnd = vi.fn()
        const stop = attachInViewGesture(element, node, { once: true }, { onInViewEnd })

        intersect(true)
        expect(setActive).toHaveBeenCalledWith('whileInView', true)

        // The detach is deferred to a microtask so the observer is not torn down
        // from inside its own callback.
        await Promise.resolve()

        setActive.mockClear()
        intersect(false)
        expect(setActive).not.toHaveBeenCalled()
        await flushPostRender()
        expect(onInViewEnd).not.toHaveBeenCalled()

        stop()
    })

    it('does NOT setActive without a whileInView prop', async () => {
        const { node, setActive } = makeNode({})
        const onInViewStart = vi.fn()
        const stop = attachInViewGesture(element, node, undefined, { onInViewStart })

        intersect(true)
        expect(setActive).not.toHaveBeenCalled()
        await flushPostRender()
        expect(onInViewStart).toHaveBeenCalledTimes(1)

        stop()
    })
})
