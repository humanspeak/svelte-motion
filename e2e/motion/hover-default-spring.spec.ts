import { expect, test } from '@playwright/test'

/**
 * Upstream fidelity: composed hover channels must use framer-motion's per-value
 * default transitions and play full keyframe arrays.
 *
 * When `whileHover` includes `scale`, every transform channel routes through the
 * composed writer (motion-dom `animateValue`). With no explicit transition,
 * `animateValue` alone defaults to a ~0.3s keyframes tween — but upstream applies
 * per-value defaults at a higher layer: `scale` → critically-damped spring
 * (stiffness 550, damping 30, ~7% overshoot), `x`/`y`/`rotate` → under-damped
 * spring (stiffness 500, damping 25). A tween never exceeds its target, so an
 * overshoot beyond 1.5 is proof the spring default is applied.
 *
 * The second case plays `scale: [1, 1.8, 1.2]`. Upstream plays the authored
 * array in full (keyframes default, 0.8s); the collapse-to-final behavior jumps
 * straight to 1.2 and never reaches the 1.8 waypoint.
 */
test.describe('Hover composed channels use upstream default transitions', () => {
    const readScale = async (box: import('@playwright/test').Locator) => {
        return box.evaluate((el) => {
            const t = getComputedStyle(el).transform
            if (!t || t === 'none') return 1
            const match = t.match(/matrix\(([^)]+)\)/)
            if (!match) return 1
            const [a, b] = match[1].split(',').map((v) => parseFloat(v.trim()))
            return Math.hypot(a, b)
        })
    }

    const sampleMaxScale = async (
        page: import('@playwright/test').Page,
        box: import('@playwright/test').Locator,
        durationMs: number
    ) => {
        let max = 1
        const start = Date.now()
        while (Date.now() - start < durationMs) {
            max = Math.max(max, await readScale(box))
            await page.waitForTimeout(16)
        }
        return max
    }

    test('scale hover overshoots its target (critically-damped spring default)', async ({
        page
    }) => {
        await page.goto('/tests/motion/hover-default-spring?@isPlaywright=true')

        const box = page.getByTestId('motion-hover-default-spring')
        await expect(box).toBeVisible()
        // Let hydration finish: a hover fired before listeners attach is lost.
        await page.waitForTimeout(800)

        const initial = await readScale(box)
        expect(Math.abs(initial - 1)).toBeLessThan(0.01)

        await box.hover()
        // A spring from 1 → 1.5 overshoots ~7%; a tween never exceeds 1.5.
        const maxScale = await sampleMaxScale(page, box, 600)
        expect(maxScale).toBeGreaterThan(1.51)
    })

    test('scale keyframe array plays its 1.8 waypoint in full', async ({ page }) => {
        await page.goto('/tests/motion/hover-default-spring?@isPlaywright=true')

        const box = page.getByTestId('motion-hover-keyframe-waypoint')
        await expect(box).toBeVisible()
        await page.waitForTimeout(800)

        await box.hover()
        // Authored array [1, 1.8, 1.2]: the 1.8 waypoint must be observed.
        // Collapse-to-final jumps straight to 1.2 and never exceeds 1.5.
        const maxScale = await sampleMaxScale(page, box, 900)
        expect(maxScale).toBeGreaterThan(1.5)
    })
})
