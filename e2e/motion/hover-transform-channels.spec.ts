import { expect, test } from '@playwright/test'

/**
 * Regression: whileHover={{ scale, y }} must render BOTH channels.
 *
 * The hover system routes `scale` through a composed transform writer (so it
 * can stack on authored base transforms) while other keys run through motion's
 * native element animation. When both were active they fought over
 * `el.style.transform` and the native writer won every frame — the element
 * lifted (y) but never scaled.
 */
test.describe('Hover with multiple transform channels', () => {
    const readTransform = async (box: import('@playwright/test').Locator) => {
        return box.evaluate((el) => {
            const t = getComputedStyle(el).transform
            if (!t || t === 'none') return { scale: 1, y: 0 }
            const match = t.match(/matrix\(([^)]+)\)/)
            if (!match) return { scale: 1, y: 0 }
            const [a, b, , , , f] = match[1].split(',').map((v) => parseFloat(v.trim()))
            return { scale: Math.hypot(a, b), y: f }
        })
    }

    test('hover applies scale and y together, and both restore on exit', async ({ page }) => {
        await page.goto('/tests/motion/hover-transform-channels?@isPlaywright=true')

        const box = page.getByTestId('motion-hover-transform-channels')
        await expect(box).toBeVisible()
        // Let hydration finish before the first pointer event: a hover fired
        // before listeners attach is silently lost.
        await page.waitForTimeout(800)

        const initial = await readTransform(box)
        expect(Math.abs(initial.scale - 1)).toBeLessThan(0.01)
        expect(Math.abs(initial.y)).toBeLessThan(0.5)

        // Hover: BOTH channels must move.
        await box.hover()
        await expect.poll(async () => (await readTransform(box)).y).toBeLessThan(-7)
        const hovered = await readTransform(box)
        expect(hovered.scale).toBeGreaterThan(1.15)

        // Exit: both channels unwind to neutral.
        await page.mouse.move(5, 5)
        await expect
            .poll(async () => (await readTransform(box)).y, { timeout: 5000 })
            .toBeGreaterThan(-0.5)
        const rested = await readTransform(box)
        expect(Math.abs(rested.scale - 1)).toBeLessThan(0.02)
    })
})
