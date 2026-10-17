import { expect, test, type Page } from '@playwright/test'

/**
 * The `onUpdate(latest)` prop on motion components: called once per frame
 * with every latest value, and keeps the element's transforms on the main
 * thread (Motion 14.2 `canAccelerateTransform`). Adding it mid-animation
 * demotes the running accelerated animation (`VisualElement.update`).
 *
 * Page: `src/routes/tests/motion/on-update/+page.svelte`.
 */

const count = (page: Page, id: string) =>
    page.evaluate(
        (id) =>
            (
                window as unknown as { countTransformAnimations: (id: string) => number }
            ).countTransformAnimations(id),
        id
    )

const readX = (page: Page, id: string) =>
    page.evaluate(
        (id) => new DOMMatrixReadOnly(getComputedStyle(document.getElementById(id)!).transform).m41,
        id
    )

test.describe('onUpdate prop', () => {
    test.use({ viewport: { width: 500, height: 500 } })

    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/motion/on-update?@isPlaywright=true')
        await page.waitForSelector('#control')
        await page.waitForTimeout(150)
    })

    test('an onUpdate prop keeps the element on the main thread and receives latest values', async ({
        page
    }) => {
        expect(await count(page, 'prop')).toBe(0)
        await page.waitForTimeout(1200)
        await expect(page.getByTestId('prop-latest')).toHaveText('100')
        const calls = Number(await page.getByTestId('prop-calls').textContent())
        expect(calls).toBeGreaterThan(10)
    })

    test('a transition-level onUpdate keeps the element on the main thread', async ({ page }) => {
        expect(await count(page, 'transition')).toBe(0)
    })

    test('adding onUpdate mid-animation moves the element to the main thread', async ({ page }) => {
        expect(await count(page, 'late')).toBe(1)
        await page.waitForTimeout(300)
        expect(await count(page, 'late')).toBe(0)
        const first = await readX(page, 'late')
        await page.waitForTimeout(100)
        const second = await readX(page, 'late')
        expect(second).toBeGreaterThan(first)
    })

    test('without onUpdate the element stays accelerated', async ({ page }) => {
        expect(await count(page, 'control')).toBe(1)
    })
})
