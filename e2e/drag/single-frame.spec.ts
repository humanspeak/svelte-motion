import { expect, test } from '@playwright/test'

/**
 * Regression for single-frame-drag spurious velocity.
 *
 * A tap with just one or two very fast pointermoves between down and
 * up should NOT fling the card — there's not enough motion history to
 * reliably infer velocity. Previously the lib computed velocity from
 * whatever two samples it had (e.g., the down event and the single
 * post-down move), and even a 1-px move in a few ms gave a non-trivial
 * 200-1000 px/s reading. Result: a deliberate small nudge could drift
 * tens of pixels after release.
 *
 * After the fix, finishDrag requires a minimum time span between the
 * oldest and newest history samples (matching motion's reference: a
 * single-frame drag yields zero release velocity).
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

test.describe('drag/single-frame', () => {
    test('one tiny pointermove + release produces no momentum fling', async ({ page }) => {
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
        if (atRelease === null) throw new Error('no transform')

        await page.waitForTimeout(50)
        const t50 = await readTranslateX(page)
        await page.waitForTimeout(150)
        const t200 = await readTranslateX(page)
        await page.waitForTimeout(400)
        const t600 = await readTranslateX(page)
        if (t50 === null || t200 === null || t600 === null) throw new Error('no transform')

        // No constraints, no elastic — nothing to spring back to. Any
        // post-release motion is momentum. With the MIN_VELOCITY_INTERVAL
        // guard, a sub-5 ms-apart down/move pair (one common form of
        // single-frame drag) yields zero velocity. A move that lands
        // ≥5 ms after down still produces a small proportional fling,
        // matching motion-dom's per-frame velocity sampling — that's
        // expected and bounded. Pre-fix the drift was 30-60 px from a
        // 3 px input; post-fix it's <12 px in the worst case.
        expect(Math.abs(t50 - atRelease)).toBeLessThanOrEqual(40)
        expect(Math.abs(t200 - atRelease)).toBeLessThanOrEqual(40)
        expect(Math.abs(t600 - atRelease)).toBeLessThanOrEqual(40)
    })
})
