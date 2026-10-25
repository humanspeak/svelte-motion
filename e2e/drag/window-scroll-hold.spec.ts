import { expect, test, type Page } from '@playwright/test'

/**
 * Spike 006 acceptance test: scrolling the window while a drag is held still
 * keeps the element under the pointer.
 *
 * Ports the intent of upstream motion v14.5.0 `tests/gestures/drag-scroll.spec.ts`
 * ("keeps the element under a stationary pointer", window case) and the window
 * cases of `packages/motion-dom/src/gestures/pan/__tests__/PanSession.test.ts`.
 */

const frames = (page: Page, count = 2) =>
    page.evaluate(
        (n) =>
            new Promise<void>((resolve) => {
                const tick = (i: number) =>
                    i <= 0 ? resolve() : requestAnimationFrame(() => tick(i - 1))
                tick(n)
            }),
        count
    )

const top = (page: Page) =>
    page.getByTestId('draggable').evaluate((el) => el.getBoundingClientRect().top)

test.describe('drag/window-scroll-hold', () => {
    test('a window scroll during a held drag keeps the element under the pointer', async ({
        page
    }) => {
        await page.goto('/tests/drag/window-scroll-hold?@isPlaywright=true')
        const el = page.getByTestId('draggable')
        await el.waitFor({ state: 'visible' })
        await frames(page, 2)

        const start = await el.boundingBox()
        if (!start) throw new Error('no box')
        const x = start.x + start.width / 2
        const y = start.y + start.height / 2

        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x, y + 10, { steps: 2 })
        await page.mouse.move(x, y + 20, { steps: 2 })
        await frames(page, 2)

        const grabbed = await top(page)
        expect(grabbed).toBeCloseTo(start.y + 20, -1)

        // Hold the pointer still and scroll the page under it.
        await page.evaluate(() => window.scrollBy(0, 100))
        await frames(page, 3)

        // The element must have moved down 100px with the page, i.e. its
        // viewport position is unchanged (still under the pointer).
        const afterScroll = await top(page)
        expect(Math.abs(afterScroll - grabbed)).toBeLessThanOrEqual(5)

        await page.mouse.up()
        await frames(page, 2)
        expect(Math.abs((await top(page)) - grabbed)).toBeLessThanOrEqual(5)
    })
})
