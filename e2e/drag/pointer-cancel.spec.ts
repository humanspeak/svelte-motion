import { expect, test } from '@playwright/test'

/**
 * Regression for pointercancel running the full momentum / inertia path.
 *
 * `pointercancel` fires when the OS preempts a drag (gesture-nav, palm
 * rejection, scroll takeover). The user didn't release intentionally;
 * the gesture was interrupted. Running momentum in that case flings
 * the card unexpectedly. After the fix, finishDrag treats cancel as a
 * forced no-momentum settle — the card clamps back into constraints
 * without any inertia.
 *
 * Playwright doesn't have a first-class `pointercancel` synth, so we
 * dispatch one directly via the DOM.
 */

const readTranslateX = async (page: import('@playwright/test').Page) => {
    return page.evaluate(() => {
        const el = document.querySelector('[data-testid="drag-card"]') as HTMLElement | null
        if (!el) return null
        const t = window.getComputedStyle(el).transform
        const m = t.match(/matrix\(([^)]+)\)/)
        if (!m) return 0
        const parts = m[1].split(',').map((s) => Number.parseFloat(s.trim()))
        return parts[4] ?? 0
    })
}

test.describe('drag/pointer-cancel', () => {
    test('pointercancel mid-drag clamps without fling', async ({ page }) => {
        await page.goto('/tests/drag/pointer-cancel?@isPlaywright=true')
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })

        // Drag fast rightward past the +100 constraint (elastic 0.18
        // lets the card overdrag visibly). Then fire pointercancel
        // directly from JS — simulating an OS interrupt mid-drag.
        const result = await page.evaluate(async () => {
            const el = document.querySelector('[data-testid="drag-card"]') as HTMLElement | null
            if (!el) throw new Error('no card')
            const r = el.getBoundingClientRect()
            const cx = r.left + r.width / 2
            const cy = r.top + r.height / 2
            const send = (type: string, x: number, y: number) =>
                el.dispatchEvent(
                    new PointerEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        pointerType: 'mouse',
                        clientX: x,
                        clientY: y,
                        button: 0,
                        buttons: type === 'pointercancel' || type === 'pointerup' ? 0 : 1,
                        isPrimary: true,
                        pointerId: 1
                    })
                )
            send('pointerdown', cx, cy)
            for (let i = 1; i <= 8; i++) {
                send('pointermove', cx + i * 30, cy)
                await new Promise((r) => setTimeout(r, 6))
            }
            // Cancel mid-drag.
            send('pointercancel', cx + 240, cy)
            return null
        })
        expect(result).toBeNull()

        // After cancel + settle (~400 ms), card must be inside +100. No
        // inertia means no overshoot past the boundary either.
        await page.waitForTimeout(400)
        const afterCancel = await readTranslateX(page)
        if (afterCancel === null) throw new Error('no transform')
        // Allow 1 px sub-pixel tolerance — animation settles exactly on
        // the constraint edge.
        expect(afterCancel).toBeGreaterThanOrEqual(-101)
        expect(afterCancel).toBeLessThanOrEqual(101)
        // Specifically: card should sit close to the +100 right edge
        // (where elastic was clamping it pre-cancel), not at the raw
        // pointer-driven position (~240). With momentum it would have
        // flung well past +100 before the bounce spring caught it.
        expect(afterCancel).toBeGreaterThanOrEqual(95)
    })
})
