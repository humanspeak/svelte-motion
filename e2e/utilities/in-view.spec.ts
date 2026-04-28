import { expect, test } from '@playwright/test'

test.describe('useInView', () => {
    test('top box reports in-view on load; bottom + once boxes start out-of-view', async ({
        page
    }) => {
        await page.goto('/tests/inView')

        await expect(page.getByTestId('top-box')).toHaveAttribute('data-in-view', 'true')
        await expect(page.getByTestId('bottom-box')).toHaveAttribute('data-in-view', 'false')
        await expect(page.getByTestId('once-box')).toHaveAttribute('data-in-view', 'false')
    })

    test('bottom box toggles to true when scrolled into view and back to false on exit', async ({
        page
    }) => {
        await page.goto('/tests/inView')

        const bottom = page.getByTestId('bottom-box')
        await bottom.scrollIntoViewIfNeeded()
        await expect(bottom).toHaveAttribute('data-in-view', 'true')

        await page.evaluate(() => window.scrollTo(0, 0))
        await expect(bottom).toHaveAttribute('data-in-view', 'false')
    })

    test('once box latches to true on first entry and stays true after exit', async ({ page }) => {
        await page.goto('/tests/inView')

        const once = page.getByTestId('once-box')
        await once.scrollIntoViewIfNeeded()
        await expect(once).toHaveAttribute('data-in-view', 'true')

        await page.evaluate(() => window.scrollTo(0, 0))
        await expect(once).toHaveAttribute('data-in-view', 'true')
    })
})
