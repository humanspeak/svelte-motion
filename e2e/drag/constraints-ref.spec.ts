import { expect, test } from '@playwright/test'

test.describe('drag/constraints-ref', () => {
    test('allows elastic overdrag while held and settles inside container ref', async ({
        page
    }) => {
        await page.goto('/tests/drag/constraints-ref?@isPlaywright=true')
        const el = page.getByTestId('drag-ref')
        const bounds = page.getByTestId('constraint-box')
        await el.waitFor({ state: 'visible' })
        await bounds.waitFor({ state: 'visible' })
        const s = await el.boundingBox()
        const b = await bounds.boundingBox()
        if (!s) throw new Error('no s')
        if (!b) throw new Error('no bounds')

        const startX = s.x + s.width / 2
        const startY = s.y + s.height / 2
        await page.mouse.move(startX, startY)
        await page.mouse.down()

        // Framer's default dragElastic is 0.5: the element can be pulled
        // outside the referenced constraints while the pointer is held.
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(startX - i * 32, startY, { steps: 1 })
            await page.waitForTimeout(16)
        }
        await page.waitForTimeout(80)
        const active = await el.boundingBox()
        if (!active) throw new Error('no active bbox')
        expect(active.x).toBeLessThan(b.x)

        const releaseSamplesPromise = page.evaluate(() => {
            return new Promise<Array<{ t: number; x: number }>>((resolve) => {
                const node = document.querySelector('[data-testid="drag-ref"]')
                if (!(node instanceof HTMLElement)) {
                    resolve([])
                    return
                }
                const start = performance.now()
                const samples: Array<{ t: number; x: number }> = []
                const tick = () => {
                    const rect = node.getBoundingClientRect()
                    samples.push({
                        t: Math.round(performance.now() - start),
                        x: Math.round(rect.x * 100) / 100
                    })
                    if (performance.now() - start < 350) {
                        requestAnimationFrame(tick)
                    } else {
                        resolve(samples)
                    }
                }
                requestAnimationFrame(tick)
            })
        })
        await page.mouse.up()
        const releaseSamples = await releaseSamplesPromise
        await page.waitForTimeout(1000)

        const e = await el.boundingBox()
        if (!e) throw new Error('no e')
        expect(e.x).toBeGreaterThanOrEqual(b.x - 1)
        expect(e.y).toBeGreaterThanOrEqual(b.y - 1)
        expect(e.x + e.width).toBeLessThanOrEqual(b.x + b.width + 1)
        expect(e.y + e.height).toBeLessThanOrEqual(b.y + b.height + 1)

        const distinctX = new Set(releaseSamples.map((sample) => Math.round(sample.x))).size
        expect(distinctX).toBeGreaterThan(3)
        expect(releaseSamples[0]?.x).toBeLessThan(b.x - 20)
        expect(releaseSamples[1]?.x).toBeLessThan(b.x - 5)
        expect(releaseSamples.some((sample) => sample.x > active.x + 10 && sample.x < b.x)).toBe(
            true
        )
    })
})
