import { expect, test, type Locator } from '@playwright/test'

const ROUTE = '/tests/motion-config-skip-animations'

const readTransform = (locator: Locator) =>
    locator.evaluate((el) => getComputedStyle(el as HTMLElement).transform)

const readTranslateX = async (locator: Locator): Promise<number> => {
    const transform = await readTransform(locator)
    const match = transform.match(/matrix\(1,\s*0,\s*0,\s*1,\s*([^,]+)/)
    return match ? Number.parseFloat(match[1]) : 0
}

test.describe('MotionConfig.skipAnimations', () => {
    test('skipAnimations on jumps the box to its final state', async ({ page }) => {
        await page.goto(ROUTE)
        await page.getByTestId('toggle-skip').check()

        const box = page.getByTestId('motion-box')
        await expect(box).toBeAttached()
        await page.waitForTimeout(300)

        expect(await readTransform(box)).toMatch(/matrix\(1,\s*0,\s*0,\s*1,\s*200/)
        const opacity = await box.evaluate((el) => getComputedStyle(el as HTMLElement).opacity)
        expect(Number.parseFloat(opacity)).toBeGreaterThan(0.99)
    })

    test('skipAnimations off leaves the box mid-flight', async ({ page }) => {
        await page.goto(ROUTE)

        const box = page.getByTestId('motion-box')
        await expect(box).toBeAttached()
        await page.waitForTimeout(300)

        expect(await readTranslateX(box)).toBeLessThan(190)
    })

    test('skipAnimations is scoped to the MotionConfig subtree', async ({ page }) => {
        await page.goto(ROUTE)
        await page.getByTestId('toggle-skip').check()

        const outsideBox = page.getByTestId('outside-box')
        await expect(outsideBox).toBeAttached()
        await page.waitForTimeout(300)

        expect(await readTranslateX(outsideBox)).toBeLessThan(190)
    })

    test('skipAnimations makes presence exits instant', async ({ page }) => {
        await page.goto(ROUTE)
        await page.getByTestId('toggle-skip').check()
        await expect(page.getByTestId('exit-box')).toBeAttached()

        await page.getByTestId('toggle-presence').click()

        await expect(page.getByTestId('exit-box')).toHaveCount(0, { timeout: 500 })
    })

    test('changed skipAnimations applies to an unkeyed mounted element', async ({ page }) => {
        await page.goto(ROUTE)

        const box = page.getByTestId('unkeyed-box')
        await expect(box).toBeAttached()
        await page.waitForTimeout(2200)
        expect(await readTranslateX(box)).toBeCloseTo(0)

        await page.getByTestId('toggle-skip').check()
        await page.getByTestId('retarget-unkeyed').click()
        await page.waitForTimeout(300)

        expect(await readTranslateX(box)).toBeCloseTo(200)
    })
})
