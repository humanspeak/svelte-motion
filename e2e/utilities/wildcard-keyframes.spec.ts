import { expect, test } from '@playwright/test'

/**
 * Plan 003 — wildcard and relative keyframes resolve against the live value.
 *
 * Upstream framer-motion treats `null` in a keyframe array as "the current
 * value" and a relative string (`'+=50'`) as an offset from the current value,
 * resolving both against the element's live value at animation start. Our port
 * historically handed the raw array/string to the WAAPI layer, which dropped
 * the wildcard channel within a frame (landing at 0) and ignored the relative
 * string entirely. These probes reproduce plan 007's landings.
 */
test.describe('wildcard / relative keyframes resolve against the live value', () => {
    const gotoReady = async (page: import('@playwright/test').Page) => {
        await page.goto('/tests/animation-controls?@isPlaywright=true')
        await page.getByTestId('card').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
    }

    // `.m41` is translateX for the non-rotated card; DOMMatrixReadOnly parses
    // both `matrix(...)` and the `matrix3d(...)` a GPU-promoted transform emits.
    const readCardX = (page: import('@playwright/test').Page) =>
        page.getByTestId('card').evaluate((el) => {
            const t = getComputedStyle(el).transform
            return t === 'none' ? 0 : new DOMMatrixReadOnly(t).m41
        })

    test('wildcard [0, null] resolves the trailing null to the live x (64)', async ({ page }) => {
        await gotoReady(page)

        // Park the card at x=64 (launch) over a slow linear run, then settle.
        await page.getByTestId('start-slow').click()
        await expect.poll(() => readCardX(page), { timeout: 4000 }).toBeGreaterThan(62)
        // Let the slow launch finish so the live x sits at exactly 64.
        await page.waitForTimeout(2200)
        const parked = await readCardX(page)
        expect(parked, `parked x: ${parked}`).toBeGreaterThan(62)

        // `{ x: [0, null] }` should animate 0→64 (null = live value) and land at
        // 64. Unfixed code drops the channel and lands at 0.
        await page.getByTestId('probe-wildcard').click()
        await page.waitForTimeout(600)
        const landed = await readCardX(page)
        expect(landed, `landed x: ${landed}`).toBeGreaterThan(62)
        expect(landed, `landed x: ${landed}`).toBeLessThan(66)
    })

    test('relative "+=50" resolves against the live x (0 → 50)', async ({ page }) => {
        await gotoReady(page)

        const start = await readCardX(page)
        expect(start, `start x: ${start}`).toBeLessThan(2)

        // `{ x: '+=50' }` from a fresh idle (x=0) should settle at 50. Unfixed
        // code produces no transform at all.
        await page.getByTestId('probe-relative').click()
        await page.waitForTimeout(600)
        const landed = await readCardX(page)
        expect(landed, `landed x: ${landed}`).toBeGreaterThan(48)
        expect(landed, `landed x: ${landed}`).toBeLessThan(52)
    })
})
