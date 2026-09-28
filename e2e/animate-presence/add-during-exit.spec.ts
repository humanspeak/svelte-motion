import { expect, test } from '@playwright/test'

/**
 * Parity coverage for Motion 13.4.5 (#3856): AnimatePresence must keep a
 * child that is added while another child's exit animation completes.
 *
 * Upstream React dropped the new child because its diffed-children state went
 * stale across a concurrent transition. svelte-motion exits via a
 * `data-clone="true"` copy of the leaving node, so the React bug class should
 * not apply — this spec is the tripwire proving it. Ported from upstream's
 * `animate-presence-transition-exit` Cypress test, extended to three add
 * timings around the 300ms exit.
 */

const MODES = ['sync', 'popLayout'] as const
const TIMINGS = ['exit-complete', 'just-before', 'same-tick'] as const

test.describe('AnimatePresence: add a child while another exit completes', () => {
    for (const mode of MODES) {
        for (const timing of TIMINGS) {
            test(`mode=${mode} timing=${timing}: A, C and D remain`, async ({ page }) => {
                await page.goto(
                    `/tests/animate-presence/add-during-exit?mode=${mode}&timing=${timing}&@isPlaywright=true`
                )
                await expect(page.locator('#item-C')).toBeVisible()
                await page.waitForTimeout(200)

                await page.locator('#remove').click()
                await expect(page.locator('#state')).toHaveText('ACD')

                // Let every in-flight exit (300ms) settle well past the add.
                await page.waitForTimeout(500)

                const itemIds = await page.evaluate(() =>
                    [...document.querySelectorAll('.item:not([data-clone])')].map((el) => el.id)
                )
                expect(itemIds, `rendered items for mode=${mode} timing=${timing}`).toEqual([
                    'item-A',
                    'item-C',
                    'item-D'
                ])

                const cloneCount = await page.evaluate(
                    () => document.querySelectorAll('[data-clone="true"]').length
                )
                expect(cloneCount, 'no exit clone may be left behind').toBe(0)

                const opacityD = await page
                    .locator('#item-D')
                    .evaluate((el) => getComputedStyle(el).opacity)
                expect(opacityD, 'D must be fully visible, not stuck mid-exit').toBe('1')
            })
        }
    }
})
