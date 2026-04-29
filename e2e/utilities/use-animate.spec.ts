import { expect, test } from '@playwright/test'

test.describe('useAnimate', () => {
    test('idle on load; list items render', async ({ page }) => {
        await page.goto('/tests/useAnimate')

        await expect(page.getByTestId('status')).toHaveText('idle')
        await expect(page.getByTestId('list').locator('li')).toHaveCount(4)
        await expect(page.getByTestId('item-1')).toHaveText('Item one')
    })

    test('clicking Animate runs the sequence and flips status to done', async ({ page }) => {
        await page.goto('/tests/useAnimate')

        await page.getByTestId('run').click()
        await expect(page.getByTestId('status')).toHaveText('done', { timeout: 4000 })

        // Final keyframes left scoped elements at their resting visible state.
        const opacity = await page
            .getByTestId('item-1')
            .evaluate((el) => getComputedStyle(el).opacity)
        expect(Number(opacity)).toBeCloseTo(1, 1)
    })

    test('the second sequence segment animates the target button (sibling of the list)', async ({
        page
    }) => {
        await page.goto('/tests/useAnimate')

        // The sequence's second segment grows the target to scale 1.15. It
        // only runs if scope.current resolves a parent containing both the
        // <ul> and the sibling <button.target>; attaching the scope to the
        // <ul> alone leaves the target's transform at 'none'.
        const target = page.getByTestId('target')
        const initialTransform = await target.evaluate((el) => getComputedStyle(el).transform)
        expect(initialTransform === 'none' || initialTransform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(
            true
        )

        await page.getByTestId('run').click()
        await expect(page.getByTestId('status')).toHaveText('done', { timeout: 4000 })

        const finalTransform = await target.evaluate((el) => getComputedStyle(el).transform)
        // matrix(a, b, c, d, e, f) — a and d are the x/y scale factors.
        const match = /matrix\(([\d.]+),\s*[\d.]+,\s*[\d.]+,\s*([\d.]+)/.exec(finalTransform)
        expect(match, `expected scaled transform, got ${finalTransform}`).not.toBeNull()
        expect(Number(match![1])).toBeCloseTo(1.15, 1)
        expect(Number(match![2])).toBeCloseTo(1.15, 1)
    })

    test('clicking Reset returns status to idle', async ({ page }) => {
        await page.goto('/tests/useAnimate')

        await page.getByTestId('run').click()
        await expect(page.getByTestId('status')).toHaveText('done', { timeout: 4000 })

        await page.getByTestId('reset').click()
        await expect(page.getByTestId('status')).toHaveText('idle')
    })
})
