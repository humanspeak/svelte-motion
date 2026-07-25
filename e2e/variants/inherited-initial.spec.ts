import { expect, test, type Page } from '@playwright/test'

/**
 * Inherited `initial` variant labels must seed the children's FIRST PAINT
 * (#449, plan 006 — operator-found sign-off blocker).
 *
 * The canonical upstream pattern puts the labels on the parent
 * (`initial="closed" animate={open ? 'open' : 'closed'}`) and gives children
 * only a `variants` map. `makeLatestValues` already falls back to
 * `context.initial`, but the container published only the ANIMATE label through
 * the parent→child channel, so children seeded nothing, painted fully visible,
 * and the first expand click animated to a pose they already occupied.
 */
test.describe('variants/inherited-initial', () => {
    const ROUTE = '/tests/variants/inherited-initial?@isPlaywright=true'
    const CHILDREN = ['child-0', 'child-1', 'child-2']

    const readOpacities = (page: Page) =>
        page.evaluate(
            (ids) =>
                ids.map((id) => {
                    const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
                    return el ? Number.parseFloat(getComputedStyle(el).opacity) : -1
                }),
            CHILDREN
        )

    test('children paint at the inherited closed pose, then animate open and back', async ({
        page
    }) => {
        await page.goto(ROUTE)
        await page.getByTestId('parent').waitFor({ state: 'visible' })

        // 1. FIRST PAINT — the assertion this plan exists for. Children carry no
        //    `initial` of their own, so they must seed from the parent's
        //    inherited `closed` label. Pre-fix they render at opacity ~1.
        const first = await readOpacities(page)
        for (const [index, opacity] of first.entries()) {
            expect(opacity, `child-${index} first-paint opacity ${opacity}`).toBeLessThan(0.05)
        }

        // 2. FIRST CLICK ANIMATES — sample every frame while opening. Every child
        //    must arrive opaque, and at least one sampled frame must be strictly
        //    mid-flight, which is what distinguishes an animation from a snap.
        const samples = await page.evaluate(
            ({ ids, ms }) =>
                new Promise<number[][]>((resolve) => {
                    const out: number[][] = []
                    const start = performance.now()
                    const read = () =>
                        ids.map((id) => {
                            const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
                            return el ? Number.parseFloat(getComputedStyle(el).opacity) : -1
                        })
                    document.querySelector<HTMLElement>('[data-testid="toggle"]')?.click()
                    const tick = () => {
                        out.push(read())
                        if (performance.now() - start < ms) requestAnimationFrame(tick)
                        else resolve(out)
                    }
                    requestAnimationFrame(tick)
                }),
            { ids: CHILDREN, ms: 1000 }
        )

        const settled = samples[samples.length - 1]
        for (const [index, opacity] of settled.entries()) {
            expect(opacity, `child-${index} opened opacity ${opacity}`).toBeGreaterThan(0.95)
        }

        const sawMidFlight = samples.some((frame) =>
            frame.some((opacity) => opacity > 0.1 && opacity < 0.9)
        )
        expect(sawMidFlight, 'at least one mid-flight opacity between 0.1 and 0.9').toBe(true)

        // 3. COLLAPSE ROUND-TRIP — the inherited label still drives the reverse.
        await page.getByTestId('toggle').click()
        await expect
            .poll(async () => Math.max(...(await readOpacities(page))), { timeout: 2000 })
            .toBeLessThan(0.05)
    })
})
