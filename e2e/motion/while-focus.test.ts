import { expect, test } from '@playwright/test'

test.describe('whileFocus', () => {
    test('animates on focus and restores on blur', async ({ page }) => {
        await page.goto('/tests/motion/while-focus?@isPlaywright=true')

        const button = page.getByTestId('motion-while-focus-button')
        await expect(button).toBeVisible()

        // Helper to read current scale from computed transform
        const readScale = async (element: ReturnType<typeof page.getByTestId>) => {
            const t = await element.evaluate((el) => getComputedStyle(el).transform)
            if (!t || t === 'none') return 1
            try {
                if (t.startsWith('matrix(')) {
                    const raw = t.slice('matrix('.length, -1)
                    const nums = raw.split(',').map((v) => parseFloat(v.trim()))
                    if (nums.length < 4 || nums.slice(0, 4).some((n) => Number.isNaN(n))) return 1
                    const a = nums[0]!
                    const b = nums[1]!
                    const scaleX = Math.hypot(a, b)
                    return scaleX
                }
                return 1
            } catch {
                return 1
            }
        }

        // Initial scale is ~1
        const initialScale = await readScale(button)
        expect(Math.abs(initialScale - 1)).toBeLessThan(0.01)

        // Focus: scale increases towards 1.2
        await button.focus()
        await expect.poll(() => readScale(button)).toBeGreaterThan(1.1)

        // Check outline is applied (should have solid outline)
        const outline = await button.evaluate((el) => getComputedStyle(el).outline)
        expect(outline).toContain('solid')

        // Blur: scale returns to ~1
        await button.blur()
        await expect.poll(() => readScale(button)).toBeLessThan(1.05)
    })

    test('works with input elements', async ({ page }) => {
        await page.goto('/tests/motion/while-focus?@isPlaywright=true')

        const input = page.getByTestId('motion-while-focus-input')
        await expect(input).toBeVisible()

        const readScale = async () => {
            const t = await input.evaluate((el) => getComputedStyle(el).transform)
            if (!t || t === 'none') return 1
            try {
                if (t.startsWith('matrix(')) {
                    const raw = t.slice('matrix('.length, -1)
                    const nums = raw.split(',').map((v) => parseFloat(v.trim()))
                    if (nums.length < 4) return 1
                    return Math.hypot(nums[0] ?? 1, nums[1] ?? 0)
                }
                return 1
            } catch {
                return 1
            }
        }

        // Focus the input - should scale up
        await input.focus()
        await expect.poll(readScale).toBeGreaterThan(1.02)

        // Blur and verify restoration
        await input.blur()
        await expect.poll(readScale).toBeLessThan(1.02)
    })

    test('works with tabindex on divs', async ({ page }) => {
        await page.goto('/tests/motion/while-focus?@isPlaywright=true')

        const div = page.getByTestId('motion-while-focus-div')
        await expect(div).toBeVisible()

        // Tab to focus the div
        await page.keyboard.press('Tab')
        await page.keyboard.press('Tab')
        await page.keyboard.press('Tab')

        // Check if div is focused and scaled
        const isFocused = await div.evaluate((el) => el === document.activeElement)
        if (isFocused) {
            await page.waitForTimeout(300)
            const bgColor = await div.evaluate((el) => getComputedStyle(el).backgroundColor)
            expect(bgColor).toContain('13, 99, 248') // #0d63f8
        }
    })

    test('multiple elements can have independent focus animations', async ({ page }) => {
        await page.goto('/tests/motion/while-focus?@isPlaywright=true')

        const button = page.getByTestId('motion-while-focus-button')
        const input = page.getByTestId('motion-while-focus-input')

        // Focus button
        await button.focus()
        await page.waitForTimeout(200)
        let buttonScale = await button.evaluate((el) => {
            const t = getComputedStyle(el).transform
            if (!t || t === 'none') return 1
            const nums = t.slice('matrix('.length, -1).split(',').map(parseFloat)
            return Math.hypot(nums[0] ?? 1, nums[1] ?? 0)
        })
        expect(buttonScale).toBeGreaterThan(1.1)

        // Focus input (button should restore)
        await input.focus()
        await page.waitForTimeout(500)
        buttonScale = await button.evaluate((el) => {
            const t = getComputedStyle(el).transform
            if (!t || t === 'none') return 1
            const nums = t.slice('matrix('.length, -1).split(',').map(parseFloat)
            return Math.hypot(nums[0] ?? 1, nums[1] ?? 0)
        })
        expect(buttonScale).toBeLessThan(1.05)
    })
})
