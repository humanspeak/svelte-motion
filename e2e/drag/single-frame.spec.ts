import { expect, test } from '@playwright/test'
import { readTranslateX } from '../_helpers/transform'

/**
 * Regression for single-frame-drag spurious velocity. A tap with one or
 * two very fast pointermoves should NOT fling — there's not enough
 * resolution to infer velocity. See test.fail body for the lib gap that
 * keeps this expectation strict.
 */

test.describe('drag/single-frame', () => {
    test.fail('one tiny pointermove + release produces no momentum fling', async ({ page }) => {
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
        // The strict assertion: a single-frame drag should produce ~0
        // momentum. Current lib behaviour reads velocity from raw pointer
        // events with a MIN_VELOCITY_INTERVAL_MS=5 floor, which means a
        // single move at 16+ ms after pointerdown still computes a
        // proportional fling. To make this test pass cleanly we'd need
        // to switch to motion-dom's frame-rate-limited velocity sampling
        // (one sample per rAF frame, so a single-input drag literally
        // can't produce velocity > 0). Marked test.fail until the
        // deeper fix is in.
        expect(Math.abs(t50 - atRelease)).toBeLessThanOrEqual(2)
        expect(Math.abs(t200 - atRelease)).toBeLessThanOrEqual(2)
        expect(Math.abs(t600 - atRelease)).toBeLessThanOrEqual(2)
    })
})
