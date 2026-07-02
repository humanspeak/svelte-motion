import { expect, test } from '@playwright/test'
import { waitForViewAnimation } from '../_helpers/view'

test.describe('view/filter-gallery', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/view/filter-gallery?@isPlaywright=true')
        await page.getByTestId('grid').waitFor({ state: 'visible' })
    })

    test('filters with enter/exit view animations and settles on the right set', async ({
        page
    }) => {
        await expect(page.getByTestId('count')).toHaveText('12')

        await page.getByTestId('filter-circle').click()
        await waitForViewAnimation(page)
        await expect(page.getByTestId('count')).toHaveText('6')

        await page.getByTestId('filter-square').click()
        await expect(page.getByTestId('count')).toHaveText('6')

        await page.getByTestId('filter-all').click()
        await expect(page.getByTestId('count')).toHaveText('12')
        // All 12 items back in the DOM after the final transition.
        await expect(page.locator('[data-item]')).toHaveCount(12)
    })
})
