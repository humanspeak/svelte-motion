import { expect, test } from '@playwright/test'

// Port of upstream's Cypress "deflects y perpendicular when driven by
// useAnimate()" (`packages/framer-motion/cypress/integration/transition-arc.ts`,
// commit 72a1ee2ec). `?freeze` pins the ease at 0.5, so 100 ms after the click
// the indicator sits at the chord midpoint (x = 200) and an arc path must have
// pushed it well off the straight line.
const URL = '/tests/arc/use-animate?@isPlaywright=true&freeze'

test.describe('arc() via useAnimate()', () => {
    test('deflects y perpendicular to the x travel on a plain element', async ({ page }) => {
        await page.goto(URL)
        const indicator = page.getByTestId('indicator')
        await indicator.waitFor({ state: 'visible' })

        await page.getByTestId('toggle').click()
        await page.waitForTimeout(100)

        const rect = await indicator.evaluate((el) => {
            const { left, top } = el.getBoundingClientRect()
            return { left, top }
        })

        expect(Math.abs(rect.left - (50 + 200)), `left at midpoint: ${rect.left}`).toBeLessThan(25)
        expect(Math.abs(rect.top - 200), `top must deflect off 200: ${rect.top}`).toBeGreaterThan(
            150
        )
    })
})
