import { expect, test, type Page } from '@playwright/test'

/**
 * A layout animation with no configured transition uses upstream's
 * `defaultLayoutTransition` (0.45 s, ease `[0.4, 0, 0.1, 1]`):
 * `packages/motion-dom/src/projection/node/create-projection-node.ts`
 * `:670-673` and `:2926-2929` @ `v14.14.0`. Upstream's own layout tests assert
 * the default finishes in under 530 ms.
 *
 * Against `src/routes/tests/layout/default-transition/+page.svelte`, where
 * each box writes its `onLayoutAnimationStart` → `onLayoutAnimationComplete`
 * duration (rounded ms) to `data-duration`.
 */
const open = async (page: Page) => {
    await page.goto('/tests/layout/default-transition?@isPlaywright=true')
    await expect(page.locator('#default')).toBeVisible()
}

const measure = async (page: Page, id: string) => {
    await page.locator('#toggle').click()
    const box = page.locator(`#${id}`)
    await expect(box).toHaveAttribute('data-duration', /^\d+$/, { timeout: 2000 })
    return Number(await box.getAttribute('data-duration'))
}

test('a layout animation with no transition takes upstream’s 0.45 s', async ({ page }) => {
    await open(page)
    const duration = await measure(page, 'default')
    expect(duration).toBeGreaterThanOrEqual(420)
    expect(duration).toBeLessThanOrEqual(530)
})

test('a MotionConfig transition still reaches the layout animation', async ({ page }) => {
    await open(page)
    const duration = await measure(page, 'configured')
    expect(duration).toBeGreaterThanOrEqual(170)
    expect(duration).toBeLessThanOrEqual(280)
})

test('an explicit transition prop wins', async ({ page }) => {
    await open(page)
    const duration = await measure(page, 'explicit')
    expect(duration).toBeGreaterThanOrEqual(270)
    expect(duration).toBeLessThanOrEqual(380)
})
