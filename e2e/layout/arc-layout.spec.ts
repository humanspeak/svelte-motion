import { expect, test } from '@playwright/test'
import {
    sampleTransformSeries,
    waitForSettledTransform,
    type TransformSample
} from '../_helpers/transform'

const URL = '/tests/arc/layout?@isPlaywright=true'

/** A horizontal FLIP frame that has left the straight line by a real margin. */
const isCurvedSample = (sample: TransformSample) =>
    Math.abs(sample.tx) > 60 && Math.abs(sample.tx) < 300 && Math.abs(sample.ty) > 30

const cases = [
    ['layout FLIP follows the arc (ty deviates on a horizontal move)', 'layout-box'],
    ['layoutId shared transition follows the arc', 'shared-box']
] as const

for (const [title, testId] of cases) {
    test(title, async ({ page }) => {
        const selector = `[data-testid="${testId}"]`
        await page.goto(URL)
        await expect(page.locator(selector)).toHaveAttribute('data-is-loaded', 'ready')

        await page.getByTestId('toggle').click()
        const samples = await sampleTransformSeries(page, [selector], 1100)

        expect(
            samples.some(isCurvedSample),
            `expected a curved horizontal FLIP: ${JSON.stringify(samples)}`
        ).toBe(true)
        // Settled: the projection removes its transform entirely.
        await waitForSettledTransform(page, selector, { tx: 0, ty: 0 }, 1)
    })
}
