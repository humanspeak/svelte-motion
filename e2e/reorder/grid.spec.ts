import { expect, test } from '@playwright/test'

test.describe('reorder/grid', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/reorder/grid?@isPlaywright=true')
        await page.getByTestId('tile-a').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
    })

    test('moves across a row boundary and FLIPs displaced siblings', async ({ page }) => {
        const tile = page.getByTestId('tile-a')
        const before = await tile.boundingBox()
        if (!before) throw new Error('no tile-a box')
        const cx = before.x + before.width / 2
        const cy = before.y + before.height / 2

        await page.evaluate(() => {
            const probe = { b: 0, c: 0, d: 0, e: 0, running: true }
            ;(window as Window & { __gridFlipProbe?: typeof probe }).__gridFlipProbe = probe

            const sample = () => {
                for (const value of ['b', 'c', 'd', 'e'] as const) {
                    const element = document.querySelector<HTMLElement>(
                        `[data-testid="tile-${value}"]`
                    )
                    if (!element) throw new Error(`missing tile-${value}`)
                    const transform = getComputedStyle(element).transform
                    if (transform !== 'none') {
                        const matrix = new DOMMatrixReadOnly(transform)
                        probe[value] = Math.max(probe[value], Math.hypot(matrix.m41, matrix.m42))
                    }
                }
                if (probe.running) requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
        })

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 16; i++) {
            await page.mouse.move(cx + (i * 110) / 16, cy + (i * 110) / 16)
            await page.waitForTimeout(16)
        }

        await expect(page.getByTestId('order')).toHaveText('b,c,d,e,a,f')
        const displacedTranslations = await page.evaluate(() => {
            const probeWindow = window as Window & {
                __gridFlipProbe?: { b: number; c: number; d: number; e: number; running: boolean }
            }
            if (!probeWindow.__gridFlipProbe) throw new Error('missing grid FLIP probe')
            probeWindow.__gridFlipProbe.running = false
            return probeWindow.__gridFlipProbe
        })
        for (const value of ['b', 'c', 'd', 'e'] as const) {
            expect(
                displacedTranslations[value],
                `tile-${value} should receive its own FLIP translation`
            ).toBeGreaterThan(1)
        }

        await page.mouse.up()
        await page.waitForTimeout(800)

        const after = await tile.boundingBox()
        if (!after) throw new Error('tile-a did not settle')
        expect(Math.abs(after.x - (before.x + 100))).toBeLessThan(2)
        expect(Math.abs(after.y - (before.y + 100))).toBeLessThan(2)
    })
})
