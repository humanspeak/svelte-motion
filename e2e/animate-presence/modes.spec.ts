import { expect, test, type Locator, type Page } from '@playwright/test'

const gotoModes = async (page: Page) => {
    await page.goto('/tests/animate-presence/modes?@isPlaywright=true')
    await expect(page.getByTestId('switch-button')).toBeVisible()
    await expect(page.getByTestId('flow-right-sync')).toBeVisible()
}

const readX = async (locator: Locator): Promise<number> => {
    const box = await locator.boundingBox()
    return box?.x ?? Number.NaN
}

const readSyncOverlap = async (page: Page): Promise<{ overlap: number; opacity: number }> =>
    page.evaluate(() => {
        const mid = document.querySelector('[data-testid="flow-middle-sync"]')
        const right = document.querySelector('[data-testid="flow-right-sync"]')

        if (!mid || !right) return { overlap: 0, opacity: 0 }

        const midRect = mid.getBoundingClientRect()
        const rightRect = right.getBoundingClientRect()
        const opacity = Number(getComputedStyle(mid).opacity)
        const overlapX = Math.max(
            0,
            Math.min(midRect.right, rightRect.right) - Math.max(midRect.left, rightRect.left)
        )
        const overlapY = Math.max(
            0,
            Math.min(midRect.bottom, rightRect.bottom) - Math.max(midRect.top, rightRect.top)
        )

        return { overlap: overlapX * overlapY, opacity }
    })

const readOpacity = async (locator: Locator): Promise<number> =>
    locator.evaluate((el) => Number(getComputedStyle(el).opacity))

const framePoll = {
    timeout: 2000,
    intervals: Array.from({ length: 125 }, () => 16)
}
const layoutDeltaTolerance = 3

test.describe('AnimatePresence modes', () => {
    test('sync preserves exiting layout while popLayout reflows immediately', async ({ page }) => {
        await gotoModes(page)

        const switchButton = page.getByTestId('switch-button')
        const syncRight = page.getByTestId('flow-right-sync')
        const popLayoutRight = page.getByTestId('flow-right-popLayout')
        const syncMiddle = page.getByTestId('flow-middle-sync')
        const popLayoutMiddle = page.getByTestId('flow-middle-popLayout')

        const syncBefore = await syncRight.boundingBox()
        const popLayoutBefore = await popLayoutRight.boundingBox()

        expect(syncBefore).not.toBeNull()
        expect(popLayoutBefore).not.toBeNull()

        await switchButton.click()
        await expect(syncMiddle).toBeVisible({ timeout: 2000 })
        await expect(popLayoutMiddle).toBeVisible({ timeout: 2000 })
        await expect
            .poll(async () => popLayoutBefore!.x - (await readX(popLayoutRight)), framePoll)
            .toBeGreaterThan(8)

        const syncDelta = syncBefore!.x - (await readX(syncRight))
        const popLayoutDelta = popLayoutBefore!.x - (await readX(popLayoutRight))

        expect(syncDelta).toBeLessThanOrEqual(popLayoutDelta + layoutDeltaTolerance)
    })

    test('sync does not move layout siblings under a visible exiting child on repeated toggles', async ({
        page
    }) => {
        await gotoModes(page)

        const switchButton = page.getByTestId('switch-button')
        const syncRight = page.getByTestId('flow-right-sync')
        const expandedRightBox = await syncRight.boundingBox()
        expect(expandedRightBox).not.toBeNull()

        await switchButton.click()
        await expect(page.getByTestId('flow-middle-sync')).toHaveCount(0, { timeout: 2000 })
        const collapsedRightBox = await syncRight.boundingBox()
        expect(collapsedRightBox).not.toBeNull()

        await switchButton.click()
        const syncMiddle = page.getByTestId('flow-middle-sync')
        await expect(syncMiddle).toBeVisible({ timeout: 2000 })
        await expect.poll(async () => await readOpacity(syncMiddle), framePoll).toBeGreaterThan(0.5)
        await expect
            .poll(async () => await readX(syncRight), framePoll)
            .toBeGreaterThan(expandedRightBox!.x - 4)

        await switchButton.click()
        await expect
            .poll(async () => (await readSyncOverlap(page)).opacity, framePoll)
            .toBeGreaterThan(0.05)
        const overlap = await readSyncOverlap(page)

        expect(overlap.overlap).toBeLessThan(1)

        await expect(page.getByTestId('flow-middle-sync')).toHaveCount(0, { timeout: 2000 })
        await expect
            .poll(async () => await readX(syncRight), { timeout: 2000 })
            .toBeLessThan(collapsedRightBox!.x + 4)
        const finalCollapsedRightBox = await syncRight.boundingBox()

        expect(finalCollapsedRightBox).not.toBeNull()
    })

    test('sync animates layout siblings when an entering child pushes them over', async ({
        page
    }) => {
        await gotoModes(page)

        const switchButton = page.getByTestId('switch-button')
        const syncRight = page.getByTestId('flow-right-sync')
        const expandedRightBox = await syncRight.boundingBox()
        expect(expandedRightBox).not.toBeNull()

        await switchButton.click()
        await expect(page.getByTestId('flow-middle-sync')).toHaveCount(0, { timeout: 2000 })
        const collapsedRightBox = await syncRight.boundingBox()

        await switchButton.click()
        const enteringStartRightBox = await syncRight.boundingBox()
        const syncMiddle = page.getByTestId('flow-middle-sync')
        await expect(syncMiddle).toBeVisible({ timeout: 2000 })
        await expect
            .poll(async () => await readX(syncRight), framePoll)
            .toBeGreaterThan(collapsedRightBox!.x + 8)
        const enteringMovingRightBox = await syncRight.boundingBox()

        expect(collapsedRightBox).not.toBeNull()
        expect(enteringStartRightBox).not.toBeNull()
        expect(enteringMovingRightBox).not.toBeNull()
        expect(collapsedRightBox!.x).toBeLessThan(expandedRightBox!.x - 8)
        expect(enteringStartRightBox!.x).toBeLessThan(expandedRightBox!.x - 8)
        expect(enteringMovingRightBox!.x).toBeGreaterThan(collapsedRightBox!.x + 8)
    })
})
