import { expect, test } from '@playwright/test'

test.describe('effects/three', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/effects/three?@isPlaywright=true')
        await expect(page.getByTestId('move')).toBeEnabled()
    })

    test('animate(mesh) through the registry rotates the mesh', async ({ page }) => {
        const rotateY = page.getByTestId('rotate-y')

        await page.getByTestId('move').click()

        await expect
            .poll(async () => Number(await rotateY.textContent()), { timeout: 4000 })
            .toBeCloseTo(6.28, 1)
    })

    test('uniform progress animates to 1', async ({ page }) => {
        const progress = page.getByTestId('progress')

        await page.getByTestId('ripple').click()

        await expect.poll(async () => progress.textContent()).toBe('1.00')
    })
})
