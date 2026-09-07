import { expect, test } from '@playwright/test'

/**
 * Regression for the FIG-002 'card escapes the dragConstraints box' bug
 * reproduced in `src/routes/tests/drag/brutalist-stage`. With
 * `dragConstraints { left: -200, right: 200, top: -120, bottom: 120 }`,
 * `dragElastic: 0.18`, `dragMomentum: true`, and
 * `dragTransition { bounceStiffness: 360, bounceDamping: 24 }`, dragging
 * hard past a constraint and releasing should settle the card translate
 * back inside the constraint bounds. Rotation-disabled tests target raw
 * translate, while the rotated tests assert transform composition too.
 */

const STAGE_PATH = '/tests/drag/brutalist-stage?@isPlaywright=true'
const LEFT = -200
const RIGHT = 200
const TOP = -120
const BOTTOM = 120

import {
    readTransform,
    readTranslate,
    sampleTransformSeries,
    waitForSettledTransform
} from '../_helpers/transform'

const disableRotate = async (page: import('@playwright/test').Page) => {
    const rotateToggle = page.locator('.knobs input[type="checkbox"]').first()
    if (await rotateToggle.isChecked()) await rotateToggle.click()
}

test.describe('drag/brutalist-stage', () => {
    test('rotated card follows the pointer during active drag', async ({ page }) => {
        await page.goto(STAGE_PATH)
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })

        const start = await card.boundingBox()
        if (!start) throw new Error('no card bbox')
        const cx = start.x + start.width / 2
        const cy = start.y + start.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + 32, cy + 18, { steps: 1 })
        await expect(page.locator('.telemetry')).toContainText('status · dragging')

        for (const point of [
            { x: cx + 64, y: cy + 36 },
            { x: cx + 96, y: cy + 54 },
            { x: cx + 128, y: cy + 72 }
        ]) {
            await page.mouse.move(point.x, point.y, { steps: 1 })
            await page.waitForTimeout(16)
            const box = await card.boundingBox()
            if (!box) throw new Error('no card bbox during drag')
            const cardCenter = {
                x: box.x + box.width / 2,
                y: box.y + box.height / 2
            }
            expect(Math.abs(cardCenter.x - point.x)).toBeLessThanOrEqual(24)
            expect(Math.abs(cardCenter.y - point.y)).toBeLessThanOrEqual(24)
        }

        const activeTransform = await readTransform(page, '[data-testid="drag-card"]')
        expect(Math.abs(activeTransform.b)).toBeGreaterThan(0.08)
        expect(Math.abs(activeTransform.c)).toBeGreaterThan(0.08)

        await page.mouse.up()
    })

    test('hard rotated release preserves translate while whileDrag scale restores', async ({
        page
    }) => {
        await page.goto(STAGE_PATH)
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })
        await page.waitForSelector('[data-testid="drag-card"][data-is-loaded="ready"]')

        const start = await card.boundingBox()
        if (!start) throw new Error('no card bbox')
        const cx = start.x + start.width / 2
        const cy = start.y + start.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 8; i++) {
            await page.mouse.move(cx + i * 36, cy + i * 18, { steps: 1 })
            await page.waitForTimeout(16)
        }
        await page.mouse.up()

        // This used to briefly render `transform: none` after release when
        // the whileDrag scale restore completed before/after inertia.
        await page.waitForTimeout(400)
        const settled = await readTransform(page, '[data-testid="drag-card"]')
        expect(settled.tx).toBeGreaterThan(150)
        expect(settled.tx).toBeLessThanOrEqual(RIGHT + 1)
        expect(settled.ty).toBeGreaterThan(90)
        expect(settled.ty).toBeLessThanOrEqual(BOTTOM + 1)
        expect(Math.abs(settled.a - Math.cos((12 * Math.PI) / 180))).toBeLessThan(0.03)
        expect(Math.abs(settled.b - Math.sin((12 * Math.PI) / 180))).toBeLessThan(0.03)
    })

    test('moving the mouse after release does not let hover reset drag translate', async ({
        page
    }) => {
        await page.goto(STAGE_PATH)
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })
        await page.waitForSelector('[data-testid="drag-card"][data-is-loaded="ready"]')

        const start = await card.boundingBox()
        if (!start) throw new Error('no card bbox')
        const cx = start.x + start.width / 2
        const cy = start.y + start.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 8; i++) {
            await page.mouse.move(cx + i * 36, cy + i * 18, { steps: 1 })
            await page.waitForTimeout(16)
        }
        await page.mouse.up()
        await page.waitForTimeout(700)

        const settled = await readTransform(page, '[data-testid="drag-card"]')
        expect(settled.tx).toBeGreaterThan(150)
        expect(settled.ty).toBeGreaterThan(90)

        // Releasing while hovered and then moving the pointer should fire
        // whileHover cleanup/start. Those gesture animations must preserve
        // the drag translate instead of replacing transform with scale/none.
        await page.mouse.move(24, 24, { steps: 4 })
        await page.waitForTimeout(120)
        const afterMoveAway = await readTransform(page, '[data-testid="drag-card"]')
        expect(afterMoveAway.tx).toBeGreaterThan(150)
        expect(afterMoveAway.ty).toBeGreaterThan(90)

        const current = await card.boundingBox()
        if (!current) throw new Error('no card bbox after hover leave')
        await page.mouse.move(current.x + current.width / 2, current.y + current.height / 2, {
            steps: 4
        })
        await page.waitForTimeout(120)
        const afterMoveBack = await readTransform(page, '[data-testid="drag-card"]')
        expect(afterMoveBack.tx).toBeGreaterThan(150)
        expect(afterMoveBack.ty).toBeGreaterThan(90)
        expect(Math.abs(afterMoveBack.b)).toBeGreaterThan(0.08)
    })

    test('settles within constraint bounds after hard left + down drag', async ({ page }) => {
        await page.goto(STAGE_PATH)
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })
        await disableRotate(page)

        const start = await card.boundingBox()
        if (!start) throw new Error('no card bbox')
        const cx = start.x + start.width / 2
        const cy = start.y + start.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        // Drag well past the (-200, +120) corner with velocity
        for (let i = 1; i <= 20; i++) {
            await page.mouse.move(cx - i * 40, cy + i * 8, { steps: 1 })
        }
        await page.mouse.up()

        // Let the dragTransition spring fully settle. The probe in
        // src/routes/tests/drag/brutalist-stage showed settling by ~700ms;
        // give it 1500ms for CI headroom.
        await page.waitForTimeout(1500)

        const after = await readTranslate(page)
        if (!after) throw new Error('no transform')
        // Allow 1px tolerance — spring may settle at -199.999.
        expect(after.tx).toBeGreaterThanOrEqual(LEFT - 1)
        expect(after.tx).toBeLessThanOrEqual(RIGHT + 1)
        expect(after.ty).toBeGreaterThanOrEqual(TOP - 1)
        expect(after.ty).toBeLessThanOrEqual(BOTTOM + 1)
    })

    test('settles within constraint bounds after hard right + up drag', async ({ page }) => {
        await page.goto(STAGE_PATH)
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })
        await disableRotate(page)

        const start = await card.boundingBox()
        if (!start) throw new Error('no card bbox')
        const cx = start.x + start.width / 2
        const cy = start.y + start.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 20; i++) {
            await page.mouse.move(cx + i * 40, cy - i * 8, { steps: 1 })
        }
        await page.mouse.up()

        await page.waitForTimeout(1500)

        const after = await readTranslate(page)
        if (!after) throw new Error('no transform')
        expect(after.tx).toBeGreaterThanOrEqual(LEFT - 1)
        expect(after.tx).toBeLessThanOrEqual(RIGHT + 1)
        expect(after.ty).toBeGreaterThanOrEqual(TOP - 1)
        expect(after.ty).toBeLessThanOrEqual(BOTTOM + 1)
    })

    test('second drag from past-boundary still settles within absolute constraints', async ({
        page
    }) => {
        // The actual user-facing bug: after one hard drag past +200, on
        // *subsequent* drags the lib used to re-anchor the constraint
        // origin to the current applied position, which let the card walk
        // off-screen across multiple drags. Fix moved the momentum-branch
        // min/max from `origin.x` to `constraintsBase.x` so the boundary
        // is absolute, matching the pointermove-time elastic clamp.
        await page.goto(STAGE_PATH)
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })
        await disableRotate(page)

        const start = await card.boundingBox()
        if (!start) throw new Error('no card bbox')

        // First drag: hard right past +200.
        const cx1 = start.x + start.width / 2
        const cy1 = start.y + start.height / 2
        await page.mouse.move(cx1, cy1)
        await page.mouse.down()
        for (let i = 1; i <= 20; i++) {
            await page.mouse.move(cx1 + i * 40, cy1, { steps: 1 })
        }
        await page.mouse.up()
        await page.waitForTimeout(1500)

        const afterFirst = await readTranslate(page)
        if (!afterFirst) throw new Error('no transform')
        expect(afterFirst.tx).toBeGreaterThanOrEqual(LEFT - 1)
        expect(afterFirst.tx).toBeLessThanOrEqual(RIGHT + 1)

        // Second drag: from the current resting position, hard right again.
        // Before the fix this drag would re-anchor the constraint to the
        // current applied position, letting the card walk further past +200
        // with no spring snap-back.
        const next = await card.boundingBox()
        if (!next) throw new Error('no bbox 2')
        const cx2 = next.x + next.width / 2
        const cy2 = next.y + next.height / 2
        await page.mouse.move(cx2, cy2)
        await page.mouse.down()
        for (let i = 1; i <= 20; i++) {
            await page.mouse.move(cx2 + i * 40, cy2, { steps: 1 })
        }
        await page.mouse.up()
        await page.waitForTimeout(1500)

        const afterSecond = await readTranslate(page)
        if (!afterSecond) throw new Error('no transform 2')
        // Absolute constraint must still hold after the second drag.
        expect(afterSecond.tx).toBeGreaterThanOrEqual(LEFT - 1)
        expect(afterSecond.tx).toBeLessThanOrEqual(RIGHT + 1)
        expect(afterSecond.ty).toBeGreaterThanOrEqual(TOP - 1)
        expect(afterSecond.ty).toBeLessThanOrEqual(BOTTOM + 1)
    })

    // Motion 13.2 carries outward velocity into the boundary spring even
    // when release starts outside the constraints. An initial overshoot is
    // valid; the card must visibly spring back and settle at the left edge.
    test('out-of-bounds release springs back and stays at the constraint boundary', async ({
        page
    }) => {
        await page.goto(STAGE_PATH)
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })
        await expect(card).toHaveAttribute('data-is-loaded', 'ready')
        await disableRotate(page)

        const start = await card.boundingBox()
        if (!start) throw new Error('no card bbox')
        const cx = start.x + start.width / 2
        const cy = start.y + start.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 20; i++) {
            await page.mouse.move(cx - i * 40, cy, { steps: 1 })
        }

        // Confirm that the rendered drag has reached the overdrag region
        // before releasing; pointer events and rendering run on separate clocks.
        await expect.poll(async () => (await readTranslate(page)).tx).toBeLessThan(LEFT - 50)
        const releaseT = await readTranslate(page)
        await page.mouse.up()

        // Sample every rendered frame in-page, allowing the outward part of
        // the spring. At least one frame must show the return in progress,
        // catching both a frozen overdrag and an instant clamp to the edge.
        const selector = '[data-testid="drag-card"]'
        const samples = await sampleTransformSeries(page, [selector], 1000)
        expect(samples.some(({ tx }) => tx > releaseT.tx + 2 && tx < LEFT - 2)).toBe(true)

        await waitForSettledTransform(page, selector, { tx: LEFT, ty: 0 })
        const settledSamples = await sampleTransformSeries(page, [selector], 150)
        expect(settledSamples.length).toBeGreaterThan(0)
        for (const { tx, ty } of settledSamples) {
            expect(Math.abs(tx - LEFT)).toBeLessThanOrEqual(1)
            expect(Math.abs(ty)).toBeLessThanOrEqual(1)
        }
    })
})
