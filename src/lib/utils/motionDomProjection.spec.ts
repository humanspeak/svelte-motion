import {
    animateVisualElement,
    frame,
    measurePageBox,
    measureViewportBox,
    motionValue,
    nodeGroup,
    visualElementStore
} from 'motion-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    MotionDomProjectionAdapter,
    layoutMeasureStats,
    type ExitLayoutHold
} from './motionDomProjection.js'
import { readScrollBasis } from './scrollBasis.js'
import { createMotionVisualElement } from './visualElementCore.js'

/**
 * Page-space measurement math (Plan 004 Step 3, #437).
 *
 * The adapter exposes `measurePageRect(phase)`: the element's layout rect in
 * scroll-invariant PAGE space via the upstream motion-dom node — viewport box
 * plus the document root's phase-cached scroll offset (upstream
 * `measurePageBox`), ancestor `layoutScroll` offsets folded in
 * (`removeElementScroll`). The invariant under test: an element that does NOT
 * move in page space measures the SAME page box regardless of viewport scroll
 * between two reads — the invariant that replaced the container's former
 * viewport-scroll suppression heuristic.
 */

/** Point the document scroll and the element's viewport rect at a page position. */
const setScrollAndRect = (el: HTMLElement, scrollY: number, pageTop: number, pageLeft = 10) => {
    document.documentElement.scrollTop = scrollY
    document.documentElement.scrollLeft = 0
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(pageLeft, pageTop - scrollY, 100, 50)
    )
}

describe('transformPagePoint coordinate characterization', () => {
    const createMeasuredElement = () => {
        const element = document.createElement('div')
        document.body.appendChild(element)
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 200, 80, 40))
        return element
    }

    it('maps original viewport corners before converting them to a box', () => {
        const element = createMeasuredElement()
        const transformPagePoint = vi.fn(({ x, y }: { x: number; y: number }) => ({
            x: x / 0.5,
            y: y / 2
        }))

        const box = measureViewportBox(element, transformPagePoint)

        expect(box).toEqual({ x: { min: 200, max: 360 }, y: { min: 100, max: 120 } })
        expect(transformPagePoint).toHaveBeenNthCalledWith(1, { x: 100, y: 200 })
        expect(transformPagePoint).toHaveBeenNthCalledWith(2, { x: 180, y: 240 })
        element.remove()
    })

    it('adds projection-root scroll after mapping viewport corners', () => {
        const element = createMeasuredElement()
        const transformPagePoint = vi.fn(({ x, y }: { x: number; y: number }) => ({
            x: x / 0.5,
            y: y / 2
        }))
        const root = { scroll: { offset: { x: 10, y: 30 } } }

        const box = measurePageBox(element, root, transformPagePoint)

        expect(box).toEqual({ x: { min: 210, max: 370 }, y: { min: 130, max: 150 } })
        expect(transformPagePoint).toHaveBeenNthCalledWith(1, { x: 100, y: 200 })
        expect(transformPagePoint).toHaveBeenNthCalledWith(2, { x: 180, y: 240 })
        element.remove()
    })

    it('preserves the DOMRect with no mapping or an identity mapping', () => {
        const element = createMeasuredElement()
        const expected = { x: { min: 100, max: 180 }, y: { min: 200, max: 240 } }

        expect(measureViewportBox(element)).toEqual(expected)
        expect(measureViewportBox(element, (point) => point)).toEqual(expected)
        element.remove()
    })

    it('applies an affine translation equally to both viewport corners', () => {
        const element = createMeasuredElement()

        const box = measureViewportBox(element, ({ x, y }) => ({ x: x + 25, y: y - 75 }))

        expect(box).toEqual({ x: { min: 125, max: 205 }, y: { min: 125, max: 165 } })
        element.remove()
    })
})

describe('MotionDomProjectionAdapter.measurePageRect', () => {
    let element: HTMLElement
    let adapter: MotionDomProjectionAdapter

    beforeEach(() => {
        // This environment installs fake timers globally (see
        // vitest-setup-client.ts); the upstream update pass flushes through
        // motion-dom's microtask/frame machinery, which needs real timers.
        vi.useRealTimers()
        document.documentElement.scrollTop = 0
        document.documentElement.scrollLeft = 0
        element = document.createElement('div')
        document.body.appendChild(element)
        adapter = new MotionDomProjectionAdapter()
        adapter.updateOptions({ layout: true })
    })

    it('element at scrollY=500 measures the same page box before and after a 200px scroll between snapshot and measure phases', () => {
        // Element sits at page-space top=100 while the viewport is scrolled
        // to 500 → viewport-relative top is -400.
        setScrollAndRect(element, 500, 100)
        adapter.mount(element)

        const before = adapter.measurePageRect('snapshot')
        expect(before).not.toBeNull()
        expect(before!.top).toBe(100)
        expect(before!.left).toBe(10)
        expect(before!.width).toBe(100)
        expect(before!.height).toBe(50)

        // Scroll 200px further; the element does not move in page space, so
        // its viewport-relative top drops to -600.
        setScrollAndRect(element, 700, 100)

        const after = adapter.measurePageRect('measure')
        expect(after).not.toBeNull()
        // Scroll-invariant: the page box is unchanged, so downstream
        // hasRectChanged() sees no delta and no spurious FLIP fires.
        expect(after!.top).toBe(100)
        expect(after!.left).toBe(10)
        expect(after!.width).toBe(100)
        expect(after!.height).toBe(50)
        adapter.unmount()
    })

    it('marks a fresh scroll boundary per read: consecutive same-phase reads across a scroll still agree', () => {
        // Upstream keys the scroll cache by (root.animationId, phase). The
        // Svelte observer bridge takes standalone seeds between update passes
        // (animationId static), so a NEW read of the SAME phase must
        // re-measure scroll rather than reuse a stale offset — otherwise the
        // seed pairs a fresh viewport rect with an old scroll and the next
        // commit sees the scroll delta as a layout change.
        setScrollAndRect(element, 500, 100)
        adapter.mount(element)

        const first = adapter.measurePageRect('measure')
        expect(first!.top).toBe(100)

        setScrollAndRect(element, 700, 100)
        const second = adapter.measurePageRect('measure')
        expect(second!.top).toBe(100)
        adapter.unmount()
    })

    it('notifies onMeasure listeners by default and skips them for a silent read (#470 gate)', () => {
        setScrollAndRect(element, 0, 100)
        adapter.mount(element)
        const listener = vi.fn()
        const off = adapter.onMeasure(listener)

        const loud = adapter.measurePageRect('measure')
        expect(loud).not.toBeNull()
        expect(listener).toHaveBeenCalledTimes(1)
        expect(listener).toHaveBeenLastCalledWith(loud)

        // A `layoutDependency`-gated node re-slotted by a sibling refreshes its
        // cache without surfacing a measurement — upstream never runs
        // `updateLayout()` for it, so `onLayoutMeasure` must stay silent.
        const quiet = adapter.measurePageRect('measure', { silent: true })
        expect(quiet).toEqual(loud)
        expect(listener).toHaveBeenCalledTimes(1)

        off()
        adapter.unmount()
    })

    it('refreshLayout seeds the projection and returns the rect in ONE DOM read (silent skips listeners)', () => {
        setScrollAndRect(element, 0, 100)
        adapter.mount(element)
        const listener = vi.fn()
        const off = adapter.onMeasure(listener)
        const readSpy = vi.spyOn(element, 'getBoundingClientRect')
        readSpy.mockClear()
        const silentBefore = layoutMeasureStats.silentReads
        const loudBefore = layoutMeasureStats.reads

        // The observer bridge used to do measurePageRect() + seedLayout(),
        // reading the box twice; the gated cache refresh must read it once.
        const rect = adapter.refreshLayout({ silent: true })
        expect(rect).toEqual({ left: 10, top: 100, width: 100, height: 50 })
        expect(readSpy).toHaveBeenCalledTimes(1)
        // Seeded: the projection's cached slot equals the returned rect.
        expect(adapter.lastMeasuredRect).toEqual(rect)
        // Silent: no `onLayoutMeasure` fan-out, only the silent counter moves.
        expect(listener).not.toHaveBeenCalled()
        expect(layoutMeasureStats.silentReads).toBe(silentBefore + 1)
        expect(layoutMeasureStats.reads).toBe(loudBefore)

        // Loud variant notifies once and counts as a public read.
        readSpy.mockClear()
        const loud = adapter.refreshLayout()
        expect(readSpy).toHaveBeenCalledTimes(1)
        expect(listener).toHaveBeenCalledTimes(1)
        expect(listener).toHaveBeenLastCalledWith(loud)
        expect(layoutMeasureStats.reads).toBe(loudBefore + 1)

        readSpy.mockRestore()
        off()
        adapter.unmount()
    })

    it('returns null before mount and restores a stripped inline transform after the read', () => {
        expect(adapter.measurePageRect('measure')).toBeNull()

        setScrollAndRect(element, 0, 100)
        adapter.mount(element)
        // A mid-animation FLIP transform must not contaminate the measured
        // rect's lifecycle: the read strips to the base transform and
        // restores the inline value afterward (legacy measure() contract).
        element.style.transform = 'translateY(-38px)'
        adapter.measurePageRect('measure')
        expect(element.style.transform).toBe('translateY(-38px)')
        adapter.unmount()
    })

    it("keeps the VisualElement's own transform string for the read, like upstream resetTransform", () => {
        // A finished `animate(el, { transform: 'translateY(40px)' })` leaves
        // the value on the component's VisualElement, which renders it inline.
        // No independent transforms, no projection delta, no template:
        // upstream `resetTransform()` keeps it (motion-dom
        // create-projection-node.ts @ v14.2.0, 1020-1029), so the read
        // includes it.
        const transformsDuringRead: string[] = []
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
            transformsDuringRead.push(element.style.transform)
            const shifted = element.style.transform === 'translateY(40px)'
            return new DOMRect(10, shifted ? 140 : 100, 100, 50)
        })
        adapter.mount(element)
        adapter.visualElement.latestValues.transform = 'translateY(40px)'
        element.style.transform = 'translateY(40px)'
        transformsDuringRead.length = 0

        const rect = adapter.measurePageRect('measure')

        expect(transformsDuringRead.length).toBeGreaterThan(0)
        expect(transformsDuringRead.every((t) => t === 'translateY(40px)')).toBe(true)
        expect(rect!.top).toBe(140)
        adapter.unmount()
    })

    it('keeps a transform string a declarative animation left on the VisualElement for the read', async () => {
        // `<motion.div layout animate={{ transform: 'translateY(40px)' }}>`:
        // the declarative target runs through the VisualElement's animation
        // path (`animateVisualElement`), which leaves `transform` in
        // `latestValues` and renders it inline as-is (motion-dom
        // `render/html/utils/build-styles.ts` @ v14.2.0, 30-47 and 52). It's
        // not an independent transform (`has-transform.ts`, 16-27), so
        // upstream `resetTransform()` keeps it for the read
        // (`create-projection-node.ts`, 999-1031).
        const transformsDuringRead: string[] = []
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
            transformsDuringRead.push(element.style.transform)
            const shifted = element.style.transform === 'translateY(40px)'
            return new DOMRect(10, shifted ? 140 : 100, 100, 50)
        })
        adapter.mount(element)
        await animateVisualElement(adapter.visualElement, {
            transform: 'translateY(40px)',
            transition: { duration: 0 }
        })
        await new Promise<void>((resolve) => frame.postRender(() => resolve()))
        expect(adapter.visualElement.latestValues.transform).toBe('translateY(40px)')
        expect(element.style.transform).toBe('translateY(40px)')
        transformsDuringRead.length = 0

        const rect = adapter.measurePageRect('measure')

        expect(transformsDuringRead.length).toBeGreaterThan(0)
        expect(transformsDuringRead.every((t) => t === 'translateY(40px)')).toBe(true)
        expect(rect!.top).toBe(140)
        expect(element.style.transform).toBe('translateY(40px)')
        adapter.unmount()
    })

    it('strips a transform the page wrote inline itself', () => {
        // Svelte's next `style` patch drops it, so the "after" read never sees
        // it; the read strips it so both reads agree.
        const transformsDuringRead: string[] = []
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
            transformsDuringRead.push(element.style.transform)
            return new DOMRect(10, 100, 100, 50)
        })
        adapter.mount(element)
        element.style.transform = 'translateY(40px)'
        transformsDuringRead.length = 0

        adapter.measurePageRect('measure')

        expect(transformsDuringRead.length).toBeGreaterThan(0)
        expect(transformsDuringRead.every((t) => t === 'none')).toBe(true)
        expect(element.style.transform).toBe('translateY(40px)')
        adapter.unmount()
    })

    it('strips the transform string too when the element has independent transforms', () => {
        // `hasTransform(latestValues)`: upstream resets to `'none'`.
        const transformsDuringRead: string[] = []
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
            transformsDuringRead.push(element.style.transform)
            return new DOMRect(10, 100, 100, 50)
        })
        adapter.mount(element)
        adapter.visualElement.latestValues.transform = 'translateY(40px)'
        adapter.visualElement.latestValues.y = 40
        element.style.transform = 'translateY(40px) translateY(40px)'
        transformsDuringRead.length = 0

        adapter.measurePageRect('measure')

        expect(transformsDuringRead.length).toBeGreaterThan(0)
        expect(transformsDuringRead.every((t) => t === 'none')).toBe(true)
        adapter.unmount()
    })

    it('does not double-strip: latestValues gesture offsets must not be subtracted from the physically stripped box', () => {
        // Reorder.Item routes its live drag offset through style x/y
        // MotionValues, which upstream mirrors into
        // visualElement.latestValues. measurePageRect strips the rendered
        // transform PHYSICALLY (style.transform = base), so upstream
        // measure(true)'s removeTransform step would subtract the same
        // offset a second time and report slot - offset. Regression: the
        // measured rect must equal the physical slot.
        setScrollAndRect(element, 0, 278)
        adapter.mount(element)
        adapter.visualElement.latestValues.y = 45.83
        adapter.visualElement.latestValues.x = 12

        const rect = adapter.measurePageRect('measure')
        expect(rect!.top).toBe(278)
        expect(rect!.left).toBe(10)
        adapter.unmount()
    })

    it('does not resurrect lastLayout after unmount when a pending refresh rAF fires', () => {
        // Plan 011: refreshCachedLayout schedules a requestAnimationFrame that
        // re-reads projection.layout on the NEXT frame. unmount() clears
        // lastLayout, but the pending callback fires afterward and resurrects
        // it — a post-unmount state write that seeds a remount's first commit
        // with a stale snapshot. Upstream cancels its equivalent frame in
        // unmount (create-projection-node.ts: cancelFrame(this.updateProjection)).
        //
        // Capture the scheduled rAF instead of running it so we can flush it
        // deterministically AFTER unmount.
        //
        // `vi.stubGlobal`, not `vi.spyOn(globalThis, …)`: restoring a spy on
        // jsdom's rAF leaves it (and motion-dom's frameloop, which captured
        // it at import) permanently dead for the rest of this file.
        const rafCallbacks: FrameRequestCallback[] = []
        vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback): number => {
            rafCallbacks.push(fn)
            return rafCallbacks.length
        })
        vi.stubGlobal('cancelAnimationFrame', () => {})

        setScrollAndRect(element, 0, 100)
        adapter.mount(element)
        // Populate projection.layout so the scheduled callback has a snapshot
        // to (incorrectly) resurrect after unmount.
        adapter.seedLayout()

        const probe = adapter as unknown as {
            lastLayout: unknown
            refreshCachedLayout: () => void
        }
        probe.refreshCachedLayout()
        expect(probe.lastLayout).toBeDefined()
        expect(rafCallbacks.length).toBeGreaterThan(0)

        adapter.unmount()
        expect(probe.lastLayout).toBeUndefined()

        // A frame arriving after unmount must NOT write lastLayout again.
        for (const cb of rafCallbacks) cb(0)
        expect(probe.lastLayout).toBeUndefined()

        vi.unstubAllGlobals()
    })
})

/**
 * Compositor-proof measurements (plan 005 Step 4).
 *
 * Motion 14.2 runs x/y/scale/rotate as one WAAPI `transform` animation, which
 * overrides the inline base transform the measurement writes. The measurement
 * detaches those animations' effects (`effect.target = null`) for the
 * synchronous read and reattaches them afterwards, without demoting.
 */
describe('MotionDomProjectionAdapter.measurePageRect with WAAPI transform animations', () => {
    let element: HTMLElement
    let adapter: MotionDomProjectionAdapter

    /** Minimal stand-in for a script-created WAAPI animation. */
    const stubAnimation = (keyframes: Keyframe[], extra: Record<string, unknown> = {}) => {
        const effect = {
            target: element as Element | null,
            getKeyframes: () => keyframes
        }
        return { effect, ...extra }
    }

    /** Give `node` an `x` value whose animation reports a compositor value. */
    const markMotionTransformAccelerated = (node: MotionDomProjectionAdapter) => {
        const x = motionValue(0)
        node.visualElement.addValue('x', x)
        // `stop` because unmounting the VisualElement stops its values.
        ;(x as unknown as { animation: unknown }).animation = {
            liveValue: () => 87,
            stop: () => {}
        }
    }

    const stubAnimations = (animations: Array<ReturnType<typeof stubAnimation>>) => {
        ;(element as unknown as { getAnimations: () => unknown[] }).getAnimations = () => animations
    }

    beforeEach(() => {
        vi.useRealTimers()
        document.documentElement.scrollTop = 0
        document.documentElement.scrollLeft = 0
        element = document.createElement('div')
        document.body.appendChild(element)
        adapter = new MotionDomProjectionAdapter()
        adapter.updateOptions({ layout: true })
    })

    it('detaches a transform animation for the read and reattaches it afterwards', () => {
        const transform = stubAnimation([
            { transform: 'translateX(0px)' },
            { transform: 'translateX(200px)' }
        ])
        stubAnimations([transform])
        // The animation is Motion's own: `x` runs on the compositor, which the
        // public `MotionValueAnimation.liveValue()` reports.
        markMotionTransformAccelerated(adapter)
        const targetsDuringRead: Array<Element | null> = []
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
            targetsDuringRead.push(transform.effect.target)
            // The in-flight x would add 87px if the animation stayed attached.
            return new DOMRect(transform.effect.target ? 97 : 10, 100, 100, 50)
        })
        adapter.mount(element)
        targetsDuringRead.length = 0

        const rect = adapter.measurePageRect('measure')

        expect(targetsDuringRead.length).toBeGreaterThan(0)
        expect(targetsDuringRead.every((target) => target === null)).toBe(true)
        expect(rect!.left).toBe(10)
        expect(transform.effect.target).toBe(element)
        adapter.unmount()
    })

    it('never detaches non-transform animations or CSS animations/transitions', () => {
        const opacity = stubAnimation([{ opacity: 0 }, { opacity: 1 }])
        const cssAnimation = stubAnimation([{ transform: 'scale(1)' }, { transform: 'scale(2)' }], {
            animationName: 'pulse'
        })
        const cssTransition = stubAnimation([{ transform: 'none' }, { transform: 'scale(2)' }], {
            transitionProperty: 'transform'
        })
        // Motion's own transform effect, next to the three that must stay. The
        // element's `x` runs on the compositor, so the read does collect
        // effects: the three above stay attached because they're filtered,
        // not because nothing was collected.
        const motionTransform = stubAnimation([
            { transform: 'translateX(0px)' },
            { transform: 'translateX(200px)' }
        ])
        stubAnimations([opacity, cssAnimation, cssTransition, motionTransform])
        markMotionTransformAccelerated(adapter)
        const targetsDuringRead: Array<Array<Element | null>> = []
        const motionTargetsDuringRead: Array<Element | null> = []
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
            targetsDuringRead.push([
                opacity.effect.target,
                cssAnimation.effect.target,
                cssTransition.effect.target
            ])
            motionTargetsDuringRead.push(motionTransform.effect.target)
            return new DOMRect(10, 100, 100, 50)
        })
        adapter.mount(element)
        targetsDuringRead.length = 0
        motionTargetsDuringRead.length = 0

        adapter.measurePageRect('measure')

        expect(targetsDuringRead.length).toBeGreaterThan(0)
        for (const targets of targetsDuringRead) {
            expect(targets).toEqual([element, element, element])
        }
        expect(motionTargetsDuringRead.every((target) => target === null)).toBe(true)
        adapter.unmount()
    })

    it("keeps a transform animation that isn't Motion's own attached for the read", () => {
        // A page's own `el.animate([{ transform }])`: nothing on the
        // VisualElement animates a transform. Upstream only demotes Motion's
        // transform group (`transformGroups.get(instance)?.demote()`,
        // create-projection-node.ts @ v14.2.0 123-124), so this stays applied.
        const user = stubAnimation([{ transform: 'translateY(40px)' }])
        stubAnimations([user])
        const targetsDuringRead: Array<Element | null> = []
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
            targetsDuringRead.push(user.effect.target)
            return new DOMRect(10, user.effect.target ? 140 : 100, 100, 50)
        })
        adapter.mount(element)
        targetsDuringRead.length = 0

        const rect = adapter.measurePageRect('measure')

        expect(targetsDuringRead.length).toBeGreaterThan(0)
        expect(targetsDuringRead.every((target) => target === element)).toBe(true)
        expect(rect!.top).toBe(140)
        adapter.unmount()
    })

    it('reads every element of an ancestor chain before writing any inline transform', () => {
        // Three nested adapters, each with an accelerated Motion transform and
        // an inline transform the read has to strip. Interleaving a read
        // (`getAnimations()`) with each element's inline write forces one style
        // recalc per element; reading all first costs one.
        const events: string[] = []
        const chain: Array<{ el: HTMLElement; adapter: MotionDomProjectionAdapter }> = []
        let parent: MotionDomProjectionAdapter | null = null
        for (const id of ['outer', 'middle', 'inner']) {
            const el = document.createElement('div')
            el.id = id
            ;(chain.at(-1)?.el ?? document.body).appendChild(el)
            const node: MotionDomProjectionAdapter = new MotionDomProjectionAdapter({ parent })
            node.updateOptions({ layout: true })
            markMotionTransformAccelerated(node)
            const animation = stubAnimation([{ transform: 'translateX(20px)' }])
            animation.effect.target = el
            el.getAnimations = () => {
                events.push(`read:${id}`)
                return [animation] as unknown as Animation[]
            }
            node.mount(el)
            el.style.transform = 'translateX(5px)'
            const style = el.style
            let value = style.transform
            Object.defineProperty(style, 'transform', {
                configurable: true,
                get: () => value,
                set: (next: string) => {
                    events.push(`write:${id}`)
                    value = next
                }
            })
            chain.push({ el, adapter: node })
            parent = node
        }
        events.length = 0

        chain.at(-1)!.adapter.measurePageRect('measure')

        const firstWrite = events.findIndex((event) => event.startsWith('write:'))
        const lastRead = events.findLastIndex((event) => event.startsWith('read:'))
        expect(events.filter((event) => event.startsWith('read:'))).toEqual([
            'read:outer',
            'read:middle',
            'read:inner'
        ])
        expect(lastRead, events.join(' ')).toBeLessThan(firstWrite)
        for (const { adapter } of [...chain].reverse()) adapter.unmount()
    })

    it('measures normally when the element has no getAnimations', () => {
        ;(element as unknown as { getAnimations: unknown }).getAnimations = undefined
        setScrollAndRect(element, 0, 100)
        adapter.mount(element)

        const rect = adapter.measurePageRect('measure')

        expect(rect).toMatchObject({ left: 10, top: 100, width: 100, height: 50 })
        adapter.unmount()
    })
})

/**
 * `didMount` mirrors upstream `MeasureLayout.componentDidMount`'s
 * `if (hasTakenAnySnapshot) projection.root.didUpdate()` (framer-motion
 * `motion/features/layout/MeasureLayout.tsx` @ v14.2.0, 51-53). The flag is
 * module-level, like upstream's, so each case imports a fresh module.
 */
describe('MotionDomProjectionAdapter.didMount', () => {
    const freshAdapter = async () => {
        const { MotionDomProjectionAdapter: Adapter } = await import('./motionDomProjection.js')
        const element = document.createElement('div')
        document.body.appendChild(element)
        const adapter = new Adapter()
        adapter.updateOptions({ layout: true })
        return { Adapter, adapter, element }
    }

    beforeEach(() => {
        vi.useRealTimers()
        vi.resetModules()
    })

    // motion-dom (and so the shared projection root) isn't re-imported by
    // `resetModules`; drop each case's spies so call counts don't carry over.
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('skips the root update until a snapshot has been taken', async () => {
        const { adapter, element } = await freshAdapter()
        adapter.mount(element)
        const didUpdate = vi.spyOn(adapter.projection.root!, 'didUpdate')

        adapter.didMount()

        expect(didUpdate).not.toHaveBeenCalled()
        adapter.unmount()
    })

    it('runs the root update on mount once any adapter has taken a snapshot', async () => {
        const { Adapter, adapter, element } = await freshAdapter()
        adapter.mount(element)
        adapter.willUpdate()

        const mounting = new Adapter()
        mounting.updateOptions({ layout: true })
        const other = document.createElement('div')
        document.body.appendChild(other)
        mounting.mount(other)
        const didUpdate = vi.spyOn(mounting.projection.root!, 'didUpdate')
        const willUpdate = vi.spyOn(mounting.projection, 'willUpdate')

        mounting.didMount()

        expect(didUpdate).toHaveBeenCalledTimes(1)
        expect(willUpdate).not.toHaveBeenCalled()
        mounting.unmount()
        adapter.unmount()
    })

    it('counts a layout node unmounting as a snapshot', async () => {
        const { Adapter, adapter, element } = await freshAdapter()
        adapter.mount(element)
        adapter.unmount()

        const mounting = new Adapter()
        mounting.updateOptions({ layout: true })
        mounting.mount(element)
        const didUpdate = vi.spyOn(mounting.projection.root!, 'didUpdate')

        mounting.didMount()

        expect(didUpdate).toHaveBeenCalledTimes(1)
        mounting.unmount()
    })

    it('is a no-op before mount', async () => {
        const { adapter } = await freshAdapter()
        expect(() => adapter.didMount()).not.toThrow()
    })
})

/**
 * `didUpdate` is the Svelte side of a React commit. Upstream every commit
 * schedules the root update on the microtask batcher's read step
 * (`didUpdate` → `microtask.read(scheduleUpdate)`, motion-dom
 * `create-projection-node.ts` @ v14.2.0, 847-852) and a VisualElement render
 * on its render step (`scheduleRenderMicrotask()`, framer-motion
 * `use-visual-element.ts` @ v14.2.0, 157-158). The render runs after the
 * update, so it sees what the update did: a commit that moved nothing has
 * `finishAnimation` clear the finished projection's target (615-617,
 * 2445-2448), and that render lets the element's own transform show again
 * (`applyProjectionStyles`, 2042-2055).
 */
describe('MotionDomProjectionAdapter.didUpdate', () => {
    beforeEach(() => {
        vi.useRealTimers()
    })

    afterEach(() => {
        vi.restoreAllMocks()
        document.body.innerHTML = ''
    })

    it('renders the VisualElement after the root update it schedules', async () => {
        const element = document.createElement('div')
        document.body.appendChild(element)
        const adapter = new MotionDomProjectionAdapter()
        adapter.updateOptions({ layout: true })
        adapter.mount(element)
        // `update()` is the root's flush (847-852); `IProjectionNode` doesn't type it.
        const root = adapter.projection.root as unknown as { update: () => void }
        const update = vi.spyOn(root, 'update')
        const render = vi.spyOn(adapter.visualElement, 'render')

        adapter.willUpdate()
        adapter.didUpdate()
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(update).toHaveBeenCalledTimes(1)
        expect(render).toHaveBeenCalled()
        expect(render.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
            update.mock.invocationCallOrder[0]
        )
        adapter.unmount()
    })
})

/**
 * Single-VisualElement invariant (#449, plan 001).
 *
 * `visualElementStore` is a `WeakMap<instance, VisualElement>` written in
 * `VisualElement.mount()`. If the container and this adapter each mounted their
 * own VisualElement on the same element they would overwrite each other in the
 * store and double-render, so the container injects its instance here.
 */
describe('MotionDomProjectionAdapter visual-element injection', () => {
    let element: HTMLElement

    beforeEach(() => {
        vi.useRealTimers()
        element = document.createElement('div')
        document.body.appendChild(element)
    })

    it('uses an injected VisualElement and registers exactly that one in the store', () => {
        const visualElement = createMotionVisualElement({ props: { animate: { opacity: 1 } } })
        const adapter = new MotionDomProjectionAdapter({ visualElement })
        expect(adapter.visualElement).toBe(visualElement)

        adapter.updateOptions({ layout: true })
        adapter.mount(element)

        expect(visualElementStore.get(element)).toBe(visualElement)
        expect(visualElement.projection).toBe(adapter.projection)
        adapter.unmount()
    })

    it('tolerates an injected VisualElement that its owner already mounted', () => {
        const visualElement = createMotionVisualElement({ props: {} })
        const adapter = new MotionDomProjectionAdapter({ visualElement })
        adapter.updateOptions({ layout: true })

        // Owner mounts first (the container's element-bind effect).
        visualElement.mount(element)
        const mountSpy = vi.spyOn(visualElement, 'mount')
        adapter.mount(element)

        expect(mountSpy).not.toHaveBeenCalled()
        expect(visualElementStore.get(element)).toBe(visualElement)
        // The layout is still seeded despite the skipped mount.
        expect(adapter.lastMeasuredRect).not.toBeNull()
        adapter.unmount()
    })

    it('merges into an injected VisualElement props instead of replacing them', () => {
        const visualElement = createMotionVisualElement({
            props: { animate: { opacity: 1 }, variants: { a: { opacity: 0 } } }
        })
        const adapter = new MotionDomProjectionAdapter({ visualElement })
        adapter.updateOptions({ layout: true, transition: { duration: 1 }, style: { x: 5 } })

        // The owner's props survive…
        expect(visualElement.getProps().animate).toEqual({ opacity: 1 })
        expect(visualElement.getProps().variants).toEqual({ a: { opacity: 0 } })
        // …and the adapter's own contributions land.
        expect(visualElement.getProps().transition).toEqual({ duration: 1 })
        expect((visualElement.getProps() as { style?: unknown }).style).toEqual({ x: 5 })
    })

    it('preserves the injected presence context before feature registration', () => {
        const presenceContext = {
            id: 'owned',
            isPresent: true,
            register: vi.fn(() => vi.fn()),
            onExitComplete: vi.fn()
        }
        const visualElement = createMotionVisualElement({
            props: { exit: { opacity: 0 } },
            presenceContext
        })
        const adapter = new MotionDomProjectionAdapter({ visualElement })
        adapter.updateOptions({ layout: true })
        expect(visualElement.presenceContext).toBe(presenceContext)
        adapter.mount(element)
        visualElement.updateFeatures()
        expect(presenceContext.register).toHaveBeenCalledTimes(1)
        adapter.updateOptions({ layout: false })
        expect(visualElement.presenceContext).toBe(presenceContext)
        adapter.unmount()
    })

    it('still constructs its own VisualElement with no injection', () => {
        const adapter = new MotionDomProjectionAdapter()
        adapter.updateOptions({ layout: true, transition: { duration: 1 } })
        adapter.mount(element)

        expect(visualElementStore.get(element)).toBe(adapter.visualElement)
        expect(adapter.visualElement.getProps().transition).toEqual({ duration: 1 })
        adapter.unmount()
    })
})

/**
 * LayoutGroup node-group membership (plan 007 D3). Upstream MeasureLayout
 * adds the projection node to `layoutGroup.group` on mount and removes it on
 * unmount (MeasureLayout.tsx componentDidMount / componentWillUnmount); the
 * group snapshots every non-dirty member when any member `willUpdate`s or
 * leaves (motion-dom projection/node/group.ts).
 */
describe('MotionDomProjectionAdapter node group membership', () => {
    const mountAt = (adapter: MotionDomProjectionAdapter, top: number) => {
        const element = document.createElement('div')
        document.body.appendChild(element)
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, top, 100, 50))
        adapter.updateOptions({ layout: true })
        adapter.mount(element)
        return element
    }

    beforeEach(() => {
        vi.useRealTimers()
        document.documentElement.scrollTop = 0
    })

    it("a member's willUpdate snapshots the other members (pre-patch fan-out)", () => {
        const group = nodeGroup()
        const a = new MotionDomProjectionAdapter({ group })
        const b = new MotionDomProjectionAdapter({ group })
        mountAt(a, 0)
        mountAt(b, 100)
        expect(b.projection.snapshot).toBeUndefined()

        a.willUpdate()

        expect(b.projection.snapshot).toBeDefined()
        expect(b.projection.isLayoutDirty).toBe(true)
        a.unmount()
        b.unmount()
    })

    it('unmounting a member snapshots the remaining members', () => {
        const group = nodeGroup()
        const a = new MotionDomProjectionAdapter({ group })
        const b = new MotionDomProjectionAdapter({ group })
        mountAt(a, 0)
        mountAt(b, 100)
        expect(b.projection.snapshot).toBeUndefined()

        a.unmount()

        expect(b.projection.snapshot).toBeDefined()
        b.unmount()
    })

    it('a sibling snapshotted via fan-out notifies its commit hook exactly once after root.didUpdate()', async () => {
        const group = nodeGroup()
        const a = new MotionDomProjectionAdapter({ group })
        const b = new MotionDomProjectionAdapter({ group })
        mountAt(a, 0)
        const bElement = mountAt(b, 100)
        const aHook = vi.fn()
        const bHook = vi.fn()
        a.onProjectionCommit(aHook)
        b.onProjectionCommit(bHook)

        a.willUpdate()
        // The DOM patch moves b down by 40px.
        vi.spyOn(bElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 140, 100, 50))
        a.didUpdate()
        // The upstream update pass flushes on a microtask.
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(bHook).toHaveBeenCalledTimes(1)
        expect(bHook).toHaveBeenCalledWith({ left: 10, top: 140, width: 100, height: 50 })
        expect(aHook).toHaveBeenCalledTimes(1)
        // The cached layout the observer path fans out is kept in step.
        expect(b.lastMeasuredRect).toEqual({ left: 10, top: 140, width: 100, height: 50 })
        a.unmount()
        b.unmount()
    })

    it('an ungrouped adapter never fires its commit hook', async () => {
        const a = new MotionDomProjectionAdapter()
        mountAt(a, 0)
        const hook = vi.fn()
        a.onProjectionCommit(hook)

        a.willUpdate()
        a.didUpdate()
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(hook).not.toHaveBeenCalled()
        a.unmount()
    })

    it('adapters without a group, or in different groups, are not snapshotted', () => {
        const a = new MotionDomProjectionAdapter({ group: nodeGroup() })
        const other = new MotionDomProjectionAdapter({ group: nodeGroup() })
        const ungrouped = new MotionDomProjectionAdapter()
        mountAt(a, 0)
        mountAt(other, 100)
        mountAt(ungrouped, 200)

        a.willUpdate()

        expect(other.projection.snapshot).toBeUndefined()
        expect(ungrouped.projection.snapshot).toBeUndefined()
        a.unmount()
        other.unmount()
        ungrouped.unmount()
    })
})

/**
 * Observer-path group fan-out and group boundaries (plan 007 D5) and
 * separate-group ancestor following (D6).
 */
describe('MotionDomProjectionAdapter observed commits across node groups', () => {
    const rects = new Map<HTMLElement, DOMRect>()
    const place = (element: HTMLElement, top: number, left = 10) =>
        rects.set(element, new DOMRect(left, top, 100, 50))
    const mount = (adapter: MotionDomProjectionAdapter, top: number, left = 10) => {
        const element = document.createElement('div')
        document.body.appendChild(element)
        place(element, top, left)
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => rects.get(element)!)
        adapter.updateOptions({ layout: true })
        adapter.mount(element)
        return element
    }
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
    const rect = (top: number, left = 10) => ({ left, top, width: 100, height: 50 })

    beforeEach(() => {
        vi.useRealTimers()
        document.documentElement.scrollTop = 0
        rects.clear()
    })

    it('seeds a same-group descendant and the other group members, not a different-group descendant', async () => {
        const group = nodeGroup()
        const parent = new MotionDomProjectionAdapter({ group })
        const sameGroupChild = new MotionDomProjectionAdapter({ parent, group })
        const separateChild = new MotionDomProjectionAdapter({ parent, group: nodeGroup() })
        const sibling = new MotionDomProjectionAdapter({ group })
        const parentElement = mount(parent, 100)
        mount(sameGroupChild, 105)
        mount(separateChild, 120)
        mount(sibling, 300)

        place(parentElement, 175)
        parent.commitObservedLayoutChange(rect(100))

        expect(sameGroupChild.projection.snapshot?.layoutBox.y.min).toBe(105)
        expect(sibling.projection.snapshot?.layoutBox.y.min).toBe(300)
        expect(sibling.projection.isLayoutDirty).toBe(true)
        expect(separateChild.projection.snapshot).toBeUndefined()
        expect(separateChild.projection.isLayoutDirty).toBe(false)

        await flush()
        for (const adapter of [separateChild, sameGroupChild, sibling, parent]) adapter.unmount()
    })

    it('keeps a group member that is already layout-dirty on its own (pre-patch) snapshot', async () => {
        const group = nodeGroup()
        const a = new MotionDomProjectionAdapter({ group })
        const b = new MotionDomProjectionAdapter({ group })
        const aElement = mount(a, 0)
        mount(b, 100)
        // A real pre-patch snapshot via b's own willUpdate…
        b.projection.willUpdate()
        const ownSnapshot = b.projection.snapshot
        expect(ownSnapshot).toBeDefined()

        place(aElement, 40)
        a.commitObservedLayoutChange(rect(0))

        // …is not overwritten by the cached one.
        expect(b.projection.snapshot).toBe(ownSnapshot)
        await flush()
        a.unmount()
        b.unmount()
    })

    it('an ungrouped committer still seeds its ungrouped descendants (unchanged behaviour)', async () => {
        const parent = new MotionDomProjectionAdapter()
        const child = new MotionDomProjectionAdapter({ parent })
        const parentElement = mount(parent, 100)
        mount(child, 105)

        place(parentElement, 175)
        parent.commitObservedLayoutChange(rect(100))

        expect(child.projection.snapshot?.layoutBox.y.min).toBe(105)
        await flush()
        child.unmount()
        parent.unmount()
    })

    it('an ungrouped committer does not seed a grouped descendant', async () => {
        const parent = new MotionDomProjectionAdapter()
        const child = new MotionDomProjectionAdapter({ parent, group: nodeGroup() })
        const parentElement = mount(parent, 100)
        mount(child, 105)

        place(parentElement, 175)
        parent.commitObservedLayoutChange(rect(100))

        expect(child.projection.snapshot).toBeUndefined()
        await flush()
        child.unmount()
        parent.unmount()
    })

    describe('isFollowingAncestorUpdate', () => {
        const setup = () => {
            const parent = new MotionDomProjectionAdapter({ group: nodeGroup() })
            const child = new MotionDomProjectionAdapter({ parent, group: nodeGroup() })
            const parentElement = mount(parent, 100)
            const childElement = mount(child, 105)
            return { parent, child, parentElement, childElement }
        }

        it('is true when the offset from an ancestor that already updated is unchanged', async () => {
            const { parent, child, parentElement, childElement } = setup()
            parent.willUpdate()
            place(parentElement, 175)
            place(childElement, 180)
            parent.didUpdate()
            await flush()

            expect(child.isFollowingAncestorUpdate(rect(105), rect(180))).toBe(true)
            child.unmount()
            parent.unmount()
        })

        it('is true when the ancestor moved but has not committed yet', () => {
            const { parent, child, parentElement, childElement } = setup()
            place(parentElement, 175)
            place(childElement, 180)

            expect(child.isFollowingAncestorUpdate(rect(105), rect(180))).toBe(true)
            child.unmount()
            parent.unmount()
        })

        it("is false when the node's own offset changed", async () => {
            const { parent, child, parentElement, childElement } = setup()
            parent.willUpdate()
            place(parentElement, 175)
            place(childElement, 180, 60)
            parent.didUpdate()
            await flush()

            expect(child.isFollowingAncestorUpdate(rect(105), rect(180, 60))).toBe(false)
            expect(child.isFollowingAncestorUpdate(rect(105), rect(200))).toBe(false)
            child.unmount()
            parent.unmount()
        })

        it('is false when the ancestor did not move', () => {
            const { parent, child, childElement } = setup()
            place(childElement, 180)

            expect(child.isFollowingAncestorUpdate(rect(105), rect(180))).toBe(false)
            child.unmount()
            parent.unmount()
        })

        it('is false for an ungrouped node', () => {
            const parent = new MotionDomProjectionAdapter()
            const ungrouped = new MotionDomProjectionAdapter({ parent })
            const parentElement = mount(parent, 100)
            mount(ungrouped, 105)
            place(parentElement, 175)

            expect(ungrouped.isFollowingAncestorUpdate(rect(105), rect(180))).toBe(false)
            ungrouped.unmount()
            parent.unmount()
        })

        it('is false for a layout-dirty (snapshotted) node', () => {
            const { parent, child, parentElement } = setup()
            place(parentElement, 175)
            child.projection.isLayoutDirty = true

            expect(child.isFollowingAncestorUpdate(rect(105), rect(180))).toBe(false)
            child.projection.isLayoutDirty = false
            child.unmount()
            parent.unmount()
        })
    })
})

/**
 * Plan 007 Step 4b: the four checkpoint gaps.
 */
describe('MotionDomProjectionAdapter node-group gaps (plan 007 Step 4b)', () => {
    const rects = new Map<HTMLElement, DOMRect>()
    const place = (element: HTMLElement, top: number, left = 10) =>
        rects.set(element, new DOMRect(left, top, 100, 50))
    const mount = (
        adapter: MotionDomProjectionAdapter,
        top: number,
        options: { layout?: boolean; layoutId?: string } = { layout: true }
    ) => {
        const element = document.createElement('div')
        document.body.appendChild(element)
        place(element, top)
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => rects.get(element)!)
        adapter.updateOptions(options)
        adapter.mount(element)
        return element
    }
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
    const rect = (top: number, left = 10) => ({ left, top, width: 100, height: 50 })

    beforeEach(() => {
        vi.useRealTimers()
        document.documentElement.scrollTop = 0
        rects.clear()
    })

    it('(a) seeds a mid-animation group member from its on-screen (target) box', async () => {
        const group = nodeGroup()
        const a = new MotionDomProjectionAdapter({ group })
        const b = new MotionDomProjectionAdapter({ group })
        const aElement = mount(a, 0)
        mount(b, 100)
        // b is mid layout animation, drawn 60px above its layout slot.
        const target = { x: { min: 10, max: 110 }, y: { min: 40, max: 90 } }
        b.projection.currentAnimation = {} as never
        b.projection.target = target

        place(aElement, 40)
        a.commitObservedLayoutChange(rect(0))

        expect(b.projection.snapshot?.layoutBox.y.min).toBe(40)
        b.projection.currentAnimation = undefined
        await flush()
        a.unmount()
        b.unmount()
    })

    it('(a) seeds an idle group member from its cached layout', async () => {
        const group = nodeGroup()
        const a = new MotionDomProjectionAdapter({ group })
        const b = new MotionDomProjectionAdapter({ group })
        const aElement = mount(a, 0)
        mount(b, 100)
        b.projection.target = { x: { min: 10, max: 110 }, y: { min: 40, max: 90 } }

        place(aElement, 40)
        a.commitObservedLayoutChange(rect(0))

        expect(b.projection.snapshot?.layoutBox.y.min).toBe(100)
        await flush()
        a.unmount()
        b.unmount()
    })

    it('(b) unmounting a member seeds the others from cached (pre-removal) layouts', async () => {
        const group = nodeGroup()
        const a = new MotionDomProjectionAdapter({ group })
        const b = new MotionDomProjectionAdapter({ group })
        mount(a, 0)
        const bElement = mount(b, 100)
        // Svelte has already removed a's DOM: b now measures in a's old slot.
        place(bElement, 0)
        const onCommit = vi.fn()
        b.onProjectionCommit(onCommit)

        a.unmount()

        // Seeded from the cache, not the live post-removal read (0).
        expect(b.projection.snapshot?.layoutBox.y.min).toBe(100)
        await flush()
        // …and the update pass ran: b was re-measured at its new slot.
        expect(onCommit).toHaveBeenCalledWith(rect(0))
        b.unmount()
    })

    it("(c) a layoutId-only member's willUpdate fans out to its group", async () => {
        const group = nodeGroup()
        const trigger = new MotionDomProjectionAdapter({ group })
        const sibling = new MotionDomProjectionAdapter({ group })
        mount(trigger, 0, { layoutId: 'expander' })
        const siblingElement = mount(sibling, 100)
        const onCommit = vi.fn()
        sibling.onProjectionCommit(onCommit)

        trigger.willUpdate()
        expect(sibling.projection.snapshot?.layoutBox.y.min).toBe(100)
        place(siblingElement, 175)
        trigger.didUpdate()
        await flush()

        expect(onCommit).toHaveBeenCalledWith(rect(175))
        trigger.unmount()
        sibling.unmount()
    })

    it('(d) a commit whose own subtree changed seeds separate-group descendants too', async () => {
        const parent = new MotionDomProjectionAdapter({ group: nodeGroup() })
        const child = new MotionDomProjectionAdapter({ parent, group: nodeGroup() })
        const parentElement = mount(parent, 100)
        mount(child, 105)

        place(parentElement, 175)
        parent.commitObservedLayoutChange(rect(100), { ownSubtreeChanged: true })

        expect(child.projection.snapshot?.layoutBox.y.min).toBe(105)
        await flush()
        child.unmount()
        parent.unmount()
    })

    it("(d) keeps a following descendant's cached layout in step with its ancestor's moves", async () => {
        const parent = new MotionDomProjectionAdapter({ group: nodeGroup() })
        const child = new MotionDomProjectionAdapter({ parent, group: nodeGroup() })
        const parentElement = mount(parent, 100)
        const childElement = mount(child, 105)

        // The ancestor moves by 75px; the separate-group child rides along
        // without being re-measured.
        place(parentElement, 175)
        place(childElement, 180)
        parent.commitObservedLayoutChange(rect(100))
        expect(child.projection.snapshot).toBeUndefined()
        await flush()

        // A later own-subtree commit seeds the child from its CURRENT slot.
        expect(child.lastMeasuredRect).toEqual(rect(180))
        child.unmount()
        parent.unmount()
    })
})

/**
 * An observed reflow mid a shared `layoutId` animation (plan 012 A5). The
 * arriving node is drawn at its projection target, out of the previous
 * lead's box; upstream's re-render snapshots that on-screen box
 * (`willUpdate` → `updateSnapshot` → `measure`, create-projection-node.ts
 * 967-979, 1080-1101 @ v14.7.1), so the restart continues from where it is
 * painted instead of from its own (never drawn) slot.
 */
describe('MotionDomProjectionAdapter.commitObservedLayoutChange mid a shared animation (plan 012 A5)', () => {
    const rects = new Map<HTMLElement, DOMRect>()
    const place = (element: HTMLElement, top: number) =>
        rects.set(element, new DOMRect(10, top, 100, 50))
    const mount = (adapter: MotionDomProjectionAdapter, top: number) => {
        const element = document.createElement('div')
        document.body.appendChild(element)
        place(element, top)
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => rects.get(element)!)
        adapter.updateOptions({ layoutId: 'measurer' })
        adapter.mount(element)
        return element
    }
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
    /** Drawn 60px above its 100px slot, at the previous lead's box. */
    const onScreenTarget = () => ({ x: { min: 10, max: 110 }, y: { min: 40, max: 90 } })

    beforeEach(() => {
        vi.useRealTimers()
        document.documentElement.scrollTop = 0
        rects.clear()
    })

    it('seeds the committer from its on-screen target box, not its cached layout or the passed rect', async () => {
        const previousLead = new MotionDomProjectionAdapter()
        const arriving = new MotionDomProjectionAdapter()
        mount(previousLead, 40)
        const element = mount(arriving, 100)
        const projection = arriving.projection
        projection.resumingFrom = previousLead.projection as typeof projection.resumingFrom
        projection.currentAnimation = {} as never
        projection.target = onScreenTarget()

        // An unrelated reflow nudges the slot by 1px.
        place(element, 101)
        arriving.commitObservedLayoutChange({ left: 10, top: 100, width: 100, height: 50 })

        expect(projection.snapshot?.layoutBox.y.min).toBe(40)
        projection.resumingFrom = undefined
        projection.currentAnimation = undefined
        await flush()
        arriving.unmount()
        previousLead.unmount()
    })

    it('seeds from the cached layout with no shared animation running', async () => {
        const arriving = new MotionDomProjectionAdapter()
        const element = mount(arriving, 100)
        arriving.projection.target = onScreenTarget()

        place(element, 101)
        arriving.commitObservedLayoutChange()

        expect(arriving.projection.snapshot?.layoutBox.y.min).toBe(100)
        await flush()
        arriving.unmount()
    })
})

/**
 * LayoutGroup `forceRender` (plan 007 D7): `commitGroup` re-commits every
 * member of a node group from cached / on-screen snapshots.
 */
describe('MotionDomProjectionAdapter.commitGroup', () => {
    const rects = new Map<HTMLElement, DOMRect>()
    const place = (element: HTMLElement, top: number) =>
        rects.set(element, new DOMRect(10, top, 100, 50))
    const mount = (adapter: MotionDomProjectionAdapter, top: number) => {
        const element = document.createElement('div')
        document.body.appendChild(element)
        place(element, top)
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => rects.get(element)!)
        adapter.updateOptions({ layout: true })
        adapter.mount(element)
        return element
    }
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

    beforeEach(() => {
        vi.useRealTimers()
        document.documentElement.scrollTop = 0
        rects.clear()
    })

    it('re-measures every member and reports the ones that moved', async () => {
        const group = nodeGroup()
        const a = new MotionDomProjectionAdapter({ group })
        const b = new MotionDomProjectionAdapter({ group })
        mount(a, 0)
        const bElement = mount(b, 200)
        const aCommit = vi.fn()
        const bCommit = vi.fn()
        a.onProjectionCommit(aCommit)
        b.onProjectionCommit(bCommit)
        // A sibling exit freed space above b, unobserved so far.
        place(bElement, 120)

        MotionDomProjectionAdapter.commitGroup(group)
        expect(b.projection.snapshot?.layoutBox.y.min).toBe(200)
        await flush()

        expect(bCommit).toHaveBeenCalledWith({ left: 10, top: 120, width: 100, height: 50 })
        expect(aCommit).toHaveBeenCalledTimes(1)
        expect(b.lastMeasuredRect?.top).toBe(120)
        a.unmount()
        b.unmount()
    })

    it('is a no-op for an unknown or empty group', () => {
        expect(() => MotionDomProjectionAdapter.commitGroup(nodeGroup())).not.toThrow()
    })
})

describe('MotionDomProjectionAdapter.currentVisualPageRect (plan 008)', () => {
    type RectLike = { left: number; top: number; width: number; height: number }
    const rects = new Map<HTMLElement, DOMRect>()
    /** Give an element a viewport rect (page rect minus current scroll). */
    const place = (element: HTMLElement, top: number, left = 10) =>
        rects.set(element, new DOMRect(left, top, 100, 50))
    const create = (parent: HTMLElement = document.body) => {
        const element = document.createElement('div')
        parent.appendChild(element)
        const reads = vi
            .spyOn(element, 'getBoundingClientRect')
            .mockImplementation(() => rects.get(element)!)
        return { element, reads }
    }
    // motion-dom's own frameloop (it captured the real rAF at load, so an
    // earlier spec's rAF spy can't strand these waits).
    const frames = async (count: number) => {
        for (let i = 0; i < count; i++) {
            await new Promise<void>((resolve) => frame.postRender(() => resolve()))
        }
    }
    const within1px = (actual: RectLike | null, expected: RectLike) => {
        expect(actual).not.toBeNull()
        for (const key of ['left', 'top', 'width', 'height'] as const) {
            expect(Math.abs(actual![key] - expected[key]), key).toBeLessThanOrEqual(1)
        }
    }

    /**
     * The box a browser would draw for `layout` under the element's inline
     * `transform` / `transform-origin`, for the transform functions
     * motion-dom writes (translate3d / translateX / translateY / scale).
     */
    const drawnBox = (element: HTMLElement, layout: RectLike): RectLike => {
        let tx = 0
        let ty = 0
        let sx = 1
        let sy = 1
        for (const [, name, args] of element.style.transform.matchAll(/(\w+)\(([^)]*)\)/g)) {
            const values = args.split(',').map((part) => parseFloat(part))
            if (name === 'translate3d' || name === 'translate') {
                tx += values[0]
                ty += values[1] ?? 0
            } else if (name === 'translateX') tx += values[0]
            else if (name === 'translateY') ty += values[0]
            else if (name === 'scale') {
                sx *= values[0]
                sy *= values[1] ?? values[0]
            } else if (name === 'scaleX') sx *= values[0]
            else if (name === 'scaleY') sy *= values[0]
        }
        const [ox = '50%', oy = '50%'] = (element.style.transformOrigin || '50% 50%').split(' ')
        const origin = (value: string, start: number, size: number) =>
            value.endsWith('%')
                ? start + (parseFloat(value) / 100) * size
                : start + parseFloat(value)
        const originX = origin(ox, layout.left, layout.width)
        const originY = origin(oy, layout.top, layout.height)
        return {
            left: originX + (layout.left - originX) * sx + tx,
            top: originY + (layout.top - originY) * sy + ty,
            width: layout.width * sx,
            height: layout.height * sy
        }
    }

    beforeEach(() => {
        vi.useRealTimers()
        document.documentElement.scrollTop = 0
        rects.clear()
    })

    it('is null before mount', () => {
        expect(new MotionDomProjectionAdapter().currentVisualPageRect()).toBeNull()
    })

    it('idle: returns the last layout read, with zero DOM reads of its own', async () => {
        const adapter = new MotionDomProjectionAdapter()
        adapter.updateOptions({ layoutId: 'idle' })
        const { element, reads } = create()
        place(element, 100)
        adapter.mount(element)
        reads.mockClear()

        expect(adapter.currentVisualPageRect()).toEqual({
            left: 10,
            top: 100,
            width: 100,
            height: 50
        })
        // The element moved, but nothing read it yet: still the last read.
        place(element, 300)
        await frames(2)
        expect(adapter.currentVisualPageRect()?.top).toBe(100)
        expect(reads).not.toHaveBeenCalled()

        // Any read (an update boundary) refreshes it.
        adapter.measurePageRect('measure', { silent: true })
        expect(adapter.currentVisualPageRect()?.top).toBe(300)
        adapter.unmount()
        expect(adapter.currentVisualPageRect()).toBeNull()
    })

    it('mid layout animation: the projected box, within 1px of the drawn box', async () => {
        const adapter = new MotionDomProjectionAdapter()
        adapter.updateOptions({
            layoutId: 'animating',
            transition: { duration: 10, ease: 'linear' }
        })
        const { element, reads } = create()
        place(element, 100)
        adapter.mount(element)

        // The layout moved 200px down; animate from the old slot.
        place(element, 300)
        adapter.commitObservedLayoutChange({ left: 10, top: 100, width: 100, height: 50 })
        await frames(6)
        expect(adapter.isAnimating()).toBe(true)

        reads.mockClear()
        const rect = adapter.currentVisualPageRect()
        expect(reads).not.toHaveBeenCalled()
        // Early in a 10s glide from 100 to 300: drawn near the old slot.
        expect(rect!.top).toBeLessThan(150)
        within1px(rect, drawnBox(element, { left: 10, top: 300, width: 100, height: 50 }))
        adapter.unmount()
    })

    it('mid transform animation: applies latestValues x/scale like the CSS transform', () => {
        const adapter = new MotionDomProjectionAdapter()
        adapter.updateOptions({ layoutId: 'transformed' })
        const { element, reads } = create()
        place(element, 100)
        adapter.mount(element)

        // e.g. `animate={{ x: 30, scale: 2 }}` part-way: the values live in
        // latestValues and render as a CSS transform.
        adapter.visualElement.latestValues.x = 30
        adapter.visualElement.latestValues.scale = 2
        adapter.visualElement.render()
        expect(element.style.transform).toContain('scale(2)')

        reads.mockClear()
        const rect = adapter.currentVisualPageRect()
        expect(reads).not.toHaveBeenCalled()
        expect(rect).toEqual({ left: -10, top: 75, width: 200, height: 100 })
        within1px(rect, drawnBox(element, { left: 10, top: 100, width: 100, height: 50 }))
        adapter.unmount()
    })

    it('inside a layoutScroll container: stays in measurePageRect space across scrolls', () => {
        const container = document.createElement('div')
        document.body.appendChild(container)
        let scrollTop = 200
        Object.defineProperty(container, 'scrollTop', {
            get: () => scrollTop,
            configurable: true
        })
        vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, 400))
        const parent = new MotionDomProjectionAdapter()
        parent.updateOptions({ layout: true, layoutScroll: true })
        parent.mount(container)

        const child = new MotionDomProjectionAdapter({ parent })
        child.updateOptions({ layoutId: 'scrolled' })
        const { element, reads } = create(container)
        // Content-space top 500 with the container scrolled 200: viewport 300.
        place(element, 500 - scrollTop)
        child.mount(element)
        const measured = child.measurePageRect('measure', { silent: true })
        expect(measured?.top).toBe(500)

        // Scrolling the container moves the element on screen but not in
        // (scroll-removed) page space: the handoff rect must not move.
        scrollTop = 350
        place(element, 500 - scrollTop)
        reads.mockClear()
        expect(child.currentVisualPageRect()).toEqual(measured)
        expect(reads).not.toHaveBeenCalled()
        // A fresh read agrees.
        expect(child.measurePageRect('measure', { silent: true })).toEqual(measured)
        child.unmount()
        parent.unmount()
    })

    describe('isDrawnAt (plan 008 Step 3b)', () => {
        it('explains a window scroll, but not a layout move, without reading the element', () => {
            document.documentElement.scrollTop = 0
            const adapter = new MotionDomProjectionAdapter()
            adapter.updateOptions({ layoutId: 'drawn' })
            const { element, reads } = create()
            place(element, 100)
            adapter.mount(element)
            reads.mockClear()

            expect(adapter.isDrawnAt({ left: 10, top: 100, width: 100, height: 50 })).toBe(true)
            // Within the 1px tolerance.
            expect(adapter.isDrawnAt({ left: 10.6, top: 100.8, width: 100, height: 50 })).toBe(true)
            // The window scrolled 40px: drawn 40px higher in the viewport.
            document.documentElement.scrollTop = 40
            expect(adapter.isDrawnAt({ left: 10, top: 60, width: 100, height: 50 })).toBe(true)
            // A layout shift nothing told the adapter about.
            expect(adapter.isDrawnAt({ left: 10, top: 132, width: 100, height: 50 })).toBe(false)
            expect(adapter.isDrawnAt({ left: 10, top: 60, width: 120, height: 50 })).toBe(false)
            expect(reads).not.toHaveBeenCalled()
            document.documentElement.scrollTop = 0
            adapter.unmount()
        })

        it('explains any move while this node or an ancestor layout-animates', () => {
            const parent = new MotionDomProjectionAdapter()
            parent.updateOptions({ layout: true })
            const { element: parentElement } = create()
            place(parentElement, 0)
            parent.mount(parentElement)
            const child = new MotionDomProjectionAdapter({ parent })
            child.updateOptions({ layoutId: 'follower' })
            const { element } = create(parentElement)
            place(element, 100)
            child.mount(element)

            const elsewhere = { left: 10, top: 170, width: 100, height: 50 }
            expect(child.isDrawnAt(elsewhere)).toBe(false)
            parent.projection.currentAnimation = {} as never
            expect(child.isDrawnAt(elsewhere)).toBe(true)
            parent.projection.currentAnimation = undefined
            child.projection.currentAnimation = {} as never
            expect(child.isDrawnAt(elsewhere)).toBe(true)
            child.projection.currentAnimation = undefined
            child.unmount()
            parent.unmount()
        })

        it('is false before mount', () => {
            expect(
                new MotionDomProjectionAdapter().isDrawnAt({ left: 0, top: 0, width: 1, height: 1 })
            ).toBe(false)
        })
    })
})

describe('MotionDomProjectionAdapter.switchLayoutId (#1411)', () => {
    // Port target: framer-motion `MeasureLayout.tsx:59-106 @ v14.7.1`.
    type Switchable = MotionDomProjectionAdapter & {
        switchLayoutId(layoutId: string | undefined): (() => void) | undefined
    }
    const mounted: MotionDomProjectionAdapter[] = []
    const mount = (layoutId: string | undefined, left = 10) => {
        const adapter = new MotionDomProjectionAdapter() as Switchable
        const element = document.createElement('div')
        document.body.appendChild(element)
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(left, 0, 100, 50))
        adapter.updateOptions({ layoutId })
        adapter.mount(element)
        mounted.push(adapter)
        return adapter
    }
    const stackOf = (adapter: MotionDomProjectionAdapter, id: string) =>
        adapter.projection.root!.sharedNodes.get(id)

    beforeEach(() => {
        vi.useRealTimers()
    })
    afterEach(() => {
        for (const adapter of mounted.splice(0)) adapter.unmount()
    })

    it('updateOptions does not move a mounted node to another layoutId', () => {
        const adapter = mount('switch-a')
        adapter.updateOptions({ layoutId: 'switch-b' })
        expect(adapter.projection.options.layoutId).toBe('switch-a')
    })

    it("moves the node from the old layoutId's stack to lead the new one", () => {
        const adapter = mount('switch-c')
        adapter.switchLayoutId('switch-d')
        expect(adapter.projection.options.layoutId).toBe('switch-d')
        expect(
            stackOf(adapter, 'switch-c')?.members.includes(adapter.projection as never) ?? false
        ).toBe(false)
        expect(stackOf(adapter, 'switch-d')?.lead === adapter.projection).toBe(true)
    })

    it('unlinks the lead that took over the old stack from the switching node', () => {
        const other = mount('switch-e', 300)
        const adapter = mount('switch-e')
        const stack = stackOf(adapter, 'switch-e')!
        expect(stack.lead === adapter.projection).toBe(true)
        // As if the lead had been animating from the switching node.
        other.projection.resumeFrom = adapter.projection as never
        other.projection.currentAnimation = {} as never

        adapter.switchLayoutId('switch-f')

        expect(stack.lead === other.projection).toBe(true)
        expect(other.projection.resumeFrom).toBeUndefined()
        expect(other.projection.currentAnimation).toBeUndefined()
        expect(adapter.projection.resumingFrom).toBeUndefined()
    })

    it('shows a node that loses its layoutId and returns no takeover', () => {
        const adapter = mount('switch-g')
        expect(adapter.switchLayoutId(undefined)).toBeUndefined()
        expect(adapter.projection.needsShow).toBe(true)
        expect(adapter.projection.options.layoutId).toBeUndefined()
    })

    it('takes over instantly from a lead that is still in the stack', () => {
        const lead = mount('switch-h', 300)
        const adapter = mount('switch-i')
        const snapshot = { measuredBox: {} } as never
        adapter.projection.snapshot = snapshot

        const takeOver = adapter.switchLayoutId('switch-h')
        expect(adapter.projection.resumeFrom === lead.projection).toBe(true)
        takeOver?.()

        expect(lead.projection.isVisible).toBe(false)
        expect(adapter.projection.resumeFrom).toBeUndefined()
        expect(adapter.projection.snapshot === snapshot).toBe(true)
    })

    it('animates from a lead that is no longer a member or is exiting', () => {
        const gone = mount('switch-j', 300)
        const adapter = mount('switch-k')
        const takeOverGone = adapter.switchLayoutId('switch-j')
        // The lead left the stack in the same update.
        stackOf(adapter, 'switch-j')!.members.splice(
            stackOf(adapter, 'switch-j')!.members.indexOf(gone.projection as never),
            1
        )
        takeOverGone?.()
        expect(gone.projection.isVisible).not.toBe(false)
        expect(adapter.projection.resumeFrom === gone.projection).toBe(true)

        const exiting = mount('switch-l', 300)
        const other = mount('switch-m')
        exiting.projection.isPresent = false
        const takeOverExiting = other.switchLayoutId('switch-l')
        takeOverExiting?.()
        expect(exiting.projection.isVisible).not.toBe(false)
        expect(other.projection.resumeFrom === exiting.projection).toBe(true)
    })
})

describe('MotionDomProjectionAdapter mount-time takeover of a live lead (#1411 A1)', () => {
    const rects = new Map<HTMLElement, DOMRect>()
    const mounted: MotionDomProjectionAdapter[] = []
    const mount = (layoutId: string, rect: DOMRect) => {
        const adapter = new MotionDomProjectionAdapter()
        const element = document.createElement('div')
        document.body.appendChild(element)
        rects.set(element, rect)
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => rects.get(element)!)
        adapter.updateOptions({ layoutId })
        adapter.mount(element)
        mounted.push(adapter)
        return { adapter, element }
    }

    beforeEach(() => {
        vi.useRealTimers()
        document.documentElement.scrollTop = 0
        rects.clear()
    })
    afterEach(() => {
        for (const adapter of mounted.splice(0)) adapter.unmount()
    })

    // A1.2, the other half: a registry handoff after a real removal. Svelte
    // detaches the old holder before its teardown, so its node may still be
    // in the stack when the new one mounts. That detached lead is not live:
    // no mount-time update pass runs for it.
    it('runs no extra update pass when the previous lead is detached', () => {
        const { adapter: lead, element } = mount('a1-detached', new DOMRect(0, 0, 100, 50))
        element.remove()
        const { adapter } = mount('a1-detached', new DOMRect(300, 0, 100, 50))
        expect(adapter.projection.resumeFrom === lead.projection).toBe(true)
        const startUpdate = vi.spyOn(adapter.projection.root!, 'startUpdate')

        adapter.didMount()

        expect(startUpdate).not.toHaveBeenCalled()
        expect(adapter.mountedFromLiveLead).toBe(false)
    })

    // A1.2: when the mount itself moved the lead, `promote`'s measurement is
    // the moved box, so the lead's cached pre-mount box is used instead.
    it('snapshots the lead from its cached box when the mount moved it', () => {
        const { adapter: lead, element } = mount('a1-moved', new DOMRect(0, 0, 100, 50))
        // The new element's insertion pushes the lead down 80px.
        rects.set(element, new DOMRect(0, 80, 100, 50))
        const { adapter } = mount('a1-moved', new DOMRect(300, 0, 100, 50))
        expect(lead.projection.snapshot?.layoutBox.y.min).toBe(80)

        adapter.didMount()

        expect(adapter.mountedFromLiveLead).toBe(true)
        expect(lead.projection.snapshot?.layoutBox.y.min).toBe(0)
        expect(adapter.projection.snapshot === lead.projection.snapshot).toBe(true)
        expect(adapter.projection.isLayoutDirty).toBe(true)
    })
})

/**
 * Plan 007 (Motion 14.7.1, #1935): `layoutRoot`, `layoutAnchor` and
 * `layoutDependency` reach the projection node. Upstream passes `layoutRoot`
 * at creation (`use-visual-element.ts:229-248 @ v14.7.1`) and syncs
 * `layoutAnchor` / `layoutDependency` on every update (`MeasureLayout.tsx`
 * `layoutOptions`, 43-52), port of "keeps layoutAnchor in sync"
 * (`layout-id-change.test.tsx:102-112`).
 */
describe('MotionDomProjectionAdapter layout options sync (#1935)', () => {
    it('forwards layoutRoot, layoutAnchor and layoutDependency to the projection node', () => {
        const adapter = new MotionDomProjectionAdapter()
        adapter.updateOptions({
            layout: true,
            layoutRoot: true,
            layoutAnchor: { x: 0, y: 0 },
            layoutDependency: 1
        })
        expect(adapter.projection.options.layoutRoot).toBe(true)
        expect(adapter.projection.options.layoutAnchor).toEqual({ x: 0, y: 0 })
        expect(adapter.projection.options.layoutDependency).toBe(1)
    })

    it('keeps layoutAnchor and layoutDependency in sync, and a call without layoutRoot does not clear it', () => {
        const adapter = new MotionDomProjectionAdapter()
        adapter.updateOptions({
            layout: true,
            layoutRoot: true,
            layoutAnchor: { x: 0, y: 0 },
            layoutDependency: 1
        })
        adapter.updateOptions({
            layout: true,
            layoutAnchor: { x: 1, y: 1 },
            layoutDependency: 2
        })
        expect(adapter.projection.options.layoutAnchor).toEqual({ x: 1, y: 1 })
        expect(adapter.projection.options.layoutDependency).toBe(2)
        expect(adapter.projection.options.layoutRoot).toBe(true)
    })

    it('forwards layoutAnchor={false}', () => {
        const adapter = new MotionDomProjectionAdapter()
        adapter.updateOptions({ layout: true, layoutAnchor: false })
        expect(adapter.projection.options.layoutAnchor).toBe(false)
    })
})

/**
 * Plan 007 amendment A1 (#1935): Svelte detaches a departing `layoutId` lead
 * before its teardown, so its unmount-time `willUpdate()` would measure a
 * detached element and drop the zero box. The adapter gives it the snapshot
 * upstream takes while it is still attached (`create-projection-node.ts`
 * `unmount` 668-678, `willUpdate`, `updateSnapshot` 967-979 and `measure`
 * 1080-1103 @ v14.7.1), so `promote()` (`stack.ts:45-74`) hands it to the
 * arriving node with a foreign `source`: a shared snapshot.
 */
describe('MotionDomProjectionAdapter departing-lead snapshot (#1935 A1)', () => {
    const rects = new Map<HTMLElement, DOMRect>()
    const mounted: MotionDomProjectionAdapter[] = []
    const mount = (
        options: { layoutId?: string; layout?: boolean; layoutScroll?: boolean },
        rect: DOMRect,
        parent?: MotionDomProjectionAdapter
    ) => {
        const adapter = new MotionDomProjectionAdapter(parent ? { parent } : {})
        const element = document.createElement('div')
        document.body.appendChild(element)
        rects.set(element, rect)
        // A detached element reads as an all-zero box, like a browser.
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() =>
            element.isConnected ? rects.get(element)! : new DOMRect()
        )
        adapter.updateOptions(options)
        adapter.mount(element)
        mounted.push(adapter)
        return { adapter, element }
    }
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

    beforeEach(() => {
        vi.useRealTimers()
        document.documentElement.scrollTop = 0
        rects.clear()
    })
    afterEach(async () => {
        await flush()
        for (const adapter of mounted.splice(0)) adapter.unmount()
    })

    it('hands a detached lead its pre-removal box as a shared snapshot through promote()', () => {
        const { adapter: lead, element } = mount(
            { layoutId: 'a1-shared' },
            new DOMRect(10, 20, 100, 50)
        )
        element.remove()
        lead.unmount()

        const { adapter } = mount({ layoutId: 'a1-shared' }, new DOMRect(300, 20, 100, 50))

        const node = adapter.projection
        expect(node.resumeFrom === lead.projection).toBe(true)
        const snapshot = node.resumeFrom?.snapshot
        expect(snapshot).toBeDefined()
        expect(snapshot!.measuredBox.x.min).toBe(10)
        expect(snapshot!.layoutBox.x.min).toBe(10)
        // A foreign source: motion-dom's `isShared` (`notifyLayoutUpdate`).
        expect(snapshot!.source).toBe(lead.projection.id)
        expect(snapshot!.source).not.toBe(node.layout?.source)
        expect((adapter as { mountedFromSharedSnapshot?: boolean }).mountedFromSharedSnapshot).toBe(
            true
        )
        // Re-measured in the update pass with its path transforms reset.
        expect(node.isLayoutDirty).toBe(true)
    })

    it('removes the transforms from the layout box but keeps them in the measured box', () => {
        const { adapter: lead, element } = mount(
            { layoutId: 'a1-transform' },
            new DOMRect(90, 20, 100, 50)
        )
        // Drawn 80px right of its layout slot by its own `x`.
        lead.projection.latestValues.x = 80
        element.remove()
        lead.unmount()

        const { adapter } = mount({ layoutId: 'a1-transform' }, new DOMRect(300, 20, 100, 50))

        const snapshot = adapter.projection.resumeFrom?.snapshot
        expect(snapshot?.measuredBox.x.min).toBe(90)
        expect(snapshot?.layoutBox.x.min).toBe(10)
    })

    it('hands over a page-space measuredBox under a scrolled layoutScroll ancestor', () => {
        // The scroller is scrolled 50px: the lead is drawn at page x 10, its
        // layout (scroll removed, upstream `removeElementScroll`) is at 60.
        const { adapter: scroller, element: scrollerElement } = mount(
            { layoutScroll: true },
            new DOMRect(0, 0, 300, 100)
        )
        Object.defineProperty(scrollerElement, 'scrollLeft', { configurable: true, value: 50 })
        Object.defineProperty(scrollerElement, 'scrollTop', { configurable: true, value: 0 })
        const { adapter: lead, element } = mount(
            { layoutId: 'a1-scroll' },
            new DOMRect(10, 20, 100, 50),
            scroller
        )
        element.remove()
        lead.unmount()

        const { adapter } = mount(
            { layoutId: 'a1-scroll' },
            new DOMRect(300, 20, 100, 50),
            scroller
        )

        const snapshot = adapter.projection.resumeFrom?.snapshot
        expect(snapshot?.measuredBox.x.min).toBe(10)
        expect(snapshot?.layoutBox.x.min).toBe(60)
    })

    it("doesn't seed while the root's updates are blocked, as upstream willUpdate returns", () => {
        const { adapter: lead, element } = mount(
            { layoutId: 'a1-blocked' },
            new DOMRect(10, 20, 100, 50)
        )
        const root = lead.projection.root!
        root.blockUpdate()
        try {
            element.remove()
            lead.unmount()
            expect(lead.projection.snapshot).toBeUndefined()
        } finally {
            root.unblockUpdate()
        }
    })

    it('joins an update that is already running instead of starting another', () => {
        const { adapter: lead, element } = mount(
            { layoutId: 'a1-updating' },
            new DOMRect(10, 20, 100, 50)
        )
        const root = lead.projection.root!
        root.startUpdate()
        // The root is shared across specs, and `spyOn` reuses an existing spy
        // with its call history: start from a clean count, restore after.
        const startUpdate = vi.spyOn(root, 'startUpdate')
        startUpdate.mockClear()
        try {
            element.remove()
            lead.unmount()

            expect(startUpdate).not.toHaveBeenCalled()
            expect(lead.projection.snapshot?.animationId).toBe(root.animationId)
        } finally {
            startUpdate.mockRestore()
        }
    })

    it('leaves a plain (non-layoutId) unmount without a snapshot', () => {
        const { adapter, element } = mount({ layout: true }, new DOMRect(10, 20, 100, 50))
        element.remove()
        adapter.unmount()
        expect(adapter.projection.snapshot).toBeUndefined()
    })

    it("an observed commit doesn't overwrite a descendant's existing snapshot", async () => {
        const { adapter: parent, element: parentElement } = mount(
            { layout: true },
            new DOMRect(10, 0, 300, 50)
        )
        const { adapter: child } = mount(
            { layoutId: 'a1-guard' },
            new DOMRect(10, 0, 100, 50),
            parent
        )
        const handed = {
            animationId: 0,
            measuredBox: { x: { min: 500, max: 600 }, y: { min: 0, max: 50 } },
            layoutBox: { x: { min: 500, max: 600 }, y: { min: 0, max: 50 } },
            latestValues: {},
            source: child.projection.id
        }
        child.projection.snapshot = handed
        let seen: unknown
        child.projection.addEventListener('didUpdate', ({ snapshot }: { snapshot: unknown }) => {
            seen = snapshot
        })

        rects.set(parentElement, new DOMRect(160, 0, 300, 50))
        parent.commitObservedLayoutChange({ left: 10, top: 0, width: 300, height: 50 })
        await flush()

        expect(seen).toBe(handed)
    })
})

describe('MotionDomProjectionAdapter scroll-rebased snapshots (plan 015a)', () => {
    type RectLike = { left: number; top: number; width: number; height: number }
    /** Content-space (unscrolled) rects; the viewport rect subtracts the scroller's scroll. */
    const content = new Map<HTMLElement, { left: number; top: number }>()
    const mounted: MotionDomProjectionAdapter[] = []
    let scroller: HTMLElement

    const makeScroller = (style = 'overflow: auto') => {
        const element = document.createElement('div')
        element.setAttribute('style', style)
        document.body.appendChild(element)
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, 320))
        // Drawn at its offset size: unscaled.
        Object.defineProperty(element, 'offsetWidth', { configurable: true, value: 400 })
        Object.defineProperty(element, 'offsetHeight', { configurable: true, value: 320 })
        return element
    }
    const create = (parent: HTMLElement, top: number, style = '') => {
        const element = document.createElement('div')
        if (style) element.setAttribute('style', style)
        parent.appendChild(element)
        content.set(element, { left: 10, top })
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
            const at = content.get(element)!
            const scrolled = parent === scroller && !style.includes('sticky')
            return new DOMRect(at.left, at.top - (scrolled ? scroller.scrollTop : 0), 100, 50)
        })
        return element
    }
    const mount = (
        element: HTMLElement,
        options: { layout?: boolean; layoutId?: string; layoutScroll?: boolean } = {
            layout: true
        },
        extra: ConstructorParameters<typeof MotionDomProjectionAdapter>[0] = {}
    ) => {
        const adapter = new MotionDomProjectionAdapter(extra)
        adapter.updateOptions(options)
        adapter.mount(element)
        mounted.push(adapter)
        return adapter
    }
    /** Scroll and let the tracker see it, as a browser's `scroll` event would. */
    const scrollTo = (element: HTMLElement, top: number) => {
        element.scrollTop = top
        element.dispatchEvent(new Event('scroll'))
    }
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
    const topOf = (rect: RectLike | null | undefined) => rect?.top
    /** Plan 015a's adapter API, typed here so these cases compile on their own. */
    type Rebasing = {
        lastReadScrollBasis?: unknown
        commitObservedLayoutChange(previous?: RectLike, options?: { previousBasis?: unknown }): void
    }
    const rebasing = (adapter: MotionDomProjectionAdapter) => adapter as unknown as Rebasing
    const foldedInFor = (element: Element) =>
        (
            MotionDomProjectionAdapter as unknown as {
                foldedInFor(element: Element): ((container: Element) => boolean) & {
                    wasRoot?: boolean
                }
            }
        ).foldedInFor(element)

    beforeEach(() => {
        vi.useRealTimers()
        document.documentElement.scrollTop = 0
        content.clear()
        scroller = makeScroller()
    })
    afterEach(async () => {
        await flush()
        for (const adapter of mounted.splice(0)) adapter.unmount()
        document.body.innerHTML = ''
        document.documentElement.scrollTop = 0
    })

    it('3a: commitGroup seeds the rebased snapshot after a scroller scrolls 0 → 500', () => {
        const group = nodeGroup()
        mount(create(scroller, 100), { layout: true }, { group })
        const b = mount(create(scroller, 200), { layout: true }, { group })

        scrollTo(scroller, 500)
        MotionDomProjectionAdapter.commitGroup(group)

        // Upstream's live willUpdate would measure 200 - 500.
        expect(b.projection.snapshot?.layoutBox.y.min).toBe(-300)
    })

    it('3b: currentVisualPageRect is rebased after a scroller scrolls 0 → 500', () => {
        const adapter = mount(create(scroller, 200), { layoutId: 'rebased' })

        scrollTo(scroller, 500)

        expect(topOf(adapter.currentVisualPageRect())).toBe(-300)
        // A fresh read agrees.
        expect(topOf(adapter.measurePageRect('measure', { silent: true }))).toBe(-300)
    })

    it('3c: commitObservedLayoutChange rebases a raw previous rect by its previousBasis', () => {
        const adapter = mount(create(scroller, 200))
        const previous = adapter.measurePageRect('measure', { silent: true })!
        const previousBasis = rebasing(adapter).lastReadScrollBasis

        scrollTo(scroller, 500)
        rebasing(adapter).commitObservedLayoutChange(previous, { previousBasis })

        expect(adapter.projection.snapshot?.layoutBox.y.min).toBe(-300)
    })

    it('3d: a fixed element is rebased by +300 after a window scroll of 300', () => {
        const element = create(document.body, 100, 'position: fixed')
        const adapter = mount(element, { layoutId: 'fixed' })
        expect(topOf(adapter.currentVisualPageRect())).toBe(100)

        // A fixed element's page box moves with the window scroll (upstream
        // `measurePageBox` adds the root scroll to its fixed viewport box).
        document.documentElement.scrollTop = 300
        document.dispatchEvent(new Event('scroll'))

        expect(topOf(adapter.currentVisualPageRect())).toBe(400)
        expect(topOf(adapter.measurePageRect('measure', { silent: true }))).toBe(400)
    })

    it('3e: a post-clamp commit in the same task is not shifted (phantom tripwire)', async () => {
        const aElement = create(scroller, 100)
        const bElement = create(scroller, 200)
        const a = mount(aElement)
        const b = mount(bElement)
        scrollTo(scroller, 500)
        a.refreshLayout({ silent: true })
        b.refreshLayout({ silent: true })
        const starts = new Map<MotionDomProjectionAdapter, number>([
            [a, 0],
            [b, 0]
        ])
        for (const adapter of [a, b]) {
            adapter.projection.addEventListener('animationStart', () =>
                starts.set(adapter, starts.get(adapter)! + 1)
            )
        }

        // Content shrank: the scroll position clamps with no scroll event yet.
        scroller.scrollTop = 430
        a.commitObservedLayoutChange()
        const bRect = b.refreshLayout({ silent: true })!
        b.commitObservedLayoutChange()

        expect(b.projection.snapshot?.layoutBox.y.min).toBe(bRect.top)
        await flush()
        await flush()
        expect(starts.get(a)).toBeLessThanOrEqual(1)
        expect(starts.get(b)).toBeLessThanOrEqual(1)
    })

    it('3f: a node on a sticky path keeps its unrebased cache', () => {
        const element = create(scroller, 0, 'position: sticky; top: 0')
        const adapter = mount(element)
        const cached = adapter.currentVisualPageRect()

        scrollTo(scroller, 500)

        expect(adapter.currentVisualPageRect()).toEqual(cached)
        adapter.commitObservedLayoutChange()
        expect(adapter.projection.snapshot?.layoutBox.y.min).toBe(cached!.top)
    })

    it('3g: a node with no scrollers keeps no scroll basis', () => {
        const adapter = mount(create(document.body, 100))
        adapter.measurePageRect('measure', { silent: true })

        expect(rebasing(adapter).lastReadScrollBasis).toBeFalsy()
    })

    it('3n: foldedInFor folds in a mounted layoutScroll container, until it unmounts', () => {
        const container = mount(scroller, { layoutScroll: true })
        const inner = document.createElement('div')
        scroller.appendChild(inner)

        expect(foldedInFor(inner)(scroller)).toBe(true)
        expect(foldedInFor(document.body)(scroller)).toBe(false)
        container.unmount()
        expect(foldedInFor(inner)(scroller)).toBe(false)
        expect(foldedInFor(inner).wasRoot).toBe(false)
    })

    /**
     * A browser-like rect: the layout box moved by every inline translate on
     * the element and its ancestors.
     */
    const drawn = (element: HTMLElement, layoutLeft: number) =>
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
            let left = layoutLeft
            for (let node: HTMLElement | null = element; node; node = node.parentElement) {
                for (const [, name, args] of node.style.transform.matchAll(/(\w+)\(([^)]*)\)/g)) {
                    if (/^translate(X|3d)?$/.test(name)) left += parseFloat(args)
                }
            }
            return new DOMRect(left, 0, 100, 50)
        })

    it('3o: the handoff rect inside an ancestor drawn at translateX(100px) is its on-screen box', () => {
        const parentElement = document.createElement('div')
        document.body.appendChild(parentElement)
        drawn(parentElement, 0)
        const parent = mount(parentElement)
        // The ancestor's `style={{ x: 100 }}`: rendered as translateX(100px).
        parent.visualElement.latestValues.x = 100
        parent.visualElement.render()
        expect(parentElement.style.transform).toContain('translateX(100px)')

        const element = document.createElement('div')
        parentElement.appendChild(element)
        drawn(element, 10)
        const adapter = mount(element, { layoutId: 'ancestor-x' }, { parent })

        expect(adapter.currentVisualPageRect()?.left).toBe(element.getBoundingClientRect().left)
    })

    it('3p: the handoff rect of an element with its own x: 100 is its on-screen box', () => {
        const element = document.createElement('div')
        document.body.appendChild(element)
        drawn(element, 10)
        const adapter = mount(element, { layoutId: 'own-x' })
        adapter.visualElement.latestValues.x = 100
        adapter.visualElement.render()
        expect(element.style.transform).toContain('translateX(100px)')
        adapter.seedLayout()

        expect(adapter.currentVisualPageRect()?.left).toBe(element.getBoundingClientRect().left)
    })
})

/**
 * Plan 015b part D: `layout` nodes that follow a list's layout parent but sit
 * outside it (a footer after the list). Upstream re-renders them with the
 * list's owner, so their `MeasureLayout` snapshots (`getSnapshotBeforeUpdate`
 * → `willUpdate()`, MeasureLayout.tsx:149-204 @ v14.7.1). Here the change has
 * already hit the DOM, so the picked nodes are seeded from their cached
 * layouts, without a read; on a completed exit they are refreshed silently
 * instead (the snap: upstream re-renders only that AnimatePresence,
 * AnimatePresence/index.tsx:244).
 *
 * Read off the class so a missing method fails only these cases.
 */
describe('MotionDomProjectionAdapter.seedFollowingLayout (plan 015b)', () => {
    type Cause = { kind: 'change' } | { kind: 'exit-complete'; markers: [] }
    const seedFollowingLayout = (
        parent: Element,
        records: MutationRecord[] | null,
        cause: Cause = { kind: 'change' }
    ) =>
        (
            MotionDomProjectionAdapter as unknown as {
                seedFollowingLayout: (
                    parent: Element,
                    records: MutationRecord[] | null,
                    cause: Cause
                ) => void
            }
        ).seedFollowingLayout(parent, records, cause)

    const rects = new Map<HTMLElement, DOMRect>()
    const reads = new Map<HTMLElement, number>()
    const adapters: MotionDomProjectionAdapter[] = []
    const place = (element: HTMLElement, top: number) =>
        rects.set(element, new DOMRect(10, top, 100, 50))
    /** A `layout` node in its own wrapper `div` (like `#foot-wrap`) inside `host`. */
    const mountIn = (
        host: Element,
        top: number,
        options: { parent?: MotionDomProjectionAdapter; gated?: boolean; layoutId?: string } = {}
    ) => {
        const wrap = document.createElement('div')
        const element = document.createElement('div')
        wrap.append(element)
        host.append(wrap)
        place(element, top)
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
            reads.set(element, (reads.get(element) ?? 0) + 1)
            return rects.get(element)!
        })
        const adapter = new MotionDomProjectionAdapter({ parent: options.parent })
        adapter.updateOptions({
            layout: true,
            layoutId: options.layoutId,
            ...(options.gated ? { measurementGated: true } : {})
        })
        adapter.mount(element)
        adapters.push(adapter)
        return { adapter, element, wrap }
    }
    const list = (host: Element) => {
        const parent = document.createElement('ul')
        host.append(parent)
        return parent
    }
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
    const records = () => [] as MutationRecord[]

    beforeEach(() => {
        vi.useRealTimers()
        document.documentElement.scrollTop = 0
        rects.clear()
        reads.clear()
    })
    afterEach(async () => {
        await flush()
        for (const adapter of adapters.splice(0).reverse()) adapter.unmount()
        document.body.innerHTML = ''
    })

    it('3h: seeds a following node from its cache, with no read, and it animates', async () => {
        const parent = list(document.body)
        const footer = mountIn(document.body, 300)
        const didUpdate = vi.fn()
        footer.adapter.projection.addEventListener('didUpdate', didUpdate)
        // The list shrank: the footer is 70px higher.
        place(footer.element, 230)
        reads.clear()

        seedFollowingLayout(parent, records())

        expect(reads.get(footer.element) ?? 0).toBe(0)
        expect(footer.adapter.projection.isLayoutDirty).toBe(true)
        expect(footer.adapter.projection.snapshot?.layoutBox.y.min).toBe(300)
        await flush()
        expect(didUpdate).toHaveBeenCalledTimes(1)
        expect(didUpdate.mock.calls[0][0].layout.y.min).toBe(230)
    })

    it("3i: prunes preceding subtrees and skips the parent's line, gated, dirty, unmounted, size-animating, unreliable and other-ancestor nodes", () => {
        const outerHost = document.createElement('section')
        document.body.append(outerHost)
        const outer = mountIn(outerHost, 0)
        const host = outer.element
        const preceding = mountIn(host, 10, { parent: outer.adapter })
        const precedingChild = mountIn(preceding.element, 15, { parent: preceding.adapter })
        const parent = list(host)
        const descendant = mountIn(parent, 20, { parent: outer.adapter })
        const picked = mountIn(host, 100, { parent: outer.adapter })
        const gated = mountIn(host, 110, { parent: outer.adapter, gated: true })
        const dirty = mountIn(host, 120, { parent: outer.adapter })
        const sticky = mountIn(host, 130, { parent: outer.adapter })
        const stale = mountIn(host, 140, { parent: outer.adapter })
        const sizeHost = document.createElement('div')
        sizeHost.setAttribute('data-layout-size-animation', 'true')
        host.append(sizeHost)
        const sizing = mountIn(sizeHost, 150, { parent: outer.adapter })
        // Follows the parent, but its nearest motion ancestor is the document.
        const other = mountIn(document.body, 400)
        const unmounted = new MotionDomProjectionAdapter({ parent: outer.adapter })
        unmounted.updateOptions({ layout: true })

        dirty.adapter.projection.isLayoutDirty = true
        const internals = (adapter: MotionDomProjectionAdapter) =>
            adapter as unknown as { lastLayoutBasis: unknown }
        const basis = {
            scrollers: [],
            values: [],
            epoch: 0,
            resizeEpoch: readScrollBasis(sticky.element).resizeEpoch,
            fixedRoot: null,
            unreliable: false
        }
        internals(sticky.adapter).lastLayoutBasis = { ...basis, unreliable: true }
        internals(stale.adapter).lastLayoutBasis = { ...basis, resizeEpoch: basis.resizeEpoch - 1 }
        reads.clear()

        seedFollowingLayout(parent, records())

        expect(picked.adapter.projection.isLayoutDirty, 'picked').toBe(true)
        expect(picked.adapter.projection.snapshot?.layoutBox.y.min).toBe(100)
        for (const [name, skipped] of Object.entries({
            outer,
            preceding,
            precedingChild,
            descendant,
            gated,
            sticky,
            stale,
            sizing,
            other
        })) {
            expect(skipped.adapter.projection.snapshot, name).toBeUndefined()
            expect(skipped.adapter.projection.isLayoutDirty, name).toBe(false)
        }
        expect(dirty.adapter.projection.snapshot, 'dirty').toBeUndefined()
        expect(unmounted.projection.snapshot, 'unmounted').toBeUndefined()
        // Seeding reads nothing at all.
        expect([...reads.values()].reduce((a, b) => a + b, 0)).toBe(0)
        dirty.adapter.projection.isLayoutDirty = false
    })

    it('3j: runs once per records array', async () => {
        const parent = list(document.body)
        const footer = mountIn(document.body, 300)
        const didUpdate = vi.fn()
        footer.adapter.projection.addEventListener('didUpdate', didUpdate)
        const batch = records()

        seedFollowingLayout(parent, batch)
        await flush()
        expect(didUpdate).toHaveBeenCalledTimes(1)

        // Every sibling's observer hands over the same batch.
        seedFollowingLayout(parent, batch)
        expect(footer.adapter.projection.isLayoutDirty).toBe(false)
        await flush()
        expect(didUpdate).toHaveBeenCalledTimes(1)

        seedFollowingLayout(parent, records())
        await flush()
        expect(didUpdate).toHaveBeenCalledTimes(2)
    })

    it('3k: runs one root update for every picked node', () => {
        const parent = list(document.body)
        const a = mountIn(document.body, 300)
        mountIn(document.body, 400)
        const root = a.adapter.projection.root!
        const didUpdate = vi.spyOn(root, 'didUpdate')

        seedFollowingLayout(parent, records())

        expect(didUpdate).toHaveBeenCalledTimes(1)
        didUpdate.mockRestore()
    })

    it('3l: on a completed exit, refreshes silently and seeds nothing', async () => {
        const parent = list(document.body)
        const footer = mountIn(document.body, 300)
        const refresh = vi.spyOn(footer.adapter, 'refreshLayout')
        const onCacheRefresh = vi.fn()
        footer.adapter.onCacheRefresh(onCacheRefresh)
        const didUpdate = vi.fn()
        footer.adapter.projection.addEventListener('didUpdate', didUpdate)
        place(footer.element, 230)
        reads.clear()

        seedFollowingLayout(parent, records(), { kind: 'exit-complete', markers: [] })

        expect(refresh).toHaveBeenCalledTimes(1)
        expect(refresh).toHaveBeenCalledWith({ silent: true })
        expect(reads.get(footer.element)).toBe(1)
        expect(onCacheRefresh).toHaveBeenCalledWith({ left: 10, top: 230, width: 100, height: 50 })
        expect(footer.adapter.projection.snapshot).toBeUndefined()
        expect(footer.adapter.projection.isLayoutDirty).toBe(false)
        await flush()
        expect(didUpdate).not.toHaveBeenCalled()
        expect(footer.adapter.lastMeasuredRect?.top).toBe(230)
    })

    it('3m: leaves resumeFrom and shared-layout stacks untouched', () => {
        const parent = list(document.body)
        const footer = mountIn(document.body, 300, { layoutId: 'footer-015b' })
        const projection = footer.adapter.projection
        const stack = projection.getStack()
        const members = [...(stack?.members ?? [])]
        const lead = stack?.lead
        const resumeFrom = projection.resumeFrom

        seedFollowingLayout(parent, records())

        expect(projection.resumeFrom).toBe(resumeFrom)
        expect(projection.getStack()).toBe(stack)
        expect(stack?.lead).toBe(lead)
        expect([...(stack?.members ?? [])]).toEqual(members)
    })
})

/**
 * Plan 015b A2.2: a group member that is running its own box-size animation
 * (`data-layout-size-animation`, `runBoxSizeAnimation` in layout.ts) is drawn
 * at a transient inline width. `commitGroup` seeding it measured that width,
 * started a second (projection) animation on top, and wrote the transient
 * rect into its cache, so when the size animation ended the observer saw a
 * change from it and restarted the size animation from the origin (the
 * layout-button wait-group shell: 79 → 86 → 80 → 93px).
 */
describe('MotionDomProjectionAdapter.commitGroup and size-animating members (plan 015b A2.2)', () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

    beforeEach(() => {
        vi.useRealTimers()
        document.documentElement.scrollTop = 0
    })

    it('leaves a member that runs its own box-size animation alone', async () => {
        const group = nodeGroup()
        const host = new MotionDomProjectionAdapter({ group })
        const other = new MotionDomProjectionAdapter({ group })
        const hostElement = document.createElement('div')
        const otherElement = document.createElement('div')
        document.body.append(hostElement, otherElement)
        let hostWidth = 93
        vi.spyOn(hostElement, 'getBoundingClientRect').mockImplementation(
            () => new DOMRect(10, 0, hostWidth, 32)
        )
        vi.spyOn(otherElement, 'getBoundingClientRect').mockImplementation(
            () => new DOMRect(10, 100, 100, 50)
        )
        for (const [adapter, element] of [
            [host, hostElement],
            [other, otherElement]
        ] as const) {
            adapter.updateOptions({ layout: true })
            adapter.mount(element)
        }
        const hostCommit = vi.fn()
        host.onProjectionCommit(hostCommit)
        // Mid size animation: the inline width holds the box at 77px.
        hostElement.setAttribute('data-layout-size-animation', 'true')
        hostWidth = 77

        MotionDomProjectionAdapter.commitGroup(group)

        expect(host.projection.snapshot).toBeUndefined()
        expect(host.projection.isLayoutDirty).toBe(false)
        await flush()
        expect(hostCommit).not.toHaveBeenCalled()
        expect(host.projection.currentAnimation).toBeUndefined()
        hostElement.removeAttribute('data-layout-size-animation')
        other.unmount()
        host.unmount()
        hostElement.remove()
        otherElement.remove()
    })

    it('a member seeded just before its own box-size animation starts keeps its cache and gets no projection animation', async () => {
        const group = nodeGroup()
        const host = new MotionDomProjectionAdapter({ group })
        const other = new MotionDomProjectionAdapter({ group })
        const hostElement = document.createElement('div')
        const otherElement = document.createElement('div')
        document.body.append(hostElement, otherElement)
        let hostWidth = 77
        let otherTop = 100
        vi.spyOn(hostElement, 'getBoundingClientRect').mockImplementation(
            () => new DOMRect(10, 0, hostWidth, 32)
        )
        vi.spyOn(otherElement, 'getBoundingClientRect').mockImplementation(
            () => new DOMRect(10, otherTop, 100, 50)
        )
        for (const [adapter, element] of [
            [host, hostElement],
            [other, otherElement]
        ] as const) {
            adapter.updateOptions({ layout: true })
            adapter.mount(element)
        }
        const hostCommit = vi.fn()
        host.onProjectionCommit(hostCommit)

        // A group sibling's commit seeds the host (the wait-group release)...
        otherTop = 120
        other.commitObservedLayoutChange({ left: 10, top: 100, width: 100, height: 50 })
        expect(host.projection.isLayoutDirty).toBe(true)
        // ...then, in the same task, the host starts its own box-size
        // animation, whose inline width holds it at 77px for now.
        hostElement.setAttribute('data-layout-size-animation', 'true')
        host.yieldToSizeAnimation()
        await flush()

        expect(hostCommit).not.toHaveBeenCalled()
        expect(host.projection.currentAnimation).toBeUndefined()
        hostWidth = 93
        hostElement.removeAttribute('data-layout-size-animation')
        other.unmount()
        host.unmount()
        hostElement.remove()
        otherElement.remove()
    })
})

/**
 * Plan 012 (U9): exiting nodes take part in shared layout, as upstream
 * `MeasureLayout` does (`getSnapshotBeforeUpdate` 149-204, `componentDidUpdate`
 * 206-218, `safeToRemove` through `usePresence` @ v14.7.1). `setPresence` /
 * `commitPresence` are the owned path's pre and post halves;
 * `handOffToExitClone` re-points a departing node at its exit clone.
 */
describe('presence in shared layout (plan 012)', () => {
    type ExitHold = ExitLayoutHold
    const api = (adapter: MotionDomProjectionAdapter) => adapter
    const rects = new Map<HTMLElement, DOMRect>()
    const mounted: MotionDomProjectionAdapter[] = []
    const mount = (layoutId: string | undefined, rect: DOMRect, layout?: boolean) => {
        const visualElement = createMotionVisualElement({ props: {} })
        const adapter = new MotionDomProjectionAdapter({ visualElement })
        const element = document.createElement('div')
        document.body.appendChild(element)
        rects.set(element, rect)
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() =>
            element.isConnected ? rects.get(element)! : new DOMRect()
        )
        adapter.updateOptions({ layoutId, layout, transition: { duration: 0.05 } as never })
        adapter.mount(element)
        mounted.push(adapter)
        return { adapter, element }
    }
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
    const frames = (n = 2) =>
        new Promise<void>((resolve) => {
            let left = n
            const step = () => (--left <= 0 ? resolve() : frame.postRender(step))
            frame.postRender(step)
        })

    beforeEach(() => {
        vi.useRealTimers()
        document.documentElement.scrollTop = 0
        rects.clear()
    })
    afterEach(async () => {
        await flush()
        for (const adapter of mounted.splice(0)) adapter.unmount()
    })

    it('9a: an exiting lead relegates, promoting the earlier present member with its snapshot', () => {
        const { adapter: b } = mount('p9a', new DOMRect(10, 0, 100, 50))
        const { adapter: a } = mount('p9a', new DOMRect(300, 0, 100, 50))
        const stack = a.projection.getStack()!
        expect(stack.lead === a.projection).toBe(true)

        api(a).setPresence(false, vi.fn())
        api(a).commitPresence()

        expect(stack.lead === b.projection).toBe(true)
        expect(b.projection.resumeFrom === a.projection).toBe(true)
        expect(a.projection.snapshot).toBeDefined()
        expect(b.projection.snapshot === a.projection.snapshot).toBe(true)
    })

    it('9b: a lone exiting node is released once, by the microtask lead check', async () => {
        const { adapter: a } = mount('p9b', new DOMRect(10, 0, 100, 50))
        const release = vi.fn()

        api(a).setPresence(false, release)
        expect(release).not.toHaveBeenCalled()
        api(a).commitPresence()
        await flush()
        await frames(3)

        expect(release).toHaveBeenCalledTimes(1)
    })

    it('9c: held until the new lead animates in, released once per exit cycle', async () => {
        const { adapter: a } = mount('p9c', new DOMRect(10, 0, 100, 50))
        const release = vi.fn()

        api(a).setPresence(false, release)
        const { adapter: b } = mount('p9c', new DOMRect(300, 0, 100, 50))
        api(a).commitPresence()
        await flush()
        await frames(2)
        expect(b.projection.currentAnimation).toBeDefined()
        expect(release).not.toHaveBeenCalled()

        await new Promise((resolve) => setTimeout(resolve, 200))
        await frames(2)
        expect(b.projection.currentAnimation).toBeUndefined()
        expect(release).toHaveBeenCalledTimes(1)
        // Every member's `onExitComplete` again: the latch holds.
        a.projection.getStack()!.exitAnimationComplete()
        expect(release).toHaveBeenCalledTimes(1)

        // A new cycle re-arms it.
        api(a).setPresence(true, release)
        api(a).commitPresence()
        api(a).setPresence(false, release)
        api(a).commitPresence()
        await flush()
        await frames(3)
        a.projection.getStack()!.exitAnimationComplete()
        // The release runs in a microtask of its own (plan 012 A2).
        await flush()
        expect(release).toHaveBeenCalledTimes(2)
    })

    it('9d: hands a detached node off to its exit clone and defers its unmount', async () => {
        const { adapter: a, element } = mount('p9d', new DOMRect(10, 0, 100, 50))
        const visualElement = a.visualElement
        const unmountVisualElement = vi.spyOn(visualElement, 'unmount')
        element.remove()
        const clone = element.cloneNode(true) as HTMLElement
        rects.set(clone, new DOMRect(10, 0, 100, 50))
        vi.spyOn(clone, 'getBoundingClientRect').mockImplementation(() =>
            clone.isConnected ? rects.get(clone)! : new DOMRect()
        )
        document.body.appendChild(clone)
        const held: { hold?: ExitHold } = {}
        const release = vi.fn(() => held.hold?.finish())

        const hold = api(a).handOffToExitClone(clone, release)
        held.hold = hold

        expect(hold).toBeDefined()
        expect(a.projection.instance === clone).toBe(true)
        expect(visualElement.current).toBe(clone)
        expect(visualElementStore.get(clone)).toBe(visualElement)
        expect(visualElementStore.get(element)).toBeUndefined()
        expect(a.projection.isPresent).toBe(false)
        expect(a.projection.snapshot).toBeDefined()
        expect(api(a).isHandedOff).toBe(true)
        // `byElement` follows the clone (E16).
        expect(MotionDomProjectionAdapter.foldedInFor(clone)).not.toBe(
            MotionDomProjectionAdapter.foldedInFor(element)
        )

        // The container's teardown: deferred.
        a.unmount()
        expect(unmountVisualElement).not.toHaveBeenCalled()

        await flush()
        await frames(3)
        expect(release).toHaveBeenCalledTimes(1)
        expect(unmountVisualElement).toHaveBeenCalledTimes(1)
        expect(visualElementStore.get(clone)).toBeUndefined()
        hold!.finish()
        expect(unmountVisualElement).toHaveBeenCalledTimes(1)
    })

    it('9e: cancelling the hold unmounts at once, and a later release is a no-op', async () => {
        const { adapter: a, element } = mount('p9e', new DOMRect(10, 0, 100, 50))
        const unmountVisualElement = vi.spyOn(a.visualElement, 'unmount')
        element.remove()
        const clone = element.cloneNode(true) as HTMLElement
        document.body.appendChild(clone)
        const release = vi.fn()
        const hold = api(a).handOffToExitClone(clone, release)
        a.unmount()

        hold!.cancel()
        expect(unmountVisualElement).toHaveBeenCalledTimes(1)
        expect(a.isMounted).toBe(false)

        await flush()
        await frames(3)
        expect(release).not.toHaveBeenCalled()
        expect(unmountVisualElement).toHaveBeenCalledTimes(1)
        clone.remove()
    })

    it('A2: a departing lead refreshed under a translated ancestor still hands over where it was drawn', () => {
        // The ancestor is drawn 50px right by its own `x`; the lead sits in it.
        const parentElement = document.createElement('div')
        document.body.appendChild(parentElement)
        vi.spyOn(parentElement, 'getBoundingClientRect').mockReturnValue(
            new DOMRect(0, 0, 400, 100)
        )
        const parentAdapter = new MotionDomProjectionAdapter()
        parentAdapter.updateOptions({ layout: true })
        parentAdapter.mount(parentElement)
        mounted.push(parentAdapter)
        parentAdapter.projection.latestValues.x = 50
        parentElement.style.transform = 'translateX(50px)'
        const element = document.createElement('div')
        parentElement.appendChild(element)
        // Drawn with the ancestor's translate unless it is stripped.
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() =>
            !element.isConnected
                ? new DOMRect()
                : new DOMRect(parentElement.style.transform === 'none' ? 100 : 150, 0, 100, 50)
        )
        const lead = new MotionDomProjectionAdapter({ parent: parentAdapter })
        lead.updateOptions({ layoutId: 'a2-refresh' })
        lead.mount(element)
        mounted.push(lead)
        // An own, stripped read (part D's exit-complete refresh does one).
        lead.refreshLayout({ silent: true })
        element.remove()
        lead.unmount()

        expect(lead.projection.snapshot?.measuredBox.x.min).toBe(150)
        expect(lead.projection.snapshot?.layoutBox.x.min).toBe(100)
    })

    it('9f: an adapter never given a presence unmounts as before', () => {
        const { adapter: a, element } = mount('p9f', new DOMRect(10, 0, 100, 50))
        const unmountVisualElement = vi.spyOn(a.visualElement, 'unmount')
        element.remove()

        a.unmount()

        expect(unmountVisualElement).toHaveBeenCalledTimes(1)
        expect(a.isMounted).toBe(false)
        expect(visualElementStore.get(element)).toBeUndefined()
        // The departing-lead snapshot is still handed over (#1935 A1).
        expect(a.projection.snapshot).toBeDefined()
    })
})
