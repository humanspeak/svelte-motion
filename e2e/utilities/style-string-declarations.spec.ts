import { expect, test } from '@playwright/test'

const URL = '/tests/style-string-declarations?@isPlaywright=true'

test.describe('String style declarations', () => {
    test('keeps the earlier member of a fallback pair', async ({ page }) => {
        await page.goto(URL)
        const box = page.getByTestId('fallback')
        await expect(box).toHaveAttribute('data-is-loaded', 'ready')
        await expect.poll(() => box.evaluate((el) => getComputedStyle(el).height)).toBe('50px')
    })

    test('keeps a data URI containing `;`', async ({ page }) => {
        await page.goto(URL)
        const box = page.getByTestId('data-uri')
        await expect(box).toHaveAttribute('data-is-loaded', 'ready')
        await expect
            .poll(() => box.evaluate((el) => getComputedStyle(el).backgroundImage))
            .toContain('base64,iVBOR')
        expect(await box.getAttribute('style')).toContain('opacity')
    })
})
