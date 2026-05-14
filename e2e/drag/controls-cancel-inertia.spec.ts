import { expect, test } from '@playwright/test'

/**
 * `dragControls.stop()` / `.cancel()` MUST stop an in-flight release
 * inertia animation, not silently no-op. Previously the dragControls
 * factory accepted a `cancelInertia` callback in its `_bind` hook, but
 * `attachDrag` never passed one — so once a release-momentum animation
 * was running, programmatic stop calls had no effect.
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

        // Mid-snap-back (~80ms in), the card has moved partway toward 100
        // but is not yet settled. Snapshot, then call stop().
        await page.waitForTimeout(80)
        const midX = await readTranslateX(page)
        if (midX === null) throw new Error('no transform')

        await stopBtn.click()

        // Give the page another 300ms. If stop() worked, the card stays
        // where it was when stop() fired. If stop() is a no-op (the bug),
        // the spring continues and the card settles at +100.
        await page.waitForTimeout(300)
        const afterStopX = await readTranslateX(page)
        if (afterStopX === null) throw new Error('no transform after stop')

        // Asserting two things:
        //   (1) The card did not continue animating after stop().
        //       afterStopX should be near midX, allowing for the one or
        //       two rAF ticks that elapse between sampling midX and the
        //       click actually firing (~7-15 px at this stiffness).
        //   (2) The card is NOT at the rest position (+100). If stop()
        //       were a no-op (the bug), afterStopX would be 100 (settled).
        // The cancel hook *does* fire and the rAF *does* stop — verified
        // via pwLog in the dev page (❌ MOMENTUM CANCELLED + 🛑 RAF
        // stopped). What this test cannot tightly bound is how many
        // animation frames fire between the `midX` snapshot and the
        // `stopBtn.click()` actually resolving — typically 1-2 frames
        // of spring motion (~7-20 px) creep in. The second assertion
        // below is the real fix-vs-no-fix signal: with the bug,
        // afterStopX would be ~100 (the rest position); with the fix
        // it stays well short of that.
        expect(Math.abs(afterStopX - midX)).toBeLessThanOrEqual(35)
        expect(Math.abs(afterStopX - 100)).toBeGreaterThan(5)
    })
})
