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
    const resizeIdleContainer = async (page: import('@playwright/test').Page, width: number) => {
        await page.getByTestId('idle-container').evaluate(
            (element, nextWidth) =>
                new Promise<void>((resolve) => {
                    const observer = new ResizeObserver((entries) => {
                        if (
                            !entries.some(
                                (entry) => Math.abs(entry.contentRect.width - nextWidth) < 0.1
                            )
                        )
                            return
                        observer.disconnect()
                        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
                    })
                    observer.observe(element)
                    element.style.width = `${nextWidth}px`
                }),
            width
        )
    }

    const idleOffset = async (page: import('@playwright/test').Page) => {
        const card = await readRect(page, '[data-testid="idle-card"]')
        const container = await readRect(page, '[data-testid="idle-container"]')
        if (!card || !container) throw new Error('missing asymmetric fixture')
        return card.left - container.left
    }

    test('untouched asymmetric card keeps its authored offset through DOM-only shrink and grow', async ({
        page
    }) => {
        await page.goto('/tests/drag/element-ref-resize?@isPlaywright=true')
        await expect(page.getByTestId('idle-card')).toBeVisible()
        // Prove client hydration and a fresh drag attachment before changing
        // only DOM geometry; an SSR-only resize would not exercise the observer.
        await page
            .getByTestId('idle-card')
            .evaluate((element) => (element.dataset.marker = 'before-reset'))
        await page.getByTestId('idle-reset').click()
        await expect(page.getByTestId('idle-card')).not.toHaveAttribute(
            'data-marker',
            'before-reset'
        )
        const initial = await idleOffset(page)
        for (const width of [200, 400, 200, 400]) {
            await resizeIdleContainer(page, width)
            await expect
                .poll(async () => Math.abs((await idleOffset(page)) - initial))
                .toBeLessThan(0.5)
        }
    })

    test('dragged asymmetric card still remaps and Reset restores its resting origin', async ({
        page
    }) => {
        await page.goto('/tests/drag/element-ref-resize?@isPlaywright=true')
        const initial = await idleOffset(page)
        await page.getByTestId('idle-card').scrollIntoViewIfNeeded()
        const card = await page.getByTestId('idle-card').boundingBox()
        if (!card) throw new Error('missing asymmetric card')
        await page.mouse.move(card.x + 40, card.y + 40)
        await page.mouse.down()
        await page.mouse.move(card.x + 120, card.y + 40, { steps: 8 })
        await page.mouse.up()
        await expect.poll(() => idleOffset(page)).toBeGreaterThan(initial + 70)
        const dragged = await idleOffset(page)
        await resizeIdleContainer(page, 200)
        await expect.poll(() => idleOffset(page)).toBeLessThan(dragged - 40)
        await resizeIdleContainer(page, 400)
        await expect
            .poll(async () => Math.abs((await idleOffset(page)) - dragged))
            .toBeLessThan(0.5)
        await page.getByTestId('idle-reset').click()
        await expect
            .poll(async () => Math.abs((await idleOffset(page)) - initial))
            .toBeLessThan(0.5)
        await resizeIdleContainer(page, 200)
        await expect
            .poll(async () => Math.abs((await idleOffset(page)) - initial))
            .toBeLessThan(0.5)
    })

    const dragCardRightAndRelease = async (page: import('@playwright/test').Page) => {
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })
        await card.scrollIntoViewIfNeeded()

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

    test('guided resting controls report measured geometry and reset the movement delta', async ({
        page
    }) => {
        await page.goto('/tests/drag/element-ref-resize?@isPlaywright=true')
        await expect(page.getByTestId('idle-metric-width')).toHaveText('400.0 px')
        await expect(page.getByTestId('idle-metric-inset')).toHaveText('40.0 px')
        for (const [button, width] of [
            ['idle-shrink', 200],
            ['idle-grow', 400]
        ] as const) {
            await page.getByTestId(button).click()
            await expect(page.getByTestId('idle-metric-width')).toHaveText(`${width}.0 px`)
            await expect(page.getByTestId('idle-metric-delta')).toHaveText('0.0 px')
            await expect(page.getByTestId('idle-metric-overflow')).toHaveText('0.0 px')
        }
        await page.getByTestId('idle-card').scrollIntoViewIfNeeded()
        const card = await page.getByTestId('idle-card').boundingBox()
        if (!card) throw new Error('missing asymmetric card')
        await page.mouse.move(card.x + 40, card.y + 40)
        await page.mouse.down()
        await page.mouse.move(card.x + 120, card.y + 40, { steps: 8 })
        await page.mouse.up()
        await expect
            .poll(async () =>
                Number.parseFloat(await page.getByTestId('idle-metric-delta').innerText())
            )
            .toBeGreaterThan(70)
        await expect
            .poll(async () => {
                const reported = Number.parseFloat(
                    await page.getByTestId('idle-metric-inset').innerText()
                )
                return Math.abs(reported - ((await idleOffset(page)) - 2))
            })
            .toBeLessThan(0.1)
        await page.getByTestId('idle-reset').click()
        await expect(page.getByTestId('idle-metric-width')).toHaveText('400.0 px')
        await expect(page.getByTestId('idle-metric-inset')).toHaveText('40.0 px')
        await expect(page.getByTestId('idle-metric-delta')).toHaveText('0.0 px')
        await expect(page.getByTestId('idle-metric-bounds')).toContainText('Inside bounds')
    })

    test('momentum reset restores a centered full-size fixture and fresh metrics in slow mode', async ({
        page
    }) => {
        await page.goto('/tests/drag/element-ref-resize?@isPlaywright=true&slow')
        await page.getByTestId('resize-btn').click()
        await expect
            .poll(async () =>
                Number.parseFloat(await page.getByTestId('momentum-metric-width').innerText())
            )
            .toBeLessThan(250)
        await page
            .getByTestId('drag-card')
            .evaluate((element) => (element.dataset.marker = 'before-reset'))
        await page.getByTestId('momentum-reset').click()
        await expect(page.getByTestId('drag-card')).not.toHaveAttribute(
            'data-marker',
            'before-reset'
        )
        await expect(page.getByTestId('resize-btn')).toHaveText('Shrink to 200')
        const geometry = await page.getByTestId('container').evaluate((container) => {
            const card = container.querySelector('[data-testid="drag-card"]')!
            const bounds = container.getBoundingClientRect()
            const rect = card.getBoundingClientRect()
            const style = getComputedStyle(container)
            return {
                width:
                    bounds.width -
                    Number.parseFloat(style.borderLeftWidth) -
                    Number.parseFloat(style.borderRightWidth),
                inset: rect.left - bounds.left - Number.parseFloat(style.borderLeftWidth)
            }
        })
        expect(geometry.width).toBe(396)
        expect(geometry.inset).toBe(158)
        await expect(page.getByTestId('momentum-metric-width')).toHaveText(
            `${geometry.width.toFixed(1)} px`
        )
        await expect(page.getByTestId('momentum-metric-inset')).toHaveText(
            `${geometry.inset.toFixed(1)} px`
        )
        await expect(page.getByTestId('momentum-metric-delta')).toHaveText('0.0 px')
        await expect(page.getByTestId('momentum-metric-overflow')).toHaveText('0.0 px')
    })

    test('narrow screens keep fixed-size fixtures inside local scrolling regions', async ({
        page
    }) => {
        await page.setViewportSize({ width: 375, height: 812 })
        await page.goto('/tests/drag/element-ref-resize?@isPlaywright=true')
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
            375
        )
        await expect(page.getByTestId('idle-container')).toHaveCSS('width', '400px')
        await expect(page.getByTestId('container')).toHaveCSS('width', '400px')
        for (const name of ['Blue card drag area', 'Orange card drag area']) {
            const region = page.getByRole('region', { name: new RegExp(name) })
            expect(
                await region.evaluate((element) => element.scrollWidth > element.clientWidth)
            ).toBe(true)
            await region.evaluate((element) => (element.scrollLeft = 80))
            expect(await region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
        }
        await expect(page.getByTestId('idle-metric-inset')).toHaveText('40.0 px')
        await expect(page.getByTestId('momentum-metric-inset')).toHaveText('158.0 px')
        await page.getByTestId('idle-shrink').click()
        await expect(page.getByTestId('idle-metric-width')).toHaveText('200.0 px')
        await page.getByTestId('idle-reset').click()
        await expect(page.getByTestId('idle-metric-inset')).toHaveText('40.0 px')
    })
})
