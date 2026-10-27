import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * `transition.out` on `initial` (#1725), mount cases. Port of upstream
 * `packages/framer-motion/src/motion/__tests__/transition-out.test.tsx` @ v14.7.1
 * (delay 10 → 2 s; the page's cards are client-only, so no SSR appear script
 * is involved). Timings are measured from when the cards appear.
 */

const read = (locator: Locator) =>
    locator.evaluate((element) => {
        const style = getComputedStyle(element)
        const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform)
        return { scale: matrix.a, x: matrix.e, opacity: Number(style.opacity) }
    })

const openPage = async (page: Page) => {
    await page.goto('/tests/transition-out/mount?@isPlaywright=true')
    await page.getByTestId('mount-out').waitFor({ state: 'attached' })
    return Date.now()
}

test.describe('transition.out on initial (#1725)', () => {
    test("initial's out delays only the mount animation, not hover end", async ({ page }) => {
        const appearedAt = await openPage(page)
        const card = page.getByTestId('mount-out')

        const elapsed = Date.now() - appearedAt
        await page.waitForTimeout(Math.max(0, 600 - elapsed))
        expect((await read(card)).scale, 'mount delay from initial.out').toBeLessThan(0.05)

        await expect
            .poll(async () => (await read(card)).scale, {
                timeout: Math.max(0, 2500 - (Date.now() - appearedAt))
            })
            .toBeCloseTo(1, 2)

        await card.hover()
        await expect
            .poll(async () => (await read(card)).scale, { timeout: 600 })
            .toBeCloseTo(1.3, 2)

        await page.mouse.move(0, 0)
        await expect
            .poll(async () => (await read(card)).scale, {
                timeout: 600,
                message: 'hover end must not wait for the mount delay'
            })
            .toBeCloseTo(1, 2)
    })

    test("a variant label's out times the mount, inherited by variant children", async ({
        page
    }) => {
        await openPage(page)
        const parent = page.getByTestId('mount-label')
        const child = page.getByTestId('mount-label-child')

        // Client-only cards: absent from the server HTML, and no SSR appear
        // bootstrap ran. (Our container also sets `data-framer-appear-id` on a
        // client render before `MotionIsMounted`, but its `{@html}` script
        // never executes there, so the attribute alone doesn't prove SSR.)
        const html = await (
            await page.request.get('/tests/transition-out/mount?@isPlaywright=true')
        ).text()
        expect(html).not.toContain('data-testid="mount-label"')
        expect(html).not.toContain('data-testid="mount-label-child"')
        expect(
            await page.evaluate(
                () => (window as unknown as { __SvelteMotionAppear?: unknown }).__SvelteMotionAppear
            )
        ).toBeUndefined()

        await expect
            .poll(async () => [(await read(parent)).opacity, (await read(child)).opacity], {
                timeout: 500,
                message: 'parent and child must be visible without the 2 s delay'
            })
            .toEqual([1, 1])
    })

    test("control: initial's out doesn't apply to values initial doesn't change", async ({
        page
    }) => {
        await openPage(page)
        const card = page.getByTestId('mount-unchanged')

        await page.getByTestId('move-unchanged').click()
        await page.waitForTimeout(500)
        expect((await read(card)).x).toBe(0)
    })
})
