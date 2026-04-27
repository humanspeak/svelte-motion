import { expect, test, type Locator, type Page } from '@playwright/test'

const ROUTE = '/tests/motion-config-reduced-motion'

const readBoxTransform = (locator: Locator) =>
    locator.evaluate((el) => getComputedStyle(el as HTMLElement).transform)

const waitForAnimationsToFinish = (page: Page) =>
    page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="motion-box"]') as HTMLElement | null
        if (!el) return false
        const anims = el.getAnimations()
        if (anims.length > 0 && anims.some((a) => a.playState === 'running')) return false
        return parseFloat(getComputedStyle(el).opacity) > 0.99
    })

test.describe('MotionConfig.reducedMotion', () => {
    test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'no-preference' })
    })

    test("policy='always' strips transforms but still fades in opacity", async ({ page }) => {
        await page.goto(ROUTE)
        await page.getByTestId('policy-always').check()

        const box = page.getByTestId('motion-box')
        await expect(box).toBeAttached()

        await waitForAnimationsToFinish(page)
        const transform = await readBoxTransform(box)
        expect(transform === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(transform)).toBe(true)

        const opacity = await box.evaluate((el) => getComputedStyle(el as HTMLElement).opacity)
        expect(parseFloat(opacity)).toBeGreaterThan(0.95)
    })

    test("policy='never' lets transforms animate", async ({ page }) => {
        await page.goto(ROUTE)
        await page.getByTestId('policy-never').check()

        const box = page.getByTestId('motion-box')
        await expect(box).toBeAttached()

        await waitForAnimationsToFinish(page)
        const transform = await readBoxTransform(box)
        expect(transform).toMatch(/matrix\(1,\s*0,\s*0,\s*1,\s*200/)
    })

    test("policy='user' honors OS prefers-reduced-motion", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto(ROUTE)
        await page.getByTestId('policy-user').check()

        const box = page.getByTestId('motion-box')
        await waitForAnimationsToFinish(page)

        const transform = await readBoxTransform(box)
        expect(transform === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(transform)).toBe(true)

        const opacity = await box.evaluate((el) => getComputedStyle(el as HTMLElement).opacity)
        expect(parseFloat(opacity)).toBeGreaterThan(0.95)
    })
})
