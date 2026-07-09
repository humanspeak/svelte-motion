import { expect, test, type Page } from '@playwright/test'
import { readTransform } from '../_helpers/transform'

/**
 * Framer "drag to close drawer" pattern, ported 1:1 (issue #421).
 *
 * The drawer is a `motion.div` with `drag="y"`, `dragControls`, a bound
 * `style={{ y }}` MotionValue, `dragConstraints={{ top: 0, bottom: 0 }}` and
 * `dragElastic={{ top: 0, bottom: 0.5 }}`. `onDragEnd` closes the drawer when
 * `y.get() >= 100`.
 *
 * Before #421, `drag` never wrote the bound `style` MotionValue, so `y.get()`
 * stayed `0` in `onDragEnd` and the drawer could never be dragged closed. These
 * tests are the regression guard for that fix — and for the double-count bug
 * the first cut of the fix introduced (the offset being applied via both the
 * gesture transform and the style MotionValue).
 */
test.describe('drag/mobile-drawer', () => {
    // translateY of the drawer, via the shared matrix parser used across
    // e2e/drag/*.spec.ts (returns ty=0 on 'none').
    const readY = async (page: Page) => (await readTransform(page, '#drawer')).ty

    const open = async (page: Page) => {
        await page.goto('/tests/mobile-drawer?@isPlaywright=true')
        await page.getByTestId('open-drawer').click()
        await page.getByTestId('drawer').waitFor({ state: 'visible' })
        // Let the enter animation (y: 100% → 0%) settle.
        await page.waitForTimeout(500)
    }

    const dragHandleBy = async (page: Page, distance: number) => {
        const handle = page.getByTestId('drag-handle')
        const box = await handle.boundingBox()
        if (!box) throw new Error('no drag handle')
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        const steps = 20
        for (let i = 1; i <= steps; i++) {
            await page.mouse.move(cx, cy + (distance * i) / steps, { steps: 2 })
            await page.waitForTimeout(16)
        }
        const yAtRelease = await readY(page)
        await page.mouse.up()
        return yAtRelease
    }

    test('dragging the handle past the threshold closes the drawer', async ({ page }) => {
        await open(page)

        // 280px down → ~140px after `bottom: 0.5` elastic, which clears the 100px
        // close threshold. The drawer should animate out and unmount.
        await dragHandleBy(page, 280)

        await expect(page.getByTestId('drawer')).toBeHidden()
        await expect(page.getByTestId('open-drawer')).toBeVisible()
    })

    test('a short drag snaps back and keeps the drawer open', async ({ page }) => {
        await open(page)

        // 120px down → ~60px after elastic, below the 100px threshold. The drawer
        // settles back to y≈0 and stays mounted.
        await dragHandleBy(page, 120)
        await page.waitForTimeout(700)

        await expect(page.getByTestId('drawer')).toBeVisible()
        const settledY = await readY(page)
        expect(settledY).not.toBeNull()
        expect(Math.abs(settledY)).toBeLessThan(5)
    })

    test('the bound y MotionValue is elastic-damped, not double-applied', async ({ page }) => {
        await open(page)

        // Regression guard for #421: the gesture must drive the bound `style`
        // MotionValue without the offset also being composed into the gesture
        // transform. Dragging 280px with `bottom: 0.5` elastic should render
        // ~140px (280 * 0.5), NOT 280px (the double-count) and NOT 0px (the
        // original "value never written" bug).
        const yAtRelease = await dragHandleBy(page, 280)

        expect(yAtRelease).not.toBeNull()
        expect(yAtRelease).toBeGreaterThan(110)
        expect(yAtRelease).toBeLessThan(180)
    })

    test('clicking the backdrop closes the drawer', async ({ page }) => {
        await open(page)

        // Backdrop sits above the 75vh sheet; click near the top to hit it.
        await page.mouse.click(60, 40)
        await expect(page.getByTestId('drawer')).toBeHidden()
    })
})
