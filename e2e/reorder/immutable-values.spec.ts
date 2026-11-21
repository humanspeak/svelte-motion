import { expect, test, type Page } from '@playwright/test'

/**
 * A `Reorder.Item` whose value object is replaced under a stable `{#each}`
 * key (an immutable update) must re-register under the new object, as
 * upstream does on every render (Motion 14.14.0 `Reorder/Item.tsx:141`).
 * Otherwise arrow keys skip it, the tab stop moves off a replaced first
 * item, and drag or keyboard moves lose its slot. The last two tests guard
 * the slot registration.
 */
const order = (page: Page) =>
    page
        .locator('#order')
        .textContent()
        .then((text) => text?.trim())
const focused = (page: Page) => page.evaluate(() => document.activeElement?.id)
const press = (page: Page, key: string) => page.keyboard.press(key)

/** Open the test page and wait for hydration. */
const open = async (page: Page) => {
    await page.goto('/tests/reorder/immutable-values?@isPlaywright=true')
    await page.locator('#order[data-ready]').waitFor()
}

/** Drag a locator vertically by `dy` px in small steps so each move carries velocity. */
const dragVertically = async (page: Page, testId: string, dy: number) => {
    const item = page.getByTestId(testId)
    const box = await item.boundingBox()
    if (!box) throw new Error(`no bounding box for ${testId}`)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    const steps = Math.max(10, Math.round(Math.abs(dy) / 5))
    for (let i = 1; i <= steps; i++) {
        await page.mouse.move(cx, cy + (i * dy) / steps)
        await page.waitForTimeout(16)
    }
    await page.mouse.up()
}

test.describe('reorder/immutable-values', () => {
    test('arrow keys reach a replaced item', async ({ page }) => {
        await open(page)
        await page.click('#replace-b')
        await expect(page.getByTestId('b')).toHaveText('b r1')
        await page.focus('#before')
        await press(page, 'Tab')
        expect(await focused(page)).toBe('a')
        await press(page, 'ArrowDown')
        expect(await focused(page)).toBe('b')
    })

    test('a replaced first item stays the tab stop', async ({ page }) => {
        await open(page)
        await page.click('#replace-a')
        await expect(page.getByTestId('a')).toHaveText('a r1')
        await page.focus('#before')
        await press(page, 'Tab')
        expect(await focused(page)).toBe('a')
    })

    test('a replaced item can still be dragged', async ({ page }) => {
        await open(page)
        await page.click('#replace-b')
        await expect(page.getByTestId('b')).toHaveText('b r1')
        await dragVertically(page, 'b', 60)
        await expect.poll(() => order(page)).toBe('a,c,b,d')
    })

    test('a replaced item can still be moved by keyboard', async ({ page }) => {
        await open(page)
        await page.click('#replace-b')
        await expect(page.getByTestId('b')).toHaveText('b r1')
        await page.focus('#b')
        await press(page, 'Space')
        await press(page, 'ArrowDown')
        await press(page, 'Space')
        await expect.poll(() => order(page)).toBe('a,c,b,d')
    })
})
