import { expect, test, type Page } from '@playwright/test'

/**
 * Spike 006 acceptance test: a drag that starts from a CSS-variable or
 * percentage `y` must not jump.
 *
 * Port of upstream motion v14.5.0 `tests/react/issue-2390.spec.ts` (#2390). The
 * box is 400px tall and `--slide-to` is `20%`, so it rests at y = 80px. Dragging
 * it 50px down must put it at ~130px, never jumping away from the pointer.
 */

const variants = [
    ['animate to var(--slide-to)', 'animate'],
    ['style-bound MotionValue var(--slide-to)', 'mv-var'],
    ['style-bound MotionValue 20%', 'mv-percent']
] as const

const top = (page: Page) => page.getByTestId('box').evaluate((el) => el.getBoundingClientRect().top)

for (const [name, variant] of variants) {
    test(`drag/css-variable-origin: drag from ${name} doesn't jump`, async ({ page }) => {
        await page.goto(`/tests/drag/css-variable-origin?@isPlaywright=true&variant=${variant}`)
        const box = page.getByTestId('box')
        await expect(box).toBeVisible()
        await page.waitForTimeout(1000)

        const before = await top(page)
        expect(before).toBeCloseTo(80, 0)

        const handle = await page.getByTestId('handle').boundingBox()
        if (!handle) throw new Error('no handle')
        const x = handle.x + handle.width / 2
        const y = handle.y + handle.height / 2
        await page.mouse.move(x, y)
        await page.mouse.down()
        const positions: number[] = []
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(x, y + i * 5)
            await page.waitForTimeout(32)
            positions.push(await top(page))
        }
        const midDrag = await top(page)
        await page.mouse.up()

        // Box follows the pointer: 80 + 50 = 130.
        expect(midDrag).toBeCloseTo(130, -1)
        for (const p of positions) {
            expect(p).toBeGreaterThanOrEqual(before - 1)
            expect(p).toBeLessThanOrEqual(before + 51)
        }
    })
}
