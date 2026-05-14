import { expect, test } from '@playwright/test'
import { readTranslateX } from '../_helpers/transform'

/**
 * Regression for single-frame-drag spurious velocity. A tap with one or
 * two very fast pointermoves should NOT fling — there's not enough
 * resolution to infer velocity.
 *
 * Marked `fixme` because `computeReleaseVelocity` infers velocity from
 * raw pointer events with a `MIN_VELOCITY_INTERVAL_MS=5` floor: when
 * Playwright dispatches `pointermove`+`pointerup` more than 5 ms apart
 * (common when the full suite is under load) the inference fires and
 * produces a proportional fling (~20 px). Skipped until we switch to
 * motion-dom's frame-rate-limited velocity sampling, which guarantees
 * one sample per rAF frame — a single-input drag literally cannot
 * produce velocity > 0 under that model.
 */

test.describe('drag/single-frame', () => {
    test.fixme('one tiny pointermove + release produces no momentum fling', async ({ page }) => {
        await page.goto('/tests/drag/single-frame?@isPlaywright=true')
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })

        const s = await card.boundingBox()
        if (!s) throw new Error('no bbox')
        const cx = s.x + s.width / 2
        const cy = s.y + s.height / 2

        // Pointer down, single ~3 px nudge right with no time gap, release.
        // This is the "tap with a tiny shake" pattern.
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + 3, cy)
        await page.mouse.up()

        // The card should sit at translateX=3 (the nudge) and stay there.
        // Sample over 600 ms — if a fling happened, the card would drift
        // by tens of px in this window.
        const atRelease = await readTranslateX(page)
        await page.waitForTimeout(50)
        const t50 = await readTranslateX(page)
        await page.waitForTimeout(150)
        const t200 = await readTranslateX(page)
        await page.waitForTimeout(400)
        const t600 = await readTranslateX(page)
        expect(Math.abs(t50 - atRelease)).toBeLessThanOrEqual(2)
        expect(Math.abs(t200 - atRelease)).toBeLessThanOrEqual(2)
        expect(Math.abs(t600 - atRelease)).toBeLessThanOrEqual(2)
    })
})
