import { expect, test } from '@playwright/test'

test.describe('Keyframes Scale', () => {
    test('should grow (scale 2x) and return to normal size', async ({ page }) => {
        await page.goto('/tests/motion/keyframes?@isPlaywright=true')

        const el = page.getByTestId('motion-keyframes')
        await expect(el).toBeVisible()
        await expect(el).toHaveAttribute('data-is-loaded', 'ready')

        const readWidth = async (): Promise<number> => {
            const handle = await el.elementHandle()
            const box = handle ? await handle.boundingBox() : null
            return box?.width ?? 0
        }

        // Expect it to reach a large width (~200px when scale=2) then return near 100px
        // Use tolerant thresholds for cross-platform rendering
        const isLarge = (w: number) => w >= 180
        const isSmall = (w: number) => w <= 120

        // First observe a large (scaled) state
        await expect
            .poll(async () => (isLarge(await readWidth()) ? 'large' : 'other'))
            .toBe('large')

        // Then observe it returns to small (unscaled) state
        await expect
            .poll(async () => (isSmall(await readWidth()) ? 'small' : 'other'))
            .toBe('small')
    })
})
