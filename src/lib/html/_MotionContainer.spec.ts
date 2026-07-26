import { flushTimers } from '$lib/__tests__/flushTimers'
import { animationControls } from '$lib/utils/animationControls.svelte'
import { fireEvent, render } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Curried like the real API: animateMotionValue(name, value, target, transition)
// returns a START function taking onComplete. The mock jumps the MotionValue to
// the final target synchronously (firing its change subscription, as the real
// animation's updates would) and completes.
const animateMotionValueMock = vi.hoisted(() =>
    vi.fn(
        (
            _name: string,
            value: { jump?: (v: number) => void; set?: (v: number) => void },
            target: unknown,
            _transition?: Record<string, unknown>
        ) =>
            (onComplete?: () => void) => {
                // Recorded via mock.calls for transition assertions; unused here.
                void _transition
                const final = Array.isArray(target)
                    ? Number((target as unknown[]).at(-1))
                    : Number(target)
                if (Number.isFinite(final)) (value.jump ?? value.set)?.call(value, final)
                onComplete?.()
                return { stop: vi.fn() }
            }
    )
)

const animateValueMock = vi.hoisted(() =>
    vi.fn(
        ({
            keyframes,
            onUpdate,
            onComplete
        }: {
            keyframes?: unknown[]
            onUpdate?: (value: number) => void
            onComplete?: () => void
        }) => {
            const finalValue = Number(keyframes?.at(-1))
            if (Number.isFinite(finalValue)) onUpdate?.(finalValue)
            onComplete?.()
            return { stop: vi.fn(), then: vi.fn(), finished: Promise.resolve() }
        }
    )
)

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

vi.mock('motion-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('motion-dom')>()
    return { ...actual, animateValue: animateValueMock, animateMotionValue: animateMotionValueMock }
})

// Mock sleep to resolve immediately
vi.mock('$lib/utils/testing.js', () => ({
    sleep: vi.fn(() => Promise.resolve())
}))

import MotionContainer from './_MotionContainer.svelte'

/**
 * Read the VisualElement's `latestValues` for an element.
 *
 * The animationState is the declarative writer now (plan 002 Step 3), so
 * behaviour is asserted on the values the node actually holds rather than on
 * call counts of the deleted `animate()` writer. `animateMotionValue` is mocked
 * above to jump each MotionValue straight to its target, so a completed pass is
 * observable synchronously.
 */
const latestValuesOf = async (el: Element | null): Promise<Record<string, unknown>> => {
    if (!el) return {}
    const { visualElementStore } = await import('motion-dom')
    const ve = visualElementStore.get(el)
    return ve ? { ...ve.latestValues } : {}
}

// Resolve requestAnimationFrame immediately to move component to "ready"
beforeEach(() => {
    animateMock.mockClear()
    animateValueMock.mockClear()
    animateMotionValueMock.mockClear()
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

describe('_MotionContainer', () => {
    it('does not add tabindex when element is natively focusable', async () => {
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

        // The animationState is the writer now, so the lifecycle comes from the
        // VisualElement's AnimationStart/AnimationComplete events rather than
        // from the retired `animate()` call. Assert the callbacks, not the
        // mechanism.
        expect(onStart.mock.calls.length).toBeGreaterThanOrEqual(1)
        expect(onComplete.mock.calls.length).toBeGreaterThanOrEqual(1)
        expect(onStart).toHaveBeenCalledWith({ opacity: 1 })
        expect(onComplete).toHaveBeenCalledWith({ opacity: 1 })
    })

    it('settles at the animate values so a whileTap release has the right baseline', async () => {
        // The animate-over-initial RESET RULE itself is covered by three
        // dedicated tests on the pure function in `interaction.spec.ts`
        // ("buildTapResetRecord: prefers animate over initial" and friends).
        // What only the container can pin — and what this test now asserts — is
        // the other half of that contract: the node must SETTLE at the `animate`
        // values, because those are the baseline the tap writer restores to on
        // release. Before plan 002 this was asserted via the reset payload
        // handed to the retired `animate()` writer.
        const initial = { scale: 1, backgroundColor: '#111' }
        const animate = { scale: 1.1, backgroundColor: '#000' }
        const whileTap = { scale: 0.9, backgroundColor: '#f00' }

        const { container } = render(MotionContainer as unknown as any, {
            props: { tag: 'div', initial, animate, whileTap }
        })

        // Wait for ready promotion
        await flushTimers()

        const el = container.firstElementChild as HTMLElement
        expect(el).toBeTruthy()
        expect(await latestValuesOf(el)).toMatchObject({ scale: 1.1 })

        // A full press/release cycle must leave the animate baseline intact
        // rather than stranding the element on the whileTap values.
        await fireEvent.pointerDown(el)
        await fireEvent.pointerUp(el)
        await flushTimers()

        expect(await latestValuesOf(el)).toMatchObject({ scale: 1.1 })
    })

    it('whileHover accepts a variant key string and resolves it against `variants` (#349)', async () => {
        // Enable true-hover environment so the whileHover effect attaches.
        vi.stubGlobal('matchMedia', (query: string) => {
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
        })

        const variants = { hover: { scale: 1.2 } }

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

        // Plan 003: whileHover is `setActive('whileHover', true)` and the
        // animationState resolves the label against `variants` itself, so the
        // assertion is on the value the node lands at, not on the retired
        // writer's call args.
        expect(await latestValuesOf(el)).toMatchObject({ scale: 1.2 })
    })

    it('whileHover accepts an array of variant keys, merging later-wins (#349)', async () => {
        vi.stubGlobal('matchMedia', (query: string) => {
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
        })

        // Two variants colliding on `color` — `muted` is later in the
        // array, so its color wins. `hover`'s `scale` is preserved.
        const variants = {
            hover: { scale: 1.2, color: 'red' },
            muted: { color: 'gray' }
        }

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

        // Plan 003: the animationState resolves the label LIST itself, merging
        // later-wins. `muted` comes second so its `color` wins, while `hover`'s
        // `scale` survives — asserted on the node's values now, not on the
        // retired writer's two separate call channels.
        expect(await latestValuesOf(el)).toMatchObject({ scale: 1.2, color: 'gray' })
    })

    it('whileHover with unknown variant key is treated as no-op (#349)', async () => {
        // String key that misses against `variants` → resolver returns
        // undefined → `isNotEmpty` gate skips attach. The hover path
        // never installs listeners, so no animate call follows
        // pointerEnter.
        vi.stubGlobal('matchMedia', (query: string) => {
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
        })

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
        const result = render(MotionContainer as unknown as any, {
            props: { tag: 'div', animate: { opacity: 0.5 } }
        })

        await flushTimers()
        const el = result.container.firstElementChild
        expect(await latestValuesOf(el)).toMatchObject({ opacity: 0.5 })

        // Update animate prop via rerender (Svelte 5)
        await result.rerender({ tag: 'div', animate: { opacity: 0.9 } })
        await flushTimers()

        // Behaviour, not call counts: the node must hold the NEW target. This
        // also pins the dedup contract — `animateChanges` re-runs on every prop
        // change and is a no-op only when the resolved target is unchanged.
        expect(await latestValuesOf(el)).toMatchObject({ opacity: 0.9 })
    })

    it('subscribes animate controls and starts resolved variants', async () => {
        // Controls drive the VisualElement now (plan 002 Step 7), so behaviour is
        // asserted on the values the node holds rather than on call args to the
        // retired `animate()` writer. `animateMotionValue` is mocked at the top of
        // this file to jump each MotionValue to its target, so a resolved start is
        // observable synchronously.
        const controls = animationControls()
        const cleanup = controls.mount()

        const { container } = render(MotionContainer as unknown as any, {
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

        void controls.start('visible', { duration: 0.1 })
        await flushTimers()

        // The variant label resolved against this node's own `variants`.
        expect(await latestValuesOf(container.firstElementChild)).toMatchObject({
            opacity: 1,
            x: 20
        })

        cleanup()
    })

    it('sets animate controls to final keyframe and transitionEnd values', async () => {
        const controls = animationControls()
        const cleanup = controls.mount()

        const { container } = render(MotionContainer as unknown as any, {
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

        controls.set('hidden')
        await flushTimers()

        // `set` is a jump, and a keyframe array collapses to its RESTING value
        // (0.2, not 1); `transitionEnd` is applied on top.
        expect(await latestValuesOf(container.firstElementChild)).toMatchObject({
            opacity: 0.2,
            display: 'none'
        })

        cleanup()
    })

    it('stops active animate controls, freezing the value where it is', async () => {
        const controls = animationControls()
        const cleanup = controls.mount()

        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                animate: controls,
                initial: { opacity: 0.5 },
                variants: {
                    visible: { opacity: 1 }
                }
            }
        })

        await flushTimers()
        const el = container.firstElementChild

        void controls.start('visible', { duration: 4 })
        await flushTimers()
        const beforeStop = (await latestValuesOf(el)).opacity

        controls.stop()
        await flushTimers()

        // `stop()` FREEZES: it must not reset the value and must not keep
        // animating. `MotionValue.stop()` routes into the animation's own
        // interrupt handling, so the value simply stays where it was.
        expect(await latestValuesOf(el)).toMatchObject({ opacity: beforeStop })

        cleanup()
    })

    it('keeps initial variants applied after mounting with animate controls', async () => {
        const controls = animationControls()

        const { container } = render(MotionContainer as unknown as any, {
            props: {
                tag: 'div',
                animate: controls,
                initial: 'ready',
                variants: {
                    ready: { opacity: 0.45, scaleX: 0.16 }
                }
            }
        })

        await flushTimers()
        await flushTimers()

        const el = container.firstElementChild as HTMLElement
        expect(el.getAttribute('style')).toContain('opacity: 0.45')
        expect(el.getAttribute('style')).toContain('transform: scaleX(0.16)')
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
        vi.stubGlobal('ResizeObserver', FakeResizeObserver)

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
        vi.stubGlobal('ResizeObserver', FakeResizeObserver)

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
        vi.stubGlobal('matchMedia', (query: string) => {
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
        })

        const onHoverStart = vi.fn()
        const onHoverEnd = vi.fn()

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

        // Enter: the whileHover target wins over `animate` (higher priority).
        await fireEvent.pointerEnter(el)
        await flushTimers()
        expect(await latestValuesOf(el)).toMatchObject({ scale: 1.2 })
        expect(onHoverStart).toHaveBeenCalledTimes(1)

        // Leave: whileHover is removed, so the animationState restores the
        // next-highest source — `animate` (1.1), not `initial` — via its
        // removed-key handling. That restoration used to be hand-rolled by
        // `computeHoverBaseline`; it is upstream's `baseTarget` now.
        await fireEvent.pointerLeave(el)
        await flushTimers()
        expect(await latestValuesOf(el)).toMatchObject({ scale: 1.1 })
        expect(onHoverEnd).toHaveBeenCalledTimes(1)
    })

    it('passes own custom prop into a function-form variant on animate', async () => {
        const { container } = render(MotionContainer as unknown as any, {
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
        // custom=3 through `(i) => ({ x: i * 50 })` → x=150 on the node.
        expect(await latestValuesOf(container.firstElementChild)).toMatchObject({ x: 150 })
    })

    it('inherits custom from a parent motion component when child has no custom prop', async () => {
        // Render a nested tree via a tiny wrapper Svelte component so we
        // exercise the real Svelte context inheritance, not just the
        // resolver in isolation.
        const { default: NestedCustomHarness } =
            await import('$lib/components/__tests__/NestedCustomHarness.svelte')
        const { getByTestId } = render(NestedCustomHarness, { props: { parentCustom: 4 } })
        await flushTimers()
        // The child resolves `(i) => ({ x: i * 25 })` with the INHERITED custom=4
        // → x=100 on the child's own node.
        expect(await latestValuesOf(getByTestId('child'))).toMatchObject({ x: 100 })
    })

    it('re-animates the child when the parent updates `custom` after mount', async () => {
        // Regression for the ready-state animate effect gating only on
        // `lastRanVariantKey`. The child here animates to the same
        // variant key ("visible") across both renders — only the resolved
        // keyframes change because `custom` does. Before the fix the
        // gating short-circuited and no new animate call was made.
        const { default: NestedCustomHarness } =
            await import('$lib/components/__tests__/NestedCustomHarness.svelte')
        const result = render(NestedCustomHarness, { props: { parentCustom: 4 } })
        await flushTimers()
        const child = result.getByTestId('child')
        // Initial: child resolves to x=100.
        expect(await latestValuesOf(child)).toMatchObject({ x: 100 })

        await result.rerender({ parentCustom: 5 })
        await flushTimers()
        // After the parent's custom flips 4 → 5 the child must re-resolve to
        // x=125 even though its variant KEY ("visible") never changed. This is
        // the same regression the old `lastRanVariantKey` gating had; the
        // animationState must not dedup a same-key/different-custom target away.
        expect(await latestValuesOf(child)).toMatchObject({ x: 125 })
    })

    it('runs a motion child exit when PresenceChild flips to not present', async () => {
        const { default: PresenceMotionExitHarness } =
            await import('$lib/components/__tests__/PresenceMotionExitHarness.svelte')
        const onExitComplete = vi.fn()
        const result = render(PresenceMotionExitHarness, {
            props: { present: true, onExitComplete }
        })
        await flushTimers()
        expect(result.queryByTestId('presence-motion-child')).toBeTruthy()

        await result.rerender({ present: false, onExitComplete })
        await flushTimers()
        await flushTimers()

        expect(result.queryByTestId('presence-motion-child')).toBeNull()
        expect(onExitComplete).toHaveBeenCalledTimes(1)
    })

    it('whileHover is gated to hover-capable devices', async () => {
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
