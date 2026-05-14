import { expect, test } from '@playwright/test'
import { readTranslateX } from '../_helpers/transform'

/**
 * `dragControls.stop()` / `.cancel()` MUST stop an in-flight release
 * inertia animation, not silently no-op.
 */

test.describe('drag/controls cancel inertia', () => {
    test('stop() freezes the card mid-release spring-back', async ({ page }) => {
        await page.goto('/tests/drag/controls-cancel-inertia?@isPlaywright=true')
        const card = page.getByTestId('drag-card')
        const stopBtn = page.getByTestId('stop-btn')
        await card.waitFor({ state: 'visible' })

        // Drag well past the right constraint (+100) with elastic 0.18 →
        // the card visually sits past +100 during the drag and will
        // spring back over ~700ms after release.
        const s = await card.boundingBox()
        if (!s) throw new Error('no card bbox')
        const cx = s.x + s.width / 2
        const cy = s.y + s.height / 2
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 12; i++) {
            await page.mouse.move(cx + i * 30, cy, { steps: 1 })
        }
        await page.mouse.up()

        await page.waitForTimeout(80)
        const midX = await readTranslateX(page)
        await stopBtn.click()
        await page.waitForTimeout(300)
        const afterStopX = await readTranslateX(page)

        // The cancel hook fires and rAF stops, but 1–2 frames (~7–20 px)
        // of spring motion can elapse between sampling midX and the
        // click resolving. The real fix-vs-no-fix signal is assertion
        // (2): pre-fix the card settled at +100, post-fix it freezes
        // wherever stop() caught it (well short of +100).
        expect(Math.abs(afterStopX - midX)).toBeLessThanOrEqual(35)
        expect(Math.abs(afterStopX - 100)).toBeGreaterThan(5)
    })
})
