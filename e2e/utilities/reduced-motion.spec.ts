import { expect, test } from '@playwright/test'

test.describe('useReducedMotion (no OS preference)', () => {
    test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'no-preference' })
    })

    test('reflects no-preference and animates by default', async ({ page }) => {
        await page.goto('/tests/reduced-motion')

        const box = page.getByTestId('reduced-motion-box')
        const osPref = page.getByTestId('os-preference')

        await expect(box).toBeVisible()
        await expect(osPref).toHaveText('no-preference')
        await expect(box).toHaveAttribute('data-os-reduced-motion', 'false')
        await expect(box).toHaveAttribute('data-reduced-motion', 'false')
        await expect(box).toHaveClass(/spin/)
    })

    test('in-page force toggle disables animation without changing OS preference', async ({
        page
    }) => {
        await page.goto('/tests/reduced-motion')

        const box = page.getByTestId('reduced-motion-box')
        const osPref = page.getByTestId('os-preference')
        const toggle = page.getByTestId('force-reduced-toggle')

        await expect(box).toHaveClass(/spin/)

        await toggle.check()

        await expect(box).toHaveAttribute('data-reduced-motion', 'true')
        await expect(box).not.toHaveClass(/spin/)
        // OS preference unchanged
        await expect(osPref).toHaveText('no-preference')
        await expect(box).toHaveAttribute('data-os-reduced-motion', 'false')

        await toggle.uncheck()

        await expect(box).toHaveAttribute('data-reduced-motion', 'false')
        await expect(box).toHaveClass(/spin/)
    })
})

test.describe('useReducedMotion (OS prefers reduce)', () => {
    test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
    })

    test('detects prefers-reduced-motion and stops animation', async ({ page }) => {
        await page.goto('/tests/reduced-motion')

        const box = page.getByTestId('reduced-motion-box')
        const osPref = page.getByTestId('os-preference')

        await expect(osPref).toHaveText('reduce')
        await expect(box).toHaveAttribute('data-os-reduced-motion', 'true')
        await expect(box).toHaveAttribute('data-reduced-motion', 'true')
        await expect(box).not.toHaveClass(/spin/)
    })

    test('store updates when the media query changes at runtime', async ({ page }) => {
        await page.goto('/tests/reduced-motion')

        const box = page.getByTestId('reduced-motion-box')
        const osPref = page.getByTestId('os-preference')

        await expect(osPref).toHaveText('reduce')
        await expect(box).toHaveAttribute('data-os-reduced-motion', 'true')

        // Flip the OS preference at runtime; the store should react.
        await page.emulateMedia({ reducedMotion: 'no-preference' })

        await expect(osPref).toHaveText('no-preference')
        await expect(box).toHaveAttribute('data-os-reduced-motion', 'false')
        await expect(box).toHaveClass(/spin/)

        // And back the other way.
        await page.emulateMedia({ reducedMotion: 'reduce' })

        await expect(osPref).toHaveText('reduce')
        await expect(box).toHaveAttribute('data-os-reduced-motion', 'true')
        await expect(box).not.toHaveClass(/spin/)
    })
})
