import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Port of upstream motion `tests/react/issue-2362.spec.ts` and the cases of
 * `packages/framer-motion/src/projection/__tests__/shared-layout-initial.test.tsx`
 * (https://github.com/motiondivision/motion/issues/2362, Motion 14.6.0).
 *
 * Mixing layoutId with initial/animate: when the element with the layoutId is
 * conditionally rendered in a new place, the shared layout animation moves it
 * there. It shouldn't fade back in from its initial opacity, because visually
 * it's the same element continuing.
 */

const URL = '/tests/layout-id/takeover-initial?@isPlaywright=true'

const opacityOf = (locator: Locator) =>
    locator.evaluate((element) => Number(getComputedStyle(element).opacity))

/**
 * Lets the first mount's fade finish, switches to tab 1 and returns the
 * underline's box before/after plus a single-point opacity read of `target`
 * 400 ms after the click (~20% into the fade the bug would produce). A
 * retrying assertion would wait out the animation and hide the bug.
 */
async function takeOver(page: Page, target: Locator) {
    const underline = page.getByTestId('underline')
    await expect(underline).toHaveCSS('opacity', '1', { timeout: 5000 })
    const before = await underline.boundingBox()

    await page.getByTestId('tab-1').click()
    await page.waitForTimeout(400)
    const opacity = await opacityOf(target)
    const after = await underline.boundingBox()

    return { before: before!, after: after!, opacity }
}

test.describe('layoutId takeover and initial (#2362)', () => {
    test('first mount still runs its entrance', async ({ page }) => {
        await page.goto(URL)

        const underline = page.getByTestId('underline')
        await expect(underline).toBeAttached()
        expect(await opacityOf(underline)).toBeLessThan(0.9)

        await expect(underline).toHaveCSS('opacity', '1', { timeout: 5000 })
    })

    test("a takeover doesn't replay the entrance", async ({ page }) => {
        await page.goto(URL)

        const { before, after, opacity } = await takeOver(page, page.getByTestId('underline'))

        // The shared layout animation did move it.
        expect(after.x).toBeGreaterThan(before.x)
        expect(opacity).toBeGreaterThan(0.9)
    })

    test('variant children of a takeover start at their animate state', async ({ page }) => {
        await page.goto(`${URL}&variants`)

        const { before, after, opacity } = await takeOver(page, page.getByTestId('underline-child'))

        expect(after.x).toBeGreaterThan(before.x)
        expect(opacity).toBeGreaterThan(0.9)
    })

    test('runs the entrance when the previous element is long gone', async ({ page }) => {
        await page.goto(URL)

        const underline = page.getByTestId('underline')
        await expect(underline).toHaveCSS('opacity', '1', { timeout: 5000 })

        await page.getByTestId('none').click()
        await expect(underline).toHaveCount(0)
        // Past the registry's 100 ms handoff window.
        await page.waitForTimeout(500)

        await page.getByTestId('tab-1').click()
        await expect(underline).toBeAttached()
        expect(await opacityOf(underline)).toBeLessThan(0.9)
    })

    test("a takeover inside a mounted motion parent doesn't replay the entrance", async ({
        page
    }) => {
        await page.goto(`${URL}&parent`)

        const { before, after, opacity } = await takeOver(page, page.getByTestId('underline'))

        expect(after.x).toBeGreaterThan(before.x)
        expect(opacity).toBeGreaterThan(0.9)
    })

    test('a takeover without `initial` keeps its default values', async ({ page }) => {
        await page.goto(`${URL}&noInitial`)

        const box = page.getByTestId('box')
        const stepButton = page.getByTestId('step')
        await expect(box).toBeAttached()

        const twoFrames = () =>
            page.evaluate(
                () =>
                    new Promise<void>((resolve) =>
                        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
                    )
            )

        await stepButton.click()
        await expect(stepButton).toHaveText('step 1')
        await twoFrames()

        await stepButton.click()
        await expect(stepButton).toHaveText('step 2')
        await twoFrames()

        expect(await box.evaluate((element) => getComputedStyle(element).transform)).toBe('none')
    })
})
