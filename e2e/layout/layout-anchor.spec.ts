import { expect, test, type Page } from '@playwright/test'

/**
 * Port of upstream motion `packages/framer-motion/cypress/integration/layout-anchor.ts`
 * @ v14.7.1. Fixture: src/routes/tests/layout-root/anchor/+page.svelte, a
 * port of `dev/react/src/tests/layout-anchor.tsx`.
 *
 * The parents resize 200→400px over 1s (linear) and the children's own
 * layout animation is delayed by 0.5s, so 250ms after the click the children
 * only follow their parents through relative projection.
 */

const URL = '/tests/layout-root/anchor?@isPlaywright=true'

async function clickAndWait(page: Page) {
    await page.goto(URL)
    // Not in upstream: wait for hydration, so the click isn't lost
    await expect(page.locator('.row[data-hydrated]')).toBeAttached()
    await page.waitForTimeout(50)
    await page.locator('#parent').click()
    // 25% through the 1s linear parent animation; the children haven't started
    await page.waitForTimeout(250)
}

const centers = (page: Page, parentId: string, childId: string) =>
    page.evaluate(
        ([parentId, childId]) => {
            const parent = document.getElementById(parentId)!.getBoundingClientRect()
            const child = document.getElementById(childId)!.getBoundingClientRect()
            return {
                parentX: parent.left + parent.width / 2,
                parentY: parent.top + parent.height / 2,
                childX: child.left + child.width / 2,
                childY: child.top + child.height / 2
            }
        },
        [parentId, childId]
    )

test.describe('layoutAnchor: centered child stays centered during parent resize', () => {
    test('Child with layoutAnchor={x:0.5,y:0.5} stays centered mid-animation', async ({ page }) => {
        await clickAndWait(page)
        const c = await centers(page, 'parent', 'child-anchored')

        // With layoutAnchor={x:0.5,y:0.5}, child should stay centered
        expect(Math.abs(c.childX - c.parentX)).toBeLessThanOrEqual(15)
        expect(Math.abs(c.childY - c.parentY)).toBeLessThanOrEqual(15)
    })

    test('Child without layoutAnchor drifts from center mid-animation', async ({ page }) => {
        await clickAndWait(page)
        const c = await centers(page, 'parent-no-anchor', 'child-no-anchor')

        // Without layoutAnchor, the child should drift away from center
        expect(Math.abs(c.childX - c.parentX)).toBeGreaterThan(5)
    })
})
