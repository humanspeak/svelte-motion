/**
 * Shared helpers for the pinch Playwright specs, ported from upstream Motion
 * v14.12.0: `frames` and `rect` from `tests/gestures/drag-helpers.ts`, and
 * `touch` and `twoFinger` from `tests/gestures/pinch.spec.ts`. `touch` takes
 * an optional `id` per point, as in `tests/react/pinch.spec.ts`.
 *
 * Touches go through CDP `Input.dispatchTouchEvent`, so Chromium produces
 * real touch pointer events (hit testing, implicit capture, touch-action).
 */
import type { CDPSession, Page } from '@playwright/test'

/** A touch point in viewport coordinates, with an optional pointer id. */
export type Touch = { x: number; y: number; id?: number }

/** A rounded `getBoundingClientRect()`. */
export interface Rect {
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
}

/**
 * Waits for `count` animation frames in the page.
 *
 * @param page The page to wait in.
 * @param count How many frames to wait.
 * @returns A promise that resolves after the frames.
 */
export function frames(page: Page, count = 2) {
    return page.evaluate(
        (n) =>
            new Promise<void>((resolve) => {
                const tick = (i: number) =>
                    i <= 0 ? resolve() : requestAnimationFrame(() => tick(i - 1))
                tick(n)
            }),
        count
    )
}

/**
 * Reads an element's bounding rect, rounded to 2 decimals.
 *
 * @param page The page the element is in.
 * @param selector A selector matching exactly one element.
 * @returns The element's rounded rect.
 */
export function rect(page: Page, selector: string): Promise<Rect> {
    return page.locator(selector).evaluate((el) => {
        const { left, top, right, bottom, width, height } = el.getBoundingClientRect()
        const r = (v: number) => Math.round(v * 100) / 100
        return {
            left: r(left),
            top: r(top),
            right: r(right),
            bottom: r(bottom),
            width: r(width),
            height: r(height)
        }
    })
}

/**
 * Dispatches one CDP touch event. For `touchEnd`, `points` are the touches
 * that lift.
 *
 * @param cdp A CDP session for the page.
 * @param type The touch event type.
 * @param points The touch points; each id defaults to its index.
 * @returns The CDP send promise.
 */
export function touch(
    cdp: CDPSession,
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: Touch[]
) {
    return cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map(({ x, y, id }, index) => ({ x, y, id: id ?? index }))
    })
}

/**
 * Puts two touches down, moves them to `to` in a few steps, then lifts them.
 *
 * @param page The page to pinch in.
 * @param from Where the two touches land.
 * @param to Where the two touches end up.
 * @param options `steps`: how many moves; `lift`: whether to lift at the end.
 * @returns The CDP session, so a caller that passes `lift: false` can go on.
 */
export async function twoFinger(
    page: Page,
    from: [Touch, Touch],
    to: [Touch, Touch],
    { steps = 5, lift = true } = {}
) {
    const cdp = await page.context().newCDPSession(page)
    await touch(cdp, 'touchStart', from)
    await frames(page, 2)

    for (let i = 1; i <= steps; i++) {
        const p = i / steps
        await touch(
            cdp,
            'touchMove',
            from.map((f, j) => ({
                x: f.x + (to[j].x - f.x) * p,
                y: f.y + (to[j].y - f.y) * p
            }))
        )
        await frames(page, 1)
    }
    await frames(page, 2)

    if (lift) {
        await touch(cdp, 'touchEnd', [])
        await frames(page, 2)
    }
    return cdp
}
