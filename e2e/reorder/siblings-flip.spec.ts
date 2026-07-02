import { expect, test } from '@playwright/test'

test.describe('reorder/siblings-flip', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/reorder/siblings-flip?@isPlaywright=true')
        await page.getByTestId('item-a').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
    })

    test('displaced sibling animates to its new slot during a live drag', async ({ page }) => {
        const a = page.getByTestId('item-a')
        const b = page.getByTestId('item-b')
        const aBox = await a.boundingBox()
        const bStart = await b.boundingBox()
        if (!aBox || !bStart) throw new Error('missing boxes')
        const cx = aBox.x + aBox.width / 2
        const cy = aBox.y + aBox.height / 2

        // Drag item A down past B's center (72px pitch), then HOLD.
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 8; i++) {
            await page.mouse.move(cx, cy + (i * 50) / 8)
            await page.waitForTimeout(16)
        }

        // While still holding, B FLIPs up into A's old slot: its box must
        // move over several frames (an animation), not jump in one.
        const samples: number[] = []
        for (let i = 0; i < 12; i++) {
            await page.waitForTimeout(40)
            const bb = await b.boundingBox()
            if (bb) samples.push(bb.y)
        }
        await page.mouse.up()

        expect(await page.getByTestId('order').textContent()).toBe('b,a,c')
        // B ends up at A's old slot...
        expect(Math.abs(samples[samples.length - 1] - aBox.y)).toBeLessThan(2)
        // ...and passed through intermediate positions on the way (≥4
        // distinct y values means it animated rather than teleporting).
        expect(new Set(samples.map((y) => Math.round(y))).size).toBeGreaterThanOrEqual(4)
    })

    test('dragged item paints above the sibling it displaces when dragged upward', async ({
        page
    }) => {
        const c = page.getByTestId('item-c')
        const cBox = await c.boundingBox()
        if (!cBox) throw new Error('no box')
        const cx = cBox.x + cBox.width / 2
        const cy = cBox.y + cBox.height / 2

        // Drag C up past B's center and HOLD. The swap moves C EARLIER in
        // the DOM, so without a working z-index the later-in-DOM B paints
        // over the dragged item while it FLIPs down through C's track.
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        let pointerY = cy
        for (let i = 1; i <= 12; i++) {
            pointerY = cy - (i * 50) / 12
            await page.mouse.move(cx, pointerY)
            await page.waitForTimeout(16)
        }
        await page.waitForTimeout(100)

        expect(await page.getByTestId('order').textContent()).toBe('a,c,b')
        // The dragged item must be the one under the pointer.
        const topAtPointer = await page.evaluate(
            ([x, y]) =>
                document
                    .elementFromPoint(x as number, y as number)
                    ?.closest('[data-testid]')
                    ?.getAttribute('data-testid'),
            [cx, pointerY]
        )
        await page.mouse.up()
        expect(topAtPointer).toBe('item-c')
    })

    test('dragged item stays pinned under the cursor through a swap', async ({ page }) => {
        const a = page.getByTestId('item-a')
        const aBox = await a.boundingBox()
        if (!aBox) throw new Error('no box')
        const cx = aBox.x + aBox.width / 2
        const cy = aBox.y + aBox.height / 2

        // Drag down through B's slot while sampling A's visual position:
        // the swap moves A's DOM node, and without origin compensation it
        // would teleport by a full slot pitch between frames.
        const samples: number[] = []
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 24; i++) {
            const pointerY = cy + (i * 100) / 24
            await page.mouse.move(cx, pointerY)
            await page.waitForTimeout(16)
            const bb = await a.boundingBox()
            if (bb) {
                // Drift between pointer and item center stays ~0 when pinned.
                samples.push(Math.abs(pointerY - (bb.y + bb.height / 2)))
            }
        }
        await page.mouse.up()

        expect(await page.getByTestId('order').textContent()).toBe('b,a,c')
        const maxDrift = Math.max(...samples)
        expect(maxDrift).toBeLessThan(10)
    })
})
