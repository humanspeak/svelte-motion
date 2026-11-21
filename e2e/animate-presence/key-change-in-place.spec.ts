import { expect, test, type Page } from '@playwright/test'

const urlFor = (mode: 'sync' | 'wait') =>
    `/tests/animate-presence/key-change-in-place?@isPlaywright=true&mode=${mode}`

const readBox = (page: Page) =>
    page.getByTestId('box').evaluate((el) => {
        const cs = getComputedStyle(el)
        const y = cs.transform === 'none' ? 0 : new DOMMatrix(cs.transform).m42
        return { opacity: Number(cs.opacity), y, key: el.getAttribute('data-key') }
    })

/** Poll until the box is mid-exit, so the next click lands inside the transition. */
const waitMidExit = (page: Page) =>
    expect
        .poll(async () => (await readBox(page)).opacity, { intervals: [16], timeout: 2000 })
        .toBeLessThan(0.9)

/** Poll until the box is fully visible again. */
const waitVisible = (page: Page) =>
    expect
        .poll(async () => (await readBox(page)).opacity, { intervals: [50], timeout: 5000 })
        .toBeGreaterThanOrEqual(0.99)

/** Record the box's translateY on every frame into window.__ySamples. */
const startYRecorder = (page: Page) =>
    page.evaluate(() => {
        const w = window as unknown as { __ySamples: number[]; __yStop?: boolean }
        w.__ySamples = []
        w.__yStop = false
        const el = document.querySelector<HTMLElement>('[data-testid="box"]')!
        const tick = () => {
            if (w.__yStop) return
            const t = getComputedStyle(el).transform
            w.__ySamples.push(t === 'none' ? 0 : new DOMMatrix(t).m42)
            requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
    })

/** Stop the recorder and return every sampled translateY. */
const stopYRecorder = (page: Page) =>
    page.evaluate(() => {
        const w = window as unknown as { __ySamples: number[]; __yStop?: boolean }
        w.__yStop = true
        return w.__ySamples
    })

for (const mode of ['sync', 'wait'] as const) {
    test.describe(`in-place key change (mode=${mode})`, () => {
        test.beforeEach(async ({ page }) => {
            await page.goto(urlFor(mode))
            await expect(page.getByTestId('box')).toHaveAttribute('data-is-loaded', 'ready')
            await waitVisible(page)
        })

        test('a second key change mid-exit ends visible on the latest key', async ({ page }) => {
            await page.getByTestId('next').click()
            await waitMidExit(page)
            await page.getByTestId('next').click()
            await waitVisible(page)
            await expect(page.getByTestId('box')).toHaveAttribute('data-key', 'three')
        })

        test('key changes keep working after an interrupted transition', async ({ page }) => {
            await page.getByTestId('next').click()
            await waitMidExit(page)
            await page.getByTestId('next').click()
            await waitVisible(page)
            await expect(page.getByTestId('box')).toHaveAttribute('data-key', 'three')

            await page.getByTestId('next').click()
            await waitMidExit(page)
            await waitVisible(page)
            await expect(page.getByTestId('box')).toHaveAttribute('data-key', 'four')
        })

        test('changing back to the exiting key reverses the exit without a rewind', async ({
            page
        }) => {
            await page.getByTestId('next').click()
            await waitMidExit(page)
            await startYRecorder(page)
            await page.getByTestId('prev').click()
            await waitVisible(page)
            await expect(page.getByTestId('box')).toHaveAttribute('data-key', 'one')

            const samples = await stopYRecorder(page)
            expect(samples.length).toBeGreaterThan(0)
            expect(Math.min(...samples)).toBeGreaterThan(-0.5)
        })

        test('a key change during the re-enter ends visible on the latest key', async ({
            page
        }) => {
            await page.getByTestId('next').click()
            // The exit has finished once the box is fully transparent...
            await expect
                .poll(async () => (await readBox(page)).opacity, { intervals: [16], timeout: 3000 })
                .toBeLessThan(0.05)
            // ...and the re-enter is in progress once it is partly visible again.
            await expect
                .poll(
                    async () => {
                        const { opacity } = await readBox(page)
                        return opacity > 0.2 && opacity < 0.8
                    },
                    { intervals: [16], timeout: 3000 }
                )
                .toBe(true)
            await page.getByTestId('next').click()
            await waitVisible(page)
            await expect(page.getByTestId('box')).toHaveAttribute('data-key', 'three')
        })
    })
}
