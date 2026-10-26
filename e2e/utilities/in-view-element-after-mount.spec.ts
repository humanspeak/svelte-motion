import { expect, test } from '@playwright/test'

/**
 * Port of Motion 14.6.0 `tests/react/issue-2579.spec.ts` (#2579): useInView
 * observes an element rendered after mount and returns false once it is
 * removed.
 */
test.describe('useInView: element rendered after mount (#2579)', () => {
    const url = '/tests/inView/element-after-mount?@isPlaywright=true'

    test('observes an element rendered after mount', async ({ page }) => {
        await page.goto(url)
        await expect(page.getByTestId('in-view')).toHaveText('false')

        await page.getByTestId('show').click()
        await expect(page.getByTestId('box')).toBeVisible()

        await expect(page.getByTestId('in-view')).toHaveText('true', { timeout: 2000 })
    })

    test('returns false once the observed element is removed', async ({ page }) => {
        await page.goto(url)
        await page.getByTestId('show').click()
        await expect(page.getByTestId('in-view')).toHaveText('true', { timeout: 2000 })

        await page.getByTestId('hide').click()
        await expect(page.getByTestId('box')).toHaveCount(0)
        await expect(page.getByTestId('in-view')).toHaveText('false', { timeout: 2000 })
    })
})
