import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/transform-template/stop?@isPlaywright=true'

const readOrbX = (page: Page) => async (): Promise<number | null> => {
    const style = (await page.getByTestId('stop-orb').getAttribute('style')) ?? ''
    const match = style.match(/translateX\(([-\d.]+)px\)/)
    return match ? Number.parseFloat(match[1]) : null
}

test.describe('transformTemplate — controls.stop() freeze page', () => {
    test('freezes the templated transform instantly on Stop', async ({ page }) => {
        await page.goto(URL)
        await expect(page.getByTestId('stop-orb')).toBeVisible()

        const readX = readOrbX(page)

        await page.getByTestId('stop-send').click()

        // The run is a slow 4s linear move to x:320 — catch it mid-track.
        await expect
            .poll(
                async () => {
                    const x = await readX()
                    return x !== null && x > 40 && x < 260
                },
                { timeout: 3000 }
            )
            .toBe(true)

        await page.getByTestId('stop-stop').click()
        const atStop = await readX()
        expect(atStop).not.toBeNull()

        await page.waitForTimeout(400)
        const afterStop = await readX()

        // Still-running linear 4s animation would advance ~32px in 400ms; a stopped
        // templated-transform MotionValue animation stays put (#402, gap 1).
        expect(Math.abs((afterStop ?? 0) - (atStop ?? 0))).toBeLessThan(5)
        // Froze in place rather than snapping to the x:320 target...
        expect(afterStop).toBeLessThan(300)
        // ...the on-page status flips to FROZEN...
        await expect(page.getByTestId('stop-status')).toHaveText('FROZEN')
        // ...and the transformTemplate is still applied after stopping.
        const style = (await page.getByTestId('stop-orb').getAttribute('style')) ?? ''
        expect(style).toContain('translateY(')
    })

    test('Reset returns the orb to the origin', async ({ page }) => {
        await page.goto(URL)
        await expect(page.getByTestId('stop-orb')).toBeVisible()

        await page.getByTestId('stop-send').click()
        await expect.poll(readOrbX(page), { timeout: 3000 }).toBeGreaterThan(40)

        await page.getByTestId('stop-reset').click()
        // At the origin the templated transform collapses and translateX may be
        // omitted entirely — an absent offset means the orb is back at x:0.
        await expect
            .poll(async () => (await readOrbX(page)()) ?? 0, { timeout: 3000 })
            .toBeLessThan(2)
        await expect(page.getByTestId('stop-status')).toHaveText('FROZEN')
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(page.getByRole('link', { name: /controls\.stop\(\) freeze/ })).toHaveAttribute(
            'href',
            /\/tests\/transform-template\/stop/
        )
    })
})
