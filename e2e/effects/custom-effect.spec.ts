import { expect, test } from '@playwright/test'

test.describe('effects/custom-effect', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/effects/custom-effect?@isPlaywright=true')
        await page.getByTestId('dial-canvas').waitFor({ state: 'visible' })
    })

    test('animate() drives an effect-claimed object', async ({ page }) => {
        const angle = page.getByTestId('angle')

        await page.getByTestId('open').click()

        await expect.poll(async () => Number(await angle.textContent())).toBeGreaterThan(200)
        await expect
            .poll(async () => Number(await angle.textContent()), { timeout: 3000 })
            .toBe(270)
    })

    test('reset animates back', async ({ page }) => {
        const angle = page.getByTestId('angle')

        await page.getByTestId('open').click()
        await expect.poll(async () => Number(await angle.textContent())).toBeGreaterThan(200)

        await page.getByTestId('reset').click()
        await expect.poll(async () => Number(await angle.textContent())).toBe(0)
    })

    test('objects no effect claims still animate', async ({ page }) => {
        const plainX = page.getByTestId('plain-x')

        await page.getByTestId('plain-open').click()

        await expect.poll(async () => Number(await plainX.textContent())).toBe(100)
    })
})
