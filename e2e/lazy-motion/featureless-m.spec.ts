import { expect, test, type Locator, type Page } from '@playwright/test'

// Spike 011 anchors. Upstream (Motion 14.7.1 `render/components/m/create.ts`,
// `motion/utils/use-visual-element.ts`) an `m` without LazyMotion features has
// no VisualElement: it renders `initial` and does nothing else, and once an
// async bundle loads it animates in from `initial`.

const opacityOf = (box: Locator) => box.evaluate((el) => Number(getComputedStyle(el).opacity))

/** The x scale of the element's computed transform (1 when there is none). */
const scaleOf = (box: Locator) =>
    box.evaluate((el) => {
        const transform = getComputedStyle(el).transform
        if (!transform || transform === 'none') return 1
        return new DOMMatrixReadOnly(transform).a
    })

/** Samples the opacity every 100 ms for `ms` and returns every reading. */
const sampleOpacity = async (page: Page, box: Locator, ms: number) => {
    const readings: number[] = []
    for (let elapsed = 0; elapsed <= ms; elapsed += 100) {
        readings.push(await opacityOf(box))
        await page.waitForTimeout(100)
    }
    return readings
}

/** Hovers the box and returns its scale after the hover transition has had time to run. */
const scaleAfterHover = async (page: Page, box: Locator) => {
    await box.hover()
    await page.waitForTimeout(800)
    return scaleOf(box)
}

test.describe('LazyMotion: m without features (spike 011)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/lazy-motion/featureless-m?@isPlaywright=true')
        await expect(page.getByTestId('card-control')).toBeVisible()
    })

    test.fail('a bare m keeps initial and ignores hover', async ({ page }) => {
        const box = page.getByTestId('card-bare')

        const readings = await sampleOpacity(page, box, 1000)
        expect(
            readings.every((value) => Math.abs(value - 0.4) < 0.01),
            readings.join(', ')
        ).toBe(true)
        expect(await scaleAfterHover(page, box)).toBeCloseTo(0.8, 2)
    })

    test.fail(
        'an m in an async LazyMotion waits for its bundle, then animates in',
        async ({ page }) => {
            const box = page.getByTestId('card-async')

            const readings = await sampleOpacity(page, box, 1000)
            expect(
                readings.every((value) => Math.abs(value - 0.4) < 0.01),
                readings.join(', ')
            ).toBe(true)
            expect(await scaleAfterHover(page, box)).toBeCloseTo(0.8, 2)

            await page.mouse.move(0, 0)
            await page.getByTestId('load').click()
            await expect.poll(() => opacityOf(box)).toBeCloseTo(1, 2)
            await expect.poll(() => scaleAfterHover(page, box)).toBeCloseTo(1.15, 2)
        }
    )

    // Guard: a sync `domAnimation` bundle animates and hovers.
    test('the control m animates in and scales on hover', async ({ page }) => {
        const box = page.getByTestId('card-control')

        await expect.poll(() => opacityOf(box)).toBeCloseTo(1, 2)
        await expect.poll(() => scaleAfterHover(page, box)).toBeCloseTo(1.15, 2)
    })
})
