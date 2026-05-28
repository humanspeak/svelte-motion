import { expect, test } from '@playwright/test'

test.describe('optimized appear animations', () => {
    test('starts SSR appear animations before hydration handoff', async ({ page }) => {
        await page.addInitScript(() => {
            const samples: number[] = []
            const ids: string[] = []
            Object.defineProperty(window, '__optimizedAppearOpacitySamples', {
                value: samples
            })
            Object.defineProperty(window, '__optimizedAppearIds', {
                value: ids
            })
            const sample = () => {
                const element = document.querySelector('[data-framer-appear-id]')
                if (element) {
                    samples.push(Number(getComputedStyle(element).opacity))
                    ids.push(element.getAttribute('data-framer-appear-id') ?? '')
                }
                requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
        })

        await page.goto('/tests/optimized-appear?@isPlaywright=true')

        const card = page.getByTestId('optimized-appear-card')
        await expect(card).toBeVisible()
        await expect(card).toHaveAttribute('data-framer-appear-id', /svelte-motion-/)

        const started = await page.evaluate(() => {
            return (
                (
                    window as unknown as {
                        __SvelteMotionAppear?: { started: Array<{ name: string }> }
                    }
                ).__SvelteMotionAppear?.started.map((entry) => entry.name) ?? []
            )
        })
        expect(started).toContain('opacity')
        expect(started).toContain('transform')

        await expect
            .poll(async () => card.evaluate((el) => getComputedStyle(el).opacity), {
                timeout: 3000,
                message: 'optimized appear card never settled to visible opacity'
            })
            .toBe('1')

        const samples = await page.evaluate(() => {
            return (
                window as unknown as {
                    __optimizedAppearOpacitySamples: number[]
                }
            ).__optimizedAppearOpacitySamples
        })
        const firstVisibleProgress = samples.findIndex((value) => value > 0.15)
        expect(firstVisibleProgress).toBeGreaterThanOrEqual(0)
        expect(Math.min(...samples.slice(firstVisibleProgress))).toBeGreaterThan(0.08)

        const ids = await page.evaluate(() => {
            return (
                window as unknown as {
                    __optimizedAppearIds: string[]
                }
            ).__optimizedAppearIds
        })
        expect(new Set(ids).size).toBe(1)
    })
})
