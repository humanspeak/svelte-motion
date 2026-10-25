import { expect, test } from '@playwright/test'
import { readTranslateX } from '../_helpers/transform'

/**
 * `pointercancel` ends a drag exactly like `pointerup`, momentum included, as
 * in Motion.
 *
 * Motion 14.5's `PanSession` listens for `pointercancel` with the same
 * `handlePointerUp` handler as `pointerup` (motion-dom
 * `gestures/pan/PanSession.ts:137-148` @ v14.5.0). The only difference is the
 * point: a cancel reuses the last move's info (`:315-319`). `onSessionEnd`
 * then reaches `VisualElementDragControls.stop()`, which starts the momentum
 * animation from the release velocity and fires `onDragEnd`
 * (`VisualElementDragControls.ts:290-305`).
 *
 * Playwright has no first-class `pointercancel` synth, so we dispatch one
 * directly via the DOM.
 */

test.describe('drag/pointer-cancel', () => {
    test('pointercancel mid-drag keeps momentum, like pointerup', async ({ page }) => {
        await page.goto('/tests/drag/pointer-cancel?@isPlaywright=true')
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })

        // Drag fast rightward past the +100 constraint (elastic 0.18 lets the
        // card overdrag visibly), then fire pointercancel directly from JS —
        // simulating an OS interrupt mid-drag. Sample every frame afterwards.
        const { atCancel, peak } = await page.evaluate(async () => {
            const el = document.querySelector<HTMLElement>('[data-testid="drag-card"]')
            if (!el) throw new Error('no card')
            const readX = () => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41
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
            const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))
            send('pointerdown', cx, cy)
            for (let i = 1; i <= 8; i++) {
                send('pointermove', cx + i * 30, cy)
                await new Promise((resolve) => setTimeout(resolve, 6))
            }
            await nextFrame()
            const atCancel = readX()
            send('pointercancel', cx + 240, cy)
            let peak = atCancel
            const startedAt = performance.now()
            while (performance.now() - startedAt < 400) {
                await nextFrame()
                peak = Math.max(peak, readX())
            }
            return { atCancel, peak }
        })

        // The card was overdragged past the +100 edge when the cancel landed.
        expect(atCancel).toBeGreaterThan(100)
        // Momentum: the release velocity carries the card further right before
        // the constraint spring brings it back. A no-momentum settle would only
        // ever move left from `atCancel`.
        expect(peak, `peak ${peak.toFixed(1)} vs ${atCancel.toFixed(1)} at cancel`).toBeGreaterThan(
            atCancel + 5
        )
        // `onDragEnd` fired with the release velocity (the pointerup path).
        await expect
            .poll(async () => Number(await card.getAttribute('data-end-velocity-x')))
            .toBeGreaterThan(0)

        // It still comes to rest on the +100 constraint edge.
        await expect
            .poll(async () => Math.abs((await readTranslateX(page)) - 100), { timeout: 4000 })
            .toBeLessThanOrEqual(1)
    })
})
