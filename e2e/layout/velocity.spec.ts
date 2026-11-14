import { expect, test, type Page } from '@playwright/test'

/**
 * Layout animations with a spring start with the element's current velocity
 * instead of from rest. Tweens take no velocity.
 *
 * Port of upstream `packages/framer-motion/cypress/integration/layout-velocity.ts`
 * @ `v14.14.0` (Motion 14.13, PR #4047): its 12 non-drag tests, with their
 * names, waits and thresholds, against `src/routes/tests/layout/velocity`
 * (a port of `dev/react/src/tests/layout-velocity-*.tsx`). The three drag
 * tests are in `e2e/layout-id/throw.spec.ts`.
 *
 * Positions are sampled once per animation frame inside the page, so the
 * test measures the first frames after a hand-off and not the settled state.
 * Each sampling loop reads the position and clicks in the same `evaluate`, so
 * no frame passes between them.
 */

test.use({ viewport: { width: 1280, height: 720 } })

const url = (query: string) => `/tests/layout/velocity?test=${query}&@isPlaywright=true`

/**
 * Click the box, wait until the layout animation is moving fast to the
 * right, then click again to send it back to the left. Returns the left
 * edge at the second click and the samples from the frames after it.
 */
const interrupt = async (page: Page, query: string, wait = 250, count = 6) => {
    await page.goto(url(`interrupt${query}`))
    await page.waitForTimeout(200)
    await page.click('#box')
    await page.waitForTimeout(wait)
    return page.evaluate(
        (count) =>
            new Promise<{ atInterrupt: number; samples: number[] }>((resolve) => {
                const box = document.getElementById('box')!
                const left = () => box.getBoundingClientRect().left
                const atInterrupt = left()
                box.click()
                const samples: number[] = []
                const tick = () => {
                    samples.push(left())
                    if (samples.length < count) requestAnimationFrame(tick)
                    else resolve({ atInterrupt, samples })
                }
                requestAnimationFrame(tick)
            }),
        count
    )
}

test.describe('Layout velocity', () => {
    test('An interrupted layout animation keeps its velocity', async ({ page }) => {
        const { atInterrupt, samples } = await interrupt(page, '')
        // Still moving right after the interrupt, then turns back.
        expect(Math.max(...samples.slice(0, 4))).toBeGreaterThan(atInterrupt + 5)
    })

    test('An interrupted layout tween starts from rest', async ({ page }) => {
        const { atInterrupt, samples } = await interrupt(page, '&tween')
        expect(Math.max(...samples)).toBeLessThan(atInterrupt + 1)
    })

    test('An interrupted layout spring with a duration starts from rest', async ({ page }) => {
        const { atInterrupt, samples } = await interrupt(page, '&duration')
        expect(Math.max(...samples)).toBeLessThan(atInterrupt + 1)
    })

    test("An interrupted spring keeps an edge that doesn't move still", async ({ page }) => {
        await page.goto(url('fixed-edge'))
        await page.waitForTimeout(200)
        await page.click('#box', { position: { x: 10, y: 10 } })
        await page.waitForTimeout(250)
        const samples = await page.evaluate(
            () =>
                new Promise<number[]>((resolve) => {
                    const box = document.getElementById('box')!
                    box.click()
                    const samples: number[] = []
                    const tick = () => {
                        samples.push(box.getBoundingClientRect().left)
                        if (samples.length < 20) requestAnimationFrame(tick)
                        else resolve(samples)
                    }
                    requestAnimationFrame(tick)
                })
        )
        // Position and size share each axis spring, so the left edge stays
        // at 100px while the box keeps its velocity.
        for (const left of samples) {
            expect(Math.abs(left - 100)).toBeLessThan(1)
        }
    })

    test('A nested child keeps its place while its parent is interrupted', async ({ page }) => {
        await page.goto(url('nested'))
        await page.waitForTimeout(200)
        await page.click('#parent', { position: { x: 150, y: 150 } })
        await page.waitForTimeout(200)
        const offsets = await page.evaluate(
            () =>
                new Promise<number[]>((resolve) => {
                    const parent = document.getElementById('parent')!
                    const child = document.getElementById('child')!
                    parent.click()
                    const offsets: number[] = []
                    const tick = () => {
                        offsets.push(
                            child.getBoundingClientRect().left - parent.getBoundingClientRect().left
                        )
                        if (offsets.length < 40) requestAnimationFrame(tick)
                        else resolve(offsets)
                    }
                    requestAnimationFrame(tick)
                })
        )
        // Parent and child share one spring, so the child stays 20px in from
        // the parent's left edge.
        for (const offset of offsets) {
            expect(Math.abs(offset - 20)).toBeLessThan(1)
        }
    })

    test('A child moving inside its parent keeps only its own velocity', async ({ page }) => {
        await page.goto(url('nested&move'))
        await page.waitForTimeout(200)
        await page.click('#parent', { position: { x: 150, y: 150 } })
        await page.waitForTimeout(150)
        const { atInterrupt, offsets } = await page.evaluate(
            () =>
                new Promise<{ atInterrupt: number; offsets: number[] }>((resolve) => {
                    const parent = document.getElementById('parent')!
                    const child = document.getElementById('child')!
                    const offset = () =>
                        child.getBoundingClientRect().left - parent.getBoundingClientRect().left
                    const atInterrupt = offset()
                    parent.click()
                    const offsets: number[] = []
                    const tick = () => {
                        offsets.push(offset())
                        if (offsets.length < 4) requestAnimationFrame(tick)
                        else resolve({ atInterrupt, offsets })
                    }
                    requestAnimationFrame(tick)
                })
        )
        // The child keeps moving right inside its parent for a few frames
        // before it turns back.
        expect(Math.max(...offsets)).toBeGreaterThan(atInterrupt + 3)
    })

    test('A layout animation that starts with no width completes', async ({ page }) => {
        await page.goto(url('zero-size'))
        await page.waitForTimeout(200)
        await page.evaluate(() => document.getElementById('box')!.click())
        await page.waitForTimeout(150)
        await page.evaluate(() => document.getElementById('box')!.click())
        await page.waitForTimeout(2000)
        await expect(async () => {
            const { completed, width } = await page.evaluate(() => {
                const box = document.getElementById('box')!
                return {
                    completed: box.dataset.completed,
                    width: box.getBoundingClientRect().width
                }
            })
            expect(completed).toBe('1')
            expect(width).toBe(200)
        }).toPass({ timeout: 4000 })
    })

    test('An interrupted spring with a delay holds still during the delay', async ({ page }) => {
        await page.goto(url('fixed-edge&delay'))
        await page.waitForTimeout(200)
        await page.click('#box', { position: { x: 10, y: 10 } })
        await page.waitForTimeout(700)
        const { atInterrupt, widths } = await page.evaluate(
            () =>
                new Promise<{ atInterrupt: number; widths: number[] }>((resolve) => {
                    const box = document.getElementById('box')!
                    const atInterrupt = box.getBoundingClientRect().width
                    box.click()
                    const widths: number[] = []
                    const tick = () => {
                        widths.push(box.getBoundingClientRect().width)
                        if (widths.length < 10) requestAnimationFrame(tick)
                        else resolve({ atInterrupt, widths })
                    }
                    requestAnimationFrame(tick)
                })
        )
        // The 0.3s delay shows the box where it was interrupted, not at the
        // end of the new animation.
        for (const width of widths) {
            expect(Math.abs(width - atInterrupt)).toBeLessThan(2)
        }
    })

    const readDurations = (page: Page) =>
        page.evaluate(() =>
            ['small', 'big'].map((id) => Number(document.getElementById(id)!.dataset.duration))
        )

    test('With mass auto, a bigger element settles later', async ({ page }) => {
        await page.goto(url('auto-mass'))
        await page.waitForTimeout(200)
        await page.click('#toggle', { position: { x: 10, y: 10 } })
        await page.waitForTimeout(2500)
        await expect(async () => {
            const [small, big] = await readDurations(page)
            // Mass 0.25 (50px) against mass 1.67 (500px).
            expect(small).toBeGreaterThan(0)
            expect(big - small).toBeGreaterThan(300)
        }).toPass({ timeout: 4000 })
    })

    test('The default layout transition stays a tween', async ({ page }) => {
        await page.goto(url('auto-mass&default'))
        await page.waitForTimeout(200)
        await page.click('#toggle', { position: { x: 10, y: 10 } })
        await page.waitForTimeout(1500)
        await expect(async () => {
            for (const duration of await readDurations(page)) {
                expect(duration).toBeGreaterThan(0)
                expect(duration).toBeLessThan(530)
            }
        }).toPass({ timeout: 4000 })
    })

    test('A layout spring with a duration ends on time', async ({ page }) => {
        await page.goto(url('auto-mass&duration'))
        await page.waitForTimeout(200)
        await page.click('#toggle', { position: { x: 10, y: 10 } })
        await page.waitForTimeout(1500)
        await expect(async () => {
            for (const duration of await readDurations(page)) {
                expect(duration).toBeGreaterThan(0)
                expect(duration).toBeLessThan(380)
            }
        }).toPass({ timeout: 4000 })
    })

    test('An interrupted mirror spring goes back to where it was interrupted', async ({ page }) => {
        const { atInterrupt, samples } = await interrupt(page, '&mirror', 120, 90)
        // The spring reaches the left, then mirrors back to the point of the
        // interrupt and not past it.
        const left = samples.indexOf(Math.min(...samples))
        const back = Math.max(...samples.slice(left))
        expect(Math.abs(back - atInterrupt)).toBeLessThan(5)
    })
})
