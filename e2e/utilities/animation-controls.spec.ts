import { expect, test } from '@playwright/test'

test.describe('useAnimationControls', () => {
    const gotoReady = async (page: import('@playwright/test').Page) => {
        await page.goto('/tests/animation-controls')
        await expect(page.getByTestId('stage')).toHaveAttribute('data-hydrated', 'true')
    }

    test('starts coordinated subscribers and completes the sequence', async ({ page }) => {
        await gotoReady(page)

        await expect(page.getByTestId('label')).toHaveText('idle')

        await page.getByTestId('start').click()
        await expect(page.getByTestId('label')).toHaveText('complete', { timeout: 4000 })
        await expect(page.getByTestId('run-count')).toHaveText('runs: 1')

        const cardTransform = await page
            .getByTestId('card')
            .evaluate((el) => getComputedStyle(el).transform)
        expect(cardTransform === 'none' || cardTransform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true)
    })

    test('set jumps subscribers to their final variant state', async ({ page }) => {
        await gotoReady(page)

        await page.getByTestId('set').click()
        await expect(page.getByTestId('label')).toHaveText('complete')
        await expect(page.getByTestId('run-count')).toHaveText('runs: 1')
    })

    test('reset returns subscribers to idle after a run', async ({ page }) => {
        await gotoReady(page)

        await page.getByTestId('start').click()
        await expect(page.getByTestId('label')).toHaveText('complete', { timeout: 4000 })

        await page.getByTestId('reset').click()
        await expect(page.getByTestId('label')).toHaveText('idle')
    })
})
