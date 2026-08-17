import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/layout-dependency?@isPlaywright=true'

const readCount = (page: Page, testId: string) => async () => {
    const text = (await page.getByTestId(testId).textContent()) ?? ''
    const match = text.match(/(\d+)/)
    return match ? Number(match[1]) : Number.NaN
}

const waitForMotionReady = async (page: Page, testId: string) => {
    await expect(page.getByTestId(testId)).toHaveAttribute('data-is-loaded', 'ready')
}

const render = async (page: Page, times: number) => {
    for (let i = 0; i < times; i++) await page.getByTestId('tick').click()
}

// Identity transforms: 'none', translate3d(0px, 0px, 0px), translate(0px, 0px),
// translateY(0px). Anything else is a live FLIP frame.
const isFlipTransform = (t: string) =>
    !!t && t !== 'none' && !/^translate(?:3d|X|Y)?\((?:0px(?:, )?)+\)$/.test(t)

/**
 * Run `act`, then sample the element's inline transform for ~600ms and report
 * whether a non-identity FLIP transform was ever applied.
 */
const sawFlipTransform = async (page: Page, testId: string, act: () => Promise<void>) => {
    await act()
    let seen = false
    for (let i = 0; i < 36; i++) {
        await page.waitForTimeout(16)
        const t = await page
            .getByTestId(testId)
            .evaluate((el) => (el as HTMLElement).style.transform)
        if (isFlipTransform(t)) seen = true
    }
    return seen
}

test.describe('layoutDependency (#314)', () => {
    test('gated box does not re-measure on unrelated renders; ungated box does', async ({
        page
    }) => {
        await page.goto(URL)
        await waitForMotionReady(page, 'default-box')
        await waitForMotionReady(page, 'gated-box')

        // Zero the counters so we only measure clicks we control.
        await page.getByTestId('reset').click()
        await expect.poll(readCount(page, 'default-measures')).toBe(0)
        await expect.poll(readCount(page, 'gated-measures')).toBe(0)

        // Five unrelated renders (color ticks). The ungated box re-measures
        // each time; the gated box (dep unchanged) must not.
        await render(page, 5)

        await expect.poll(readCount(page, 'default-measures')).toBeGreaterThanOrEqual(5)
        await expect.poll(readCount(page, 'gated-measures')).toBe(0)
    })

    test('gated box re-measures exactly once when layoutDependency changes', async ({ page }) => {
        await page.goto(URL)
        await waitForMotionReady(page, 'gated-box')

        await page.getByTestId('reset').click()
        await expect.poll(readCount(page, 'gated-measures')).toBe(0)

        // Render a few times — still gated.
        await render(page, 3)
        await expect.poll(readCount(page, 'gated-measures')).toBe(0)

        // Bumping the dependency lets the gated box measure (and FLIP).
        await page.getByTestId('reflow').click()
        await expect.poll(readCount(page, 'gated-measures')).toBe(1)

        // A second reflow bumps it again — proves it tracks the dependency.
        await page.getByTestId('reflow').click()
        await expect.poll(readCount(page, 'gated-measures')).toBe(2)
    })
})

// Upstream MeasureLayout forces a snapshot while `drag` is set, and on the
// element's OWN presence flip, regardless of layoutDependency — and on
// NOTHING else. A sibling's presence toggle re-slots a gated box without
// touching its dependency, so upstream never re-measures it: it jumps.
// Both panels hold the dependency constant (never bumped).
test.describe('layoutDependency escape hatches', () => {
    test('drag forces measurement on renders; non-drag box stays gated', async ({ page }) => {
        await page.goto(URL)
        await waitForMotionReady(page, 'drag-box')
        await waitForMotionReady(page, 'nodrag-box')

        await page.getByTestId('reset').click()
        await expect.poll(readCount(page, 'drag-measures')).toBe(0)
        await expect.poll(readCount(page, 'nodrag-measures')).toBe(0)

        await render(page, 5)

        // drag overrides the gate → re-measures every render.
        await expect.poll(readCount(page, 'drag-measures')).toBeGreaterThanOrEqual(5)
        // same constant dependency, no drag → stays gated.
        await expect.poll(readCount(page, 'nodrag-measures')).toBe(0)
    })

    test('gated box stays gated when an AnimatePresence sibling toggles (upstream parity)', async ({
        page
    }) => {
        await page.setViewportSize({ width: 1280, height: 1400 })
        await page.goto(URL)
        await waitForMotionReady(page, 'presence-gated-box')

        await page.getByTestId('reset').click()
        await expect.poll(readCount(page, 'presence-measures')).toBe(0)

        // Renders alone must not measure the gated box.
        await render(page, 4)
        await expect.poll(readCount(page, 'presence-measures')).toBe(0)

        const boxTop = () =>
            page
                .getByTestId('presence-gated-box')
                .evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY))
        const startTop = await boxTop()

        // Sibling exits → the box reflows up, but its dependency is unchanged
        // → no snapshot, no measure, no FLIP transform (it jumps).
        expect(
            await sawFlipTransform(page, 'presence-gated-box', () =>
                page.getByTestId('toggle-sibling').click()
            )
        ).toBe(false)
        await expect(page.getByTestId('presence-sibling')).toHaveCount(0)
        await expect.poll(boxTop).toBeLessThan(startTop)
        expect(await readCount(page, 'presence-measures')()).toBe(0)

        // Sibling re-enters → box reflows back down, still without measuring.
        await page.getByTestId('toggle-sibling').click()
        await expect(page.getByTestId('presence-sibling')).toHaveCount(1)
        await expect.poll(boxTop).toBe(startTop)
        await page.waitForTimeout(500)
        expect(await readCount(page, 'presence-measures')()).toBe(0)
    })
})

// #470 — keyed `{#each}` reorder. Upstream only measures the row whose
// dependency changed; displaced rows with an unchanged dependency jump. Gate on
// the row's index and every moved row animates.
test.describe('layoutDependency in a keyed list (#470)', () => {
    const rowIds = ['a', 'b', 'c', 'd', 'e'] as const

    /** Sample each row's inline transform for ~200ms after `act()`. */
    const sampleTransforms = async (page: Page, act: () => Promise<void>) => {
        const seen: Record<string, boolean> = {}
        for (const id of rowIds) seen[id] = false
        await act()
        for (let i = 0; i < 24; i++) {
            await page.waitForTimeout(16)
            const transforms = await page.evaluate(() =>
                Object.fromEntries(
                    Array.from(document.querySelectorAll('[data-testid^="row-"]')).map((el) => [
                        (el as HTMLElement).dataset.testid!.replace('row-', ''),
                        (el as HTMLElement).style.transform
                    ])
                )
            )
            for (const id of rowIds) {
                if (isFlipTransform(transforms[id] ?? '')) seen[id] = true
            }
        }
        return seen
    }

    // Page-space (scroll-invariant): clicking a control may scroll the page.
    const rowTop = (page: Page, id: string) =>
        page
            .getByTestId(`row-${id}`)
            .evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY))

    test('per-row field gate: only the bumped row animates; displaced rows jump', async ({
        page
    }) => {
        await page.setViewportSize({ width: 1280, height: 1800 })
        await page.goto(URL)
        for (const id of rowIds) await waitForMotionReady(page, `row-${id}`)
        await page.getByTestId('reset').click()

        const eStart = await rowTop(page, 'e')
        const aStart = await rowTop(page, 'a')

        const seen = await sampleTransforms(page, () => page.getByTestId('bump-row-e').click())

        // The row whose dependency changed FLIPs into its new slot.
        expect(seen.e).toBe(true)
        // The rows it displaced have an unchanged dependency: no transform.
        expect(seen.a).toBe(false)
        expect(seen.b).toBe(false)
        expect(seen.c).toBe(false)
        expect(seen.d).toBe(false)

        // ...and no public measurement either: upstream never runs
        // `updateLayout()` for a node it didn't snapshot, so `onLayoutMeasure`
        // stays silent for the displaced rows while the bumped row reports.
        const layoutMeasures = (id: string) =>
            page.evaluate(
                (rowId) =>
                    (window as unknown as { __rowLayoutMeasures: Record<string, number> })
                        .__rowLayoutMeasures[rowId] ?? 0,
                id
            )
        await expect.poll(() => layoutMeasures('e')).toBeGreaterThanOrEqual(1)
        for (const id of ['a', 'b', 'c', 'd']) expect(await layoutMeasures(id)).toBe(0)

        // Everyone still lands in the right slot — they jumped, not stuck.
        await expect.poll(() => rowTop(page, 'e')).toBe(aStart)
        await expect.poll(() => rowTop(page, 'a')).toBeGreaterThan(aStart)
        expect(eStart).toBeGreaterThan(aStart)
    })

    test('measurement cadence: renders cost gated rows no DOM reads; a reorder costs one silent read per displaced row', async ({
        page
    }) => {
        await page.setViewportSize({ width: 1280, height: 2200 })
        await page.goto(URL)
        for (const id of rowIds) await waitForMotionReady(page, `row-${id}`)
        await page.getByTestId('reset').click()

        const stats = () =>
            page.evaluate(() => {
                const s = (
                    window as unknown as {
                        __layoutMeasureStats: { reads: number; silentReads: number }
                    }
                ).__layoutMeasureStats
                return { reads: s.reads, silentReads: s.silentReads }
            })

        // Unrelated renders: gated elements do no silent cache reads at all
        // (only the ungated default box measures on render).
        await render(page, 5)
        await page.waitForTimeout(200)
        expect((await stats()).silentReads).toBe(0)

        // Keyed reorder: each gated row refreshes its cache with exactly ONE
        // silent read per observer delivery — not the two (measure + seed) the
        // pre-mitigation path did. Accounting: `observeLayoutChanges` delivers
        // leading + one trailing frame → 4 displaced rows × 2 = 8, plus the
        // bumped row's own trailing pass (its leading pass was the loud FLIP
        // commit) and one delivery for the rows' measure-count text update ≈ 10.
        // Two reads per delivery would put this at ~20; guard well below that.
        await page.getByTestId('reset').click()
        await page.getByTestId('bump-row-e').click()
        await page.waitForTimeout(600)
        const after = await stats()
        expect(after.silentReads).toBeGreaterThanOrEqual(4)
        expect(after.silentReads).toBeLessThanOrEqual(12)
    })

    test('index gate: every row whose slot changed animates', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 1800 })
        await page.goto(URL)
        for (const id of rowIds) await waitForMotionReady(page, `row-${id}`)
        await page.getByTestId('toggle-list-gate').click()
        await expect(page.getByTestId('toggle-list-gate')).toHaveText(/index/)
        await page.getByTestId('reset').click()

        const seen = await sampleTransforms(page, () => page.getByTestId('bump-row-e').click())

        // e moves to index 0; a-d each shift down one index → all indices changed.
        for (const id of rowIds) expect(seen[id]).toBe(true)
    })
})

// Upstream MeasureLayout's remaining escape hatch: the element's OWN presence
// flip (`prevProps.isPresent !== isPresent`) snapshots regardless of the
// dependency. A CHILD's presence change inside the element is not that.
test.describe('layoutDependency own-presence and wait-mode parent (upstream parity)', () => {
    test('own presence flip measures a gated element; renders do not', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 2200 })
        await page.goto(URL)
        await waitForMotionReady(page, 'self-presence-box')
        await page.getByTestId('reset').click()
        await expect.poll(readCount(page, 'self-presence-measures')).toBe(0)

        await render(page, 4)
        await expect.poll(readCount(page, 'self-presence-measures')).toBe(0)

        // Exit: this element's isPresent flips false → snapshot + measure.
        await page.getByTestId('toggle-self').click()
        await expect.poll(readCount(page, 'self-presence-measures')).toBeGreaterThanOrEqual(1)
    })

    test('gated wait-mode parent jumps on child swap; ungated parent animates size', async ({
        page
    }) => {
        await page.setViewportSize({ width: 1280, height: 2200 })
        await page.goto(URL)
        await waitForMotionReady(page, 'wait-parent')
        await waitForMotionReady(page, 'gated-wait-parent')

        const width = (id: string) =>
            page.getByTestId(id).evaluate((el) => Math.round(el.getBoundingClientRect().width))
        const smallWidth = await width('gated-wait-parent')

        // Gated parent: the swap is a child's presence change, not this
        // element's dependency or own presence → no FLIP transform, ever.
        expect(
            await sawFlipTransform(page, 'gated-wait-parent', () =>
                page.getByTestId('swap-gated-wait-child').click()
            )
        ).toBe(false)
        await expect.poll(() => width('gated-wait-parent')).toBeGreaterThan(smallWidth)

        // Ungated parent keeps the hold/release size animation.
        expect(
            await sawFlipTransform(page, 'wait-parent', () =>
                page.getByTestId('swap-wait-child').click()
            )
        ).toBe(true)
        await expect.poll(() => width('wait-parent')).toBeGreaterThan(smallWidth)
    })
})
