import { describe, expect, it, vi } from 'vitest'
import { attachWhileTap, buildTapResetRecord } from './interaction.js'

vi.mock('motion', () => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { animate: animateMock }
})
const { animate: animateMock } = (await import('motion')) as unknown as {
    animate: ReturnType<typeof vi.fn> & { mockClear: () => void; mock: { calls: unknown[][] } }
}

describe('utils/interaction', () => {
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

    it('buildTapResetRecord: negative - returns empty when no overlapping keys', () => {
        const reset = buildTapResetRecord({ a: 1 }, { b: 2 }, { c: 3 })
        expect(Object.keys(reset)).toHaveLength(0)
    })

    it('attachWhileTap: animates on down and restores on up, fires callbacks', async () => {
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
        el.dispatchEvent(new PointerEvent('pointerdown'))
        await Promise.resolve()
        expect(animateMock).toHaveBeenCalled()
        const downCall = animateMock.mock.calls.at(-1)
        expect(downCall?.[1]).toMatchObject({ scale: 0.9, backgroundColor: '#f00' })
        expect(onTapStart).toHaveBeenCalledTimes(1)

        el.dispatchEvent(new PointerEvent('pointerup'))
        await Promise.resolve()
        const upCall = animateMock.mock.calls.at(-1)
        expect(upCall?.[1]).toMatchObject({ scale: 1.1, backgroundColor: '#000' })
        expect(onTap).toHaveBeenCalledTimes(1)
        cleanup()
    })

    it('attachWhileTap: negative - no-op when whileTap is undefined', () => {
        const el = document.createElement('div')
        const cleanup = attachWhileTap(el, undefined)
        expect(typeof cleanup).toBe('function')
        // no listeners added, simulate events should not call animate
        animateMock.mockClear()
        el.dispatchEvent(new PointerEvent('pointerdown'))
        el.dispatchEvent(new PointerEvent('pointerup'))
        expect(animateMock).not.toHaveBeenCalled()
        cleanup()
    })

    it('attachWhileTap: pointercancel path and no baseline available (fires cancel)', async () => {
        const el = document.createElement('div')
        animateMock.mockClear()
        const onTapCancel = vi.fn()
        const cleanup = attachWhileTap(el, { scale: 0.95 }, undefined, undefined, { onTapCancel })
        el.dispatchEvent(new PointerEvent('pointerdown'))
        await Promise.resolve()
        expect(animateMock).toHaveBeenCalled()
        el.dispatchEvent(new PointerEvent('pointercancel'))
        await Promise.resolve()
        // No additional animate call because no baseline keys computed
        expect(onTapCancel).toHaveBeenCalledTimes(1)
        cleanup()
    })

    it('attachWhileTap: pointercancel restores baseline when available', async () => {
        const el = document.createElement('div')
        animateMock.mockClear()
        const cleanup = attachWhileTap(el, { scale: 0.95 }, { scale: 1 }, { scale: 1.1 })
        el.dispatchEvent(new PointerEvent('pointerdown'))
        await Promise.resolve()
        el.dispatchEvent(new PointerEvent('pointercancel'))
        await Promise.resolve()
        const last = animateMock.mock.calls.at(-1)
        expect(last?.[1]).toMatchObject({ scale: 1.1 })
        cleanup()
    })

    it('attachWhileTap: keyboard Enter press triggers start/up/cancel on blur', async () => {
        const el = document.createElement('div')
        animateMock.mockClear()
        const onTapStart = vi.fn()
        const onTap = vi.fn()
        const onTapCancel = vi.fn()
        const cleanup = attachWhileTap(
            el,
            { scale: 0.9 },
            { scale: 1 },
            { scale: 1.1 },
            { onTapStart, onTap, onTapCancel }
        )

        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
        await Promise.resolve()
        expect(onTapStart).toHaveBeenCalledTimes(1)
        expect(animateMock).toHaveBeenCalled()

        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }))
        await Promise.resolve()
        expect(onTap).toHaveBeenCalledTimes(1)

        // Start again and then blur to cancel
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
        await Promise.resolve()
        el.dispatchEvent(new FocusEvent('blur'))
        await Promise.resolve()
        expect(onTapCancel).toHaveBeenCalledTimes(1)
        cleanup()
    })

    it('attachWhileTap: re-applies hover on pointerup when element is still hovered', async () => {
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

        // down → whileTap
        el.dispatchEvent(new PointerEvent('pointerdown'))
        await Promise.resolve()
        // up → hover reapplied (not baseline)
        el.dispatchEvent(new PointerEvent('pointerup'))
        await Promise.resolve()
        const last = animateMock.mock.calls.at(-1)
        expect(last?.[1]).toMatchObject({ scale: 1.2 })
        expect(last?.[2]).toMatchObject({ duration: 0.12 })
        cleanup()
        vi.unstubAllGlobals()
    })

    it('attachWhileTap: when not hovered on pointerup, restores baseline (not hover)', async () => {
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
        el.dispatchEvent(new PointerEvent('pointerdown'))
        await Promise.resolve()
        el.dispatchEvent(new PointerEvent('pointerup'))
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
        el.dispatchEvent(new PointerEvent('pointerdown'))
        await Promise.resolve()
        el.dispatchEvent(new PointerEvent('pointerup'))
        await Promise.resolve()
        const last = animateMock.mock.calls.at(-1)
        // Baseline reapplied (not hover), because matches threw and catch returned false
        expect(last?.[1]).toMatchObject({ scale: 1.1 })
        cleanup()
        vi.unstubAllGlobals()
    })

    it('attachWhileTap: early returns and guards (no whileTap, keyboard already active)', async () => {
        const el = document.createElement('div')
        // No whileTap → cleanup still returned
        const cleanup = attachWhileTap(el, undefined)
        expect(typeof cleanup).toBe('function')

        // With whileTap, pressing Enter twice should guard the second keydown
        const cleanup2 = attachWhileTap(el, { scale: 0.9 })
        animateMock.mockClear()
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
        await Promise.resolve()
        // Only one animate on double keydown
        expect(animateMock.mock.calls.filter((c) => !!c).length).toBe(1)
        // Releasing with non-Enter key should be ignored
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape' }))
        await Promise.resolve()
        cleanup()
        cleanup2()
    })
})
