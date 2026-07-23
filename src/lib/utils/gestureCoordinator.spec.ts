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

    it('records owned keys on activate and clears them on deactivate', () => {
        const coordinator = createGestureCoordinator()
        expect([...coordinator.ownedKeys('tap')]).toEqual([])

        coordinator.setActive('tap', true, ['scale'])
        expect([...coordinator.ownedKeys('tap')]).toEqual(['scale'])

        coordinator.setActive('tap', false)
        expect([...coordinator.ownedKeys('tap')]).toEqual([])
    })

    it('activating without keys owns nothing new (backward compatible)', () => {
        const coordinator = createGestureCoordinator()
        coordinator.setActive('tap', true)
        expect(coordinator.isActive('tap')).toBe(true)
        expect([...coordinator.ownedKeys('tap')]).toEqual([])
        // A key-less tap protects nothing, so hover keeps every key.
        expect(coordinator.isKeyProtected('scale', 'hover')).toBe(false)
    })

    it('protects a key only for lower-priority gestures (priority-directional)', () => {
        const coordinator = createGestureCoordinator()
        coordinator.setActive('tap', true, ['scale'])
        coordinator.setActive('hover', true, ['opacity'])

        // tap outranks hover: tap's `scale` is protected from hover…
        expect(coordinator.isKeyProtected('scale', 'hover')).toBe(true)
        // …but hover's `opacity` is NOT protected from the higher-priority tap.
        expect(coordinator.isKeyProtected('opacity', 'tap')).toBe(false)
        // Disjoint keys tap doesn't own stay unprotected from hover.
        expect(coordinator.isKeyProtected('opacity', 'hover')).toBe(false)
    })

    it('stops protecting a key once the owning gesture deactivates', () => {
        const coordinator = createGestureCoordinator()
        coordinator.setActive('tap', true, ['scale'])
        expect(coordinator.isKeyProtected('scale', 'hover')).toBe(true)

        coordinator.setActive('tap', false)
        expect(coordinator.isKeyProtected('scale', 'hover')).toBe(false)
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
