import { expect, test, type Page } from '@playwright/test'

/**
 * Port of upstream
 * `packages/framer-motion/cypress/integration/layout-group-interrupt-measurements.ts`
 * (Motion v13.4.5) against `/tests/layout/layout-group-interrupt`.
 *
 * Counts getBoundingClientRect reads of #button when toggling #expander
 * re-measures #text-wrapper. #button is in its own LayoutGroup, so it should
 * only be re-measured while it's layout animating.
 *
 * Clicks are dispatched natively so Playwright actionability checks don't add
 * reads. Only `getBoundingClientRect` is counted, like upstream.
 */
type ReadsWindow = Window & { reads: Record<string, number> }

async function visit(page: Page) {
    await page.setViewportSize({ width: 500, height: 500 })
    await page.addInitScript(() => {
        const w = window as unknown as ReadsWindow
        w.reads = {}
        const getBoundingClientRect = Object.getOwnPropertyDescriptor(
            Element.prototype,
            'getBoundingClientRect'
        )!.value as (this: Element) => DOMRect
        Element.prototype.getBoundingClientRect = function (this: Element) {
            if (this.id) w.reads[this.id] = (w.reads[this.id] || 0) + 1
            return getBoundingClientRect.call(this)
        }
    })
    await page.goto('/tests/layout/layout-group-interrupt?@isPlaywright=true')
    await page.waitForFunction(() => !!document.getElementById('button'))
    await page.waitForTimeout(250)
}

async function click(page: Page, id: string) {
    await page.evaluate((target) => {
        ;(window as unknown as ReadsWindow).reads = {}
        document.getElementById(target)!.click()
    }, id)
    await page.waitForTimeout(300)
}

const reads = (page: Page, id: string) =>
    page.evaluate((target) => (window as unknown as ReadsWindow).reads[target] || 0, id)

async function expectReads(page: Page, id: string, count: number) {
    expect(await reads(page, id)).toBe(count)
}

async function expectMeasured(page: Page, id: string) {
    expect(await reads(page, id)).toBeGreaterThan(0)
}

test.describe('LayoutGroup inherit="id" measurements', () => {
    // Red on 2026-09-28: #text-wrapper is never re-measured when #expander toggles (reads 0). Plan 007 (LayoutGroup node groups) + Plan 006 (motion-dom 13.4.5) must turn this green.
    test.fail("doesn't re-measure a relative child that isn't animating", async ({ page }) => {
        await visit(page)
        await click(page, 'expander')
        await expectMeasured(page, 'text-wrapper')
        await expectReads(page, 'button', 0)
        await click(page, 'expander')
        await expectMeasured(page, 'text-wrapper')
        await expectReads(page, 'button', 0)
    })

    // Red on 2026-09-28: #text-wrapper is never re-measured when #expander toggles (reads 0). Plan 007 (LayoutGroup node groups) + Plan 006 (motion-dom 13.4.5) must turn this green.
    test.fail(
        're-measures a layout-animating relative child once per parent re-layout',
        async ({ page }) => {
            await visit(page)
            // Starts #button's 10s layout animation
            await click(page, 'button')
            await click(page, 'expander')
            await expectMeasured(page, 'text-wrapper')
            await expectReads(page, 'button', 1)
            await click(page, 'expander')
            await expectMeasured(page, 'text-wrapper')
            await expectReads(page, 'button', 1)
        }
    )
})
