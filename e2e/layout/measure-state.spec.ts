import { expect, test, type Page } from '@playwright/test'

/**
 * An `onLayoutMeasure` callback that reads and writes `$state` must not loop
 * the library's layout effects (`effect_update_depth_exceeded`). Fixture:
 * `src/routes/tests/layout/measure-state/+page.svelte`.
 */
const URL = '/tests/layout/measure-state?@isPlaywright=true'

const collectErrors = (page: Page) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
    })
    return errors
}

const readMeasures = async (page: Page) =>
    Number((await page.getByTestId('measures').textContent()) ?? Number.NaN)

const loopErrors = (errors: string[]) =>
    errors.filter((error) => error.includes('effect_update_depth_exceeded'))

test.describe('onLayoutMeasure writing $state', () => {
    test('mounts without an effect loop', async ({ page }) => {
        const errors = collectErrors(page)
        await page.goto(URL)
        await expect(page.getByTestId('box')).toHaveAttribute('data-is-loaded', 'ready')
        await expect.poll(() => readMeasures(page)).toBeGreaterThanOrEqual(1)

        expect(loopErrors(errors)).toEqual([])
        expect(await readMeasures(page)).toBeLessThanOrEqual(5)
    })

    test('a layout change reports once or twice, not unbounded', async ({ page }) => {
        const errors = collectErrors(page)
        await page.goto(URL)
        await expect(page.getByTestId('box')).toHaveAttribute('data-is-loaded', 'ready')
        await expect.poll(() => readMeasures(page)).toBeGreaterThanOrEqual(1)

        const before = await readMeasures(page)
        await page.getByTestId('toggle').click()
        await expect(page.getByTestId('last-box')).toHaveText('240x80')

        const grew = (await readMeasures(page)) - before
        expect(grew).toBeGreaterThanOrEqual(1)
        expect(grew).toBeLessThanOrEqual(5)
        expect(loopErrors(errors)).toEqual([])
    })
})
