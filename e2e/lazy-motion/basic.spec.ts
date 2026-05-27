import { expect, test } from '@playwright/test'

test.describe('LazyMotion', () => {
    test('renders m namespace components with domAnimation', async ({ page }) => {
        await page.goto('/tests/lazy-motion/basic?@isPlaywright=true')

        const box = page.getByTestId('lazy-motion-basic-box')
        await expect(box).toBeVisible()
        await expect.poll(() => box.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
    })

    test('gates gesture affordances by feature bundle', async ({ page }) => {
        await page.goto('/tests/lazy-motion/feature-bundles?@isPlaywright=true')

        await expect(page.getByTestId('lazy-motion-domMin')).not.toHaveAttribute('tabindex', '0')
        await expect(page.getByTestId('lazy-motion-domAnimation')).toHaveAttribute('tabindex', '0')
        await expect(page.getByTestId('lazy-motion-domMax')).toHaveAttribute('tabindex', '0')
    })

    test('loads async feature bundles for m namespace components', async ({ page }) => {
        await page.goto('/tests/lazy-motion/async?@isPlaywright=true')

        const box = page.getByTestId('lazy-motion-async-box')
        await expect(box).toBeVisible()
        await expect.poll(() => box.getAttribute('tabindex')).toBe('0')
    })
})
