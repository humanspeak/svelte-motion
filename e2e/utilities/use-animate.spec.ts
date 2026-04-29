import { expect, test } from '@playwright/test'

test.describe('useAnimate', () => {
    test('idle on load; list items render', async ({ page }) => {
        await page.goto('/tests/useAnimate')

        await expect(page.getByTestId('status')).toHaveText('idle')
        await expect(page.getByTestId('list').locator('li')).toHaveCount(4)
        await expect(page.getByTestId('item-1')).toHaveText('Item one')
    })

    test('clicking Animate runs the sequence and flips status to done', async ({ page }) => {
        await page.goto('/tests/useAnimate')

        await page.getByTestId('run').click()
        await expect(page.getByTestId('status')).toHaveText('done', { timeout: 4000 })

        // Final keyframes left scoped elements at their resting visible state.
        const opacity = await page
            .getByTestId('item-1')
            .evaluate((el) => getComputedStyle(el).opacity)
        expect(Number(opacity)).toBeCloseTo(1, 1)
    })

    test('clicking Reset returns status to idle', async ({ page }) => {
        await page.goto('/tests/useAnimate')

        await page.getByTestId('run').click()
        await expect(page.getByTestId('status')).toHaveText('done', { timeout: 4000 })

        await page.getByTestId('reset').click()
        await expect(page.getByTestId('status')).toHaveText('idle')
    })
})
