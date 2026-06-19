import { expect, test } from '@playwright/test'

test.describe('variants/stagger-interrupt', () => {
    test('stop interrupts delayed stagger without late upward pops', async ({ page }) => {
        await page.goto('/tests/variants/stagger-interrupt?@isPlaywright=true')
        await page.waitForLoadState('networkidle')

        const cells = page.getByTestId('variant-cell')
        await expect(cells).toHaveCount(12)
        const readYValues = () =>
            cells.evaluateAll((elements) =>
                elements.map((element) => {
                    const transform = getComputedStyle(element).transform
                    if (!transform || transform === 'none') return 0
                    const matrix = transform.match(/matrix\(([^)]+)\)/)
                    const matrix3d = transform.match(/matrix3d\(([^)]+)\)/)
                    const rawValues = matrix3d?.[1] ?? matrix?.[1]
                    if (!rawValues) return 0
                    const values = rawValues
                        .split(',')
                        .map((value) => Number.parseFloat(value.trim()))
                    return matrix3d ? values[13] || 0 : values[5] || 0
                })
            )

        await page.getByTestId('play').click()
        // Let the forward stagger begin, but stop before all delayed children
        // have started their play animation.
        await page.waitForTimeout(180)
        const yAtStop = await readYValues()
        await page.getByTestId('stop').click()

        const samples: number[][] = []
        for (let sample = 0; sample < 10; sample += 1) {
            // Sample far enough apart to catch delayed children that would pop
            // upward after stop, while still watching the spring settle.
            await page.waitForTimeout(120)
            samples.push(await readYValues())
        }

        for (const yValues of samples) {
            for (const [index, y] of yValues.entries()) {
                // Allow harmless spring wobble, but fail if a cell starts a
                // fresh upward play motion after the stop command.
                expect(y - yAtStop[index]).toBeGreaterThanOrEqual(-16)
            }
        }

        const finalValues = samples.at(-1) ?? []
        expect(finalValues.every((y) => Math.abs(y) < 1)).toBe(true)
    })
})
