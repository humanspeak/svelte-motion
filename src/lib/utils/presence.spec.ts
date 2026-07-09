import { animate } from 'motion'
import { getContext, setContext } from 'svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createAnimatePresenceContext,
    getPresenceDepth,
    measurePopLayoutSnapshot,
    resolvePopLayoutStyles,
    setPresenceDepth
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
        vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
            x: 10,
            y: 20,
            top: 20,
            left: 10,
            bottom: 120,
            right: 110,
            width: 100,
            height: 100,
            toJSON: () => {}
        } as unknown as DOMRect)

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
        } as unknown as DOMRect)

        vi.spyOn(window, 'getComputedStyle').mockImplementation(() =>
            mockComputedStyle({ borderRadius: '8px', boxSizing: 'border-box' })
        )

        // Ensure rAF callbacks run synchronously in tests so exit cleanup executes
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(((
            cb: FrameRequestCallback
        ) => {
            cb(0)
            return 1 as unknown as number
        }) as unknown as typeof requestAnimationFrame)
    })

    it('registers and updates child state', () => {
        const ctx = createAnimatePresenceContext({})
        ctx.registerChild('k', el, { opacity: 0 })

        const newRect = {
            x: 12,
            y: 22,
            top: 22,
            left: 12,
            bottom: 122,
            right: 112,
            width: 100,
            height: 100,
            toJSON: () => {}
        } as unknown as DOMRect

        ctx.updateChildState('k', newRect, mockComputedStyle({ borderRadius: '12px' }))

        // Trigger exit (also exercises clone creation)
        ctx.unregisterChild('k')

        // Clone should be added then removed after animation finishes
        const clone = document.querySelector<HTMLElement>('[data-clone="true"]')
        expect(clone).toBeTruthy()
    })

    it('unregisterChild without exit just deletes child (no clone)', () => {
        const ctx = createAnimatePresenceContext({})
        ctx.registerChild('noexit', el, undefined)
        ctx.unregisterChild('noexit')
        const clone = document.querySelector('[data-clone="true"]')
        expect(clone).toBeFalsy()
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
        } as unknown as DOMRect)

        vi.spyOn(window, 'getComputedStyle').mockImplementation(() =>
            mockComputedStyle({ borderRadius: '8px', boxSizing: 'border-box', display: 'block' })
        )

        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(((
            cb: FrameRequestCallback
        ) => {
            cb(0)
            return 1 as unknown as number
        }) as unknown as typeof requestAnimationFrame)
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

            vi.mocked(window.getComputedStyle).mockImplementation((target: Element) => {
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
            } as unknown as DOMRect)

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
