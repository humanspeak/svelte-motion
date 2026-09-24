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

    test('move and ripple can be reversed and replayed', async ({ page }) => {
        const move = page.getByTestId('move')
        const ripple = page.getByTestId('ripple')
        const rotateY = page.getByTestId('rotate-y')
        const progress = page.getByTestId('progress')

        await move.click()
        await ripple.click()
        await expect(move).toHaveText('Move back')
        await expect(ripple).toHaveText('Undo ripple')
        await expect.poll(async () => progress.textContent()).toBe('1.00')

        await move.click()
        await ripple.click()
        await expect.poll(async () => Number(await rotateY.textContent())).toBeCloseTo(0, 1)
        await expect.poll(async () => progress.textContent()).toBe('0.00')
        await expect(move).toHaveText('Move')
        await expect(ripple).toHaveText('Ripple')

        await move.click()
        await ripple.click()
        await expect.poll(async () => Number(await rotateY.textContent())).toBeCloseTo(6.28, 1)
        await expect.poll(async () => progress.textContent()).toBe('1.00')
    })

    test('reset cancels both running animations and allows another run', async ({ page }) => {
        const rotateY = page.getByTestId('rotate-y')
        const progress = page.getByTestId('progress')

        await page.getByTestId('move').click()
        await page.getByTestId('ripple').click()
        await expect.poll(async () => Number(await progress.textContent())).toBeGreaterThan(0)
        await page.getByTestId('reset').click()

        await expect(rotateY).toHaveText('0.00')
        await expect(progress).toHaveText('0.00')
        await expect(page.getByTestId('move')).toHaveText('Move')
        await expect(page.getByTestId('ripple')).toHaveText('Ripple')
        // The old spring and tween must not resume and overwrite the reset.
        await page.waitForTimeout(1200)
        await expect(rotateY).toHaveText('0.00')
        await expect(progress).toHaveText('0.00')

        await page.getByTestId('move').click()
        await page.getByTestId('ripple').click()
        await expect.poll(async () => Number(await rotateY.textContent())).toBeCloseTo(6.28, 1)
        await expect.poll(async () => progress.textContent()).toBe('1.00')
    })
})
