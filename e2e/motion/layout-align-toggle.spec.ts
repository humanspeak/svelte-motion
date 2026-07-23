import { expect, test } from '@playwright/test'

const URL = '/tests/motion/layout-align-toggle?@isPlaywright=true'

test.describe('motion/layout FLIP on parent align toggle', () => {
    test('the ball slides between slots instead of snapping', async ({ page }) => {
        await page.goto(URL)
        const ball = page.getByTestId('align-toggle-ball')
        await ball.waitFor({ state: 'visible' })
        await page.waitForTimeout(800)

        // Sample the ball's top edge every frame across the toggle: a FLIP
        // yields many intermediate positions; a snap yields exactly two.
        const samplesPromise = ball.evaluate(
            (el) =>
                new Promise<number[]>((resolve) => {
                    const out: number[] = []
                    const t0 = performance.now()
                    const read = () => {
                        out.push(el.getBoundingClientRect().top)
                        if (performance.now() - t0 < 1400) requestAnimationFrame(read)
                        else resolve(out)
                    }
                    requestAnimationFrame(read)
                })
        )
        // Mirror a real interaction: the pointer hovers the track first,
        // which animates the PARENT's backgroundColor every frame — the
        // click then flips align-items mid-hover-animation.
        await page.getByTestId('align-toggle-track').hover()
        await page.waitForTimeout(250)
        await page.getByTestId('align-toggle-track').click()
        const samples = await samplesPromise

        const start = samples[0]
        const end = samples[samples.length - 1]
        expect(Math.abs(end - start), 'the ball must land in the other slot').toBeGreaterThan(100)

        const intermediate = new Set(
            samples
                .filter((top) => Math.abs(top - start) > 2 && Math.abs(top - end) > 2)
                .map((top) => Math.round(top))
        )
        expect(
            intermediate.size,
            `the ball must FLIP through intermediate positions, not snap — saw ${new Set(samples.map((t) => Math.round(t))).size} distinct positions`
        ).toBeGreaterThanOrEqual(4)
    })
})
