import { expect, test, type Locator } from '@playwright/test'

/**
 * Port of upstream `packages/framer-motion/cypress/integration/layout-shared.ts`
 * → "Shared layout: component unmounts in a LayoutGroup" (Motion v13.4.5)
 * against `/tests/layout/layout-group-unmount` and
 * `/tests/layout/layout-group-unmount-list`.
 */
interface BoundingBox {
    top: number
    left: number
    width: number
    height: number
}

const bbox = (locator: Locator): Promise<BoundingBox> =>
    locator.evaluate((element) => {
        const { top, left, width, height } = element.getBoundingClientRect()
        return { top, left, width, height }
    })

/** Upstream's `expectBbox`: exact equality on left / top / width / height. */
async function expectBbox(locator: Locator, expected: BoundingBox) {
    await expect.poll(() => bbox(locator)).toEqual(expected)
}

test.describe('Shared layout: component unmounts in a LayoutGroup', () => {
    // Red on 2026-09-28: #b snaps to top 20 when #a unmounts instead of animating (expected frozen midpoint top 90). Plan 007 (LayoutGroup node groups) + Plan 006 (motion-dom 13.4.5) must turn this green.
    test.fail('Should trigger sibling animation when unmount', async ({ page }) => {
        await page.goto('/tests/layout/layout-group-unmount?@isPlaywright=true')
        await page.waitForTimeout(50)
        await page.locator('#a').dispatchEvent('click')
        await page.waitForTimeout(50)
        await expectBbox(page.locator('#b'), {
            top: 90,
            left: 20,
            width: 100,
            height: 100
        })
    })

    test("If a sibling's position relative to the parent has changed, it should remain at its position", async ({
        page
    }) => {
        await page.goto('/tests/layout/layout-group-unmount-list?@isPlaywright=true')
        await page.waitForTimeout(50)
        const initial = await bbox(page.locator('#b'))
        await page.locator('#a').dispatchEvent('click')
        await page.waitForTimeout(50)
        await expectBbox(page.locator('#b'), initial)
    })
})
