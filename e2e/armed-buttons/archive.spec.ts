import { expect, test } from '@playwright/test'

test.describe('Armed buttons - archive confirm', () => {
    test('arms, confirms, and records archived state', async ({ page }) => {
        await page.goto('/tests/armed-buttons/archive?@isPlaywright=true')

        const row = page.getByTestId('archive-test-row')
        const arm = page.getByTestId('archive-test-arm')

        await expect(row).toBeVisible()
        await expect(row).toHaveAttribute('data-armed', 'false')
        await expect(row).toHaveAttribute('data-archived', 'false')

        await arm.click()

        const confirm = page.getByTestId('archive-test-confirm')
        await expect(confirm).toBeVisible()
        await expect(row).toHaveAttribute('data-armed', 'true')

        await confirm.click({ force: true })

        await expect(row).toHaveAttribute('data-archived', 'true')
        await expect(row).toHaveAttribute('data-armed', 'false')
        await expect(confirm).toBeHidden()
    })

    test('auto-disarms an abandoned archive action', async ({ page }) => {
        await page.goto('/tests/armed-buttons/archive?@isPlaywright=true')

        const row = page.getByTestId('archive-test-row')
        await page.getByTestId('archive-test-arm').click()

        await expect(row).toHaveAttribute('data-armed', 'true')
        await expect(page.getByTestId('archive-test-confirm')).toBeVisible()

        await expect(row).toHaveAttribute('data-armed', 'false', { timeout: 2500 })
        await expect(page.getByTestId('archive-test-confirm')).toBeHidden()
    })
})
