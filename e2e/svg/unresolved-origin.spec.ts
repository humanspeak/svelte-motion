import { expect, test } from '@playwright/test'

const ROUTE = '/tests/svg/unresolved-origin'

/**
 * Upstream parity: `animate-unresolved-origin` (Motion 13.5.0, motion #2791).
 * Values animated without a base value must never be rendered before their
 * origin is read, so no `points="undefined"` / `NaN` placeholder may reach
 * the DOM, and a CSS variable animates from its inherited value, not from 0.
 */

declare global {
    interface Window {
        __points?: string[]
    }
}

test.describe('unresolved animation origins', () => {
    test('never writes a NaN/undefined points attribute', async ({ page }) => {
        await page.addInitScript(() => {
            window.__points = []
            const { value: original } = Object.getOwnPropertyDescriptor(
                Element.prototype,
                'setAttribute'
            ) as { value: (name: string, value: string) => void }
            Element.prototype.setAttribute = function (name: string, value: string) {
                if (name === 'points') window.__points?.push(String(value))
                return original.call(this, name, value)
            }
        })
        await page.goto(`${ROUTE}?@isPlaywright=true`)
        await page.waitForTimeout(1500)

        const points = await page.evaluate(() => window.__points ?? [])
        expect(points.length).toBeGreaterThan(2)
        for (const value of points) {
            expect(value).not.toMatch(/NaN|undefined/u)
        }
    })

    test('animates a CSS variable from its inherited value', async ({ page }) => {
        await page.goto(`${ROUTE}?@isPlaywright=true`)
        const el = page.locator('#css-var')
        await expect(el).toBeAttached()

        const read = () =>
            el.evaluate((node) => parseFloat(getComputedStyle(node).getPropertyValue('--x')))

        const samples: number[] = []
        for (let i = 0; i < 15; i++) {
            samples.push(await read())
            await page.waitForTimeout(100)
        }
        for (const sample of samples) {
            expect(sample, `samples: ${samples.join(', ')}`).toBeGreaterThanOrEqual(49.9)
        }
        expect(samples[samples.length - 1], `samples: ${samples.join(', ')}`).toBeGreaterThan(50.5)

        await expect.poll(read, { timeout: 6000 }).toBeGreaterThanOrEqual(60)
    })

    test('server HTML does not seed the animate target', async ({ page }) => {
        const html = await (await page.request.get(`${ROUTE}?@isPlaywright=true`)).text()
        expect(html).not.toMatch(/id="css-var"[^>]*style="[^"]*--x:\s*100/u)
        expect(html).not.toContain('style="points:')
    })

    test('CSS variable is mid-animation at ~5s, not already at its target', async ({ page }) => {
        const hydrationMessages: string[] = []
        page.on('console', (msg) => {
            if (/hydrat/iu.test(msg.text())) hydrationMessages.push(msg.text())
        })
        const start = Date.now()
        await page.goto(`${ROUTE}?@isPlaywright=true`)
        const el = page.locator('#css-var')
        await expect(el).toBeAttached()
        const read = () =>
            el.evaluate((node) => parseFloat(getComputedStyle(node).getPropertyValue('--x')))

        await expect.poll(read, { timeout: 6000 }).toBeGreaterThanOrEqual(51)
        const wait = 5000 - (Date.now() - start)
        if (wait > 0) await page.waitForTimeout(wait)
        const value = await read()
        expect(value).toBeGreaterThanOrEqual(60)
        expect(value).toBeLessThanOrEqual(90)
        expect(hydrationMessages).toEqual([])
    })

    test('is linked from the index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(
            page.getByRole('link', { name: 'SVG unresolved animation origins' })
        ).toHaveAttribute('href', /\/tests\/svg\/unresolved-origin/)
    })
})
