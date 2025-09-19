import { expect, test } from '@playwright/test'

test.describe('Hover + Tap', () => {
    test('hover scales up, tap scales down, then returns to hover scale on release', async ({
        page
    }) => {
        await page.goto('/tests/motion/hover-and-tap?@humanspeak-svelte-motion-isPlaywright=true')

        const box = page.getByTestId('motion-hover-and-tap')
        await expect(box).toBeVisible()

        // Helper to read current scale from computed transform
        const readScale = async () => {
            const t = await box.evaluate((el) => getComputedStyle(el).transform)
            if (!t || t === 'none') return 1
            try {
                if (t.startsWith('matrix3d(')) {
                    const raw = t.slice('matrix3d('.length, -1)
                    const nums = raw.split(',').map((v) => parseFloat(v.trim()))
                    if (nums.length !== 16 || nums.some((n) => Number.isNaN(n))) return 1
                    const m11 = nums[0]!
                    const m12 = nums[1]!
                    const m13 = nums[2]!
                    const m21 = nums[4]!
                    const m22 = nums[5]!
                    const m23 = nums[6]!
                    const scaleX = Math.hypot(m11, m12, m13)
                    const scaleY = Math.hypot(m21, m22, m23)
                    return (scaleX + scaleY) / 2
                }
                if (t.startsWith('matrix(')) {
                    const raw = t.slice('matrix('.length, -1)
                    const nums = raw.split(',').map((v) => parseFloat(v.trim()))
                    if (nums.length < 4 || nums.slice(0, 4).some((n) => Number.isNaN(n))) return 1
                    const a = nums[0]!
                    const b = nums[1]!
                    const c = nums[2]!
                    const d = nums[3]!
                    const scaleX = Math.hypot(a, b)
                    const scaleY = Math.hypot(c, d)
                    return (scaleX + scaleY) / 2
                }
                return 1
            } catch {
                return 1
            }
        }

        // Initial scale is ~1 (identity transform may be expressed as matrix(...))
        const initialScale = await readScale()
        expect(Math.abs(initialScale - 1)).toBeLessThan(0.01)

        // Hover: scale increases towards 1.2
        await box.hover()
        await expect.poll(readScale).toBeGreaterThan(1.1)

        // Tap (pointerdown): scale to 0.8 using real mouse input
        await page.mouse.down()
        await expect.poll(readScale).toBeLessThan(0.9)

        // Release (pointerup): should return to hover scale (≈1.2), not initial
        await page.mouse.up()
        await expect.poll(readScale).toBeGreaterThan(1.05)
    })
})
