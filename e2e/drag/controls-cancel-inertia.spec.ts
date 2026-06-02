import { expect, test } from '@playwright/test'
import { readTranslateX } from '../_helpers/transform'

/**
 * `dragControls.stop()` / `.cancel()` MUST stop an in-flight release
 * inertia animation, not silently no-op.
 */

test.describe('drag/controls cancel inertia', () => {
    test('stop() freezes the card mid-release spring-back', async ({ page }) => {
        await page.goto('/tests/drag/controls-cancel-inertia?@isPlaywright=true&slow')
        const card = page.getByTestId('drag-card')
        const stopBtn = page.getByTestId('stop-btn')
        await card.waitFor({ state: 'visible' })

        // Drag well past the right constraint (+100) with slowmode elastic →
        // the card visually sits past +100 during the drag and will
        // spring back slowly enough to make the stop assertion deterministic.
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
        await stopBtn.click()
        await page.waitForTimeout(300)
        const afterStopX = await readTranslateX(page)

        // The slow harness gives the spring a human-reviewable catch window.
        // Pre-fix the card still settles at +100; post-fix it freezes wherever
        // stop() caught it, well short of the constraint edge.
        expect(Math.abs(afterStopX - midX)).toBeLessThanOrEqual(35)
        expect(Math.abs(afterStopX - 100)).toBeGreaterThan(20)
    })
})
