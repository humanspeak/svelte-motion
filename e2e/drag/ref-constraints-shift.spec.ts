/**
 * Port of upstream `tests/react/drag-ref-constraints-shift.spec.ts`
 * (Motion 14.7.1, `337c7de73`).
 *
 * Ref dragConstraints are measured with the element's layout. When the
 * element and its constraints then move down the page together without
 * either being measured again, the constraints still hold: the element
 * follows the pointer and stops at the constraints' edges.
 *
 * Guard for the #2024 fix: it passes on Motion 14.6.0 too.
 */
import { expect, test, type Page } from '@playwright/test'

const dragBox = async (page: Page) => {
    const box = page.getByTestId('box')
    const constraints = (await page.getByTestId('constraints').boundingBox())!
    const start = (await box.boundingBox())!
    const x = start.x + 10
    const y = start.y + 10

    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 5, y + 5, { steps: 2 })
    await page.mouse.move(x + 20, y + 20, { steps: 5 })
    await page.waitForTimeout(100)
    const moved = (await box.boundingBox())!

    await page.mouse.move(x + 600, y + 600, { steps: 10 })
    await page.waitForTimeout(100)
    const end = (await box.boundingBox())!
    await page.mouse.up()

    // Follows the pointer
    expect(Math.abs(moved.x - start.x - 20)).toBeLessThanOrEqual(1)
    expect(Math.abs(moved.y - start.y - 20)).toBeLessThanOrEqual(1)

    // Stops at the bottom right of its constraints
    expect(Math.abs(end.x + end.width - constraints.x - 300)).toBeLessThanOrEqual(1)
    expect(Math.abs(end.y + end.height - constraints.y - 300)).toBeLessThanOrEqual(1)
}

test('ref constraints hold after content above grows', async ({ page }) => {
    await page.goto('/tests/drag/ref-constraints-shift?@isPlaywright=true')
    await expect(page.getByTestId('box')).toBeVisible()
    await page.waitForTimeout(200)

    await page.evaluate(() => (window as unknown as { grow: () => void }).grow())
    await page.waitForTimeout(200)
    expect((await page.getByTestId('constraints').boundingBox())!.y).toBe(200)

    await dragBox(page)
})

test('ref constraints hold in a sticky header after the page scrolls', async ({ page }) => {
    await page.goto('/tests/drag/ref-constraints-shift?@isPlaywright=true&sticky')
    await expect(page.getByTestId('box')).toBeVisible()
    await page.waitForTimeout(200)

    await page.evaluate(() => window.scrollTo(0, 500))
    await page.waitForTimeout(200)
    expect((await page.getByTestId('constraints').boundingBox())!.y).toBe(0)

    await dragBox(page)
})
