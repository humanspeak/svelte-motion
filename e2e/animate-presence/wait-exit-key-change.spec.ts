import { expect, test, type Page } from '@playwright/test'

/**
 * Characterizes Motion 13.4.6's completion-driven wait-mode 0→1→2 scenario.
 * Legacy Svelte exits animate clones without forwarding the original element's
 * onAnimationComplete. This adaptation uses aggregate AnimatePresence
 * onExitComplete to request 2, rather than React's outgoing-element callback.
 */
const FORMS = ['object', 'variant'] as const

async function observeFrames(page: Page) {
    await page.evaluate(async () => {
        for (let frame = 0; frame < 12; frame++) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        }
    })
}

async function expectSettled(page: Page, key: number) {
    const scenario = page.locator('#scenario')
    const children = scenario.locator('.scenario-child:not([data-clone="true"])')
    await expect(children).toHaveCount(1)
    await expect(children).toHaveAttribute('id', `child-${key}`)
    await expect(children).toBeVisible()
    await expect
        .poll(() => children.evaluate((el) => Number(getComputedStyle(el).opacity)))
        .toBeGreaterThan(0.99)
    await expect(
        scenario.locator(
            '[data-clone="true"], [data-presence-placeholder="true"], [data-presence-wait-hidden="true"]'
        )
    ).toHaveCount(0)
    await observeFrames(page)
    await expect(children).toHaveCount(1)
    await expect(children).toHaveAttribute('id', `child-${key}`)
    await expect
        .poll(() => children.evaluate((el) => Number(getComputedStyle(el).opacity)))
        .toBeGreaterThan(0.99)
    await expect(
        scenario.locator(
            '[data-clone="true"], [data-presence-placeholder="true"], [data-presence-wait-hidden="true"]'
        )
    ).toHaveCount(0)
}

async function runScenario(page: Page) {
    await expectSettled(page, 0)
    await page.locator('#run').click()
    await expect(page.locator('#state')).toHaveText('1')
    await expect(page.locator('#scenario [data-clone="true"]')).toHaveCount(1)
    await expect(page.locator('#state')).toHaveText('2')
    await expect(page.locator('#callback-count')).toHaveText('1')
    await expect(page.locator('#events')).toHaveText(
        'initial:0|requested:1|exit-complete:requested-1|requested:2'
    )
    await expectSettled(page, 2)
    await expect(page.locator('#callback-count')).toHaveText('1')
}

for (const form of FORMS) {
    test(`${form}: latest key survives wait exit completion`, async ({ page }) => {
        await page.goto(
            `/tests/animate-presence/wait-exit-key-change?form=${form}&@isPlaywright=true`
        )
        await runScenario(page)
    })

    test(`${form}: reset cancels armed completion and allows a fresh run`, async ({ page }) => {
        await page.goto(
            `/tests/animate-presence/wait-exit-key-change?form=${form}&@isPlaywright=true`
        )
        await expectSettled(page, 0)
        await page.locator('#run').click()
        await expect(page.locator('#state')).toHaveText('1')
        await page.locator('#reset').click()
        await expectSettled(page, 0)
        await expect(page.locator('#callback-count')).toHaveText('0')
        await expect(page.locator('#events')).toHaveText('initial:0')
        await runScenario(page)
        await page.locator('#reset').click()
        await expectSettled(page, 0)
        await runScenario(page)
    })
}
