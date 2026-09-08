import { expect, test, type Locator, type Page } from '@playwright/test'

const URL = '/tests/transform-page-point/pan?@isPlaywright=true'

const center = async (locator: Locator) => {
    const box = await locator.boundingBox()
    if (!box) throw new Error('Expected visible element')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

const panBy = async (page: Page, surface: Locator, dx: number, dy: number, release = true) => {
    const start = await center(surface)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + dx, start.y + dy, { steps: 3 })
    if (release) await page.mouse.up()
    return start
}

const offsetX = async (page: Page) =>
    Number(await page.getByTestId('pan-output').getAttribute('data-offset-x'))

test.describe('MotionConfig transformPagePoint pan', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(URL)
        await expect(page.getByTestId('pan-page')).toHaveAttribute('data-ready', 'true')
    })

    test('reports inherited corrected movement and moves its follower locally', async ({
        page
    }) => {
        await panBy(page, page.getByTestId('pan-surface'), 40, 20)
        await expect.poll(() => offsetX(page)).toBeCloseTo(80, 0)
        await expect(page.getByTestId('pan-output')).toHaveAttribute('data-ends', '1')
    })

    test('supports child override, inherited reset, and explicit identity between gestures', async ({
        page
    }) => {
        const surface = page.getByTestId('pan-surface')
        await page.getByTestId('pan-override').click()
        await panBy(page, surface, 20, 0)
        await expect.poll(() => offsetX(page)).toBeCloseTo(80, 0)

        await page.getByTestId('pan-inherit').click()
        await panBy(page, surface, 20, 0)
        await expect.poll(() => offsetX(page)).toBeCloseTo(40, 0)

        await panBy(page, page.getByTestId('identity-pan'), 20, 0)
        await expect.poll(() => offsetX(page)).toBeCloseTo(20, 0)
    })

    test('queues callback-reference replacement until the next pointer session', async ({
        page
    }) => {
        const surface = page.getByTestId('pan-surface')
        const start = await panBy(page, surface, 20, 0, false)
        await expect.poll(() => offsetX(page)).toBeCloseTo(40, 0)
        await page
            .getByTestId('pan-override')
            .evaluate((button: HTMLButtonElement) => button.click())
        await page.mouse.move(start.x + 30, start.y)
        await expect.poll(() => offsetX(page)).toBeCloseTo(60, 0)
        await page.mouse.up()

        await panBy(page, surface, 20, 0)
        await expect.poll(() => offsetX(page)).toBeCloseTo(80, 0)
    })

    test('re-evaluates a stable callback closure when scale changes live', async ({ page }) => {
        const surface = page.getByTestId('pan-surface')
        const start = await panBy(page, surface, 20, 0, false)
        await expect.poll(() => offsetX(page)).toBeCloseTo(40, 0)
        await page
            .getByTestId('pan-live-scale')
            .evaluate((button: HTMLButtonElement) => button.click())
        await page.mouse.move(start.x + 20, start.y + 1)
        await expect.poll(() => offsetX(page)).toBeCloseTo(80, 0)
        await page.mouse.up()
    })

    test('transforms ancestor and page scroll while the pointer is held', async ({ page }) => {
        const surface = page.getByTestId('pan-surface')
        await panBy(page, surface, 20, 0, false)
        await expect.poll(() => offsetX(page)).toBeCloseTo(40, 0)

        await page.getByTestId('pan-scroll-shell').evaluate((element) => {
            element.scrollLeft += 10
        })
        await expect.poll(() => offsetX(page)).toBeCloseTo(60, 0)

        await page.evaluate(() => window.scrollBy(10, 0))
        await expect.poll(() => offsetX(page)).toBeCloseTo(80, 0)
        await page.mouse.up()
    })

    test('cancels once with the last valid corrected point', async ({ page }) => {
        const surface = page.getByTestId('pan-surface')
        await panBy(page, surface, 20, 0, false)
        await page.evaluate(() => {
            window.dispatchEvent(
                new PointerEvent('pointercancel', {
                    clientX: 999,
                    clientY: 999,
                    pointerId: 1,
                    pointerType: 'mouse',
                    isPrimary: true
                })
            )
        })

        await expect(page.getByTestId('pan-output')).toHaveAttribute('data-cancelled', 'true')
        await expect(page.getByTestId('pan-output')).toHaveAttribute('data-ends', '1')
        await page.mouse.up()
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(
            page.getByRole('link', { name: 'MotionConfig transformPagePoint — pan' })
        ).toHaveAttribute('href', /\/tests\/transform-page-point\/pan/)
    })
})
