import { expect, test, type Locator } from '@playwright/test'

/**
 * Gesture callbacks receive Motion's arguments (plan 014).
 *
 * Upstream `framer-motion/src/gestures/hover.ts:14-34` and `gestures/press.ts:35-52`
 * call `(event, extractEventInfo(event))`; `motion/features/viewport/index.ts:57-63`
 * calls the viewport callbacks with the IntersectionObserverEntry (v14.14.0).
 * Tester page: `/tests/motion/gesture-callback-args`.
 */

/** Integer page coordinates of `target`'s centre (`window.scrollY` is 0). */
const centreOf = async (target: Locator) => {
    const bounds = await target.boundingBox()
    if (!bounds) throw new Error('no bounding box')
    return {
        cx: Math.round(bounds.x + bounds.width / 2),
        cy: Math.round(bounds.y + bounds.height / 2)
    }
}

/** No page error from a callback reading an argument that was not passed. */
const expectNoArgumentErrors = (errors: string[]) => {
    expect(errors.filter((message) => message.includes('Cannot read properties'))).toEqual([])
}

test.describe('gesture callback arguments', () => {
    let errors: string[]

    test.beforeEach(async ({ page }) => {
        errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto('/tests/motion/gesture-callback-args?@isPlaywright=true')
        for (const id of ['hover-box', 'tap-box', 'in-view-box']) {
            await expect(page.getByTestId(id)).toHaveAttribute('data-is-loaded', 'ready')
        }
    })

    test('hover callbacks get the event and its page point', async ({ page }) => {
        const { cx, cy } = await centreOf(page.getByTestId('hover-box'))
        await page.mouse.move(cx, cy)
        await expect(page.getByTestId('hover-start')).toHaveText(`pointerenter ${cx},${cy}`)

        await page.mouse.move(5, 5)
        await expect(page.getByTestId('hover-end')).toHaveText(/^pointerleave /)

        expectNoArgumentErrors(errors)
    })

    test('tap callbacks get the press and release events', async ({ page }) => {
        const { cx, cy } = await centreOf(page.getByTestId('tap-box'))
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.up()

        await expect(page.getByTestId('tap-start')).toHaveText(`pointerdown ${cx},${cy}`)
        await expect(page.getByTestId('tap')).toHaveText(`pointerup ${cx},${cy}`)

        expectNoArgumentErrors(errors)
    })

    test('onViewportEnter gets the entry and the alias still fires', async ({ page }) => {
        await expect(page.getByTestId('viewport-enter')).toHaveText('true in-view-box')
        await expect(page.getByTestId('alias-starts')).toHaveText('1')

        expectNoArgumentErrors(errors)
    })
})
