import { expect, test } from '@playwright/test'

test.describe('variants/stagger-interrupt', () => {
    test('stop interrupts delayed stagger without late upward pops', async ({ page }) => {
        await page.goto('/tests/variants/stagger-interrupt?@isPlaywright=true')
        await page.waitForLoadState('networkidle')

        const cells = page.getByTestId('variant-cell')
        await expect(cells).toHaveCount(12)

        await page.getByTestId('play').click()
        await page.waitForTimeout(180)
        await page.getByTestId('stop').click()

        const samples: number[][] = []
        for (let sample = 0; sample < 10; sample += 1) {
            await page.waitForTimeout(120)
            const yValues = await cells.evaluateAll((elements) =>
                elements.map((element) => {
                    const transform = getComputedStyle(element).transform
                    if (!transform || transform === 'none') return 0
                    const matrix = transform.match(/matrix\(([^)]+)\)/)
                    if (!matrix) return 0
                    const values = matrix[1]
                        .split(',')
                        .map((value) => Number.parseFloat(value.trim()))
                    return values[5] || 0
                })
            )
            samples.push(yValues)
        }

        for (const yValues of samples) {
            for (const y of yValues) {
                expect(y).toBeGreaterThanOrEqual(-8)
            }
        }

        const finalValues = samples.at(-1) ?? []
        expect(finalValues.every((y) => Math.abs(y) < 1)).toBe(true)
    })
})
