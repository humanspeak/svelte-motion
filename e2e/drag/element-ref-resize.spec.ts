import { expect, test } from '@playwright/test'

/**
 * Regression for element-ref `dragConstraints` going stale during the
 * inertia animation. Setup: card inside a 400 px wide container with
 * `dragConstraints={containerRef}`. The test drags the card past the
 * right edge of the container, releases (inertia + bounce-back starts),
 * then SHRINKS the container to 200 px wide mid-spring. After the
 * resize the card must end up inside the new (smaller) container —
 * not at the stale 400 px boundary the stepper captured.
 *
 * The fix follows upstream's ref-resize path: observe the draggable
 * element and constraint element, stop any stale post-release animation,
 * then remap the current position into the freshly measured constraints.
 */

const readRect = (page: import('@playwright/test').Page, selector: string) =>
    page.evaluate((sel) => {
        const el = document.querySelector<HTMLElement>(sel)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }
    }, selector)

test.describe('drag/element-ref-resize', () => {
    const dragCardRightAndRelease = async (page: import('@playwright/test').Page) => {
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })

        const start = await readRect(page, '[data-testid="drag-card"]')
        if (!start) throw new Error('no card rect')

        const cx = start.left + (start.right - start.left) / 2
        const cy = start.top + (start.bottom - start.top) / 2

        // Drag the card hard right so the release lands on the right
        // edge of the original container. Use page.mouse so we get real
        // events (Playwright dispatches sub-step pointermoves at frame
        // intervals → proper velocity history).
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + 400, cy, { steps: 12 })
        await page.mouse.up()
    }

    test('container shrink mid-inertia keeps card inside new bounds', async ({ page }) => {
        await page.goto('/tests/drag/element-ref-resize?@isPlaywright=true')

        await dragCardRightAndRelease(page)

        // While the inertia/bounce animation is still running, shrink
        // the container from 400 → 200 px wide. The card was settling
        // at the original ~+160 boundary (relative); the new boundary
        // is ~+60. Pre-fix: the card lands well past the new container
        // right edge. Post-fix: it clamps to the new bounds.
        await page.waitForTimeout(40)
        await page.getByTestId('resize-btn').click()

        // Give the animation time to finish; allow extra for the
        // post-resize clamp/spring to settle.
        await page.waitForTimeout(900)

        const finalCard = await readRect(page, '[data-testid="drag-card"]')
        const finalContainer = await readRect(page, '[data-testid="container"]')
        if (!finalCard || !finalContainer) throw new Error('no rect')

        // The card right edge must not extend past the container right
        // edge (allow 1 px sub-pixel slack). Pre-fix this was tens of
        // px past the new container right.
        expect(finalCard.right).toBeLessThanOrEqual(finalContainer.right + 1)
        // And the card left should be inside the container too (just
        // a sanity check that we didn't yeet it leftward).
        expect(finalCard.left).toBeGreaterThanOrEqual(finalContainer.left - 1)
    })

    test('container grow mid-inertia remaps card into expanded bounds', async ({ page }) => {
        await page.goto('/tests/drag/element-ref-resize?@isPlaywright=true')

        await page.getByTestId('resize-btn').click()
        await expect(page.getByTestId('resize-btn')).toHaveText('Grow to 400')

        const smallContainer = await readRect(page, '[data-testid="container"]')
        if (!smallContainer) throw new Error('no small container rect')
        expect(smallContainer.width).toBeLessThan(250)

        await dragCardRightAndRelease(page)

        // Grow the ref constraint while the card is settling against the
        // small right edge. A stale constraint path would leave the card
        // parked at the old 200 px boundary instead of remapping it to the
        // expanded 400 px boundary.
        await page.waitForTimeout(40)
        await page.getByTestId('resize-btn').click()

        await page.waitForTimeout(900)

        const finalCard = await readRect(page, '[data-testid="drag-card"]')
        const finalContainer = await readRect(page, '[data-testid="container"]')
        if (!finalCard || !finalContainer) throw new Error('no final rect')

        expect(finalContainer.width).toBeGreaterThan(350)
        expect(finalCard.right).toBeLessThanOrEqual(finalContainer.right + 1)
        expect(finalCard.left).toBeGreaterThanOrEqual(finalContainer.left - 1)
        expect(finalCard.right).toBeGreaterThan(smallContainer.right + 20)
    })

    test('slow review mode animates constraint resize for visual inspection', async ({ page }) => {
        await page.goto('/tests/drag/element-ref-resize?@isPlaywright=true&slow')

        const transition = await page.evaluate(() => {
            const container = document.querySelector('[data-testid="container"]')
            if (!(container instanceof HTMLElement)) return null
            const style = getComputedStyle(container)
            return {
                property: style.transitionProperty,
                duration: style.transitionDuration
            }
        })

        expect(transition?.property).toContain('width')
        expect(transition?.duration).toContain('3.2s')
    })
})
