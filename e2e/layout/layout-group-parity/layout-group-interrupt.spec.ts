import { expect, test, type Page } from '@playwright/test'

/**
 * Port of upstream `packages/framer-motion/cypress/integration/layout-group-interrupt.ts`
 * (Motion v13.4.5) against `/tests/layout/layout-group-interrupt`.
 */
interface Measurement {
    top: number
    left: number
    offsetTop: number
}

const measure = (page: Page): Promise<Measurement> =>
    page.evaluate(() => {
        const button = document.getElementById('button')!.getBoundingClientRect()
        const parent = document.getElementById('text-wrapper')!.getBoundingClientRect()
        return {
            top: button.top,
            left: button.left,
            offsetTop: button.top - parent.top
        }
    })

/**
 * Native click, like the measurements spec. Cypress's actionability treats
 * sub-5px/frame motion as stable and clicks immediately; Playwright's
 * `locator.click()` waits for the fixture's 10s tween to settle, which would
 * measure the wrong moment.
 */
const clickNative = (page: Page, id: string) =>
    page.evaluate((target) => document.getElementById(target)!.click(), id)

/** Cypress's `.nextFrame()`: resolve after the next animation frame. */
const nextFrame = (page: Page) =>
    page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))

test.describe('LayoutGroup inherit="id"', () => {
    test('relative child follows its parent when a parent layout change interrupts its own layout animation', async ({
        page
    }) => {
        await page.setViewportSize({ width: 500, height: 500 })
        await page.goto('/tests/layout/layout-group-interrupt?@isPlaywright=true')
        await page.locator('#button').waitFor({ state: 'visible' })
        await page.waitForTimeout(250)

        const initial = await measure(page)

        await clickNative(page, 'button')

        // Wait until #button is part-way through its own 110px animation
        await expect
            .poll(async () => {
                const delta = (await measure(page)).top - initial.top
                return delta >= 20 && delta <= 90
            })
            .toBe(true)

        /**
         * #text-wrapper is re-measured, #button isn't. #button should
         * neither jump by #text-wrapper's 75px layout shift nor skip the
         * rest of its own horizontal animation within #text-wrapper.
         */
        const toggleExpander = async () => {
            const before = await measure(page)
            await clickNative(page, 'expander')
            await nextFrame(page)
            const after = await measure(page)
            expect(Math.abs(after.top - before.top)).toBeLessThan(20)
            expect(Math.abs(after.left - before.left)).toBeLessThan(10)
            expect(Math.abs(after.offsetTop - initial.offsetTop)).toBeLessThanOrEqual(1)
        }

        await toggleExpander()
        await page.waitForTimeout(500)
        await toggleExpander()
        await page.waitForTimeout(500)
        expect(Math.abs((await measure(page)).offsetTop - initial.offsetTop)).toBeLessThanOrEqual(1)
    })
})
