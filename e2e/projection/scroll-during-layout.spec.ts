import { expect, test, type Page } from '@playwright/test'

/**
 * Characterization suite for Plan 004 (#437) — scroll-during-layout.
 *
 * Two `<motion.div layout>` boxes below the fold on a tall page. A swap
 * reverses their order, so each travels one row (~96px) and a layout
 * animation should run. These tests pin down how today's projection commit
 * path behaves when the viewport scrolls between the layout snapshot and the
 * measurement:
 *
 *   1. No scroll → the swap animates (FLIP translate decays over frames).
 *      PASSES today.
 *   2. Viewport scrolled, then swap → DESIRED (upstream page-space) behavior is
 *      that it still animates. Today the `wasViewportScrolledSinceLastLayout`
 *      heuristic SKIPS the animation and the boxes snap, so this asserts the
 *      desired outcome and is marked `test.fail()` — it is the encoded "known
 *      divergence". Flipping it to a plain passing test is the Step 4 gate.
 *   3. Element scrolled fully offscreen, swap, scroll back → DESIRED behavior is
 *      the boxes end in the correct swapped slots with identity transforms and
 *      no spurious animation replays on scroll-back. Verified empirically:
 *      today's offscreen heuristic already produces this outcome, so this stays
 *      a PLAIN passing test — the plan marks case 3 `test.fail()` only "if
 *      today's behavior differs", and it does not. It guards against a Step-4
 *      regression where removing the heuristic could re-introduce a spurious
 *      scroll-back animation.
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

        // The boxes are above the fold, so no scroll is needed — and no scroll
        // means the `wasViewportScrolledSinceLastLayout` heuristic never trips.
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
        // KNOWN DIVERGENCE (Plan 004): today's `wasViewportScrolledSinceLastLayout`
        // heuristic snaps the swap after any viewport scroll, so this fails. The
        // Step 4 gate is deleting the heuristic and removing this `test.fail()`.
        test.fail()
        await gotoDemo(page)

        // Let the initial-load layout observers settle first: an unsettled
        // ResizeObserver commit right after load can reset the scroll flag and
        // make this case animate spuriously. Once quiet, nothing else commits
        // between the scroll and the swap.
        await page.waitForTimeout(400)

        // The boxes are visible on load; a small viewport scroll keeps them
        // visible but fires a `window` scroll event since the last layout
        // commit. Today that sets `wasViewportScrolledSinceLastLayout` and the
        // swap snaps instead of animating.
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
            `DESIRED: box-0 animates after a viewport scroll; samples=${JSON.stringify(samples)}`
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

        // Scroll the boxes fully offscreen (to the bottom of the tall page),
        // swap while they are not visible, then scroll back to them.
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await page.waitForTimeout(30)
        await page.getByTestId('toggle').click()
        await page.waitForTimeout(30)

        // Sample the transform WHILE scrolling back — a spurious FLIP replay
        // would spike translateY here.
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
