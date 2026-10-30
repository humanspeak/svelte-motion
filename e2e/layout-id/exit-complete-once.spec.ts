import { expect, test } from '@playwright/test'

/**
 * Plan 012. Verbatim port of upstream motion
 * `packages/framer-motion/cypress/integration/animate-presence-exit-complete-multiple.ts`
 * @ v14.7.1 (#3233). Page: src/routes/tests/layout-id/exit-complete-once/+page.svelte,
 * a port of `dev/react/src/tests/animate-presence-exit-complete-multiple.tsx`.
 *
 * `onExitComplete` fires exactly once when a `layoutId` child exits and
 * re-enters through several `AnimatePresence` boundaries.
 */

for (const [suffix, query] of [
    ['', ''],
    [' (owned)', '&owned=true']
] as const) {
    test.fixme(`Only fires once when layoutId child exits and re-enters${suffix} (plan 012 Step 2)`, async ({
        page
    }) => {
        await page.goto(`/tests/layout-id/exit-complete-once?@isPlaywright=true${query}`)
        await expect(page.locator('#done-count[data-hydrated]')).toBeAttached()
        // Wait for initial layout animations to settle
        await page.waitForTimeout(2000)
        await expect(page.locator('#done-count')).toHaveText('0')
        await page.locator('#start-1').click({ position: { x: 10, y: 10 }, force: true })
        // Wait for all layout animations to complete
        await page.waitForTimeout(3000)
        expect(await page.locator('#done-count').textContent()).toBe('1')
    })
}
