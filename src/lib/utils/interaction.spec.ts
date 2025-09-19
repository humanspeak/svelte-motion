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

    it('attachWhileTap: animates on down and restores on up', async () => {
        const el = document.createElement('div')
        animateMock.mockClear()
        const cleanup = attachWhileTap(
            el,
            { scale: 0.9, backgroundColor: '#f00' },
            { scale: 1, backgroundColor: '#111' },
            { scale: 1.1, backgroundColor: '#000' }
        )
        el.dispatchEvent(new PointerEvent('pointerdown'))
        await Promise.resolve()
        expect(animateMock).toHaveBeenCalled()
        const downCall = animateMock.mock.calls.at(-1)
        expect(downCall?.[1]).toMatchObject({ scale: 0.9, backgroundColor: '#f00' })

        el.dispatchEvent(new PointerEvent('pointerup'))
        await Promise.resolve()
        const upCall = animateMock.mock.calls.at(-1)
        expect(upCall?.[1]).toMatchObject({ scale: 1.1, backgroundColor: '#000' })
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
})
