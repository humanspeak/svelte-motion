import { describe, expect, it, vi } from 'vitest'
import { animateWithLifecycle, mergeTransitions } from './animation.js'

vi.mock('motion', () => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { animate: animateMock }
})
const { animate: animateMock } = (await import('motion')) as unknown as {
    animate: ReturnType<typeof vi.fn> & { mockClear: () => void; mock: { calls: unknown[][] } }
}

describe('utils/animation', () => {
    it('mergeTransitions: local overrides root; handles undefined inputs', () => {
        expect(mergeTransitions(undefined, undefined)).toEqual({})
        expect(mergeTransitions({ duration: 0.2 }, undefined)).toEqual({ duration: 0.2 })
        expect(mergeTransitions(undefined, { duration: 0.3 })).toEqual({ duration: 0.3 })
        expect(mergeTransitions({ duration: 0.2 }, { duration: 0.3, ease: 'linear' })).toEqual({
            duration: 0.3,
            ease: 'linear'
        })
    })

    it('animateWithLifecycle: calls onStart and onComplete with payload', async () => {
        const el = document.createElement('div')
        const onStart = vi.fn()
        const onComplete = vi.fn()
        animateMock.mockClear()

        const frames = { opacity: 1 }
        animateWithLifecycle(el, frames as unknown as import('motion').DOMKeyframesDefinition, {
            duration: 0.1
        })

        animateWithLifecycle(
            el,
            frames as unknown as import('motion').DOMKeyframesDefinition,
            { duration: 0.1 },
            onStart,
            onComplete
        )
        await Promise.resolve()

        expect(onStart).toHaveBeenCalledWith(frames)
        expect(onComplete).toHaveBeenCalledWith(frames)
        expect(animateMock).toHaveBeenCalled()
    })
})
