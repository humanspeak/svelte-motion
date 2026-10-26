import { expect, test, type Page } from '@playwright/test'

/**
 * Port of upstream Motion #2255 (commit 9632e2c3d, tests/react/issue-2255.spec.ts
 * at v14.6.0): an item in a wrapping axis="x" Reorder group must never pick
 * up a translateY, during the drag or after it settles.
 */
const readApple = (page: Page) =>
    page.getByTestId('apple').evaluate((el: HTMLElement) => ({
        transform: el.style.transform,
        // Distance between where the item is drawn and its layout position
        offsetY:
            el.getBoundingClientRect().top -
            el.parentElement!.getBoundingClientRect().top -
            (el.offsetTop - el.parentElement!.offsetTop)
    }))

test.describe('reorder/wrap-axis-x (#2255)', () => {
    test('dragged item settles into its layout position with no leftover translateY', async ({
        page
    }) => {
        await page.goto('/tests/reorder/wrap-axis-x?@isPlaywright=true')
        const apple = page.getByTestId('apple')
        await apple.waitFor()

        // Drag "apple" horizontally far enough to move it into a later row
        const box = (await apple.boundingBox())!
        const x = box.x + 10
        const y = box.y + box.height / 2
        const dragTransforms: string[] = []
        await page.mouse.move(x, y)
        await page.mouse.down()
        for (let i = 1; i <= 20; i++) {
            await page.mouse.move(x + (220 * i) / 20, y)
            await page.waitForTimeout(30)
            dragTransforms.push((await readApple(page)).transform)
        }
        await page.mouse.up()

        await expect(page.getByTestId('order')).not.toHaveText(
            'apple,banana,kiwi,watermelon,fig,grape,pear'
        )

        // Once the snap-back animation has finished, the item sits at its
        // laid-out position: no y offset.
        await expect.poll(async () => (await readApple(page)).transform).toBe('none')
        const { transform, offsetY } = await readApple(page)
        expect(transform).not.toMatch(/translateY|translate3d/)
        expect(offsetY).toBeCloseTo(0, 0)

        // An axis="x" drag never moves the item on y, during the drag either
        for (const dragTransform of dragTransforms) {
            expect(dragTransform).not.toMatch(/translateY|translate3d/)
        }
    })
})
