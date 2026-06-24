import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/layout-dependency?@isPlaywright=true'

const readCount = (page: Page, testId: string) => async () => {
    const text = (await page.getByTestId(testId).textContent()) ?? ''
    const match = text.match(/(\d+)/)
    return match ? Number(match[1]) : Number.NaN
}

const waitForMotionReady = async (page: Page, testId: string) => {
    await expect(page.getByTestId(testId)).toHaveAttribute('data-is-loaded', 'ready')
}

test.describe('layoutDependency (#314)', () => {
    test('gated box does not re-measure on unrelated renders; ungated box does', async ({
        page
    }) => {
        await page.goto(URL)
        await waitForMotionReady(page, 'default-box')
        await waitForMotionReady(page, 'gated-box')

        // Zero the counters so we only measure clicks we control.
        await page.getByTestId('reset').click()
        await expect.poll(readCount(page, 'default-measures')).toBe(0)
        await expect.poll(readCount(page, 'gated-measures')).toBe(0)

        // Five unrelated renders (color ticks). The ungated box re-measures
        // each time; the gated box (dep unchanged) must not.
        for (let i = 0; i < 5; i++) {
            await page.getByTestId('tick').click()
        }

        await expect.poll(readCount(page, 'default-measures')).toBeGreaterThanOrEqual(5)
        await expect.poll(readCount(page, 'gated-measures')).toBe(0)
    })

    test('gated box re-measures exactly once when layoutDependency changes', async ({ page }) => {
        await page.goto(URL)
        await waitForMotionReady(page, 'gated-box')

        await page.getByTestId('reset').click()
        await expect.poll(readCount(page, 'gated-measures')).toBe(0)

        // Render a few times — still gated.
        for (let i = 0; i < 3; i++) {
            await page.getByTestId('tick').click()
        }
        await expect.poll(readCount(page, 'gated-measures')).toBe(0)

        // Bumping the dependency lets the gated box measure (and FLIP).
        await page.getByTestId('reflow').click()
        await expect.poll(readCount(page, 'gated-measures')).toBe(1)

        // A second reflow bumps it again — proves it tracks the dependency.
        await page.getByTestId('reflow').click()
        await expect.poll(readCount(page, 'gated-measures')).toBe(2)
    })
})

// Upstream MeasureLayout also forces a snapshot while dragging and on presence
// changes, regardless of layoutDependency. The drag case is handled by an
// explicit escape hatch in the gate; the presence case flows through the
// observer path. Both panels hold the dependency constant (never bumped).
test.describe('layoutDependency escape hatches', () => {
    test('drag forces measurement on renders; non-drag box stays gated', async ({ page }) => {
        await page.goto(URL)
        await waitForMotionReady(page, 'drag-box')
        await waitForMotionReady(page, 'nodrag-box')

        await page.getByTestId('reset').click()
        await expect.poll(readCount(page, 'drag-measures')).toBe(0)
        await expect.poll(readCount(page, 'nodrag-measures')).toBe(0)

        for (let i = 0; i < 5; i++) {
            await page.getByTestId('tick').click()
        }

        // drag overrides the gate → re-measures every render.
        await expect.poll(readCount(page, 'drag-measures')).toBeGreaterThanOrEqual(5)
        // same constant dependency, no drag → stays gated.
        await expect.poll(readCount(page, 'nodrag-measures')).toBe(0)
    })

    test('gated box ignores renders but measures on AnimatePresence sibling toggle', async ({
        page
    }) => {
        // Use a tall viewport so the whole page fits without scrolling: the
        // projection deliberately suppresses the layout commit that follows a
        // viewport scroll (so scrolling never triggers FLIP), and it skips
        // commits for fully-offscreen elements — both would mask the reflow.
        await page.setViewportSize({ width: 1280, height: 1400 })
        await page.goto(URL)
        await waitForMotionReady(page, 'presence-gated-box')

        await page.getByTestId('reset').click()
        await expect.poll(readCount(page, 'presence-measures')).toBe(0)

        // Renders alone must not measure the gated box.
        for (let i = 0; i < 4; i++) {
            await page.getByTestId('tick').click()
        }
        await expect.poll(readCount(page, 'presence-measures')).toBe(0)

        const boxTop = () =>
            page
                .getByTestId('presence-gated-box')
                .evaluate((el) => Math.round(el.getBoundingClientRect().top))
        const startTop = await boxTop()

        // Sibling exits → real layout shift → gated box reflows up and measures.
        await page.getByTestId('toggle-sibling').click()
        await expect.poll(readCount(page, 'presence-measures')).toBeGreaterThanOrEqual(1)
        await expect(page.getByTestId('presence-sibling')).toHaveCount(0)
        await expect.poll(boxTop).toBeLessThan(startTop)

        // Sibling re-enters → box reflows back down.
        await page.getByTestId('toggle-sibling').click()
        await expect(page.getByTestId('presence-sibling')).toHaveCount(1)
        await expect.poll(boxTop).toBe(startTop)
    })
})
