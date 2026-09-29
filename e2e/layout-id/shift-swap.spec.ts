import { expect, test } from '@playwright/test'

/**
 * Plan 009 Step 3 against `/tests/layout-id/shift-swap`: ONE state change
 * both shifts a `layoutId` underline (a 120px banner appears above the tab
 * strip) and swaps it to another tab. Upstream snapshots the departing
 * element in `getSnapshotBeforeUpdate`, i.e. at its PAINTED pre-update
 * position, so the incoming underline's first frame must start there — not
 * at the banner-shifted position of the old tab, and not at its new slot.
 */
type Rect = { top: number; left: number }

test.describe('layoutId: same-update shift + swap', () => {
    test('the handoff starts from the painted, pre-shift position', async ({ page }) => {
        await page.goto('/tests/layout-id/shift-swap?@isPlaywright=true')
        const underline = page.getByTestId('underline')
        await expect(underline).toHaveAttribute('data-is-loaded', 'ready')
        await page.waitForTimeout(250)

        const { before, frames } = await page.evaluate(
            () =>
                new Promise<{ before: Rect; frames: Rect[] }>((resolve) => {
                    const read = (): Rect => {
                        const el = document.querySelector('[data-testid="underline"]')!
                        const { top, left } = el.getBoundingClientRect()
                        return { top, left }
                    }
                    const frames: Rect[] = []
                    requestAnimationFrame(() => {
                        // Nothing has changed since the last paint: this is
                        // the painted, pre-click position.
                        const before = read()
                        document.getElementById('toggle')!.click()
                        const t0 = performance.now()
                        // Read each frame after its rAF callbacks (including
                        // Motion's) have run — i.e. what that frame paints.
                        const sample = () =>
                            setTimeout(() => {
                                frames.push(read())
                                if (performance.now() - t0 < 1300) requestAnimationFrame(sample)
                                else resolve({ before, frames })
                            }, 0)
                        requestAnimationFrame(sample)
                    })
                })
        )

        const trace = frames.map((f) => `${Math.round(f.left)},${Math.round(f.top)}`).join(' ')
        const [first] = frames
        const last = frames[frames.length - 1]

        // It does move: down by the banner (120 + 16 margin) and across two tabs.
        expect(last.top - before.top, trace).toBeGreaterThan(100)
        expect(last.left - before.left, trace).toBeGreaterThan(200)

        // First post-click frame starts at the painted pre-click position.
        expect(
            Math.abs(first.top - before.top),
            `before ${JSON.stringify(before)}: ${trace}`
        ).toBeLessThanOrEqual(1)
        expect(
            Math.abs(first.left - before.left),
            `before ${JSON.stringify(before)}: ${trace}`
        ).toBeLessThanOrEqual(1)

        // ...and then animates (intermediate positions) rather than snapping.
        const between = frames.filter(
            (f) => f.top > before.top + 5 && f.top < last.top - 5 && f.left > before.left + 5
        )
        expect(between.length, trace).toBeGreaterThan(10)
    })
})
