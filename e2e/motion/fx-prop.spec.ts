import { expect, test } from '@playwright/test'

/**
 * Motion 14.14.0 `fx` prop: a truthy `fx` renders an empty `fx` attribute and
 * a falsy one renders none.
 *
 * Port of upstream `framer-motion/src/motion/__tests__/fx-prop.test.tsx` at
 * v14.14.0 (behaviour from `render/dom/utils/filter-props.ts:32-39`), against
 * the tester page `/tests/motion/fx-prop`.
 */

const URL = '/tests/motion/fx-prop?@isPlaywright=true'

test.describe('fx prop', () => {
    test('toggles between an empty fx attribute and none', async ({ page }) => {
        await page.goto(URL)
        const box = page.locator('#box')
        const toggle = page.locator('#toggle')

        await expect(box).toHaveAttribute('fx', '')
        await expect(page.locator('#attr')).toHaveText('""')

        await toggle.click()
        await expect(box).not.toHaveAttribute('fx')
        await expect(page.locator('#attr')).toHaveText('none')

        await toggle.click()
        await expect(box).toHaveAttribute('fx', '')
        await expect(page.locator('#attr')).toHaveText('""')
    })
})

test.describe('fx prop server markup', () => {
    test.use({ javaScriptEnabled: false })

    test('the server renders an empty fx attribute', async ({ page }) => {
        await page.goto(URL)
        const box = page.locator('#box')
        await expect(box).toHaveAttribute('fx', '')
        expect(await box.evaluate((el) => el.outerHTML)).not.toContain('fx="true"')
    })
})
