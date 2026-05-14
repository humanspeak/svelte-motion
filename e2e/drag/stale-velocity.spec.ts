import { expect, test } from '@playwright/test'
import { readTranslateX } from '../_helpers/transform'

/**
 * Regression for stale velocity on pause-then-release drags. After a
 * fast drag + stationary hold > MAX_VELOCITY_DELTA_MS, release velocity
 * must be 0 (matching motion-dom's per-frame velocity invalidation).
 */

test.describe('drag/stale-velocity', () => {
    test('pause-then-release produces near-zero momentum', async ({ page }) => {
        await page.goto('/tests/drag/stale-velocity?@isPlaywright=true')
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })

        const s = await card.boundingBox()
        if (!s) throw new Error('no card bbox')
        const cx = s.x + s.width / 2
        const cy = s.y + s.height / 2

        // Fast drag right, then hold stationary, then release.
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 8; i++) {
            await page.mouse.move(cx + i * 30, cy, { steps: 1 })
        }
        // Hold stationary well past MAX_VELOCITY_DELTA_MS (≈ 30 ms).
        await page.waitForTimeout(500)
        // Capture position right before releasing
        const atHold = await readTranslateX(page)
        await page.mouse.up()
        // Give momentum a chance to fling the card if velocity was stale.
        // Sample at +50/+200/+500 ms — any meaningful fling will show.
        await page.waitForTimeout(50)
        const t50 = await readTranslateX(page)
        await page.waitForTimeout(150)
        const t200 = await readTranslateX(page)
        await page.waitForTimeout(300)
        const t500 = await readTranslateX(page)
        // No constraints, no elastic — there is nothing to spring back
        // to. The card must therefore stay within a couple of pixels of
        // its release position. Pre-fix, the t500 sample would have been
        // tens of pixels past `atHold` because momentum kept moving it.
        expect(Math.abs(t50 - atHold)).toBeLessThanOrEqual(3)
        expect(Math.abs(t200 - atHold)).toBeLessThanOrEqual(3)
        expect(Math.abs(t500 - atHold)).toBeLessThanOrEqual(3)
    })
})
