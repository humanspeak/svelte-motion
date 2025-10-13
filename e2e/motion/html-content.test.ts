import { expect, test } from '@playwright/test'

test.describe('HTML Content', () => {
    test('should animate number from 0 to 100', async ({ page }) => {
        await page.goto('/tests/motion/html-content?@isPlaywright=true')

        const pre = page.locator('pre')

        // Starts near 0
        await expect(pre).toHaveText(/^(0|[0-5])$/)

        // Eventually reaches 100 within 6s (duration is 5s)
        await expect(pre).toHaveText(/^100$/, { timeout: 6000 })

        // Style assertions
        await expect(pre).toHaveCSS('font-size', '64px')
        await expect(pre).toHaveCSS('color', 'rgb(141, 240, 204)')
    })
})
