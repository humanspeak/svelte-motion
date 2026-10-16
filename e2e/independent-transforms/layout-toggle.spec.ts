import { expect, test, type Page } from '@playwright/test'

/**
 * Turning `layout` / `layoutId` off and back on is a mount, not an update.
 *
 * Upstream renders `MeasureLayout` only while `layout`, `layoutId` or `drag`
 * is set (framer-motion `packages/framer-motion/src/motion/index.tsx`
 * @ `v14.2.0`, 205-219), so re-enabling mounts it again: `componentDidMount`
 * never calls `willUpdate()` (`motion/features/layout/MeasureLayout.tsx`,
 * 39-65). A mount-time `willUpdate()` would demote Motion 14.2's accelerated
 * transforms and snapshot the element. Against
 * `src/routes/tests/independent-transforms/layout-toggle/+page.svelte`.
 */

type ToggleWindow = {
    countTransformAnimations: (id: string) => number
    toggleOffOn: () => Promise<void>
    reenableAndWiden: (frames: number) => Promise<number[]>
}

const count = (page: Page, id: string) =>
    page.evaluate((id) => (window as unknown as ToggleWindow).countTransformAnimations(id), id)

test.describe('re-enabling layout is a mount', () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/independent-transforms/layout-toggle?@isPlaywright=true')
        await page.locator('#toggle-widen').waitFor({ state: 'attached' })
        await page.waitForTimeout(200)
    })

    for (const id of ['toggle-layout', 'toggle-layout-id']) {
        test(`${id} stays accelerated when it is turned off and back on mid-animation`, async ({
            page
        }) => {
            expect(await count(page, id), `#${id} before toggling`).toBe(1)
            await page.evaluate(() => (window as unknown as ToggleWindow).toggleOffOn())

            // `x` runs for 2s from mount; these samples all land mid-flight.
            let elapsed = 0
            for (const at of [50, 200, 400]) {
                await page.waitForTimeout(at - elapsed)
                elapsed = at
                expect(await count(page, id), `#${id} ${at} ms after re-enabling`).toBe(1)
            }
        })
    }

    test('a widen in the same update as re-enabling layout does not animate', async ({ page }) => {
        const widths = await page.evaluate(() =>
            (window as unknown as ToggleWindow).reenableAndWiden(8)
        )
        const trace = JSON.stringify(widths.map(Math.round))

        expect(Math.abs(widths[0] - 300), `widths ${trace}`).toBeLessThanOrEqual(2)
        for (const width of widths) {
            expect(Math.abs(width - 300), `widths ${trace}`).toBeLessThanOrEqual(2)
        }
    })
})
