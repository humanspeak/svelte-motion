import { expect, test, type Page } from '@playwright/test'
import { readTransform } from '../_helpers/transform'

const URL = '/tests/arc/layout?@isPlaywright=true'

type TransformSample = Awaited<ReturnType<typeof readTransform>>

/** Samples a selector's computed transform roughly once per frame. */
const sampleTransform = async (
    page: Page,
    selector: string,
    ms: number
): Promise<TransformSample[]> => {
    const samples: TransformSample[] = []
    const started = Date.now()
    while (Date.now() - started < ms) {
        await page.waitForTimeout(16)
        samples.push(await readTransform(page, selector))
    }
    return samples
}

const waitForIdentity = async (page: Page, selector: string) => {
    await expect
        .poll(async () => Math.abs((await readTransform(page, selector)).tx), { timeout: 2500 })
        .toBeLessThan(1)
    await expect
        .poll(async () => Math.abs((await readTransform(page, selector)).ty), { timeout: 2500 })
        .toBeLessThan(1)
}

test.describe('arc() layout paths', () => {
    test('layout FLIP follows the arc (ty deviates on a horizontal move)', async ({ page }) => {
        const selector = '[data-testid="layout-box"]'
        await page.goto(URL)
        await expect(page.locator(selector)).toHaveAttribute('data-is-loaded', 'ready')

        await page.getByTestId('toggle').click()
        const samples = await sampleTransform(page, selector, 1100)

        expect(
            samples.some(
                (sample) =>
                    Math.abs(sample.tx) > 60 &&
                    Math.abs(sample.tx) < 300 &&
                    Math.abs(sample.ty) > 30
            ),
            `expected a curved layout FLIP: ${JSON.stringify(samples)}`
        ).toBe(true)
        await waitForIdentity(page, selector)
    })

    test('layoutId shared transition follows the arc', async ({ page }) => {
        const selector = '[data-testid="shared-box"]'
        await page.goto(URL)
        await expect(page.locator(selector)).toHaveAttribute('data-is-loaded', 'ready')

        await page.getByTestId('toggle').click()
        const samples = await sampleTransform(page, selector, 1100)

        expect(
            samples.some(
                (sample) =>
                    Math.abs(sample.tx) > 60 &&
                    Math.abs(sample.tx) < 300 &&
                    Math.abs(sample.ty) > 30
            ),
            `expected a curved shared-layout transition: ${JSON.stringify(samples)}`
        ).toBe(true)
        await waitForIdentity(page, selector)
    })
})
