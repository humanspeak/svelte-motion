import { expect, test } from '@playwright/test'

/**
 * CI-runner regression: the tap-release orphaned-key restore computed its
 * baseline WITHOUT the creation-time `baseStyleValues` record, so `opacity`
 * fell through to the live computed-style fallback. On a slow runner the
 * hover-exit restore is still mid-flight at release, the live read captures a
 * transient (~0.6-0.9), and the element settles short of its authored rest
 * value. Fast machines mask it — hover-exit has mostly finished by release —
 * so this spec re-runs the disjoint-key release flow under CDP CPU throttling
 * to reproduce the shared-runner condition deterministically.
 */
test.describe('Hover/tap disjoint-key release under CPU throttle', () => {
    const readOpacity = (box: import('@playwright/test').Locator) =>
        box.evaluate((el) => Number.parseFloat(getComputedStyle(el).opacity))

    test('restores the non-owned opacity key to rest on a slow runner', async ({ page }) => {
        const cdp = await page.context().newCDPSession(page)
        await page.goto('/tests/motion/hover-tap-disjoint-keys?@isPlaywright=true')

        const box = page.getByTestId('motion-disjoint-keys')
        await expect(box).toBeVisible()
        await page.waitForTimeout(800)

        // Hover applies opacity → 0.5, at full speed.
        await box.hover()
        await expect.poll(async () => readOpacity(box), { timeout: 5000 }).toBeLessThan(0.6)

        // Throttle BEFORE the exit/release choreography so the hover-exit
        // restore is guaranteed still mid-flight when the tap releases.
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 })

        await box.focus()
        await page.keyboard.down('Space')
        await page.waitForTimeout(100)
        await page.mouse.move(5, 5)
        // Release almost immediately — mid hover-exit restore.
        await page.waitForTimeout(50)
        await page.keyboard.up('Space')

        // The restore must settle at the authored rest value even though the
        // baseline was computed while opacity was mid-transient.
        await expect.poll(async () => readOpacity(box), { timeout: 8000 }).toBeGreaterThan(0.95)
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    })
})
