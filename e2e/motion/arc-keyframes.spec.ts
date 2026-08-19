import { expect, test, type Page } from '@playwright/test'
import { readTransform } from '../_helpers/transform'

const URL = '/tests/arc/keyframes?@isPlaywright=true'
const BOX = '[data-testid="arc-box"]'

type TransformSample = Awaited<ReturnType<typeof readTransform>>

/** Samples the computed transform roughly once per frame for a duration. */
const sampleTransform = async (page: Page, ms: number): Promise<TransformSample[]> => {
    const samples: TransformSample[] = []
    const started = Date.now()
    while (Date.now() - started < ms) {
        await page.waitForTimeout(16)
        samples.push(await readTransform(page, BOX))
    }
    return samples
}

const waitForReady = (page: Page) =>
    expect(page.locator(BOX)).toHaveAttribute('data-is-loaded', 'ready')

const waitForPosition = async (page: Page, x: number) => {
    await expect
        .poll(async () => (await readTransform(page, BOX)).tx, { timeout: 2500 })
        .toBeCloseTo(x, 0)
    await expect
        .poll(async () => (await readTransform(page, BOX)).ty, { timeout: 2500 })
        .toBeCloseTo(0, 0)
}

const midFlightTy = (samples: TransformSample[]) => {
    const mid = samples.find((sample) => sample.tx > 60 && sample.tx < 140)
    expect(mid, `expected a mid-flight sample: ${JSON.stringify(samples)}`).toBeTruthy()
    return mid!.ty
}

test.describe('arc() keyframe paths', () => {
    test('arc bulges off the straight line and settles exactly', async ({ page }) => {
        await page.goto(URL)
        await waitForReady(page)
        await page.getByTestId('strength-1').click()

        await page.getByTestId('toggle').click()
        const samples = await sampleTransform(page, 1100)

        expect(
            samples.some((sample) => sample.tx > 60 && sample.tx < 140 && Math.abs(sample.ty) > 30)
        ).toBe(true)
        await waitForPosition(page, 200)
    })

    test('direction cw and ccw bulge to opposite sides', async ({ page }) => {
        await page.goto(URL)
        await waitForReady(page)

        await page.getByTestId('dir-cw').click()
        await page.getByTestId('toggle').click()
        const clockwiseTy = midFlightTy(await sampleTransform(page, 1100))
        await waitForPosition(page, 200)

        await page.getByTestId('toggle').click()
        await waitForPosition(page, 0)

        await page.getByTestId('dir-ccw').click()
        await page.getByTestId('toggle').click()
        const counterclockwiseTy = midFlightTy(await sampleTransform(page, 1100))

        expect(Math.sign(clockwiseTy)).not.toBe(0)
        expect(Math.sign(counterclockwiseTy)).toBe(-Math.sign(clockwiseTy))
        await waitForPosition(page, 200)
    })

    test('rotate:true rotates mid-flight, rotate:false does not', async ({ page }) => {
        await page.goto(URL)
        await waitForReady(page)

        await page.getByTestId('rotate-on').click()
        await page.getByTestId('toggle').click()
        const rotateSamples = await sampleTransform(page, 1100)
        expect(
            rotateSamples.some(
                (sample) =>
                    sample.tx > 60 &&
                    sample.tx < 140 &&
                    (Math.abs(sample.b) > 0.01 || Math.abs(sample.c) > 0.01)
            )
        ).toBe(true)
        await waitForPosition(page, 200)
        expect(Math.abs((await readTransform(page, BOX)).b)).toBeLessThan(0.01)

        await page.getByTestId('rotate-off').click()
        await page.getByTestId('toggle').click()
        const noRotateSamples = await sampleTransform(page, 1100)
        const moving = noRotateSamples.filter((sample) => sample.tx > 60 && sample.tx < 140)
        expect(moving.length).toBeGreaterThan(0)
        expect(
            moving.every((sample) => Math.abs(sample.b) < 0.01 && Math.abs(sample.c) < 0.01)
        ).toBe(true)
        await waitForPosition(page, 0)
        expect(Math.abs((await readTransform(page, BOX)).b)).toBeLessThan(0.01)
    })
})
