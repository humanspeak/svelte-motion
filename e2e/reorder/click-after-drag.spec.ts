import { expect, test, type Page } from '@playwright/test'

/**
 * Port of Motion's `tests/react/issue-2682.spec.ts` @ v14.2.0.
 *
 * #2682: whether a Reorder.Item's click fired after a drag depended on the
 * drag direction. Dragging the upper item down fired nothing (the item's node
 * moved mid-press, so Chrome dropped the click), while dragging the lower item
 * up fired the item's and the group's click. A release that ends a reordering
 * drag shouldn't click anything either way, but other clicks should.
 */
const dragBy = async (page: Page, testId: string, dy: number) => {
    const box = await page.getByTestId(testId).boundingBox()
    if (!box) throw new Error(`no bounding box for ${testId}`)
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) {
        await page.mouse.move(x, y + (dy * i) / 10)
        await page.waitForTimeout(20)
    }
    await page.mouse.up()
    await page.waitForTimeout(500)
}

test.describe('reorder/click-after-drag (#2682)', () => {
    test('a reordering release clicks nothing, whichever way the item is dragged', async ({
        page
    }) => {
        await page.goto('/tests/reorder/click-after-drag?@isPlaywright=true')
        await page.getByTestId('item-a').waitFor({ state: 'visible' })
        await page.waitForTimeout(200)

        // Drag the upper item below the lower item
        await dragBy(page, 'item-a', 100)
        await expect(page.getByTestId('order')).toHaveText('b,a')
        const afterDown = await page.getByTestId('clicks').innerText()

        // Drag the (now) lower item back above the upper item
        await dragBy(page, 'item-a', -100)
        await expect(page.getByTestId('order')).toHaveText('a,b')
        const afterUp = await page.getByTestId('clicks').innerText()

        expect(afterUp).toBe(afterDown)
        expect(afterUp).toBe('')

        // A drag that doesn't reorder still clicks, as it always has
        await dragBy(page, 'item-b', -20)
        await expect(page.getByTestId('order')).toHaveText('a,b')
        await expect(page.getByTestId('clicks')).toHaveText('b,group')

        // And so does a plain click
        await page.getByTestId('item-a').click()
        await expect(page.getByTestId('clicks')).toHaveText('b,group,a,group')
    })
})
