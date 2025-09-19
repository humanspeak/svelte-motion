import { expect, test } from '@playwright/test'

test.describe('Keyframes Animation', () => {
    test('should morph square -> circle -> square', async ({ page }) => {
        await page.goto('/tests/motion/keyframes?@humanspeak-svelte-motion-isPlaywright=true')

        const el = page.getByTestId('motion-keyframes')
        await expect(el).toBeVisible()

        // Wait for motion container to be ready (Playwright hint attribute)
        await expect(el).toHaveAttribute('data-is-loaded', 'ready')

        const readBorderRadius = async (): Promise<string> =>
            await el.evaluate((n) => getComputedStyle(n).borderRadius)

        const classify = (value: string): 'square' | 'circle' | 'other' => {
            const num = parseFloat(value)
            if (value.endsWith('%')) {
                if (num >= 45 && num <= 55) return 'circle'
                if (num === 0) return 'square'
            }
            if (value.endsWith('px')) {
                if (num === 0 || num <= 6) return 'square' // inline style is 5px
            }
            return 'other'
        }

        // Wait for a square state
        await expect.poll(async () => classify(await readBorderRadius())).toBe('square')

        // Then wait for a circle state
        await expect.poll(async () => classify(await readBorderRadius())).toBe('circle')

        // And finally back to square
        await expect.poll(async () => classify(await readBorderRadius())).toBe('square')
    })
})
