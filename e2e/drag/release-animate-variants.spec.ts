/**
 * Port of upstream `tests/react/issue-1831.spec.ts` (Motion 14.7.1,
 * `d850bb38b`).
 *
 * https://github.com/motiondivision/motion/issues/1831
 *
 * A draggable element with animate={["base", "exiting", "center"]} (and also a
 * single "center" label) should not fire onAnimationComplete when a drag is
 * merely released: the animate prop hasn't changed, so no variant animation
 * has run. Before the fix, releasing the drag deactivated "whileDrag", which
 * re-ran every animate label and immediately fired onAnimationComplete once
 * per label (all three variants), before the snap-back had even happened.
 *
 * svelte-motion bridges onAnimationComplete from motion-dom's animation state,
 * so the fix arrives with the motion-dom bump.
 */
import { expect, test, type Page } from '@playwright/test'

type CompletedWindow = Window & { completed: string[] }

async function settle(page: Page, single: boolean) {
    await page.goto(`/tests/drag/release-animate-variants?@isPlaywright=true&single=${single}`)
    await expect(page.getByTestId('box')).toBeVisible()
    // Wait for the mount animation (0.2s) to complete, then clear the log
    await expect
        .poll(() => page.evaluate(() => (window as unknown as CompletedWindow).completed.length))
        .toBeGreaterThan(0)
    await page.waitForTimeout(300)
    await page.evaluate(() => ((window as unknown as CompletedWindow).completed = []))
}

async function dragAndRelease(page: Page) {
    await page.mouse.move(300, 200)
    await page.mouse.down()
    await page.mouse.move(320, 200, { steps: 5 })
    await page.mouse.move(360, 200, { steps: 5 })
    await page.waitForTimeout(100)
    await page.mouse.up()
    await page.waitForTimeout(100)
    return page.evaluate(() => [...(window as unknown as CompletedWindow).completed])
}

test.describe('issue #1831: drag release triggers animating variants', () => {
    test('control: no onAnimationComplete without interaction', async ({ page }) => {
        await settle(page, false)
        await page.waitForTimeout(300)
        expect(await page.evaluate(() => (window as unknown as CompletedWindow).completed)).toEqual(
            []
        )
    })

    test("releasing drag doesn't fire onAnimationComplete for every variant", async ({ page }) => {
        await settle(page, false)
        expect(await dragAndRelease(page)).toEqual([])
    })

    test("releasing drag doesn't fire onAnimationComplete for a single variant", async ({
        page
    }) => {
        await settle(page, true)
        expect(await dragAndRelease(page)).toEqual([])
    })
})
