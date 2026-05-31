import AnimationControlsHookProbe from '$lib/components/__tests__/AnimationControlsHookProbe.svelte'
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { animationControls, isAnimationControls } from './animationControls.svelte'

describe('animationControls', () => {
    it('detects controls using upstream-compatible start-function shape', () => {
        expect(isAnimationControls(animationControls())).toBe(true)
        expect(isAnimationControls({ start: () => undefined })).toBe(true)
        expect(isAnimationControls({ opacity: 1 })).toBe(false)
        expect(isAnimationControls(null)).toBe(false)
    })

    it('throws when start or set are called before mount', () => {
        const controls = animationControls()

        expect(() => controls.start({ opacity: 1 })).toThrow(
            'controls.start() should only be called after a component has mounted.'
        )
        expect(() => controls.set({ opacity: 1 })).toThrow(
            'controls.set() should only be called after a component has mounted.'
        )
    })

    it('fans start, set, and stop out to subscribers', async () => {
        const controls = animationControls()
        const first = {
            start: vi.fn(() => Promise.resolve('first')),
            set: vi.fn(),
            stop: vi.fn()
        }
        const second = {
            start: vi.fn(() => Promise.resolve('second')),
            set: vi.fn(),
            stop: vi.fn()
        }
        const cleanup = controls.mount()
        const unsubscribeFirst = controls.subscribe(first)
        controls.subscribe(second)

        await expect(controls.start('visible', { duration: 0.2 })).resolves.toEqual([
            'first',
            'second'
        ])
        expect(first.start).toHaveBeenCalledWith('visible', { duration: 0.2 })
        expect(second.start).toHaveBeenCalledWith('visible', { duration: 0.2 })

        controls.set({ opacity: 0.5 })
        expect(first.set).toHaveBeenCalledWith({ opacity: 0.5 })
        expect(second.set).toHaveBeenCalledWith({ opacity: 0.5 })

        unsubscribeFirst()
        controls.stop()
        expect(first.stop).not.toHaveBeenCalled()
        expect(second.stop).toHaveBeenCalledTimes(1)

        cleanup()
        expect(second.stop).toHaveBeenCalledTimes(2)
    })

    it('useAnimationControls mounts controls in the component lifecycle', async () => {
        let controls: ReturnType<typeof animationControls> | undefined

        render(AnimationControlsHookProbe, {
            props: {
                onReady: (next: ReturnType<typeof animationControls>) => {
                    controls = next
                }
            }
        })
        await tick()

        const subscriber = {
            start: vi.fn(() => Promise.resolve('mounted')),
            set: vi.fn(),
            stop: vi.fn()
        }
        controls!.subscribe(subscriber)

        await expect(controls!.start({ opacity: 1 })).resolves.toEqual(['mounted'])
        expect(subscriber.start).toHaveBeenCalledWith({ opacity: 1 }, undefined)
    })
})
