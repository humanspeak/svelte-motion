import { measurePageBox, measureViewportBox, nodeGroup, visualElementStore } from 'motion-dom'
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
