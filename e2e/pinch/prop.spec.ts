/**
 * Port of upstream `tests/react/pinch.spec.ts` (Motion v14.12.0), against
 * `src/routes/tests/pinch/prop`, a port of upstream's fixture
 * `dev/react/src/tests/pinch-while.tsx`.
 *
 * The pinch prop with real touches through CDP. The 100x100 box starts at
 * (100, 100). All seven upstream tests, with upstream's names, coordinates and
 * assertions. `frames` and `touch` come from the shared `./_helpers`; `style`,
 * `width` and `spread` are upstream's, verbatim.
 *
 * Where upstream reads a value after a fixed sleep (`waitForTimeout`), this
 * port polls until the value settles instead, with the same assertion.
 */
import { expect, test, type CDPSession, type Page } from '@playwright/test'
import { frames, touch } from './_helpers'

const open = async (page: Page, query = '') => {
    await page.goto(`/tests/pinch/prop?@isPlaywright=true${query}`)
    await page.waitForSelector('#box')
    // The box only pinches once the page has hydrated.
    await page.waitForSelector('#taps[data-hydrated]')
    await frames(page, 2)
}

const style = (page: Page, selector: string, key: string) =>
    page.$eval(selector, (el, key) => getComputedStyle(el).getPropertyValue(key), key)

const width = (page: Page) => page.$eval('#box', (el) => el.getBoundingClientRect().width)

/**
 * Spread two touches around (150, 150) from 20px to 80px apart.
 */
async function spread(page: Page, cdp: CDPSession) {
    await touch(cdp, 'touchStart', [
        { x: 140, y: 150 },
        { x: 160, y: 150 }
    ])
    await frames(page, 2)
    for (let i = 1; i <= 5; i++) {
        await touch(cdp, 'touchMove', [
            { x: 140 - i * 6, y: 150 },
            { x: 160 + i * 6, y: 150 }
        ])
        await frames(page, 1)
    }
    await frames(page, 2)
}

test.describe('pinch prop', () => {
    test.beforeEach(({ browserName }) => {
        test.skip(browserName !== 'chromium', 'Touch input needs CDP')
    })

    test('whilePinch applies while pinching, on the box and its child', async ({ page }) => {
        await open(page)
        const cdp = await page.context().newCDPSession(page)

        await spread(page, cdp)
        expect(await width(page)).toBeCloseTo(400, 0)
        expect(await style(page, '#box', 'opacity')).toBe('0.5')
        expect(await style(page, '#child', 'opacity')).toBe('0.25')

        await touch(cdp, 'touchEnd', [])
        await frames(page, 3)
        expect(await style(page, '#box', 'opacity')).toBe('1')
        expect(await style(page, '#child', 'opacity')).toBe('1')
    })

    test("a pinch isn't a tap, and whileTap ends with it", async ({ page }) => {
        await open(page)
        const cdp = await page.context().newCDPSession(page)

        await spread(page, cdp)
        expect(await style(page, '#box', 'background-color')).toBe('rgb(0, 0, 255)')

        // The first touch lifts first, then the second.
        await touch(cdp, 'touchEnd', [{ x: 110, y: 150, id: 0 }])
        await frames(page, 2)
        await touch(cdp, 'touchEnd', [])
        await frames(page, 3)

        expect(await page.textContent('#taps')).toBe('0')
        expect(await style(page, '#box', 'background-color')).toBe('rgb(255, 0, 0)')
    })

    test("a pinch isn't a tap when the second touch lifts first", async ({ page }) => {
        await open(page)
        const cdp = await page.context().newCDPSession(page)

        await spread(page, cdp)
        await touch(cdp, 'touchEnd', [{ x: 190, y: 150, id: 1 }])
        await frames(page, 2)
        await touch(cdp, 'touchEnd', [])
        await frames(page, 3)

        expect(await page.textContent('#taps')).toBe('0')
        expect(await style(page, '#box', 'background-color')).toBe('rgb(255, 0, 0)')
    })

    test('scale resists past its limit and springs back', async ({ page }) => {
        await open(page, '&limits')
        const cdp = await page.context().newCDPSession(page)

        await spread(page, cdp)
        const stretched = await width(page)
        expect(stretched).toBeGreaterThan(155)
        expect(stretched).toBeLessThan(400)

        await touch(cdp, 'touchEnd', [])
        // Upstream sleeps 1500 ms; wait for the spring back to land instead.
        await expect.poll(() => width(page), { timeout: 5000 }).toBeCloseTo(150, 0)
    })

    test('a tap still taps', async ({ page }) => {
        await open(page)
        await page.click('#box')
        // Upstream reads after 2 frames; wait for the count to change instead.
        await expect(page.locator('#taps')).toHaveText('1')
    })

    test('a trackpad pinch zooms', async ({ page }) => {
        await open(page)
        await page.mouse.move(150, 150)
        await page.keyboard.down('Control')
        for (let i = 0; i < 5; i++) {
            await page.mouse.wheel(0, -20)
            await frames(page, 1)
        }
        await frames(page, 2)
        expect(await width(page)).toBeGreaterThan(150)
        expect(await style(page, '#box', 'opacity')).toBe('0.5')
        await page.keyboard.up('Control')

        // The gesture ends once wheel events stop. Upstream sleeps 300 ms;
        // wait for whilePinch to end instead.
        await expect.poll(() => style(page, '#box', 'opacity'), { timeout: 2000 }).toBe('1')
    })

    test("drag's release velocity doesn't include the pinch", async ({ page }) => {
        await open(page, '&drag')
        const cdp = await page.context().newCDPSession(page)

        // Drag with the first touch, then zoom fast with both.
        await touch(cdp, 'touchStart', [{ x: 120, y: 150 }])
        await frames(page, 1)
        await touch(cdp, 'touchMove', [{ x: 130, y: 150 }])
        await frames(page, 2)
        await touch(cdp, 'touchStart', [
            { x: 130, y: 150 },
            { x: 170, y: 150 }
        ])
        await frames(page, 2)
        for (let i = 1; i <= 5; i++) {
            await touch(cdp, 'touchMove', [
                { x: 130 - i * 15, y: 150 },
                { x: 170 + i * 15, y: 150 }
            ])
            await frames(page, 1)
        }

        // The dragging touch moves on and lifts straight away.
        await touch(cdp, 'touchMove', [
            { x: 40, y: 150 },
            { x: 245, y: 150 }
        ])
        await touch(cdp, 'touchEnd', [{ x: 245, y: 150, id: 1 }])
        await frames(page, 2)
        await touch(cdp, 'touchEnd', [])
        await frames(page, 3)

        // Read the velocity once onDragEnd has written it.
        await expect(page.locator('#velocity')).not.toHaveText('')
        const velocity = Number(await page.textContent('#velocity'))
        expect(Math.abs(velocity)).toBeLessThan(200)
    })
})
