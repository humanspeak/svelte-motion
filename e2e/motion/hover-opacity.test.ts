import { expect, test } from '@playwright/test'

test.describe('Hover opacity animation', () => {
    test('smoothly animates opacity on hover and hover exit', async ({ page }) => {
        await page.goto('/tests/random/hover-opacity')

        const button = page.locator('[data-testid="motion-hover-opacity"]')
        await expect(button).toBeVisible()

        // Initial state - should be fully opaque
        const initialOpacity = await button.evaluate((el) => {
            return parseFloat(getComputedStyle(el).opacity)
        })
        expect(initialOpacity).toBeCloseTo(1, 1)

        // Hover over the button
        await button.hover()

        // Wait for hover animation to complete (1.5 seconds)
        await page.waitForTimeout(1500)

        // Check that opacity is now 0 (or very close to 0)
        const hoveredOpacity = await button.evaluate((el) => {
            return parseFloat(getComputedStyle(el).opacity)
        })
        expect(hoveredOpacity).toBeLessThan(0.1) // Should be very close to 0

        // Move mouse away to trigger hover exit
        await page.mouse.move(0, 0)

        // Wait for hover exit animation to complete (1.5 seconds)
        await page.waitForTimeout(1500)

        // Check that opacity is back to 1
        const exitOpacity = await button.evaluate((el) => {
            return parseFloat(getComputedStyle(el).opacity)
        })
        expect(exitOpacity).toBeCloseTo(1, 1)

        // Test second hover to ensure consistency
        await button.hover()
        await page.waitForTimeout(1500)

        const secondHoverOpacity = await button.evaluate((el) => {
            return parseFloat(getComputedStyle(el).opacity)
        })
        expect(secondHoverOpacity).toBeLessThan(0.1)

        // Second hover exit
        await page.mouse.move(0, 0)
        await page.waitForTimeout(1500)

        const secondExitOpacity = await button.evaluate((el) => {
            return parseFloat(getComputedStyle(el).opacity)
        })
        expect(secondExitOpacity).toBeCloseTo(1, 1)
    })

    test('maintains smooth transitions with multiple rapid hovers', async ({ page }) => {
        await page.goto('/tests/random/hover-opacity')

        const button = page.locator('[data-testid="motion-hover-opacity"]')
        await expect(button).toBeVisible()

        // Perform rapid hover/unhover cycles
        for (let i = 0; i < 3; i++) {
            await button.hover()
            await page.waitForTimeout(200) // Short wait to start animation
            await page.mouse.move(0, 0)
            await page.waitForTimeout(200)
        }

        // Final hover and wait for completion
        await button.hover()
        await page.waitForTimeout(1500)

        const finalHoverOpacity = await button.evaluate((el) => {
            return parseFloat(getComputedStyle(el).opacity)
        })
        expect(finalHoverOpacity).toBeLessThan(0.1)

        // Final exit and wait for completion
        await page.mouse.move(0, 0)
        await page.waitForTimeout(1500)

        const finalExitOpacity = await button.evaluate((el) => {
            return parseFloat(getComputedStyle(el).opacity)
        })
        expect(finalExitOpacity).toBeCloseTo(1, 1)
    })
})
