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
        const widthNumber = page.getByTestId('width-input')
        await widthNumber.fill('200')
        await widthNumber.dispatchEvent('input')

        // Wait for layout width to update to 200px (debounced)
        await expect
            .poll(
                async () => await box.evaluate((el) => getComputedStyle(el as HTMLElement).width),
                { timeout: 2000 }
            )
            .toBe('200px')

        // Inverse transform should be applied inline immediately (non-empty style.transform)
        await expect
            .poll(
                async () => await box.evaluate((el) => (el as HTMLElement).style.transform || ''),
                { timeout: 1000 }
            )
            .not.toBe('')

        // Debounce is 200ms; animation duration ~250ms; wait for settle
        await page.waitForTimeout(450)

        // After animation completes, inline transform should be cleared ('' or 'none')
        await expect
            .poll(
                async () => await box.evaluate((el) => (el as HTMLElement).style.transform || ''),
                { timeout: 2000 }
            )
            .toMatch(/^$|^none$/)

        // Visual width should reach ~200px
        await expect
            .poll(async () => (await box.boundingBox())?.width ?? 0, { timeout: 2000 })
            .toBeGreaterThan(185)

        const w200 = await box.boundingBox()
        expect(w200).not.toBeNull()
        if (!w200) return
        expect(w200.width).toBeGreaterThan(185)
        expect(w200.width).toBeLessThan(215)

        // Set aspect ratio to 2 (width:height = 2:1)
        const arNumber = page.getByTestId('aspect-ratio-input')
        await arNumber.fill('2')
        await arNumber.dispatchEvent('input')

        // Wait for computed height to reflect aspect ratio change (height ~ width/2)
        await expect
            .poll(
                async () =>
                    await box.evaluate((el) =>
                        parseFloat(getComputedStyle(el as HTMLElement).height)
                    ),
                { timeout: 2000 }
            )
            .toBeGreaterThan(90)
        await expect
            .poll(
                async () =>
                    await box.evaluate((el) =>
                        parseFloat(getComputedStyle(el as HTMLElement).height)
                    ),
                { timeout: 2000 }
            )
            .toBeLessThan(110)

        // Inline inverse transform should be present during the animation
        await expect
            .poll(
                async () => await box.evaluate((el) => (el as HTMLElement).style.transform || ''),
                { timeout: 1000 }
            )
            .not.toBe('')

        // After animation completes, inline transform should be cleared ('' or 'none')
        await expect
            .poll(
                async () => await box.evaluate((el) => (el as HTMLElement).style.transform || ''),
                { timeout: 2000 }
            )
            .toMatch(/^$|^none$/)

        // After animation completes, visual height should reach expected ~width/2
        await expect
            .poll(async () => (await box.boundingBox())?.height ?? 0, { timeout: 2000 })
            .toBeGreaterThan(90)

        const ar2 = await box.boundingBox()
        expect(ar2).not.toBeNull()
        if (!ar2) return

        // Height should be about half the width
        const expectedHeight = ar2.width / 2
        expect(Math.abs(ar2.height - expectedHeight)).toBeLessThan(6)
    })
})
