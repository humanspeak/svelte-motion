import { expect, test } from '@playwright/test'

/**
 * Coverage for the AI Gradient Card example. A single `turn` motion value
 * sweeps 0 → 1 on an infinite linear loop; `useMotionTemplate` composes it into
 * a `conic-gradient(from <turn>turn, …)` string that paints the border ring's
 * `background-image`. These tests prove:
 *   1. the template renders a well-formed conic gradient,
 *   2. the `from` angle actually advances while the loop runs, and
 *   3. pausing and jumping the motion value drives an exact `from` angle.
 *
 * Assertions read `data-bg` (the raw composed string from the motion value)
 * rather than the serialized inline `style`, which the browser normalizes.
 */
const fromTurn = (bg: string | null): number | null => {
    const match = bg?.match(/from\s+([\d.]+)turn/)
    return match ? parseFloat(match[1]) : null
}

test.describe('AI Gradient Card (animated conic-gradient template)', () => {
    test('renders a well-formed conic-gradient from a motion template', async ({ page }) => {
        await page.goto('/tests/ai-gradient-card')

        const ring = page.getByTestId('ring')
        await expect(ring).toBeVisible()
        await expect(ring).toHaveAttribute('data-bg', /^conic-gradient\(from\s+[\d.]+turn/)
    })

    test('the from angle keeps advancing across loop cycles', async ({ page }) => {
        await page.goto('/tests/ai-gradient-card')

        const ring = page.getByTestId('ring')
        await expect(ring).toHaveAttribute('data-bg', /conic-gradient\(from/)

        // Sample the `from` angle across points that span more than one full
        // loop (the page animates with duration 2s, repeat: Infinity). A
        // regression where the animation ignores `repeat`/`duration` and eases
        // to the `1turn` target as a one-shot spring would settle motionless
        // here — so every consecutive sample must keep changing.
        const samples: (number | null)[] = []
        samples.push(fromTurn(await ring.getAttribute('data-bg')))
        for (const wait of [700, 1500, 1500, 1500]) {
            await page.waitForTimeout(wait)
            samples.push(fromTurn(await ring.getAttribute('data-bg')))
        }

        for (const s of samples) expect(s).not.toBeNull()
        for (let i = 1; i < samples.length; i++) {
            expect(samples[i]).not.toBe(samples[i - 1])
        }
    })

    test('pausing and jumping sets an exact from angle', async ({ page }) => {
        await page.goto('/tests/ai-gradient-card')

        const ring = page.getByTestId('ring')

        await page.getByTestId('jump-half').click()
        await expect(ring).toHaveAttribute('data-bg', /from\s+0\.5turn/)

        await page.getByTestId('jump-0').click()
        await expect(ring).toHaveAttribute('data-bg', /from\s+0turn/)
    })
})
