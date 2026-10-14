import { expect, test, type Page } from '@playwright/test'

/**
 * A `layout` element whose size changes mid-way through an accelerated `x`
 * animation (Motion 14.2 runs it as one WAAPI `transform` animation) must not
 * jump sideways. svelte-motion's layout measurements write the base transform
 * inline, but a WAAPI animation overrides inline style, so the measurement has
 * to detach the compositor animation for its read. Against
 * `src/routes/tests/independent-transforms/layout-measure/+page.svelte`.
 */

type MeasureWindow = {
    countTransformAnimations: (id: string) => number
    sampleLeft: (ms: number) => Promise<number[]>
}

const count = (page: Page, id: string) =>
    page.evaluate((id) => (window as unknown as MeasureWindow).countTransformAnimations(id), id)

test.describe('accelerated x + layout width change', () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test('the box keeps moving smoothly when it widens mid-animation', async ({ page }) => {
        await page.goto('/tests/independent-transforms/layout-measure?@isPlaywright=true')
        const box = page.locator('#box')
        await box.waitFor({ state: 'attached' })
        // Layout position without the x transform (the entry animation may
        // already have started by the time a bounding box could be read).
        const initialLeft = await box.evaluate((el) => (el as HTMLElement).offsetLeft)

        // Precondition: the x entry animation is accelerated.
        await page.waitForTimeout(600)
        expect(await count(page, 'box'), 'accelerated before the width change').toBe(1)

        const [samples] = await Promise.all([
            page.evaluate(() => (window as unknown as MeasureWindow).sampleLeft(800)),
            page.locator('#widen').click()
        ])

        let maxStep = 0
        for (let i = 1; i < samples.length; i++) {
            maxStep = Math.max(maxStep, Math.abs(samples[i] - samples[i - 1]))
        }
        expect(
            maxStep,
            `largest frame-to-frame step in ${JSON.stringify(samples)}`
        ).toBeLessThanOrEqual(10)

        await page.waitForTimeout(2000)
        const final = (await box.boundingBox())!
        expect(Math.abs(final.x - (initialLeft + 200))).toBeLessThanOrEqual(2)
        expect(Math.abs(final.width - 200)).toBeLessThanOrEqual(2)
    })
})
