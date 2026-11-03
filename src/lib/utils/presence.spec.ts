import type { MotionExit, MotionTransition } from '$lib/types'
import { animate } from 'motion'
import { nodeGroup, visualElementStore } from 'motion-dom'
import { getContext, setContext, tick } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { markExiting } from './layout'
import { MotionDomProjectionAdapter } from './motionDomProjection'
import {
    containsStatefulCloneContent,
    createAnimatePresenceContext,
    createPopLayoutPointCache,
    getPresenceDepth,
    measurePopLayoutSnapshot,
    observeStyleChanges,
    popLayoutPointFollowsScroll,
    readAnimatedValues,
    resolvePopLayoutStyles,
    setPresenceDepth,
    snapshotComputedStyle,
    suppressScrollAnchoring,
    type PresenceExitResolver,
    type PresenceLayoutHandOff
} from './presence'

// Shared context store for mock - exposed for clearing between tests
const mockContextStore = new Map<symbol | string, unknown>()

// Mock svelte context functions for depth tests
vi.mock('svelte', async (importOriginal) => {
    const original = await importOriginal<typeof import('svelte')>()
    return {
        ...original,
        setContext: vi.fn((key: symbol | string, value: unknown) => {
            mockContextStore.set(key, value)
        }),
        getContext: vi.fn((key: symbol | string) => {
            return mockContextStore.get(key)
        })
    }
})

// Plan 012: `markExiting` spied, calling through, so 10a can check the clone
// is marked before it is inserted.
vi.mock('./layout', async (importOriginal) => {
    const original = await importOriginal<typeof import('./layout')>()
    return { ...original, markExiting: vi.fn(original.markExiting) }
})

// Mock motion.animate to return an object with a finished promise
vi.mock('motion', () => {
    return {
        animate: vi.fn(() => ({ finished: Promise.resolve() }))
    }
})

// Shared DOMRect mock factory
function makeRect(left: number, top = 0, width = 100, height = 100): DOMRect {
    return {
        x: left,
        y: top,
        top,
        left,
        bottom: top + height,
        right: left + width,
        width,
        height,
        toJSON: () => {}
    }
}

// Minimal CSSStyleDeclaration mock factory
function mockComputedStyle(overrides: Partial<CSSStyleDeclaration> = {}): CSSStyleDeclaration {
    const entries: string[] = ['borderRadius']
    const style = {
        length: entries.length,
        [0]: entries[0],
        getPropertyValue: (prop: string) => (overrides as Record<string, string>)[prop] ?? '',
        getPropertyPriority: () => '',
        ...overrides
    } as unknown as CSSStyleDeclaration
    return style
}

describe('suppressScrollAnchoring (plan 012 A6)', () => {
    afterEach(() => vi.useRealTimers())

    const frames = () => {
        const queue: FrameRequestCallback[] = []
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            queue.push(callback)
            return queue.length
        })
        return () => {
            for (const callback of queue.splice(0)) callback(performance.now())
        }
    }

    it('turns anchoring off until the second frame, then restores the inline value', () => {
        const nextFrame = frames()
        const list = document.createElement('ul')
        list.style.overflowAnchor = 'auto'

        suppressScrollAnchoring(list)
        expect(list.style.overflowAnchor).toBe('none')
        nextFrame()
        expect(list.style.overflowAnchor).toBe('none')
        nextFrame()
        expect(list.style.overflowAnchor).toBe('auto')
        vi.restoreAllMocks()
    })

    it('holds overlapping hand-offs until the last one ends', () => {
        const nextFrame = frames()
        const list = document.createElement('ul')

        suppressScrollAnchoring(list)
        nextFrame()
        suppressScrollAnchoring(list)
        nextFrame()
        // The first hold ended; the second still covers its first frame.
        expect(list.style.overflowAnchor).toBe('none')
        nextFrame()
        expect(list.style.overflowAnchor).toBe('')
        vi.restoreAllMocks()
    })
})

describe('presence context', () => {
    let parent: HTMLElement
    let el: HTMLElement

    beforeEach(() => {
        vi.clearAllMocks()
        document.body.innerHTML = ''
        parent = document.createElement('div')
        Object.assign(parent.style, { position: 'relative', width: '200px', height: '200px' })
        document.body.appendChild(parent)

        el = document.createElement('div')
        parent.appendChild(el)

        // Provide stable rects
        vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(makeRect(10, 20))
        vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue(makeRect(0, 0, 200, 200))

        vi.spyOn(window, 'getComputedStyle').mockImplementation(() =>
            mockComputedStyle({ borderRadius: '8px', boxSizing: 'border-box' })
        )

        // Ensure rAF callbacks run synchronously in tests so exit cleanup executes
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
            cb(0)
            return 1
        })
    })

    it('registers and updates child state', () => {
        const ctx = createAnimatePresenceContext({})
        ctx.registerChild('k', el, { opacity: 0 })

        ctx.updateChildState('k', makeRect(12, 22), mockComputedStyle({ borderRadius: '12px' }))

        // Trigger exit (also exercises clone creation)
        ctx.unregisterChild('k')

        // Clone should be added then removed after animation finishes
        const clone = document.querySelector<HTMLElement>('[data-clone="true"]')
        expect(clone).toBeTruthy()
    })

    it('marks exit clones inert and hidden from the accessibility tree', () => {
        const ctx = createAnimatePresenceContext({})
        ctx.registerChild('a11y', el, { opacity: 0 })
        ctx.unregisterChild('a11y')

        const clone = document.querySelector<HTMLElement>('[data-clone="true"]')
        expect(clone).toBeTruthy()
        expect(clone?.inert).toBe(true)
        expect(clone?.getAttribute('aria-hidden')).toBe('true')
    })

    it.each([false, true])(
        'preserves unitless inheritance without freezing descendants when detached=%s',
        (detached) => {
            const caption = document.createElement('span')
            const title = document.createElement('strong')
            title.style.lineHeight = 'inherit'
            el.append(caption, title)
            Object.defineProperty(el, 'computedStyleMap', {
                value: () => ({ get: () => ({ toString: () => '1.5' }) })
            })
            vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
                const lineHeight =
                    element === caption ? '15.36px' : element === title ? '33.6px' : '24px'
                const values: Record<string, string> = { 'line-height': lineHeight }
                return {
                    ...mockComputedStyle({ lineHeight, boxSizing: 'border-box' }),
                    length: 1,
                    0: 'line-height',
                    getPropertyValue: (prop: string) => values[prop] ?? ''
                }
            })
            const ctx = createAnimatePresenceContext({})
            ctx.registerChild('typography', el, { opacity: 0 })
            if (detached) el.remove()
            ctx.unregisterChild('typography')
            const clone = document.querySelector<HTMLElement>('[data-clone="true"]')!
            expect(clone.style.lineHeight).toBe('1.5')
            expect((clone.children[0] as HTMLElement).style.lineHeight).toBe('')
            expect((clone.children[1] as HTMLElement).style.lineHeight).toBe('inherit')
            ctx.dispose()
        }
    )

    it.each(['canvas', 'iframe', 'video', 'audio'])(
        'detects a nested %s as stateful clone content',
        (tag) => {
            const media = document.createElement(tag)
            el.appendChild(media)
            expect(containsStatefulCloneContent(el)).toBe(true)
        }
    )

    it('detects stateful content when the exit root is itself a canvas', () => {
        expect(containsStatefulCloneContent(document.createElement('canvas'))).toBe(true)
        expect(containsStatefulCloneContent(document.createElement('div'))).toBe(false)
    })

    it('removes stateful media exits immediately instead of animating a blank clone', () => {
        el.appendChild(document.createElement('canvas'))
        const ctx = createAnimatePresenceContext({})
        ctx.registerChild('canvas-card', el, { opacity: 0 })
        ctx.unregisterChild('canvas-card')

        expect(document.querySelector('[data-clone="true"]')).toBeFalsy()
        expect(document.querySelector('[data-presence-placeholder="true"]')).toBeFalsy()
        expect(animate).not.toHaveBeenCalled()
    })

    it('unregisterChild without exit just deletes child (no clone)', () => {
        const ctx = createAnimatePresenceContext({})
        ctx.registerChild('noexit', el, undefined)
        ctx.unregisterChild('noexit')
        const clone = document.querySelector('[data-clone="true"]')
        expect(clone).toBeFalsy()
    })

    it('disposal prevents descendant teardown from starting exits', () => {
        const ctx = createAnimatePresenceContext({})
        ctx.registerChild('card', el, { opacity: 0 })
        const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')

        ctx.dispose()
        ctx.unregisterChild('card')
        ctx.registerChild('late-child', el, { opacity: 0 })
        ctx.unregisterChild('late-child')

        expect(document.querySelector('[data-clone="true"]')).toBeNull()
        expect(document.querySelector('[data-presence-placeholder="true"]')).toBeNull()
        expect(animate).not.toHaveBeenCalled()
        expect(disconnect).toHaveBeenCalledTimes(2)
        disconnect.mockRestore()
    })

    it('disposal cancels queued exits before animation starts', () => {
        const frames: FrameRequestCallback[] = []
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            frames.push(callback)
            return frames.length
        })
        const ctx = createAnimatePresenceContext({ initial: false })
        ctx.registerChild('card', el, { opacity: 0 })
        ctx.unregisterChild('card')
        expect(document.querySelector('[data-clone="true"]')).not.toBeNull()

        ctx.dispose()
        // Even a callback already dequeued by the browser must be harmless.
        for (const frame of frames) frame(0)

        expect(document.querySelector('[data-clone="true"]')).toBeNull()
        expect(document.querySelector('[data-presence-placeholder="true"]')).toBeNull()
        expect(animate).not.toHaveBeenCalled()
    })

    it('disposal stops active exits without completion or deferred-enter callbacks', async () => {
        let finish!: () => void
        const stop = vi.fn()
        vi.mocked(animate).mockReturnValueOnce({
            finished: new Promise<void>((resolve) => (finish = resolve)),
            stop
        } as unknown as ReturnType<typeof animate>)
        const onExitComplete = vi.fn()
        const forceRender = vi.fn()
        const onEnter = vi.fn()
        const ctx = createAnimatePresenceContext({ mode: 'wait', onExitComplete, forceRender })
        ctx.registerChild('card', el, { opacity: 0 })
        ctx.unregisterChild('card')
        ctx.onEnterUnblocked(onEnter)
        expect(ctx.isEnterBlocked()).toBe(true)

        ctx.dispose()
        ctx.dispose()
        expect(stop).toHaveBeenCalledTimes(1)
        expect(ctx.isEnterBlocked()).toBe(false)
        expect(document.querySelector('[data-clone="true"]')).toBeNull()
        expect(document.querySelector('[data-presence-placeholder="true"]')).toBeNull()

        finish()
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
        // A late descendant signal must not settle a cancelled boundary.
        ctx.notifyExitComplete()
        ctx.notifyExitStart()
        expect(onExitComplete).not.toHaveBeenCalled()
        expect(forceRender).not.toHaveBeenCalled()
        expect(onEnter).not.toHaveBeenCalled()
        expect(ctx.isEnterBlocked()).toBe(false)
    })

    it('resolves exit variants with the latest AnimatePresence custom value', () => {
        let direction = 1
        const ctx = createAnimatePresenceContext({ getCustom: () => direction })
        const resolveExit = vi.fn((custom: unknown) => ({
            x: (custom as number) > 0 ? -160 : 160,
            opacity: 0
        }))

        ctx.registerChild('custom', el, { opacity: 0 }, undefined, resolveExit)
        direction = -1
        ctx.unregisterChild('custom')

        expect(resolveExit).toHaveBeenCalledWith(-1)
        expect(animate).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            expect.objectContaining({ x: 160, opacity: 0 }),
            expect.any(Object)
        )
    })

    it('calls onExitComplete after animation finished', async () => {
        const onExitComplete = vi.fn()
        const ctx = createAnimatePresenceContext({ onExitComplete })
        ctx.registerChild('k', el, { opacity: 0 })
        ctx.unregisterChild('k')
        // Allow animate().finished microtask to resolve
        await Promise.resolve()
        await Promise.resolve()
        await tick()
        expect(onExitComplete).toHaveBeenCalled()
    })

    it('forces parent position to relative when static', async () => {
        // Simulate computed style returning 'static' even if inline style is ''
        vi.spyOn(window, 'getComputedStyle').mockImplementation(() =>
            mockComputedStyle({ position: 'static', borderRadius: '8px', boxSizing: 'border-box' })
        )
        const onExitComplete = vi.fn()
        const ctx = createAnimatePresenceContext({ onExitComplete })
        ctx.registerChild('k', el, { opacity: 0 })
        ctx.unregisterChild('k')
        await Promise.resolve()
        await Promise.resolve()
        expect(parent.style.position).toBe('relative')
    })

    it('removes the clone after finished resolves', async () => {
        const ctx = createAnimatePresenceContext({})
        ctx.registerChild('k', el, { opacity: 0 })
        ctx.unregisterChild('k')

        // Clone should appear synchronously after unregister
        let clone = document.querySelector<HTMLElement>('[data-clone="true"]')
        expect(clone).toBeTruthy()

        // After finished promise resolves, clone should be removed
        await Promise.resolve()
        await Promise.resolve()
        clone = document.querySelector<HTMLElement>('[data-clone="true"]')
        expect(clone).toBeFalsy()
    })
})

describe('AnimatePresence modes', () => {
    let parent: HTMLElement
    let el: HTMLElement
    let el2: HTMLElement

    beforeEach(() => {
        document.body.innerHTML = ''
        parent = document.createElement('div')
        Object.assign(parent.style, { position: 'relative', width: '200px', height: '200px' })
        document.body.appendChild(parent)

        el = document.createElement('div')
        parent.appendChild(el)

        el2 = document.createElement('div')
        parent.appendChild(el2)

        // Provide stable rects
        const mockRect = {
            x: 10,
            y: 20,
            top: 20,
            left: 10,
            bottom: 120,
            right: 110,
            width: 100,
            height: 100,
            toJSON: () => {}
        } as unknown as DOMRect

        vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(mockRect)
        vi.spyOn(el2, 'getBoundingClientRect').mockReturnValue(mockRect)

        vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            bottom: 200,
            right: 200,
            width: 200,
            height: 200,
            toJSON: () => {}
        })

        vi.spyOn(window, 'getComputedStyle').mockImplementation(() =>
            mockComputedStyle({ borderRadius: '8px', boxSizing: 'border-box', display: 'block' })
        )

        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
            cb(0)
            return 1
        })
    })

    describe('mode property', () => {
        it('defaults mode to sync when not specified', () => {
            const ctx = createAnimatePresenceContext({})
            expect(ctx.mode).toBe('sync')
        })

        it('accepts mode=sync explicitly', () => {
            const ctx = createAnimatePresenceContext({ mode: 'sync' })
            expect(ctx.mode).toBe('sync')
        })

        it('accepts mode=wait', () => {
            const ctx = createAnimatePresenceContext({ mode: 'wait' })
            expect(ctx.mode).toBe('wait')
        })

        it('accepts mode=popLayout', () => {
            const ctx = createAnimatePresenceContext({ mode: 'popLayout' })
            expect(ctx.mode).toBe('popLayout')
        })
    })

    describe('isEnterBlocked', () => {
        it('returns false for sync mode regardless of exits', () => {
            const ctx = createAnimatePresenceContext({ mode: 'sync' })
            ctx.registerChild('k1', el, { opacity: 0 })
            expect(ctx.isEnterBlocked()).toBe(false)

            // Even during unregister (exit in progress)
            ctx.unregisterChild('k1')
            expect(ctx.isEnterBlocked()).toBe(false)
        })

        it('returns false for popLayout mode regardless of exits', () => {
            const ctx = createAnimatePresenceContext({ mode: 'popLayout' })
            ctx.registerChild('k1', el, { opacity: 0 })
            expect(ctx.isEnterBlocked()).toBe(false)

            ctx.unregisterChild('k1')
            expect(ctx.isEnterBlocked()).toBe(false)
        })

        it('returns false for wait mode when no exits in progress', () => {
            const ctx = createAnimatePresenceContext({ mode: 'wait' })
            ctx.registerChild('k1', el, { opacity: 0 })
            expect(ctx.isEnterBlocked()).toBe(false)
        })

        it('returns true for wait mode when exits in progress', async () => {
            const ctx = createAnimatePresenceContext({ mode: 'wait' })
            ctx.registerChild('k1', el, { opacity: 0 })

            // Start exit
            ctx.unregisterChild('k1')

            // Now enters should be blocked
            expect(ctx.isEnterBlocked()).toBe(true)

            // After exit completes, should unblock
            await Promise.resolve()
            await Promise.resolve()
            expect(ctx.isEnterBlocked()).toBe(false)
        })

        it('returns false for popLayout mode (same as sync)', () => {
            const ctx = createAnimatePresenceContext({ mode: 'popLayout' })
            ctx.registerChild('k1', el, { opacity: 0 })
            ctx.unregisterChild('k1')
            expect(ctx.isEnterBlocked()).toBe(false)
        })
    })

    describe('onEnterUnblocked', () => {
        it('registers and calls callback when enters unblock', async () => {
            const ctx = createAnimatePresenceContext({ mode: 'wait' })
            const callback = vi.fn()

            ctx.registerChild('k1', el, { opacity: 0 })
            ctx.unregisterChild('k1') // Start exit, blocks enters

            // Register callback
            ctx.onEnterUnblocked(callback)

            // Callback not called yet (exit in progress)
            expect(callback).not.toHaveBeenCalled()

            // After exit completes
            await Promise.resolve()
            await Promise.resolve()

            expect(callback).toHaveBeenCalledTimes(1)
        })

        it('returns unsubscribe function that removes callback', async () => {
            const ctx = createAnimatePresenceContext({ mode: 'wait' })
            const callback = vi.fn()

            ctx.registerChild('k1', el, { opacity: 0 })
            ctx.unregisterChild('k1')

            const unsubscribe = ctx.onEnterUnblocked(callback)
            unsubscribe() // Remove before exit completes

            await Promise.resolve()
            await Promise.resolve()

            expect(callback).not.toHaveBeenCalled()
        })

        it('calls multiple callbacks when enters unblock', async () => {
            const ctx = createAnimatePresenceContext({ mode: 'wait' })
            const callback1 = vi.fn()
            const callback2 = vi.fn()

            ctx.registerChild('k1', el, { opacity: 0 })
            ctx.unregisterChild('k1')

            ctx.onEnterUnblocked(callback1)
            ctx.onEnterUnblocked(callback2)

            await Promise.resolve()
            await Promise.resolve()

            expect(callback1).toHaveBeenCalledTimes(1)
            expect(callback2).toHaveBeenCalledTimes(1)
        })
    })

    describe('wait mode enter blocking', () => {
        it('blocks new registrations when exit is in progress', () => {
            const ctx = createAnimatePresenceContext({ mode: 'wait' })

            // Register first child
            ctx.registerChild('k1', el, { opacity: 0 })

            // Start exit for first child
            ctx.unregisterChild('k1')

            // Now register second child - enters should be blocked
            ctx.registerChild('k2', el2, { opacity: 0 })
            expect(ctx.isEnterBlocked()).toBe(true)
        })

        it('does not block when children have exit definitions but no exits in progress', () => {
            const ctx = createAnimatePresenceContext({ mode: 'wait' })

            // Register first child with exit definition
            ctx.registerChild('k1', el, { opacity: 0 })

            // Register second child with exit definition
            // Should NOT be blocked - having an exit definition doesn't mean it's exiting
            ctx.registerChild('k2', el2, { opacity: 0 })

            // At this point, both children are registered but neither is exiting
            // Enters should NOT be blocked since no exits are in progress
            expect(ctx.isEnterBlocked()).toBe(false)

            // Only after an actual exit starts should it be blocked
            ctx.unregisterChild('k1')
            expect(ctx.isEnterBlocked()).toBe(true)
        })
    })

    describe('popLayout layout behavior', () => {
        it('measures popLayout snapshots using offset parent coordinates', () => {
            Object.defineProperties(parent, {
                offsetWidth: { configurable: true, value: 240 },
                offsetHeight: { configurable: true, value: 180 }
            })
            Object.defineProperties(el, {
                offsetParent: { configurable: true, value: parent },
                offsetTop: { configurable: true, value: 64 },
                offsetLeft: { configurable: true, value: 32 },
                offsetWidth: { configurable: true, value: 120 },
                offsetHeight: { configurable: true, value: 80 }
            })

            const snapshot = measurePopLayoutSnapshot(
                el,
                mockComputedStyle({
                    direction: 'ltr',
                    height: '80px',
                    width: '120px'
                })
            )

            expect(snapshot).toEqual({
                width: 120,
                height: 80,
                top: 64,
                left: 32,
                right: 88,
                bottom: 36,
                direction: 'ltr',
                // The rect (10, 20) in the parent's space: its 200px rect over
                // its 240×180 offset size reads as a scaled parent.
                point: [12, 18]
            })
        })

        it('resolves popLayout styles with upstream left/top anchoring defaults', () => {
            expect(
                resolvePopLayoutStyles({
                    width: 120,
                    height: 80,
                    top: 64,
                    left: 32,
                    right: 88,
                    bottom: 36,
                    direction: 'ltr',
                    point: [0, 0]
                })
            ).toMatchObject({
                position: 'absolute',
                width: '120px',
                height: '80px',
                left: '32px',
                top: '64px'
            })
        })

        it('resolves popLayout right and bottom anchors like upstream', () => {
            expect(
                resolvePopLayoutStyles(
                    {
                        width: 120,
                        height: 80,
                        top: 64,
                        left: 32,
                        right: 88,
                        bottom: 36,
                        direction: 'ltr',
                        point: [0, 0]
                    },
                    'right',
                    'bottom'
                )
            ).toMatchObject({
                position: 'absolute',
                width: '120px',
                height: '80px',
                right: '88px',
                bottom: '36px'
            })
        })

        it('uses the stored offset snapshot for popLayout clones after scroll', async () => {
            Object.defineProperties(parent, {
                offsetWidth: { configurable: true, value: 240 },
                offsetHeight: { configurable: true, value: 180 }
            })
            Object.defineProperties(el, {
                offsetParent: { configurable: true, value: parent },
                offsetTop: { configurable: true, value: 64 },
                offsetLeft: { configurable: true, value: 32 },
                offsetWidth: { configurable: true, value: 120 },
                offsetHeight: { configurable: true, value: 80 }
            })

            vi.spyOn(window, 'getComputedStyle').mockImplementation((target: Element) => {
                if (target === el) {
                    return mockComputedStyle({
                        borderRadius: '8px',
                        boxSizing: 'border-box',
                        direction: 'ltr',
                        height: '80px',
                        position: 'static',
                        width: '120px'
                    })
                }

                return mockComputedStyle({
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                    position: 'static'
                })
            })

            const ctx = createAnimatePresenceContext({ mode: 'popLayout' })
            ctx.registerChild('k1', el, { opacity: 0 })

            vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
                x: 10,
                y: -180,
                top: -180,
                left: 10,
                bottom: -100,
                right: 130,
                width: 120,
                height: 80,
                toJSON: () => {}
            })

            ctx.unregisterChild('k1')

            const clone = parent.querySelector<HTMLElement>('[data-clone="true"]')
            expect(clone).toBeTruthy()
            expect(clone?.style.top).toBe('64px')
            expect(clone?.style.left).toBe('32px')
            expect(clone?.style.width).toBe('120px')
            expect(clone?.style.height).toBe('80px')

            await Promise.resolve()
            await Promise.resolve()

            expect(document.querySelector('[data-presence-placeholder="true"]')).toBeFalsy()
        })

        /**
         * #2348 on the clone path: popping the clone out of the flow moves its
         * container, so the clone is laid out 70px lower than the element was.
         * jsdom has no layout, so the move is mocked through the rects.
         */
        const popCloneWithDrop = async (anchorY?: 'top' | 'bottom') => {
            Object.defineProperties(parent, {
                offsetWidth: { configurable: true, value: 240 },
                offsetHeight: { configurable: true, value: 180 }
            })
            Object.defineProperties(el, {
                offsetParent: { configurable: true, value: parent },
                offsetTop: { configurable: true, value: 64 },
                offsetLeft: { configurable: true, value: 32 },
                offsetWidth: { configurable: true, value: 120 },
                offsetHeight: { configurable: true, value: 80 }
            })
            vi.spyOn(window, 'getComputedStyle').mockImplementation((target: Element) =>
                target === el
                    ? mockComputedStyle({
                          direction: 'ltr',
                          height: '80px',
                          position: 'static',
                          width: '120px'
                      })
                    : mockComputedStyle({ position: 'static' })
            )
            vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(makeRect(32, 100, 120, 80))
            // Unscaled: the parent's rect matches its offset size.
            vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue(makeRect(0, 0, 240, 180))
            const getBoundingClientRect = Object.getOwnPropertyDescriptor(
                Element.prototype,
                'getBoundingClientRect'
            )!.value as (this: Element) => DOMRect
            const rectSpy = vi
                .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
                .mockImplementation(function (this: HTMLElement) {
                    return this.dataset?.clone === 'true'
                        ? makeRect(32, 170, 120, 80)
                        : getBoundingClientRect.call(this)
                })
            onTestFinished(() => rectSpy.mockRestore())

            const ctx = createAnimatePresenceContext({ mode: 'popLayout', anchorY })
            ctx.registerChild('k1', el, { opacity: 0 })
            ctx.unregisterChild('k1')

            const clone = parent.querySelector<HTMLElement>('[data-clone="true"]')
            expect(clone).toBeTruthy()
            await Promise.resolve()
            await Promise.resolve()
            return clone!
        }

        it('offsets a popLayout clone back when popping moves the container', async () => {
            const clone = await popCloneWithDrop()
            expect(clone.style.top).toBe(`${64 - 70}px`)
        })

        it('offsets a bottom-anchored popLayout clone back when popping moves the container', async () => {
            const clone = await popCloneWithDrop('bottom')
            expect(clone.style.bottom).toBe(`${36 + 70}px`)
            expect(clone.style.top).toBe('')
        })

        describe('popLayoutPointFollowsScroll', () => {
            const classify = (styles: Map<Element, Partial<CSSStyleDeclaration>>) => {
                vi.spyOn(window, 'getComputedStyle').mockImplementation((target: Element) =>
                    mockComputedStyle({ position: 'static', ...styles.get(target) })
                )
                return popLayoutPointFollowsScroll(el)
            }

            it('is scroll-invariant with no fixed ancestor', () => {
                expect(classify(new Map())).toBe(true)
            })

            it('is scroll-invariant inside a fixed ancestor the viewport contains', () => {
                expect(classify(new Map([[parent, { position: 'fixed' }]]))).toBe(true)
            })

            it('re-samples inside a fixed ancestor that a transformed ancestor contains', () => {
                expect(
                    classify(
                        new Map<Element, Partial<CSSStyleDeclaration>>([
                            [parent, { position: 'fixed' }],
                            [document.body, { transform: 'scale(0.5)' }]
                        ])
                    )
                ).toBe(false)
            })

            it('re-samples what it cannot classify: a sticky ancestor or a fixed element', () => {
                expect(classify(new Map([[parent, { position: 'sticky' }]]))).toBe(false)
                expect(classify(new Map([[el, { position: 'fixed' }]]))).toBe(false)
            })
        })

        it("refreshes a resting child's popLayout point when siblings are added", async () => {
            Object.defineProperties(parent, {
                offsetWidth: { configurable: true, value: 240 },
                offsetHeight: { configurable: true, value: 180 }
            })
            Object.defineProperties(el, {
                offsetParent: { configurable: true, value: parent },
                offsetTop: { configurable: true, value: 64 },
                offsetLeft: { configurable: true, value: 32 },
                offsetWidth: { configurable: true, value: 120 },
                offsetHeight: { configurable: true, value: 80 }
            })
            vi.spyOn(window, 'getComputedStyle').mockImplementation((target: Element) =>
                target === el
                    ? mockComputedStyle({
                          direction: 'ltr',
                          height: '80px',
                          position: 'static',
                          width: '120px'
                      })
                    : mockComputedStyle({ position: 'static' })
            )
            vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue(makeRect(0, 0, 240, 180))
            const elRect = vi
                .spyOn(el, 'getBoundingClientRect')
                .mockReturnValue(makeRect(32, 100, 120, 80))
            const getBoundingClientRect = Object.getOwnPropertyDescriptor(
                Element.prototype,
                'getBoundingClientRect'
            )!.value as (this: Element) => DOMRect
            const rectSpy = vi
                .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
                .mockImplementation(function (this: HTMLElement) {
                    return this.dataset?.clone === 'true'
                        ? makeRect(32, 170, 120, 80)
                        : getBoundingClientRect.call(this)
                })
            onTestFinished(() => rectSpy.mockRestore())

            const ctx = createAnimatePresenceContext({ mode: 'popLayout' })
            ctx.registerChild('k1', el, { opacity: 0 })

            // The list grows while k1 rests: k1 is now laid out 70px lower.
            elRect.mockReturnValue(makeRect(32, 170, 120, 80))
            const sibling = document.createElement('div')
            parent.appendChild(sibling)
            ctx.registerChild('k2', sibling, { opacity: 0 })
            // The container's MutationObserver sees the new sibling and
            // re-samples k1 where it now rests, in the next frame's read step.
            await Promise.resolve()
            await vi.advanceTimersByTimeAsync(20)

            // Svelte detaches keyed nodes before the exit is registered.
            el.remove()
            ctx.unregisterChild('k1')

            const clone = parent.querySelector<HTMLElement>('[data-clone="true"]')
            expect(clone).toBeTruthy()
            await Promise.resolve()
            await Promise.resolve()
            // The clone sits where k1 last was: nothing to correct.
            expect(clone!.style.top).toBe('64px')
        })

        it('does not insert a placeholder during exit', async () => {
            const ctx = createAnimatePresenceContext({ mode: 'popLayout' })
            ctx.registerChild('k1', el, { opacity: 0 })
            ctx.unregisterChild('k1')

            const placeholder = document.querySelector('[data-presence-placeholder="true"]')
            expect(placeholder).toBeFalsy()

            const clone = document.querySelector('[data-clone="true"]')
            expect(clone).toBeTruthy()

            await Promise.resolve()
            await Promise.resolve()
        })

        it('preserves the layout slot for sync mode', async () => {
            const ctx = createAnimatePresenceContext({ mode: 'sync' })
            ctx.registerChild('k1', el, { opacity: 0 })
            ctx.unregisterChild('k1')

            const placeholder = document.querySelector('[data-presence-placeholder="true"]')
            expect(placeholder).toBeTruthy()
            expect((placeholder as HTMLElement).style.visibility).toBe('hidden')
            expect((placeholder as HTMLElement).style.width).toBe('100px')
            expect((placeholder as HTMLElement).style.height).toBe('100px')

            await Promise.resolve()
            await Promise.resolve()
        })

        it('skips the placeholder for out-of-flow children (sync mode)', async () => {
            vi.spyOn(window, 'getComputedStyle').mockImplementation((target: Element) => {
                if (target === el) {
                    return mockComputedStyle({
                        position: 'absolute',
                        boxSizing: 'border-box',
                        display: 'flex'
                    })
                }
                return mockComputedStyle({ position: 'relative', boxSizing: 'border-box' })
            })

            const ctx = createAnimatePresenceContext({ mode: 'sync' })
            ctx.registerChild('k1', el, { opacity: 0 })
            ctx.unregisterChild('k1')

            // An absolutely-positioned child holds no layout slot; inserting a
            // placeholder for it would ADD in-flow space that never existed
            // (it briefly ballooned a fixed pill hosting crossfading labels).
            expect(document.querySelector('[data-presence-placeholder="true"]')).toBeFalsy()

            await Promise.resolve()
            await Promise.resolve()
        })

        it('skips the placeholder for out-of-flow children detached before unregister', async () => {
            vi.spyOn(window, 'getComputedStyle').mockImplementation((target: Element) => {
                if (target === el) {
                    return mockComputedStyle({
                        position: 'absolute',
                        boxSizing: 'border-box',
                        display: 'flex'
                    })
                }
                return mockComputedStyle({ position: 'relative', boxSizing: 'border-box' })
            })

            const ctx = createAnimatePresenceContext({ mode: 'sync' })
            ctx.registerChild('k1', el, { opacity: 0 })

            // Keyed swaps detach the node before unregister runs. A detached
            // element's live computed style reads '' for everything, so the
            // out-of-flow check must use the position snapshot instead.
            el.remove()
            vi.spyOn(window, 'getComputedStyle').mockImplementation(() => mockComputedStyle({}))
            ctx.unregisterChild('k1')

            expect(document.querySelector('[data-presence-placeholder="true"]')).toBeFalsy()

            await Promise.resolve()
            await Promise.resolve()
        })

        it('preserves grid placement on wait placeholders', () => {
            vi.spyOn(window, 'getComputedStyle').mockImplementation((target: Element) => {
                if (target === el) {
                    return mockComputedStyle({
                        borderRadius: '8px',
                        boxSizing: 'border-box',
                        display: 'flex',
                        gridColumnStart: '1',
                        gridColumnEnd: '2',
                        gridRowStart: '1',
                        gridRowEnd: '2'
                    })
                }

                return mockComputedStyle({
                    borderRadius: '8px',
                    boxSizing: 'border-box',
                    position: 'relative'
                })
            })

            const ctx = createAnimatePresenceContext({ mode: 'wait' })
            ctx.registerChild('k1', el, { opacity: 0 })
            ctx.unregisterChild('k1')

            const placeholder = document.querySelector<HTMLElement>(
                '[data-presence-placeholder="true"]'
            )

            expect(placeholder).toBeTruthy()
            expect(placeholder?.style.gridColumnStart).toBe('1')
            expect(placeholder?.style.gridColumnEnd).toBe('2')
            expect(placeholder?.style.gridRowStart).toBe('1')
            expect(placeholder?.style.gridRowEnd).toBe('2')
        })

        it('uses the registered insertion parent when a child is detached before unregister', () => {
            const ctx = createAnimatePresenceContext({ mode: 'wait' })
            ctx.registerChild('k1', el, { opacity: 0 })

            el.remove()
            ctx.unregisterChild('k1')

            const placeholder = parent.querySelector('[data-presence-placeholder="true"]')
            const clone = parent.querySelector('[data-clone="true"]')
            expect(placeholder).toBeTruthy()
            expect(clone).toBeTruthy()
            expect(clone?.parentElement).toBe(parent)
        })

        it('keeps margin, display and box-sizing on placeholders for detached children', () => {
            // Model the browser's LIVE CSSStyleDeclaration: every property
            // reads back as '' once the element leaves the document.
            const connectedValues: Record<string, string> = {
                position: 'static',
                display: 'flex',
                margin: '20px',
                boxSizing: 'border-box',
                flex: '0 0 auto',
                alignSelf: 'center'
            }
            const liveStyle = new Proxy(mockComputedStyle(), {
                get(target, prop, receiver) {
                    if (typeof prop === 'string' && prop in connectedValues) {
                        return el.isConnected ? connectedValues[prop] : ''
                    }
                    return Reflect.get(target, prop, receiver)
                }
            })
            vi.spyOn(window, 'getComputedStyle').mockImplementation((target: Element) =>
                target === el
                    ? liveStyle
                    : mockComputedStyle({ position: 'relative', display: 'block' })
            )

            const ctx = createAnimatePresenceContext({ mode: 'sync' })
            ctx.registerChild('k1', el, { opacity: 0 })

            // Svelte detaches keyed nodes before unregister runs.
            el.remove()
            ctx.unregisterChild('k1')

            const placeholder = parent.querySelector<HTMLElement>(
                '[data-presence-placeholder="true"]'
            )
            expect(placeholder).toBeTruthy()
            expect(placeholder?.style.margin).toBe('20px')
            expect(placeholder?.style.display).toBe('flex')
            expect(placeholder?.style.boxSizing).toBe('border-box')
            expect(placeholder?.style.flex).toBe('0 0 auto')
            expect(placeholder?.style.alignSelf).toBe('center')
        })
    })
})

describe('presence depth context', () => {
    beforeEach(() => {
        // Clear mock call history and shared context store between tests
        vi.mocked(setContext).mockClear()
        vi.mocked(getContext).mockClear()
        mockContextStore.clear()
    })

    it('getPresenceDepth returns undefined when not set', () => {
        // Simulate fresh context with no depth set
        vi.mocked(getContext).mockReturnValueOnce(undefined)
        const depth = getPresenceDepth()
        expect(depth).toBeUndefined()
    })

    it('setPresenceDepth calls setContext with correct depth value', () => {
        // Verify setContext is called with correct value
        setPresenceDepth(0)
        expect(setContext).toHaveBeenCalledWith(expect.any(Symbol), 0)

        setPresenceDepth(1)
        expect(setContext).toHaveBeenCalledWith(expect.any(Symbol), 1)

        setPresenceDepth(5)
        expect(setContext).toHaveBeenCalledWith(expect.any(Symbol), 5)
    })

    it('depth value 0 indicates direct child of AnimatePresence', () => {
        // Simulate AnimatePresence setting initial depth of 0
        vi.mocked(getContext).mockReturnValueOnce(0)
        const depth = getPresenceDepth()
        expect(depth).toBe(0)
    })

    it('depth value > 0 indicates nested motion element', () => {
        // Simulate nested motion element at depth 1
        vi.mocked(getContext).mockReturnValueOnce(1)
        const depth = getPresenceDepth()
        expect(depth).toBe(1)

        // Simulate deeply nested motion element at depth 3
        vi.mocked(getContext).mockReturnValueOnce(3)
        const deepDepth = getPresenceDepth()
        expect(deepDepth).toBe(3)
    })
})

describe('exit placeholder slot preservation', () => {
    // Mirrors the real AnimatePresence DOM: a grid whose direct child is the
    // `display: contents` presence container, with the motion children (and
    // Svelte-injected <script> nodes) inside it. Svelte detaches a keyed
    // child BEFORE unregisterChild runs, so the placeholder has to land in
    // the exiting child's slot from captured sibling anchors alone.
    let grid: HTMLElement
    let wrapper: HTMLElement
    let cardA: HTMLElement
    let cardB: HTMLElement
    let cardC: HTMLElement
    let scriptB: HTMLElement

    const detach = (...nodes: HTMLElement[]) => nodes.forEach((n) => n.remove())

    beforeEach(() => {
        vi.clearAllMocks()
        document.body.innerHTML = ''

        grid = document.createElement('div')
        wrapper = document.createElement('div')
        wrapper.className = 'animate-presence-container'
        grid.appendChild(wrapper)
        document.body.appendChild(grid)

        cardA = document.createElement('div')
        cardB = document.createElement('div')
        cardC = document.createElement('div')
        scriptB = document.createElement('script')
        wrapper.append(cardA, cardB, scriptB, cardC)

        vi.spyOn(window, 'getComputedStyle').mockImplementation((target) =>
            mockComputedStyle(
                target === wrapper
                    ? { display: 'contents', position: 'static' }
                    : { display: 'block', position: 'static' }
            )
        )
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
            cb(0)
            return 1
        })
    })

    const registerAll = () => {
        const ctx = createAnimatePresenceContext({ mode: 'sync' })
        ctx.registerChild('a', cardA, { opacity: 0 })
        ctx.registerChild('b', cardB, { opacity: 0 })
        ctx.registerChild('c', cardC, { opacity: 0 })
        return ctx
    }

    const placeholders = () =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-presence-placeholder="true"]'))

    // Exit clones sit in the element's original slot, immediately before the
    // placeholder that holds its space (upstream keeps the real element there).
    const clones = () => Array.from(document.querySelectorAll<HTMLElement>('[data-clone="true"]'))

    it('holds a detached middle child slot between its registered siblings', () => {
        const ctx = registerAll()

        detach(cardB, scriptB)
        ctx.unregisterChild('b')

        const [placeholder] = placeholders()
        expect(placeholder).toBeTruthy()
        expect(placeholder.parentElement).toBe(wrapper)
        expect(placeholder.nextElementSibling).toBe(cardC)
        const [clone] = clones()
        expect(placeholder.previousElementSibling).toBe(clone)
        expect(clone.previousElementSibling).toBe(cardA)
    })

    it('holds a detached last child slot after every surviving sibling', () => {
        const ctx = registerAll()

        detach(cardC)
        ctx.unregisterChild('c')

        const [placeholder] = placeholders()
        expect(placeholder).toBeTruthy()
        expect(placeholder.parentElement).toBe(wrapper)
        const [clone] = clones()
        expect(placeholder.previousElementSibling).toBe(clone)
        expect(clone.previousElementSibling).toBe(scriptB)
        expect(placeholder.nextElementSibling).toBeNull()
    })

    it('holds a detached first child slot before every surviving sibling', () => {
        const ctx = registerAll()

        detach(cardA)
        ctx.unregisterChild('a')

        const [placeholder] = placeholders()
        expect(placeholder).toBeTruthy()
        expect(placeholder.parentElement).toBe(wrapper)
        expect(placeholder.nextElementSibling).toBe(cardB)
        const [clone] = clones()
        expect(placeholder.previousElementSibling).toBe(clone)
        // The clone keeps the element's original sibling index (first child),
        // so structural selectors like `:first-child` still match it.
        expect(wrapper.firstElementChild).toBe(clone)
    })

    it("clones into the element's own document, never onto a <body>", () => {
        // Rendering into another window or iframe (e.g. via window.open()):
        // the clone must land in the element's own document, as upstream's
        // PopChild does (motion cc77f7878).
        const iframe = document.createElement('iframe')
        document.body.appendChild(iframe)
        const doc = iframe.contentDocument!
        const host = doc.createElement('div')
        const card = doc.createElement('div')
        host.appendChild(card)
        doc.body.appendChild(host)

        const ctx = createAnimatePresenceContext({ mode: 'popLayout' })
        ctx.registerChild('card', card, { opacity: 0 })
        card.remove()
        ctx.unregisterChild('card')

        expect(doc.body.querySelector('[data-clone="true"]')).toBeTruthy()
        expect(document.querySelector('[data-clone="true"]')).toBeNull()
        ctx.dispose()

        // With the slot parent gone too there is no clone at all (plan 012,
        // 10j): a clone on <body> would escape every clipping ancestor.
        const other = doc.createElement('div')
        host.appendChild(other)
        const ctx2 = createAnimatePresenceContext({ mode: 'popLayout' })
        ctx2.registerChild('other', other, { opacity: 0 })
        host.remove()
        ctx2.unregisterChild('other')
        expect(doc.querySelector('[data-clone="true"]')).toBeNull()
    })

    it('positions the exit clone at the current slot, not the stale registration rect', () => {
        // B registers while sitting in column 2…
        vi.spyOn(cardB, 'getBoundingClientRect').mockReturnValue(makeRect(200))
        // …and the slot-holding placeholder (inserted at unregister time)
        // reflects where B's slot ACTUALLY is by then: column 1. A layout
        // FLIP moved B there after a sibling exit — a position-only change
        // the ResizeObserver-driven updateChildState never sees.
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            return this.getAttribute?.('data-presence-placeholder') === 'true'
                ? makeRect(0)
                : makeRect(-1)
        })

        const ctx = registerAll()

        detach(cardB, scriptB)
        ctx.unregisterChild('b')

        const clone = document.querySelector<HTMLElement>('[data-clone="true"]')
        expect(clone).toBeTruthy()
        expect(clone!.style.left).toBe('1px')
    })

    it('keeps slot order when two children detach in the same update', () => {
        const ctx = registerAll()

        detach(cardB, scriptB, cardC)
        ctx.unregisterChild('b')
        ctx.unregisterChild('c')

        const [first, second] = placeholders()
        expect(first).toBeTruthy()
        expect(second).toBeTruthy()
        expect(first.parentElement).toBe(wrapper)
        expect(second.parentElement).toBe(wrapper)
        const [cloneB, cloneC] = clones()
        expect(cardA.nextElementSibling).toBe(cloneB)
        expect(cloneB.nextElementSibling).toBe(first)
        expect(first.nextElementSibling).toBe(cloneC)
        expect(cloneC.nextElementSibling).toBe(second)
    })
})

describe('exit clone style freeze', () => {
    // A real `getComputedStyle` result is LIVE: once Svelte detaches the node
    // (keyed {#each} and {#if} both detach before unregisterChild) every
    // property reads back as ''. This mock reproduces that, so the clone can
    // only carry the card's look if it was snapshotted as strings while the
    // element was still connected.
    const liveComputedStyle = (target: Element, values: Record<string, string>) => {
        const props = Object.keys(values)
        return new Proxy({} as CSSStyleDeclaration, {
            get(_, key) {
                const connected = target.isConnected
                if (key === 'length') return connected ? props.length : 0
                if (key === 'getPropertyValue') {
                    return (prop: string) => (connected ? (values[prop] ?? '') : '')
                }
                if (key === 'getPropertyPriority') return () => ''
                if (typeof key === 'string' && /^\d+$/.test(key)) {
                    return connected ? props[Number(key)] : undefined
                }
                if (typeof key === 'string') {
                    const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
                    return connected ? (values[kebab] ?? '') : ''
                }
                return undefined
            }
        })
    }

    let host: HTMLElement
    let container: HTMLElement
    let card: HTMLElement
    let cardValues: Record<string, string>

    beforeEach(() => {
        vi.clearAllMocks()
        document.body.innerHTML = ''
        host = document.createElement('div')
        container = document.createElement('div')
        container.className = 'animate-presence-container'
        card = document.createElement('div')
        card.className = 'card'
        cardValues = {
            display: 'flex',
            position: 'static',
            'background-color': 'rgb(43, 89, 195)',
            'border-top-left-radius': '24px',
            'font-weight': '600'
        }
        container.appendChild(card)
        host.appendChild(container)
        document.body.appendChild(host)

        vi.spyOn(window, 'getComputedStyle').mockImplementation((target) =>
            target === card
                ? liveComputedStyle(card, cardValues)
                : mockComputedStyle(
                      target === container
                          ? { display: 'contents', position: 'static' }
                          : { display: 'block', position: 'static' }
                  )
        )
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
            cb(0)
            return 1
        })
    })

    it('freezes a detached child clone from the connected-time snapshot, not a live declaration', () => {
        const ctx = createAnimatePresenceContext({ mode: 'sync' })
        ctx.registerChild('card', card, { opacity: 0 })

        card.remove()
        ctx.unregisterChild('card')

        const clone = document.querySelector<HTMLElement>('[data-clone="true"]')
        expect(clone).toBeTruthy()
        expect(clone!.style.getPropertyValue('background-color')).toBe('rgb(43, 89, 195)')
        expect(clone!.style.getPropertyValue('border-top-left-radius')).toBe('24px')
        expect(clone!.style.getPropertyValue('font-weight')).toBe('600')
        expect(clone!.style.display).toBe('flex')
    })

    const exitClone = () => document.querySelector<HTMLElement>('[data-clone="true"]')!

    it('re-snapshots when a class change restyles the connected element', async () => {
        const ctx = createAnimatePresenceContext({ mode: 'sync' })
        ctx.registerChild('card', card, { opacity: 0 })

        cardValues['background-color'] = 'rgb(255, 99, 71)'
        card.classList.add('selected')
        await Promise.resolve() // MutationObserver delivers in a microtask

        card.remove()
        ctx.unregisterChild('card')
        expect(exitClone().style.getPropertyValue('background-color')).toBe('rgb(255, 99, 71)')
    })

    it('refreshes the full snapshot only on the settled updateChildState call', () => {
        const ctx = createAnimatePresenceContext({ mode: 'sync' })
        ctx.registerChild('card', card, { opacity: 0 })

        cardValues['border-top-left-radius'] = '4px'
        ctx.updateChildState('card', makeRect(0), getComputedStyle(card))
        cardValues['font-weight'] = '800'
        ctx.updateChildState('card', makeRect(0), getComputedStyle(card), true)
        cardValues['font-weight'] = '100'
        ctx.updateChildState('card', makeRect(0), getComputedStyle(card))

        card.remove()
        ctx.unregisterChild('card')
        // Settled call captured both changes made up to it; the later
        // per-frame call did not re-serialize.
        expect(exitClone().style.getPropertyValue('border-top-left-radius')).toBe('4px')
        expect(exitClone().style.getPropertyValue('font-weight')).toBe('800')
    })

    it("lets the clone's own inline style win over the snapshot", () => {
        const ctx = createAnimatePresenceContext({ mode: 'sync' })
        ctx.registerChild('card', card, { opacity: 0 })
        card.style.backgroundColor = 'rgb(1, 2, 3)'

        card.remove()
        ctx.unregisterChild('card')
        expect(exitClone().style.getPropertyValue('background-color')).toBe('rgb(1, 2, 3)')
    })

    it('inserts the clone into the element slot, not the positioning ancestor', () => {
        const sibling = document.createElement('div')
        container.appendChild(sibling)
        const ctx = createAnimatePresenceContext({ mode: 'sync' })
        ctx.registerChild('card', card, { opacity: 0 })
        ctx.registerChild('sibling', sibling, { opacity: 0 })

        card.remove()
        ctx.unregisterChild('card')
        expect(exitClone().parentElement).toBe(container)
        expect(container.firstElementChild).toBe(exitClone())
        // Still positioned against the nearest box-generating ancestor.
        expect(host.style.position).toBe('relative')
    })

    it("re-snapshots a connected child when a sibling's exit restyles it structurally", () => {
        const first = document.createElement('div')
        container.insertBefore(first, card)
        const ctx = createAnimatePresenceContext({ mode: 'sync' })
        ctx.registerChild('first', first, { opacity: 0 })
        ctx.registerChild('card', card, { opacity: 0 })

        // `first` leaves; `card` becomes :first-child and restyles — no
        // attribute on `card` changes.
        first.remove()
        cardValues['background-color'] = 'rgb(43, 89, 195)'
        cardValues['border-top-left-radius'] = '4px'
        ctx.unregisterChild('first')

        card.remove()
        ctx.unregisterChild('card')
        const cardClone = document.querySelector<HTMLElement>('.card[data-clone="true"]')!
        expect(cardClone.style.getPropertyValue('border-top-left-radius')).toBe('4px')
    })

    it('hands a mid-exit clone over to the re-entering element', async () => {
        const onExitComplete = vi.fn()
        vi.spyOn(window, 'getComputedStyle').mockImplementation((target) =>
            target === card
                ? liveComputedStyle(card, cardValues)
                : target.hasAttribute?.('data-clone')
                  ? liveComputedStyle(target, { opacity: '0.53' })
                  : mockComputedStyle(
                        target === container
                            ? { display: 'contents', position: 'static' }
                            : { display: 'block', position: 'static' }
                    )
        )
        const ctx = createAnimatePresenceContext({ mode: 'sync', onExitComplete })
        ctx.registerChild('card', card, { opacity: 0 })
        card.remove()
        ctx.unregisterChild('card')
        expect(exitClone()).toBeTruthy()

        const handoff = ctx.takeExitHandoff('card')
        expect(handoff?.from).toEqual({ opacity: 0.53 })
        // The clone and its slot placeholder go at once: no overlap.
        expect(document.querySelector('[data-clone="true"]')).toBeNull()
        expect(document.querySelector('[data-presence-placeholder="true"]')).toBeNull()
        // A second claim finds nothing in flight.
        expect(ctx.takeExitHandoff('card')).toBeUndefined()

        // The reversed exit never completes (upstream deletes it from
        // exitComplete on re-entry), even once its animation settles.
        await Promise.resolve()
        await Promise.resolve()
        expect(onExitComplete).not.toHaveBeenCalled()
    })
})

describe('readAnimatedValues', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        document.body.innerHTML = ''
    })

    it('reads transforms from the matrix, opacity as a number and other keys as CSS', () => {
        const element = document.createElement('div')
        document.body.appendChild(element)
        const values: Record<string, string> = {
            transform: 'matrix(1, 0, 0, 1, 12, -4)',
            opacity: '0.25',
            'background-color': 'rgb(1, 2, 3)'
        }
        vi.spyOn(window, 'getComputedStyle').mockImplementation(
            () =>
                ({
                    transform: values.transform,
                    getPropertyValue: (prop: string) => values[prop] ?? ''
                }) as unknown as CSSStyleDeclaration
        )

        expect(
            readAnimatedValues(element, ['x', 'y', 'opacity', 'backgroundColor', 'transition'])
        ).toEqual({ x: 12, y: -4, opacity: 0.25, backgroundColor: 'rgb(1, 2, 3)' })
    })
})

describe('snapshotComputedStyle', () => {
    it.each([
        ['1.5', '24px', '48px'],
        ['24px', '24px', '24px'],
        ['0.0048px', '0.0048px', '0.0048px'],
        ['normal', 'normal', 'normal'],
        ['0', '0px', '0px']
    ])('captures %s line height without Typed OM', (expected, rootHeight, inheritedHeight) => {
        // jsdom has constructable sheets but no adoptedStyleSheets; browsers do.
        let adopted: CSSStyleSheet[] = []
        Object.defineProperty(document, 'adoptedStyleSheets', {
            configurable: true,
            get: () => adopted,
            set: (sheets: CSSStyleSheet[]) => (adopted = sheets)
        })
        onTestFinished(() => {
            delete (document as { adoptedStyleSheets?: unknown }).adoptedStyleSheets
        })
        const element = document.createElement('div')
        element.append(document.createElement('strong'))
        document.body.append(element)
        Object.defineProperty(element, 'computedStyleMap', { value: undefined })
        const style = {
            ...mockComputedStyle({ fontSize: '16px', lineHeight: rootHeight }),
            length: 2,
            0: 'line-height',
            1: 'font-size',
            getPropertyValue: (prop: string) =>
                prop === 'line-height' ? rootHeight : prop === 'font-size' ? '16px' : ''
        }
        // The probe is the root's own ::after at twice the font size.
        vi.spyOn(window, 'getComputedStyle').mockImplementation((target, pseudo) =>
            target === element && pseudo === '::after'
                ? mockComputedStyle({ fontSize: '32px', lineHeight: inheritedHeight })
                : style
        )
        const sheetsBefore = document.adoptedStyleSheets
        const snapshot = snapshotComputedStyle(style, element)
        expect(snapshot['line-height']).toBe(expected)
        // No child is inserted (it would restyle :last-child etc.), and the
        // probe attribute and sheet are gone afterwards.
        expect(element.children).toHaveLength(1)
        expect(element.hasAttribute('data-presence-style-probe')).toBe(false)
        expect(document.adoptedStyleSheets).toEqual(sheetsBefore)
        element.remove()
    })

    it('copies every non-empty computed property as a plain string', () => {
        const values: Record<string, string> = { color: 'red', 'font-weight': '', width: '10px' }
        const props = Object.keys(values)
        const style = {
            ...Object.fromEntries(props.map((prop, index) => [index, prop])),
            length: props.length,
            getPropertyValue: (prop: string) => values[prop] ?? ''
        } as unknown as CSSStyleDeclaration

        const snapshot = snapshotComputedStyle(style)
        values.color = 'blue' // the source changing later must not leak in
        expect(snapshot).toEqual({ color: 'red', width: '10px' })
    })
})

describe('observeStyleChanges', () => {
    let element: HTMLElement
    let frames: FrameRequestCallback[]

    const flushMicrotasks = async () => {
        await Promise.resolve()
        await Promise.resolve()
    }
    const runFrame = () => {
        const pending = frames
        frames = []
        pending.forEach((cb) => cb(0))
    }

    beforeEach(() => {
        vi.restoreAllMocks()
        document.body.innerHTML = ''
        element = document.createElement('div')
        document.body.appendChild(element)
        frames = []
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            frames.push(cb)
            return frames.length
        })
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
            frames = []
        })
    })

    it('snapshots immediately on a non-style attribute change', async () => {
        const onChange = vi.fn()
        observeStyleChanges(element, onChange)
        element.setAttribute('data-state', 'open')
        await flushMicrotasks()
        expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('ignores temporary inheritance probes without ignoring real subtree changes', async () => {
        const onChange = vi.fn()
        observeStyleChanges(element, onChange)
        element.setAttribute('data-presence-style-probe', 'line-height')
        element.removeAttribute('data-presence-style-probe')
        await flushMicrotasks()
        expect(onChange).not.toHaveBeenCalled()
        element.append(document.createElement('strong'))
        await flushMicrotasks()
        expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('refreshes typography when descendants change or are added', async () => {
        const title = document.createElement('strong')
        element.append(title)
        const onChange = vi.fn()
        observeStyleChanges(element, onChange)
        title.className = 'larger'
        await flushMicrotasks()
        expect(onChange).toHaveBeenCalledTimes(1)
        title.append(document.createElement('span'))
        await flushMicrotasks()
        expect(onChange).toHaveBeenCalledTimes(2)
    })

    it('coalesces per-frame style writes into one snapshot after they stop', async () => {
        const onChange = vi.fn()
        observeStyleChanges(element, onChange)

        for (let frame = 0; frame < 5; frame += 1) {
            element.style.opacity = String(frame / 10)
            await flushMicrotasks()
            runFrame()
        }
        expect(onChange).not.toHaveBeenCalled()

        runFrame() // first frame without a style write
        expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('settles root styles while a descendant keeps animating', async () => {
        const child = document.createElement('span')
        element.append(child)
        const onChange = vi.fn()
        observeStyleChanges(element, onChange)
        element.style.setProperty('--leading', '2')
        await flushMicrotasks()
        runFrame()

        for (let frame = 0; frame < 3; frame += 1) {
            child.style.opacity = String(frame / 10)
            await flushMicrotasks()
            runFrame()
        }
        expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('never snapshots a detached element and stops cleanly', async () => {
        const onChange = vi.fn()
        const stop = observeStyleChanges(element, onChange)

        element.style.opacity = '0.5'
        await flushMicrotasks()
        element.remove()
        runFrame()
        expect(onChange).not.toHaveBeenCalled()

        document.body.appendChild(element)
        stop()
        element.className = 'after-stop'
        await flushMicrotasks()
        runFrame()
        expect(onChange).not.toHaveBeenCalled()
    })
})

/**
 * Plan 015a, part C: a `layout` element's exit clone has no projection node,
 * so it would never animate the layout move its element would have. When
 * the update scrolls the content (a clamp), the clone follows the move with
 * the element's layout transition, in the same `animate()` call as its exit.
 */
/**
 * Plan 012 (U10): a `layout` / `layoutId` child keeps its projection node on
 * its exit clone, and the clone is held until that node is released, as
 * upstream holds the real element (`MeasureLayout.tsx:188-217`,
 * `PresenceChild.tsx:67-75` @ v14.7.1).
 */
describe('exit holds (plan 012)', () => {
    type Ctx = ReturnType<typeof createAnimatePresenceContext>

    const register = (
        ctx: Ctx,
        key: string,
        element: HTMLElement,
        options: {
            exit?: MotionExit
            transition?: MotionTransition
            resolveExit?: PresenceExitResolver
            group?: object
            handOff?: PresenceLayoutHandOff
        } = {}
    ) =>
        ctx.registerChild(
            key,
            element,
            options.exit,
            options.transition,
            options.resolveExit,
            options.group,
            options.handOff
        )

    /** A hand-off whose hold is a stub; `release()` fires the captured release. */
    const stubHandOff = (owned: string[] = []) => {
        const hold = { cancel: vi.fn(), finish: vi.fn() }
        const state: { release?: () => void } = {}
        const handOff = vi.fn((_clone: HTMLElement, release: () => void) => {
            state.release = release
            return hold
        })
        return {
            hold,
            handOff,
            release: () => state.release?.(),
            layoutHandOff: {
                canHandOff: vi.fn(() => true),
                ownedLayoutKeys: () => new Set(owned),
                handOff
            } satisfies PresenceLayoutHandOff
        }
    }

    /** The container's hand-off for a real adapter (P3). */
    const adapterHandOff = (adapter: MotionDomProjectionAdapter): PresenceLayoutHandOff => ({
        canHandOff: () => adapter.isMounted && !adapter.isHandedOff,
        ownedLayoutKeys: () => new Set(),
        handOff: (clone, release) => adapter.handOffToExitClone(clone, release)
    })

    const rects = new Map<string, DOMRect>()
    const computed = new Map<Element, Record<string, string>>()
    let frames: FrameRequestCallback[]
    const runFrames = () => {
        for (const callback of frames.splice(0)) callback(0)
    }
    const drain = async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve()
    }
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
    const deferred = () => {
        let resolve!: () => void
        const promise = new Promise<void>((r) => (resolve = r))
        return { promise, resolve }
    }
    const mounted: MotionDomProjectionAdapter[] = []
    const mountAdapter = (
        element: HTMLElement,
        options: { layout?: boolean; layoutId?: string; group?: ReturnType<typeof nodeGroup> },
        parent?: MotionDomProjectionAdapter
    ) => {
        const adapter = new MotionDomProjectionAdapter({
            ...(parent ? { parent } : {}),
            ...(options.group ? { group: options.group } : {})
        })
        adapter.updateOptions({
            layout: options.layout,
            layoutId: options.layoutId,
            transition: { duration: 0.05 } as never
        })
        adapter.mount(element)
        mounted.push(adapter)
        return adapter
    }
    let parent: HTMLElement
    let el: HTMLElement
    const realGetComputedStyle = window.getComputedStyle.bind(window)

    beforeEach(() => {
        vi.useRealTimers()
        vi.clearAllMocks()
        vi.restoreAllMocks()
        document.body.innerHTML = ''
        document.documentElement.scrollTop = 0
        rects.clear()
        computed.clear()
        parent = document.createElement('div')
        parent.id = 'slot'
        el = document.createElement('div')
        el.id = 'exiting'
        el.dataset.r = 'el'
        parent.appendChild(el)
        document.body.appendChild(parent)
        rects.set('el', new DOMRect(10, 20, 100, 100))
        // Rects by `data-r`, which the clone copies; a detached element reads
        // as an all-zero box, like a browser.
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            if (!this.isConnected) return new DOMRect()
            if (this.hasAttribute('data-presence-placeholder'))
                return rects.get('placeholder') ?? new DOMRect(10, 20, 100, 100)
            return rects.get(this.dataset.r ?? '') ?? new DOMRect(0, 0, 400, 300)
        })
        // Computed-style overrides for chosen elements, on top of jsdom's.
        vi.spyOn(window, 'getComputedStyle').mockImplementation(function (
            element: Element,
            pseudo?: string | null
        ) {
            const style = realGetComputedStyle(element, pseudo)
            const overrides = computed.get(element)
            if (!overrides) return style
            return new Proxy(style, {
                get(target, prop) {
                    if (typeof prop === 'string' && prop in overrides) return overrides[prop]
                    if (prop === 'getPropertyValue')
                        return (name: string) => {
                            const camel = name.replace(/-([a-z])/g, (_, c: string) =>
                                c.toUpperCase()
                            )
                            return overrides[camel] ?? target.getPropertyValue(name)
                        }
                    const value = Reflect.get(target, prop, target)
                    return typeof value === 'function' ? value.bind(target) : value
                }
            })
        })
        frames = []
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frames.push(callback)
            return frames.length
        })
        vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
            frames[handle - 1] = () => {}
        })
    })
    afterEach(async () => {
        vi.unstubAllGlobals()
        await flush()
        for (const adapter of mounted.splice(0)) adapter.unmount()
    })

    it('10a: a held child without an exit keeps its clone until released, then completes once', async () => {
        const forceRender = vi.fn()
        const onExitComplete = vi.fn()
        const ctx = createAnimatePresenceContext({ onExitComplete, forceRender })
        const stub = stubHandOff()
        register(ctx, 'a', el, { handOff: stub.layoutHandOff })
        const insertBefore = vi.spyOn(parent, 'insertBefore')
        el.remove()
        ctx.unregisterChild('a')

        const clone = parent.querySelector<HTMLElement>('[data-clone]')!
        expect(clone).toBeTruthy()
        // Marked before it went in.
        const cloneInsert =
            insertBefore.mock.invocationCallOrder[
                insertBefore.mock.calls.findIndex(([node]) => node === clone)
            ]
        const mark = vi.mocked(markExiting).mock.calls.findIndex(([node]) => node === clone)
        expect(mark).toBeGreaterThanOrEqual(0)
        expect(vi.mocked(markExiting).mock.invocationCallOrder[mark]).toBeLessThan(cloneInsert)
        expect(stub.handOff).toHaveBeenCalledWith(clone, expect.any(Function))

        runFrames()
        await drain()
        expect(clone.isConnected).toBe(true)

        const order: string[] = []
        let placeholderGone = false
        const seed = vi
            .spyOn(MotionDomProjectionAdapter, 'seedFollowingLayout')
            .mockImplementation(() => {
                order.push('seed')
                placeholderGone = !document.querySelector('[data-presence-placeholder]')
            })
        forceRender.mockImplementation(() => order.push('finishExit'))
        stub.release()

        expect(clone.isConnected).toBe(false)
        expect(stub.hold.finish).toHaveBeenCalledTimes(1)
        expect(seed).toHaveBeenCalledTimes(1)
        expect(seed.mock.calls[0][2]).toEqual({
            kind: 'exit-complete',
            markers: [expect.objectContaining({ boundary: parent })]
        })
        expect(placeholderGone).toBe(true)
        expect(order).toEqual(['seed', 'finishExit'])
        await tick()
        expect(onExitComplete).toHaveBeenCalledTimes(1)
        stub.release()
        await tick()
        expect(onExitComplete).toHaveBeenCalledTimes(1)
    })

    it('10b: with an exit, the clone goes only once both the exit and the hold have settled', async () => {
        for (const releaseFirst of [false, true]) {
            const finished = deferred()
            vi.mocked(animate).mockReturnValueOnce({ finished: finished.promise } as never)
            const ctx = createAnimatePresenceContext({})
            const stub = stubHandOff()
            const element = document.createElement('div')
            element.dataset.r = 'el'
            parent.appendChild(element)
            register(ctx, 'b', element, { exit: { opacity: 0 }, handOff: stub.layoutHandOff })
            element.remove()
            ctx.unregisterChild('b')
            const clone = parent.querySelector<HTMLElement>('[data-clone]')!
            runFrames()
            await drain()
            expect(animate).toHaveBeenCalled()

            if (releaseFirst) stub.release()
            else finished.resolve()
            await drain()
            expect(clone.isConnected, `after the first (${releaseFirst ? 'hold' : 'exit'})`).toBe(
                true
            )
            if (releaseFirst) finished.resolve()
            else stub.release()
            await drain()
            expect(clone.isConnected).toBe(false)
            ctx.dispose()
        }
    })

    it('10c: re-entry and boundary disposal cancel the hold', async () => {
        const ctx = createAnimatePresenceContext({})
        const stub = stubHandOff()
        register(ctx, 'c', el, { exit: { opacity: 0 }, handOff: stub.layoutHandOff })
        el.remove()
        ctx.unregisterChild('c')
        runFrames()
        await drain()
        ctx.takeExitHandoff('c')
        expect(stub.hold.cancel).toHaveBeenCalledTimes(1)

        const other = stubHandOff()
        const element = document.createElement('div')
        parent.appendChild(element)
        register(ctx, 'd', element, { handOff: other.layoutHandOff })
        element.remove()
        ctx.unregisterChild('d')
        ctx.dispose()
        expect(other.hold.cancel).toHaveBeenCalledTimes(1)
    })

    describe('10d: held clone placement (sync)', () => {
        let cb: HTMLElement
        let slot: HTMLElement
        let child: HTMLElement
        beforeEach(() => {
            document.body.innerHTML = ''
            cb = document.createElement('section')
            cb.style.position = 'relative'
            cb.dataset.r = 'cb'
            slot = document.createElement('div')
            slot.dataset.r = 'slot'
            child = document.createElement('div')
            child.id = 'held'
            child.dataset.r = 'child'
            slot.appendChild(child)
            cb.appendChild(slot)
            document.body.appendChild(cb)
            rects.set('cb', new DOMRect(10, 20, 300, 200))
            // Mid scale(1.5): the transformed rect.
            rects.set('child', new DOMRect(15, 35, 150, 150))
            rects.set('placeholder', new DOMRect(40, 60, 100, 100))
            Object.defineProperty(cb, 'clientLeft', { configurable: true, value: 2 })
            Object.defineProperty(cb, 'clientTop', { configurable: true, value: 2 })
            Object.defineProperty(cb, 'offsetWidth', { configurable: true, value: 300 })
            Object.defineProperty(cb, 'offsetHeight', { configurable: true, value: 200 })
            computed.set(child, {
                width: '100px',
                height: '100px',
                boxSizing: 'content-box',
                margin: '0px 0px 0px 10px',
                marginLeft: '10px',
                position: 'static',
                display: 'block',
                zIndex: 'auto'
            })
        })

        const exitHeld = (owned: string[] = []) => {
            const ctx = createAnimatePresenceContext({})
            const stub = stubHandOff(owned)
            register(ctx, 'held', child, { exit: { opacity: 0 }, handOff: stub.layoutHandOff })
            child.remove()
            ctx.unregisterChild('held')
            return { ctx, clone: slot.querySelector<HTMLElement>('[data-clone]')! }
        }

        it('keeps its id, gets no z-index lift and no forced position: relative', () => {
            const { ctx, clone } = exitHeld()
            expect(clone.id).toBe('held')
            expect(clone.style.zIndex).toBe('')
            expect(slot.style.position).toBe('')
            ctx.dispose()
        })

        it('is placed from the recorded untransformed size and the placeholder slot', () => {
            const { ctx, clone } = exitHeld()
            expect(clone.style.width).toBe('100px')
            expect(clone.style.height).toBe('100px')
            expect(clone.style.boxSizing).toBe('content-box')
            expect(clone.style.left).toBe('28px')
            expect(clone.style.top).toBe('38px')
            expect(clone.style.margin).toMatch(/^0(px)?$/)
            ctx.dispose()
        })

        it('leaves the keys the VisualElement writes to it', () => {
            const { ctx, clone } = exitHeld(['width', 'marginLeft'])
            expect(clone.style.width).toBe('')
            expect(clone.style.left).toBe('18px')
            ctx.dispose()
        })

        it('keeps an out-of-flow child’s own position and insets', () => {
            computed.set(child, {
                ...computed.get(child)!,
                position: 'fixed',
                top: '12px',
                left: '30px',
                right: 'auto',
                bottom: 'auto'
            })
            const { ctx, clone } = exitHeld()
            expect(clone.style.position).toBe('fixed')
            expect(clone.style.top).toBe('12px')
            expect(clone.style.left).toBe('30px')
            ctx.dispose()
            slot.appendChild(child)
            const owned = exitHeld(['top'])
            expect(owned.clone.style.top).toBe('')
            owned.ctx.dispose()
        })
    })

    it('10o: every placeholder is sized from the recorded untransformed size', () => {
        // Mid scale-up from 0.5: the transformed rect is half the size.
        rects.set('el', new DOMRect(35, 45, 50, 50))
        computed.set(el, { width: '100px', height: '100px', boxSizing: 'border-box' })
        const ctx = createAnimatePresenceContext({})
        register(ctx, 'o', el, { exit: { opacity: 0 } })
        el.remove()
        ctx.unregisterChild('o')
        const placeholder = parent.querySelector<HTMLElement>('[data-presence-placeholder]')!
        expect(placeholder.style.width).toBe('100px')
        expect(placeholder.style.height).toBe('100px')
        ctx.dispose()
    })

    /** A `[data-propagate]` boundary in `host` with a registered motion child. */
    const propagatingChild = (host: HTMLElement) => {
        const boundary = document.createElement('div')
        boundary.className = 'animate-presence-container'
        boundary.setAttribute('data-propagate', '')
        const innerEl = document.createElement('div')
        innerEl.className = 'inner'
        boundary.appendChild(innerEl)
        host.appendChild(boundary)
        const exit = deferred()
        const visualElement = {
            current: innerEl as HTMLElement,
            animationState: { setActive: vi.fn(() => exit.promise) },
            projection: undefined,
            unmount: vi.fn()
        }
        visualElementStore.set(innerEl, visualElement as never)
        return { boundary, innerEl, exit, visualElement }
    }

    it('10p: a nested propagating boundary completes once its child’s propagated exit settles', async () => {
        const outer = createAnimatePresenceContext({})
        const onExitComplete = vi.fn()
        const inner = createAnimatePresenceContext({ onExitComplete })
        const { innerEl, exit } = propagatingChild(el)
        register(outer, 'outer', el, { exit: { opacity: 0 } })
        register(inner, 'inner', innerEl, { exit: { opacity: 0 } })

        el.remove()
        outer.unregisterChild('outer')
        inner.unregisterChild('inner')
        inner.dispose()
        await tick()
        expect(onExitComplete).not.toHaveBeenCalled()

        exit.resolve()
        await drain()
        await tick()
        expect(onExitComplete).toHaveBeenCalledTimes(1)
        // Fully disposed now.
        const later = document.createElement('div')
        parent.appendChild(later)
        register(inner, 'later', later, { exit: { opacity: 0 } })
        later.remove()
        inner.unregisterChild('later')
        expect(document.querySelectorAll('[data-clone]').length).toBeLessThanOrEqual(1)
        outer.dispose()
    })

    it('10q: a non-held clone runs a propagating boundary’s child exit on its copy and waits for it', async () => {
        const ctx = createAnimatePresenceContext({})
        const { exit, visualElement } = propagatingChild(el)
        register(ctx, 'q', el, { exit: { opacity: 0 } })
        el.remove()
        ctx.unregisterChild('q')
        const clone = parent.querySelector<HTMLElement>('[data-clone]')!
        expect(visualElement.current).toBe(clone.querySelector('.inner'))
        expect(visualElementStore.get(clone.querySelector('.inner') as Element)).toBe(
            visualElement as never
        )
        expect(visualElement.animationState.setActive).toHaveBeenCalledWith('exit', true)

        runFrames()
        await drain()
        expect(clone.isConnected).toBe(true)
        exit.resolve()
        await drain()
        expect(clone.isConnected).toBe(false)
    })

    it('10r: every deferred unmount runs while the clone is connected, before it is removed', async () => {
        const innerEl = document.createElement('div')
        innerEl.dataset.r = 'inner'
        el.appendChild(innerEl)
        rects.set('inner', new DOMRect(20, 30, 50, 50))
        const outerAdapter = mountAdapter(el, { layoutId: 'r-outer' })
        const innerAdapter = mountAdapter(innerEl, { layoutId: 'r-inner' }, outerAdapter)
        const ctx = createAnimatePresenceContext({})
        register(ctx, 'r', el, { handOff: adapterHandOff(outerAdapter) })
        const events: string[] = []
        for (const [name, adapter] of [
            ['outer', outerAdapter],
            ['inner', innerAdapter]
        ] as const) {
            vi.spyOn(adapter.visualElement, 'unmount').mockImplementation(function (this: unknown) {
                events.push(
                    `${name}:${document.querySelector('[data-clone]') ? 'connected' : 'gone'}`
                )
            })
        }
        el.remove()
        ctx.unregisterChild('r')
        const clone = parent.querySelector<HTMLElement>('[data-clone]')!
        expect(clone).toBeTruthy()
        vi.spyOn(clone, 'remove').mockImplementation(function (this: HTMLElement) {
            events.push('remove')
            Element.prototype.remove.call(this)
        })
        // The container's teardowns.
        innerAdapter.unmount()
        outerAdapter.unmount()
        runFrames()
        await flush()
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(events).toEqual(
            expect.arrayContaining(['outer:connected', 'inner:connected', 'remove'])
        )
        expect(events[events.length - 1]).toBe('remove')
    })

    it('10d-ii: a held child without an exit resolves its exit at hand-off; an unheld one gets no clone', async () => {
        const ctx = createAnimatePresenceContext({})
        const stub = stubHandOff()
        const resolveExit = vi.fn(() => undefined)
        register(ctx, 'ii', el, { resolveExit, handOff: stub.layoutHandOff })
        el.remove()
        ctx.unregisterChild('ii')
        expect(resolveExit).toHaveBeenCalled()
        const clone = parent.querySelector<HTMLElement>('[data-clone]')!
        runFrames()
        await drain()
        expect(clone.isConnected).toBe(true)
        stub.release()
        expect(clone.isConnected).toBe(false)

        const element = document.createElement('div')
        parent.appendChild(element)
        const unheld = stubHandOff()
        unheld.layoutHandOff.canHandOff.mockReturnValue(false)
        register(ctx, 'iii', element, { handOff: unheld.layoutHandOff })
        const insertBefore = vi.spyOn(parent, 'insertBefore')
        element.remove()
        ctx.unregisterChild('iii')
        expect(insertBefore).not.toHaveBeenCalled()
        expect(unheld.handOff).not.toHaveBeenCalled()
        ctx.dispose()
    })

    it('10d-iii: nested motion descendants move to their clone copies; nested exit artifacts are stripped', async () => {
        const innerEl = document.createElement('div')
        innerEl.className = 'inner'
        innerEl.dataset.r = 'inner'
        el.appendChild(innerEl)
        const strayClone = document.createElement('div')
        strayClone.setAttribute('data-clone', 'true')
        const strayPlaceholder = document.createElement('div')
        strayPlaceholder.setAttribute('data-presence-placeholder', 'true')
        el.append(strayClone, strayPlaceholder)
        const outerAdapter = mountAdapter(el, { layoutId: 'iii-outer' })
        const innerAdapter = mountAdapter(innerEl, { layoutId: 'iii-inner' }, outerAdapter)
        const ctx = createAnimatePresenceContext({})
        register(ctx, 'iii', el, { handOff: adapterHandOff(outerAdapter) })
        el.remove()
        ctx.unregisterChild('iii')
        const clone = parent.querySelector<HTMLElement>(':scope > [data-clone]')!
        expect(clone.querySelector('[data-clone]')).toBeNull()
        expect(clone.querySelector('[data-presence-placeholder]')).toBeNull()
        const copy = clone.querySelector<HTMLElement>('.inner')!
        expect(innerAdapter.visualElement.current).toBe(copy)
        expect(innerAdapter.projection.instance === copy).toBe(true)
        expect(visualElementStore.get(copy)).toBe(innerAdapter.visualElement)
        innerAdapter.unmount()
        outerAdapter.unmount()
        runFrames()
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(clone.isConnected).toBe(false)
    })

    describe('a layout clone in a clamped scroller (015a 6a setup)', () => {
        let scroller: HTMLElement
        let list: HTMLElement
        let item: HTMLElement
        beforeEach(() => {
            document.body.innerHTML = ''
            scroller = document.createElement('div')
            scroller.setAttribute('style', 'overflow: auto; height: 320px')
            list = document.createElement('ul')
            item = document.createElement('li')
            item.dataset.r = 'item'
            list.appendChild(item)
            scroller.appendChild(list)
            document.body.appendChild(scroller)
            Object.defineProperty(scroller, 'offsetWidth', { configurable: true, value: 400 })
            Object.defineProperty(scroller, 'offsetHeight', { configurable: true, value: 320 })
            scroller.scrollTop = 500
            rects.set('item', new DOMRect(10, 100, 150, 60))
        })

        const exitAfterClamp = async (clamp: boolean, mode: 'popLayout' | 'sync' = 'popLayout') => {
            const adapter = mountAdapter(item, { layout: true })
            const handOff = vi.spyOn(adapter, 'handOffToExitClone')
            const ctx = createAnimatePresenceContext({ mode })
            register(ctx, 'item', item, {
                exit: { opacity: 0 },
                transition: { type: 'spring' },
                handOff: adapterHandOff(adapter)
            })
            item.remove()
            const animations: unknown[] = []
            const deltas: { x: number; y: number }[] = []
            adapter.projection.addEventListener('animationStart', () => animations.push(1))
            adapter.projection.addEventListener(
                'didUpdate',
                ({ delta }: { delta: { x: { translate: number }; y: { translate: number } } }) =>
                    deltas.push({ x: delta.x.translate, y: delta.y.translate })
            )
            ctx.unregisterChild('item')
            const clone = list.querySelector<HTMLElement>('[data-clone]')!
            // Drawn 70px lower once the scroll position clamps.
            if (clamp) {
                rects.set('item', new DOMRect(10, 170, 150, 60))
                scroller.scrollTop = 430
            }
            adapter.unmount()
            await drain()
            return { ctx, adapter, clone, handOff, animations, deltas }
        }

        it('10e: the re-homed node animates the clamp, measured after the #2348 correction', async () => {
            const { ctx, adapter, clone, handOff, deltas } = await exitAfterClamp(true)
            expect(handOff).toHaveBeenCalledTimes(1)
            const measured: string[] = []
            vi.spyOn(adapter.projection, 'updateLayout').mockImplementation(function (
                this: typeof adapter.projection
            ) {
                measured.push(clone.style.top)
            })
            await flush()
            expect(deltas).toHaveLength(1)
            expect(Math.abs(deltas[0].y)).toBeCloseTo(70, 0)
            for (const call of vi.mocked(animate).mock.calls) {
                expect(call[1]).not.toHaveProperty('x')
                expect(call[1]).not.toHaveProperty('y')
            }
            runFrames()
            for (const call of vi.mocked(animate).mock.calls) {
                expect(call[1]).not.toHaveProperty('y')
            }
            void measured
            ctx.dispose()
        })

        it('10g-i: a non-layout clone gets no hold and no follow; its exit starts on the frame', async () => {
            const ctx = createAnimatePresenceContext({ mode: 'popLayout' })
            register(ctx, 'plain', item, { exit: { opacity: 0 }, transition: { type: 'spring' } })
            item.remove()
            ctx.unregisterChild('plain')
            scroller.scrollTop = 430
            await drain()
            expect(animate).not.toHaveBeenCalled()
            runFrames()
            expect(animate).toHaveBeenCalledTimes(1)
            expect(vi.mocked(animate).mock.calls[0][1]).not.toHaveProperty('y')
            ctx.dispose()
        })

        it('10g-ii: with no scroll change a held layout clone starts no layout animation and is released after the update', async () => {
            const { clone, animations } = await exitAfterClamp(false, 'sync')
            runFrames()
            await flush()
            await new Promise((resolve) => setTimeout(resolve, 20))
            expect(animations).toHaveLength(0)
            expect(clone.isConnected).toBe(false)
        })
    })

    it('10h: a layout-only child without an exit is released in the same task when nothing moved', async () => {
        const adapter = mountAdapter(el, { layout: true })
        const ctx = createAnimatePresenceContext({})
        register(ctx, 'h', el, { handOff: adapterHandOff(adapter) })
        el.remove()
        ctx.unregisterChild('h')
        const clone = parent.querySelector<HTMLElement>('[data-clone]')!
        expect(clone).toBeTruthy()
        adapter.unmount()
        await drain()
        await new Promise((resolve) => queueMicrotask(() => resolve(undefined)))
        await drain()
        expect(frames.length === 0 || clone.isConnected === false).toBe(true)
        expect(clone.isConnected).toBe(false)
    })

    it('10i: a node is handed off once', () => {
        const adapter = mountAdapter(el, { layoutId: 'i-once' })
        const handOff = vi.spyOn(adapter, 'handOffToExitClone')
        const ctx = createAnimatePresenceContext({})
        register(ctx, 'i', el, { handOff: adapterHandOff(adapter) })
        el.remove()
        ctx.unregisterChild('i')
        expect(adapterHandOff(adapter).canHandOff()).toBe(false)
        // Re-registered with the same element, then unregistered again.
        register(ctx, 'i', el, { handOff: adapterHandOff(adapter) })
        ctx.unregisterChild('i')
        expect(handOff).toHaveBeenCalledTimes(1)
        ctx.dispose()
    })

    it('10j: no clone without a connected slot parent', () => {
        const ctx = createAnimatePresenceContext({})
        register(ctx, 'j', el, { exit: { opacity: 0 } })
        parent.remove()
        el.remove()
        const append = vi.spyOn(document.body, 'insertBefore')
        const appendChild = vi.spyOn(document.body, 'appendChild')
        ctx.unregisterChild('j')
        expect(append).not.toHaveBeenCalled()
        expect(appendChild).not.toHaveBeenCalled()
        expect(document.querySelector('[data-clone]')).toBeNull()
        ctx.dispose()
    })

    it('10k: a non-layout clone drops the copies of a nested boundary’s exit artifacts', () => {
        const nested = document.createElement('div')
        nested.className = 'animate-presence-container'
        const nestedClone = document.createElement('div')
        nestedClone.setAttribute('data-clone', 'true')
        const nestedPlaceholder = document.createElement('div')
        nestedPlaceholder.setAttribute('data-presence-placeholder', 'true')
        nested.append(nestedClone, nestedPlaceholder)
        el.appendChild(nested)
        const ctx = createAnimatePresenceContext({})
        register(ctx, 'k', el, { exit: { opacity: 0 } })
        el.remove()
        ctx.unregisterChild('k')
        const clone = parent.querySelector<HTMLElement>(':scope > [data-clone]')!
        expect(clone.querySelector('[data-clone]')).toBeNull()
        expect(clone.querySelector('[data-presence-placeholder]')).toBeNull()
        ctx.dispose()
    })

    /** A held child whose `layoutId` descendant sits in a nested boundary. */
    const nestedBoundaryChild = (propagate: boolean) => {
        const boundary = document.createElement('div')
        boundary.className = 'animate-presence-container'
        if (propagate) boundary.setAttribute('data-propagate', '')
        const innerEl = document.createElement('div')
        innerEl.className = 'inner'
        innerEl.dataset.r = 'inner'
        boundary.appendChild(innerEl)
        el.appendChild(boundary)
        rects.set('inner', new DOMRect(20, 30, 50, 50))
        const outerAdapter = mountAdapter(el, { layoutId: `nb-outer-${propagate}` })
        const innerAdapter = mountAdapter(
            innerEl,
            { layoutId: `nb-inner-${propagate}` },
            outerAdapter
        )
        const ctx = createAnimatePresenceContext({})
        register(ctx, 'nb', el, { handOff: adapterHandOff(outerAdapter) })
        return { ctx, outerAdapter, innerAdapter }
    }

    it('10l: below a nested boundary a layoutId descendant is re-homed but not relegated or held', async () => {
        const { ctx, outerAdapter, innerAdapter } = nestedBoundaryChild(false)
        const relegate = vi.spyOn(innerAdapter.projection, 'relegate')
        const unmountInner = vi.spyOn(innerAdapter.visualElement, 'unmount')
        el.remove()
        ctx.unregisterChild('nb')
        const clone = parent.querySelector<HTMLElement>('[data-clone]')!
        expect(innerAdapter.visualElement.current).toBe(clone.querySelector('.inner'))
        expect(innerAdapter.projection.isPresent).not.toBe(false)
        expect(relegate).not.toHaveBeenCalled()
        innerAdapter.unmount()
        expect(unmountInner).not.toHaveBeenCalled()
        outerAdapter.unmount()
        runFrames()
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(unmountInner).toHaveBeenCalledTimes(1)
        expect(clone.isConnected).toBe(false)
    })

    it('10m: below a propagating boundary the descendant relegates and holds', () => {
        const { ctx, innerAdapter } = nestedBoundaryChild(true)
        const relegate = vi.spyOn(innerAdapter.projection, 'relegate')
        el.remove()
        ctx.unregisterChild('nb')
        expect(innerAdapter.projection.isPresent).toBe(false)
        expect(relegate).toHaveBeenCalled()
        expect(innerAdapter.isHandedOff).toBe(true)
        ctx.dispose()
    })

    it('10n: a non-measuring descendant is re-homed and unmounted with the outer hold', async () => {
        const innerEl = document.createElement('div')
        innerEl.className = 'inner'
        el.appendChild(innerEl)
        const outerAdapter = mountAdapter(el, { layoutId: 'n-outer' })
        const innerAdapter = mountAdapter(innerEl, {}, outerAdapter)
        const unmountInner = vi.spyOn(innerAdapter.visualElement, 'unmount')
        const ctx = createAnimatePresenceContext({})
        register(ctx, 'n', el, { handOff: adapterHandOff(outerAdapter) })
        el.remove()
        ctx.unregisterChild('n')
        const copy = parent.querySelector<HTMLElement>('[data-clone] .inner')!
        expect(innerAdapter.visualElement.current).toBe(copy)
        expect(visualElementStore.get(copy)).toBe(innerAdapter.visualElement)
        expect(innerAdapter.isHandedOff).toBe(true)
        innerAdapter.unmount()
        expect(unmountInner).not.toHaveBeenCalled()
        outerAdapter.unmount()
        runFrames()
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(unmountInner).toHaveBeenCalledTimes(1)
    })

    it('10s: wait mode releases a held layoutId clone by the lead check, not the hidden entering node', async () => {
        const adapter = mountAdapter(el, { layoutId: 's-wait' })
        const ctx = createAnimatePresenceContext({ mode: 'wait' })
        register(ctx, 's', el, { handOff: adapterHandOff(adapter) })
        // The entering sibling, mounted hidden.
        const entering = document.createElement('div')
        entering.setAttribute('data-presence-wait-hidden', '')
        entering.dataset.r = 'entering'
        rects.set('entering', new DOMRect(300, 20, 100, 100))
        parent.appendChild(entering)
        el.remove()
        ctx.unregisterChild('s')
        const unblocked = vi.fn()
        ctx.onEnterUnblocked(unblocked)
        const clone = parent.querySelector<HTMLElement>('[data-clone]')!
        expect(clone).toBeTruthy()
        adapter.unmount()
        runFrames()
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(clone.isConnected).toBe(false)
        expect(unblocked).toHaveBeenCalledTimes(1)
    })

    it('10t: a size-animating host hands off unseeded and its clone carries no size-animation marker', async () => {
        el.setAttribute('data-layout-size-animation', '')
        const inner = document.createElement('div')
        inner.setAttribute('data-layout-size-animation', '')
        el.appendChild(inner)
        const adapter = mountAdapter(el, { layout: true })
        const animations: unknown[] = []
        adapter.projection.addEventListener('animationStart', () => animations.push(1))
        const ctx = createAnimatePresenceContext({})
        register(ctx, 't', el, { handOff: adapterHandOff(adapter) })
        el.remove()
        ctx.unregisterChild('t')
        const clone = parent.querySelector<HTMLElement>('[data-clone]')!
        expect(clone).toBeTruthy()
        expect(clone.hasAttribute('data-layout-size-animation')).toBe(false)
        expect(clone.querySelector('[data-layout-size-animation]')).toBeNull()
        expect(adapter.projection.snapshot).toBeUndefined()
        adapter.unmount()
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(animations).toHaveLength(0)
        expect(clone.isConnected).toBe(false)
    })

    it('10u: a grouped sibling is not animated by the deferred unmount, only by the completion commit', async () => {
        const group = nodeGroup()
        const sibling = document.createElement('div')
        sibling.dataset.r = 'sibling'
        rects.set('sibling', new DOMRect(10, 120, 100, 100))
        parent.appendChild(sibling)
        const adapter = mountAdapter(el, { layout: true, group })
        const siblingAdapter = mountAdapter(sibling, { layout: true, group })
        const starts: unknown[] = []
        siblingAdapter.projection.addEventListener('animationStart', () => starts.push(1))
        const ctx = createAnimatePresenceContext({ mode: 'sync' })
        register(ctx, 'u', el, { group, handOff: adapterHandOff(adapter) })
        const slotHeld: boolean[] = []
        vi.spyOn(adapter.visualElement, 'unmount').mockImplementation(() => {
            slotHeld.push(!!parent.querySelector('[data-presence-placeholder]'))
        })
        el.remove()
        ctx.unregisterChild('u')
        expect(parent.querySelector('[data-clone]')).not.toBeNull()
        adapter.unmount()
        await new Promise((resolve) => setTimeout(resolve, 20))
        // The deferred unmount ran while the placeholder still held the slot.
        expect(slotHeld).toEqual([true])
        // Released: the placeholder held the slot through the unmount.
        expect(parent.querySelector('[data-clone]')).toBeNull()
        expect(starts).toHaveLength(0)
        // The exit-complete observer commit moves it up into the freed slot.
        rects.set('sibling', new DOMRect(10, 20, 100, 100))
        siblingAdapter.commitObservedLayoutChange()
        // The animation starts on motion-dom's frameloop (rAF is queued here).
        await new Promise((resolve) => setTimeout(resolve, 80))
        expect(starts).toHaveLength(1)
    })

    it('10f: a child with no hand-off and no exit is still removed at once', () => {
        const ctx = createAnimatePresenceContext({})
        register(ctx, 'f', el)
        el.remove()
        ctx.unregisterChild('f')
        expect(parent.querySelector('[data-clone]')).toBeNull()
        ctx.dispose()
    })
})

/**
 * Plan 012 A2: a viewport resize can move a popLayout element (a fixed,
 * bottom-anchored list) without resizing any box the cache observes. Upstream
 * measures fresh on every resize, so the cached point follows it.
 */
describe('createPopLayoutPointCache and window resizes (plan 012 A2)', () => {
    it('re-samples the resting point after a window resize', async () => {
        vi.useRealTimers()
        vi.restoreAllMocks()
        document.body.innerHTML = ''
        const element = document.createElement('div')
        document.body.appendChild(element)
        let top = 100
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(
            () => new DOMRect(10, top, 100, 60)
        )
        const cache = createPopLayoutPointCache()
        cache.track(element)
        const settle = () => new Promise((resolve) => setTimeout(resolve, 120))
        await settle()
        expect(cache.read(element)?.[1]).toBe(100)

        // The viewport got 180px shorter: the bottom-anchored element rose.
        top = -80
        window.dispatchEvent(new Event('resize'))
        await settle()
        expect(cache.read(element)?.[1]).toBe(-80)
        cache.dispose()
    })
})
