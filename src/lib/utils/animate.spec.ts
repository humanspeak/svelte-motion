import { sleep } from '$lib/utils/testing'
import { fireEvent, render } from '@testing-library/svelte'
import { motionValue } from 'motion'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UseAnimateConfigHarness from '../components/__tests__/UseAnimateConfigHarness.svelte'
import UseAnimateSkipHarness from '../components/__tests__/UseAnimateSkipHarness.svelte'
import { animate, createEffect, type Timeline } from '../index.js'
import { type AnimationScope, useAnimate } from './animate.svelte.js'
import type { SvelteMotionAnimate } from './animateValue.js'

describe('utils/animate - useAnimate', () => {
    beforeEach(() => {
        vi.useRealTimers()
        ;(globalThis as never as { requestAnimationFrame: unknown }).requestAnimationFrame = (
            callback: FrameRequestCallback
        ) => setTimeout(() => callback(performance.now()), 16) as unknown as number
        ;(globalThis as never as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (
            id: number
        ) => clearTimeout(id)
    })

    it('does not throw when called outside a Svelte component', () => {
        expect(() => useAnimate()).not.toThrow()
    })

    it('returns a [scope, animate] tuple', () => {
        const [scope, animate] = useAnimate()
        expect(typeof scope).toBe('function')
        expect(typeof animate).toBe('function')
    })

    it('initialises scope with current=undefined and an empty animations array', () => {
        const [scope] = useAnimate()
        expect(scope.current).toBeUndefined()
        expect(Array.isArray(scope.animations)).toBe(true)
        expect(scope.animations).toHaveLength(0)
    })

    it('hydrates scope.current when invoked as an attachment', () => {
        const [scope] = useAnimate()
        const parent = document.createElement('ul')
        scope(parent)
        expect(scope.current).toBe(parent)
    })

    it('clears scope.current when the attachment cleanup runs', () => {
        const [scope] = useAnimate()
        const parent = document.createElement('ul')
        const cleanup = scope(parent)
        cleanup()
        expect(scope.current).toBeUndefined()
    })

    it('resolves string selectors against scope.current', () => {
        const [scope, animate] = useAnimate()
        const parent = document.createElement('ul')
        const li1 = document.createElement('li')
        const li2 = document.createElement('li')
        parent.append(li1, li2)
        document.body.append(parent)
        scope(parent)

        const animation = animate('li', { opacity: 0.5 }, { duration: 0.001 })
        expect(animation).toBeTruthy()
        expect(scope.animations.length).toBeGreaterThan(0)

        document.body.removeChild(parent)
    })

    it('stops in-flight animations and clears the list when the parent detaches', () => {
        const [scope, animate] = useAnimate()
        const parent = document.createElement('div')
        const child = document.createElement('span')
        parent.append(child)
        document.body.append(parent)
        const cleanup = scope(parent)

        const animation = animate('span', { opacity: 0.5 }, { duration: 10 })
        const stopSpy = vi.spyOn(animation, 'stop')

        cleanup()

        expect(stopSpy).toHaveBeenCalled()
        expect(scope.animations).toHaveLength(0)
        expect(scope.current).toBeUndefined()

        document.body.removeChild(parent)
    })

    it('animates element references directly (no scope hydration required)', () => {
        const [, animate] = useAnimate()
        const el = document.createElement('div')
        document.body.append(el)

        const animation = animate(el, { opacity: 0.5 }, { duration: 0.001 })
        expect(animation).toBeTruthy()

        document.body.removeChild(el)
    })

    it('supports animation sequences', () => {
        const [scope, animate] = useAnimate()
        const parent = document.createElement('div')
        const a = document.createElement('span')
        const b = document.createElement('span')
        a.classList.add('a')
        b.classList.add('b')
        parent.append(a, b)
        document.body.append(parent)
        scope(parent)

        const animation = animate(
            [
                ['.a', { opacity: 0.5 }, { duration: 0.001 }],
                ['.b', { opacity: 0.5 }, { duration: 0.001, at: '<' }]
            ],
            { duration: 0.01 }
        )
        expect(animation).toBeTruthy()

        document.body.removeChild(parent)
    })

    it('reattaching to a new parent updates scope.current', () => {
        const [scope] = useAnimate()
        const first = document.createElement('div')
        const second = document.createElement('div')

        const cleanupFirst = scope(first)
        expect(scope.current).toBe(first)
        cleanupFirst()

        scope(second)
        expect(scope.current).toBe(second)
    })

    it('does not carry the effect-registry statics on the scoped animate', () => {
        // Upstream's `createScopedAnimate()` returns a plain function with no
        // `addEffect`/`removeEffect`, and this wrapper adds none. The TYPE must
        // say the same, or `animate.addEffect(...)` compiles and then throws
        // `TypeError: animate.addEffect is not a function` at runtime.
        const [, animate] = useAnimate()

        expect((animate as unknown as Record<string, unknown>).addEffect).toBeUndefined()
        expect((animate as unknown as Record<string, unknown>).removeEffect).toBeUndefined()
    })

    it('reads the current MotionConfig skipAnimations value for each call', async () => {
        const { getByTestId, rerender } = render(UseAnimateSkipHarness, {
            props: { skip: false }
        })
        const target = getByTestId('use-animate-target')

        await rerender({ skip: true })
        expect(getByTestId('use-animate-target')).toBe(target)

        await fireEvent.click(getByTestId('run-use-animate'))
        await sleep(100)

        expect(Number.parseFloat(getComputedStyle(target).opacity)).toBe(1)
    })

    describe('useAnimate MotionConfig settings (upstream use-animate.ts @ v14.7.1)', () => {
        it('passes reducedMotion="always" to the animations it starts', async () => {
            const { getByTestId } = render(UseAnimateConfigHarness, {
                props: { reducedMotion: 'always' }
            })
            const box = getByTestId('box')

            await fireEvent.click(getByTestId('run-x'))
            await sleep(100)

            // Reduced motion makes positional keys instant…
            expect(box.style.transform).toContain('translateX(100px)')
            // …while opacity still tweens over its 2s duration.
            expect(Number.parseFloat(getComputedStyle(box).opacity)).toBeLessThan(1)
        })

        it('the scope always reflects the current MotionConfig settings', async () => {
            let captured: AnimationScope<HTMLDivElement> | undefined
            const { rerender } = render(UseAnimateConfigHarness, {
                props: {
                    reducedMotion: 'always',
                    skip: true,
                    onScope: (scope: AnimationScope<HTMLDivElement>) => (captured = scope)
                }
            })
            expect(captured).toBeDefined()

            // Upstream writes both onto the scope every render (use-animate.ts:23-24);
            // here they are read live, without any `animate` call.
            expect(captured!.reduceMotion).toBe(true)
            expect(captured!.skipAnimations).toBe(true)

            await rerender({ reducedMotion: 'never', skip: false })

            expect(captured!.reduceMotion).toBe(false)
            expect(captured!.skipAnimations).toBe(false)
        })

        it("outside a component, reduceMotion defaults to false like React's MotionConfig default", () => {
            const [scope] = useAnimate()

            expect(scope.reduceMotion).toBe(false)
            expect(scope.skipAnimations).toBeUndefined()
        })

        it('selector calls before the attachment fires throw, like upstream', () => {
            const [, animate] = useAnimate()

            // motion-dom resolveElements reads scope.current.querySelectorAll with no guard.
            expect(() => animate('li', { opacity: 1 })).toThrow(TypeError)

            const el = document.createElement('div')
            document.body.append(el)
            expect(() => animate(el, { opacity: 0.5 }, { duration: 0.01 })).not.toThrow()
            document.body.removeChild(el)
        })
    })

    describe('useAnimate timelines (Motion 14.7)', () => {
        const attachedScope = () => {
            const [scope, animate] = useAnimate()
            const parent = document.createElement('div')
            document.body.append(parent)
            const cleanup = scope(parent)
            return {
                scope,
                animate,
                detach: () => {
                    cleanup()
                    parent.remove()
                }
            }
        }

        it('segments added after it starts run, and detaching the scope stops them', async () => {
            // Upstream timeline.test.ts @ v14.7.1: "segments can be added after creation"
            // and "registers with a scope so it stops with it".
            const { scope, animate, detach } = attachedScope()
            const a = motionValue(0)
            const b = motionValue(0)

            const tl = animate([[a, 100, { duration: 0.2 }]])
            tl.add([b, 50, { duration: 0.2 }])
            // Upstream timeline.test.ts:27 @ v14.7.1: the added segment extends the timeline.
            expect(tl.duration).toBeCloseTo(0.4)
            await sleep(0)

            expect(scope.animations).toContain(tl)

            detach()
            await sleep(450)

            expect(b.get()).toBeLessThan(50)
            expect(scope.animations).toHaveLength(0)
        })

        it('segments can be offset from a label', () => {
            // Upstream #2204 (958a120bc, dda7afe82): relative label offsets.
            const { animate, detach } = attachedScope()
            const a = motionValue(0)
            const b = motionValue(0)

            const tl = animate(
                [
                    [a, 100, { duration: 1 }],
                    'mid',
                    [a, 200, { duration: 1 }],
                    [b, 50, { duration: 1, at: 'mid+0.5' }]
                ],
                { autoplay: false }
            )

            // 14.6.0 resolves the unknown label "mid+0.5" to the current time (end): 3.
            expect(tl.duration).toBe(2.5)
            expect(tl.getLabelTime('mid')).toBe(1)

            detach()
        })

        it('playTo() plays to a label and pauses', async () => {
            // Upstream timeline.test.ts @ v14.7.1: "playTo() plays to a label and pauses".
            const { animate, detach } = attachedScope()
            const a = motionValue(0)

            const tl = animate(
                [
                    [a, 100, { duration: 0.2, ease: 'linear' }],
                    'end',
                    [a, 200, { duration: 0.2, ease: 'linear' }]
                ],
                { autoplay: false, defaultTransition: { ease: 'linear' } }
            )
            tl.playTo('end')
            await sleep(400)

            expect(Math.abs(a.get() - 100)).toBeLessThanOrEqual(1)
            expect(tl.state).toBe('paused')

            detach()
        })

        it('MotionConfig skipAnimations reaches segments added later', async () => {
            // Upstream timeline.test.ts @ v14.7.1: "inherits skipAnimations from a useAnimate() scope".
            let animate: SvelteMotionAnimate | undefined
            render(UseAnimateConfigHarness, {
                props: { skip: true, onAnimate: (fn: SvelteMotionAnimate) => (animate = fn) }
            })
            const a = motionValue(0)
            const b = motionValue(0)

            const tl = animate!([[a, 100, { duration: 10 }]])
            tl.add([b, 50, { duration: 10 }])
            await sleep(100)

            expect(a.get()).toBe(100)
            expect(b.get()).toBe(50)
        })

        it('a MotionConfig change after the timeline is created reaches its next rebuild', async () => {
            // Timeline rebuilds read scope.skipAnimations (framer-motion timeline
            // index.ts:470-478 @ v14.7.1). Starts from `undefined`: options captured at
            // creation win over the scope, so false -> true would not reach Motion either.
            let animate: SvelteMotionAnimate | undefined
            const { rerender } = render(UseAnimateConfigHarness, {
                props: { onAnimate: (fn: SvelteMotionAnimate) => (animate = fn) }
            })
            const a = motionValue(0)
            const b = motionValue(0)

            const tl = animate!([[a, 100, { duration: 10 }]])
            await rerender({ skip: true })
            tl.add([b, 50, { duration: 10 }])
            await sleep(100)

            expect(b.get()).toBe(50)
        })

        it('onComplete fires when played in reverse without onReverseComplete', async () => {
            // Upstream animate.test.tsx @ v14.7.1 (2efca17cf): "onComplete fires when
            // played in reverse without onReverseComplete".
            const { animate, detach } = attachedScope()
            const out: number[] = []
            const onComplete = vi.fn()

            const c = animate(0, 100, {
                duration: 0.05,
                ease: 'linear',
                onUpdate: (v: number) => out.push(v),
                onComplete
            })
            c.time = c.duration
            c.speed = -1
            await c

            expect(onComplete).toHaveBeenCalledTimes(1)
            expect(out.at(-1)).toBe(0)

            detach()
        })
    })
})

/**
 * Compile-only: the scoped animate returned by `useAnimate()` must NOT expose
 * the effect-registry statics, which live only on the module-level `animate`.
 */
function typeAssertions() {
    const [, scopedAnimate] = useAnimate()

    // Call signatures are shared with the module-level `animate`.
    scopedAnimate('.box', { opacity: 0.5 }, { duration: 0.1 })

    // Motion 14.7: every call returns a mutable Timeline.
    const tl: Timeline = scopedAnimate('.box', { opacity: 0.5 })
    tl.add(['.box', { opacity: 1 }])

    const effect = createEffect<{ claimed: true }>(() => () => {}, {
        test: (s): s is { claimed: true } => Boolean((s as { claimed?: true })?.claimed),
        read: () => 0
    })

    // @ts-expect-error the scoped animate has no effect registry at runtime
    scopedAnimate.addEffect(effect)
    // @ts-expect-error the scoped animate has no effect registry at runtime
    scopedAnimate.removeEffect(effect)

    // …while the module-level `animate` does.
    animate.addEffect(effect)
    animate.removeEffect(effect)
}

// Compile-time only: referenced so the checker keeps it, and lint sees a use.
void typeAssertions
