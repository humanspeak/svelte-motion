import { visualElementStore } from 'motion-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MotionDomProjectionAdapter, layoutMeasureStats } from './motionDomProjection.js'
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
        const rafCallbacks: FrameRequestCallback[] = []
        const rafSpy = vi
            .spyOn(
                globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame },
                'requestAnimationFrame'
            )
            .mockImplementation((fn: FrameRequestCallback): number => {
                rafCallbacks.push(fn)
                return rafCallbacks.length
            })
        const cafSpy = vi
            .spyOn(
                globalThis as unknown as { cancelAnimationFrame: typeof cancelAnimationFrame },
                'cancelAnimationFrame'
            )
            .mockImplementation(() => {})

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

        rafSpy.mockRestore()
        cafSpy.mockRestore()
    })

    it('commitDraggedLayoutChange: delivers the slot delta from the upstream didUpdate, measuring with the drag transform stripped', async () => {
        // Plan 004 Step 5: a dragged element whose layout slot changes (e.g.
        // Reorder swapping its DOM position) must shift its drag origin by
        // the SLOT delta — upstream drag semantics
        // (VisualElementDragControls.ts:742-758: originPoint += delta.translate).
        // The element is mid-gesture, so its inline transform carries the
        // drag offset; the upstream update pass must measure the SLOT (drag
        // transform stripped), not the gesture position, or the delta would
        // absorb the live drag offset.
        let slotTop = 100
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
            // Transform-aware mock: with the drag transform applied the
            // element visually sits 50px right / 40px down of its slot.
            const stripped = element.style.transform === 'none'
            return new DOMRect(stripped ? 10 : 60, stripped ? slotTop : slotTop + 40, 100, 50)
        })
        adapter.mount(element)
        const previous = { left: 10, top: slotTop, width: 100, height: 50 }

        // Mid-gesture state: drag transform applied, slot moves one row down.
        element.style.transform = 'translate(50px, 40px)'
        slotTop = 196

        const onSlotDelta = vi.fn()
        adapter.commitDraggedLayoutChange(previous, onSlotDelta)

        // The upstream update pass flushes on a microtask.
        await new Promise((resolve) => setTimeout(resolve, 0))
        await new Promise((resolve) => setTimeout(resolve, 0))

        // Slot delta is previous - next (same orientation as upstream's
        // didUpdate delta and the writer's adjustOrigin contract).
        expect(onSlotDelta).toHaveBeenCalledTimes(1)
        expect(onSlotDelta).toHaveBeenCalledWith(0, 100 - 196)

        // The gesture transform is restored and the node is unblocked with
        // no layout animation started (a FLIP here would fight the gesture).
        expect(element.style.transform).toBe('translate(50px, 40px)')
        expect(adapter.projection.isAnimationBlocked).toBe(false)
        expect(adapter.projection.currentAnimation).toBeUndefined()
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

    it('still constructs its own VisualElement with no injection', () => {
        const adapter = new MotionDomProjectionAdapter()
        adapter.updateOptions({ layout: true, transition: { duration: 1 } })
        adapter.mount(element)

        expect(visualElementStore.get(element)).toBe(adapter.visualElement)
        expect(adapter.visualElement.getProps().transition).toEqual({ duration: 1 })
        adapter.unmount()
    })
})
