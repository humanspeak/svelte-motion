import { expect, test, type Locator } from '@playwright/test'

/**
 * `transition.out` on gestures (#1725). Port of upstream
 * `packages/framer-motion/src/motion/__tests__/transition-out.test.tsx` @ v14.7.1
 * (delay 10 → 2 s, `{ type: false }` = instant), including its 17th test
 * (exit while hovered), which runs through the owned `AnimatePresence` form.
 */

const read = (locator: Locator) =>
    locator.evaluate((element) => {
        const style = getComputedStyle(element)
        const matrix = new DOMMatrix(style.transform === 'none' ? undefined : style.transform)
        return { scale: matrix.a, x: matrix.e, opacity: Number(style.opacity) }
    })

const opacityOf = async (locator: Locator) => (await read(locator)).opacity

test.describe('transition.out on gestures (#1725)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/transition-out/gestures?@isPlaywright=true')
        await page.getByTestId('out-true').waitFor()
    })

    test("out: true reuses whileHover's transition when hover ends", async ({ page }) => {
        const card = page.getByTestId('out-true')
        await card.hover()
        await expect.poll(() => opacityOf(card), { timeout: 300 }).toBe(1)

        await page.mouse.move(0, 0)
        await expect
            .poll(() => opacityOf(card), {
                timeout: 400,
                message: "hover end must use whileHover's out, not animate's 2 s delay"
            })
            .toBe(0.5)
    })

    test('control: without out, the state being entered defines the transition', async ({
        page
    }) => {
        const card = page.getByTestId('no-out')
        await card.hover()
        await expect.poll(() => opacityOf(card), { timeout: 300 }).toBe(1)

        await page.mouse.move(0, 0)
        await page.waitForTimeout(400)
        expect(await opacityOf(card)).toBe(1)
    })

    test('whileTap out applies when returning to whileHover', async ({ page }) => {
        const card = page.getByTestId('tap-to-hover')
        await card.hover()
        await page.mouse.down()
        await expect
            .poll(async () => (await read(card)).scale, { timeout: 300 })
            .toBeCloseTo(0.5, 2)

        await page.mouse.up()
        await expect
            .poll(async () => (await read(card)).scale, {
                timeout: 400,
                message: "returning to whileHover must use whileTap's out"
            })
            .toBeCloseTo(1.5, 2)
    })

    test('with a list of labels, the last label that sets out applies to all its values', async ({
        page
    }) => {
        const card = page.getByTestId('label-list')
        await card.hover()
        await expect
            .poll(
                async () => {
                    const { opacity, x } = await read(card)
                    return [opacity, Math.round(x)]
                },
                { timeout: 300 }
            )
            .toEqual([1, 40])

        await page.mouse.move(0, 0)
        await expect
            .poll(
                async () => {
                    const { opacity, x } = await read(card)
                    return [opacity, Math.round(x)]
                },
                { timeout: 400, message: "x leaves with fade's out too" }
            )
            .toEqual([0.5, 0])
    })

    test("setting only out keeps the value's default transition into the state", async ({
        page
    }) => {
        const card = page.getByTestId('out-only')
        // The card slides 100px right: put the pointer near its right edge so
        // it stays over the card. A raw mouse move, because `hover()`'s
        // actionability retries chase the moving card.
        const box = (await card.boundingBox())!
        await page.mouse.move(box.x + 150, box.y + 50)

        const samples = await card.evaluate(
            (element) =>
                new Promise<number[]>((resolve) => {
                    const values: number[] = []
                    const start = performance.now()
                    const sample = () => {
                        const transform = getComputedStyle(element).transform
                        values.push(new DOMMatrix(transform === 'none' ? undefined : transform).e)
                        if (performance.now() - start < 1000) requestAnimationFrame(sample)
                        else resolve(values)
                    }
                    requestAnimationFrame(sample)
                })
        )
        expect(
            Math.max(...samples),
            "x's default transition is an underdamped spring, which overshoots"
        ).toBeGreaterThan(100)

        await page.mouse.move(0, 0)
        await expect.poll(async () => Math.round((await read(card)).x), { timeout: 300 }).toBe(0)
    })

    test("is used once: the next change into animate uses animate's transition", async ({
        page
    }) => {
        const card = page.getByTestId('used-once')
        await card.hover()
        await expect.poll(() => opacityOf(card), { timeout: 300 }).toBe(1)
        await page.mouse.move(0, 0)
        await expect.poll(() => opacityOf(card), { timeout: 400 }).toBe(0.5)

        await page.getByTestId('used-once-change').click()
        await page.waitForTimeout(500)
        expect(await opacityOf(card)).toBe(0.5)
    })

    test("guard: exiting while hovered uses exit's transition, not hover's out", async ({
        page
    }) => {
        const card = page.getByTestId('exit-hovered')
        await card.hover()
        await expect.poll(() => opacityOf(card), { timeout: 300 }).toBe(1)

        const original = await card.elementHandle()

        // Don't move the mouse: the card must still be hovered when it exits.
        await page.getByTestId('exit-toggle').focus()
        await page.keyboard.press('Enter')

        await page.waitForTimeout(600)
        expect(
            await original.evaluate((element) => element.isConnected),
            'the real node exits (owned AnimatePresence), not a clone'
        ).toBe(true)
        expect(
            await original.evaluate((element) => Number(getComputedStyle(element).opacity))
        ).toBe(1)

        await expect(page.getByTestId('exit-hovered')).toHaveCount(0, { timeout: 3000 })
    })
})
