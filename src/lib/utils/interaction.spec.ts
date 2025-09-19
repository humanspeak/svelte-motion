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
})
