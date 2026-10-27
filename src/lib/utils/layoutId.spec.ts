import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __layoutIdRegistrySize, holdLayoutIdHandoffs, layoutIdRegistry } from './layoutId'

/**
 * The `layoutId` handoff registry (plan 006).
 *
 * Upstream, an element whose `layoutId` is turned off and back on stays the
 * lead of its own shared-layout stack, so nothing animates on re-enable
 * (framer-motion `MeasureLayout.tsx` @ v14.2.0, 47-49 register / 154-155
 * deregister; motion-dom `NodeStack`). The registry entry the element wrote
 * when its `layoutId` turned off must not be consumed by that same element.
 */
describe('layoutIdRegistry', () => {
    const rect = new DOMRect(10, 20, 100, 50)

    it('hands an entry to a different element', () => {
        const departing = document.createElement('div')
        const arriving = document.createElement('div')
        layoutIdRegistry.snapshot('handoff', rect, {}, departing)

        expect(layoutIdRegistry.consume('handoff', arriving)?.rect).toBe(rect)
        expect(layoutIdRegistry.consume('handoff', arriving)).toBeUndefined()
    })

    it("doesn't let an element consume its own entry, and drops that entry", () => {
        const element = document.createElement('div')
        const other = document.createElement('div')
        layoutIdRegistry.snapshot('self', rect, {}, element)

        expect(layoutIdRegistry.consume('self', element)).toBeUndefined()
        // A stale self-entry must not animate a later arrival either: upstream
        // that arrival would animate from the element as it is now.
        expect(layoutIdRegistry.consume('self', other)).toBeUndefined()
    })

    it('still hands off entries written without an owner', () => {
        layoutIdRegistry.snapshot('anonymous', rect)

        expect(layoutIdRegistry.consume('anonymous')?.rect).toBe(rect)
    })
})

/**
 * Unconsumed entries are released after the handoff window, so unique
 * `layoutId`s don't keep detached elements alive forever. Upstream frees empty
 * shared stacks at the end of the update pass, not on unmount, because "a
 * replacement with the same layoutId mounting in the same commit resumes from
 * it" (motion-dom `create-projection-node.ts` `clearAllSnapshots` @ v14.5.0,
 * #3940; framer-motion `shared-layout-unmount-leak.test.tsx`).
 */
describe('layoutIdRegistry release', () => {
    const rect = new DOMRect(10, 20, 100, 50)

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'performance', 'setTimeout'] })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('released when unconsumed', () => {
        const departing = document.createElement('div')
        const other = document.createElement('div')
        layoutIdRegistry.snapshot('leak-a', rect, {}, departing)

        vi.advanceTimersByTime(200)

        expect(layoutIdRegistry.consume('leak-a', other)).toBeUndefined()
    })

    it('size stays bounded', () => {
        for (let i = 0; i < 50; i++) {
            layoutIdRegistry.snapshot(`unique-${i}`, rect, {}, document.createElement('div'))
        }

        vi.advanceTimersByTime(200)

        expect(__layoutIdRegistrySize()).toBe(0)
    })

    it('same-window handoff still works', () => {
        const departing = document.createElement('div')
        const other = document.createElement('div')
        layoutIdRegistry.snapshot('swap', rect, {}, departing)

        vi.advanceTimersByTime(50)

        expect(layoutIdRegistry.consume('swap', other)?.rect).toBe(rect)
    })

    it('hold defers release', () => {
        const before = __layoutIdRegistrySize()
        const release = holdLayoutIdHandoffs()
        layoutIdRegistry.snapshot('held', rect, {}, document.createElement('div'))

        vi.advanceTimersByTime(1000)
        expect(__layoutIdRegistrySize()).toBe(before + 1)

        release()
        vi.advanceTimersByTime(200)
        expect(__layoutIdRegistrySize()).toBe(0)
    })

    it('has reports an entry without consuming it', () => {
        const departing = document.createElement('div')
        const other = document.createElement('div')
        layoutIdRegistry.snapshot('peek', rect, {}, departing)

        expect(layoutIdRegistry.has('peek')).toBe(true)
        expect(layoutIdRegistry.has('peek')).toBe(true)
        expect(layoutIdRegistry.consume('peek', other)?.rect).toBe(rect)
        expect(layoutIdRegistry.has('peek')).toBe(false)
    })

    it('has is false after the release window', () => {
        layoutIdRegistry.snapshot('peek-stale', rect, {}, document.createElement('div'))
        expect(layoutIdRegistry.has('peek-stale')).toBe(true)

        vi.advanceTimersByTime(200)

        expect(layoutIdRegistry.has('peek-stale')).toBe(false)
    })
})
