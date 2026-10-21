import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/animate-presence/owned-pop-layout?@isPlaywright=true'

/** How long after the toggle click we sample. The exit itself takes 1 s. */
const SAMPLE_WINDOW_MS = 300

type Frame = {
    /** ms since the toggle click. */
    t: number
    /** Leftward move of each sibling since before the click. */
    popDelta: number
    syncDelta: number
    /** Exiting element opacity, or `null` once it is out of the DOM. */
    popOpacity: number | null
    syncOpacity: number | null
}

const gotoPage = async (page: Page): Promise<void> => {
    await page.goto(URL)
    await page.waitForFunction(() => window.MotionIsMounted === true)
    await expect(page.getByTestId('exiting')).toBeVisible()
    await expect(page.getByTestId('exiting-sync')).toBeVisible()
}

/**
 * Arms an in-page sampler on the toggle button, then clicks it. The sampler
 * starts on the click itself (not after Playwright's round trip), so a loaded
 * machine can't eat into the 1 s exit before the first sample.
 */
const toggleAndSample = async (page: Page): Promise<Frame[]> => {
    const frames = page.evaluate((windowMs) => {
        const query = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
        const x = (id: string) => query(id)!.getBoundingClientRect().x
        const opacity = (id: string) => {
            const el = query(id)
            return el ? Number(getComputedStyle(el).opacity) : null
        }
        const popBefore = x('sibling')
        const syncBefore = x('sibling-sync')
        const button = query('toggle')!

        return new Promise<Frame[]>((resolve) => {
            button.addEventListener(
                'click',
                () => {
                    const start = performance.now()
                    const out: Frame[] = []
                    const sample = () => {
                        out.push({
                            t: performance.now() - start,
                            popDelta: popBefore - x('sibling'),
                            syncDelta: syncBefore - x('sibling-sync'),
                            popOpacity: opacity('exiting'),
                            syncOpacity: opacity('exiting-sync')
                        })
                        if (performance.now() - start < windowMs) {
                            requestAnimationFrame(sample)
                            return
                        }
                        resolve(out)
                    }
                    // Svelte flushes the click's state change in a microtask,
                    // so the first frame already reflects the exit start.
                    requestAnimationFrame(sample)
                },
                { once: true }
            )
        })
    }, SAMPLE_WINDOW_MS)
    // Let the listener attach before clicking.
    await page.waitForTimeout(50)
    await page.getByTestId('toggle').click()
    return frames
}

test.describe('AnimatePresence popLayout with an owned (PresenceChild) child', () => {
    test('popLayout reflows the sibling while the held child is still exiting', async ({
        page
    }) => {
        await gotoPage(page)
        const frames = await toggleAndSample(page)
        expect(frames.length).toBeGreaterThan(0)

        const poppedWhileVisible = frames.filter(
            (frame) => frame.popOpacity !== null && frame.popOpacity > 0 && frame.popDelta > 100
        )
        expect(
            poppedWhileVisible.length,
            `popLayout sibling never moved >100px while the exiting child was visible: ${JSON.stringify(frames)}`
        ).toBeGreaterThan(0)

        // The held child is still the real node, still in the DOM, mid-exit.
        await expect(page.getByTestId('exiting')).toHaveCount(1)
    })

    test('sync control keeps the sibling in place while the held child exits', async ({ page }) => {
        await gotoPage(page)
        const frames = await toggleAndSample(page)
        expect(frames.length).toBeGreaterThan(0)

        const visibleFrames = frames.filter(
            (frame) => frame.syncOpacity !== null && frame.syncOpacity > 0
        )
        expect(visibleFrames.length).toBeGreaterThan(0)
        for (const frame of visibleFrames) {
            expect(Math.abs(frame.syncDelta), JSON.stringify(frame)).toBeLessThanOrEqual(3)
        }
    })

    test('re-entry mid-exit puts the popLayout child back in flow', async ({ page }) => {
        await gotoPage(page)
        const exiting = page.getByTestId('exiting')
        const before = await exiting.boundingBox()
        expect(before).not.toBeNull()

        await toggleAndSample(page)
        await page.getByTestId('toggle').click()

        await expect
            .poll(
                async () =>
                    exiting.evaluate((el) => ({
                        position: getComputedStyle(el).position,
                        popId: el.hasAttribute('data-motion-pop-id')
                    })),
                { timeout: 3000 }
            )
            .toEqual({ position: 'static', popId: false })
        await expect
            .poll(async () => (await page.getByTestId('sibling').boundingBox())?.x, {
                timeout: 3000
            })
            .toBeGreaterThan(before!.x + 100)
    })
})
