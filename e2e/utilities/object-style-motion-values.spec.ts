import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/object-style-motion-values?@isPlaywright=true'

const readCardStyle = async (page: Page) =>
    page.getByTestId('object-style-card').evaluate((element) => {
        const style = getComputedStyle(element)
        const matrix = new DOMMatrixReadOnly(style.transform)
        return {
            x: matrix.m41,
            scaleX: matrix.a,
            opacity: Number(style.opacity),
            glowX: style.getPropertyValue('--glow-x').trim(),
            width: style.width,
            backgroundColor: style.backgroundColor
        }
    })

test.describe('object style MotionValues', () => {
    test('server-renders initial object-form style values', async ({ request }) => {
        const response = await request.get(URL)
        const html = await response.text()

        expect(response.ok()).toBe(true)
        expect(html).toContain('transform: translateX(24px) scale(0.92)')
        expect(html).toContain('opacity: 0.58')
        expect(html).toContain('--glow-x: 24px')
    })

    test('updates object-form MotionValue styles without styleString', async ({ page }) => {
        await page.goto(URL)

        await expect
            .poll(async () => {
                const style = await readCardStyle(page)
                return Math.round(style.x)
            })
            .toBe(24)

        const initial = await readCardStyle(page)
        expect(initial.glowX).toBe('24px')
        expect(initial.width).toBe('172px')
        expect(initial.backgroundColor).toBe('rgb(18, 50, 68)')

        await page.getByTestId('object-style-toggle').click()

        await expect
            .poll(async () => {
                const style = await readCardStyle(page)
                return {
                    x: Math.round(style.x),
                    opacity: Math.round(style.opacity * 100),
                    scaleX: Math.round(style.scaleX * 100)
                }
            })
            .toEqual({ x: 168, opacity: 100, scaleX: 108 })

        await expect
            .poll(async () => {
                const style = await readCardStyle(page)
                return style.glowX
            })
            .toBe('168px')

        await page.getByTestId('object-style-reset').click()

        await expect
            .poll(async () => {
                const style = await readCardStyle(page)
                return Math.round(style.x)
            })
            .toBe(24)
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(page.getByRole('link', { name: 'Object style MotionValues' })).toHaveAttribute(
            'href',
            /\/tests\/object-style-motion-values/
        )
    })
})
