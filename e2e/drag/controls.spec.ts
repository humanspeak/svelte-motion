import { expect, test, type Locator, type Page } from '@playwright/test'

type PointerDownSnapshot = {
    clientX: number
    clientY: number
    pointerType: string
    isPrimary: boolean
    button: number
    buttons: number
}

const installControlObservers = async (handle: Locator, target: Locator) => {
    await handle.evaluate((node) => {
        node.addEventListener('pointerdown', (event) => {
            const pointerEvent = event as PointerEvent
            node.setAttribute(
                'data-playwright-pointerdown',
                JSON.stringify({
                    clientX: pointerEvent.clientX,
                    clientY: pointerEvent.clientY,
                    pointerType: pointerEvent.pointerType,
                    isPrimary: pointerEvent.isPrimary,
                    button: pointerEvent.button,
                    buttons: pointerEvent.buttons
                })
            )
        })
    })
    // Drag starts are counted by the fixture page from `onDragStart`, which is
    // Motion's only drag-start signal (no DOM marker or event;
    // `VisualElementDragControls.start` fires `onDragStart` from `frame.update`,
    // VisualElementDragControls.ts:191-193 @ v14.5.0).
    await expect(target).toHaveAttribute('data-drag-start-count', '0')
}

const readPointerDown = async (handle: Locator): Promise<PointerDownSnapshot> => {
    const value = await handle.getAttribute('data-playwright-pointerdown')
    if (!value) throw new Error('no pointerdown snapshot')
    return JSON.parse(value) as PointerDownSnapshot
}

/**
 * Matches `actual` against `expected` key by key: numbers to within
 * `tolerance` px, everything else exactly. Browsers place boxes on different
 * sub-pixel grids (Chromium 1/64px, Firefox 1/60px), so a box Chromium reports
 * at 590 sits at 589.983 in Firefox; a real teleport is tens of pixels.
 *
 * @param tolerance Allowed difference for numbers. Pointer coordinates need
 *     {@link POINTER_TOLERANCE}: Firefox reports them in whole pixels.
 */
const expectClose = (actual: object, expected: Record<string, unknown>, tolerance = 0.05) => {
    const values = actual as Record<string, unknown>
    for (const [key, value] of Object.entries(expected)) {
        if (typeof value === 'number')
            expect(Math.abs((values[key] as number) - value), key).toBeLessThanOrEqual(tolerance)
        else expect(values[key], key).toBe(value)
    }
}

/** Firefox truncates synthetic pointer coordinates to whole pixels. */
const POINTER_TOLERANCE = 1

const waitForAnimationFrame = async (page: Page) => {
    await page.evaluate(
        () =>
            new Promise<void>((resolve) => {
                requestAnimationFrame(() => resolve())
            })
    )
}

const waitForAnimationFrames = async (page: Page) => {
    await page.evaluate(
        () =>
            new Promise<void>((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            })
    )
}

test.describe('drag/controls', () => {
    test('imperative start moves x only with dragControls', async ({ page }) => {
        await page.goto('/tests/drag/controls?@isPlaywright=true')
        const el = page.getByTestId('drag-controls')
        const handle = page.getByTestId('handle')
        await el.waitFor({ state: 'visible' })
        await handle.waitFor({ state: 'visible' })
        const s = await el.boundingBox()
        const h = await handle.boundingBox()
        if (!s) throw new Error('no s')
        if (!h) throw new Error('no h')

        // Use Playwright's mouse API for reliable cross-platform behavior
        // Click on handle to initiate drag
        await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
        await page.mouse.down()
        // Move further right to ensure clear movement (snapToCursor centers the 100px element on cursor)
        await page.mouse.move(s.x + 120, s.y + 40, { steps: 5 })
        await page.mouse.up()

        await page.waitForTimeout(100)
        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        // With snapToCursor and 100px width, element left edge = cursor - 50 = s.x + 120 - 50 = s.x + 70
        expect(e.x).toBeGreaterThan(s.x + 50)
        expect(Math.abs(e.y - s.y)).toBeLessThan(5)
    })

    test('tiny right nudge does NOT teleport on x-only dragControls', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 })
        await page.goto('/tests/drag/controls?@isPlaywright=true')
        const el = page.getByTestId('drag-controls')
        const handle = page.getByTestId('handle')
        await el.waitFor({ state: 'visible' })
        await handle.waitFor({ state: 'visible' })
        await waitForAnimationFrames(page)
        const s = await el.boundingBox()
        const h = await handle.boundingBox()
        if (!s) throw new Error('no s')
        if (!h) throw new Error('no h')

        expect(page.viewportSize()).toEqual({ width: 1280, height: 720 })
        expectClose(s, { x: 590, y: 235, width: 100, height: 100 })
        const handleCenter = { x: h.x + h.width / 2, y: h.y + h.height / 2 }
        expectClose(handleCenter, { x: 640, y: 215 })
        await installControlObservers(handle, el)

        // Use mouse API for micro nudge
        await page.mouse.move(handleCenter.x, handleCenter.y)
        await page.mouse.down()
        // micro nudge on x (just 2px)
        await page.mouse.move(handleCenter.x + 2, handleCenter.y, { steps: 2 })
        await page.mouse.up()
        await waitForAnimationFrames(page)

        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        const tinyPointerDown = await readPointerDown(handle)
        expectClose(
            tinyPointerDown,
            {
                clientX: handleCenter.x,
                clientY: handleCenter.y,
                pointerType: 'mouse',
                isPrimary: true,
                button: 0,
                buttons: 1
            },
            POINTER_TOLERANCE
        )
        await expect(el).toHaveAttribute('data-drag-start-count', '0')
        // The press snaps the box's centre to the pointer, which Firefox
        // reports in whole pixels, so the box may shift by under a pixel.
        expect(Math.abs(e.x - s.x)).toBeLessThanOrEqual(POINTER_TOLERANCE)
        expect(Math.abs(e.y - s.y)).toBeLessThanOrEqual(POINTER_TOLERANCE)
        // The threshold-only snap must not jump across the page.
        expect(e.x - s.x).toBeLessThan(40)
        expect(Math.abs(e.y - s.y)).toBeLessThan(2)

        // Cross the 3px threshold separately so this regression still fails if dragging is disabled.
        await page.mouse.move(handleCenter.x, handleCenter.y)
        await page.mouse.down()
        await page.mouse.move(handleCenter.x + 20, handleCenter.y, { steps: 5 })
        await expect(el).toHaveAttribute('data-dragging', 'true')
        const active = await el.boundingBox()
        if (!active) throw new Error('no active')
        await expect(el).toHaveAttribute('data-drag-start-count', '1')
        expect(active.x - e.x).toBeCloseTo(20, 0)
        expect(Math.abs(active.y - e.y)).toBeLessThan(2)
        await page.mouse.up()
        await expect(el).toHaveAttribute('data-dragging', 'false')
    })

    test('snapToCursor does not creep across repeated drags with initial coordinates', async ({
        page
    }) => {
        await page.setViewportSize({ width: 1280, height: 720 })
        await page.goto('/tests/drag/controls?@isPlaywright=true')
        const el = page.getByTestId('drag-controls-initial')
        const handle = page.getByTestId('initial-handle')
        await el.waitFor({ state: 'visible' })
        await handle.waitFor({ state: 'visible' })
        await waitForAnimationFrames(page)

        expect(page.viewportSize()).toEqual({ width: 1280, height: 720 })
        const boot = await el.boundingBox()
        const bootHandle = await handle.boundingBox()
        if (!boot) throw new Error('no boot')
        if (!bootHandle) throw new Error('no boot handle')
        expectClose(boot, { x: 700, y: 477, width: 80, height: 80 })
        expect(bootHandle.width).toBeGreaterThan(0)
        expect(bootHandle.height).toBeGreaterThan(0)
        expect(bootHandle.height).toBe(24)
        expect(bootHandle.x).toBeGreaterThanOrEqual(0)
        expect(bootHandle.y).toBeGreaterThanOrEqual(0)
        expect(bootHandle.x + bootHandle.width).toBeLessThanOrEqual(1280)
        expect(bootHandle.y + bootHandle.height).toBeLessThanOrEqual(720)
        expectClose(
            { x: bootHandle.x + bootHandle.width / 2, y: bootHandle.y + bootHandle.height / 2 },
            { x: 640, y: 417 }
        )
        expect(
            await handle.evaluate(
                (element, point) => document.elementFromPoint(point.x, point.y) === element,
                { x: 640, y: 417 }
            )
        ).toBe(true)
        const initialTranslation = await el.evaluate((node) => {
            const transform = new DOMMatrixReadOnly(getComputedStyle(node).transform)
            return { x: transform.m41, y: transform.m42 }
        })
        expectClose(initialTranslation, { x: 100, y: 40 })
        await installControlObservers(handle, el)

        const pointerStart = { x: 640, y: 417 }
        const pointerEnd = { x: 790, y: 467 }
        const sessions: Array<{
            before: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>
            handle: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>
            pointerDown: PointerDownSnapshot
            snapped: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>
            active: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>
            end: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>
        }> = []

        const dragToHandle = async () => {
            const before = await el.boundingBox()
            const h = await handle.boundingBox()
            if (!before) throw new Error('no before')
            if (!h) throw new Error('no h')
            const start = { x: h.x + h.width / 2, y: h.y + h.height / 2 }
            await page.mouse.move(start.x, start.y)
            await page.mouse.down()
            const pointerDown = await readPointerDown(handle)
            // Motion 14.5 snaps in the pan session's `onSessionStart`, which
            // writes the axis MotionValues; the VisualElement paints them on the
            // next frame (VisualElementDragControls.ts:121-124 @ v14.5.0).
            await waitForAnimationFrame(page)
            const snapped = await el.boundingBox()
            if (!snapped) throw new Error('no snapped')
            await page.mouse.move(pointerEnd.x, pointerEnd.y, { steps: 5 })
            await page.waitForTimeout(50)
            await expect(el).toHaveAttribute('data-dragging', 'true')
            const active = await el.boundingBox()
            if (!active) throw new Error('no active')
            await page.mouse.up()
            await page.waitForTimeout(100)
            await expect(el).toHaveAttribute('data-dragging', 'false')
            const end = await el.boundingBox()
            if (!end) throw new Error('no end')
            sessions.push({ before, handle: h, pointerDown, snapped, active, end })
        }

        await dragToHandle()
        await dragToHandle()
        await dragToHandle()

        const positions = sessions.map(({ before, snapped, active, end }) => ({
            before: { x: before.x, y: before.y },
            snapped: { x: snapped.x, y: snapped.y },
            active: { x: active.x, y: active.y },
            end: { x: end.x, y: end.y }
        }))
        const positionReport = `actual repeated drag positions: ${JSON.stringify(positions)}`

        expect(sessions[0].before).toEqual(boot)
        for (const [index, session] of sessions.entries()) {
            expect(session.handle).toEqual(bootHandle)
            expectClose(
                session.pointerDown,
                {
                    clientX: pointerStart.x,
                    clientY: pointerStart.y,
                    pointerType: 'mouse',
                    isPrimary: true,
                    button: 0,
                    buttons: 1
                },
                POINTER_TOLERANCE
            )
            expectClose(
                {
                    x: session.handle.x + session.handle.width / 2,
                    y: session.handle.y + session.handle.height / 2
                },
                { x: session.pointerDown.clientX, y: session.pointerDown.clientY },
                POINTER_TOLERANCE
            )
            expect(
                Math.abs(
                    session.snapped.x + session.snapped.width / 2 - session.pointerDown.clientX
                ),
                positionReport
            ).toBeLessThanOrEqual(2)
            expect(
                Math.abs(
                    session.snapped.y + session.snapped.height / 2 - session.pointerDown.clientY
                ),
                positionReport
            ).toBeLessThanOrEqual(2)
            expect(
                Math.abs(session.end.x + session.end.width / 2 - pointerEnd.x),
                positionReport
            ).toBeLessThanOrEqual(2)
            expect(
                Math.abs(session.end.y + session.end.height / 2 - pointerEnd.y),
                positionReport
            ).toBeLessThanOrEqual(2)
            expect(Math.abs(session.active.x - session.end.x), positionReport).toBeLessThanOrEqual(
                2
            )
            expect(Math.abs(session.active.y - session.end.y), positionReport).toBeLessThanOrEqual(
                2
            )
            if (index > 0) {
                expect(
                    Math.abs(session.before.x - sessions[index - 1].end.x),
                    positionReport
                ).toBeLessThanOrEqual(2)
                expect(
                    Math.abs(session.before.y - sessions[index - 1].end.y),
                    positionReport
                ).toBeLessThanOrEqual(2)
                expect(
                    Math.abs(session.end.x - sessions[0].end.x),
                    positionReport
                ).toBeLessThanOrEqual(2)
                expect(
                    Math.abs(session.end.y - sessions[0].end.y),
                    positionReport
                ).toBeLessThanOrEqual(2)
            }
        }
        await expect(el).toHaveAttribute('data-drag-start-count', '3')
    })

    test('immediate: a press and release without moving still starts and ends the drag', async ({
        page
    }) => {
        await page.goto('/tests/drag/controls?@isPlaywright=true')
        const el = page.getByTestId('drag-controls-immediate')
        const handle = page.getByTestId('immediate-handle')
        await el.waitFor({ state: 'visible' })
        await handle.scrollIntoViewIfNeeded()
        await waitForAnimationFrames(page)
        await expect(page.getByTestId('immediate-start')).toHaveText('0')
        await expect(page.getByTestId('immediate-end')).toHaveText('0')

        const h = await handle.boundingBox()
        if (!h) throw new Error('no h')
        await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
        await page.mouse.down()
        await waitForAnimationFrames(page)
        await page.mouse.up()

        await expect(page.getByTestId('immediate-start')).toHaveText('1')
        await expect(page.getByTestId('immediate-end')).toHaveText('1')
    })
})
