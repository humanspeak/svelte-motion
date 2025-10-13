import { expect, test } from '@playwright/test'

test.describe('Animated Border Gradient', () => {
    test('rotates conic-gradient background over time', async ({ page }) => {
        await page.goto('/tests/random/animated-border-gradient?@isPlaywright=true')

        const border = page.locator('[data-rotate-value]')
        await expect(border).toBeVisible()

        // Read initial rotate value from data attribute (strict)
        const rotateAttr = await border.getAttribute('data-rotate-value')
        if (rotateAttr == null) throw new Error('Missing data-rotate-value attribute on element')
        const start = Number.parseFloat(rotateAttr)
        if (Number.isNaN(start)) throw new Error(`Non-numeric data-rotate-value: ${rotateAttr}`)

        // Helper to parse current deg from inline style
        const readDeg = async () => {
            const style = (await border.getAttribute('style')) || ''
            const match = style.match(/\bfrom\s+([-+]?\d*\.?\d+)deg\b/i)
            return match ? Number.parseFloat(match[1]!) : NaN
        }

        const startDeg = await readDeg()
        expect(Number.isNaN(startDeg)).toBe(false)

        // Within a short time, rotation should increase noticeably
        await expect
            .poll(
                async () => {
                    const currentAttr = await border.getAttribute('data-rotate-value')
                    if (currentAttr == null) throw new Error('data-rotate-value disappeared')
                    const current = Number.parseFloat(currentAttr)
                    if (Number.isNaN(current))
                        throw new Error(`Non-numeric data-rotate-value: ${currentAttr}`)
                    return current - start
                },
                { timeout: 3000 }
            )
            .toBeGreaterThan(5)

        await expect
            .poll(
                async () => {
                    const currentDeg = await readDeg()
                    return currentDeg - (startDeg as number)
                },
                { timeout: 3000 }
            )
            .toBeGreaterThan(5)
    })
})
