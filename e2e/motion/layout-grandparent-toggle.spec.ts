import { expect, test } from '@playwright/test'
import { sampleRectLeftSeries } from '../_helpers/transform'

const URL = '/tests/motion/layout-grandparent-toggle?@isPlaywright=true'
const BALL = '[data-testid="grandparent-toggle-ball"]'

test.describe('motion/layout FLIP on grandparent align toggle', () => {
    test('the ball slides between slots instead of snapping', async ({ page }) => {
        await page.goto(URL)
        await page.getByTestId('grandparent-toggle-ball').waitFor({ state: 'visible' })
        await page.waitForTimeout(800)

        // Sample the ball's left edge every frame across the toggle. The
        // grandparent's align-items flip (flex-start → flex-end on a column
        // flex) re-slots the ball across the container's width without
        // resizing it or touching the middle wrapper — the ONLY signal is the
        // grandparent's attribute change. A FLIP yields many intermediate
        // positions; a snap yields exactly two.
        const seriesPromise = sampleRectLeftSeries(page, { ball: BALL }, 1400)
        await page.getByTestId('grandparent-toggle').click()
        const series = await seriesPromise

        const lefts = series
            .map((sample) => sample.lefts.ball)
            .filter((value): value is number => value !== null)
        expect(lefts.length, 'expected a sampled left series').toBeGreaterThan(4)

        const start = lefts[0]
        const end = lefts[lefts.length - 1]
        expect(Math.abs(end - start), 'the ball must land in the other slot').toBeGreaterThan(100)

        const intermediate = new Set(
            lefts
                .filter((left) => Math.abs(left - start) > 2 && Math.abs(left - end) > 2)
                .map((left) => Math.round(left))
        )
        expect(
            intermediate.size,
            `the ball must FLIP through intermediate positions, not snap — saw ${new Set(lefts.map((left) => Math.round(left))).size} distinct positions`
        ).toBeGreaterThanOrEqual(4)
    })
})
