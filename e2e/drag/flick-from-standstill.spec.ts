/**
 * Port of upstream `tests/react/issue-1747.spec.ts` (Motion 14.7.1).
 *
 * https://github.com/motiondivision/motion/issues/1747
 *
 * A short fast flick on a draggable element that is at a standstill should
 * hand the inertia animation a release velocity matching the flick, just as
 * the same flick does while a previous inertia animation is still running.
 *
 * From a standstill the release velocity used to collapse to ~0 (the pan
 * history's pointer-down point was stamped with the stale frameData
 * timestamp from the last frame before the frameloop went idle), so the
 * element appeared to decelerate abruptly as soon as the finger lifted.
 *
 * The flick: pointerdown, wait ~16ms, one 80px move up, release. That is
 * >1000px/s, so a correct release velocity is well below -500px/s.
 *
 * svelte-motion drives motion-dom's PanSession directly, so the fix arrives
 * with the motion-dom bump.
 */
import { expect, test, type CDPSession, type Page } from '@playwright/test'

type Input = 'mouse' | 'touch'

type FlickWindow = Window & {
    __moves: { y: number; t: number }[]
    __dragEnd: { velocity: number; t: number }[]
}

async function pointer(
    page: Page,
    cdp: CDPSession | null,
    type: 'down' | 'move' | 'up',
    x: number,
    y: number
) {
    if (cdp) {
        await cdp.send('Input.dispatchTouchEvent', {
            type: type === 'down' ? 'touchStart' : type === 'move' ? 'touchMove' : 'touchEnd',
            touchPoints: type === 'up' ? [] : [{ x, y }]
        })
    } else if (type === 'down') {
        await page.mouse.move(x, y)
        await page.mouse.down()
    } else if (type === 'move') {
        await page.mouse.move(x, y)
    } else {
        await page.mouse.up()
    }
}

async function flick(page: Page, cdp: CDPSession | null, steps: number, dist: number) {
    const before = await page.evaluate(() => (window as unknown as FlickWindow).__moves.length)
    let y = 500
    await pointer(page, cdp, 'down', 150, y)
    for (let i = 0; i < steps; i++) {
        await page.waitForTimeout(16)
        y -= dist
        await pointer(page, cdp, 'move', 150, y)
    }
    await pointer(page, cdp, 'up', 150, y)

    return page.evaluate(
        (before) =>
            new Promise<Record<string, number>>((resolve) => {
                const w = window as unknown as FlickWindow
                const box = document.querySelector('[data-testid="box"]')!
                const top = () => box.getBoundingClientRect().top
                const y0 = top()
                const t0 = performance.now()
                const sample = () => {
                    const t = performance.now()
                    if (t - t0 < 100) return requestAnimationFrame(sample)
                    const moves = w.__moves.slice(before)
                    resolve({
                        /**
                         * Velocity the pointer actually moved at, from
                         * pointerdown to the last pointermove.
                         */
                        actual:
                            ((moves[moves.length - 1].y - moves[0].y) /
                                (moves[moves.length - 1].t - moves[0].t)) *
                            1000,
                        // Release velocity handed to the inertia animation
                        reported: w.__dragEnd[w.__dragEnd.length - 1].velocity,
                        // Speed the element actually moves at after release
                        inertia: ((top() - y0) / (t - t0)) * 1000
                    })
                }
                requestAnimationFrame(sample)
            }),
        before
    )
}

async function setup(page: Page, input: Input) {
    await page.goto('/tests/drag/flick-from-standstill?@isPlaywright=true')
    await expect(page.getByTestId('box')).toBeVisible()
    const cdp = input === 'touch' ? await page.context().newCDPSession(page) : null
    // Let the frameloop go fully idle
    await page.waitForTimeout(500)
    return cdp
}

for (const input of ['mouse', 'touch'] as Input[]) {
    test.describe(`issue #1747 (${input})`, () => {
        test('control: fast flick while inertia is animating', async ({ page }) => {
            const cdp = await setup(page, input)
            await flick(page, cdp, 4, 30)
            // Flick again while the first flick's inertia is still running
            await page.waitForTimeout(100)
            const result = await flick(page, cdp, 1, 80)
            console.log(input, 'animating', result)
            expect(result.reported).toBeLessThan(-500)
            expect(result.inertia).toBeLessThan(-400)
        })

        test('fast flick from a standstill', async ({ page }) => {
            const cdp = await setup(page, input)
            const result = await flick(page, cdp, 1, 80)
            console.log(input, 'standstill', result)
            expect(result.reported).toBeLessThan(-500)
            expect(result.inertia).toBeLessThan(-400)
        })
    })
}
