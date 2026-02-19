import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attachWhileTap, buildTapResetRecord } from './interaction.js'

// Mock motion.animate
vi.mock('motion', () => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { animate: animateMock }
})
const { animate: animateMock } = (await import('motion')) as unknown as {
    animate: ReturnType<typeof vi.fn> & { mockClear: () => void; mock: { calls: unknown[][] } }
}

// Mock motion-dom.press
// Captures the onPressStart callback so tests can invoke it to simulate press/release.
let pressCallback:
    | ((
          element: HTMLElement,
          startEvent: PointerEvent
      ) => ((endEvent: PointerEvent, info: { success: boolean }) => void) | void)
    | null = null
let pressCleanup: (() => void) | null = null
vi.mock('motion-dom', () => {
    const pressMock = vi.fn(
        (
            _el: HTMLElement,
            callback: (
                element: HTMLElement,
                startEvent: PointerEvent
            ) => ((endEvent: PointerEvent, info: { success: boolean }) => void) | void
        ) => {
            pressCallback = callback
            pressCleanup = vi.fn(() => {})
            return pressCleanup
        }
    )
    return { press: pressMock }
})

describe('utils/interaction', () => {
    beforeEach(() => {
        animateMock.mockClear()
        pressCallback = null
        pressCleanup = null
    })

    // --- buildTapResetRecord tests (unchanged) ---

    it('buildTapResetRecord: prefers animate over initial', () => {
        const initial = { scale: 1, backgroundColor: '#111' }
        const animate = { scale: 1.1, backgroundColor: '#000' }
        const whileTap = { scale: 0.9, backgroundColor: '#f00' }
        const reset = buildTapResetRecord(initial, animate, whileTap)
        expect(reset).toMatchObject({ scale: 1.1, backgroundColor: '#000' })
    })

    it('buildTapResetRecord: falls back to initial when animate is missing key', () => {
        const initial = { x: 10 }
        const animate = {}
        const whileTap = { x: 0 }
        const reset = buildTapResetRecord(initial, animate as unknown as typeof initial, whileTap)
        expect(reset).toMatchObject({ x: 10 })
    })

    it('buildTapResetRecord: returns defaults for whileTap keys not in baseline', () => {
        const reset = buildTapResetRecord({ a: 1 }, { b: 2 }, { c: 3 })
        // 'c' is in whileTap but not in initial/animate, so it gets a default (undefined)
        expect(Object.keys(reset)).toHaveLength(1)
        expect(reset.c).toBeUndefined()
    })

    // --- attachWhileTap tests ---

    it('attachWhileTap: animates on press and restores on release, fires callbacks', async () => {
        const el = document.createElement('div')
        animateMock.mockClear()
        const onTapStart = vi.fn()
        const onTap = vi.fn()
        const onTapCancel = vi.fn()
        const cleanup = attachWhileTap(
            el,
            { scale: 0.9, backgroundColor: '#f00' },
            { scale: 1, backgroundColor: '#111' },
            { scale: 1.1, backgroundColor: '#000' },
            { onTapStart, onTap, onTapCancel }
        )

        // Simulate press start via captured callback
        const onPressEnd = pressCallback!(el, new PointerEvent('pointerdown'))
        await Promise.resolve()
        expect(animateMock).toHaveBeenCalledTimes(1)
        const downCall = animateMock.mock.calls.at(-1)
        expect(downCall?.[1]).toMatchObject({ scale: 0.9, backgroundColor: '#f00' })
        expect(onTapStart).toHaveBeenCalledTimes(1)

        // Simulate press end (success)
        onPressEnd!(new PointerEvent('pointerup'), { success: true })
        await Promise.resolve()
        expect(animateMock).toHaveBeenCalledTimes(2)
        const upCall = animateMock.mock.calls.at(-1)
        expect(upCall?.[1]).toMatchObject({ scale: 1.1, backgroundColor: '#000' })
        expect(onTap).toHaveBeenCalledTimes(1)

        // Cleanup stops press and keyboard listeners
        cleanup()
        const callsAfterCleanup = animateMock.mock.calls.length
        // After cleanup, press callback invocations shouldn't affect animate
        expect(pressCleanup).toHaveBeenCalled()
        expect(animateMock.mock.calls.length).toBe(callsAfterCleanup)
    })

    it('attachWhileTap: negative - no-op when whileTap is undefined', () => {
        const el = document.createElement('div')
        const cleanup = attachWhileTap(el, undefined)
        expect(typeof cleanup).toBe('function')
        // press() should not have been called
        expect(pressCallback).toBeNull()
        animateMock.mockClear()
        // No listeners added, events should not call animate
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
        el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))
        expect(animateMock).not.toHaveBeenCalled()
        cleanup()
    })

    it('attachWhileTap: press cancel fires onTapCancel', async () => {
        const el = document.createElement('div')
        animateMock.mockClear()
        const onTapCancel = vi.fn()
        const cleanup = attachWhileTap(
            el,
            { scale: 0.95 },
            { scale: 1 },
            { scale: 1.1 },
            { onTapCancel }
        )

        // Simulate press start
        const onPressEnd = pressCallback!(el, new PointerEvent('pointerdown'))
        await Promise.resolve()
        expect(animateMock).toHaveBeenCalled()

        // Simulate press end with success=false (cancel)
        onPressEnd!(new PointerEvent('pointercancel'), { success: false })
        await Promise.resolve()
        expect(onTapCancel).toHaveBeenCalledTimes(1)
        // Should reset to baseline
        const last = animateMock.mock.calls.at(-1)
        expect(last?.[1]).toMatchObject({ scale: 1.1 })
        cleanup()
    })

    it('attachWhileTap: press cancel restores baseline when no initial/animate', async () => {
        const el = document.createElement('div')
        animateMock.mockClear()
        const onTapCancel = vi.fn()
        const cleanup = attachWhileTap(el, { scale: 0.95 }, undefined, undefined, { onTapCancel })

        // Simulate press start
        const onPressEnd = pressCallback!(el, new PointerEvent('pointerdown'))
        await Promise.resolve()
        expect(animateMock).toHaveBeenCalled()

        // Simulate cancel (success=false)
        onPressEnd!(new PointerEvent('pointercancel'), { success: false })
        await Promise.resolve()
        expect(onTapCancel).toHaveBeenCalledTimes(1)
        // Should still attempt reset (scale defaults to 1)
        const last = animateMock.mock.calls.at(-1)
        expect(last?.[1]).toMatchObject({ scale: 1 })
        cleanup()
    })

    it('attachWhileTap: keyboard Space behaves like tap (prevents scroll)', async () => {
        const el = document.createElement('div')
        animateMock.mockClear()
        const onTapStart = vi.fn()
        const onTap = vi.fn()
        const cleanup = attachWhileTap(
            el,
            { scale: 0.9 },
            { scale: 1 },
            { scale: 1.1 },
            { onTapStart, onTap }
        )

        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }))
        await Promise.resolve()
        expect(onTapStart).toHaveBeenCalledTimes(1)
        expect(animateMock).toHaveBeenCalled()

        el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', cancelable: true }))
        await Promise.resolve()
        expect(onTap).toHaveBeenCalledTimes(1)
        cleanup()
    })

    it('attachWhileTap: Space key cancel on blur', async () => {
        const el = document.createElement('div')
        animateMock.mockClear()
        const onTapStart = vi.fn()
        const onTapCancel = vi.fn()
        const cleanup = attachWhileTap(
            el,
            { scale: 0.9 },
            { scale: 1 },
            { scale: 1.1 },
            { onTapStart, onTapCancel }
        )

        // Start space press
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
        await Promise.resolve()
        expect(onTapStart).toHaveBeenCalledTimes(1)

        // Blur cancels the space press
        el.dispatchEvent(new FocusEvent('blur'))
        await Promise.resolve()
        expect(onTapCancel).toHaveBeenCalledTimes(1)
        cleanup()
    })

    it('attachWhileTap: double Space keydown only animates once', async () => {
        const el = document.createElement('div')
        const cleanup = attachWhileTap(el, { scale: 0.9 })
        animateMock.mockClear()
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
        await Promise.resolve()
        // Only one animate call on double keydown
        expect(animateMock.mock.calls.length).toBe(1)
        // Releasing with non-Space key should be ignored
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }))
        await Promise.resolve()
        cleanup()
    })

    it('attachWhileTap: re-applies hover on successful release when element is still hovered', async () => {
        const el = document.createElement('div') as HTMLElement & {
            matches: (_sel: string) => boolean
        }
        // Pretend environment is hover-capable
        vi.stubGlobal('matchMedia', ((query: string) => {
            const matches = query.includes('(hover: hover)') || query.includes('(pointer: fine)')
            return {
                matches,
                media: query,
                onchange: null,
                addEventListener() {},
                removeEventListener() {},
                addListener() {},
                removeListener() {},
                dispatchEvent() {
                    return false
                }
            } as unknown as MediaQueryList
        }) as unknown as typeof window.matchMedia)

        // Simulate :hover state
        Object.defineProperty(el, 'matches', { value: (sel: string) => sel === ':hover' })

        animateMock.mockClear()
        const cleanup = attachWhileTap(
            el,
            { scale: 0.8 },
            { scale: 1 },
            { scale: 1.1 },
            {
                hoverDef: { scale: 1.2, transition: { duration: 0.12 } } as unknown as Record<
                    string,
                    unknown
                >
            }
        )

        // press start → whileTap
        const onPressEnd = pressCallback!(el, new PointerEvent('pointerdown'))
        await Promise.resolve()
        // press end → hover reapplied (not baseline)
        onPressEnd!(new PointerEvent('pointerup'), { success: true })
        await Promise.resolve()
        const last = animateMock.mock.calls.at(-1)
        expect(last?.[1]).toMatchObject({ scale: 1.2 })
        // Uses releaseTransition (tween with overshoot) to prevent velocity accumulation
        expect(last?.[2]).toMatchObject({ duration: 0.3 })
        cleanup()
        vi.unstubAllGlobals()
    })

    it('attachWhileTap: when not hovered on release, restores baseline (not hover)', async () => {
        const el = document.createElement('div') as HTMLElement & {
            matches: (_sel: string) => boolean
        }
        // Hover capable, but element not hovered
        vi.stubGlobal('matchMedia', ((query: string) => {
            const matches = query.includes('(hover: hover)') || query.includes('(pointer: fine)')
            return {
                matches,
                media: query,
                onchange: null,
                addEventListener() {},
                removeEventListener() {},
                addListener() {},
                removeListener() {},
                dispatchEvent() {
                    return false
                }
            } as unknown as MediaQueryList
        }) as unknown as typeof window.matchMedia)

        Object.defineProperty(el, 'matches', { value: () => false })

        animateMock.mockClear()
        const cleanup = attachWhileTap(
            el,
            { scale: 0.8 },
            { scale: 1 },
            { scale: 1.1 },
            {
                hoverDef: { scale: 1.2 } as unknown as Record<string, unknown>
            }
        )
        const onPressEnd = pressCallback!(el, new PointerEvent('pointerdown'))
        await Promise.resolve()
        onPressEnd!(new PointerEvent('pointerup'), { success: true })
        await Promise.resolve()
        const last = animateMock.mock.calls.at(-1)
        expect(last?.[1]).toMatchObject({ scale: 1.1 })
        cleanup()
        vi.unstubAllGlobals()
    })

    it('attachWhileTap: safe reapply hover catch path when matches throws', async () => {
        const el = document.createElement('div') as HTMLElement & {
            matches: (_sel: string) => boolean
        }
        // Hover capable
        vi.stubGlobal('matchMedia', ((query: string) => {
            const matches = query.includes('(hover: hover)') || query.includes('(pointer: fine)')
            return {
                matches,
                media: query,
                onchange: null,
                addEventListener() {},
                removeEventListener() {},
                addListener() {},
                removeListener() {},
                dispatchEvent() {
                    return false
                }
            } as unknown as MediaQueryList
        }) as unknown as typeof window.matchMedia)

        // Throwing matches simulates environments where selector isn't supported
        Object.defineProperty(el, 'matches', {
            value: () => {
                throw new Error('nope')
            }
        })

        animateMock.mockClear()
        const cleanup = attachWhileTap(
            el,
            { scale: 0.8 },
            { scale: 1 },
            { scale: 1.1 },
            {
                hoverDef: { scale: 1.2 } as unknown as Record<string, unknown>
            }
        )
        const onPressEnd = pressCallback!(el, new PointerEvent('pointerdown'))
        await Promise.resolve()
        onPressEnd!(new PointerEvent('pointerup'), { success: true })
        await Promise.resolve()
        const last = animateMock.mock.calls.at(-1)
        // Baseline reapplied (not hover), because matches threw and catch returned false
        expect(last?.[1]).toMatchObject({ scale: 1.1 })
        cleanup()
        vi.unstubAllGlobals()
    })

    it('attachWhileTap: hover not reapplied on unsuccessful release', async () => {
        const el = document.createElement('div') as HTMLElement & {
            matches: (_sel: string) => boolean
        }
        vi.stubGlobal('matchMedia', ((query: string) => {
            const matches = query.includes('(hover: hover)') || query.includes('(pointer: fine)')
            return {
                matches,
                media: query,
                onchange: null,
                addEventListener() {},
                removeEventListener() {},
                addListener() {},
                removeListener() {},
                dispatchEvent() {
                    return false
                }
            } as unknown as MediaQueryList
        }) as unknown as typeof window.matchMedia)

        Object.defineProperty(el, 'matches', { value: (sel: string) => sel === ':hover' })

        animateMock.mockClear()
        const cleanup = attachWhileTap(
            el,
            { scale: 0.8 },
            { scale: 1 },
            { scale: 1.1 },
            {
                hoverDef: { scale: 1.2 } as unknown as Record<string, unknown>
            }
        )
        const onPressEnd = pressCallback!(el, new PointerEvent('pointerdown'))
        await Promise.resolve()
        // Release with success=false (cancelled / pointer left element)
        onPressEnd!(new PointerEvent('pointerup'), { success: false })
        await Promise.resolve()
        const last = animateMock.mock.calls.at(-1)
        // Baseline restored, not hover, because success was false
        expect(last?.[1]).toMatchObject({ scale: 1.1 })
        cleanup()
        vi.unstubAllGlobals()
    })

    it('attachWhileTap: Space key reapplies hover when still hovered', async () => {
        const el = document.createElement('div') as HTMLElement & {
            matches: (_sel: string) => boolean
        }
        vi.stubGlobal('matchMedia', ((query: string) => {
            const matches = query.includes('(hover: hover)') || query.includes('(pointer: fine)')
            return {
                matches,
                media: query,
                onchange: null,
                addEventListener() {},
                removeEventListener() {},
                addListener() {},
                removeListener() {},
                dispatchEvent() {
                    return false
                }
            } as unknown as MediaQueryList
        }) as unknown as typeof window.matchMedia)

        Object.defineProperty(el, 'matches', { value: (sel: string) => sel === ':hover' })

        animateMock.mockClear()
        const cleanup = attachWhileTap(
            el,
            { scale: 0.8 },
            { scale: 1 },
            { scale: 1.1 },
            {
                hoverDef: { scale: 1.2, transition: { duration: 0.12 } } as unknown as Record<
                    string,
                    unknown
                >
            }
        )

        // Space keydown → tap animate
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
        await Promise.resolve()
        // Space keyup → success, hover reapplied
        el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }))
        await Promise.resolve()
        const last = animateMock.mock.calls.at(-1)
        expect(last?.[1]).toMatchObject({ scale: 1.2 })
        // Uses releaseTransition (tween with overshoot) to prevent velocity accumulation
        expect(last?.[2]).toMatchObject({ duration: 0.3 })
        cleanup()
        vi.unstubAllGlobals()
    })
})
