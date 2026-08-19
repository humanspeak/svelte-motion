import { expect, test, type Page } from '@playwright/test'
import {
    readTransform,
    sampleTransformSeries,
    waitForSettledTransform,
    type TransformSample
} from '../_helpers/transform'

const URL = '/tests/arc/keyframes?@isPlaywright=true'
const BOX = '[data-testid="arc-box"]'

const waitForReady = (page: Page) =>
    expect(page.locator(BOX)).toHaveAttribute('data-is-loaded', 'ready')

/** Toggle the box and sample its transform in-page for the full transition. */
const toggleAndSample = async (page: Page) => {
    await page.getByTestId('toggle').click()
    return sampleTransformSeries(page, [BOX], 1100)
}

const isMidFlight = (sample: TransformSample) => sample.tx > 60 && sample.tx < 140

const midFlightTy = (samples: TransformSample[]) => {
    const mid = samples.find(isMidFlight)
    expect(mid, `expected a mid-flight sample: ${JSON.stringify(samples)}`).toBeTruthy()
    return mid!.ty
}

test.describe('arc() keyframe paths', () => {
    test('arc bulges off the straight line and settles exactly', async ({ page }) => {
        await page.goto(URL)
        await waitForReady(page)
        await page.getByTestId('strength-1').click()

        const samples = await toggleAndSample(page)

        expect(samples.some((sample) => isMidFlight(sample) && Math.abs(sample.ty) > 30)).toBe(true)
        await waitForSettledTransform(page, BOX, { tx: 200, ty: 0 })
    })

    test('direction cw and ccw bulge to opposite sides', async ({ page }) => {
        await page.goto(URL)
        await waitForReady(page)

        await page.getByTestId('dir-cw').click()
        const clockwiseTy = midFlightTy(await toggleAndSample(page))
        await waitForSettledTransform(page, BOX, { tx: 200, ty: 0 })

        await page.getByTestId('toggle').click()
        await waitForSettledTransform(page, BOX, { tx: 0, ty: 0 })

        await page.getByTestId('dir-ccw').click()
        const counterclockwiseTy = midFlightTy(await toggleAndSample(page))

        expect(Math.sign(clockwiseTy)).not.toBe(0)
        expect(Math.sign(counterclockwiseTy)).toBe(-Math.sign(clockwiseTy))
        await waitForSettledTransform(page, BOX, { tx: 200, ty: 0 })
    })

    test('rotate:true rotates mid-flight, rotate:false does not', async ({ page }) => {
        await page.goto(URL)
        await waitForReady(page)

        await page.getByTestId('rotate-on').click()
        const rotateSamples = await toggleAndSample(page)
        expect(
            rotateSamples.some(
                (sample) =>
                    isMidFlight(sample) && (Math.abs(sample.b) > 0.01 || Math.abs(sample.c) > 0.01)
            )
        ).toBe(true)
        await waitForSettledTransform(page, BOX, { tx: 200, ty: 0 })
        expect(Math.abs((await readTransform(page, BOX)).b)).toBeLessThan(0.01)

        await page.getByTestId('rotate-off').click()
        const noRotateSamples = await toggleAndSample(page)
        const moving = noRotateSamples.filter(isMidFlight)
        expect(moving.length).toBeGreaterThan(0)
        expect(
            moving.every((sample) => Math.abs(sample.b) < 0.01 && Math.abs(sample.c) < 0.01)
        ).toBe(true)
        await waitForSettledTransform(page, BOX, { tx: 0, ty: 0 })
        expect(Math.abs((await readTransform(page, BOX)).b)).toBeLessThan(0.01)
    })
})
