import { expect, test } from '@playwright/test'

test.describe('Animated Border Gradient', () => {
    test('rotates conic-gradient background over time', async ({ page }) => {
        await page.goto(
            '/tests/random/animated-border-gradient?@humanspeak-svelte-motion-isPlaywright=true'
        )

        const border = page.locator('[data-rotate-value]')
        await expect(border).toBeVisible()

        // Read initial rotate value from data attribute
        const start = Number(await border.getAttribute('data-rotate-value')) || 0

        // Helper to parse current deg from inline style
        const readDeg = async () => {
            const style = (await border.getAttribute('style')) || ''
            const match = style.match(/from\s+([0-9.]+)deg/i)
            return match ? parseFloat(match[1]!) : NaN
        }

        const startDeg = await readDeg()
        expect(Number.isNaN(startDeg)).toBe(false)

        // Within a short time, rotation should increase noticeably
        await expect
            .poll(async () => {
                const current = Number((await border.getAttribute('data-rotate-value')) || '0')
                return current - start
            })
            .toBeGreaterThan(5) // >5deg progressed

        await expect
            .poll(async () => {
                const currentDeg = await readDeg()
                return currentDeg - (startDeg as number)
            })
            .toBeGreaterThan(5)
    })
})
