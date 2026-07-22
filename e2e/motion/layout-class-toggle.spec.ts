import { expect, test } from '@playwright/test'
import { readTransform, sampleRectLeftSeries, sampleTransformSeries } from '../_helpers/transform'

const URL = '/tests/motion/layout-class-toggle?@isPlaywright=true'
const BALL = '[data-testid="class-toggle-ball"]'

type ProjectionEvent = { changed: boolean; at: number }

/** Reset the page's recorded projection-event log to a clean slate. */
const resetEvents = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
        ;(window as unknown as { __projectionEvents?: unknown[] }).__projectionEvents = []
    })

/** Read the recorded projection events out of the page. */
const readEvents = (page: import('@playwright/test').Page) =>
    page.evaluate(
        () =>
            ((window as unknown as { __projectionEvents?: ProjectionEvent[] }).__projectionEvents ??
                []) as ProjectionEvent[]
    )

test.describe('motion/layout FLIP on own class toggle', () => {
    test('records exactly one changed-projection event for one class toggle', async ({ page }) => {
        await page.goto(URL)
        await page.getByTestId('class-toggle-ball').waitFor({ state: 'visible' })
        await page.waitForTimeout(800)
        await resetEvents(page)

        await page.getByTestId('class-toggle').click()

        // Wait for the FLIP to settle: poll the transform back to identity.
        await expect
            .poll(async () => Math.abs((await readTransform(page, BALL)).tx), { timeout: 4000 })
            .toBeLessThan(1)

        const events = await readEvents(page)
        const changed = events.filter((event) => event.changed)
        // The reactive path (classProp tracked) and the DOM self-observer
        // (attributeFilter includes `class`) both see this one change. Upstream
        // guarantees one measure/animate pass per commit — expect ONE event.
        expect(
            changed.length,
            `one class change must produce one changed-projection event — saw ${changed.length} (timestamps: ${changed
                .map((event) => Math.round(event.at))
                .join(', ')})`
        ).toBe(1)
    })

    test('the ball slides monotonically into the shifted slot without a restart jump', async ({
        page
    }) => {
        await page.goto(URL)
        await page.getByTestId('class-toggle-ball').waitFor({ state: 'visible' })
        await page.waitForTimeout(800)

        // Sample the ball's left edge every frame across the toggle. margin-left
        // 0 → 200px moves it right, so the FLIP (easeOut tween, no overshoot)
        // must increase `left` monotonically. A duplicate reactive re-commit
        // restarts the FLIP from origin — a backwards jump in the series.
        const seriesPromise = sampleRectLeftSeries(page, { ball: BALL }, 1400)
        await page.getByTestId('class-toggle').click()
        const series = await seriesPromise

        const lefts = series
            .map((sample) => sample.lefts.ball)
            .filter((value): value is number => value !== null)
        expect(lefts.length, 'expected a sampled left series').toBeGreaterThan(4)

        const travelled = Math.max(...lefts) - Math.min(...lefts)
        expect(travelled, 'the ball must actually move into the shifted slot').toBeGreaterThan(100)

        let maxBackstep = 0
        for (let index = 1; index < lefts.length; index++) {
            const backstep = lefts[index - 1] - lefts[index]
            if (backstep > maxBackstep) maxBackstep = backstep
        }
        expect(
            maxBackstep,
            `the FLIP must not jump backwards (restart signature) — max backstep ${maxBackstep.toFixed(1)}px`
        ).toBeLessThan(20)
    })

    test('an imperative classList change still FLIPs (no over-suppression)', async ({ page }) => {
        await page.goto(URL)
        await page.getByTestId('class-toggle-ball').waitFor({ state: 'visible' })
        await page.waitForTimeout(800)

        // Mutate the class WITHOUT going through the Svelte prop: only the DOM
        // observer path sees this change (classProp is unchanged), so the fix's
        // duplicate-suppression guard must not swallow this genuine FLIP.
        const seriesPromise = sampleTransformSeries(page, [BALL], 1200)
        await page.evaluate((selector) => {
            document.querySelector<HTMLElement>(selector)?.classList.add('shift')
        }, BALL)
        const series = await seriesPromise

        const peakTx = Math.max(...series.map((sample) => Math.abs(sample.tx)))
        expect(
            peakTx,
            `imperative classList.add('shift') must still drive a FLIP — peak |tx| ${peakTx.toFixed(1)}px`
        ).toBeGreaterThan(20)
    })
})
