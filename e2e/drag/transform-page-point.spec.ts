import { expect, test, type Locator, type Page } from '@playwright/test'

const URL = '/tests/transform-page-point/drag?@isPlaywright=true'

const center = async (locator: Locator) => {
    const box = await locator.boundingBox()
    if (!box) throw new Error('Expected visible element')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

const dragBy = async (page: Page, locator: Locator, dx: number, dy: number, release = true) => {
    const start = await center(locator)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + dx, start.y + dy, { steps: 4 })
    if (release) await page.mouse.up()
    return start
}

test.describe('MotionConfig transformPagePoint drag', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(URL)
        await expect(page.getByTestId('drag-page')).toHaveAttribute('data-ready', 'true')
    })

    test('keeps the scaled card under the pointer and reports local movement', async ({ page }) => {
        const card = page.getByTestId('drag-card')
        const before = await center(card)
        await dragBy(page, card, 50, 20)
        const after = await center(card)

        expect(Math.abs(after.x - before.x - 50)).toBeLessThanOrEqual(2)
        expect(Math.abs(after.y - before.y - 20)).toBeLessThanOrEqual(2)
        await expect
            .poll(() => page.getByTestId('drag-output').getAttribute('data-local-x'))
            .toBe('100')
        await expect
            .poll(() => page.getByTestId('drag-output').getAttribute('data-local-y'))
            .toBe('40')
    })

    test('supports nonuniform scale and a second drag without jumping', async ({ page }) => {
        await page.getByTestId('zoom-nonuniform').click()
        const card = page.getByTestId('drag-card')
        const before = await center(card)
        await dragBy(page, card, 40, 24)
        const afterFirst = await center(card)
        expect(Math.abs(afterFirst.x - before.x - 40)).toBeLessThanOrEqual(2)
        expect(Math.abs(afterFirst.y - before.y - 24)).toBeLessThanOrEqual(2)

        await dragBy(page, card, -20, -12)
        const afterSecond = await center(card)
        expect(Math.abs(afterSecond.x - afterFirst.x + 20)).toBeLessThanOrEqual(2)
        expect(Math.abs(afterSecond.y - afterFirst.y + 12)).toBeLessThanOrEqual(2)
    })

    test('contains the card at ref edges and reacts to ref resize', async ({ page }) => {
        const card = page.getByTestId('drag-card')
        const bounds = page.getByTestId('drag-bounds')
        await dragBy(page, card, 1000, 0)
        const cardBox = (await card.boundingBox())!
        const boundsBox = (await bounds.boundingBox())!
        expect(
            Math.abs(cardBox.x + cardBox.width - (boundsBox.x + boundsBox.width))
        ).toBeLessThanOrEqual(2)

        await page.getByTestId('resize-bounds').click()
        await expect
            .poll(async () => (await bounds.boundingBox())!.width)
            .toBeGreaterThan(boundsBox.width)
        const resizedCard = (await card.boundingBox())!
        const resizedBounds = (await bounds.boundingBox())!
        expect(
            Math.abs(resizedCard.x + resizedCard.width - (resizedBounds.x + resizedBounds.width))
        ).toBeLessThanOrEqual(2)

        await dragBy(page, card, -1000, 0)
        const leftCard = (await card.boundingBox())!
        const leftBounds = (await bounds.boundingBox())!
        expect(Math.abs(leftCard.x - leftBounds.x)).toBeLessThanOrEqual(2)
    })

    test('keeps numeric constraints in authored local units', async ({ page }) => {
        await page.getByTestId('bounds-numeric').click()
        const card = page.getByTestId('drag-card')
        const initial = await center(card)

        await dragBy(page, card, 1000, 0)
        const right = await center(card)
        expect(Math.abs(right.x - initial.x - 90)).toBeLessThanOrEqual(2)

        await dragBy(page, card, -1000, 0)
        const left = await center(card)
        expect(Math.abs(left.x - initial.x + 90)).toBeLessThanOrEqual(2)
    })

    test('keeps layout compensation pinned during a held pointer', async ({ page }) => {
        const card = page.getByTestId('drag-card')
        const start = await dragBy(page, card, 30, 0, false)
        const beforeShift = await center(card)
        await page.getByTestId('shift-slot').evaluate((button: HTMLButtonElement) => button.click())
        await expect.poll(async () => (await center(card)).x).toBeCloseTo(beforeShift.x, 0)
        await page.mouse.move(start.x + 50, start.y)
        const afterMove = await center(card)
        expect(Math.abs(afterMove.x - beforeShift.x - 20)).toBeLessThanOrEqual(2)
        await page.mouse.up()
    })

    test('snap-to-cursor uses corrected page coordinates after document scroll', async ({
        page
    }) => {
        await page.evaluate(() => window.scrollTo(0, 240))
        const handle = page.getByTestId('controls-start')
        await handle.scrollIntoViewIfNeeded()
        const point = await center(handle)
        await page.mouse.move(point.x, point.y)
        await page.mouse.down()
        await expect
            .poll(async () => (await center(page.getByTestId('drag-card'))).x)
            .toBeCloseTo(point.x, 0)
        await expect
            .poll(async () => (await center(page.getByTestId('drag-card'))).y)
            .toBeCloseTo(point.y, 0)
        await page.mouse.up()
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(
            page.getByRole('link', { name: 'MotionConfig transformPagePoint — drag' })
        ).toHaveAttribute('href', /\/tests\/transform-page-point\/drag/)
    })
})
