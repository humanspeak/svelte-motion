import { expect, test } from '@playwright/test'

test.describe('layoutId shared layout animation', () => {
    test('underline is visible under active tab on initial render', async ({ page }) => {
        await page.goto('/tests/layout-id?@isPlaywright=true')

        const underline = page.locator('[data-testid="underline"]')
        await expect(underline).toBeVisible()
        await expect(underline).toHaveCount(1)

        // Should be under tab 0 initially
        const tabs = page.locator('[data-testid="tabs"]')
        await expect(tabs).toHaveAttribute('data-active-tab', '0')
    })

    test('underline moves when switching tabs', async ({ page }) => {
        await page.goto('/tests/layout-id?@isPlaywright=true')

        const underline = page.locator('[data-testid="underline"]')
        await expect(underline).toBeVisible()

        // Get initial position under tab 0
        const tab0 = page.locator('[data-testid="tab-0"]')
        const tab1 = page.locator('[data-testid="tab-1"]')

        const tab0Rect = await tab0.boundingBox()
        const tab1Rect = await tab1.boundingBox()
        expect(tab0Rect).toBeTruthy()
        expect(tab1Rect).toBeTruthy()

        // Click tab 1
        await tab1.click()

        // Wait for the active tab attribute to update
        const tabs = page.locator('[data-testid="tabs"]')
        await expect(tabs).toHaveAttribute('data-active-tab', '1')

        // Wait for new underline to appear under tab 1
        await page.waitForFunction(
            (tab1Left) => {
                const el = document.querySelector('[data-testid="underline"]') as HTMLElement | null
                if (!el) return false
                const rect = el.getBoundingClientRect()
                // The underline should be positioned within tab 1's bounds
                return Math.abs(rect.left - tab1Left!) < 20
            },
            tab1Rect!.x,
            { timeout: 3000 }
        )
    })

    test('full cycle through all tabs', async ({ page }) => {
        await page.goto('/tests/layout-id?@isPlaywright=true')

        const tabs = page.locator('[data-testid="tabs"]')
        const underline = page.locator('[data-testid="underline"]')

        await expect(underline).toBeVisible()
        await expect(tabs).toHaveAttribute('data-active-tab', '0')

        // Click tab 1
        await page.locator('[data-testid="tab-1"]').click()
        await expect(tabs).toHaveAttribute('data-active-tab', '1')
        await expect(underline).toHaveCount(1)

        // Click tab 2
        await page.locator('[data-testid="tab-2"]').click()
        await expect(tabs).toHaveAttribute('data-active-tab', '2')
        await expect(underline).toHaveCount(1)

        // Click tab 0 again
        await page.locator('[data-testid="tab-0"]').click()
        await expect(tabs).toHaveAttribute('data-active-tab', '0')
        await expect(underline).toHaveCount(1)
    })

    test('rapid switching does not leak elements', async ({ page }) => {
        await page.goto('/tests/layout-id?@isPlaywright=true')

        const underline = page.locator('[data-testid="underline"]')
        await expect(underline).toBeVisible()

        // Click through tabs rapidly
        await page.locator('[data-testid="tab-1"]').click()
        await page.locator('[data-testid="tab-2"]').click()
        await page.locator('[data-testid="tab-0"]').click()
        await page.locator('[data-testid="tab-2"]').click()

        // Wait a moment for animations to settle
        await page.waitForTimeout(500)

        // Should only have one underline element
        await expect(underline).toHaveCount(1)
    })
})
