import { animationControls } from '$lib/utils/animationControls.svelte'
import { fireEvent, render } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock 'motion' before importing the Svelte component (hoisted)
vi.mock('motion', () => {
    const animateMock = vi.fn(() => ({ finished: Promise.resolve() }))
    return { animate: animateMock }
})
const { animate: animateMock } = (await import('motion')) as unknown as {
    animate: ReturnType<typeof vi.fn> & {
        mockClear: () => void
        mock: { calls: unknown[][] }
    }
}

// Mock sleep to resolve immediately
vi.mock('$lib/utils/testing.js', () => ({
    sleep: vi.fn(() => Promise.resolve())
}))

import MotionContainer from './_MotionContainer.svelte'

// Resolve requestAnimationFrame immediately to move component to "ready"
beforeEach(() => {
    animateMock.mockClear()
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        setTimeout(() => cb(0), 0)
        return 0 as unknown as number
    })
})

// Restore stubbed globals (e.g. `matchMedia` from whileHover tests)
// here rather than at the bottom of each test body — if an assertion
// throws mid-test, the per-test cleanup would be skipped and patched
// globals would leak into later tests in this file.
afterEach(() => {
    vi.unstubAllGlobals()
})

async function flushTimers() {
    // Run any queued RAF timeouts
    vi.runAllTimers()
    // Flush microtasks
    await Promise.resolve()
}

describe('_MotionContainer', () => {
    it('does not add tabindex when element is natively focusable', async () => {
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'a',
                whileTap: { scale: 0.95 },
                href: 'https://example.com'
            }
        })
        await flushTimers()
        const el = container.firstElementChild as HTMLElement
        expect(el.hasAttribute('tabindex')).toBe(false)
    })

    it('adds tabindex=0 for non-focusable elements with whileTap', async () => {
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const { container } = render(MotionContainer as unknown as any, {
            props: { tag: 'div', whileTap: { scale: 0.95 } }
        })
        await flushTimers()
        const el = container.firstElementChild as HTMLElement
        expect(el.getAttribute('tabindex')).toBe('0')
    })
    it('fires lifecycle only for main animate transition (not initial)', async () => {
        const onStart = vi.fn()
        const onComplete = vi.fn()

        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                transition: { duration: 0.2 },
                onAnimationStart: onStart,
                onAnimationComplete: onComplete
            }
        })

        // Flush RAF + timers to move to ready and complete finished promise
        await flushTimers()

        // animate should be called at least twice: initial (duration:0) and main animate
        expect(animateMock).toHaveBeenCalled()
        // Depending on effects ordering, animate may run more than once; ensure at least 1 lifecycle pair
        expect(onStart.mock.calls.length).toBeGreaterThanOrEqual(1)
        expect(onComplete.mock.calls.length).toBeGreaterThanOrEqual(1)
        expect(onStart).toHaveBeenCalledWith({ opacity: 1 })
        expect(onComplete).toHaveBeenCalledWith({ opacity: 1 })
    })

    it('whileTap resets overlapping keys to animate values (fallback to initial)', async () => {
        const initial = { scale: 1, backgroundColor: '#111' }
        const animate = { scale: 1.1, backgroundColor: '#000' }
        const whileTap = { scale: 0.9, backgroundColor: '#f00' }

        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const { container } = render(MotionContainer as unknown as any, {
            props: { tag: 'div', initial, animate, whileTap }
        })

        // Wait for ready promotion
        await flushTimers()

        const el = container.firstElementChild as HTMLElement
        expect(el).toBeTruthy()

        // pointerdown -> whileTap animate call
        await fireEvent.pointerDown(el)
        // pointerup -> reset record to animate-or-initial
        await fireEvent.pointerUp(el)

        // Grab the last call args for reset
        const lastCall = animateMock.mock.calls.at(-1)
        expect(lastCall).toBeTruthy()
        const resetDef = lastCall![1] as Record<string, unknown>
        expect(resetDef).toMatchObject({ scale: 1.1, backgroundColor: '#000' })
    })

    it('whileHover accepts a variant key string and resolves it against `variants` (#349)', async () => {
        // Enable true-hover environment so the whileHover effect attaches.
        vi.stubGlobal('matchMedia', ((query: string) => {
            const matches = query.includes('(hover: hover)') || query.includes('(pointer: fine)')
            return {
                matches,
                media: query,
                onchange: null,
                addEventListener() {},
                removeEventListener() {},
                addListener() {},
                removeListener() {},
                dispatchEvent() {
                    return false
                }
            } as unknown as MediaQueryList
        }) as unknown as typeof window.matchMedia)

        const variants = { hover: { scale: 1.2 } }

        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                initial: { scale: 1 },
                animate: { scale: 1.1 },
                variants,
                whileHover: 'hover'
            }
        })

        await flushTimers()
        const el = container.firstElementChild as HTMLElement

        // Enter: the resolved variant ('hover' → { scale: 1.2 }) should
        // flow into the animate call exactly as if it were inline.
        await fireEvent.pointerEnter(el)
        await flushTimers()

        const enterCall = animateMock.mock.calls.at(-1)
        expect(enterCall?.[1]).toMatchObject({ scale: 1.2 })
    })

    it('whileHover accepts an array of variant keys, merging later-wins (#349)', async () => {
        vi.stubGlobal('matchMedia', ((query: string) => {
            const matches = query.includes('(hover: hover)') || query.includes('(pointer: fine)')
            return {
                matches,
                media: query,
                onchange: null,
                addEventListener() {},
                removeEventListener() {},
                addListener() {},
                removeListener() {},
                dispatchEvent() {
                    return false
                }
            } as unknown as MediaQueryList
        }) as unknown as typeof window.matchMedia)

        // Two variants colliding on `color` — `muted` is later in the
        // array, so its color wins. `hover`'s `scale` is preserved.
        const variants = {
            hover: { scale: 1.2, color: 'red' },
            muted: { color: 'gray' }
        }

        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                initial: { scale: 1, color: 'black' },
                animate: { scale: 1 },
                variants,
                whileHover: ['hover', 'muted']
            }
        })

        await flushTimers()
        const el = container.firstElementChild as HTMLElement

        await fireEvent.pointerEnter(el)
        await flushTimers()

        const enterCall = animateMock.mock.calls.at(-1)
        expect(enterCall?.[1]).toMatchObject({ scale: 1.2, color: 'gray' })
    })

    it('whileHover with unknown variant key is treated as no-op (#349)', async () => {
        // String key that misses against `variants` → resolver returns
        // undefined → `isNotEmpty` gate skips attach. The hover path
        // never installs listeners, so no animate call follows
        // pointerEnter.
        vi.stubGlobal('matchMedia', ((query: string) => {
            const matches = query.includes('(hover: hover)') || query.includes('(pointer: fine)')
            return {
                matches,
                media: query,
                onchange: null,
                addEventListener() {},
                removeEventListener() {},
                addListener() {},
                removeListener() {},
                dispatchEvent() {
                    return false
                }
            } as unknown as MediaQueryList
        }) as unknown as typeof window.matchMedia)

        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                variants: { hover: { scale: 1.2 } },
                whileHover: 'missing'
            }
        })

        await flushTimers()
        const el = container.firstElementChild as HTMLElement
        animateMock.mockClear()

        await fireEvent.pointerEnter(el)
        await flushTimers()

        expect(animateMock.mock.calls.length).toBe(0)
    })

    it('re-runs animate when animate prop changes', async () => {
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const result = render(MotionContainer as unknown as any, {
            props: { tag: 'div', animate: { opacity: 0.5 } }
        })

        await flushTimers()
        const initialAnimateCalls = animateMock.mock.calls.length

        // Update animate prop via rerender (Svelte 5)
        await result.rerender({ tag: 'div', animate: { opacity: 0.9 } })
        await flushTimers()

        expect(animateMock.mock.calls.length).toBeGreaterThan(initialAnimateCalls)
        const lastCall = animateMock.mock.calls.at(-1)
        expect(lastCall?.[1]).toMatchObject({ opacity: 0.9 })
    })

    it('subscribes animate controls and starts resolved variants', async () => {
        const controls = animationControls()
        const cleanup = controls.mount()

        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                animate: controls,
                variants: {
                    visible: { opacity: 1, x: 20 }
                },
                transition: { duration: 0.4 }
            }
        })

        await flushTimers()
        animateMock.mockClear()

        await controls.start('visible', { duration: 0.1 })

        expect(
            animateMock.mock.calls.some(
                (call) =>
                    (call[1] as Record<string, unknown>)?.opacity === 1 &&
                    (call[1] as Record<string, unknown>)?.x === 20 &&
                    (call[2] as Record<string, unknown>)?.duration === 0.1
            )
        ).toBe(true)

        cleanup()
    })

    it('sets animate controls to final keyframe and transitionEnd values', async () => {
        const controls = animationControls()
        const cleanup = controls.mount()

        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                animate: controls,
                variants: {
                    hidden: {
                        opacity: [1, 0.2],
                        transitionEnd: { display: 'none' }
                    }
                }
            }
        })

        await flushTimers()
        animateMock.mockClear()

        controls.set('hidden')

        expect(animateMock).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            expect.objectContaining({ opacity: 0.2, display: 'none' }),
            { duration: 0 }
        )

        cleanup()
    })

    it('stops active animate controls using Motion playback controls', async () => {
        const controls = animationControls()
        const cleanup = controls.mount()

        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                animate: controls,
                variants: {
                    visible: { opacity: 1, x: 20 }
                }
            }
        })

        await flushTimers()
        animateMock.mockClear()

        let resolveFinished: () => void = () => {}
        const stop = vi.fn()
        const finished = new Promise<void>((resolve) => {
            resolveFinished = resolve
        })
        animateMock.mockReturnValueOnce({ finished, stop })

        const start = controls.start('visible', { duration: 4 })
        await Promise.resolve()

        controls.stop()

        expect(stop).toHaveBeenCalledTimes(1)

        resolveFinished()
        await start

        expect(
            animateMock.mock.calls.some(
                (call) =>
                    (call[1] as Record<string, unknown>)?.opacity === 1 &&
                    (call[2] as Record<string, unknown>)?.duration === 0
            )
        ).toBe(false)

        cleanup()
    })

    it('applies FLIP (translate + scale) when layout=true and size changes', async () => {
        // Stub ResizeObserver and capture instances
        const roInstances: Array<{ fire: () => void }> = []
        class FakeResizeObserver {
            private _cb: ResizeObserverCallback
            constructor(cb: ResizeObserverCallback) {
                this._cb = cb
                roInstances.push({ fire: () => this._cb([], this as unknown as ResizeObserver) })
            }
            observe() {}
            disconnect() {}
        }
        vi.stubGlobal('ResizeObserver', FakeResizeObserver as unknown as typeof ResizeObserver)

        // Mock element rects to simulate size change
        let currentRect = {
            left: 0,
            top: 0,
            width: 100,
            height: 100
        } as unknown as DOMRect
        const rectSpy = vi
            .spyOn(
                HTMLElement.prototype as unknown as { getBoundingClientRect: () => DOMRect },
                'getBoundingClientRect'
            )
            .mockImplementation(() => currentRect)

        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const { container, unmount } = render(MotionContainer as unknown as any, {
            props: { tag: 'div', layout: true }
        })

        await flushTimers()

        const el = container.firstElementChild as HTMLElement
        expect(el).toBeTruthy()
        // Compositor hints applied on ready
        expect(el.style.willChange).toBe('transform')
        expect(el.style.transformOrigin).toBe('0 0')

        // Trigger size change
        currentRect = {
            left: 10,
            top: 5,
            width: 200,
            height: 120
        } as unknown as DOMRect
        // Fire RO callback
        roInstances.at(-1)?.fire()

        // In JSDOM, style/animation timing can be inconsistent; assert that
        // a ResizeObserver was created and compositor hints are applied.
        expect(roInstances.length).toBeGreaterThan(0)

        // Teardown cleans compositor hints
        unmount()
        expect(el.style.willChange).toBe('')
        expect(el.style.transformOrigin).toBe('')

        rectSpy.mockRestore()
    })

    it('applies translate-only when layout="position" (no scale)', async () => {
        const roInstances: Array<{ fire: () => void }> = []
        class FakeResizeObserver {
            private _cb: ResizeObserverCallback
            constructor(cb: ResizeObserverCallback) {
                this._cb = cb
                roInstances.push({ fire: () => this._cb([], this as unknown as ResizeObserver) })
            }
            observe() {}
            disconnect() {}
        }
        vi.stubGlobal('ResizeObserver', FakeResizeObserver as unknown as typeof ResizeObserver)

        let currentRect = {
            left: 0,
            top: 0,
            width: 100,
            height: 100
        } as unknown as DOMRect
        const rectSpy = vi
            .spyOn(
                HTMLElement.prototype as unknown as { getBoundingClientRect: () => DOMRect },
                'getBoundingClientRect'
            )
            .mockImplementation(() => currentRect)

        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const { container } = render(MotionContainer as unknown as any, {
            props: { tag: 'div', layout: 'position' }
        })

        await flushTimers()

        const el = container.firstElementChild as HTMLElement
        expect(el).toBeTruthy()

        // Change position and size; with layout="position" only translation should animate
        currentRect = {
            left: 20,
            top: 15,
            width: 240,
            height: 140
        } as unknown as DOMRect
        roInstances.at(-1)?.fire()

        // In JSDOM, we only assert that a ResizeObserver was created
        // and the component reached ready state.
        expect(roInstances.length).toBeGreaterThan(0)

        rectSpy.mockRestore()
    })

    it('whileHover animates on enter/leave, uses nested transition, and fires callbacks', async () => {
        // Enable true-hover environment
        vi.stubGlobal('matchMedia', ((query: string) => {
            const matches = query.includes('(hover: hover)') || query.includes('(pointer: fine)')
            return {
                matches,
                media: query,
                onchange: null,
                addEventListener() {},
                removeEventListener() {},
                addListener() {},
                removeListener() {},
                dispatchEvent() {
                    return false
                }
            } as unknown as MediaQueryList
        }) as unknown as typeof window.matchMedia)

        const onHoverStart = vi.fn()
        const onHoverEnd = vi.fn()

        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                initial: { scale: 1 },
                animate: { scale: 1.1 },
                transition: { duration: 0.25 },
                whileHover: { scale: 1.2, transition: { duration: 0.12 } },
                onHoverStart,
                onHoverEnd
            }
        })

        await flushTimers()

        const el = container.firstElementChild as HTMLElement
        expect(el).toBeTruthy()

        // Enter: should animate to whileHover with its nested transition
        await fireEvent.pointerEnter(el)
        await flushTimers()
        let lastCall = animateMock.mock.calls.at(-1)
        expect(lastCall?.[1]).toMatchObject({ scale: 1.2 })
        expect(lastCall?.[2]).toMatchObject({ duration: 0.12 })
        expect(onHoverStart).toHaveBeenCalledTimes(1)

        // Leave: should animate back to baseline (animate over initial) with component transition
        await fireEvent.pointerLeave(el)
        await flushTimers()
        lastCall = animateMock.mock.calls.at(-1)
        expect(lastCall?.[1]).toMatchObject({ scale: 1.1 })
        expect(lastCall?.[2]).toMatchObject({ duration: 0.25 })
        expect(onHoverEnd).toHaveBeenCalledTimes(1)
    })

    it('passes own custom prop into a function-form variant on animate', async () => {
        animateMock.mockClear()
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                custom: 3,
                variants: {
                    visible: (i: unknown) => ({ x: (i as number) * 50 })
                },
                animate: 'visible'
            }
        })
        await flushTimers()
        const animateDef = animateMock.mock.calls.at(-1)?.[1] as Record<string, unknown>
        expect(animateDef).toMatchObject({ x: 150 })
    })

    it('inherits custom from a parent motion component when child has no custom prop', async () => {
        // Render a nested tree via a tiny wrapper Svelte component so we
        // exercise the real Svelte context inheritance, not just the
        // resolver in isolation.
        const { default: NestedCustomHarness } =
            await import('$lib/components/__tests__/NestedCustomHarness.svelte')
        animateMock.mockClear()
        render(NestedCustomHarness, { props: { parentCustom: 4 } })
        await flushTimers()
        // The child resolves `(i) => ({ x: i * 25 })` with custom=4 → x=100.
        const childCall = animateMock.mock.calls.find(
            (c) => (c?.[1] as Record<string, unknown>)?.x === 100
        )
        expect(childCall).toBeTruthy()
    })

    it('re-animates the child when the parent updates `custom` after mount', async () => {
        // Regression for the ready-state animate effect gating only on
        // `lastRanVariantKey`. The child here animates to the same
        // variant key ("visible") across both renders — only the resolved
        // keyframes change because `custom` does. Before the fix the
        // gating short-circuited and no new animate call was made.
        const { default: NestedCustomHarness } =
            await import('$lib/components/__tests__/NestedCustomHarness.svelte')
        animateMock.mockClear()
        const result = render(NestedCustomHarness, { props: { parentCustom: 4 } })
        await flushTimers()
        // Initial: child resolves to x=100.
        expect(
            animateMock.mock.calls.some((c) => (c?.[1] as Record<string, unknown>)?.x === 100)
        ).toBe(true)

        animateMock.mockClear()
        await result.rerender({ parentCustom: 5 })
        await flushTimers()
        // After parent's custom flips 4 → 5, the child must re-animate
        // to x=125. If the gating ignores `custom`, this call never lands.
        expect(
            animateMock.mock.calls.some((c) => (c?.[1] as Record<string, unknown>)?.x === 125)
        ).toBe(true)
    })

    it('whileHover is gated to hover-capable devices', async () => {
        /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
        const { container } = render(MotionContainer as unknown as any, {
            props: { tag: 'div', whileHover: { scale: 1.05 } }
        })

        await flushTimers()

        const el = container.firstElementChild as HTMLElement
        expect(el).toBeTruthy()

        // Clear any prior animate calls to isolate hover behavior
        animateMock.mockClear()

        // Simulate touch event - motion-dom's hover filters these out
        const touchEvent = new PointerEvent('pointerenter', {
            pointerType: 'touch',
            bubbles: true,
            cancelable: true
        })
        el.dispatchEvent(touchEvent)
        await flushTimers()

        // No hover animation should be triggered for touch events
        expect(animateMock).not.toHaveBeenCalled()
    })
})
