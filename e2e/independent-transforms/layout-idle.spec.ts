import { expect, test, type Page } from '@playwright/test'

/**
 * Mounting a `layout` / `layoutDependency` / grouped `layoutId` element is not
 * a layout update, so its entry animation stays one accelerated WAAPI
 * `transform` animation while nothing changes layout (Motion 14.2).
 *
 * Upstream's `MeasureLayout` calls `willUpdate()` only in
 * `getSnapshotBeforeUpdate`, never in `componentDidMount` (framer-motion
 * `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx`
 * @ `v14.2.0`). Against
 * `src/routes/tests/independent-transforms/layout-idle/+page.svelte`.
 */

const count = (page: Page, id: string) =>
    page.evaluate(
        (id) =>
            (
                window as unknown as { countTransformAnimations: (id: string) => number }
            ).countTransformAnimations(id),
        id
    )

const ids = ['layout', 'layout-dependency', 'layout-id', 'control']

test.describe('layout elements at rest stay accelerated', () => {
    test.use({ viewport: { width: 500, height: 500 } })

    for (const id of ids) {
        test(`${id} stays accelerated when nothing changes layout`, async ({ page }) => {
            await page.goto('/tests/independent-transforms/layout-idle?@isPlaywright=true')
            await page.waitForSelector('#control', { state: 'attached' })

            // Samples at 150, 450 and 800 ms after mount.
            let elapsed = 0
            for (const at of [150, 450, 800]) {
                await page.waitForTimeout(at - elapsed)
                elapsed = at
                expect(await count(page, id), `#${id} at ${at} ms`).toBe(1)
            }
        })
    }
})
