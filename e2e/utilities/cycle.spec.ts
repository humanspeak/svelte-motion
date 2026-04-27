import { expect, test } from '@playwright/test'

test.describe('useCycle', () => {
    test('starts at the first item and advances on cycle()', async ({ page }) => {
        await page.goto('/tests/cycle')

        const box = page.getByTestId('cycle-variant-box')
        const next = page.getByTestId('cycle-next')

        await expect(box).toHaveAttribute('data-variant', 'rest')

        await next.click()
        await expect(box).toHaveAttribute('data-variant', 'nudge')

        await next.click()
        await expect(box).toHaveAttribute('data-variant', 'flip')

        await next.click()
        await expect(box).toHaveAttribute('data-variant', 'spin')
    })

    test('wraps back to the first item after the last', async ({ page }) => {
        await page.goto('/tests/cycle')

        const box = page.getByTestId('cycle-variant-box')
        const next = page.getByTestId('cycle-next')

        for (let i = 0; i < 4; i++) await next.click()

        await expect(box).toHaveAttribute('data-variant', 'rest')
    })

    test('cycle(i) jumps to a specific index', async ({ page }) => {
        await page.goto('/tests/cycle')

        const box = page.getByTestId('cycle-variant-box')

        await page.getByTestId('jump-flip').click()
        await expect(box).toHaveAttribute('data-variant', 'flip')

        await page.getByTestId('jump-rest').click()
        await expect(box).toHaveAttribute('data-variant', 'rest')

        await page.getByTestId('jump-spin').click()
        await expect(box).toHaveAttribute('data-variant', 'spin')
    })

    test('numeric cycle reflects current value and advances relative to last jump', async ({
        page
    }) => {
        await page.goto('/tests/cycle')

        const box = page.getByTestId('cycle-x-box')
        const valueLabel = page.getByTestId('cycle-x-value')

        await expect(box).toHaveAttribute('data-x', '0')
        await expect(valueLabel).toHaveText('0')

        await page.getByTestId('cycle-x-jump-2').click()
        await expect(valueLabel).toHaveText('100')

        await page.getByTestId('cycle-x-next').click()
        await expect(valueLabel).toHaveText('150')

        await page.getByTestId('cycle-x-next').click()
        await expect(valueLabel).toHaveText('0')
    })
})
