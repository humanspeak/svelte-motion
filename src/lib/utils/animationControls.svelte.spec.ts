import { flushSync } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { animationControls } from './animationControls.svelte'

const createSubscriber = () => ({
    start: vi.fn(() => Promise.resolve()),
    set: vi.fn(),
    stop: vi.fn()
})

describe('animationControls inside an $effect', () => {
    it('does not re-run an effect that calls start when a component subscribes', () => {
        const controls = animationControls()
        const first = createSubscriber()
        const second = createSubscriber()
        const cleanup = controls.mount()
        controls.subscribe(first)

        let runs = 0
        const stop = $effect.root(() => {
            $effect(() => {
                runs += 1
                void controls.start({ opacity: 1 })
            })
        })
        flushSync()

        expect(runs).toBe(1)
        expect(first.start).toHaveBeenCalledTimes(1)

        controls.subscribe(second)
        flushSync()

        expect(runs).toBe(1)
        expect(first.start).toHaveBeenCalledTimes(1)
        expect(second.start).not.toHaveBeenCalled()

        stop()
        cleanup()
    })

    it('does not re-run an effect that calls start when a component unsubscribes', () => {
        const controls = animationControls()
        const first = createSubscriber()
        const second = createSubscriber()
        const cleanup = controls.mount()
        const unsubscribeFirst = controls.subscribe(first)
        controls.subscribe(second)

        let runs = 0
        const stop = $effect.root(() => {
            $effect(() => {
                runs += 1
                void controls.start({ opacity: 1 })
            })
        })
        flushSync()

        expect(runs).toBe(1)
        expect(second.start).toHaveBeenCalledTimes(1)

        unsubscribeFirst()
        flushSync()

        expect(runs).toBe(1)
        expect(second.start).toHaveBeenCalledTimes(1)

        stop()
        cleanup()
    })

    it('does not re-run an effect that calls set when a component subscribes', () => {
        const controls = animationControls()
        const first = createSubscriber()
        const second = createSubscriber()
        const cleanup = controls.mount()
        controls.subscribe(first)

        let runs = 0
        const stop = $effect.root(() => {
            $effect(() => {
                runs += 1
                controls.set({ opacity: 1 })
            })
        })
        flushSync()

        expect(runs).toBe(1)
        expect(first.set).toHaveBeenCalledTimes(1)

        controls.subscribe(second)
        flushSync()

        expect(runs).toBe(1)
        expect(first.set).toHaveBeenCalledTimes(1)
        expect(second.set).not.toHaveBeenCalled()

        stop()
        cleanup()
    })

    it('does not re-run an effect that calls stop when a component subscribes', () => {
        const controls = animationControls()
        const first = createSubscriber()
        const second = createSubscriber()
        const cleanup = controls.mount()
        controls.subscribe(first)

        let runs = 0
        const stop = $effect.root(() => {
            $effect(() => {
                runs += 1
                controls.stop()
            })
        })
        flushSync()

        expect(runs).toBe(1)
        expect(first.stop).toHaveBeenCalledTimes(1)

        controls.subscribe(second)
        flushSync()

        expect(runs).toBe(1)
        expect(first.stop).toHaveBeenCalledTimes(1)
        expect(second.stop).not.toHaveBeenCalled()

        stop()
        cleanup()
    })
})
