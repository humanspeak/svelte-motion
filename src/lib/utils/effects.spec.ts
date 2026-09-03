import { createEffect as createEffectCore } from 'motion'
import { describe, expect, it } from 'vitest'
import {
    animate,
    attrEffect,
    createEffect,
    motionValue,
    propEffect,
    styleEffect,
    svgEffect,
    type Effect
} from '../index.js'
import { threeEffect } from '../three.js'
import { vgpuEffect } from '../vgpu.js'

/**
 * Consumer-style surface fixture for the element effects and the Motion 13.2
 * effect registry.
 *
 * Everything here imports from the package ENTRY and binds values from this
 * package's own `motionValue()` factory — exactly what a consumer writes.
 * The package promises that augmented values need no casts, but nothing
 * enforced that promise: each upstream surface is re-typed by hand as it is
 * adopted, so a missed one stayed invisible until someone copied a docs
 * snippet. This file is that enforcement.
 *
 * `typeAssertions` is compile-only, validated by `pnpm check`.
 */
describe('utils/effects - public effect surface', () => {
    it("re-exports motion's createEffect (pure re-type, no runtime wrapper)", () => {
        expect(createEffect).toBe(createEffectCore)
    })

    it('binds a value to a subject and exposes it through get()', () => {
        type Dial = { angle: number }
        const dialEffect = createEffect<Dial>((dial, state, key, value) =>
            state.set(
                key,
                value,
                () => {
                    ;(dial as Record<string, number>)[key] = state.latest[key] as number
                },
                undefined,
                false
            )
        )

        const dial: Dial = { angle: 0 }
        const angle = motionValue(0)
        const unbind = dialEffect(dial, { angle })

        expect(dialEffect.get(dial, 'angle')).toBe(angle)

        unbind()
        expect(dialEffect.get(dial, 'angle')).toBeUndefined()

        angle.destroy()
    })
})

/**
 * Compile-only: every exported effect entry point must accept the augmented
 * motion values this package produces, with no cast at the call site.
 */
function typeAssertions() {
    const num = motionValue(0)
    const str = motionValue('0px')
    const el = document.createElement('div')

    // Element effects.
    styleEffect(el, { opacity: num, backgroundColor: str })
    attrEffect(el, { r: num })
    svgEffect(el, { pathLength: num })
    propEffect({ volume: 0 }, { volume: num })

    // Adapter subpaths.
    threeEffect({}, { rotateY: num })
    vgpuEffect({}, { rotateY: num })

    // Effects a consumer builds with the re-exported `createEffect`.
    type Dial = { angle: number }
    const dialEffect = createEffect<Dial>(
        (dial, state, key, value) =>
            state.set(
                key,
                value,
                () => {
                    ;(dial as Record<string, number>)[key] = state.latest[key] as number
                },
                undefined,
                false
            ),
        {
            test: (subject): subject is Dial =>
                typeof subject === 'object' && subject !== null && 'angle' in subject,
            read: (dial, key) => (dial as Record<string, number>)[key]
        }
    )

    dialEffect({ angle: 0 }, { angle: num })
    animate.addEffect(dialEffect)

    // The exported `Effect` type must accept them too.
    const asEffect: Effect<Dial> = dialEffect
    asEffect({ angle: 0 }, { angle: num })
}

// Compile-time only: referenced so the checker keeps it, and lint sees a use.
void typeAssertions
