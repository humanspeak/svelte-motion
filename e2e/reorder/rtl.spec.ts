import { expect, test } from '@playwright/test'

test.describe('reorder/rtl', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/reorder/rtl?@isPlaywright=true')
        await page.getByTestId('item-aleph').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
    })

    test('maps leftward visual travel to the next logical value', async ({ page }) => {
        const aleph = page.getByTestId('item-aleph')
        const before = await aleph.boundingBox()
        if (!before) throw new Error('no aleph box')
        const cx = before.x + before.width / 2
        const cy = before.y + before.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        const heldPointerX = cx - 70

        try {
            // Cross bet's midpoint once, then leave the pointer completely
            // stationary. Reapplying this same live offset after the keyed DOM
            // move used to walk aleph through every remaining slot.
            for (let i = 1; i <= 12; i++) {
                await page.mouse.move(cx - (i * 70) / 12, cy)
                await page.waitForTimeout(16)
            }
            await expect(page.getByTestId('order')).toHaveText('bet,aleph,gimel,dalet')

            const heldFrames = await page.evaluate(async () => {
                const frames: Array<{ order: string; x: number; y: number }> = []
                for (let frame = 0; frame < 8; frame++) {
                    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
                    const item = document.querySelector<HTMLElement>('[data-testid="item-aleph"]')
                    const order = document.querySelector<HTMLElement>('[data-testid="order"]')
                    if (!(item && order)) throw new Error('missing RTL reorder probe')
                    const box = item.getBoundingClientRect()
                    frames.push({
                        order: order.textContent ?? '',
                        x: box.x + box.width / 2,
                        y: box.y + box.height / 2
                    })
                }
                return frames
            })

            expect(heldFrames.map(({ order }) => order)).toEqual(
                Array(8).fill('bet,aleph,gimel,dalet')
            )
            expect(Math.max(...heldFrames.map(({ x }) => Math.abs(x - heldPointerX)))).toBeLessThan(
                2
            )
            expect(Math.max(...heldFrames.map(({ y }) => Math.abs(y - cy)))).toBeLessThan(2)
        } finally {
            await page.mouse.up()
        }

        await expect(page.getByTestId('order')).toHaveText('bet,aleph,gimel,dalet')
        await page.waitForTimeout(700)
        const after = await aleph.boundingBox()
        if (!after) throw new Error('aleph did not settle')
        expect(Math.abs(after.x - (before.x - 100))).toBeLessThan(2)
        expect(Math.abs(after.y - before.y)).toBeLessThan(1)
    })

    test('FLIP-animates each newly displaced sibling across one continuous drag', async ({
        page
    }) => {
        const aleph = page.getByTestId('item-aleph')
        const bet = page.getByTestId('item-bet')
        const gimel = page.getByTestId('item-gimel')
        const [alephBox, betBox, gimelBox] = await Promise.all([
            aleph.boundingBox(),
            bet.boundingBox(),
            gimel.boundingBox()
        ])
        if (!(alephBox && betBox && gimelBox)) throw new Error('missing RTL reorder boxes')

        const startX = alephBox.x + alephBox.width / 2
        const pointerY = alephBox.y + alephBox.height / 2
        const betCenterX = betBox.x + betBox.width / 2
        const gimelCenterX = gimelBox.x + gimelBox.width / 2
        const firstTargetX = (startX + betCenterX) / 2 - 30
        const secondTargetX = (betCenterX + gimelCenterX) / 2 - 30

        // Continuously sample the first frames rendered for each order. Reading
        // only after toHaveText() can miss the short-lived FLIP transform.
        await page.evaluate(() => {
            type TransformSample = { transform: string; translation: number }
            type Probe = {
                framesByOrder: Record<
                    string,
                    Array<{ bet: TransformSample; gimel: TransformSample }>
                >
                running: boolean
            }
            const probeWindow = window as Window & { __rtlFlipProbe?: Probe }
            const probe: Probe = { framesByOrder: {}, running: true }
            probeWindow.__rtlFlipProbe = probe

            const readTransform = (testId: string): TransformSample => {
                const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
                if (!element) throw new Error(`missing ${testId}`)
                const transform = getComputedStyle(element).transform
                if (transform === 'none') return { transform, translation: 0 }
                const matrix = new DOMMatrixReadOnly(transform)
                return { transform, translation: Math.hypot(matrix.m41, matrix.m42) }
            }

            const sample = () => {
                const order = document.querySelector<HTMLElement>('[data-testid="order"]')
                if (!order) throw new Error('missing RTL order readout')
                const orderText = order.textContent ?? ''
                const frames = (probe.framesByOrder[orderText] ??= [])
                if (frames.length < 12) {
                    frames.push({
                        bet: readTransform('item-bet'),
                        gimel: readTransform('item-gimel')
                    })
                }
                if (probe.running) requestAnimationFrame(sample)
            }

            requestAnimationFrame(sample)
        })

        const moveInSteps = async (fromX: number, toX: number) => {
            for (let step = 1; step <= 12; step++) {
                await page.mouse.move(fromX + ((toX - fromX) * step) / 12, pointerY)
                await page.waitForTimeout(16)
            }
        }

        await page.mouse.move(startX, pointerY)
        await page.mouse.down()

        try {
            // Cross only the aleph/bet midpoint. Bet moves into aleph's old
            // slot and should immediately carry a non-identity FLIP translate.
            await moveInSteps(startX, firstTargetX)
            const firstOrder = 'bet,aleph,gimel,dalet'
            await expect(page.getByTestId('order')).toHaveText(firstOrder)
            const firstSwapFrames = await page.evaluate((order) => {
                const probeWindow = window as Window & {
                    __rtlFlipProbe?: {
                        framesByOrder: Record<
                            string,
                            Array<{
                                bet: { transform: string; translation: number }
                                gimel: { transform: string; translation: number }
                            }>
                        >
                    }
                }
                return probeWindow.__rtlFlipProbe?.framesByOrder[order] ?? []
            }, firstOrder)
            expect(firstSwapFrames.length, 'the first swap should be sampled').toBeGreaterThan(0)
            expect(
                Math.max(...firstSwapFrames.map((frame) => frame.bet.translation)),
                `bet should receive a FLIP transform after the first swap; samples=${JSON.stringify(firstSwapFrames)}`
            ).toBeGreaterThan(1)

            // Keep the button held and cross the bet/gimel midpoint. Gimel is
            // the newly displaced sibling for this distinct second reorder.
            await moveInSteps(firstTargetX, secondTargetX)
            const secondOrder = 'bet,gimel,aleph,dalet'
            await expect(page.getByTestId('order')).toHaveText(secondOrder)
            const secondSwapFrames = await page.evaluate((order) => {
                const probeWindow = window as Window & {
                    __rtlFlipProbe?: {
                        framesByOrder: Record<
                            string,
                            Array<{
                                bet: { transform: string; translation: number }
                                gimel: { transform: string; translation: number }
                            }>
                        >
                    }
                }
                return probeWindow.__rtlFlipProbe?.framesByOrder[order] ?? []
            }, secondOrder)
            expect(secondSwapFrames.length, 'the second swap should be sampled').toBeGreaterThan(0)
            expect(
                Math.max(...secondSwapFrames.map((frame) => frame.gimel.translation)),
                `gimel should receive a FLIP transform after the second swap; samples=${JSON.stringify(secondSwapFrames)}`
            ).toBeGreaterThan(1)
        } finally {
            await page.mouse.up()
            await page.evaluate(() => {
                const probeWindow = window as Window & {
                    __rtlFlipProbe?: { running?: boolean }
                }
                if (probeWindow.__rtlFlipProbe) probeWindow.__rtlFlipProbe.running = false
            })
        }
    })
})
