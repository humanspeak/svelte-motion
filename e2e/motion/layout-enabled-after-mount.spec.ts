import { expect, test, type Locator, type Page } from '@playwright/test'

// Port of upstream #2567 (`dynamic-layout.test.tsx`, commit 550d03223): a
// `layout` prop turned on after mount must FLIP the next layout change.
const URL = '/tests/motion/layout-enabled-after-mount?@isPlaywright=true'

/** Sample the box width every rAF for 900 ms while toggling its width. */
const sampleWidthsAcrossToggle = async (page: Page, box: Locator) => {
    const samplesPromise = box.evaluate(
        (el) =>
            new Promise<number[]>((resolve) => {
                const out: number[] = []
                const t0 = performance.now()
                const read = () => {
                    out.push(el.getBoundingClientRect().width)
                    if (performance.now() - t0 < 900) requestAnimationFrame(read)
                    else resolve(out)
                }
                requestAnimationFrame(read)
            })
    )
    await page.getByTestId('toggle-width').click()
    return samplesPromise
}

/** Widths strictly between 100 and 300 px, with a 2 px margin. */
const intermediateWidths = (samples: number[]) =>
    new Set(samples.filter((width) => width > 102 && width < 298).map((width) => Math.round(width)))

test.describe('motion/layout enabled after mount', () => {
    test('animates the width once layout is enabled after mount', async ({ page }) => {
        await page.goto(URL)
        const box = page.getByTestId('box')
        await box.waitFor({ state: 'visible' })
        await page.waitForTimeout(800)

        await page.getByTestId('enable-layout').click()
        await page.waitForTimeout(100)

        const samples = await sampleWidthsAcrossToggle(page, box)
        const intermediate = intermediateWidths(samples)
        expect(
            intermediate.size,
            `expected a FLIP through intermediate widths, saw ${JSON.stringify(samples.map(Math.round))}`
        ).toBeGreaterThanOrEqual(4)
    })

    test('snaps the width when layout is never enabled', async ({ page }) => {
        await page.goto(URL)
        const box = page.getByTestId('box')
        await box.waitFor({ state: 'visible' })
        await page.waitForTimeout(800)

        const samples = await sampleWidthsAcrossToggle(page, box)
        expect(samples[samples.length - 1]).toBeCloseTo(300, 0)
        const intermediateSamples = samples.filter((width) => width > 102 && width < 298)
        expect(
            intermediateSamples.length,
            `expected a snap, saw ${JSON.stringify(samples.map(Math.round))}`
        ).toBeLessThanOrEqual(1)
    })
})
