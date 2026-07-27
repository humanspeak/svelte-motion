import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/animate-presence/owned-child?@isPlaywright=true'

const gotoOwnedChild = async (page: Page): Promise<void> => {
    await page.goto(URL)
    await page.waitForFunction(() => window.MotionIsMounted === true)
}

test.describe('AnimatePresence owned child', () => {
    test('retains and exits the original node without creating a clone', async ({ page }) => {
        await gotoOwnedChild(page)
        const child = page.getByTestId('owned-child')
        const original = await child.elementHandle()
        expect(original).toBeTruthy()

        // This case isolates ordinary removal after the initial enter settles.
        await page.waitForTimeout(900)
        await page.getByTestId('owned-toggle').click()
        await expect(child).toHaveCount(1)
        await page.waitForTimeout(120)

        expect(await child.evaluate((node, before) => node === before, original)).toBe(true)
        expect(
            await child.evaluate((node) => Number.parseFloat(getComputedStyle(node).opacity))
        ).toBeLessThan(0.95)
        await expect(page.locator('[data-clone="true"]')).toHaveCount(0)

        await expect(child).toHaveCount(0)
        await expect(page.getByTestId('owned-exit-count')).toHaveText('exits completed: 1')
    })

    test('completes when removed during the initial enter animation', async ({ page }) => {
        await gotoOwnedChild(page)
        const child = page.getByTestId('owned-child')
        await expect(child).toHaveCount(1)

        // Hydration is complete, but the 800ms initial enter is still running.
        await page.getByTestId('owned-toggle').click()

        await expect(page.locator('[data-clone="true"]')).toHaveCount(0)
        await expect(child).toHaveCount(0)
        await expect(page.getByTestId('owned-exit-count')).toHaveText('exits completed: 1')
    })

    test('preserves live canvas pixels and focus while exiting', async ({ page }) => {
        await gotoOwnedChild(page)
        const input = page.getByTestId('owned-input')
        const canvas = page.getByTestId('owned-canvas')
        await expect
            .poll(async () =>
                canvas.evaluate(
                    (node: HTMLCanvasElement) =>
                        node.getContext('2d')!.getImageData(12, 12, 1, 1).data[3]
                )
            )
            .toBe(255)
        await input.focus()

        await page
            .getByTestId('owned-toggle')
            .evaluate((button: HTMLButtonElement) => button.click())
        await page.waitForTimeout(120)

        await expect(input).toBeFocused()
        const pixel = await canvas.evaluate((node: HTMLCanvasElement) => [
            ...node.getContext('2d')!.getImageData(12, 12, 1, 1).data
        ])
        expect(pixel[1]).toBeGreaterThan(pixel[0])
        expect(pixel[1]).toBeGreaterThan(pixel[2])
        expect(pixel[3]).toBe(255)
        await expect(page.locator('[data-clone="true"]')).toHaveCount(0)
    })

    test('cancels an exit on re-entry without replacing the node', async ({ page }) => {
        await gotoOwnedChild(page)
        const child = page.getByTestId('owned-child')
        const original = await child.elementHandle()

        await page.getByTestId('owned-toggle').click()
        await page.waitForTimeout(120)
        await page.getByTestId('owned-toggle').click()

        await expect(child).toBeVisible()
        expect(await child.evaluate((node, before) => node === before, original)).toBe(true)
        await page.waitForTimeout(550)
        await expect(child).toBeVisible()
        await expect(page.locator('[data-clone="true"]')).toHaveCount(0)
    })

    test('shows the clone and real-node mechanisms side by side', async ({ page }) => {
        await gotoOwnedChild(page)
        await page.getByTestId('compare-exit').click()
        await page.waitForTimeout(120)

        const legacyExit = page.locator('[data-testid="legacy-child"][data-clone="true"]')
        await expect(legacyExit).toHaveCount(1)
        await expect(legacyExit).toHaveAttribute('aria-hidden', 'true')
        expect(await legacyExit.evaluate((node) => (node as HTMLElement).inert)).toBe(true)

        const ownedExit = page.getByTestId('owned-child')
        await expect(ownedExit).toHaveCount(1)
        await expect(ownedExit).not.toHaveAttribute('data-clone', 'true')
    })

    test('keeps the owned-child harness linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(
            page.getByRole('link', { name: 'Clone vs owned child (real-node exit)' })
        ).toHaveAttribute('href', /\/tests\/animate-presence\/owned-child/)
    })
})
