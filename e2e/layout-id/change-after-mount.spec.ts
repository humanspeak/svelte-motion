import { expect, test, type Page } from '@playwright/test'

/**
 * Port of upstream motion `tests/react/issue-1411.spec.ts` @ v14.7.1
 * (https://github.com/motiondivision/motion/issues/1411, Motion 14.7.1).
 *
 * A motion element whose layoutId changes after its first render should use
 * the NEW layoutId for shared layout animations. Element A starts with
 * layoutId "initial" and is updated to "shared" (either in a mount effect, as
 * in the report, or later via a click). A is then replaced by element B with
 * layoutId "shared". B should animate from A's position (left: 0) towards its
 * own (left: 400) over a 10s linear transition, rather than snapping to 400.
 * Likewise, once A's layoutId changes away from "shared", B shouldn't animate
 * from A.
 *
 * Deviation: lefts are read relative to the page's 600×400 `#stage` box, as
 * the test harness layout offsets it from the viewport's origin.
 */

const URL = '/tests/layout-id/change-after-mount?@isPlaywright=true'

const leftOf = (page: Page, id: string) =>
    page.evaluate(
        (id) =>
            document.getElementById(id)!.getBoundingClientRect().left -
            document.getElementById('stage')!.getBoundingClientRect().left,
        id
    )

async function measureAfterSwap(
    page: Page,
    query: string,
    clickChange = false,
    expectedId = 'shared'
) {
    await page.goto(`${URL}&${query}`)
    await expect(page.locator('#a')).toBeVisible()
    await page.waitForTimeout(200)
    if (clickChange) await page.click('#change')
    await expect(page.locator('#current-id')).toHaveText(expectedId)
    await page.waitForTimeout(200)
    await page.click('#toggle')
    await expect(page.locator('#b')).toBeVisible()
    await page.waitForTimeout(1000)
    // Single point-in-time read (~10% into the animation)
    return leftOf(page, 'b')
}

test.describe('issue #1411: changing layoutId after mount', () => {
    test('control: constant layoutId animates from previous element', async ({ page }) => {
        const left = await measureAfterSwap(page, 'changed=false')
        expect(left).toBeLessThan(300)
    })

    test('layoutId changed in mount effect animates from previous element', async ({ page }) => {
        const left = await measureAfterSwap(page, 'changed=true')
        expect(left).toBeLessThan(300)
    })

    test('layoutId changed later animates from previous element', async ({ page }) => {
        const left = await measureAfterSwap(page, 'changed=true&late=true', true)
        expect(left).toBeLessThan(300)
    })

    test('layoutId changed away no longer animates from previous element', async ({ page }) => {
        const left = await measureAfterSwap(page, 'away=true', false, 'other')
        expect(left).toBe(400)
    })

    // Svelte-specific: an id change on a mounted element must not leave a
    // layoutId handoff behind under the OLD id. Upstream, A has already left
    // stack "shared" when B mounts. The click lands inside the registry's
    // handoff window (two frames and at least 100 ms).
    test("layoutId changed away just before the swap doesn't animate from the previous element", async ({
        page
    }) => {
        await page.goto(`${URL}&away=true&late=true`)
        await expect(page.locator('#a')).toBeVisible()
        await page.waitForTimeout(200)
        await page.click('#change')
        await page.waitForTimeout(50)
        await page.click('#toggle')
        await expect(page.locator('#b')).toBeVisible()
        await page.waitForTimeout(1000)
        expect(await leftOf(page, 'b')).toBe(400)
    })
})

test('layoutId moved to a sibling keeps the previous element visible', async ({ page }) => {
    await page.goto('/tests/layout-id/move-to-sibling?@isPlaywright=true')
    await expect(page.locator('#a')).toBeVisible()
    await page.click('#select-b')
    await page.waitForTimeout(300)
    await expect(page.locator('#a')).toHaveCSS('visibility', 'visible')
    await page.click('#select-a')
    await page.waitForTimeout(300)
    await expect(page.locator('#b')).toHaveCSS('visibility', 'visible')
})
