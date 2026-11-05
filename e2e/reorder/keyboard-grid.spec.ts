import { expect, test, type Page } from '@playwright/test'

/**
 * In a grid, Up and Down move a grabbed item to the row above or below,
 * into the column it's in, not one place along the list. Ungrabbed, the
 * arrows move focus the same way, from the group's one tab stop.
 *
 * Port of upstream Motion 14.9.1 `tests/react/reorder-keyboard-grid.spec.ts`
 * (dev page `dev/react/src/tests/reorder-keyboard-grid.tsx`).
 */
const order = (page: Page) => page.locator('#order').textContent()
const focused = (page: Page) => page.evaluate(() => document.activeElement?.id)

/** Open the page and wait for hydration. */
const open = async (page: Page) => {
    await page.goto('/tests/reorder/keyboard-grid?@isPlaywright=true')
    await page.locator('#order[data-ready]').waitFor()
}

test.describe('reorder/keyboard-grid (Motion 14.9)', () => {
    test('arrows move the item the way they point', async ({ page }) => {
        await open(page)
        await page.focus('#item-06')
        await page.keyboard.press(' ')

        /*
         * 01 02 03 04
         * 05 06 07 08
         * 09 10 11 12
         * 13 14
         */
        const steps: [string, string][] = [
            ['ArrowDown', '01,02,03,04,05,07,08,09,10,06,11,12,13,14'],
            // Into the short last row, by the column it's nearest
            ['ArrowDown', '01,02,03,04,05,07,08,09,10,11,12,13,14,06'],
            // Nothing below the last row
            ['ArrowDown', '01,02,03,04,05,07,08,09,10,11,12,13,14,06'],
            ['ArrowLeft', '01,02,03,04,05,07,08,09,10,11,12,13,06,14'],
            ['ArrowUp', '01,02,03,04,05,07,08,09,06,10,11,12,13,14'],
            ['ArrowUp', '01,02,03,04,06,05,07,08,09,10,11,12,13,14'],
            ['ArrowUp', '06,01,02,03,04,05,07,08,09,10,11,12,13,14'],
            // Nothing above the first row
            ['ArrowUp', '06,01,02,03,04,05,07,08,09,10,11,12,13,14'],
            ['ArrowRight', '01,06,02,03,04,05,07,08,09,10,11,12,13,14']
        ]

        for (const [key, expected] of steps) {
            await page.keyboard.press(key)
            await expect.poll(() => order(page)).toBe(expected)
        }

        expect(await focused(page)).toBe('item-06')
    })

    test('arrows move focus the same way, from one tab stop', async ({ page }) => {
        await open(page)

        // One Tab into the grid, and the next out of it
        await page.focus('#before')
        await page.keyboard.press('Tab')
        expect(await focused(page)).toBe('item-01')
        await page.keyboard.press('Tab')
        expect(await focused(page)).toBe('after')

        await page.keyboard.press('Shift+Tab')
        expect(await focused(page)).toBe('item-01')
        const steps: [string, string][] = [
            ['ArrowDown', 'item-05'],
            ['ArrowRight', 'item-06'],
            ['ArrowDown', 'item-10'],
            ['ArrowDown', 'item-14'],
            // Nothing below the last row
            ['ArrowDown', 'item-14'],
            ['ArrowUp', 'item-10'],
            ['ArrowLeft', 'item-09'],
            // Left and Right go along the order, so on to the row above
            ['ArrowLeft', 'item-08']
        ]
        for (const [key, expected] of steps) {
            await page.keyboard.press(key)
            expect(await focused(page)).toBe(expected)
        }

        // The last focused item is now the tab stop
        await page.keyboard.press('Tab')
        expect(await focused(page)).toBe('after')
        await page.keyboard.press('Shift+Tab')
        expect(await focused(page)).toBe('item-08')
        expect(await order(page)).toBe('01,02,03,04,05,06,07,08,09,10,11,12,13,14')
    })
})
