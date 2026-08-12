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

    test('starts a WAAPI appear for non-transform CSS properties like filter', async ({ page }) => {
        await page.goto('/tests/optimized-appear?@isPlaywright=true')

        const blur = page.getByTestId('optimized-appear-blur')
        await expect(blur).toBeVisible()
        await expect(blur).toHaveAttribute('data-framer-appear-id', /svelte-motion-/)

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
        expect(started).toContain('filter')

        await expect
            .poll(
                async () => {
                    const value = await blur.evaluate((el) => getComputedStyle(el).filter)
                    const match = value.match(/blur\(([\d.]+)px\)/)
                    return match ? Number(match[1]) : Number.POSITIVE_INFINITY
                },
                { timeout: 3000, message: 'filter never animated through a blur value' }
            )
            .toBeLessThan(0.5)
    })

    test('filter appear animates through intermediate blurs and settles clean', async ({
        page
    }) => {
        await page.addInitScript(() => {
            const blurSamples: number[] = []
            const filterKeyframes: string[][] = []
            Object.defineProperty(window, '__optimizedAppearBlurSamples', {
                value: blurSamples
            })
            Object.defineProperty(window, '__optimizedAppearFilterKeyframes', {
                value: filterKeyframes
            })
            const sample = () => {
                const element = document.querySelector('[data-testid="optimized-appear-blur"]')
                if (element) {
                    const match = getComputedStyle(element).filter.match(/blur\(([\d.]+)px\)/)
                    blurSamples.push(match ? Number(match[1]) : 0)
                    for (const animation of element.getAnimations()) {
                        const keyframes =
                            (animation.effect as KeyframeEffect | null)?.getKeyframes() ?? []
                        const frames = keyframes
                            .map((keyframe) => (keyframe as { filter?: string }).filter)
                            .filter((value): value is string => Boolean(value))
                        if (
                            frames.length > 0 &&
                            !filterKeyframes.some((seen) => seen.join('|') === frames.join('|'))
                        ) {
                            filterKeyframes.push(frames)
                        }
                    }
                }
                requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
        })

        await page.goto('/tests/optimized-appear?@isPlaywright=true')

        const blur = page.getByTestId('optimized-appear-blur')
        await expect(blur).toBeVisible()

        const started = await page.evaluate(() => {
            return (
                (
                    window as unknown as {
                        __SvelteMotionAppear?: { started: Array<{ name: string }> }
                    }
                ).__SvelteMotionAppear?.started.map((entry) => entry.name) ?? []
            )
        })
        expect(started).toContain('filter')

        await expect
            .poll(async () => blur.evaluate((el) => getComputedStyle(el).filter), {
                timeout: 3000,
                message: 'filter never settled to a sharp value'
            })
            .toMatch(/^(none|blur\(0px\))$/)
        await expect
            .poll(async () => blur.evaluate((el) => getComputedStyle(el).opacity), {
                timeout: 3000,
                message: 'blur card never settled to full opacity'
            })
            .toBe('1')

        const keyframeSets = await page.evaluate(() => {
            return (window as unknown as { __optimizedAppearFilterKeyframes: string[][] })
                .__optimizedAppearFilterKeyframes
        })
        expect(keyframeSets).toContainEqual(['blur(8px)', 'blur(0px)'])

        const samples = await page.evaluate(() => {
            return (window as unknown as { __optimizedAppearBlurSamples: number[] })
                .__optimizedAppearBlurSamples
        })
        expect(
            samples.some((value) => value > 0.5 && value < 7.5),
            'expected at least one intermediate blur frame — filter snapped instead of animating'
        ).toBe(true)
        const firstSharpIndex = samples.findIndex((value) => value < 0.5)
        expect(firstSharpIndex).toBeGreaterThanOrEqual(0)
        expect(
            Math.max(...samples.slice(firstSharpIndex)),
            'blur re-appeared after settling — appear/handoff popped'
        ).toBeLessThan(1)
    })
})
