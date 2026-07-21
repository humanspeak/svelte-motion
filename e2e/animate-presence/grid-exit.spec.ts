import { expect, test, type Page } from '@playwright/test'

/**
 * Regression coverage for exit-placeholder slot preservation in a CSS grid
 * (three `layout` cards inside `AnimatePresence`). Removing a card must:
 *
 * 1. Hold the exiting card's grid slot until its exit finishes — surviving
 *    cards do not move while the clone fades.
 * 2. Then FLIP the survivors into their new slots — a smooth slide with
 *    intermediate frames, never an instant snap or a jump-then-return.
 *
 * Previously the placeholder was inserted before the whole AnimatePresence
 * `display: contents` container (always column 1), shoving every survivor a
 * column over during the exit and back after it.
 */

type FrameSample = {
    t: number
    lefts: Record<string, number | null>
    cloneVisible: boolean
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
 * Click a remove button and record every card's viewport left edge each
 * animation frame until the exit clone is gone and the layout settles.
 */
const sampleRemoval = async (page: Page, buttonId: string): Promise<FrameSample[]> => {
    const samplesPromise = page.evaluate(
        () =>
            new Promise<FrameSample[]>((resolve) => {
                const out: FrameSample[] = []
                const t0 = performance.now()
                const sample = () => {
                    const lefts: Record<string, number | null> = {}
                    for (const id of ['a', 'b', 'c']) {
                        const el = document.querySelector(
                            `[data-testid="card-${id}"]:not([data-clone])`
                        )
                        lefts[id] = el ? el.getBoundingClientRect().left : null
                    }
                    const clone = document.querySelector('[data-clone="true"]')
                    out.push({
                        t: performance.now() - t0,
                        lefts,
                        cloneVisible: !!clone
                    })
                    if (performance.now() - t0 < 1400) requestAnimationFrame(sample)
                    else resolve(out)
                }
                requestAnimationFrame(sample)
            })
    )
    await page.waitForTimeout(30)
    await page.getByTestId(buttonId).click()
    return samplesPromise
}

const settledLeft = (samples: FrameSample[], id: string): number => {
    const last = samples[samples.length - 1].lefts[id]
    expect(last, `card-${id} should still be in the DOM`).not.toBeNull()
    return last as number
}

/** Frames captured while the exit clone was fading (the hold window). */
const holdFrames = (samples: FrameSample[]): FrameSample[] => samples.filter((s) => s.cloneVisible)

/** Frames captured after the exit finished (the FLIP window). */
const flipFrames = (samples: FrameSample[]): FrameSample[] => {
    const lastCloneIndex = samples.map((s) => s.cloneVisible).lastIndexOf(true)
    return samples.slice(lastCloneIndex + 1)
}

const expectHeld = (frames: FrameSample[], id: string, at: number) => {
    expect(frames.length, 'exit clone should be observable while it fades').toBeGreaterThan(3)
    for (const frame of frames) {
        expect(
            Math.abs((frame.lefts[id] ?? Number.NaN) - at),
            `card-${id} must hold its slot while the exit runs (t=${Math.round(frame.t)}ms)`
        ).toBeLessThan(2)
    }
}

const expectSmoothSlide = (frames: FrameSample[], id: string, from: number, to: number) => {
    const lefts = frames.map((f) => f.lefts[id]).filter((l): l is number => l !== null)
    const min = Math.min(from, to)
    const max = Math.max(from, to)
    const intermediate = new Set(
        lefts.filter((l) => l > min + 2 && l < max - 2).map((l) => Math.round(l))
    )
    expect(
        intermediate.size,
        `card-${id} must animate ${from}→${to} through intermediate frames, not snap`
    ).toBeGreaterThanOrEqual(3)
    expect(Math.abs(lefts[lefts.length - 1] - to), `card-${id} must settle at ${to}`).toBeLessThan(
        2
    )
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

        expectHeld(holdFrames(samples), 'a', a0!.x)
        expectHeld(holdFrames(samples), 'c', c0!.x)
        expectSmoothSlide(flipFrames(samples), 'c', c0!.x, b0!.x)
        expect(Math.abs(settledLeft(samples, 'a') - a0!.x)).toBeLessThan(2)
    })

    test('first card exit: both survivors hold, then slide left together', async ({ page }) => {
        await gotoGridExit(page)
        const a0 = await page.getByTestId('card-a').boundingBox()
        const b0 = await page.getByTestId('card-b').boundingBox()
        const c0 = await page.getByTestId('card-c').boundingBox()

        const samples = await sampleRemoval(page, 'remove-first')

        expectHeld(holdFrames(samples), 'b', b0!.x)
        expectHeld(holdFrames(samples), 'c', c0!.x)
        expectSmoothSlide(flipFrames(samples), 'b', b0!.x, a0!.x)
        expectSmoothSlide(flipFrames(samples), 'c', c0!.x, b0!.x)
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
