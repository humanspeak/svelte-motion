import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/transform-template/optimized-appear?@isPlaywright=true'

const readStyle = (page: Page, testId: string) => async () =>
    (await page.getByTestId(testId).getAttribute('style')) ?? ''

test.describe('transformTemplate — optimized appear suppression page', () => {
    test('suppresses the SSR appear bootstrap only for the templated transform', async ({
        page
    }) => {
        const response = await page.request.get(URL)
        const html = await response.text()

        const openingTag = (testId: string): string =>
            html.match(new RegExp(`<[a-zA-Z]+[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? ''

        const slateTag = openingTag('appear-slate')
        expect(slateTag).not.toBe('')
        // Templated, transform-animating element: no WAAPI bootstrap, so no untemplated
        // transform can paint before hydration/handoff (#402, gap 2).
        expect(slateTag).not.toContain('data-framer-appear-id')
        // First painted frame is already the templated transform.
        expect(slateTag).toContain('translateY(0px)')

        // Opacity-only template animates no transform → optimized appear stays on.
        expect(openingTag('appear-mint')).toContain('data-framer-appear-id')
        // No template at all → accelerated baseline keeps optimized appear.
        expect(openingTag('appear-blue')).toContain('data-framer-appear-id')
    })

    test('settles every box on its templated/expected transform', async ({ page }) => {
        await page.goto(URL)

        // The boxes run a 1.6s enter; allow generous headroom so a cold/loaded
        // preview server can't push the settle past the default poll timeout.
        const settle = { timeout: 8000 }

        // Slate: templated transform animates to the resting templated output.
        await expect.poll(readStyle(page, 'appear-slate'), settle).toContain('translateY(70px)')
        await expect.poll(readStyle(page, 'appear-slate'), settle).toContain('translateX(70px)')
        await expect.poll(readStyle(page, 'appear-slate'), settle).toContain('opacity: 1')

        // Mint: opacity-only enter, transform pinned at the fixed template.
        await expect.poll(readStyle(page, 'appear-mint'), settle).toContain('translateY(24px)')
        await expect.poll(readStyle(page, 'appear-mint'), settle).toContain('opacity: 1')

        // Blue: accelerated transform settles at the untemplated target.
        await expect.poll(readStyle(page, 'appear-blue'), settle).toContain('translateX(70px)')
        await expect.poll(readStyle(page, 'appear-blue'), settle).toContain('opacity: 1')
    })

    test('runs at most one optimized-appear transform animation, never the templated one', async ({
        page
    }) => {
        await page.goto(URL)

        // The store only populates on a full server render (the SSR bootstrap script).
        await expect(page.getByTestId('appear-fully-loaded')).toHaveText('yes')
        // The appear animations wait for the browser's paint-ready signal and are
        // skipped once Motion has mounted, so whether blue's runs depends on the
        // browser (Chromium: yes; Firefox: usually Motion mounts first). Either
        // way the templated slate box never runs one: only blue's id may appear.
        await page.waitForTimeout(500)
        const { blueId, transformIds } = await page.evaluate(() => ({
            blueId: document
                .querySelector('[data-testid="appear-blue"]')
                ?.getAttribute('data-framer-appear-id'),
            transformIds: (
                (
                    window as unknown as {
                        __SvelteMotionAppear?: { started: Array<{ id: string; name: string }> }
                    }
                ).__SvelteMotionAppear?.started ?? []
            )
                .filter((entry) => entry.name === 'transform')
                .map((entry) => entry.id)
        }))
        expect(blueId).toBeTruthy()
        expect(transformIds.length).toBeLessThanOrEqual(1)
        for (const id of transformIds) expect(id).toBe(blueId)
    })

    test('is linked from the root test index', async ({ page }) => {
        await page.goto('/?@isPlaywright=true')
        await expect(
            page.getByRole('link', { name: /optimized appear suppression/ })
        ).toHaveAttribute('href', /\/tests\/transform-template\/optimized-appear/)
    })
})
