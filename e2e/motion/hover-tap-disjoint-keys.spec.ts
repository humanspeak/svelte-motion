import { expect, test } from '@playwright/test'

/**
 * Regression (plan 004): gesture priority protects keys PER-KEY, not
 * per-gesture. With `whileHover={{ opacity: 0.5 }}` and
 * `whileTap={{ scale: 0.9 }}` the two gestures own DISJOINT keys, so a tap that
 * only animates `scale` must never suppress hover's `opacity`.
 *
 * Upstream framer-motion (motion-dom animation-state.ts `protectedKeys`) keeps
 * `whileTap` protecting only the keys it actually animates; a simultaneously
 * active `whileHover` still owns every key tap doesn't touch. Our port used to
 * gate the WHOLE hover application/restore behind "is tap active", producing two
 * divergences this spec pins.
 *
 * Why the tap is driven by the KEYBOARD (Space), not the mouse button: in
 * headless Chromium, moving a pressed pointer off the element dispatches a
 * `pointercancel` that ends motion-dom's `press()` gesture BEFORE the hover
 * exit fires — so a mouse-held tap can never overlap a hover boundary and the
 * per-key divergence cannot manifest. A keyboard tap keeps `tap` active
 * independently of the pointer, so a mouse-driven hover enter/exit genuinely
 * overlaps an active tap on disjoint keys (exactly the upstream contract).
 */
test.describe('Hover/tap disjoint-key ownership', () => {
    const readOpacity = (box: import('@playwright/test').Locator) =>
        box.evaluate((el) => Number.parseFloat(getComputedStyle(el).opacity))

    test('hover applied while a tap is active animates the non-owned opacity key', async ({
        page
    }) => {
        await page.goto('/tests/motion/hover-tap-disjoint-keys?@isPlaywright=true')

        const box = page.getByTestId('motion-disjoint-keys')
        await expect(box).toBeVisible()
        // Let hydration finish before the first interaction: a gesture fired
        // before listeners attach is silently lost.
        await page.waitForTimeout(800)

        // Start the tap from the KEYBOARD, with no hover yet. tap owns `scale`.
        await box.focus()
        await page.keyboard.down('Space')
        await page.waitForTimeout(200)

        // Now hover the element while the tap is active. tap never owned
        // `opacity`, so upstream applies the hover change. The per-gesture gate
        // skipped the whole hover application while tap was active → opacity
        // stayed at 1.
        await box.hover()
        await expect.poll(async () => readOpacity(box), { timeout: 5000 }).toBeLessThan(0.6)

        await page.keyboard.up('Space')
    })

    test('hover exiting while a tap is active restores the non-owned opacity key on release', async ({
        page
    }) => {
        await page.goto('/tests/motion/hover-tap-disjoint-keys?@isPlaywright=true')

        const box = page.getByTestId('motion-disjoint-keys')
        await expect(box).toBeVisible()
        await page.waitForTimeout(800)

        // Hover applies opacity → 0.5.
        await box.hover()
        await expect.poll(async () => readOpacity(box), { timeout: 5000 }).toBeLessThan(0.6)

        // Hold a keyboard tap (owns `scale`), then move the pointer off the
        // element so hover exits WHILE the tap is still active.
        await box.focus()
        await page.keyboard.down('Space')
        await page.waitForTimeout(200)
        await page.mouse.move(5, 5)
        await page.waitForTimeout(200)

        // Release the tap. Upstream restores `opacity` to base because tap never
        // owned it. Before plan 004 the hover-exit was deferred wholesale to tap
        // release, and the tap release only restored `scale` — so opacity stayed
        // stuck at ~0.5.
        await page.keyboard.up('Space')
        await expect.poll(async () => readOpacity(box), { timeout: 5000 }).toBeGreaterThan(0.95)
    })
})
