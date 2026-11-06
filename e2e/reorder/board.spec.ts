/**
 * `Reorder.Board` (Motion 14.10): port of upstream
 * `packages/framer-motion/cypress/integration/reorder-board.ts` at v14.10.1,
 * against `src/routes/tests/reorder/board` (upstream `reorder-board.tsx`).
 *
 * Pointer events are dispatched at viewport points, a frame at a time, as
 * upstream does. Moves and releases go to the body: a dragged item moved to
 * another group is a new element, and the gesture listens on the window.
 *
 * Skipped: "moves a grabbed item between groups with the arrow keys" (the
 * keyboard path is plan 007's).
 */
import { expect, test, type Page } from '@playwright/test'

interface Point {
    x: number
    y: number
}

const pointer = (page: Page, target: string, type: string, { x, y }: Point) =>
    page.evaluate(
        ([target, type, x, y]) => {
            const element =
                target === 'body'
                    ? document.body
                    : document.querySelector(`[data-testid='${target}']`)!
            element.dispatchEvent(
                new PointerEvent(type, {
                    clientX: x,
                    clientY: y,
                    isPrimary: true,
                    bubbles: true,
                    pointerId: 1,
                    button: 0,
                    buttons: type === 'pointerup' ? 0 : 1,
                    pointerType: 'mouse'
                })
            )
        },
        [target, type, x, y] as const
    )

const nextFrame = (page: Page) =>
    page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))

const rect = (page: Page, id: string) =>
    page.getByTestId(id).evaluate((element) => {
        const { left, top, right, width, height } = element.getBoundingClientRect()
        return { left, top, right, width, height }
    })

const centre = async (page: Page, id: string): Promise<Point> => {
    const { left, top, width, height } = await rect(page, id)
    return { x: left + width / 2, y: top + height / 2 }
}

const scale = (page: Page, id: string) =>
    page.getByTestId(id).evaluate((element) => {
        const { transform } = getComputedStyle(element)
        if (transform === 'none') return 1
        const [a, b] = transform.match(/-?[\d.e]+/g)!.map(Number)
        return Math.hypot(a, b)
    })

const parentId = (page: Page, id: string) =>
    page.getByTestId(id).evaluate((element) => element.parentElement!.dataset.testid)

const state = (page: Page) => page.getByTestId('state')
const drags = (page: Page) => page.getByTestId('drags')

/**
 * Move the pointer to `to` in `steps`, a frame at a time.
 */
async function moveTo(page: Page, from: Point, to: Point, steps: number) {
    for (let i = 1; i <= steps; i++) {
        await pointer(page, 'body', 'pointermove', {
            x: from.x + ((to.x - from.x) * i) / steps,
            y: from.y + ((to.y - from.y) * i) / steps
        })
        await nextFrame(page)
    }
}

const ready = async (page: Page) => {
    await page.getByTestId('a').waitFor({ state: 'visible' })
    await page.waitForTimeout(200)
    await nextFrame(page)
    await nextFrame(page)
}

test.describe('Reorder.Board', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/reorder/board?@isPlaywright=true')
        await ready(page)
    })

    test('drags an item into another group and carries on dragging it there', async ({ page }) => {
        // Just below d's centre: past d, before e
        const d = await centre(page, 'd')
        const target = { x: d.x, y: d.y + 15 }

        const start = await centre(page, 'a')
        await pointer(page, 'a', 'pointerdown', start)
        await moveTo(page, start, { x: start.x + 10, y: target.y }, 2)
        // Let whileDrag finish
        await page.waitForTimeout(400)
        expect(await scale(page, 'a')).toBeCloseTo(1.2, 2)

        await moveTo(page, { x: start.x + 10, y: target.y }, target, 10)

        await expect(state(page)).toHaveText('todo:b,c doing:d,a,e done:')
        await expect.poll(() => parentId(page, 'a')).toBe('doing')
        // Under the pointer, as dragged so far, rather than in its slot
        const moved = await centre(page, 'a')
        expect(Math.abs(moved.x - target.x)).toBeLessThanOrEqual(3)
        expect(Math.abs(moved.y - target.y)).toBeLessThanOrEqual(3)
        // Without whileDrag starting over
        expect(Math.abs((await scale(page, 'a')) - 1.2)).toBeLessThanOrEqual(0.02)

        // It carries on reordering in its new group, past e
        await moveTo(page, target, { x: target.x, y: target.y + 96 }, 8)
        await expect(state(page)).toHaveText('todo:b,c doing:d,e,a done:')

        await pointer(page, 'body', 'pointerup', { x: target.x, y: target.y + 96 })

        // It settles into its slot, after d and e, and its drag ends once.
        // The slot is measured from the group, as e may still be animating:
        // the group's padding, then two items and their margins.
        const slot = (await rect(page, 'doing')).top + 10 + 2 * 60
        await expect
            .poll(async () => Math.abs((await rect(page, 'a')).top - slot))
            .toBeLessThanOrEqual(1)
        await expect.poll(() => scale(page, 'a')).toBe(1)
        await expect(drags(page)).toHaveText('1,1')
    })

    test('drags an item into an empty group', async ({ page }) => {
        const done = await rect(page, 'done')
        const target = { x: done.left + done.width / 2, y: done.top + 40 }

        const start = await centre(page, 'c')
        await pointer(page, 'c', 'pointerdown', start)
        await moveTo(page, start, target, 12)

        await expect(state(page)).toHaveText('todo:a,b doing:d,e done:c')
        await pointer(page, 'body', 'pointerup', target)

        const slot = (await rect(page, 'done')).top + 10
        await expect
            .poll(async () => Math.abs((await rect(page, 'c')).top - slot))
            .toBeLessThanOrEqual(1)
        await expect(drags(page)).toHaveText('1,1')
    })
})

test.describe('Reorder.Board in a scrolling board', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/reorder/board?overflow&@isPlaywright=true')
        await ready(page)
    })

    test("scrolls the board, not the item's column, to reach a column out of view", async ({
        page
    }) => {
        const start = await centre(page, 'a')
        const edge = { x: (await rect(page, 'board')).right - 20, y: start.y }
        await pointer(page, 'a', 'pointerdown', start)
        await moveTo(page, start, edge, 10)

        // Held by its edge, the board scrolls across to its end, passing
        // "done" under the item on the way. (Upstream's Cypress `should`
        // retries with the gesture held; keep frames coming meanwhile.)
        const board = page.getByTestId('board')
        await expect
            .poll(async () => {
                await pointer(page, 'body', 'pointermove', edge)
                await nextFrame(page)
                return board.evaluate(
                    (element) => element.scrollWidth - element.clientWidth - element.scrollLeft
                )
            })
            .toBeLessThanOrEqual(1)
        await expect(state(page)).toHaveText('todo:b,c doing:d,e done:a')

        // The columns, which scroll down, don't scroll across
        const columns = await page
            .locator("[data-testid='board'] > div")
            .evaluateAll((elements) => elements.map((element) => element.scrollLeft))
        expect(columns).toEqual([0, 0, 0])

        await pointer(page, 'body', 'pointerup', edge)
        const slot = (await rect(page, 'done')).top + 10
        await expect
            .poll(async () => Math.abs((await rect(page, 'a')).top - slot))
            .toBeLessThanOrEqual(1)
        await expect(drags(page)).toHaveText('1,1')
    })
})
