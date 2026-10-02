import { expect, test, type Page } from '@playwright/test'

/**
 * `inherit={false}` stops variant inheritance and propagation, matching
 * Motion 13.5.1 (upstream b63833cb0). Opted-out elements keep their static
 * `opacity: 0.5`; the control scenario inherits normally and must reach 0.8.
 */
test.describe('variants/inherit-false', () => {
    const ROUTE = '/tests/variants/inherit-false?@isPlaywright=true'

    const opacity = (page: Page, id: string) =>
        page.evaluate((testId) => {
            const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
            return el ? Number.parseFloat(getComputedStyle(el).opacity) : -1
        }, id)

    /** Samples opacity for ~300ms and asserts it never leaves 0.5. */
    const expectStaysHalf = async (page: Page, id: string) => {
        for (let i = 0; i < 6; i++) {
            expect(await opacity(page, id), `${id} opacity`).toBeCloseTo(0.5, 2)
            await page.waitForTimeout(50)
        }
    }

    test.beforeEach(async ({ page }) => {
        await page.goto(ROUTE)
        await page.getByTestId('parent-1').waitFor({ state: 'visible' })
    })

    test('control: a child without inherit={false} follows the parent to 0.8', async ({ page }) => {
        await page.getByTestId('switch-control').click()
        await expect.poll(() => opacity(page, 'child-control')).toBeCloseTo(0.8, 2)
    })

    test('1: child does not follow parent variant changes', async ({ page }) => {
        await expectStaysHalf(page, 'child-1')
        await page.getByTestId('switch-1').click()
        await expectStaysHalf(page, 'child-1')
    })

    test('2: descendants of an inherit={false} node with variants do not follow the outer parent', async ({
        page
    }) => {
        await expectStaysHalf(page, 'grandchild-2')
        await page.getByTestId('switch-2').click()
        await expectStaysHalf(page, 'grandchild-2')
    })

    test('3: descendants of a plain inherit={false} node do not follow the outer parent', async ({
        page
    }) => {
        await expectStaysHalf(page, 'grandchild-3')
        await page.getByTestId('switch-3').click()
        await expectStaysHalf(page, 'grandchild-3')
    })

    test('4: child does not follow parent gesture variants', async ({ page }) => {
        await expectStaysHalf(page, 'child-4')
        await page.getByTestId('parent-4').hover()
        await expectStaysHalf(page, 'child-4')
    })
})
