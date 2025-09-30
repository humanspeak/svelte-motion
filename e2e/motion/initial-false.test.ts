import { expect, test } from '@playwright/test'

test.describe('initial={false}', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/motion/initial-false?@humanspeak-svelte-motion-isPlaywright=true')
    })

    test('All three elements should be visible', async ({ page }) => {
        await expect(page.locator('[data-testid="initial-false-fade"]')).toBeVisible()
        await expect(page.locator('[data-testid="initial-false-scale"]')).toBeVisible()
        await expect(page.locator('[data-testid="initial-false-rotate"]')).toBeVisible()
    })

    test('Elements should be fully opaque immediately', async ({ page }) => {
        const elements = await page.locator('[data-testid^="initial-false-"]').all()
        for (const el of elements) {
            await expect(el).toHaveCSS('opacity', '1')
        }
    })

    test('Page should render exactly 3 elements', async ({ page }) => {
        const count = await page.locator('[data-testid^="initial-false-"]').count()
        expect(count).toBe(3)
    })
})
