import { createEffect } from '$lib'
import { addEffect, findEffect, removeEffect } from 'motion-dom'
import { describe, expect, it } from 'vitest'
import { dialEffect } from './dialEffect.js'

/**
 * `animate.addEffect()` writes to a process-global registry that dedupes by
 * effect identity and does NOT reference-count. Registering an effect from a
 * component's lifecycle is therefore unsafe: with two components sharing one
 * effect, the first teardown unregisters it for everyone still mounted, and
 * subsequent `animate()` calls silently fall back to the plain-object
 * animator instead of throwing.
 *
 * These tests pin both halves: the upstream semantics that make per-component
 * registration wrong, and the rule the demos follow because of it.
 */
describe('utils/effectRegistry - registration ownership', () => {
    it('unregisters a shared effect after a single remove, with no reference counting', () => {
        const scratch = createEffect<{ scratch: true }>(() => () => {}, {
            test: (s): s is { scratch: true } => Boolean((s as { scratch?: true })?.scratch),
            read: () => 0
        })
        const subject = { scratch: true } as const

        addEffect(scratch) // consumer A registers
        addEffect(scratch) // consumer B registers the same effect
        expect(findEffect(subject)).toBe(scratch)

        removeEffect(scratch) // consumer A unmounts
        expect(findEffect(subject)).toBeUndefined() // …and B is now broken
    })

    it('registers the demo effect at module scope so no component owns it', () => {
        // Importing the effect module is enough: nothing about mounting or
        // unmounting a component may change this.
        expect(findEffect({ angle: 0, radius: 40 })).toBe(dialEffect)
    })
})
