import { expect, test, type Page } from '@playwright/test'
import {
    readTranslateX,
    sampleTransformSeries,
    waitForSettledTransform
} from '../_helpers/transform'

const ITEM = '[data-testid="item-0"]'

/** Wait for the on-load scope animation to finish (x: 100). */
const settled = (page: Page) => waitForSettledTransform(page, ITEM, { tx: 100, ty: 0 }, 1)

test.describe('scope-motion/basic', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/scope-motion/basic?@isPlaywright=true')
        await expect(page.getByTestId('state')).toHaveText('active')
        await settled(page)
    })

    test('animates with the scope default transition (linear 0.4s)', async ({ page }) => {
        // Restart the animation from 0 with refresh, then sample every frame.
        const sampling = sampleTransformSeries(page, [ITEM], 900)
        await page.getByTestId('refresh').click()
        const samples = await sampling

        const moving = samples.filter((sample) => sample.tx > 0.5 && sample.tx < 99.5)
        expect(moving.length).toBeGreaterThanOrEqual(3)
        const t0 = moving[0].atMs
        const tEnd = samples.find((sample) => sample.atMs > t0 && sample.tx >= 99.5)!.atMs

        // About 400ms from first movement to arrival (generous for a loaded machine).
        expect(tEnd - t0).toBeGreaterThan(250)
        expect(tEnd - t0).toBeLessThan(700)
        // Linear, so about half-way 200ms in. The default spring would be at
        // or past 100px by then.
        const mid = moving.reduce((best, sample) =>
            Math.abs(sample.atMs - t0 - 200) < Math.abs(best.atMs - t0 - 200) ? sample : best
        )
        expect(mid.tx).toBeGreaterThan(30)
        expect(mid.tx).toBeLessThan(70)
        // No overshoot: a tween, not the default spring.
        expect(Math.max(...samples.map((sample) => sample.tx))).toBeLessThanOrEqual(100.5)
        // Selectors resolve inside the scope root: the outside item never moves.
        expect(await readTranslateX(page, '[data-testid="outside"]')).toBe(0)
    })

    test('stop freezes the animation mid-flight', async ({ page }) => {
        await page.getByTestId('refresh').click()
        await expect
            .poll(() => readTranslateX(page, ITEM), { timeout: 2000, intervals: [10] })
            .toBeGreaterThan(5)
        await page.getByTestId('stop').click()
        await expect(page.getByTestId('state')).toHaveText('stopped')

        const atStop = await readTranslateX(page, ITEM)
        await page.waitForTimeout(600)
        const later = await readTranslateX(page, ITEM)

        expect(atStop).toBeGreaterThan(0)
        expect(atStop).toBeLessThan(99.5)
        expect(Math.abs(later - atStop)).toBeLessThan(0.5)
    })

    test('cancel restores the original inline style', async ({ page }) => {
        expect(await page.locator(ITEM).getAttribute('style')).not.toBeNull()

        await page.getByTestId('cancel').click()

        await expect(page.getByTestId('state')).toHaveText('cancelled')
        await expect(page.locator(ITEM)).not.toHaveAttribute('style')
        expect(await readTranslateX(page, ITEM)).toBe(0)
    })

    test('gestures are collected: hover and press stop after cancel', async ({ page }) => {
        const first = page.getByTestId('item-0')
        const second = page.getByTestId('item-1')

        // Positive control while the scope is active.
        await first.hover()
        await expect(first).toHaveAttribute('data-hovered', 'true')
        await first.click()
        await expect(first).toHaveAttribute('data-pressed', 'true')

        await page.mouse.move(0, 0)
        await page.getByTestId('cancel').click()
        await expect(page.getByTestId('state')).toHaveText('cancelled')

        await second.hover()
        await second.click()
        await page.waitForTimeout(200)
        await expect(second).not.toHaveAttribute('data-hovered')
        await expect(second).not.toHaveAttribute('data-pressed')
    })

    test('refresh re-runs setup and plays the animation again', async ({ page }) => {
        await expect(page.getByTestId('runs')).toHaveText('1')
        await page.getByTestId('cancel').click()
        expect(await readTranslateX(page, ITEM)).toBe(0)

        await page.getByTestId('refresh').click()

        await expect(page.getByTestId('runs')).toHaveText('2')
        await expect(page.getByTestId('state')).toHaveText('active')
        await settled(page)
    })
})
