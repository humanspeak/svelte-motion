import { expect, test } from '@playwright/test'

// Port of upstream's Cypress "deflects y perpendicular when driven by
// useAnimate()" (`packages/framer-motion/cypress/integration/transition-arc.ts`,
// commit 72a1ee2ec). `?freeze` pins the ease at 0.5, so 100 ms after the click
// the indicator sits at the chord midpoint (x = 200) and an arc path must have
// pushed it well off the straight line.
const URL = '/tests/arc/use-animate?@isPlaywright=true&freeze'

test.describe('arc() via useAnimate()', () => {
    test('deflects y perpendicular to the x travel on a plain element', async ({ page }) => {
        await page.goto(URL)
        const indicator = page.getByTestId('indicator')
        await indicator.waitFor({ state: 'visible' })

        await page.getByTestId('toggle').click()
        await page.waitForTimeout(100)

        const rect = await indicator.evaluate((el) => {
            const { left, top } = el.getBoundingClientRect()
            return { left, top }
        })

        expect(Math.abs(rect.left - (50 + 200)), `left at midpoint: ${rect.left}`).toBeLessThan(25)
        expect(Math.abs(rect.top - 200), `top must deflect off 200: ${rect.top}`).toBeGreaterThan(
            150
        )
    })
})

// Round trip: upstream's fixture only ever animates to x: 400, so a second
// Toggle had nowhere to go. The demo alternates between x: 400 and x: 0, reusing
// one `arc()` path, so the return leg must curve too and land back at the start.
const ROUND_TRIP_URL = '/tests/arc/use-animate?@isPlaywright=true'

test.describe('arc() via useAnimate() round trip', () => {
    test('a second Toggle arcs the indicator back to the start', async ({ page }) => {
        await page.goto(ROUND_TRIP_URL)
        const indicator = page.getByTestId('indicator')
        await indicator.waitFor({ state: 'visible' })

        const rect = () =>
            indicator.evaluate((el) => {
                const { left, top } = el.getBoundingClientRect()
                return { left, top }
            })

        // Polls until two reads 100 ms apart agree, then returns that rect.
        const settle = async () => {
            let last = await rect()
            await expect
                .poll(
                    async () => {
                        await page.waitForTimeout(100)
                        const next = await rect()
                        const still =
                            Math.abs(next.left - last.left) < 0.5 &&
                            Math.abs(next.top - last.top) < 0.5
                        last = next
                        return still
                    },
                    { timeout: 5000 }
                )
                .toBe(true)
            return last
        }

        await page.getByTestId('toggle').click()
        await page.waitForTimeout(1200)
        const out = await settle()
        expect(Math.abs(out.left - 450), `left after first toggle: ${out.left}`).toBeLessThan(2)
        expect(Math.abs(out.top - 200), `top after first toggle: ${out.top}`).toBeLessThan(2)

        await page.getByTestId('toggle').click()
        await page.waitForTimeout(600)
        const mid = await rect()
        expect(
            Math.abs(mid.left - 450),
            `left must leave 450 mid-return: ${mid.left}`
        ).toBeGreaterThan(50)
        expect(
            Math.abs(mid.top - 200),
            `top must deflect off 200 mid-return: ${mid.top}`
        ).toBeGreaterThan(50)

        await page.waitForTimeout(600)
        const back = await settle()
        expect(Math.abs(back.left - 50), `left after return: ${back.left}`).toBeLessThan(2)
        expect(Math.abs(back.top - 200), `top after return: ${back.top}`).toBeLessThan(2)
    })
})
