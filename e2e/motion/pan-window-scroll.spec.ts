import { expect, test, type Page } from '@playwright/test'

/**
 * Window scroll during a held pan.
 *
 * Upstream `PanSession` reports page coordinates (`extractEventInfo` reads
 * `pageX`/`pageY`), so a pointermove after the window scrolled carries the
 * scroll in `info.point` (motion-dom `gestures/pan/PanSession.ts:283-298` @
 * v14.5.0). `PanGesture` builds the session without `element`
 * (framer-motion `gestures/pan/index.ts:24-33`), so there is no extra
 * scroll-listener compensation on top of that.
 */

const waitFrames = (page: Page, count: number) =>
    page.evaluate(
        (n) =>
            new Promise<void>((resolve) => {
                let left = n
                const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick))
                requestAnimationFrame(tick)
            }),
        count
    )

const readPointY = async (page: Page) => {
    const raw = await page.getByTestId('pan-window-scroll-card').getAttribute('data-point-y')
    return raw ? Number(raw) : null
}

test.describe('motion/pan during window scroll', () => {
    test('info.point follows the page when the window scrolls mid-pan', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 })
        await page.goto('/tests/motion/pan-window-scroll?@isPlaywright=true')
        const card = page.getByTestId('pan-window-scroll-card')
        await expect(card).toBeVisible()

        const box = await card.boundingBox()
        if (!box) throw new Error('Expected visible card')
        const x = box.x + box.width / 2
        const y = box.y + box.height / 2

        // 1. Press, move 20 px, and hold still.
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x, y + 10)
        await page.mouse.move(x, y + 20)
        await expect.poll(() => readPointY(page)).not.toBeNull()
        await waitFrames(page, 2)
        const before = await readPointY(page)
        const countBefore = Number(await card.getAttribute('data-pan-count'))
        expect(before).not.toBeNull()

        // 2. Scroll the window by 100 px and wait 2 frames.
        await page.evaluate(() => window.scrollBy(0, 100))
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(100)
        await waitFrames(page, 2)

        // 3. One 0-px pointermove (same viewport coordinates).
        await page.mouse.move(x, y + 20)
        await expect
            .poll(async () => Number(await card.getAttribute('data-pan-count')))
            .toBeGreaterThan(countBefore)
        await waitFrames(page, 2)

        // 4. Page coordinates follow the scroll: point.y grew by ~100.
        const after = await readPointY(page)
        expect(after! - before!).toBeGreaterThanOrEqual(98)
        expect(after! - before!).toBeLessThanOrEqual(102)

        await page.mouse.up()
    })

    test('drag and onPan co-attach: the element moves and onPan fires', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 })
        await page.goto('/tests/motion/pan-window-scroll?@isPlaywright=true')
        const card = page.getByTestId('pan-drag-coattach-card')
        await expect(card).toBeVisible()
        const box = await card.boundingBox()
        if (!box) throw new Error('Expected visible card')
        const x = box.x + box.width / 2
        const y = box.y + box.height / 2

        await page.mouse.move(x, y)
        await page.mouse.down()
        for (let i = 1; i <= 6; i++) {
            await page.mouse.move(x + i * 10, y + i * 5)
            await waitFrames(page, 1)
        }
        await page.mouse.up()
        await waitFrames(page, 2)

        await expect
            .poll(async () => Number(await card.getAttribute('data-pan-count')))
            .toBeGreaterThan(0)
        const after = await card.boundingBox()
        expect(after!.x - box.x).toBeGreaterThan(40)
        expect(after!.y - box.y).toBeGreaterThan(20)
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(
            page.getByRole('link', { name: 'Pan: window scroll during a held pan' })
        ).toHaveAttribute('href', /\/tests\/motion\/pan-window-scroll/)
    })
})
