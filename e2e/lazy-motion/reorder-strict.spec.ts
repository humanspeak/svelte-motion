/**
 * Port of Motion's `tests/react/issue-2094.spec.ts` @ v14.7.1 (#2094).
 *
 * The main `Reorder` renders `motion` components, so within
 * `<LazyMotion strict>` it must neither throw nor stop reordering. Upstream
 * also asserts it warns exactly once with a fix. The warn-once assertion is
 * not made here: the e2e server is a production build and the warning is
 * development-only; `src/lib/components/Reorder/lazyMotion.component.spec.ts`
 * covers it.
 */
import { expect, test, type Page } from '@playwright/test'

const order = (page: Page) =>
    page.locator('li').evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')))

for (const features of ['sync', 'async']) {
    test(`Reorder inside LazyMotion strict (${features} features) keeps reordering`, async ({
        page
    }) => {
        const pageErrors: string[] = []
        page.on('pageerror', (error) => pageErrors.push(error.message))

        await page.goto(`/tests/lazy-motion/reorder-strict?@isPlaywright=true&features=${features}`)
        await expect(page.getByTestId('item-2')).toBeVisible()
        await page.waitForTimeout(200)

        // Drag the first item past the second, re-rendering every item
        const { x, y } = (await page.getByTestId('item-0').boundingBox())!
        await page.mouse.move(x + 10, y + 10)
        await page.mouse.down()
        for (let i = 1; i <= 8; i++) {
            await page.mouse.move(x + 10, y + 10 + i * 10)
            await page.waitForTimeout(20)
        }
        await page.mouse.up()
        await page.waitForTimeout(300)
        expect(await order(page)).toEqual(['item-1', 'item-0', 'item-2'])

        expect(pageErrors).toEqual([])
    })
}
