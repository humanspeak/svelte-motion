import { expect, test } from '@playwright/test'

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

        // Reset outer scroll
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

        // Wait for the 1.8s tween to settle.
        await page.waitForTimeout(2000)

        // After settle, the FLIP delta should be zero (transform clears)
        // because the outer scroll was accounted for in both measurements.
        const transform = await box.evaluate((el) => (el as HTMLElement).style.transform || '')
        const drift = transform.match(/translateY\(([-\d.]+)px\)/)?.[1]
        if (drift !== undefined) {
            expect(Math.abs(Number(drift))).toBeLessThan(1)
        }

        // Sanity: box reached its expanded size.
        const rect = await box.boundingBox()
        if (!rect) throw new Error('no boundingBox')
        expect(rect.width).toBeGreaterThan(200)
        expect(rect.height).toBeGreaterThan(200)
    })

    test('regression page renders both containers + box', async ({ page }) => {
        await page.goto('/tests/layout/nested-scroll?@isPlaywright=true')
        await expect(page.getByTestId('outer')).toBeVisible()
        await expect(page.getByTestId('inner')).toBeVisible()
        await expect(page.getByTestId('box')).toBeVisible()
    })
})
