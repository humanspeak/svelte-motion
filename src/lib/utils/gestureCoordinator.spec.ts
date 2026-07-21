import { describe, expect, it, vi } from 'vitest'
import { createGestureCoordinator } from './gestureCoordinator'

describe('createGestureCoordinator', () => {
    it('tracks active gesture types independently', () => {
        const coordinator = createGestureCoordinator()
        expect(coordinator.isActive('hover')).toBe(false)
        expect(coordinator.isActive('tap')).toBe(false)

        coordinator.setActive('hover', true)
        coordinator.setActive('tap', true)
        expect(coordinator.isActive('hover')).toBe(true)
        expect(coordinator.isActive('tap')).toBe(true)

        coordinator.setActive('hover', false)
        expect(coordinator.isActive('hover')).toBe(false)
        expect(coordinator.isActive('tap')).toBe(true)
    })

    it('stopAll stops every registered animation exactly once', () => {
        const coordinator = createGestureCoordinator()
        const first = vi.fn()
        const second = vi.fn()
        coordinator.register(first)
        coordinator.register(second)

        coordinator.stopAll()
        expect(first).toHaveBeenCalledTimes(1)
        expect(second).toHaveBeenCalledTimes(1)

        // Registry is cleared — a second sweep must not re-stop.
        coordinator.stopAll()
        expect(first).toHaveBeenCalledTimes(1)
        expect(second).toHaveBeenCalledTimes(1)
    })

    it('unregister removes a completed animation from the registry', () => {
        const coordinator = createGestureCoordinator()
        const stop = vi.fn()
        const unregister = coordinator.register(stop)
        unregister()

        coordinator.stopAll()
        expect(stop).not.toHaveBeenCalled()
    })

    it('survives a stopper that throws and still stops the rest', () => {
        const coordinator = createGestureCoordinator()
        const throwing = vi.fn(() => {
            throw new Error('already finished')
        })
        const healthy = vi.fn()
        coordinator.register(throwing)
        coordinator.register(healthy)

        expect(() => coordinator.stopAll()).not.toThrow()
        expect(healthy).toHaveBeenCalledTimes(1)
    })
})
