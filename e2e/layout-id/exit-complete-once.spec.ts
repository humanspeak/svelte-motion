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
    test(`Only fires once when layoutId child exits and re-enters${suffix}`, async ({ page }) => {
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

/**
 * Plan 012 sign-off. Upstream motion @ v14.7.1, same page with a one-second
 * transition, slides every hop after "start 1" (box 4 → 2 → 3 → 4, each frame
 * a few px from the last). The hop from box 2 to box 3 must slide too: the box
 * 3 measurer animates from the box 2 measurer's snapshot, not from its own box.
 * Before the fix, it painted at box 3 on its first frame and held there.
 */
for (const [suffix, query] of [
    ['', ''],
    [' (owned)', '&owned=true']
] as const) {
    test(`Every hop after start 1 slides from the previous box${suffix}`, async ({ page }) => {
        await page.goto(`/tests/layout-id/exit-complete-once?@isPlaywright=true${query}`)
        await expect(page.locator('#done-count[data-hydrated]')).toBeAttached()
        await page.waitForTimeout(2000)
        await expect(page.locator('#done-count')).toHaveText('0')

        // Record the painted top of every measurer, relative to box 1, each frame.
        const frames = await page.evaluate(
            () =>
                new Promise<number[][]>((resolve) => {
                    const box1 = document
                        .querySelector('[data-measurer]')!
                        .closest('[style*="aqua"]')!
                    const origin =
                        box1.parentElement!.firstElementChild!.getBoundingClientRect().top
                    const out: number[][] = []
                    const start = performance.now()
                    const frame = () => {
                        out.push(
                            [...document.querySelectorAll('[data-measurer]')].map(
                                (el) => el.getBoundingClientRect().top - origin
                            )
                        )
                        if (performance.now() - start < 2500) requestAnimationFrame(frame)
                        else resolve(out)
                    }
                    ;(document.querySelector('#start-1') as HTMLButtonElement).click()
                    requestAnimationFrame(frame)
                })
        )

        // Boxes are 120px apart (100px + 20px margin). Box 2 → box 3 is 120 → 240.
        const leftBox2 = frames.findIndex((tops) => tops.some((top) => top > 125 && top < 235))
        const reachedBox2 = frames.findIndex(
            (tops) => tops.length && tops.every((top) => Math.abs(top - 120) < 1)
        )
        expect(reachedBox2, 'the measurer reaches box 2').toBeGreaterThan(-1)
        const afterBox2 = frames.slice(reachedBox2)
        expect(
            afterBox2.some((tops) => tops.some((top) => top > 125 && top < 235)),
            `painted between box 2 and box 3 (first in-between frame ${leftBox2})`
        ).toBe(true)
        // No frame-to-frame jump of a box or more anywhere after the click.
        for (let i = 1; i < frames.length; i++) {
            const prev = frames[i - 1]
            const cur = frames[i]
            if (!prev.length || !cur.length) continue
            const step = Math.min(
                ...cur.map((top) => Math.min(...prev.map((p) => Math.abs(top - p))))
            )
            expect(
                step,
                `frame ${i}: ${prev.map(Math.round).join(',')} → ${cur.map(Math.round).join(',')}`
            ).toBeLessThan(60)
        }
        await expect(page.locator('#done-count')).toHaveText('1')
    })
}
