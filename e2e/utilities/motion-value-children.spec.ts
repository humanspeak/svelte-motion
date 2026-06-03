import { expect, test } from '@playwright/test'

const URL = '/tests/motion-value-children?@isPlaywright=true'

test.describe('MotionValue children', () => {
    test('server-renders the initial motion value child text', async ({ request }) => {
        const response = await request.get(URL)
        const html = await response.text()

        expect(response.ok()).toBe(true)
        expect(html).toContain('1,200')
        expect(html).toContain('18%')
        expect(html).toContain('WARMING')
    })

    test('renders the initial motion value child text and updates on change', async ({ page }) => {
        await page.goto(URL)

        await expect(page.getByTestId('motion-value-score')).toHaveText('1,200')
        await expect(page.getByTestId('motion-value-charge')).toHaveText('18%')
        await expect(page.getByTestId('motion-value-status')).toHaveText('WARMING')

        await page.getByTestId('motion-value-play').click()

        await expect
            .poll(async () => {
                const text = await page.getByTestId('motion-value-score').innerText()
                return Number(text.replace(/,/g, ''))
            })
            .toBeGreaterThan(7000)
        await expect(page.getByTestId('motion-value-status')).toHaveText('SYNCED')
        await expect(page.getByTestId('motion-value-charge')).toHaveText('100%')

        await page.getByTestId('motion-value-reset').click()
        await expect(page.getByTestId('motion-value-score')).toHaveText('1,200')
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(page.getByRole('link', { name: 'MotionValue children' })).toHaveAttribute(
            'href',
            /\/tests\/motion-value-children/
        )
    })
})
