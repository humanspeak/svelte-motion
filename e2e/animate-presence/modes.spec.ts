import { expect, test } from '@playwright/test'

test.describe('AnimatePresence modes', () => {
    test('sync preserves exiting layout while popLayout reflows immediately', async ({ page }) => {
        await page.goto('/tests/animate-presence/modes?@isPlaywright=true')
        await page.waitForTimeout(700)

        const switchButton = page.getByTestId('switch-button')
        const syncRight = page.getByTestId('flow-right-sync')
        const popLayoutRight = page.getByTestId('flow-right-popLayout')

        const syncBefore = await syncRight.boundingBox()
        const popLayoutBefore = await popLayoutRight.boundingBox()

        expect(syncBefore).not.toBeNull()
        expect(popLayoutBefore).not.toBeNull()

        await switchButton.click()
        await page.waitForTimeout(160)

        const syncDuringExit = await syncRight.boundingBox()
        const popLayoutDuringExit = await popLayoutRight.boundingBox()

        expect(syncDuringExit).not.toBeNull()
        expect(popLayoutDuringExit).not.toBeNull()

        const syncDelta = syncBefore!.x - syncDuringExit!.x
        const popLayoutDelta = popLayoutBefore!.x - popLayoutDuringExit!.x

        expect(syncDelta).toBeLessThan(4)
        expect(popLayoutDelta).toBeGreaterThan(8)
    })

    test('sync does not move layout siblings under a visible exiting child on repeated toggles', async ({
        page
    }) => {
        await page.goto('/tests/animate-presence/modes?@isPlaywright=true')
        await page.waitForTimeout(700)

        const switchButton = page.getByTestId('switch-button')
        const syncRight = page.getByTestId('flow-right-sync')
        const expandedRightBox = await syncRight.boundingBox()

        await switchButton.click()
        await page.waitForTimeout(900)
        await switchButton.click()
        await page.waitForTimeout(420)
        await switchButton.click()
        await page.waitForTimeout(40)

        const overlap = await page.evaluate(() => {
            const mid = document.querySelector('[data-testid="flow-middle-sync"]')
            const right = document.querySelector('[data-testid="flow-right-sync"]')

            if (!mid || !right) return 0

            const midRect = mid.getBoundingClientRect()
            const rightRect = right.getBoundingClientRect()
            const opacity = Number(getComputedStyle(mid).opacity)

            if (opacity <= 0.05) return 0

            const overlapX = Math.max(
                0,
                Math.min(midRect.right, rightRect.right) - Math.max(midRect.left, rightRect.left)
            )
            const overlapY = Math.max(
                0,
                Math.min(midRect.bottom, rightRect.bottom) - Math.max(midRect.top, rightRect.top)
            )

            return overlapX * overlapY
        })

        expect(overlap).toBeLessThan(1)

        await page.waitForTimeout(700)
        const animatingRightBox = await syncRight.boundingBox()

        await page.waitForTimeout(300)
        const collapsedRightBox = await syncRight.boundingBox()

        expect(expandedRightBox).not.toBeNull()
        expect(animatingRightBox).not.toBeNull()
        expect(collapsedRightBox).not.toBeNull()
        expect(animatingRightBox!.x).toBeLessThan(expandedRightBox!.x - 8)
        expect(animatingRightBox!.x).toBeGreaterThan(collapsedRightBox!.x + 8)
    })

    test('sync animates layout siblings when an entering child pushes them over', async ({
        page
    }) => {
        await page.goto('/tests/animate-presence/modes?@isPlaywright=true')
        await page.waitForTimeout(700)

        const switchButton = page.getByTestId('switch-button')
        const syncRight = page.getByTestId('flow-right-sync')
        const expandedRightBox = await syncRight.boundingBox()

        await switchButton.click()
        await page.waitForTimeout(900)

        const collapsedRightBox = await syncRight.boundingBox()
        await switchButton.click()
        await page.waitForTimeout(40)

        const enteringStartRightBox = await syncRight.boundingBox()
        await page.waitForTimeout(80)
        const enteringMovingRightBox = await syncRight.boundingBox()

        expect(expandedRightBox).not.toBeNull()
        expect(collapsedRightBox).not.toBeNull()
        expect(enteringStartRightBox).not.toBeNull()
        expect(enteringMovingRightBox).not.toBeNull()
        expect(collapsedRightBox!.x).toBeLessThan(expandedRightBox!.x - 8)
        expect(enteringStartRightBox!.x).toBeLessThan(expandedRightBox!.x - 8)
        expect(enteringMovingRightBox!.x).toBeGreaterThan(collapsedRightBox!.x + 8)
        expect(enteringMovingRightBox!.x).toBeLessThan(expandedRightBox!.x - 2)
    })
})
