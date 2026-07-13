import { expect, test, type Page } from '@playwright/test'

/**
 * Scroll-during-layout suite for Plan 004 (#437).
 *
 * Two `<motion.div layout>` boxes visible on load (above the fold) on a tall
 * page. A swap reverses their order, so each travels one row (~96px) and a
 * layout animation runs. Layout measurement is page-space and phase-cached
 * through the motion-dom projection node, so a viewport scroll between the
 * layout snapshot and the measurement can never masquerade as a layout delta:
 *
 *   1. No scroll → the swap animates (FLIP translate decays over frames).
 *   2. Viewport scrolled, then swap → still animates. This snapped under the
 *      old viewport-scroll suppression heuristic and was encoded here as a
 *      `test.fail()` known divergence; deleting the heuristic flipped it to a
 *      plain passing test.
 *   3. Element scrolled fully offscreen, swap, scroll back → the boxes end in
 *      the correct swapped slots with identity transforms, and scrolling back
 *      triggers no spurious animation replay. (Offscreen layout changes now
 *      animate like upstream instead of snapping; the animation completes
 *      offscreen and the scroll-back must not restart it.)
 */

const ROW_TRAVEL_MIN = 20 // a real FLIP for a ~96px row peaks well above this

/**
 * Sample the computed `matrix(...)` translateY of a selector every animation
 * frame for `ms` milliseconds, starting immediately. Returns the raw samples
 * so the caller can decide whether the element animated (intermediate,
 * decaying translate) or snapped (translate stays ~0).
 */
const sampleTranslateY = (page: Page, selector: string, ms: number): Promise<number[]> =>
    page.evaluate(
        ({ selector, ms }) =>
            new Promise<number[]>((resolve) => {
                const el = document.querySelector<HTMLElement>(selector)
                if (!el) {
                    resolve([])
                    return
                }
                const samples: number[] = []
                const start = performance.now()
                const read = () => {
                    const transform = getComputedStyle(el).transform
                    const m = transform.match(/matrix\(([^)]+)\)/)
                    let ty = 0
                    if (m) {
                        const parts = m[1].split(',').map((s) => Number.parseFloat(s.trim()))
                        ty = parts[5] ?? 0
                    }
                    samples.push(ty)
                    if (performance.now() - start < ms) requestAnimationFrame(read)
                    else resolve(samples)
                }
                requestAnimationFrame(read)
            }),
        { selector, ms }
    )

const animationSignal = (samples: number[]) => {
    const abs = samples.map((s) => Math.abs(s))
    const maxAbs = abs.length ? Math.max(...abs) : 0
    const intermediateFrames = abs.filter((v) => v > 5).length
    return { maxAbs, intermediateFrames }
}

const gotoDemo = async (page: Page) => {
    await page.goto('/tests/projection/scroll-during-layout?@isPlaywright=true')
    await page.getByTestId('box-0').waitFor({ state: 'visible' })
}

test.describe('projection/scroll-during-layout', () => {
    test('case 1: swap with no scroll animates the layout change', async ({ page }) => {
        await gotoDemo(page)

        // The boxes are above the fold, so no scroll is needed anywhere in
        // this case — a pure baseline for the FLIP. Let the initial-load
        // observers attach and settle first (same guard as case 2) so the
        // click can't race the layout effect on a cold preview server.
        await page.waitForTimeout(400)
        const swapPromise = page.getByTestId('toggle').click()
        const samples = await (async () => {
            await swapPromise
            return sampleTranslateY(page, '[data-testid="box-0"]', 450)
        })()

        const { maxAbs, intermediateFrames } = animationSignal(samples)
        expect(
            maxAbs,
            `box-0 should show a FLIP translate; samples=${JSON.stringify(samples)}`
        ).toBeGreaterThan(ROW_TRAVEL_MIN)
        expect(
            intermediateFrames,
            'at least a few frames should show intermediate translate'
        ).toBeGreaterThanOrEqual(3)
    })

    test('case 2: swap after a viewport scroll still animates', async ({ page }) => {
        await gotoDemo(page)

        // Let the initial-load layout observers settle so nothing else
        // commits between the scroll and the swap — this isolates "a viewport
        // scroll happened since the last layout commit" as the only variable
        // versus case 1.
        await page.waitForTimeout(400)

        // The boxes stay visible after this small scroll, but a `window`
        // scroll event fires between the last layout commit and the swap.
        // Page-space measurement makes that scroll cancel exactly, so the
        // swap animates just like case 1 (this snapped under the old
        // suppression heuristic).
        await page.evaluate(() => window.scrollBy(0, 60))
        await page.waitForTimeout(80)

        const swapPromise = page.getByTestId('toggle').click()
        const samples = await (async () => {
            await swapPromise
            return sampleTranslateY(page, '[data-testid="box-0"]', 450)
        })()

        const { maxAbs, intermediateFrames } = animationSignal(samples)
        expect(
            maxAbs,
            `box-0 animates after a viewport scroll; samples=${JSON.stringify(samples)}`
        ).toBeGreaterThan(ROW_TRAVEL_MIN)
        expect(intermediateFrames).toBeGreaterThanOrEqual(3)
    })

    test('case 3: swap while offscreen settles correctly with no spurious replay', async ({
        page
    }) => {
        await gotoDemo(page)

        // Record the boxes' page-space Y before the swap.
        const yBefore = await page.evaluate(() => {
            const b0 = document.querySelector('[data-testid="box-0"]')!.getBoundingClientRect()
            const b1 = document.querySelector('[data-testid="box-1"]')!.getBoundingClientRect()
            return { b0: b0.top + window.scrollY, b1: b1.top + window.scrollY }
        })

        // Scroll the boxes fully offscreen (to the bottom of the tall page)
        // and swap while they are not visible. Offscreen layout changes now
        // ANIMATE like upstream (the old heuristic snapped them), so give the
        // spring time to fully settle offscreen — this test pins down the
        // scroll-back REPLAY invariant, not the offscreen animation itself.
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.waitForTimeout(30)
        await page.getByTestId('toggle').click()
        await page.waitForTimeout(900)

        // Sample the transform WHILE scrolling back — a spurious FLIP replay
        // (a scroll masquerading as a layout delta) would spike translateY.
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.getByTestId('stage').scrollIntoViewIfNeeded()
        const scrollBackSamples = await sampleTranslateY(page, '[data-testid="box-0"]', 300)
        const spurious = animationSignal(scrollBackSamples)

        // Let everything settle.
        await page.waitForTimeout(300)

        const yAfter = await page.evaluate(() => {
            const b0 = document.querySelector('[data-testid="box-0"]')!.getBoundingClientRect()
            const b1 = document.querySelector('[data-testid="box-1"]')!.getBoundingClientRect()
            return { b0: b0.top + window.scrollY, b1: b1.top + window.scrollY }
        })
        const settledTy = animationSignal(await sampleTranslateY(page, '[data-testid="box-0"]', 60))

        // DESIRED: the order swapped (box-0 now sits where box-1 was),
        // transforms have settled to identity, and no spurious animation
        // replayed during scroll-back.
        expect(yAfter.b0, 'box-0 should occupy box-1 old slot').toBeCloseTo(yBefore.b1, -1)
        expect(yAfter.b1, 'box-1 should occupy box-0 old slot').toBeCloseTo(yBefore.b0, -1)
        expect(settledTy.maxAbs, 'box-0 transform settles to identity').toBeLessThan(2)
        expect(
            spurious.maxAbs,
            `no spurious FLIP replay on scroll-back; samples=${JSON.stringify(scrollBackSamples)}`
        ).toBeLessThan(ROW_TRAVEL_MIN)
    })

    test('page renders the toolbar, stage, and per-box readouts', async ({ page }) => {
        await gotoDemo(page)

        await expect(page.getByTestId('scroll-during-layout')).toBeVisible()
        await expect(page.getByTestId('toggle')).toBeVisible()
        await expect(page.getByTestId('stage')).toBeVisible()
        await expect(page.getByTestId('box-0')).toBeVisible()
        await expect(page.getByTestId('box-1')).toBeVisible()
    })
})
