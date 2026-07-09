import { expect, test } from '@playwright/test'
import { readTranslateX } from '../_helpers/transform'

/**
 * Regression for pointercancel taking the momentum path. After the fix,
 * cancel forces a no-momentum settle so the card clamps into constraints
 * without flinging.
 *
 * Playwright has no first-class `pointercancel` synth, so we dispatch one
 * directly via the DOM.
 */

test.describe('drag/pointer-cancel', () => {
    test('pointercancel mid-drag clamps without fling', async ({ page }) => {
        await page.goto('/tests/drag/pointer-cancel?@isPlaywright=true')
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })

        // Drag fast rightward past the +100 constraint (elastic 0.18
        // lets the card overdrag visibly). Then fire pointercancel
        // directly from JS — simulating an OS interrupt mid-drag.
        const result = await page.evaluate(async () => {
            const el = document.querySelector<HTMLElement>('[data-testid="drag-card"]')
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
