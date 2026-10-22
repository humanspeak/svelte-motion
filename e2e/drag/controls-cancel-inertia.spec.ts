import { expect, test } from '@playwright/test'
import { readTranslateX } from '../_helpers/transform'

/**
 * `dragControls.stop()` / `.cancel()` after release leave the release animation
 * alone, as in Motion.
 *
 * Motion 14.5's `DragControls.stop()` fans out to each subscribed
 * `VisualElementDragControls.stop()`, which returns early when no drag is live:
 * it calls `cancel()` (ends the pan session, never stops an axis animation) and
 * then `if (!isDragging || ...) return`
 * (motion-dom `gestures/drag/VisualElementDragControls.ts:290-305` and `:307-327`
 * @ v14.5.0). So the post-release spring-back keeps running to the constraint.
 */

test.describe('drag/controls cancel inertia', () => {
    test('stop() after release does not interrupt the spring-back (Motion no-op)', async ({
        page
    }) => {
        await page.goto('/tests/drag/controls-cancel-inertia?@isPlaywright=true&slow')
        const card = page.getByTestId('drag-card')
        const stopBtn = page.getByTestId('stop-btn')
        await card.waitFor({ state: 'visible' })

        // Drag well past the right constraint (+100) with slowmode elastic →
        // the card visually sits past +100 during the drag and springs back
        // slowly after release.
        const s = await card.boundingBox()
        if (!s) throw new Error('no card bbox')
        const cx = s.x + s.width / 2
        const cy = s.y + s.height / 2
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 12; i++) {
            await page.mouse.move(cx + i * 30, cy, { steps: 1 })
        }
        await page.mouse.up()

        await page.waitForTimeout(180)
        const midX = await readTranslateX(page)
        // Mid spring-back: still out past the right constraint edge.
        expect(midX).toBeGreaterThan(110)
        await stopBtn.click()

        // The spring is not stopped: it settles at the +100 constraint edge.
        await expect
            .poll(async () => Math.abs((await readTranslateX(page)) - 100), { timeout: 5000 })
            .toBeLessThan(2)
    })
})
