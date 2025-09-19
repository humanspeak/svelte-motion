import { expect, test } from '@playwright/test'

test.describe('Hover + Tap', () => {
    test('hover scales up, tap scales down, then returns to hover scale on release', async ({
        page
    }) => {
        await page.goto('/tests/motion/hover-and-tap?@humanspeak-svelte-motion-isPlaywright=true')

        const box = page.getByTestId('motion-hover-and-tap')
        await expect(box).toBeVisible()

        // Initial scale is 1 (no transform)
        await expect(box).toHaveCSS('transform', 'none')

        // Helper to read current scale from computed transform
        const readScale = async () => {
            const t = await box.evaluate((el) => getComputedStyle(el).transform)
            if (!t || t === 'none') return 1
            // matrix(a, b, c, d, tx, ty) -> a is scaleX when no rotation/skew
            const match = t.match(
                /^matrix\(([-0-9. e]+),\s*[-0-9. e]+,\s*[-0-9. e]+,\s*([-0-9. e]+)/i
            )
            if (!match) return 1
            const a = parseFloat(match[1]!)
            const d = parseFloat(match[2]!)
            // Return average to be robust to minor rounding
            return (a + d) / 2
        }

        // Hover: scale increases towards 1.2
        await box.hover()
        await expect.poll(readScale).toBeGreaterThan(1.1)

        // Tap (pointerdown): scale to 0.8
        await box.dispatchEvent('pointerdown')
        await expect.poll(readScale).toBeLessThan(0.9)

        // Release (pointerup): should return to hover scale (≈1.2), not initial
        await box.dispatchEvent('pointerup')
        await expect.poll(readScale).toBeGreaterThan(1.05)
    })
})
