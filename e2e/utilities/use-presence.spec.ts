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

    test('swap: wait mode holds each incoming PresenceChild until safeToRemove fires', async ({
        page
    }) => {
        await page.goto('/tests/use-presence')

        await expect(page.getByTestId('wait-a')).toBeVisible()
        await expect(page.getByTestId('wait-b')).toHaveCount(0)

        await page.getByTestId('toggle-wait').click()

        // A exits alone. B must not enter until A calls safeToRemove.
        await expect(page.getByTestId('wait-a')).toHaveAttribute('data-is-present', 'false')
        await expect(page.getByTestId('wait-b')).toHaveCount(0)

        // Eventually A's transitionend fires, triggering safeToRemove and B's enter.
        await expect(page.getByTestId('wait-a')).toHaveCount(0, { timeout: 5000 })
        await expect(page.getByTestId('wait-b')).toHaveAttribute('data-is-present', 'true')

        await page.getByTestId('toggle-wait').click()

        // The reverse direction should behave the same way. This catches the
        // sibling update-order case where A can observe present=true before B
        // has announced its exit.
        await expect(page.getByTestId('wait-b')).toHaveAttribute('data-is-present', 'false')
        await expect(page.getByTestId('wait-a')).toHaveCount(0)

        await expect(page.getByTestId('wait-b')).toHaveCount(0, { timeout: 5000 })
        await expect(page.getByTestId('wait-a')).toHaveAttribute('data-is-present', 'true')
    })
})
