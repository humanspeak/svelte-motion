import { expect, test } from '@playwright/test'

/**
 * The SSR optimized appear animation follows initial's `transition.out`, else
 * animate's own transition (#1725). Port of upstream
 * `dev/html/public/optimized-appear/initial-out.html` @ v14.7.1 (`ad11115e9`,
 * `1a451de16`), with upstream's per-frame thresholds: opacity never drops more
 * than 0.02 between frames and never rises more than `dt / 2.4 s + 0.08`.
 */

const URL = '/tests/optimized-appear/initial-out?@isPlaywright=true'
const OUT_DURATION = 2.4
const BOXES = ['initial-out-box', 'animate-transition-box'] as const

type Sample = [time: number, opacity: number]

test.describe('optimized appear follows the mount transition (#1725)', () => {
    for (const box of BOXES) {
        test(`${box}: the SSR appear payload uses the 2.4 s mount transition`, async ({ page }) => {
            const html = await (await page.request.get(URL)).text()

            const tag = html.match(new RegExp(`<div[^>]*data-testid="${box}"[^>]*>`))?.[0]
            expect(tag, `${box} is server-rendered`).toBeTruthy()
            const id = tag!.match(/data-framer-appear-id="(svelte-motion-[^"]+)"/)?.[1]
            expect(id, `${box} carries an appear id`).toBeTruthy()

            const marker = `{"id":"${id}","entries":`
            const start = html.indexOf(marker)
            expect(start, `appear payload for ${id}`).toBeGreaterThanOrEqual(0)
            const end = html.indexOf(',w=window', start)
            const payload = JSON.parse(html.slice(start, end)) as {
                entries: Array<{ name: string; options: { duration: number } }>
            }
            const opacity = payload.entries.find((entry) => entry.name === 'opacity')
            expect(opacity?.options.duration).toBe(2400)
        })
    }

    test('both boxes fade in continuously at the mount transition rate', async ({ page }) => {
        await page.addInitScript((boxes: readonly string[]) => {
            const samples: Record<string, Array<[number, number]>> = {}
            for (const box of boxes) samples[box] = []
            Object.defineProperty(window, '__initialOutSamples', { value: samples })
            const sample = () => {
                const now = performance.now()
                for (const box of boxes) {
                    const element = document.querySelector(`[data-testid="${box}"]`)
                    if (element) samples[box].push([now, Number(getComputedStyle(element).opacity)])
                }
                requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
        }, BOXES)

        await page.goto(URL)

        for (const box of BOXES) {
            await expect
                .poll(
                    () =>
                        page
                            .getByTestId(box)
                            .evaluate((element) => getComputedStyle(element).opacity),
                    { timeout: 5000, message: `${box} never reached opacity 1` }
                )
                .toBe('1')
        }

        const all = await page.evaluate(
            () =>
                (window as unknown as { __initialOutSamples: Record<string, Sample[]> })
                    .__initialOutSamples
        )

        for (const box of BOXES) {
            const samples = all[box]
            const first = samples.findIndex(([, opacity]) => opacity > 0.01)
            expect.soft(first, `${box} started fading in`).toBeGreaterThanOrEqual(0)
            if (first < 0) continue

            for (let i = Math.max(1, first); i < samples.length; i++) {
                const [prevTime, prevOpacity] = samples[i - 1]
                const [time, opacity] = samples[i]
                if (opacity < prevOpacity - 0.02) {
                    expect
                        .soft(opacity, `${box}: opacity went back from ${prevOpacity} at ${time}`)
                        .toBeGreaterThanOrEqual(prevOpacity - 0.02)
                    break
                }
                const maxStep = (time - prevTime) / 1000 / OUT_DURATION + 0.08
                if (opacity - prevOpacity > maxStep) {
                    expect
                        .soft(opacity - prevOpacity, `${box}: opacity jumped from ${prevOpacity}`)
                        .toBeLessThanOrEqual(maxStep)
                    break
                }
            }

            const startTime = samples[first][0]
            const atOneSecond = samples.find(([time]) => time >= startTime + 1000)
            expect.soft(atOneSecond, `${box} sampled 1 s after it started`).toBeTruthy()
            if (atOneSecond) {
                expect
                    .soft(atOneSecond[1], `${box} opacity 1 s in (a 0.6 s fade is at 1)`)
                    .toBeLessThanOrEqual(0.75)
            }
        }
    })

    test('the appear animation ran for both boxes', async ({ page }) => {
        await page.goto(URL)
        await page.getByTestId(BOXES[0]).waitFor()

        const started = await page.evaluate(
            () =>
                (
                    window as unknown as {
                        __SvelteMotionAppear?: { started: Array<{ id: string; name: string }> }
                    }
                ).__SvelteMotionAppear?.started ?? []
        )
        for (const box of BOXES) {
            const id = await page.getByTestId(box).getAttribute('data-framer-appear-id')
            expect(
                started.some((entry) => entry.id === id && entry.name === 'opacity'),
                `${box}: the appear animation ran`
            ).toBe(true)
        }
    })
})
