import { expect, test } from '@playwright/test'

test.describe('Armed buttons - delete wait', () => {
    test('arms, waits, then confirms deletion', async ({ page }) => {
        await page.goto('/tests/armed-buttons/delete-wait?@isPlaywright=true')

        const button = page.getByTestId('delete-test-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveAttribute('data-armed', 'false')
        await expect(button).toHaveAttribute('data-deleted', 'false')

        await button.click()

        await expect(button).toHaveAttribute('data-armed', 'true')
        await expect(button).toHaveAttribute('data-locked', 'true')
        await expect(page.getByTestId('delete-test-countdown')).toHaveText(/^[12]$/)

        await expect(page.getByTestId('delete-test-ready')).toBeVisible({ timeout: 3000 })
        await expect(button).toHaveAttribute('data-locked', 'false')

        await button.click()

        await expect(button).toHaveAttribute('data-deleted', 'true', { timeout: 1200 })
        await expect(button).toContainText('Workspace deleted')
    })

    test('auto-disarms an abandoned delete action after it becomes ready', async ({ page }) => {
        await page.goto('/tests/armed-buttons/delete-wait?@isPlaywright=true')

        const button = page.getByTestId('delete-test-button')
        await expect(button).toBeVisible()
        await expect(button).toHaveAttribute('data-armed', 'false')
        await expect(button).toHaveAttribute('data-deleted', 'false')

        await button.click()

        await expect(button).toHaveAttribute('data-armed', 'true')
        await expect(page.getByTestId('delete-test-ready')).toBeVisible({ timeout: 3000 })

        await expect(button).toHaveAttribute('data-armed', 'false', { timeout: 5000 })
        await expect(button).toHaveAttribute('data-deleted', 'false')
    })
})
