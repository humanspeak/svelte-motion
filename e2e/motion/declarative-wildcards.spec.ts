import { expect, test } from '@playwright/test'

/**
 * Adversarial-review finding: the declarative animate path resolves wildcard
 * (`null`) and relative (`'+=50'`) keyframes for the ANIMATION, but the
 * post-completion resting baseline was recomputed from the RAW definition —
 * so `x: null` / `'+=50'` reached the inline-style serializer unresolved and
 * the element snapped (or lost the channel) at settle.
 */
test.describe('declarative wildcard/relative settle', () => {
    const readX = (box: import('@playwright/test').Locator) =>
        box.evaluate((el) => {
            const t = getComputedStyle(el).transform
            if (!t || t === 'none') return 0
            const m = t.match(/matrix\(([^)]+)\)/)
            if (!m) return 0
            const parts = m[1].split(',').map((v) => parseFloat(v.trim()))
            return parts[4] ?? 0
        })

    test('animate x:null holds the initial value through settle', async ({ page }) => {
        await page.goto('/tests/motion/declarative-wildcards?@isPlaywright=true')
        const box = page.getByTestId('hold-box')
        await expect(box).toBeVisible()
        // Well past enter animation + settle write.
        await page.waitForTimeout(1500)
        const x = await readX(box)
        expect(x, `held x: ${x}`).toBeGreaterThan(62)
        expect(x, `held x: ${x}`).toBeLessThan(66)
    })

    test("animate x:'+=50' lands at initial+50 and stays there through settle", async ({
        page
    }) => {
        await page.goto('/tests/motion/declarative-wildcards?@isPlaywright=true')
        const box = page.getByTestId('relative-box')
        await expect(box).toBeVisible()
        await page.waitForTimeout(1500)
        const x = await readX(box)
        expect(x, `settled x: ${x}`).toBeGreaterThan(112)
        expect(x, `settled x: ${x}`).toBeLessThan(116)
    })
})
