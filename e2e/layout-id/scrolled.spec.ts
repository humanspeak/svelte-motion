import { expect, test, type Page } from '@playwright/test'
import { sampleTransformSeries } from '../_helpers/transform'

const URL = '/tests/layout-id/scrolled?@isPlaywright=true'

/** Scroll the window so the stages (below the 1400px spacer) are at the top. */
const scrollToStages = async (page: Page) => {
    await page.evaluate(() =>
        document.querySelector('[data-testid="toggle"]')!.scrollIntoView({ block: 'start' })
    )
    await page.waitForTimeout(300)
}

/**
 * The boxes move horizontally inside a fixed-height row. A correct shared
 * layout handoff therefore keeps |ty| near zero for the whole transition; a
 * handoff that mixes viewport and page coordinates starts `scrollY` pixels
 * off and flies in vertically.
 */
const expectHorizontalHandoff = async (page: Page, testId: string) => {
    const scrollY = await page.evaluate(() => window.scrollY)
    expect(scrollY).toBeGreaterThan(800)

    await page.getByTestId('toggle').click()
    const samples = await sampleTransformSeries(page, [`[data-testid="${testId}"]`], 500)

    const moved = samples.filter((s) => Math.abs(s.tx) > 20)
    expect(moved.length, `expected horizontal motion: ${JSON.stringify(samples)}`).toBeGreaterThan(
        0
    )
    const maxTy = Math.max(...samples.map((s) => Math.abs(s.ty)))
    expect(
        maxTy,
        `vertical drift during a horizontal handoff: ${JSON.stringify(samples)}`
    ).toBeLessThan(40)
}

test.describe('layoutId handoff on a scrolled page', () => {
    test('plain {#if} swap does not fly in from the scroll offset', async ({ page }) => {
        await page.goto(URL)
        await expect(page.getByTestId('plain-box')).toHaveAttribute('data-is-loaded', 'ready')
        await scrollToStages(page)
        await expectHorizontalHandoff(page, 'plain-box')
    })

    test('AnimatePresence swap (control) stays horizontal', async ({ page }) => {
        await page.goto(URL)
        await expect(page.getByTestId('ap-box')).toHaveAttribute('data-is-loaded', 'ready')
        await scrollToStages(page)
        await expectHorizontalHandoff(page, 'ap-box')
    })
})
