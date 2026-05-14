import { expect, test } from '@playwright/test'

/**
 * Regression for stale velocity on pause-then-release drags.
 *
 * If the user drags fast, then holds the pointer stationary for several
 * hundred ms before releasing, the release velocity should be ~0 — the
 * user's hand was not moving at the moment of release. Previously the
 * 5-sample velocity history had no max-age filter, so the oldest sample
 * was still the pre-pause fast-motion sample, and the lib computed
 * velocity ≈ (delta over fast motion) / (delta-time over fast motion +
 * pause), which is a small fraction of the fast velocity but non-zero.
 * That non-zero velocity drove momentum on release and the card flung.
 *
 * After the fix, samples older than MAX_VELOCITY_DELTA_MS (~30 ms) are
 * dropped, matching motion-dom's reference implementation. A stationary
 * pause longer than that produces zero release velocity.
 */

const readTranslateX = async (page: import('@playwright/test').Page) => {
    return page.evaluate(() => {
        const el = document.querySelector('[data-testid="drag-card"]') as HTMLElement | null
        if (!el) return null
        const t = window.getComputedStyle(el).transform
        const m = t.match(/matrix\(([^)]+)\)/)
        if (!m) return 0
        const parts = m[1].split(',').map((s) => Number.parseFloat(s.trim()))
        return parts[4] ?? 0
    })
}

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
        if (atHold === null) throw new Error('no transform')

        await page.mouse.up()
        // Give momentum a chance to fling the card if velocity was stale.
        // Sample at +50/+200/+500 ms — any meaningful fling will show.
        await page.waitForTimeout(50)
        const t50 = await readTranslateX(page)
        await page.waitForTimeout(150)
        const t200 = await readTranslateX(page)
        await page.waitForTimeout(300)
        const t500 = await readTranslateX(page)
        if (t50 === null || t200 === null || t500 === null) throw new Error('no transform')

        // No constraints, no elastic — there is nothing to spring back
        // to. The card must therefore stay within a couple of pixels of
        // its release position. Pre-fix, the t500 sample would have been
        // tens of pixels past `atHold` because momentum kept moving it.
        expect(Math.abs(t50 - atHold)).toBeLessThanOrEqual(3)
        expect(Math.abs(t200 - atHold)).toBeLessThanOrEqual(3)
        expect(Math.abs(t500 - atHold)).toBeLessThanOrEqual(3)
    })
})
