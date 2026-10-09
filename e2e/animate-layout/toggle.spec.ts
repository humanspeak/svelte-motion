import { expect, test, type Page } from '@playwright/test'
import { sampleRectLeftSeries, type RectLeftSample } from '../_helpers/transform'

/** Frames in which `key` sits strictly between its first and last position. */
const inFlightFrames = (samples: RectLeftSample[], key: string) => {
    const lefts = samples.map((sample) => sample.lefts[key]).filter((left) => left !== null)
    const from = lefts[0]
    const to = lefts[lefts.length - 1]
    const lo = Math.min(from, to) + 1
    const hi = Math.max(from, to) - 1
    return { from, to, frames: lefts.filter((left) => left > lo && left < hi).length }
}

const knobs = (...ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, `[data-testid="knob-${id}"]`]))

const clickAndSample = async (page: Page, button: string, ids: string[]) => {
    const sampling = sampleRectLeftSeries(page, knobs(...ids), 900)
    await page.getByTestId(button).click()
    return sampling
}

test.describe('animate-layout/toggle', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/animate-layout/toggle?@isPlaywright=true')
        await page.getByTestId('flip-global').waitFor({ state: 'visible' })
    })

    test('glides a data-layout knob between ends', async ({ page }) => {
        const samples = await clickAndSample(page, 'flip-global', ['global'])
        const { from, to, frames } = inFlightFrames(samples, 'global')

        expect(to - from).toBeGreaterThan(40)
        expect(frames).toBeGreaterThanOrEqual(5)
        await expect(page.getByTestId('switch-global')).toHaveAttribute('data-on', 'true')
        await expect(page.getByTestId('settled')).toHaveText('settled:1')
    })

    test('glides back after a second toggle', async ({ page }) => {
        await page.getByTestId('flip-global').click()
        await expect(page.getByTestId('settled')).toHaveText('settled:1')
        await page.waitForTimeout(600)

        const samples = await clickAndSample(page, 'flip-global', ['global'])
        const { from, to, frames } = inFlightFrames(samples, 'global')

        expect(from - to).toBeGreaterThan(40)
        expect(frames).toBeGreaterThanOrEqual(5)
    })

    test('only animates elements inside the scope', async ({ page }) => {
        const samples = await clickAndSample(page, 'flip-scoped', ['scoped', 'outside'])
        const scoped = inFlightFrames(samples, 'scoped')
        const outside = inFlightFrames(samples, 'outside')

        expect(scoped.to - scoped.from).toBeGreaterThan(40)
        expect(scoped.frames).toBeGreaterThanOrEqual(5)
        // Both switches flipped, but the one outside the scope snaps.
        expect(outside.to - outside.from).toBeGreaterThan(40)
        expect(outside.frames).toBeLessThanOrEqual(1)
    })

    test('waits for an async update, then glides', async ({ page }) => {
        const samples = await clickAndSample(page, 'flip-async', ['async'])
        const { from, to, frames } = inFlightFrames(samples, 'async')

        expect(to - from).toBeGreaterThan(40)
        expect(frames).toBeGreaterThanOrEqual(5)
        // Nothing moves until the update's 120ms delay has passed.
        const early = samples.filter((sample) => sample.atMs < 80)
        expect(early.every((sample) => sample.lefts.async === from)).toBe(true)
    })
})
