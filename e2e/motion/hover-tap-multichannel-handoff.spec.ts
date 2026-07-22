import { expect, test } from '@playwright/test'
import { sampleTransformSeries } from '../_helpers/transform'

/**
 * Regression: an interrupted whileHover={{ scale, y }} must hand off to
 * whileTap with NO first-frame jump on the `y` channel.
 *
 * The hover system's composed writer writes every owned transform channel
 * directly to `el.style.transform`, bypassing motion's internal motion values.
 * When a tap interrupts a mid-flight hover, the tap animation must seed its
 * keyframes from the element's VISUAL value on each channel. Before plan 002,
 * only `scale` was seeded — so `y` snapped to motion's stale internal value on
 * frame one (a jump toward the tap target `y: 0`).
 */
test.describe('Hover→tap multichannel handoff', () => {
    const selector = '[data-testid="motion-multichannel-handoff"]'

    const readY = (box: import('@playwright/test').Locator) =>
        box.evaluate((el) => {
            const t = getComputedStyle(el).transform
            if (!t || t === 'none') return 0
            const match = t.match(/matrix\(([^)]+)\)/)
            if (!match) return 0
            const parts = match[1].split(',').map((v) => parseFloat(v.trim()))
            return parts[5] ?? 0
        })

    test('mid-hover press does not snap y on frame one', async ({ page }) => {
        await page.goto('/tests/motion/hover-tap-multichannel-handoff?@isPlaywright=true')

        const box = page.getByTestId('motion-multichannel-handoff')
        await expect(box).toBeVisible()
        // Let hydration finish before the first pointer event: a hover fired
        // before listeners attach is silently lost.
        await page.waitForTimeout(800)

        // Hover, then wait mid-flight so `y` is between 0 and -20.
        await box.hover()
        await page.waitForTimeout(250)

        const preY = await readY(box)
        // Sanity: we are genuinely mid-hover, not resting at 0 or -20.
        expect(preY).toBeLessThan(-1)
        expect(preY).toBeGreaterThan(-19)

        // Interrupt the hover with a press and sample `y` every frame for the
        // first ~120ms of the press (in-page, no protocol round trip so the
        // snap frame can't slip between samples).
        await page.mouse.down()
        const series = await sampleTransformSeries(page, [selector], 120)
        await page.mouse.up()

        expect(series.length).toBeGreaterThan(0)
        const firstPost = series[0].ty

        // No discontinuity: the first post-press sample must stay near the last
        // pre-press value. Pre-fix it snaps toward the tap target (y: 0), a jump
        // well beyond 3px; post-fix the seeded keyframe keeps it continuous.
        expect(Math.abs(firstPost - preY)).toBeLessThan(3)
    })
})
