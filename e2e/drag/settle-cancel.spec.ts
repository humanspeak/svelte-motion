import { expect, test } from '@playwright/test'

/**
 * The two non-momentum release paths in finishDrag — `dragSnapToOrigin`
 * and the no-momentum elastic-clamp settle — used to invoke Motion's
 * `animate(...)` to drive the card back to its rest position, but
 * never registered a cancel hook. If the user immediately re-grabbed
 * mid-animation, the old `animate()` kept running on `x/y` and fought
 * the new drag, so the card drifted toward the old target instead of
 * tracking the pointer.
 *
 * Each test releases the card, waits ~120 ms for the settle animation
 * to be visibly partway through, then starts a second drag and moves
 * the pointer to a fixed position. The card should end up at that new
 * pointer position (within elastic), not drift back toward 0 / clamp.
 */

import { readDragTranslate, readTranslateX } from '../_helpers/transform'

test.describe('drag/settle-cancel', () => {
    test('snapToOrigin animation freezes when user re-grabs without moving', async ({ page }) => {
        // Re-grab mid-snap and HOLD. If the snap animation was cancelled,
        // the card stays at the re-grab position. If not, it keeps
        // creeping toward translateX=0 underneath the stationary pointer.
        await page.goto('/tests/drag/settle-cancel?@isPlaywright=true')
        const card = page.getByTestId('snap-card')
        await card.waitFor({ state: 'visible' })

        const s = await card.boundingBox()
        if (!s) throw new Error('no bbox')
        const cx = s.x + s.width / 2
        const cy = s.y + s.height / 2

        // First drag: +200 px, release. snap-to-origin starts animating
        // back to translateX=0 over the configured transition (~0.6 s).
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + 200, cy, { steps: 6 })
        await page.mouse.up()

        // Mid-snap (~120 ms in): translateX is partway between +200 and 0.
        await page.waitForTimeout(120)
        const midRect = await card.boundingBox()
        if (!midRect) throw new Error('no mid bbox')
        const midCx = midRect.x + midRect.width / 2
        const midTranslate = await readTranslateX(page, '[data-testid="snap-card"]')
        // Guard: if the snap finished early or never started, both reads
        // below would match and the test would pass without exercising
        // the cancel path. Require midTranslate to actually be mid-animation.
        expect(midTranslate).toBeGreaterThan(10)
        expect(midTranslate).toBeLessThan(190)

        // Re-grab without moving. Take the baseline after pointerdown so
        // one final in-flight frame before the re-grab isn't counted as
        // drift while held.
        await page.mouse.move(midCx, cy)
        await page.mouse.down()
        await page.evaluate(() => new Promise(requestAnimationFrame))
        const grabbedTranslate = await readTranslateX(page, '[data-testid="snap-card"]')
        await page.waitForTimeout(250)
        const heldTranslate = await readTranslateX(page, '[data-testid="snap-card"]')
        await page.mouse.up()

        // With cancel: translate barely changes. Without cancel: card
        // creeps further toward 0 by tens of px in 250 ms.
        // 8 px tolerance covers sub-frame style flushing after pointerdown.
        // Pre-fix value was ~60–90 px.
        expect(Math.abs(heldTranslate - grabbedTranslate)).toBeLessThanOrEqual(8)
    })

    test('no-momentum settle animation freezes when user re-grabs without moving', async ({
        page
    }) => {
        // Cleanest assertion: re-grab the card mid-settle and HOLD the
        // pointer stationary. If the settle animation was cancelled, the
        // card freezes at the re-grab position. If the animation kept
        // running, the card continues creeping toward the clamp boundary
        // underneath our static pointer, and the translateX changes.
        await page.goto('/tests/drag/settle-cancel?@isPlaywright=true')
        const card = page.getByTestId('settle-card')
        await card.waitFor({ state: 'visible' })

        const s = await card.boundingBox()
        if (!s) throw new Error('no bbox')
        const cx = s.x + s.width / 2
        const cy = s.y + s.height / 2

        // First drag: well past the +120 constraint so the release
        // launches a visible elastic-clamp settle animation.
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + 400, cy, { steps: 6 })
        await page.mouse.up()

        // Mid-settle (~120 ms in): translateX is somewhere between the
        // elastic-clamped overdrag value and +120.
        await page.waitForTimeout(120)
        const midRect = await card.boundingBox()
        if (!midRect) throw new Error('no mid bbox')
        const midCx = midRect.x + midRect.width / 2
        const midTranslate = await readTranslateX(page, '[data-testid="settle-card"]')
        // Guard: settle animation must still be in flight when we re-grab,
        // otherwise this test would pass without exercising the cancel path.
        // Range is (constraint +120, elastic overdrag ceiling).
        expect(midTranslate).toBeGreaterThan(130)
        expect(midTranslate).toBeLessThan(390)

        // Re-grab without moving. Take the baseline after pointerdown so
        // one final in-flight frame before the re-grab isn't counted as
        // drift while held.
        await page.mouse.move(midCx, cy)
        await page.mouse.down()
        await page.evaluate(() => new Promise(requestAnimationFrame))
        const grabbedTranslate = await readTranslateX(page, '[data-testid="settle-card"]')
        await page.waitForTimeout(250)
        const heldTranslate = await readTranslateX(page, '[data-testid="settle-card"]')
        await page.mouse.up()

        // With cancel: translate barely changes during the hold (within a
        // few px for sub-frame jitter). Without cancel: translate creeps
        // toward +120 by tens of pixels over 250 ms.
        // 8 px tolerance covers sub-frame style flushing after pointerdown.
        // Pre-fix value was ~60–90 px.
        expect(Math.abs(heldTranslate - grabbedTranslate)).toBeLessThanOrEqual(8)
    })

    test('release cancellation preserves authored base transform on re-grab', async ({ page }) => {
        await page.goto('/tests/drag/settle-cancel?@isPlaywright=true')
        const card = page.getByTestId('base-transform-card')
        await card.waitFor({ state: 'visible' })

        const start = await card.boundingBox()
        if (!start) throw new Error('no start bbox')
        const cy = start.y + start.height / 2
        const cx = start.x + start.width / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + 220, cy, { steps: 8 })
        await page.mouse.up()

        await page.waitForTimeout(80)
        const midRect = await card.boundingBox()
        if (!midRect) throw new Error('no mid bbox')
        const midCx = midRect.x + midRect.width / 2
        const beforeRegrab = await readDragTranslate(page, '[data-testid="base-transform-card"]')
        expect(beforeRegrab.tx).toBeGreaterThan(40)

        await page.mouse.move(midCx, cy)
        await page.mouse.down()
        await page.evaluate(() => new Promise(requestAnimationFrame))
        const grabbed = await readDragTranslate(page, '[data-testid="base-transform-card"]')
        await page.waitForTimeout(120)
        const held = await readDragTranslate(page, '[data-testid="base-transform-card"]')
        await page.mouse.up()

        expect(Math.abs(grabbed.tx - beforeRegrab.tx)).toBeLessThanOrEqual(8)
        expect(Math.abs(held.tx - grabbed.tx)).toBeLessThanOrEqual(8)
    })
})
