import { expect, test } from '@playwright/test'
import { sampleRectLeftSeries } from '../_helpers/transform'

const UNDERLINE = '[data-testid="underline"]'

test.describe('animate-layout/shared', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/animate-layout/shared?@isPlaywright=true')
        await page.getByTestId('tab-home').waitFor({ state: 'visible' })
    })

    test('carries the data-layout-id underline across tabs', async ({ page }) => {
        const start = await page.locator(UNDERLINE).boundingBox()
        const target = await page.getByTestId('tab-blog').boundingBox()

        const sampling = sampleRectLeftSeries(page, { underline: UNDERLINE }, 900)
        await page.getByTestId('tab-blog').click()
        const lefts = (await sampling).map((sample) => sample.lefts.underline)

        // One underline exists in every frame: the handoff never drops it.
        expect(lefts.every((left) => left !== null)).toBe(true)
        const end = lefts[lefts.length - 1]!
        expect(end).toBeGreaterThan(target!.x)
        const inFlight = lefts.filter((left) => left! > start!.x + 1 && left! < end - 1)
        expect(inFlight.length).toBeGreaterThanOrEqual(5)

        await expect(page.getByTestId('settled')).toHaveText('settled:1 selected:Blog')
        await expect(page.locator(UNDERLINE)).toHaveCount(1)
    })

    test('animates the underline width to the new tab', async ({ page }) => {
        const from = (await page.locator(UNDERLINE).boundingBox())!.width
        const sampling = page.evaluate(
            (selector) =>
                new Promise<number[]>((resolve) => {
                    const widths: number[] = []
                    const start = performance.now()
                    const read = () => {
                        const el = document.querySelector(selector)
                        if (el) widths.push(el.getBoundingClientRect().width)
                        if (performance.now() - start < 900) requestAnimationFrame(read)
                        else resolve(widths)
                    }
                    requestAnimationFrame(read)
                }),
            UNDERLINE
        )
        await page.getByTestId('tab-examples').click()
        const widths = await sampling
        const to = widths[widths.length - 1]

        expect(to).toBeGreaterThan(from + 10)
        // The width grows through in-between values instead of jumping.
        const growing = widths.filter((width) => width > from + 1 && width < to - 1)
        expect(growing.length).toBeGreaterThanOrEqual(5)
    })
})
