/**
 * Port of Motion's `tests/react/reorder-lazy-motion.spec.ts` @ v14.7.1 (#2232).
 *
 * `Reorder` from the `m` entry renders `m` components, so it gets drag and
 * layout from LazyMotion instead of always having them. Inside a strict
 * LazyMotion it reorders, doesn't log the strict-mode warning or throw, and
 * with async features is inert until they load.
 *
 * Upstream injects a `process` global so motion-utils' dev warnings fire;
 * svelte-motion's warnings use `esm-env`'s `DEV`, and the e2e server is a
 * production build, so there is nothing to inject. The no-warning check is
 * also covered in development by
 * `src/lib/components/Reorder/lazyMotion.component.spec.ts`.
 */
import { expect, test, type Page } from '@playwright/test'

const order = (page: Page) =>
    page.locator('li').evaluateAll((items) => items.map((item) => item.getAttribute('data-testid')))

async function dragFirstDown(page: Page) {
    const { x, y } = (await page.getByTestId('a').boundingBox())!
    await page.mouse.move(x + 10, y + 10)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) {
        await page.mouse.move(x + 10, y + 10 + i * 10)
        await page.waitForTimeout(20)
    }
    await page.mouse.up()
    await page.waitForTimeout(300)
}

for (const features of ['sync', 'async']) {
    test(`Reorder (m) reorders inside LazyMotion strict (${features} features)`, async ({
        page
    }) => {
        const messages: string[] = []
        const pageErrors: string[] = []
        page.on('console', (msg) => messages.push(msg.text()))
        page.on('pageerror', (error) => {
            messages.push(error.message)
            pageErrors.push(error.message)
        })

        await page.goto(`/tests/lazy-motion/reorder-m?@isPlaywright=true&features=${features}`)
        await expect(page.getByTestId('c')).toBeVisible()
        await page.waitForTimeout(200)

        if (features === 'async') {
            await dragFirstDown(page)
            expect(await order(page)).toEqual(['a', 'b', 'c'])

            await page.evaluate(() =>
                (window as Window & { loadFeatures?: () => void }).loadFeatures?.()
            )
            await page.waitForTimeout(100)
        }

        await dragFirstDown(page)
        expect(await order(page)).toEqual(['b', 'a', 'c'])

        expect(messages.filter((text) => text.includes('LazyMotion'))).toEqual([])
        expect(pageErrors).toEqual([])
    })
}
