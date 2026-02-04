import { expect, test } from '@playwright/test'

test.describe('AnimatePresence Nested Keys', () => {
    test('direct child with key should animate in/out correctly', async ({ page }) => {
        await page.goto('/tests/animate-presence/nested-keys?@isPlaywright=true')

        const card = page.getByTestId('card')
        const toggleMain = page.getByTestId('toggle-main')

        // Card should be visible initially
        await expect(card).toBeVisible()

        // Hide card - should animate out
        await toggleMain.click()
        await expect(card).not.toBeVisible()

        // Show card - should animate in
        await toggleMain.click()
        await expect(card).toBeVisible()
    })

    test('nested motion elements without keys should work correctly', async ({ page }) => {
        await page.goto('/tests/animate-presence/nested-keys?@isPlaywright=true')

        // All nested elements should be visible
        const nested1 = page.getByTestId('nested-1')
        const nested2 = page.getByTestId('nested-2')
        const deeplyNested = page.getByTestId('deeply-nested')

        await expect(nested1).toBeVisible()
        await expect(nested2).toBeVisible()
        await expect(deeplyNested).toBeVisible()

        // Verify they have correct content
        await expect(nested1).toContainText('Nested element 1 (no key)')
        await expect(nested2).toContainText('Nested element 2 (no key)')
        await expect(deeplyNested).toContainText('Deeply nested span (no key)')
    })

    test('conditional nested element should animate independently', async ({ page }) => {
        await page.goto('/tests/animate-presence/nested-keys?@isPlaywright=true')

        const nestedConditional = page.getByTestId('nested-conditional')
        const toggleNested = page.getByTestId('toggle-nested')

        // Should be visible initially
        await expect(nestedConditional).toBeVisible()

        // Hide conditional nested element
        await toggleNested.click()
        await expect(nestedConditional).not.toBeVisible()

        // Show conditional nested element
        await toggleNested.click()
        await expect(nestedConditional).toBeVisible()
    })

    test('nested elements should exit with parent when parent exits', async ({ page }) => {
        await page.goto('/tests/animate-presence/nested-keys?@isPlaywright=true')

        const card = page.getByTestId('card')
        const nested1 = page.getByTestId('nested-1')
        const nested2 = page.getByTestId('nested-2')
        const toggleMain = page.getByTestId('toggle-main')

        // All should be visible
        await expect(card).toBeVisible()
        await expect(nested1).toBeVisible()
        await expect(nested2).toBeVisible()

        // Hide card - all nested elements should also disappear
        await toggleMain.click()

        await expect(card).not.toBeVisible()
        await expect(nested1).not.toBeVisible()
        await expect(nested2).not.toBeVisible()
    })

    test('nested elements should re-enter with parent when parent enters', async ({ page }) => {
        await page.goto('/tests/animate-presence/nested-keys?@isPlaywright=true')

        const card = page.getByTestId('card')
        const nested1 = page.getByTestId('nested-1')
        const nested2 = page.getByTestId('nested-2')
        const toggleMain = page.getByTestId('toggle-main')

        // Hide card
        await toggleMain.click()
        await expect(card).not.toBeVisible()

        // Show card again
        await toggleMain.click()

        // All nested elements should reappear with parent
        await expect(card).toBeVisible()
        await expect(nested1).toBeVisible()
        await expect(nested2).toBeVisible()
    })
})
