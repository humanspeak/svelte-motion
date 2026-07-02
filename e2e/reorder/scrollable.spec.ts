import { expect, test, type Page } from '@playwright/test'

const order = (page: Page) => page.getByTestId('order').textContent()

/** All items should sit on an exact slot pitch after any gesture. */
const expectConsistentPitch = async (page: Page, pitch: number) => {
    const ids = ((await order(page)) ?? '').split(',')
    const ys: number[] = []
    for (const id of ids) {
        const box = await page.getByTestId(`item-${id}`).boundingBox()
        if (!box) throw new Error(`no box for ${id}`)
        ys.push(box.y)
    }
    for (let i = 1; i < ys.length; i++) {
        expect(Math.abs(ys[i] - ys[i - 1] - pitch)).toBeLessThan(1.5)
    }
}

test.describe('reorder/scrollable', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/reorder/scrollable?@isPlaywright=true')
        await page.getByTestId('item-one').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
    })

    test('reorders correctly when the container is pre-scrolled', async ({ page }) => {
        const scroller = page.getByTestId('scroller')
        await scroller.evaluate((el) => {
            el.scrollTop = 120
        })
        await page.waitForTimeout(300)

        const four = page.getByTestId('item-four')
        const box = await four.boundingBox()
        const fiveSlot = await page.getByTestId('item-five').boundingBox()
        if (!box || !fiveSlot) throw new Error('missing boxes')
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 12; i++) {
            await page.mouse.move(cx, cy + (i * 66) / 12)
            await page.waitForTimeout(16)
        }
        await page.mouse.up()
        await page.waitForTimeout(800)

        expect(await order(page)).toBe('one,two,three,five,four,six,seven,eight')
        // The gesture must not disturb the scroll position…
        expect(await page.getByTestId('scroll-top').textContent()).toBe('120')
        // …and the dragged item settles exactly into the displaced slot.
        const after = await four.boundingBox()
        if (!after) throw new Error('no after box')
        expect(Math.abs(after.y - fiveSlot.y)).toBeLessThan(2)
        await expectConsistentPitch(page, 60)
    })

    test('auto-scrolls the container when dragging near its bottom edge', async ({ page }) => {
        const scroller = page.getByTestId('scroller')
        const sBox = await scroller.boundingBox()
        const two = page.getByTestId('item-two')
        const tBox = await two.boundingBox()
        if (!sBox || !tBox) throw new Error('missing boxes')
        const cx = tBox.x + tBox.width / 2
        const startY = tBox.y + tBox.height / 2
        const edgeY = sBox.y + sBox.height - 25 // inside the 50px threshold

        await page.mouse.move(cx, startY)
        await page.mouse.down()
        for (let i = 1; i <= 20; i++) {
            await page.mouse.move(cx, startY + ((edgeY - startY) * i) / 20)
            await page.waitForTimeout(16)
        }
        // Hold near the edge (1px jiggle keeps onDrag ticks flowing).
        for (let i = 0; i < 25; i++) {
            await page.mouse.move(cx, edgeY + (i % 2))
            await page.waitForTimeout(30)
        }
        const scrolled = await scroller.evaluate((el) => el.scrollTop)
        await page.mouse.up()
        await page.waitForTimeout(800)

        expect(scrolled).toBeGreaterThan(50)
        // The held item kept reordering as content scrolled beneath it.
        const ids = ((await order(page)) ?? '').split(',')
        expect(ids.indexOf('two')).toBeGreaterThan(2)
        await expectConsistentPitch(page, 60)
    })

    test('does not auto-scroll when dragging away from the edge zone', async ({ page }) => {
        const scroller = page.getByTestId('scroller')
        const two = page.getByTestId('item-two')
        const tBox = await two.boundingBox()
        if (!tBox) throw new Error('no box')
        const cx = tBox.x + tBox.width / 2
        const cy = tBox.y + tBox.height / 2

        // A small mid-container drag must leave scrollTop untouched.
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(cx, cy + i * 3)
            await page.waitForTimeout(16)
        }
        await page.mouse.up()
        await page.waitForTimeout(400)
        expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0)
    })
})

test.describe('reorder/page-scroll', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/reorder/page-scroll?@isPlaywright=true')
        await page.getByTestId('item-alpha').waitFor({ state: 'attached' })
        // Bring the group mid-viewport so the gesture stays clear of the
        // window's auto-scroll edge zones.
        await page.evaluate(() => window.scrollTo(0, 750))
        await page.waitForTimeout(400)
    })

    test('reorders exactly one slot with a non-zero window scroll', async ({ page }) => {
        // Regression: the viewport-scroll guard in commitObservedLayout
        // used to skip the dragged item's origin compensation after any
        // window scroll, double-firing the swap (beta jumped TWO slots).
        const beta = page.getByTestId('item-beta')
        const box = await beta.boundingBox()
        const gammaSlot = await page.getByTestId('item-gamma').boundingBox()
        if (!box || !gammaSlot) throw new Error('missing boxes')
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 12; i++) {
            await page.mouse.move(cx, cy + (i * 66) / 12)
            await page.waitForTimeout(16)
        }
        await page.mouse.up()
        await page.waitForTimeout(800)

        expect(await order(page)).toBe('alpha,gamma,beta,delta')
        // The gesture must not move the window…
        expect(await page.evaluate(() => window.scrollY)).toBe(750)
        // …and beta settles exactly into gamma's old slot.
        const after = await beta.boundingBox()
        if (!after) throw new Error('no after box')
        expect(Math.abs(after.y - gammaSlot.y)).toBeLessThan(2)
        await expectConsistentPitch(page, 60)
    })

    test('keeps positions consistent when the window scrolls mid-drag', async ({ page }) => {
        const beta = page.getByTestId('item-beta')
        const box = await beta.boundingBox()
        if (!box) throw new Error('no box')
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 5; i++) {
            await page.mouse.move(cx, cy + i * 4)
            await page.waitForTimeout(16)
        }
        // Wheel-scroll the window while the gesture is live.
        await page.mouse.wheel(0, 80)
        await page.waitForTimeout(150)
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(cx, cy + 20 + i * 3)
            await page.waitForTimeout(16)
        }
        await page.mouse.up()
        await page.waitForTimeout(900)

        // The order stays a valid permutation and every item lands on an
        // exact slot pitch — no scroll-offset "wack" in the positions.
        const ids = ((await order(page)) ?? '').split(',')
        expect([...ids].sort()).toEqual(['alpha', 'beta', 'delta', 'gamma'])
        await expectConsistentPitch(page, 60)
    })
})
