import { createEffect as createEffectCore } from 'motion'
import { frameData, frameSteps } from 'motion-dom'
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
            state.set(key, value, () => {
                ;(dial as Record<string, number>)[key] = value.get() as number
            })
        )

        const dial: Dial = { angle: 0 }
        const angle = motionValue(0)
        const unbind = dialEffect(dial, { angle })

        expect(dialEffect.get(dial, 'angle')).toBe(angle)
        expect(dialEffect.state(dial)?.get('angle')).toBe(angle)

        angle.set(90)
        dialEffect.flush(dial)
        expect(dial.angle).toBe(90)

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
            state.set(key, value, () => {
                ;(dial as Record<string, number>)[key] = value.get() as number
            }),
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

/**
 * Motion 13.5.1 routes SVG transforms and origins through CSS style. Keys that
 * are not CSS properties (e.g. `scaleX`, `originX`) were written as SVG
 * attributes before 13.5.1; `attrX`/`attrY` still write attributes.
 */
describe('utils/effects - svgEffect routing (Motion 13.5.1)', () => {
    // jsdom has no requestAnimationFrame when motion-dom loads, so its frameloop
    // never self-schedules; drive one batch by hand.
    const flushFrames = () => {
        frameSteps.setup.process(frameData)
        frameSteps.read.process(frameData)
        frameSteps.resolveKeyframes.process(frameData)
        frameSteps.preUpdate.process(frameData)
        frameSteps.update.process(frameData)
        frameSteps.preRender.process(frameData)
        frameSteps.render.process(frameData)
        frameSteps.postRender.process(frameData)
    }

    it('writes scaleX as a CSS transform, not an attribute', () => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        const stop = svgEffect(rect, { scaleX: motionValue(2) })
        flushFrames()
        expect(rect.getAttribute('scaleX')).toBeNull()
        expect(rect.style.transform).toContain('scaleX(2)')
        stop()
    })

    it('writes originX as CSS transform-origin, not an attribute', () => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        const stop = svgEffect(rect, { originX: motionValue(0.5) })
        flushFrames()
        expect(rect.getAttribute('originX')).toBeNull()
        expect(rect.style.transformOrigin).toContain('50%')
        stop()
    })

    it('control (unchanged): x is a CSS property and writes translateX', () => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        const stop = svgEffect(rect, { x: motionValue(10) })
        flushFrames()
        expect(rect.getAttribute('x')).toBeNull()
        expect(rect.style.transform).toContain('translateX(10px)')
        stop()
    })

    it('writes attrX as the x attribute', () => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        const stop = svgEffect(rect, { attrX: motionValue(5) })
        flushFrames()
        expect(rect.getAttribute('x')).toBe('5px')
        stop()
    })
})
