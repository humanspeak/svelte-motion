import { expect, test, type Page } from '@playwright/test'

/**
 * Port of upstream Cypress `drag-release-before-frame.ts` (Motion 13.4.5).
 *
 * Browsers flush a coalesced pointermove immediately before pointerup, so
 * the final move and the release often land in the same animation frame.
 * The dragged element must rest at the release point, and `onDragEnd`'s
 * offset must match it.
 */

type PointerStep = { type: string; x: number; y: number }

/**
 * Dispatch real PointerEvents on the draggable element. All steps run inside
 * one `page.evaluate`, so no animation frame can run between them.
 */
const pointer = (page: Page, steps: PointerStep[]) =>
    page.evaluate((events) => {
        const el = document.querySelector("[data-testid='draggable']")
        if (!el) throw new Error('draggable not found')
        for (const { type, x, y } of events) {
            el.dispatchEvent(
                new PointerEvent(type, {
                    clientX: x,
                    clientY: y,
                    isPrimary: true,
                    bubbles: true,
                    pointerId: 1,
                    button: 0,
                    pointerType: 'mouse'
                })
            )
        }
    }, steps)

const nextFrame = (page: Page) =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))))

const rect = (page: Page) =>
    page.getByTestId('draggable').evaluate((el) => {
        const { left, top } = el.getBoundingClientRect()
        return { left, top }
    })

const startDrag = async (page: Page) => {
    await page.goto('/tests/drag/release-before-frame?@isPlaywright=true')
    await page.getByTestId('draggable').waitFor({ state: 'visible' })
    await nextFrame(page)
    await nextFrame(page)

    const start = await rect(page)
    await pointer(page, [
        { type: 'pointerdown', x: start.left + 5, y: start.top + 5 },
        { type: 'pointermove', x: start.left + 15, y: start.top + 15 }
    ])
    await nextFrame(page)
    await nextFrame(page)

    const moved = await rect(page)
    expect(moved.left - start.left, 'x offset after first move').toBe(10)
    expect(moved.top - start.top, 'y offset after first move').toBe(10)
    return start
}

const expectRestingAt = async (
    page: Page,
    start: { left: number; top: number },
    x: number,
    y: number
) => {
    await nextFrame(page)
    await nextFrame(page)
    await expect(page.locator('#drag-end-offset')).toHaveText(`${x},${y}`)
    const rest = await rect(page)
    expect(rest.left - start.left, 'x offset at rest').toBe(x)
    expect(rest.top - start.top, 'y offset at rest').toBe(y)
}

test.describe('drag/release-before-frame', () => {
    test('applies a pointermove followed by pointerup within the same frame', async ({ page }) => {
        const start = await startDrag(page)

        await pointer(page, [
            { type: 'pointermove', x: start.left + 105, y: start.top + 105 },
            { type: 'pointerup', x: start.left + 105, y: start.top + 105 }
        ])

        await expectRestingAt(page, start, 100, 100)
    })

    test('applies a pointermove when a frame runs before pointerup', async ({ page }) => {
        const start = await startDrag(page)

        await pointer(page, [{ type: 'pointermove', x: start.left + 105, y: start.top + 105 }])
        await nextFrame(page)
        await pointer(page, [{ type: 'pointerup', x: start.left + 105, y: start.top + 105 }])

        await expectRestingAt(page, start, 100, 100)
    })
})
