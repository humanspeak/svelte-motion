import { describe, expect, it } from 'vitest'
import { layoutIdRegistry } from './layoutId'

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
