import { expect, test, type Page } from '@playwright/test'

/**
 * Plan 007 Step 4b-d against `/tests/layout/layout-group-interrupt`.
 *
 * #button lives in its own `<LayoutGroup inherit="id">` inside #text-wrapper,
 * so #text-wrapper's GROUP updates (an #expander toggle) must not snapshot
 * it. But clicking #button changes #text-wrapper's OWN subtree ("some text" →
 * "some longer text"): upstream re-renders the whole tree, every
 * MeasureLayout snapshots itself, and #button animates its own move to the
 * right within #text-wrapper. The port must do the same instead of jumping.
 */
interface Box {
    left: number
    offsetLeft: number
}

const measure = (page: Page): Promise<Box> =>
    page.evaluate(() => {
        const button = document.getElementById('button')!.getBoundingClientRect()
        const parent = document.getElementById('text-wrapper')!.getBoundingClientRect()
        return { left: button.left, offsetLeft: button.left - parent.left }
    })

test.describe('LayoutGroup inherit="id": own-subtree change', () => {
    test("a separate-group child animates its own move when its parent's subtree changes", async ({
        page
    }) => {
        await page.setViewportSize({ width: 500, height: 500 })
        await page.goto('/tests/layout/layout-group-interrupt?@isPlaywright=true')
        await page.locator('#button').waitFor({ state: 'visible' })
        await page.waitForTimeout(250)

        const initial = await measure(page)
        // Dispatched natively: the fixture's 10s animations never let
        // Playwright's actionability check see a stable element.
        await page.locator('#button').dispatchEvent('click')
        await page.waitForTimeout(1000)
        const mid = await measure(page)

        // The final slot (the DOM layout, read with the projection
        // transforms stripped) is further right ("some longer text"). One
        // second into the 10s linear animation #button must be partway there
        // relative to #text-wrapper, not already at the final offset.
        const settledOffset = await page.evaluate(() => {
            const button = document.getElementById('button')!
            const parent = document.getElementById('text-wrapper')!
            const prev = [button.style.transform, parent.style.transform]
            button.style.transform = parent.style.transform = 'none'
            const offset = button.getBoundingClientRect().left - parent.getBoundingClientRect().left
            ;[button.style.transform, parent.style.transform] = prev
            return offset
        })

        expect(settledOffset).toBeGreaterThan(initial.offsetLeft + 10)
        expect(mid.offsetLeft).toBeGreaterThan(initial.offsetLeft + 0.5)
        expect(mid.offsetLeft).toBeLessThan(settledOffset - 5)
    })
})
