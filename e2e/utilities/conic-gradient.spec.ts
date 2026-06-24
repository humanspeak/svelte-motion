import { expect, test } from '@playwright/test'

/**
 * Regression coverage for issue #418: the compute form of `useTransform` must
 * recompute when the motion values it reads via `.get()` change. The original
 * example mis-ported the upstream motion.dev demo (Svelte `writable` + `$store`
 * reads, which `collectMotionValues` can't see), so the derived `background`
 * froze at its mount-time `at 50% 50%` value. The fix uses `useMotionValue` +
 * `.get()` (auto-tracked), matching upstream framer-motion.
 *
 * Assertions read `data-bg` (the raw computed string from the motion value)
 * rather than the serialized inline `style`: the browser normalizes the
 * default `at 50% 50%` position out of `style`, which would mask the freeze.
 */
const pivot = (bg: string | null): string => {
    const match = bg?.match(/at\s+([\d.]+)%\s+([\d.]+)%/)
    return match ? `${match[1]} ${match[2]}` : ''
}

test.describe('useTransform compute form (conic gradient)', () => {
    test('background starts centered at 50% 50%', async ({ page }) => {
        await page.goto('/tests/conic-gradient')

        const box = page.getByTestId('gradient-box')
        await expect(box).toBeVisible()
        // Auto-retrying assertion — avoids reading data-bg before the first
        // compute frame commits.
        await expect(box).toHaveAttribute('data-bg', /conic-gradient\(at\s+50%\s+50%/)
    })

    test('moving the gradientX/Y motion values updates the pivot', async ({ page }) => {
        await page.goto('/tests/conic-gradient')

        const box = page.getByTestId('gradient-box')
        await expect(box).toHaveAttribute('data-bg', /at\s+50%\s+50%/)

        // Drive the motion values via the sliders (deterministic), then assert
        // the recomputed pivot — proving the compute form auto-tracks them.
        await page.getByTestId('x-slider').fill('0.25')
        await expect(box).toHaveAttribute('data-bg', /at\s+25%\s+50%/)

        await page.getByTestId('y-slider').fill('0.75')
        await expect(box).toHaveAttribute('data-bg', /at\s+25%\s+75%/)
    })

    test('pivot changes between two distinct pointer positions over the swatch', async ({
        page
    }) => {
        await page.goto('/tests/conic-gradient')

        const swatch = page.getByTestId('swatch')
        const box = page.getByTestId('gradient-box')
        const rect = await swatch.boundingBox()
        if (!rect) throw new Error('swatch not found')

        await page.mouse.move(rect.x + rect.width * 0.2, rect.y + rect.height * 0.2)
        await expect(box).toHaveAttribute('data-bg', /at\s+20%\s+20%/)
        const bgA = await box.getAttribute('data-bg')

        await page.mouse.move(rect.x + rect.width * 0.8, rect.y + rect.height * 0.8)
        await expect(box).toHaveAttribute('data-bg', /at\s+80%\s+80%/)
        const bgB = await box.getAttribute('data-bg')

        expect(pivot(bgA)).not.toBe(pivot(bgB))
    })
})
