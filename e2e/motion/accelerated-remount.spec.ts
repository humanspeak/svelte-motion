import { expect, test } from '@playwright/test'

/**
 * Port of upstream motion's Cypress
 * `packages/framer-motion/cypress/integration/suspense-remount-running-animation.ts`
 * @ v14.9.1 (https://github.com/motiondivision/motion/issues/4027).
 *
 * The box is remounted (here: a `key` change, our equivalent of upstream's
 * Suspense remount) while its accelerated opacity animation is past its
 * duration but hasn't finished, because the main thread is busy. The replayed
 * enter animation must still take it to its target.
 */

const URL = '/tests/motion/accelerated-remount?@isPlaywright=true'

test('a remount during an accelerated animation replays opacity to its target', async ({
    page
}) => {
    await page.goto(URL)
    await expect(page.locator('#remounted')).toHaveCount(1)
    await page.waitForTimeout(500)
    const opacity = await page
        .locator('#box')
        .evaluate((element) => parseFloat(getComputedStyle(element).opacity))
    expect(opacity).toBe(1)
})
