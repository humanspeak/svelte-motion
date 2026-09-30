import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/animate-presence/clone-typography?@isPlaywright=true'

async function readTypography(page: Page, selector: string) {
    return page.locator(selector).evaluate((card) => {
        const elements = [card, ...card.querySelectorAll('*')]
        return {
            elements: elements.map((element) => {
                const style = getComputedStyle(element)
                return { fontSize: style.fontSize, lineHeight: style.lineHeight }
            }),
            pseudo: ['::before', '::after'].map((pseudo) => {
                const style = getComputedStyle(card, pseudo)
                return { fontSize: style.fontSize, lineHeight: style.lineHeight }
            })
        }
    })
}

for (const fallback of [false, true]) {
    test.describe(fallback ? 'typography without Typed OM' : 'typography with Typed OM', () => {
        test.beforeEach(async ({ page }) => {
            if (fallback) {
                await page.addInitScript(() => {
                    Object.defineProperty(Element.prototype, 'computedStyleMap', {
                        value: undefined
                    })
                })
            }
        })

        for (const leading of [
            'unitless',
            'normal',
            'length',
            'percentage',
            'variable',
            'inherit'
        ]) {
            test(`${leading}: preserves nested text and generated captions during the fade`, async ({
                page
            }) => {
                await page.goto(URL)
                await page.getByRole('combobox', { name: 'Line height' }).selectOption(leading)
                const before = await readTypography(page, '#typography-card')
                await page.locator('#fade').click()
                const clone = '[data-clone="true"]'
                await expect(page.locator('[data-clone="true"]')).toBeVisible()
                expect(await readTypography(page, clone)).toEqual(before)
                await expect(page.locator('[data-clone="true"]')).toHaveCount(0)
                await expect(page.locator('#completed')).toHaveText('1')
            })
        }

        for (const source of ['', '&inline=true', '&idRule=true']) {
            test(`unitless line height scales throughout the font-size exit (${source || 'stylesheet'})`, async ({
                page
            }) => {
                await page.goto(`${URL}&grow=true${source}`)
                await page.locator('#fade').click()
                const clone = page.locator('[data-clone="true"]')
                await expect(clone).toBeVisible()
                await expect
                    .poll(() =>
                        clone.evaluate((card) => parseFloat(getComputedStyle(card).fontSize))
                    )
                    .toBeGreaterThan(20)
                const during = await readTypography(page, '[data-clone="true"]')
                const ratio = source === '&idRule=true' ? 1.75 : 1.5
                for (const { fontSize, lineHeight } of [...during.elements, ...during.pseudo]) {
                    expect(parseFloat(lineHeight) / parseFloat(fontSize)).toBeCloseTo(ratio, 2)
                }
                await expect(clone).toHaveCount(0)
                await expect(page.locator('[data-presence-placeholder="true"]')).toHaveCount(0)
            })
        }

        test('captures root line-height changes while nested text keeps animating', async ({
            page
        }) => {
            await page.goto(URL)
            await page.getByRole('combobox', { name: 'Line height' }).selectOption('variable')
            await page.locator('#typography-card').evaluate(async (card) => {
                const child = card.querySelector<HTMLElement>('.nested-text')!
                let opacity = false
                const timer = window.setInterval(() => {
                    opacity = !opacity
                    child.style.opacity = opacity ? '0.99' : '1'
                }, 16)
                ;(window as Window & { typographyTimer?: number }).typographyTimer = timer
                ;(card as HTMLElement).style.setProperty('--leading', '2')
                for (let frame = 0; frame < 12; frame += 1) {
                    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
                }
            })
            try {
                const before = await readTypography(page, '#typography-card')
                await page.locator('#fade').click()
                await expect(page.locator('[data-clone="true"]')).toBeVisible()
                expect(await readTypography(page, '[data-clone="true"]')).toEqual(before)
                await expect(page.locator('[data-clone="true"]')).toHaveCount(0)
            } finally {
                await page.evaluate(() =>
                    clearInterval((window as Window & { typographyTimer?: number }).typographyTimer)
                )
            }
        })

        test('preserves :empty typography without leaving a probe behind', async ({ page }) => {
            await page.goto(URL)
            // Both states resolve to 24px on the root, but only :empty retains
            // a unitless value. A probe must not change which rule applies.
            await page.addStyleTag({
                content:
                    '.typography-lab .typography-card { line-height: 24px; } .typography-card:empty { line-height: 1.5; }'
            })
            await page.locator('#typography-card').evaluate((card) => card.replaceChildren())
            await expect
                .poll(() =>
                    page
                        .locator('#typography-card')
                        .evaluate((card) => getComputedStyle(card).lineHeight)
                )
                .toBe('24px')
            const before = await readTypography(page, '#typography-card')
            await page.locator('#fade').click()
            await expect(page.locator('[data-clone="true"]')).toBeVisible()
            expect(await readTypography(page, '[data-clone="true"]')).toEqual(before)
            await expect(page.locator('[data-presence-style-probe]')).toHaveCount(0)
            await expect(page.locator('[data-clone="true"]')).toHaveCount(0)
        })
    })
}

test('links the typography demo from the test index', async ({ page }) => {
    await page.goto('/?@isPlaywright=true')
    await expect(
        page.getByRole('link', { name: 'Exit typography and inheritance' })
    ).toHaveAttribute('href', /\/tests\/animate-presence\/clone-typography/)
})
