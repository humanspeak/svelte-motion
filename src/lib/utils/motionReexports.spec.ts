import {
    animateMini as animateMiniCore,
    inertia as inertiaCore,
    keyframes as keyframesCore,
    resolveElements as resolveElementsCore
} from 'motion'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animate, animateMini, inertia, keyframes, resolveElements, useAnimate } from '../index.js'
import { motionValue } from './vanillaValues.svelte.js'

/**
 * Plan 014 re-exports Motion's public, framework-agnostic generators and
 * helpers unchanged. Each describe locks runtime identity with `motion`'s
 * binding (no wrapper) and the behaviour measured against Motion 14.7.1.
 */
beforeEach(() => {
    vi.useRealTimers()
    ;(globalThis as never as { requestAnimationFrame: unknown }).requestAnimationFrame = (
        callback: FrameRequestCallback
    ) => setTimeout(() => callback(performance.now()), 16) as unknown as number
    ;(globalThis as never as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (
        id: number
    ) => clearTimeout(id)
})

// Upstream: motion-dom/src/animation/generators/inertia.ts @ v14.7.1
describe('inertia (motion-dom generators/inertia.ts @ v14.7.1)', () => {
    it("is motion's inertia", () => {
        expect(inertia).toBe(inertiaCore)
    })

    it('decelerates to origin + power × velocity', () => {
        const g = inertia({ keyframes: [0], velocity: 1000 })
        expect(g.next(0).value).toBe(0)
        const mid = g.next(100).value
        expect(mid).toBeGreaterThan(0)
        expect(mid).toBeLessThan(800)
        expect(g.next(5000)).toEqual({ value: 800, done: true })
    })

    it('springs back inside max', () => {
        const g = inertia({
            keyframes: [0],
            velocity: 1000,
            max: 300,
            bounceStiffness: 500,
            bounceDamping: 40
        })
        let state = g.next(0)
        for (let t = 16; !state.done && t <= 10000; t += 16) {
            state = g.next(t)
        }
        expect(state.done).toBe(true)
        expect(state.value).toBeCloseTo(300, 1)
    })

    it("works as a transition type, same as 'inertia'", async () => {
        const a = motionValue(0)
        const b = motionValue(0)
        await animate(a, [0], { type: inertia, velocity: 1000, power: 0.5 })
        await animate(b, [0], { type: 'inertia', velocity: 1000, power: 0.5 })
        expect(a.get()).toBeCloseTo(500, 0)
        expect(a.get()).toBe(b.get())
    })
})

// Upstream: motion-dom/src/animation/generators/keyframes.ts @ v14.7.1
describe('keyframes (motion-dom generators/keyframes.ts @ v14.7.1)', () => {
    it("is motion's keyframes", () => {
        expect(keyframes).toBe(keyframesCore)
    })

    it('samples an eased tween', () => {
        const g = keyframes({ keyframes: [0, 100], duration: 1000 })
        expect(g.next(0).value).toBe(0)
        expect(g.next(500).value).toBe(50)
        expect(g.next(1000)).toEqual({ value: 100, done: true })
    })

    it('honours ease', () => {
        const g = keyframes({ keyframes: [0, 100], duration: 1000, ease: 'linear' })
        expect(g.next(250).value).toBe(25)
    })

    it('works as a transition type', async () => {
        const mv = motionValue(0)
        await animate(mv, 100, { type: keyframes, duration: 0.2 })
        expect(mv.get()).toBe(100)
    })
})

// Upstream: motion-dom/src/utils/resolve-elements.ts @ v14.7.1
describe('resolveElements (motion-dom utils/resolve-elements.ts @ v14.7.1)', () => {
    let fixture: HTMLDivElement

    beforeEach(() => {
        fixture = document.createElement('div')
        fixture.innerHTML =
            '<div id="outside"><li></li></div><ul id="scope"><li></li><li></li></ul>'
        document.body.appendChild(fixture)
    })

    afterEach(() => {
        fixture.remove()
    })

    it("is motion's resolveElements", () => {
        expect(resolveElements).toBe(resolveElementsCore)
    })

    it('resolves selectors against the whole document by default', () => {
        expect(resolveElements('li')).toHaveLength(3)
    })

    it('limits selectors to a scope', () => {
        const scope = { current: document.getElementById('scope'), animations: [] }
        expect(resolveElements('li', scope)).toHaveLength(2)
    })

    it('accepts the useAnimate scope', () => {
        const [scope] = useAnimate<HTMLUListElement>()
        const detach = scope(document.getElementById('scope') as HTMLUListElement)
        expect(resolveElements('li', scope)).toHaveLength(2)
        if (typeof detach === 'function') detach()
    })

    it('normalises empties and lists', () => {
        const el = document.getElementById('outside') as HTMLElement
        const el2 = document.getElementById('scope') as HTMLElement
        expect(resolveElements(null)).toEqual([])
        expect(resolveElements(undefined)).toEqual([])
        expect(resolveElements([el, null as never, el2])).toEqual([el, el2])
        expect(resolveElements(el)).toEqual([el])
    })
})

// Upstream: framer-motion/src/animation/animators/waapi/animate-style.ts @ v14.7.1
describe('animateMini (framer-motion animators/waapi/animate-style.ts @ v14.7.1)', () => {
    it("is motion's animateMini", () => {
        // jsdom has no Web Animations API (Element.prototype.animate), so only
        // identity is unit-tested; e2e/utilities/motion-reexports.spec.ts covers
        // the behaviour in a real browser.
        expect(animateMini).toBe(animateMiniCore)
        expect(typeof animateMini).toBe('function')
    })
})
