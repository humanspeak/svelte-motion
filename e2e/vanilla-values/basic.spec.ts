import { expect, test } from '@playwright/test'

test.describe('vanilla-values/basic', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/vanilla-values?@isPlaywright=true')
        await page.getByTestId('slider').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
    })

    test('a $state slider drives plain elements through the vanilla layer', async ({ page }) => {
        const direct = page.getByTestId('direct-box')
        const before = await direct.boundingBox()
        if (!before) throw new Error('no box')
        const bgBefore = await direct.evaluate((el) => getComputedStyle(el).backgroundColor)

        await page.getByTestId('slider').fill('100')

        // toMotionValue(getter) → mapValue → styleEffect: the plain div
        // translates the full 240px mapped range.
        await expect
            .poll(async () => {
                const box = await direct.boundingBox()
                return (box?.x ?? 0) - before.x
            })
            .toBeCloseTo(240, 0)

        // transformValue-derived color applied by the same styleEffect.
        const bgAfter = await direct.evaluate((el) => getComputedStyle(el).backgroundColor)
        expect(bgAfter).not.toBe(bgBefore)
    })

    test('springValue follows the mapped value and settles at its target', async ({ page }) => {
        const spring = page.getByTestId('spring-box')
        const before = await spring.boundingBox()
        if (!before) throw new Error('no box')

        await page.getByTestId('slider').fill('100')

        // Mid-flight the spring lags the direct value…
        await page.waitForTimeout(60)
        const mid = await spring.boundingBox()
        if (!mid) throw new Error('no mid box')
        expect(mid.x - before.x).toBeLessThan(240)

        // …and settles at the target.
        await expect
            .poll(
                async () => {
                    const box = await spring.boundingBox()
                    return (box?.x ?? 0) - before.x
                },
                { timeout: 5000 }
            )
            .toBeCloseTo(240, 0)
    })

    test('reactive .current readouts track the values in the template', async ({ page }) => {
        await expect(page.getByTestId('readout')).toHaveText('progress:0.00 x:0 spring:0')
        await page.getByTestId('slider').fill('50')
        await expect(page.getByTestId('readout')).toContainText('progress:0.50 x:120')
    })

    test('vanilla motionValue works from an event handler', async ({ page }) => {
        const counter = page.getByTestId('click-counter')
        await expect(counter).toHaveText('clicked 0 times')
        await counter.click()
        await counter.click()
        await counter.click()
        await expect(counter).toHaveText('clicked 3 times')
    })
})
