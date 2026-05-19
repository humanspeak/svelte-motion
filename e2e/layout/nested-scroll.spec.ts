import { expect, test } from '@playwright/test'
import { readTransform } from '../_helpers/transform'

/**
 * Regression for #353 — nested `layoutScroll` containers must sum offsets,
 * not just consult the nearest ancestor.
 *
 * Scenario: outer `layoutScroll` container, inner `layoutScroll` container,
 * `layout` motion.div inside. Resize the box, then scroll the OUTER
 * container mid-animation. With the chain-walking fix the box stays
 * anchored; without it, the outer scroll leaks into the FLIP delta.
 */
test.describe('layout/nested-scroll', () => {
    test('outer scroll mid-animation is cancelled by the FLIP delta', async ({ page }) => {
        await page.goto('/tests/layout/nested-scroll?@isPlaywright=true')

        const outer = page.getByTestId('outer')
        const box = page.getByTestId('box')
        const toggle = page.getByTestId('toggle')
        await box.waitFor({ state: 'visible' })

        const before = await box.boundingBox()
        if (!before) throw new Error('no initial boundingBox')

        await outer.evaluate((el) => {
            el.scrollTop = 0
        })

        await toggle.click()
        // Mid-animation, scroll the OUTER container (not the inner one
        // the box's direct parent — that would be the single-container case).
        await page.waitForTimeout(80)
        await outer.evaluate((el) => {
            el.scrollTop = 80
        })

        // Poll until the 1.8s tween settles. Box must reach its expanded
        // size with no residual translate from the FLIP delta — the outer
        // scroll was accounted for in both measurements.
        await expect
            .poll(
                async () => {
                    const t = await readTransform(page, '[data-testid="box"]')
                    const rect = await box.boundingBox()
                    return {
                        translateAtRest: Math.abs(t.tx) < 0.5 && Math.abs(t.ty) < 0.5,
                        scaleAtRest: Math.abs(t.a - 1) < 0.01 && Math.abs(t.d - 1) < 0.01,
                        widthGrew: (rect?.width ?? 0) > before.width + 20
                    }
                },
                { timeout: 4000, message: 'nested box did not settle with identity transform' }
            )
            .toEqual({ translateAtRest: true, scaleAtRest: true, widthGrew: true })

        const settled = await readTransform(page, '[data-testid="box"]')
        expect(Math.abs(settled.tx)).toBeLessThan(0.5)
        expect(Math.abs(settled.ty)).toBeLessThan(0.5)

        const after = await box.boundingBox()
        if (!after) throw new Error('no final boundingBox')
        expect(after.width).toBeGreaterThan(200)
        expect(after.height).toBeGreaterThan(200)
    })

    test('regression page renders both containers + box', async ({ page }) => {
        await page.goto('/tests/layout/nested-scroll?@isPlaywright=true')
        await expect(page.getByTestId('outer')).toBeVisible()
        await expect(page.getByTestId('inner')).toBeVisible()
        await expect(page.getByTestId('box')).toBeVisible()
    })
})
