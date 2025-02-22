import { expect, test } from '@playwright/test'

test.describe('Enter Animation', () => {
    test('should animate from invisible to visible', async ({ page }) => {
        // Enable time control
        await page.context().setDefaultTimeout(0)
        await page.coverage.startJSCoverage() // This pauses time

        // Navigate to the page
        await page.goto('/tests/motion/enter-animation')

        // Get the animated element
        const element = page.getByTestId('motion-div')

        // Check initial state
        await expect(element).toHaveCSS('opacity', '0')

        // Resume time and wait for animation
        await page.coverage.stopJSCoverage()
        await page.waitForTimeout(500)

        // Check final state
        await expect(element).toHaveCSS('opacity', '1')
        await expect(element).toBeVisible()
        await expect(element).toHaveCSS('background-color', 'rgb(255, 0, 0)')
        await expect(element).toHaveCSS('border-radius', '50%')
    })
})
