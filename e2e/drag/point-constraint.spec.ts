import { expect, test } from '@playwright/test'

const URL = '/tests/drag/point-constraint?@isPlaywright=true'

/** The element's current translateX from its computed transform. */
const readX = (el: import('@playwright/test').Locator) =>
    el.evaluate((node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).m41)

test.describe('drag/point-constraint', () => {
    test('a function dragConstraints moves the element and can read getProps()', async ({
        page
    }) => {
        await page.goto(URL)
        const el = page.getByTestId('point')
        await expect(el).toHaveAttribute('data-is-loaded', 'ready')

        const box = await el.boundingBox()
        if (!box) throw new Error('no bounding box')
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        await page.mouse.move(cx + 120, cy, { steps: 20 })
        await page.waitForTimeout(200)
        await page.mouse.up()

        await expect(page.getByTestId('props-drag')).toHaveText('x')
        await expect(page.getByTestId('constraint-calls')).toHaveText('1')
        await expect.poll(() => readX(el), { timeout: 4000 }).toBeGreaterThan(80)
    })
})
