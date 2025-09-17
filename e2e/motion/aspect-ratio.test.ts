import { expect, test } from '@playwright/test'

test.describe('motion/aspect-ratio', () => {
    test('box resizes by width and respects aspect-ratio', async ({ page }) => {
        await page.goto('/tests/motion/aspect-ratio')

        const box = page.getByTestId('aspect-box')
        await expect(box).toBeVisible()

        // Initial square with width ~100
        const initial = await box.boundingBox()
        expect(initial).not.toBeNull()
        if (!initial) return

        expect(initial.width).toBeGreaterThan(95)
        expect(initial.width).toBeLessThan(105)
        expect(Math.abs(initial.width - initial.height)).toBeLessThan(2)

        // Increase width to 200 via the Width number input
        const widthNumber = page
            .locator('label', { hasText: 'Width' })
            .locator("input[type='number']")
        await widthNumber.fill('200')
        await widthNumber.dispatchEvent('input')

        // Debounce is 200ms; wait a bit more
        await page.waitForTimeout(350)

        const w200 = await box.boundingBox()
        expect(w200).not.toBeNull()
        if (!w200) return
        expect(w200.width).toBeGreaterThan(185)
        expect(w200.width).toBeLessThan(215)

        // Set aspect ratio to 2 (width:height = 2:1)
        const arNumber = page
            .locator('label', { hasText: 'Aspect ratio' })
            .locator("input[type='number']")
        await arNumber.fill('2')
        await arNumber.dispatchEvent('input')

        await page.waitForTimeout(350)

        const ar2 = await box.boundingBox()
        expect(ar2).not.toBeNull()
        if (!ar2) return

        // Height should be about half the width
        const expectedHeight = ar2.width / 2
        expect(Math.abs(ar2.height - expectedHeight)).toBeLessThan(6)
    })
})
