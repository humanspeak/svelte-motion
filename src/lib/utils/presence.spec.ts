import { animate } from 'motion'
import { getContext, setContext } from 'svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    containsStatefulCloneContent,
    createAnimatePresenceContext,
    getPresenceDepth,
    measurePopLayoutSnapshot,
    observeStyleChanges,
    readAnimatedValues,
    resolvePopLayoutStyles,
    setPresenceDepth,
    snapshotComputedStyle
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
                direction: 'ltr'
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
                    direction: 'ltr'
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
                        direction: 'ltr'
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
        vi.spyOn(window, 'getComputedStyle').mockImplementation((target) =>
            target === element ? style : mockComputedStyle({ lineHeight: inheritedHeight })
        )
        const snapshot = snapshotComputedStyle(style, element)
        expect(snapshot['line-height']).toBe(expected)
        expect(element.children).toHaveLength(1)
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
        const probe = document.createElement('span')
        probe.setAttribute('data-presence-style-probe', '')
        element.append(probe)
        probe.remove()
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
