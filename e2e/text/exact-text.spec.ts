import { expect, test } from '@playwright/test'

const cases = {
    single: 'a',
    adjacent: 'ab',
    graphemes: '👩‍💻 é',
    authored: ' a   b\n',
    value: 'value',
    svg: 'svg',
    void: ''
}

for (const javaScriptEnabled of [false, true]) {
    test.describe(javaScriptEnabled ? 'hydrated exact text' : 'SSR exact text', () => {
        test.use({ javaScriptEnabled })
        test('preserves consumer text with and without optimized appear', async ({ page }) => {
            await page.goto('/tests/exact-text')
            await expect(page.getByTestId('hydrated')).toHaveText(javaScriptEnabled ? 'yes' : 'no')
            for (const mode of ['plain', 'appear']) {
                const section = page.getByTestId(mode)
                for (const [id, expected] of Object.entries(cases)) {
                    const container = section.getByTestId(id)
                    // Bootstrap script source is not consumer text. Read all other nodes,
                    // including sibling text nodes, without modifying the rendered DOM.
                    const text = await container.evaluate((element) => {
                        const read = (node: Node): string =>
                            node.nodeName.toLowerCase() === 'script'
                                ? ''
                                : node.nodeType === Node.TEXT_NODE
                                  ? (node.textContent ?? '')
                                  : Array.from(node.childNodes).map(read).join('')
                        return read(element)
                    })
                    expect(text, `${mode}/${id}`).toBe(expected)
                }
                expect(await section.locator('script').count()).toBe(mode === 'appear' ? 10 : 0)
            }
            if (javaScriptEnabled) {
                await page.getByTestId('plain').getByRole('button').click()
                await expect(page.getByTestId('plain').getByTestId('value')).toHaveText('updated')
                await expect(
                    page.getByTestId('appear').getByTestId('single').locator('span')
                ).toHaveCSS('opacity', '1')
            }
        })
    })
}
