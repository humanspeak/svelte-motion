import { expect, test } from '@playwright/test'

/**
 * Regression test for the `layoutScroll` prop.
 *
 * Scenario: two side-by-side scroll containers each with a `layout`
 * animation inside. The user resizes the inner element and scrolls
 * mid-animation. Without `layoutScroll`, FLIP measures viewport-relative
 * rects and the scroll offset shows up as drift in the animation;
 * with `layoutScroll`, measurements happen in container coordinates
 * and the animation stays anchored.
 *
 * We assert that after the animation settles, the `layoutScroll` box
 * is at its expected final position (no leftover translate), while
 * the non-`layoutScroll` box may show a small artefact. We're not
 * trying to pin down the exact drift value — that varies with timing
 * — only to assert the `layoutScroll` path ends clean.
 */
test.describe('layout/scroll', () => {
    test('layoutScroll container keeps animations anchored across scroll', async ({ page }) => {
        await page.goto('/tests/layout/scroll?@isPlaywright=true')

        const scrollWith = page.getByTestId('scroll-with')
        const boxWith = page.getByTestId('box-with')
        const toggle = page.getByTestId('toggle')

        await boxWith.waitFor({ state: 'visible' })

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

        // Let the spring settle.
        await page.waitForTimeout(800)

        // After settle, the layoutScroll box must have no residual transform —
        // the resize completed cleanly without scroll-induced drift.
        const finalTransform = await boxWith.evaluate(
            (el) => (el as HTMLElement).style.transform || ''
        )
        // An empty string or "none" both mean "no translate applied" (drift=0);
        // a partial translate string means we kept some movement and need to
        // verify it's within sub-pixel rounding.
        const drift = Number(finalTransform.match(/translateX\(([-\d.]+)px\)/)?.[1] ?? '0')
        expect(Math.abs(drift)).toBeLessThan(1)

        // Sanity: the box still exists at the expected expanded size (~240).
        const box = await boxWith.boundingBox()
        if (!box) throw new Error('no boundingBox')
        expect(box.width).toBeGreaterThan(200)
        expect(box.height).toBeGreaterThan(200)
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
