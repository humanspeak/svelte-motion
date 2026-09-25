import { expect, test, type Page } from '@playwright/test'

const order = (page: Page) => page.getByTestId('order').textContent()

/** Drag a locator vertically by `dy` px in small steps so each move carries velocity. */
const dragVertically = async (page: Page, testId: string, dy: number) => {
    const item = page.getByTestId(testId)
    const box = await item.boundingBox()
    if (!box) throw new Error(`no bounding box for ${testId}`)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    const steps = Math.max(10, Math.round(Math.abs(dy) / 5))
    for (let i = 1; i <= steps; i++) {
        await page.mouse.move(cx, cy + (i * dy) / steps)
        await page.waitForTimeout(16)
    }
    await page.mouse.up()
}

test.describe('reorder/basic', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/reorder/basic?@isPlaywright=true')
        await page.getByTestId('item-tomato').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
    })

    test('renders the initial order', async ({ page }) => {
        expect(await order(page)).toBe('tomato,cucumber,cheese,lettuce')
    })

    test('drags an item down one slot to reorder', async ({ page }) => {
        // Row pitch is 54px (44px item + 10px margin); 60px crosses the
        // next item's center.
        await dragVertically(page, 'item-tomato', 60)
        expect(await order(page)).toBe('cucumber,tomato,cheese,lettuce')
    })

    test('drags an item up one slot to reorder', async ({ page }) => {
        await dragVertically(page, 'item-cheese', -60)
        expect(await order(page)).toBe('tomato,cheese,cucumber,lettuce')
    })

    test('crosses multiple positions in one gesture', async ({ page }) => {
        await dragVertically(page, 'item-tomato', 130)
        expect(await order(page)).toBe('cucumber,cheese,tomato,lettuce')
    })

    test('settles into the new slot after release', async ({ page }) => {
        const tomato = page.getByTestId('item-tomato')
        const cucumber = page.getByTestId('item-cucumber')
        const cucumberSlot = await cucumber.boundingBox()
        if (!cucumberSlot) throw new Error('no cucumber box')

        await dragVertically(page, 'item-tomato', 60)

        // Wait for the snap-to-origin settle animation to finish.
        let settled: { x: number; y: number } | null = null
        let lastY = NaN
        let stable = 0
        for (let i = 0; i < 30; i++) {
            await page.waitForTimeout(50)
            const bb = await tomato.boundingBox()
            if (!bb) continue
            if (!Number.isNaN(lastY) && Math.abs(bb.y - lastY) < 0.5) {
                stable++
                if (stable >= 3) {
                    settled = { x: bb.x, y: bb.y }
                    break
                }
            } else {
                stable = 0
            }
            lastY = bb.y
        }

        if (!settled) throw new Error('item never settled')
        // Tomato now occupies cucumber's old slot.
        expect(Math.abs(settled.y - cucumberSlot.y)).toBeLessThan(2)
        expect(Math.abs(settled.x - cucumberSlot.x)).toBeLessThan(2)
    })

    test('locks dragging to the group axis', async ({ page }) => {
        const tomato = page.getByTestId('item-tomato')
        const box = await tomato.boundingBox()
        if (!box) throw new Error('no box')
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(cx + i * 8, cy)
            await page.waitForTimeout(16)
        }
        const mid = await tomato.boundingBox()
        await page.mouse.up()

        if (!mid) throw new Error('no mid box')
        expect(Math.abs(mid.x - box.x)).toBeLessThan(1)
        expect(await order(page)).toBe('tomato,cucumber,cheese,lettuce')
    })
})

test('keeps a held item pinned during upward swaps after earlier reversals', async ({ page }) => {
    await page.goto('/tests/reorder/basic?@isPlaywright=true')
    await page.getByTestId('item-cucumber').waitFor({ state: 'visible' })
    await page.waitForTimeout(300)
    const groupBox = await page.getByTestId('reorder-group').boundingBox()
    const lettuceBox = await page.getByTestId('item-lettuce').boundingBox()
    if (!groupBox || !lettuceBox) throw new Error('missing reorder geometry')
    const groupTop = groupBox.y

    // Observe intermediate frames, not just the final order or release position.
    // A deferred layout commit used to paint the new slot with the old transform
    // for one frame, putting the held item exactly one 54px row above the pointer.
    await page.evaluate((halfHeight) => {
        const samples: { drift: number; order: string | null }[] = []
        let pointerY = 0
        let running = true
        const trackPointer = (event: PointerEvent) => {
            pointerY = event.clientY
        }
        document.addEventListener('pointermove', trackPointer)
        const sample = () => {
            if (!running) return
            setTimeout(() => {
                const item = document.querySelector<HTMLElement>('[data-testid="item-lettuce"]')
                if (!running || item?.dataset.svelteMotionDragActive !== 'true') return
                samples.push({
                    drift: item.getBoundingClientRect().top + halfHeight - pointerY,
                    order: document.querySelector('[data-testid="order"]')!.textContent
                })
            }, 0)
            requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
        Object.assign(window, {
            finishReorderFrameReview: () => {
                running = false
                document.removeEventListener('pointermove', trackPointer)
                return samples
            }
        })
    }, lettuceBox.height / 2)

    const dragPath = async (
        testId: string,
        legs: { targetY: number; delay: number; pause?: boolean }[],
        releaseDelay: number
    ) => {
        const box = await page.getByTestId(testId).boundingBox()
        if (!box) throw new Error(`no bounding box for ${testId}`)
        const x = box.x + box.width / 2
        let y = box.y + box.height / 2
        await page.mouse.move(x, y)
        await page.mouse.down()
        for (const { targetY, delay, pause } of legs) {
            const from = y
            const steps = Math.ceil(Math.abs(targetY - from) / 6)
            for (let i = 1; i <= steps; i++) {
                y = from + ((targetY - from) * i) / steps
                await page.mouse.move(x, y)
                if (delay) await page.waitForTimeout(delay)
            }
            if (pause) await page.waitForTimeout(50)
        }
        await page.mouse.up()
        await page.waitForTimeout(releaseDelay)
    }

    // Reduced from the first three gestures of the reproducible seed-603 case.
    // Reversals leave sibling layout observers active when Lettuce next swaps.
    await dragPath(
        'item-cucumber',
        [
            { targetY: groupTop + 142, delay: 16, pause: true },
            { targetY: groupTop + 104, delay: 0, pause: true },
            { targetY: groupTop + 63, delay: 0, pause: true }
        ],
        250
    )
    await dragPath(
        'item-cheese',
        [
            { targetY: groupTop + 140, delay: 8, pause: true },
            { targetY: groupTop + 102, delay: 8, pause: true },
            { targetY: groupTop + 61, delay: 16 }
        ],
        80
    )
    await dragPath(
        'item-lettuce',
        [
            { targetY: groupTop + 84, delay: 0 },
            { targetY: groupTop + 83, delay: 16 },
            { targetY: groupTop + 61, delay: 0 }
        ],
        0
    )

    const samples = await page.evaluate(() => {
        const reviewWindow = window as Window & {
            finishReorderFrameReview: () => { drift: number; order: string | null }[]
        }
        return reviewWindow.finishReorderFrameReview()
    })
    expect(samples.length).toBeGreaterThan(10)
    expect(new Set(samples.map(({ order }) => order)).size).toBeGreaterThan(1)
    // Input steps are at most 6px. Allow one update of latency, never a slot jump.
    expect(samples.filter(({ drift }) => Math.abs(drift) > 8)).toEqual([])
})
