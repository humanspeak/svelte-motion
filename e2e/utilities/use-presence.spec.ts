import { expect, test } from '@playwright/test'

test.describe('usePresence', () => {
    test('basic toggle: card stays mounted during exit transition then unmounts', async ({
        page
    }) => {
        await page.goto('/tests/use-presence')

        const card = page.getByTestId('card')
        await expect(card).toBeVisible()
        await expect(card).toHaveAttribute('data-is-present', 'true')

        // Mark the element so we can detect remount.
        await card.evaluate((el) => (el.dataset.marker = 'pre-hide'))

        await page.getByTestId('toggle-basic').click()

        // While exiting, the same element is still in the DOM (no remount —
        // confirms the effect.pre fix), and its data-is-present has flipped.
        await expect(card).toHaveAttribute('data-is-present', 'false')
        await expect(card).toHaveAttribute('data-marker', 'pre-hide')

        // After the 300ms CSS transition + safeToRemove, the card is gone and
        // AnimatePresence's onExitComplete has fired exactly once.
        await expect(card).toHaveCount(0, { timeout: 2000 })
        await expect(page.getByTestId('exits-completed')).toHaveText('exitsCompleted: 1')
    })

    test('clicking Show after Hide brings the card back', async ({ page }) => {
        await page.goto('/tests/use-presence')

        await page.getByTestId('toggle-basic').click()
        await expect(page.getByTestId('card')).toHaveCount(0, { timeout: 2000 })

        await page.getByTestId('toggle-basic').click()
        await expect(page.getByTestId('card')).toBeVisible()
        await expect(page.getByTestId('card')).toHaveAttribute('data-is-present', 'true')
    })

    test('swap: outgoing PresenceChild holds until its safeToRemove fires', async ({ page }) => {
        await page.goto('/tests/use-presence')

        await expect(page.getByTestId('wait-a')).toBeVisible()
        await expect(page.getByTestId('wait-b')).toHaveCount(0)

        await page.getByTestId('toggle-wait').click()

        // A is held (still in DOM, marked exiting) while its CSS transition runs.
        await expect(page.getByTestId('wait-a')).toHaveAttribute('data-is-present', 'false')
        // B has entered the render path now that its present flipped true.
        await expect(page.getByTestId('wait-b')).toBeVisible()

        // Eventually A's transitionend fires, triggering safeToRemove → unmount.
        await expect(page.getByTestId('wait-a')).toHaveCount(0, { timeout: 2000 })
        await expect(page.getByTestId('wait-b')).toHaveAttribute('data-is-present', 'true')
    })
})
