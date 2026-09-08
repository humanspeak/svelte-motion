import { expect, test, type Locator, type Page } from '@playwright/test'

type Point = { x: number; y: number }
type GestureEntry = {
    at: number
    type: string
    info: { point: Point; delta: Point; offset: Point; velocity: Point }
    boundValues: Point
}

const installClock = async (page: Page) => {
    await page.addInitScript(() => {
        let now = 1000
        let nextId = 1
        const callbacks = new Map<number, FrameRequestCallback>()
        Object.defineProperty(performance, 'now', { configurable: true, value: () => now })
        window.requestAnimationFrame = (callback) => {
            const id = nextId++
            callbacks.set(id, callback)
            return id
        }
        window.cancelAnimationFrame = (id) => callbacks.delete(id)
        ;(
            window as unknown as { __PARITY_CLOCK__: { advance(ms: number): void } }
        ).__PARITY_CLOCK__ = {
            advance(ms) {
                now += ms
                const queued = [...callbacks.values()]
                callbacks.clear()
                for (const callback of queued) callback(now)
            }
        }
    })
}

const advance = async (page: Page, ms: number) => {
    await page.evaluate((delta) => {
        ;(
            window as unknown as { __PARITY_CLOCK__: { advance(ms: number): void } }
        ).__PARITY_CLOCK__.advance(delta)
    }, ms)
    await page.evaluate(async () => {
        await Promise.resolve()
        await new Promise((resolve) => queueMicrotask(resolve))
    })
}

const openCase = async (page: Page, caseId: string) => {
    await page.goto(`/tests/transform-page-point/drag?case=${caseId}&@isPlaywright=true`)
    await expect(page.getByTestId('fixture')).toHaveAttribute('data-ready', 'true')
    await advance(page, 16)
    await advance(page, 16)
    const frameProbe = await page.evaluate(() =>
        (
            window as unknown as {
                __PARITY__: {
                    trace: Array<{
                        type: string
                        timestamp?: number
                        performanceNow?: number
                    }>
                }
            }
        ).__PARITY__.trace.find((entry) => entry.type === 'motionFrameProbe')
    )
    expect(frameProbe?.timestamp).toBe(frameProbe?.performanceNow)
    expect([1016, 1032]).toContain(frameProbe?.timestamp)
}

const center = async (locator: Locator) => {
    const box = await locator.boundingBox()
    if (!box) throw new Error('Expected visible element')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

const gestures = (page: Page) =>
    page.evaluate(() => {
        const parity = (window as unknown as { __PARITY__: { trace: GestureEntry[] } }).__PARITY__
        return parity.trace.filter((entry) => entry.type.startsWith('onDrag'))
    })

const snapshot = (page: Page, label: string) =>
    page.evaluate((value) => {
        const parity = (
            window as unknown as {
                __PARITY__: { actions: { captureSnapshot(label: string): unknown } }
            }
        ).__PARITY__
        return parity.actions.captureSnapshot(value)
    }, label) as Promise<{
        boundValues: { x: number; y: number }
        rects: { target: DOMRect | null; slot: DOMRect | null }
        layout: { slotOffsetLeft: number | null }
        scroll: Point
        shellScroll: Point | null
    }>

const action = async (page: Page, name: string, value?: unknown) => {
    await page.evaluate(
        ({ actionName, actionValue }) => {
            const actions = (
                window as unknown as {
                    __PARITY__: { actions: Record<string, (value?: unknown) => unknown> }
                }
            ).__PARITY__.actions
            return actions[actionName](actionValue)
        },
        { actionName: name, actionValue: value }
    )
}

const canonicalSequence = async (page: Page, terminal: 'up' | 'cancel' = 'up') => {
    const start = await center(page.getByTestId('target'))
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await advance(page, 16)
    await page.mouse.move(start.x + 2, start.y + 1)
    await advance(page, 24)
    await page.mouse.move(start.x + 30, start.y + 20)
    await advance(page, 40)
    if (terminal === 'cancel') {
        await page.evaluate(
            ({ x, y }) => {
                window.dispatchEvent(
                    new PointerEvent('pointercancel', {
                        bubbles: true,
                        pointerId: 1,
                        pointerType: 'mouse',
                        isPrimary: true,
                        clientX: x,
                        clientY: y,
                        button: 0,
                        buttons: 0
                    })
                )
            },
            { x: start.x + 30, y: start.y + 20 }
        )
        await page.mouse.up()
    } else {
        await page.mouse.up()
    }
    await advance(page, 20)
}

const expectPointNear = (actual: Point, expected: Point, report: string) => {
    expect(Math.abs(actual.x - expected.x), report).toBeLessThanOrEqual(2)
    expect(Math.abs(actual.y - expected.y), report).toBeLessThanOrEqual(2)
}

const waitForTargetCenterToSettle = async (page: Page) => {
    const samples: Point[] = []
    let stableFrames = 0

    for (let frameIndex = 0; frameIndex < 180; frameIndex++) {
        await advance(page, 16)
        const current = await center(page.getByTestId('target'))
        const previous = samples.at(-1)
        samples.push(current)

        if (
            frameIndex >= 20 &&
            previous &&
            Math.abs(current.x - previous.x) <= 0.05 &&
            Math.abs(current.y - previous.y) <= 0.05
        ) {
            stableFrames += 1
            if (stableFrames === 8) return samples
        } else {
            stableFrames = 0
        }
    }

    throw new Error(`Target layout did not settle; samples=${JSON.stringify(samples)}`)
}

const runLayoutSnapCorrectionRegression = async (
    page: Page,
    caseId: string,
    initialAxes: Point
) => {
    await page.setViewportSize({ width: 900, height: 700 })
    await openCase(page, caseId)

    await page.evaluate(() => window.scrollTo(0, 0))
    await expect
        .poll(() => page.evaluate(() => ({ x: window.scrollX, y: window.scrollY })))
        .toEqual({ x: 0, y: 0 })

    const target = page.getByTestId('target')
    const handle = page.getByTestId('handle')
    const shiftButton = page.getByTestId('layout-shift-button')
    const viewport = page.viewportSize()
    const initialTarget = await target.boundingBox()
    const initialHandle = await handle.boundingBox()
    const initialShiftButton = await shiftButton.boundingBox()
    const initialSlot = await page.getByTestId('slot').boundingBox()
    if (!viewport || !initialTarget || !initialHandle || !initialShiftButton || !initialSlot) {
        throw new Error('Expected the isolated layout/snap fixture to be visible')
    }

    for (const box of [initialTarget, initialHandle, initialShiftButton, initialSlot]) {
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.y).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    }
    expect((await snapshot(page, 'layout-snap-initial')).boundValues).toEqual({
        ...initialAxes,
        panOffset: { x: 0, y: 0 }
    })
    expect(initialSlot.x).toBe(300)
    expect(initialSlot.y).toBe(300)
    expect(initialTarget.x - initialSlot.x).toBe(initialAxes.x)
    expect(initialTarget.y - initialSlot.y).toBe(initialAxes.y)

    const handlePoint = {
        x: initialHandle.x + initialHandle.width / 2,
        y: initialHandle.y + initialHandle.height / 2
    }
    await page.mouse.move(handlePoint.x, handlePoint.y)
    await page.mouse.down()
    await advance(page, 16)
    await advance(page, 16)
    const firstSnap = await center(target)

    const dragSamples: Array<{ pointer: Point; target: Point }> = []
    for (const delta of [
        { x: 50, y: 20 },
        { x: 100, y: 35 },
        { x: 150, y: 50 }
    ]) {
        const pointer = { x: handlePoint.x + delta.x, y: handlePoint.y + delta.y }
        await page.mouse.move(pointer.x, pointer.y)
        await advance(page, 16)
        dragSamples.push({ pointer, target: await center(target) })
    }
    await page.mouse.up()
    await advance(page, 20)
    const postDrag = await center(target)

    const shiftPoint = await center(shiftButton)
    await page.mouse.move(shiftPoint.x, shiftPoint.y)
    await page.mouse.down()
    await page.mouse.up()
    await expect
        .poll(() => page.getByTestId('slot').evaluate((element) => element.offsetLeft))
        .toBe(360)
    const shiftedSlot = await page.getByTestId('slot').boundingBox()
    if (!shiftedSlot) throw new Error('Expected shifted slot to remain visible')
    const layoutSamples = await waitForTargetCenterToSettle(page)
    const postLayout = layoutSamples.at(-1)!

    const repeatSnap = async () => {
        const currentHandle = await center(handle)
        await page.mouse.move(handlePoint.x, handlePoint.y)
        await page.mouse.down()
        await advance(page, 16)
        await advance(page, 16)
        const snapped = await center(target)
        await page.mouse.up()
        await advance(page, 20)
        return { currentHandle, snapped }
    }
    const second = await repeatSnap()
    const third = await repeatSnap()

    const report = JSON.stringify({
        handlePoint,
        firstSnap,
        dragSamples,
        postDrag,
        initialSlot,
        shiftedSlot,
        layoutSamples,
        second,
        third
    })
    expectPointNear(firstSnap, handlePoint, report)
    for (const sample of dragSamples) expectPointNear(sample.target, sample.pointer, report)
    expectPointNear(postDrag, { x: handlePoint.x + 150, y: handlePoint.y + 50 }, report)
    expect(shiftedSlot.x - initialSlot.x, report).toBe(60)
    expect(shiftedSlot.y - initialSlot.y, report).toBe(0)
    expectPointNear(postLayout, { x: postDrag.x + 60, y: postDrag.y }, report)
    expectPointNear(second.currentHandle, handlePoint, report)
    expectPointNear(third.currentHandle, handlePoint, report)
    expectPointNear(second.snapped, handlePoint, report)
    expectPointNear(third.snapped, handlePoint, report)
    expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual({
        x: 0,
        y: 0
    })
}

const scrollWindow = async (page: Page, x: number, y: number, mode: 'to' | 'by' = 'by') => {
    const expected = await page.evaluate(
        ({ x, y, mode }) => {
            const expected =
                mode === 'to' ? { x, y } : { x: window.scrollX + x, y: window.scrollY + y }
            const state = { delivered: false, expected }
            ;(window as unknown as { __TPP_WINDOW_SCROLL__?: typeof state }).__TPP_WINDOW_SCROLL__ =
                state
            const recordScroll = () => {
                if (window.scrollX === expected.x && window.scrollY === expected.y) {
                    state.delivered = true
                    window.removeEventListener('scroll', recordScroll)
                }
            }
            window.addEventListener('scroll', recordScroll)
            if (mode === 'to') window.scrollTo(x, y)
            else window.scrollBy(x, y)
            return expected
        },
        { x, y, mode }
    )
    await page.waitForFunction(
        ({ x, y }) => {
            const state = (
                window as unknown as {
                    __TPP_WINDOW_SCROLL__?: { delivered: boolean }
                }
            ).__TPP_WINDOW_SCROLL__
            return state?.delivered && window.scrollX === x && window.scrollY === y
        },
        expected,
        { polling: 10, timeout: 2000 }
    )
    expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual(expected)
}

const scrollShell = async (page: Page, x: number, y: number, mode: 'to' | 'by' = 'by') => {
    const shell = page.getByTestId('shell')
    const expected = await shell.evaluate(
        (element, delta) => {
            const expected =
                delta.mode === 'to'
                    ? { x: delta.x, y: delta.y }
                    : { x: element.scrollLeft + delta.x, y: element.scrollTop + delta.y }
            element.dataset.scrollDelivered = 'false'
            const recordScroll = () => {
                if (element.scrollLeft === expected.x && element.scrollTop === expected.y) {
                    element.dataset.scrollDelivered = 'true'
                    element.removeEventListener('scroll', recordScroll)
                }
            }
            element.addEventListener('scroll', recordScroll)
            if (delta.mode === 'to') element.scrollTo(delta.x, delta.y)
            else element.scrollBy(delta.x, delta.y)
            return expected
        },
        { x, y, mode }
    )
    await expect
        .poll(
            () =>
                shell.evaluate((element) => ({
                    delivered: element.dataset.scrollDelivered,
                    x: element.scrollLeft,
                    y: element.scrollTop
                })),
            { timeout: 2000, intervals: [10] }
        )
        .toEqual({ delivered: 'true', ...expected })
}

test.describe('MotionConfig transformPagePoint drag', () => {
    test.beforeEach(async ({ page }) => installClock(page))

    test('matches scale-2 movement, velocity, bound values, and physical travel', async ({
        page
    }) => {
        await openCase(page, 'drag-uniform-scale')
        const before = await center(page.getByTestId('target'))
        await canonicalSequence(page)
        const after = await center(page.getByTestId('target'))
        const trace = await gestures(page)

        expect(trace.map(({ type }) => type)).toEqual([
            'onDragStart',
            'onDrag',
            'onDrag',
            'onDragEnd'
        ])
        expect(trace[0]).toMatchObject({
            info: { delta: { x: 4, y: 2 }, offset: { x: 4, y: 2 }, velocity: { x: 0, y: 0 } },
            boundValues: { x: 4, y: 2 }
        })
        expect(trace[2]).toMatchObject({
            info: {
                delta: { x: 56, y: 38 },
                offset: { x: 60, y: 40 },
                velocity: { x: 100, y: 50 }
            },
            boundValues: { x: 60, y: 40 }
        })
        expect(trace[3]).toMatchObject({
            info: { delta: { x: 0, y: 0 }, offset: { x: 60, y: 40 }, velocity: { x: 750, y: 500 } },
            boundValues: { x: 60, y: 40 }
        })
        expect(Math.abs(after.x - before.x - 30)).toBeLessThanOrEqual(2)
        expect(Math.abs(after.y - before.y - 20)).toBeLessThanOrEqual(2)
    })

    test('matches nonuniform affine coordinates without losing physical pointer tracking', async ({
        page
    }) => {
        await openCase(page, 'drag-nonuniform-affine')
        const before = await center(page.getByTestId('target'))
        await canonicalSequence(page)
        const after = await center(page.getByTestId('target'))
        const trace = await gestures(page)

        expect(trace.at(-2)).toMatchObject({
            info: {
                delta: { x: 56, y: 9.5 },
                offset: { x: 60, y: 10 },
                velocity: { x: 100, y: 12.5 }
            },
            boundValues: { x: 60, y: 10 }
        })
        expect(Math.abs(after.x - before.x - 30)).toBeLessThanOrEqual(2)
        expect(Math.abs(after.y - before.y - 20)).toBeLessThanOrEqual(2)
    })

    test('separates page-scroll terminal payload from rendered translation', async ({ page }) => {
        await openCase(page, 'drag-page-scroll-held')
        const start = await center(page.getByTestId('target'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x + 30, start.y + 20)
        await advance(page, 40)
        await scrollWindow(page, 45, 70)
        await advance(page, 30)
        expect((await snapshot(page, 'held')).boundValues).toMatchObject({ x: 60, y: 40 })
        await page.mouse.up()
        await advance(page, 20)
        expect((await gestures(page)).at(-1)).toMatchObject({
            type: 'onDragEnd',
            info: { delta: { x: 90, y: 140 }, offset: { x: 150, y: 180 } },
            boundValues: { x: 60, y: 40 }
        })
    })

    test('adds raw ancestor scroll to drag offset', async ({ page }) => {
        await openCase(page, 'drag-ancestor-scroll-held')
        await scrollShell(page, 90, 70, 'to')
        const start = await center(page.getByTestId('target'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x + 30, start.y + 20)
        await advance(page, 40)
        await scrollShell(page, 45, 55)
        await advance(page, 30)
        expect((await gestures(page)).at(-1)).toMatchObject({
            type: 'onDrag',
            info: { offset: { x: 105, y: 95 } },
            boundValues: { x: 105, y: 95 }
        })
        await page.mouse.up()
        await advance(page, 20)
    })

    test('keeps second-session offset gesture-relative and retains stable-closure history', async ({
        page
    }) => {
        await openCase(page, 'drag-reference-replacement')
        let start = await center(page.getByTestId('target'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x + 20, start.y + 10)
        await advance(page, 40)
        await action(page, 'setMapping', 'triple')
        await advance(page, 16)
        await page.mouse.move(start.x + 35, start.y + 20)
        await advance(page, 40)
        await page.mouse.up()
        await advance(page, 20)
        start = await center(page.getByTestId('target'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x + 10, start.y + 5)
        await advance(page, 40)
        await page.mouse.up()
        await advance(page, 20)
        expect((await gestures(page)).at(-2)).toMatchObject({
            info: { offset: { x: 30, y: 15 } },
            boundValues: { x: 100, y: 55 }
        })

        await openCase(page, 'drag-stable-closure-scale')
        start = await center(page.getByTestId('target'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x + 20, start.y + 10)
        await advance(page, 40)
        await action(page, 'setStableScale', 4)
        await page.waitForFunction(
            () =>
                Math.abs(
                    new DOMMatrix(
                        getComputedStyle(document.querySelector('[data-testid="stage"]')!).transform
                    ).a - 0.25
                ) < 0.0001,
            null,
            { polling: 10, timeout: 2000 }
        )
        const stableScaleCommit = await snapshot(page, 'stable-scale-commit')
        expect(stableScaleCommit).toMatchObject({
            rects: {
                target: {
                    x: 567,
                    y: 465,
                    top: 465,
                    right: 587,
                    bottom: 485,
                    left: 567,
                    width: 20,
                    height: 20
                }
            },
            boundValues: { x: 894, y: 710 }
        })
        let stableTrace = await gestures(page)
        expect(stableTrace[2]).toMatchObject({
            at: 1088,
            type: 'onDrag',
            info: {
                point: { x: 1708, y: 1380 },
                delta: { x: 854, y: 690 },
                offset: { x: 894, y: 710 },
                velocity: { x: 714.285714, y: 357.142857 }
            },
            boundValues: { x: 894, y: 710 }
        })
        await advance(page, 16)
        stableTrace = await gestures(page)
        expect(stableTrace[3]).toMatchObject({
            at: 1104,
            type: 'onDrag',
            info: {
                point: { x: 1708, y: 1380 },
                delta: { x: 0, y: 0 },
                offset: { x: 894, y: 710 },
                velocity: { x: 15964.285714, y: 12678.571429 }
            },
            boundValues: { x: 894, y: 710 }
        })
        await page.mouse.move(start.x + 30, start.y + 15)
        await advance(page, 40)
        await page.mouse.up()
        await advance(page, 20)
        expect((await gestures(page)).at(-1)).toMatchObject({
            info: { offset: { x: 934, y: 730 } },
            boundValues: { x: 934, y: 730 }
        })
    })

    test('matches numeric, ref, and resized ref bounds', async ({ page }) => {
        await openCase(page, 'drag-numeric-bounds')
        let start = await center(page.getByTestId('target'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x + 240, start.y + 160)
        await advance(page, 40)
        expect((await snapshot(page, 'positive')).boundValues).toMatchObject({ x: 110, y: 70 })
        await page.mouse.move(start.x - 240, start.y - 160)
        await advance(page, 40)
        expect((await snapshot(page, 'negative')).boundValues).toMatchObject({ x: -90, y: -60 })
        await page.mouse.up()
        await advance(page, 20)

        await openCase(page, 'drag-ref-bounds')
        start = await center(page.getByTestId('target'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x + 400, start.y + 260)
        await advance(page, 40)
        expect((await snapshot(page, 'positive')).boundValues).toMatchObject({ x: 246, y: 110 })
        await page.mouse.move(start.x - 400, start.y - 260)
        await advance(page, 40)
        expect((await snapshot(page, 'negative')).boundValues).toMatchObject({ x: -174, y: -110 })
        await page.mouse.up()
        await advance(page, 20)

        await openCase(page, 'drag-ref-resize-regrab')
        start = await center(page.getByTestId('target'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x + 350, start.y)
        await advance(page, 40)
        await page.mouse.up()
        await advance(page, 20)
        await action(page, 'resizeBoard', 620)
        await expect
            .poll(() => page.getByTestId('board').evaluate((element) => element.offsetWidth))
            .toBe(620)
        await advance(page, 32)
        const preRegrab = await snapshot(page, 'pre-regrab')
        expect(preRegrab).toMatchObject({
            rects: {
                target: {
                    x: 510,
                    y: 315,
                    top: 315,
                    right: 550,
                    bottom: 355,
                    left: 510,
                    width: 40,
                    height: 40
                }
            },
            layout: { boardOffsetWidth: 620 },
            boundValues: { x: 246, y: 0 }
        })
        start = await center(page.getByTestId('target'))
        expect(start).toEqual({ x: 530, y: 335 })
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x - 500, start.y)
        await advance(page, 40)
        await page.mouse.up()
        await advance(page, 20)
        const resizeTrace = await gestures(page)
        expect(resizeTrace.slice(-3).map(({ info }) => info.point.x)).toEqual([60, 60, 60])
        expect((await snapshot(page, 'resized')).boundValues).toMatchObject({ x: -174, y: 0 })
    })

    test('matches scrolled controls snap and real layout displacement', async ({ page }) => {
        await openCase(page, 'drag-controls-snap-scrolled')
        await scrollWindow(page, 120, 160, 'to')
        let start = await center(page.getByTestId('handle'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 20)
        expect((await snapshot(page, 'snap')).boundValues).toMatchObject({ x: -49, y: -436 })
        await page.mouse.move(start.x + 25, start.y + 15)
        await advance(page, 40)
        expect((await gestures(page)).at(-1)).toMatchObject({
            info: { offset: { x: 50, y: 30 } },
            boundValues: { x: 1, y: -406 }
        })
        await page.mouse.up()
        await advance(page, 20)

        await openCase(page, 'drag-real-layout-shift-held')
        start = await center(page.getByTestId('target'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x + 30, start.y + 15)
        await advance(page, 40)
        const beforeShift = await snapshot(page, 'before-shift')
        await action(page, 'shiftLayout', 60)
        await expect
            .poll(() => page.getByTestId('slot').evaluate((element) => element.offsetLeft))
            .toBe((beforeShift.layout.slotOffsetLeft ?? 0) + 60)
        await advance(page, 32)
        expect((await snapshot(page, 'shifted')).boundValues).toMatchObject({ x: 0, y: 30 })
        await page.mouse.move(start.x + 40, start.y + 20)
        await advance(page, 40)
        expect((await gestures(page)).at(-1)).toMatchObject({
            info: { offset: { x: 80, y: 40 } },
            boundValues: { x: 20, y: 40 }
        })
        await page.mouse.up()
        await advance(page, 20)
    })

    test('keeps repeated controls snaps aligned after drag and settled parent layout', async ({
        page
    }) => {
        await runLayoutSnapCorrectionRegression(page, 'drag-layout-snap-correction', {
            x: 0,
            y: 0
        })
    })

    test('keeps nonzero-initial controls snaps aligned after settled parent layout', async ({
        page
    }) => {
        await runLayoutSnapCorrectionRegression(page, 'drag-layout-snap-correction-nonzero', {
            x: 45,
            y: -30
        })
    })

    test('continues after unmount, resets detached values at end, and handles cancel', async ({
        page
    }) => {
        await openCase(page, 'drag-unmount-held')
        const start = await center(page.getByTestId('target'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x + 30, start.y + 20)
        await advance(page, 40)
        await action(page, 'unmount')
        await expect(page.getByTestId('target')).toHaveCount(0)
        await advance(page, 20)
        await page.mouse.move(start.x + 40, start.y + 30)
        await advance(page, 30)
        await page.mouse.up()
        await advance(page, 20)
        expect((await gestures(page)).at(-1)).toMatchObject({
            type: 'onDragEnd',
            info: { offset: { x: 80, y: 60 } },
            boundValues: { x: 0, y: 0 }
        })

        await openCase(page, 'drag-pointer-cancel')
        await canonicalSequence(page, 'cancel')
        expect((await gestures(page)).at(-1)).toMatchObject({
            type: 'onDragEnd',
            info: { offset: { x: 60, y: 40 } },
            boundValues: { x: 60, y: 40 }
        })
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(
            page.getByRole('link', { name: 'MotionConfig transformPagePoint — drag' })
        ).toHaveAttribute('href', /\/tests\/transform-page-point\/drag/)
    })
})
