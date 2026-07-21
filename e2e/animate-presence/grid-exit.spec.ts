import { expect, test, type Page } from '@playwright/test'
import { sampleRectLeftSeries, type RectLeftSample } from '../_helpers/transform'

/**
 * Regression coverage for exit-placeholder slot preservation in a CSS grid
 * (three `layout` cards inside `AnimatePresence`). Removing a card must:
 *
 * 1. Hold the exiting card's grid slot until its exit finishes — surviving
 *    cards do not move while the clone fades, and the clone fades in the
 *    card's CURRENT slot (not its registration-time slot).
 * 2. Then FLIP the survivors into their new slots — a smooth slide with
 *    intermediate frames, never an instant snap or a jump-then-return.
 *
 * Previously the placeholder was inserted before the whole AnimatePresence
 * `display: contents` container (always column 1), shoving every survivor a
 * column over during the exit and back after it.
 */

const SAMPLE_SELECTORS = {
    a: '[data-testid="card-a"]:not([data-clone])',
    b: '[data-testid="card-b"]:not([data-clone])',
    c: '[data-testid="card-c"]:not([data-clone])',
    clone: '[data-clone="true"]'
}

const gotoGridExit = async (page: Page) => {
    await page.goto('/tests/animate-presence/grid-exit?@isPlaywright=true')
    await expect(page.getByTestId('card-c')).toBeVisible()
    // Wait for enter animations to settle so FLIP measurements start clean.
    await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="card-c"]')
        if (!el) return false
        const tf = getComputedStyle(el).transform
        return tf === 'none' || tf === 'matrix(1, 0, 0, 1, 0, 0)'
    })
    await page.waitForTimeout(250)
}

/**
 * Click a remove button and record every tracked element's viewport left
 * edge each animation frame until the exit clone is gone and the layout
 * settles.
 */
const sampleRemoval = async (page: Page, buttonId: string): Promise<RectLeftSample[]> => {
    const samplesPromise = sampleRectLeftSeries(page, SAMPLE_SELECTORS, 1400)
    await page.waitForTimeout(30)
    await page.getByTestId(buttonId).click()
    return samplesPromise
}

const settledLeft = (samples: RectLeftSample[], key: string): number => {
    const last = samples[samples.length - 1].lefts[key]
    expect(last, `card-${key} should still be in the DOM`).not.toBeNull()
    return last as number
}

/** Frames captured while the exit clone was fading (the hold window). */
const holdFrames = (samples: RectLeftSample[]): RectLeftSample[] =>
    samples.filter((s) => s.lefts.clone !== null)

/** Frames captured after the exit finished (the FLIP window). */
const flipFrames = (samples: RectLeftSample[]): RectLeftSample[] => {
    const lastCloneIndex = samples.map((s) => s.lefts.clone !== null).lastIndexOf(true)
    return samples.slice(lastCloneIndex + 1)
}

const expectHeld = (frames: RectLeftSample[], key: string, at: number) => {
    expect(frames.length, 'exit clone should be observable while it fades').toBeGreaterThan(3)
    for (const frame of frames) {
        expect(
            Math.abs((frame.lefts[key] ?? Number.NaN) - at),
            `${key} must hold its slot while the exit runs (t=${frame.atMs}ms)`
        ).toBeLessThan(2)
    }
}

const expectSmoothSlide = (frames: RectLeftSample[], key: string, from: number, to: number) => {
    const lefts = frames.map((f) => f.lefts[key]).filter((l): l is number => l !== null)
    const min = Math.min(from, to)
    const max = Math.max(from, to)
    const intermediate = new Set(
        lefts.filter((l) => l > min + 2 && l < max - 2).map((l) => Math.round(l))
    )
    expect(
        intermediate.size,
        `${key} must animate ${from}→${to} through intermediate frames, not snap`
    ).toBeGreaterThanOrEqual(3)
    expect(Math.abs(lefts[lefts.length - 1] - to), `${key} must settle at ${to}`).toBeLessThan(2)
}

test.describe('AnimatePresence grid exit', () => {
    test('middle card exit: survivors hold, then the right card slides into the gap', async ({
        page
    }) => {
        await gotoGridExit(page)
        const a0 = await page.getByTestId('card-a').boundingBox()
        const b0 = await page.getByTestId('card-b').boundingBox()
        const c0 = await page.getByTestId('card-c').boundingBox()

        const samples = await sampleRemoval(page, 'remove-middle')
        const hold = holdFrames(samples)

        expectHeld(hold, 'a', a0!.x)
        expectHeld(hold, 'c', c0!.x)
        expectSmoothSlide(flipFrames(samples), 'c', c0!.x, b0!.x)
        expect(Math.abs(settledLeft(samples, 'a') - a0!.x)).toBeLessThan(2)
    })

    test('first card exit: both survivors hold, then slide left together', async ({ page }) => {
        await gotoGridExit(page)
        const a0 = await page.getByTestId('card-a').boundingBox()
        const b0 = await page.getByTestId('card-b').boundingBox()
        const c0 = await page.getByTestId('card-c').boundingBox()

        const samples = await sampleRemoval(page, 'remove-first')
        const hold = holdFrames(samples)

        expectHeld(hold, 'b', b0!.x)
        expectHeld(hold, 'c', c0!.x)
        expectSmoothSlide(flipFrames(samples), 'b', b0!.x, a0!.x)
        expectSmoothSlide(flipFrames(samples), 'c', c0!.x, b0!.x)
    })

    test('sequential removals: the exit clone fades in the current slot, not the registration slot', async ({
        page
    }) => {
        await gotoGridExit(page)
        const a0 = await page.getByTestId('card-a').boundingBox()
        const b0 = await page.getByTestId('card-b').boundingBox()

        // First removal: A exits, B slides into column 1, C into column 2.
        await page.getByTestId('remove-first').click()
        await expect
            .poll(async () => {
                const b = await page.getByTestId('card-b').boundingBox()
                const clones = await page.locator('[data-clone="true"]').count()
                return clones === 0 && Math.abs((b?.x ?? Number.NaN) - a0!.x) < 2
            })
            .toBe(true)
        await page.waitForTimeout(150)

        // Second removal: B (now first, sitting in column 1) exits. Its clone
        // must fade where B currently is — not at B's registration-time slot.
        const samples = await sampleRemoval(page, 'remove-first')
        const hold = holdFrames(samples)

        expectHeld(hold, 'clone', a0!.x)
        expectHeld(hold, 'c', b0!.x)
        expectSmoothSlide(flipFrames(samples), 'c', b0!.x, a0!.x)
    })

    test('last card exit: survivors never move', async ({ page }) => {
        await gotoGridExit(page)
        const a0 = await page.getByTestId('card-a').boundingBox()
        const b0 = await page.getByTestId('card-b').boundingBox()

        const samples = await sampleRemoval(page, 'remove-last')

        expectHeld(holdFrames(samples), 'a', a0!.x)
        expectHeld(holdFrames(samples), 'b', b0!.x)
        for (const frame of samples) {
            expect(Math.abs((frame.lefts.a ?? Number.NaN) - a0!.x)).toBeLessThan(2)
            expect(Math.abs((frame.lefts.b ?? Number.NaN) - b0!.x)).toBeLessThan(2)
        }
    })
})
