import { getContext, setContext } from 'svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAnimatePresenceContext, getPresenceDepth, setPresenceDepth } from './presence'

// Mock svelte context functions for depth tests
vi.mock('svelte', async (importOriginal) => {
    const original = await importOriginal<typeof import('svelte')>()
    const contextStore = new Map<symbol | string, unknown>()
    return {
        ...original,
        setContext: vi.fn((key: symbol | string, value: unknown) => {
            contextStore.set(key, value)
        }),
        getContext: vi.fn((key: symbol | string) => {
            return contextStore.get(key)
        }),
        // Helper to clear context between tests
        __clearContextStore: () => contextStore.clear()
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
        const clone = document.querySelector('[data-clone="true"]') as HTMLElement | null
        expect(clone).toBeTruthy()
    })

    it('unregisterChild without exit just deletes child (no clone)', () => {
        const ctx = createAnimatePresenceContext({})
        ctx.registerChild('noexit', el, undefined)
        ctx.unregisterChild('noexit')
        const clone = document.querySelector('[data-clone="true"]')
        expect(clone).toBeFalsy()
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
        let clone = document.querySelector('[data-clone="true"]') as HTMLElement | null
        expect(clone).toBeTruthy()

        // After finished promise resolves, clone should be removed
        await Promise.resolve()
        await Promise.resolve()
        clone = document.querySelector('[data-clone="true"]') as HTMLElement | null
        expect(clone).toBeFalsy()
    })
})

describe('presence depth context', () => {
    beforeEach(() => {
        // Clear mock call history between tests
        vi.mocked(setContext).mockClear()
        vi.mocked(getContext).mockClear()
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
