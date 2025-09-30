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

    test('should smoothly continue animation when re-hovering during exit animation', async ({
        page
    }) => {
        await page.goto('/tests/random/hover-opacity')

        const button = page.locator('[data-testid="motion-hover-opacity"]')

        // Step 1: Hover to make it invisible
        await button.hover()
        await page.waitForTimeout(1500) // Wait for full fade to 0

        const invisibleOpacity = await button.evaluate((el) =>
            parseFloat(getComputedStyle(el).opacity)
        )
        expect(invisibleOpacity).toBeLessThan(0.1)

        // Step 2: Unhover to start animating back to visible
        await page.mouse.move(0, 0)
        await page.waitForTimeout(400) // Wait 400ms of 1000ms transition (40% complete)

        // Check that it's partially visible (animating back)
        const partiallyVisibleOpacity = await button.evaluate((el) =>
            parseFloat(getComputedStyle(el).opacity)
        )
        expect(partiallyVisibleOpacity).toBeGreaterThan(0.1) // Should have started fading back in
        expect(partiallyVisibleOpacity).toBeLessThan(0.9) // But not fully visible yet

        // Step 3: Hover again while it's animating back
        await button.hover()

        // Small wait to let animation start
        await page.waitForTimeout(100)

        // It should be smoothly animating to invisible from current position
        // NOT jumping instantly to invisible
        const reHoverOpacity = await button.evaluate((el) =>
            parseFloat(getComputedStyle(el).opacity)
        )

        // Should have started moving toward 0, but not jumped there instantly
        expect(reHoverOpacity).toBeLessThan(partiallyVisibleOpacity)
        expect(reHoverOpacity).toBeGreaterThan(0) // Should not be at 0 instantly

        // Wait for animation to complete
        await page.waitForTimeout(1500)

        const finalOpacity = await button.evaluate((el) => parseFloat(getComputedStyle(el).opacity))
        expect(finalOpacity).toBeLessThan(0.1) // Should eventually reach 0
    })
})
