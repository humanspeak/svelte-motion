import { expect, test, type Locator, type Page } from '@playwright/test'

type Point = { x: number; y: number }
type GestureEntry = {
    type: string
    info: { point: Point; delta: Point; offset: Point; velocity: Point }
    boundValues: Point
}

const installClock = async (page: Page) => {
    await page.addInitScript(() => {
        let now = 1000
        let nextId = 1
        const callbacks = new Map<number, FrameRequestCallback>()
        Object.defineProperty(performance, 'now', { configurable: true, value: () => now })
        window.requestAnimationFrame = (callback) => {
            const id = nextId++
            callbacks.set(id, callback)
            return id
        }
        window.cancelAnimationFrame = (id) => callbacks.delete(id)
        ;(
            window as unknown as { __PARITY_CLOCK__: { advance(ms: number): void } }
        ).__PARITY_CLOCK__ = {
            advance(ms) {
                now += ms
                const queued = [...callbacks.values()]
                callbacks.clear()
                for (const callback of queued) callback(now)
            }
        }
    })
}

const advance = async (page: Page, ms: number) => {
    await page.evaluate((delta) => {
        ;(
            window as unknown as { __PARITY_CLOCK__: { advance(ms: number): void } }
        ).__PARITY_CLOCK__.advance(delta)
    }, ms)
    await page.evaluate(async () => {
        await Promise.resolve()
        await new Promise((resolve) => queueMicrotask(resolve))
    })
}

const openCase = async (page: Page, caseId: string) => {
    await page.goto(`/tests/transform-page-point/pan?case=${caseId}&@isPlaywright=true`)
    await expect(page.getByTestId('fixture')).toHaveAttribute('data-ready', 'true')
    await advance(page, 16)
    await advance(page, 16)
    const frameProbe = await page.evaluate(() =>
        (
            window as unknown as {
                __PARITY__: {
                    trace: Array<{
                        type: string
                        timestamp?: number
                        performanceNow?: number
                    }>
                }
            }
        ).__PARITY__.trace.find((entry) => entry.type === 'motionFrameProbe')
    )
    expect(frameProbe?.timestamp).toBe(frameProbe?.performanceNow)
    expect([1016, 1032]).toContain(frameProbe?.timestamp)
}

const center = async (locator: Locator) => {
    const box = await locator.boundingBox()
    if (!box) throw new Error('Expected visible element')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

const gestures = (page: Page) =>
    page.evaluate(() => {
        const parity = (window as unknown as { __PARITY__: { trace: GestureEntry[] } }).__PARITY__
        return parity.trace.filter((entry) => entry.type.startsWith('onPan'))
    })

const action = async (page: Page, name: string, value?: unknown) => {
    await page.evaluate(
        ({ actionName, actionValue }) => {
            const actions = (
                window as unknown as {
                    __PARITY__: { actions: Record<string, (value?: unknown) => unknown> }
                }
            ).__PARITY__.actions
            return actions[actionName](actionValue)
        },
        { actionName: name, actionValue: value }
    )
}

const canonicalSequence = async (page: Page, terminal: 'up' | 'cancel' = 'up') => {
    const start = await center(page.getByTestId('target'))
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await advance(page, 16)
    await page.mouse.move(start.x + 2, start.y + 1)
    await advance(page, 24)
    await page.mouse.move(start.x + 30, start.y + 20)
    await advance(page, 40)
    if (terminal === 'cancel') {
        await page.evaluate(
            ({ x, y }) => {
                window.dispatchEvent(
                    new PointerEvent('pointercancel', {
                        bubbles: true,
                        pointerId: 1,
                        pointerType: 'mouse',
                        isPrimary: true,
                        clientX: x,
                        clientY: y,
                        button: 0,
                        buttons: 0
                    })
                )
            },
            { x: start.x + 30, y: start.y + 20 }
        )
        await page.mouse.up()
    } else {
        await page.mouse.up()
    }
    await advance(page, 20)
}

const scrollWindowBy = async (page: Page, x: number, y: number) => {
    const expected = await page.evaluate(
        ({ x, y }) => {
            const expected = { x: window.scrollX + x, y: window.scrollY + y }
            const state = { delivered: false }
            ;(window as unknown as { __TPP_WINDOW_SCROLL__?: typeof state }).__TPP_WINDOW_SCROLL__ =
                state
            const recordScroll = () => {
                if (window.scrollX === expected.x && window.scrollY === expected.y) {
                    state.delivered = true
                    window.removeEventListener('scroll', recordScroll)
                }
            }
            window.addEventListener('scroll', recordScroll)
            window.scrollBy(x, y)
            return expected
        },
        { x, y }
    )
    await page.waitForFunction(
        ({ x, y }) => {
            const state = (window as unknown as { __TPP_WINDOW_SCROLL__?: { delivered: boolean } })
                .__TPP_WINDOW_SCROLL__
            return state?.delivered && window.scrollX === x && window.scrollY === y
        },
        expected,
        { polling: 10, timeout: 2000 }
    )
    expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual(expected)
}

const scrollShellBy = async (page: Page, x: number, y: number) => {
    const shell = page.getByTestId('shell')
    const expected = await shell.evaluate(
        (element, delta) => {
            const expected = { x: element.scrollLeft + delta.x, y: element.scrollTop + delta.y }
            element.dataset.scrollDelivered = 'false'
            const recordScroll = () => {
                if (element.scrollLeft === expected.x && element.scrollTop === expected.y) {
                    element.dataset.scrollDelivered = 'true'
                    element.removeEventListener('scroll', recordScroll)
                }
            }
            element.addEventListener('scroll', recordScroll)
            element.scrollBy(delta.x, delta.y)
            return expected
        },
        { x, y }
    )
    await expect
        .poll(
            () =>
                shell.evaluate((element) => ({
                    delivered: element.dataset.scrollDelivered,
                    x: element.scrollLeft,
                    y: element.scrollTop
                })),
            { timeout: 2000, intervals: [10] }
        )
        .toEqual({ delivered: 'true', ...expected })
}

test.describe('MotionConfig transformPagePoint pan', () => {
    test.beforeEach(async ({ page }) => installClock(page))

    test('matches inherited scale-2 frame history and terminal velocity', async ({ page }) => {
        await openCase(page, 'pan-config-inherit')
        const followerBefore = await center(page.getByTestId('follower'))
        await canonicalSequence(page)
        const followerAfter = await center(page.getByTestId('follower'))
        const trace = await gestures(page)

        expect(trace.map(({ type }) => type)).toEqual([
            'onPanSessionStart',
            'onPanStart',
            'onPan',
            'onPan',
            'onPanEnd'
        ])
        expect(trace[1].info).toMatchObject({
            delta: { x: 4, y: 2 },
            offset: { x: 4, y: 2 },
            velocity: { x: 0, y: 0 }
        })
        expect(trace[3].info).toMatchObject({
            delta: { x: 56, y: 38 },
            offset: { x: 60, y: 40 },
            velocity: { x: 100, y: 50 }
        })
        expect(trace[4].info).toMatchObject({
            delta: { x: 0, y: 0 },
            offset: { x: 60, y: 40 },
            velocity: { x: 750, y: 500 }
        })
        expect(Math.abs(followerAfter.x - followerBefore.x - 30)).toBeLessThanOrEqual(2)
        expect(Math.abs(followerAfter.y - followerBefore.y - 20)).toBeLessThanOrEqual(2)
    })

    test('distinguishes omitted inheritance from explicit undefined and identity', async ({
        page
    }) => {
        for (const [caseId, expected] of [
            ['pan-config-inherit', { x: 60, y: 40 }],
            ['pan-config-identity', { x: 30, y: 20 }],
            ['pan-config-explicit-undefined', { x: 30, y: 20 }]
        ] as const) {
            await openCase(page, caseId)
            await canonicalSequence(page)
            expect((await gestures(page)).at(-1)?.info.offset).toEqual(expected)
        }
    })

    test('keeps pan unchanged by held page and ancestor scroll', async ({ page }) => {
        for (const scenario of ['page', 'ancestor'] as const) {
            await openCase(page, `pan-${scenario}-scroll-held`)
            if (scenario === 'ancestor') await scrollShellBy(page, 90, 70)
            const start = await center(page.getByTestId('target'))
            await page.mouse.move(start.x, start.y)
            await page.mouse.down()
            await advance(page, 16)
            await page.mouse.move(start.x + 30, start.y + 20)
            await advance(page, 40)
            if (scenario === 'page') await scrollWindowBy(page, 45, 70)
            else await scrollShellBy(page, 45, 55)
            await advance(page, 30)

            expect((await gestures(page)).at(-1)?.info.offset).toEqual({ x: 60, y: 40 })
            await page.mouse.up()
            await advance(page, 20)
            expect((await gestures(page)).at(-1)?.info.offset).toEqual(
                scenario === 'page' ? { x: 150, y: 180 } : { x: 60, y: 40 }
            )
        }
    })

    test('captures replacement identity but retains mapped history for a stable closure', async ({
        page
    }) => {
        await openCase(page, 'pan-reference-replacement')
        let start = await center(page.getByTestId('target'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x + 20, start.y + 10)
        await advance(page, 40)
        await action(page, 'setMapping', 'triple')
        await advance(page, 16)
        await page.mouse.move(start.x + 35, start.y + 20)
        await advance(page, 40)
        await page.mouse.up()
        await advance(page, 20)
        start = await center(page.getByTestId('target'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x + 10, start.y + 5)
        await advance(page, 40)
        await page.mouse.up()
        await advance(page, 20)
        const replacement = await gestures(page)
        expect(replacement[replacement.length - 2].info.offset).toEqual({ x: 30, y: 15 })

        await openCase(page, 'pan-stable-closure-scale')
        start = await center(page.getByTestId('target'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x + 20, start.y + 10)
        await advance(page, 40)
        await action(page, 'setStableScale', 4)
        await page.waitForFunction(
            () =>
                Math.abs(
                    new DOMMatrix(
                        getComputedStyle(document.querySelector('[data-testid="stage"]')!).transform
                    ).a - 0.25
                ) < 0.0001,
            null,
            { polling: 10, timeout: 2000 }
        )
        await advance(page, 16)
        await page.mouse.move(start.x + 30, start.y + 15)
        await advance(page, 40)
        await page.mouse.up()
        await advance(page, 20)
        const stable = await gestures(page)
        expect(stable.at(-2)?.info.offset).toEqual({ x: 940, y: 720 })
        expect(stable.at(-1)?.info.offset).toEqual({ x: 940, y: 720 })
    })

    test('uses the last point on cancel and emits no public end after unmount', async ({
        page
    }) => {
        await openCase(page, 'pan-pointer-cancel')
        await canonicalSequence(page, 'cancel')
        expect((await gestures(page)).at(-1)).toMatchObject({
            type: 'onPanEnd',
            info: { offset: { x: 60, y: 40 } }
        })

        await openCase(page, 'pan-unmount-held')
        const start = await center(page.getByTestId('target'))
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await advance(page, 16)
        await page.mouse.move(start.x + 30, start.y + 20)
        await advance(page, 40)
        await action(page, 'unmount')
        await expect(page.getByTestId('target')).toHaveCount(0)
        await advance(page, 20)
        await page.mouse.move(start.x + 40, start.y + 30)
        await advance(page, 30)
        await page.mouse.up()
        await advance(page, 20)
        expect((await gestures(page)).some(({ type }) => type === 'onPanEnd')).toBe(false)
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(
            page.getByRole('link', { name: 'MotionConfig transformPagePoint — pan' })
        ).toHaveAttribute('href', /\/tests\/transform-page-point\/pan/)
    })
})
