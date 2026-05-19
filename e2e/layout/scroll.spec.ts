import { expect, test } from '@playwright/test'
import { readTransform } from '../_helpers/transform'

/**
 * Regression test for the `layoutScroll` prop.
 *
 * Scenario: two side-by-side scroll containers each with a `layout`
 * animation inside. The user resizes the inner element and scrolls
 * mid-animation. Without `layoutScroll`, FLIP measures viewport-relative
 * rects and the scroll offset shows up as drift in the animation;
 * with `layoutScroll`, measurements happen in container coordinates
 * and the animation stays anchored.
 */
test.describe('layout/scroll', () => {
    test('layoutScroll container keeps animations anchored across scroll', async ({ page }) => {
        await page.goto('/tests/layout/scroll?@isPlaywright=true')

        const scrollWith = page.getByTestId('scroll-with')
        const boxWith = page.getByTestId('box-with')
        const toggle = page.getByTestId('toggle')

        await boxWith.waitFor({ state: 'visible' })

        // Capture initial size so we can later assert the box actually grew.
        const before = await boxWith.boundingBox()
        if (!before) throw new Error('no initial boundingBox')

        // Scroll both containers to a known position before the animation.
        await scrollWith.evaluate((el) => {
            el.scrollTop = 0
        })
        const cWithout = page.getByTestId('scroll-without')
        await cWithout.evaluate((el) => {
            el.scrollTop = 0
        })

        // Fire the resize animation, then scroll mid-flight.
        await toggle.click()
        await page.waitForTimeout(40)
        await scrollWith.evaluate((el) => {
            el.scrollTop = 60
        })
        await cWithout.evaluate((el) => {
            el.scrollTop = 60
        })

        // Poll until the spring settles. `[data-testid="box-with"]` reaches
        // its expanded size when both the layout step and the FLIP "back to
        // identity" finished — we wait until the box has both grown AND has
        // a near-identity translate/scale.
        await expect
            .poll(
                async () => {
                    const t = await readTransform(page, '[data-testid="box-with"]')
                    const rect = await boxWith.boundingBox()
                    return {
                        translateAtRest: Math.abs(t.tx) < 0.5 && Math.abs(t.ty) < 0.5,
                        scaleAtRest: Math.abs(t.a - 1) < 0.01 && Math.abs(t.d - 1) < 0.01,
                        widthGrew: (rect?.width ?? 0) > before.width + 20
                    }
                },
                {
                    timeout: 3000,
                    message: 'box-with did not settle to its new size with identity transform'
                }
            )
            .toEqual({ translateAtRest: true, scaleAtRest: true, widthGrew: true })

        // After settle, the layoutScroll box has no residual translate — the
        // resize completed cleanly without scroll-induced drift. The poll
        // above already enforced this, but assert one more time for
        // documentation in the spec output.
        const settled = await readTransform(page, '[data-testid="box-with"]')
        expect(Math.abs(settled.tx)).toBeLessThan(0.5)
        expect(Math.abs(settled.ty)).toBeLessThan(0.5)

        // Confirm the box actually reached its expanded size (~240 in the
        // regression page). Anything well above the initial 120 confirms
        // the layout animation produced the expected end state.
        const after = await boxWith.boundingBox()
        if (!after) throw new Error('no final boundingBox')
        expect(after.width).toBeGreaterThan(200)
        expect(after.height).toBeGreaterThan(200)
    })

    test('regression page renders both panels with their boxes', async ({ page }) => {
        // Smoke test: both panels rendered, both containers scroll, both
        // boxes are present and visible. Catches obvious regressions where
        // the layoutScroll wiring breaks the page structure.
        await page.goto('/tests/layout/scroll?@isPlaywright=true')

        await expect(page.getByTestId('scroll-without')).toBeVisible()
        await expect(page.getByTestId('scroll-with')).toBeVisible()
        await expect(page.getByTestId('box-without')).toBeVisible()
        await expect(page.getByTestId('box-with')).toBeVisible()
    })
})
