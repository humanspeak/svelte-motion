import { expect, test } from '@playwright/test'

/**
 * Motion 14.12: springs defined by `visualDuration` inherit the velocity of the
 * animation they interrupt, as physics springs do. A `duration` spring still
 * starts from rest.
 *
 * Port of upstream `tests/animate/time-spring-velocity.spec.ts` at v14.12.0,
 * against the tester page `/tests/motion/spring-velocity`, whose `window.run`
 * ports `dev/html/public/playwright/animate/animate-time-spring-velocity.html`.
 */

/**
 * `before` is the last painted frame before the reversal; `atReverse` is read
 * synchronously right after the reversing `animate()`, which is the value at
 * the interrupt (the interrupted animation's `stop()` catches up to now).
 */
type ValueResult = { before: number; atReverse: number; after: number; final: number }
type RunResult = { opacity: ValueResult; x: ValueResult }
type RunWindow = { run: (transition: Record<string, unknown>) => Promise<RunResult> }

const transitions = [
    { type: 'spring', stiffness: 200, damping: 20 },
    { type: 'spring', visualDuration: 0.5, bounce: 0.2 },
    { type: 'spring', visualDuration: 0.5, bounce: 0 }
]

test.describe('interrupted springs carry velocity', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/motion/spring-velocity?@isPlaywright=true')
        await page.waitForFunction(
            () => typeof (window as unknown as Partial<RunWindow>).run === 'function'
        )
    })

    for (const transition of transitions) {
        test(`interrupted spring inherits velocity: ${JSON.stringify(transition)}`, async ({
            page
        }) => {
            const results = await page.evaluate(
                (t) => (window as unknown as RunWindow).run(t),
                transition
            )

            // Still moving towards the first target after the reversal.
            expect(results.opacity.after).toBeGreaterThan(results.opacity.before)
            expect(results.x.after).toBeGreaterThan(results.x.before)

            expect(results.opacity.final).toBe(0)
            expect(results.x.final).toBe(0)
        })
    }

    test('a duration spring starts from rest and turns back at once', async ({ page }) => {
        const results = await page.evaluate((t) => (window as unknown as RunWindow).run(t), {
            type: 'spring',
            duration: 0.8
        })

        // Measured from the interrupt, not the last painted frame: the
        // catch-up tick on interrupt can leave the value right of `before`, and
        // a spring from rest eases in, so 32ms later it can still be right of
        // `before` even though it never moved further right. A spring that
        // inherited velocity would be well past `atReverse` here instead.
        expect(results.x.after).toBeLessThan(results.x.atReverse)
        expect(results.opacity.after).toBeLessThan(results.opacity.atReverse)
    })
})
