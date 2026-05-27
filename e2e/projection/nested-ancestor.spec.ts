import { expect, test } from '@playwright/test'

/**
 * Projection foundation (#379) — nested-ancestor measure semantics.
 *
 * An OUTER `<motion.div layout>` wrapper carries a user-authored
 * `transform: translate(40px, 60px)`. An INNER `<motion.div layout>`
 * toggles between the wrapper's left and right edge.
 *
 * `ProjectionNode.measure()` matches framer-motion's `removeBoxTransforms`:
 * it strips only MOTION-applied transforms (written after mount) and
 * preserves the USER-authored base. The page reports the inner's move
 * delta plus the "stripped offset" — the gap between the inner's raw
 * on-screen rect and the event's `layout` box:
 *
 *   • Static base only        → offset (0, 0)  — user transform preserved
 *   • Post-mount +40px-down    → offset (0, 40) — only the motion part removed
 *
 * These two assertions are the regression guard for the measure fix:
 * a regression that zeroed the whole transform would report (0, 0) even
 * with the post-mount transform applied; a regression that left motion
 * transforms in would report a non-zero offset for the static case.
 */

interface Delta {
    dx: number
    dy: number
    changed: boolean
}

interface Offset {
    x: number
    y: number
}

const parseDelta = (text: string | null): Delta | null => {
    const m = text?.match(/Δx=(-?[\d.]+)\s+Δy=(-?[\d.]+)\s+changed=(true|false)/)
    if (!m) return null
    return { dx: Number(m[1]), dy: Number(m[2]), changed: m[3] === 'true' }
}

const parseOffset = (text: string | null): Offset | null => {
    const m = text?.match(/x=(-?\d+)\s+y=(-?\d+)/)
    if (!m) return null
    return { x: Number(m[1]), y: Number(m[2]) }
}

// Wrapper 400px wide, 1px border + 12px padding each side, inner 80px →
// horizontal travel ≈ 400 - 2 - 24 - 80 = 294px. Allow a small margin.
const TRAVEL_MIN = 285
const TRAVEL_MAX = 305

test.describe('projection/nested-ancestor', () => {
    test('preserves a static ancestor transform in the layout box (offset 0)', async ({ page }) => {
        await page.goto('/tests/projection/nested-ancestor?@isPlaywright=true')

        const innerDelta = page.getByTestId('inner-delta')
        const offset = page.getByTestId('stripped-offset')
        await innerDelta.waitFor({ state: 'visible' })
        await expect(innerDelta).toContainText('(no event yet)')

        await page.getByTestId('toggle').click()
        await expect(innerDelta).toContainText('changed=true')

        const d = parseDelta(await innerDelta.textContent())
        expect(d, 'inner delta should parse').not.toBeNull()
        if (!d) throw new Error('unparseable delta')

        // Inner travels ~the wrapper's inner width, purely horizontal.
        expect(Math.abs(d.dx)).toBeGreaterThan(TRAVEL_MIN)
        expect(Math.abs(d.dx)).toBeLessThan(TRAVEL_MAX)
        expect(Math.abs(d.dy)).toBeLessThan(2)

        // The wrapper's user transform is part of the measured layout —
        // nothing is stripped, so the offset is zero.
        await expect
            .poll(async () => parseOffset(await offset.textContent()))
            .toEqual({ x: 0, y: 0 })
    })

    test('strips a post-mount (motion) ancestor transform, keeping the user base', async ({
        page
    }) => {
        await page.goto('/tests/projection/nested-ancestor?@isPlaywright=true')

        const offset = page.getByTestId('stripped-offset')
        const innerDelta = page.getByTestId('inner-delta')

        // Apply a transform to the wrapper AFTER mount (stand-in for a
        // FLIP/drag write), then toggle so the inner re-measures.
        await page.getByTestId('motion-transform').check()
        await page.getByTestId('toggle').click()
        await expect(innerDelta).toContainText('changed=true')

        // Only the post-mount +40px-down portion is removed from the
        // inner's layout box; the user base (40, 60) stays put.
        await expect
            .poll(async () => parseOffset(await offset.textContent()))
            .toEqual({ x: 0, y: 40 })

        // Removing the post-mount transform returns the offset to zero.
        await page.getByTestId('motion-transform').uncheck()
        await page.getByTestId('toggle').click()
        await expect
            .poll(async () => parseOffset(await offset.textContent()))
            .toEqual({ x: 0, y: 0 })
    })

    test('renders the wrapper, inner, controls, and readouts', async ({ page }) => {
        await page.goto('/tests/projection/nested-ancestor?@isPlaywright=true')

        await expect(page.getByTestId('projection-nested-ancestor')).toBeVisible()
        await expect(page.getByTestId('toggle')).toBeVisible()
        await expect(page.getByTestId('motion-transform')).toBeVisible()
        await expect(page.getByTestId('inner-delta')).toBeVisible()
        await expect(page.getByTestId('stripped-offset')).toBeVisible()
    })

    test('controls are discoverable by role and keyboard-operable', async ({ page }) => {
        await page.goto('/tests/projection/nested-ancestor?@isPlaywright=true')

        // The toggle is reachable by role + accessible name and focusable.
        const toggle = page.getByRole('button', { name: /toggle position/i })
        await expect(toggle).toBeVisible()
        await toggle.focus()
        await expect(toggle).toBeFocused()

        // Keyboard activation moves the inner box and updates its readout.
        await toggle.press('Enter')
        await expect(page.getByTestId('inner-delta')).toContainText('changed=true')

        // The post-mount control is exposed as a checkbox and keyboard-togglable.
        const motionTransform = page.getByRole('checkbox', { name: /post-mount transform/i })
        await expect(motionTransform).not.toBeChecked()
        await motionTransform.focus()
        await expect(motionTransform).toBeFocused()
        await motionTransform.press('Space')
        await expect(motionTransform).toBeChecked()

        // And the stripped offset reflects the now-applied motion transform.
        await page.getByRole('button', { name: /toggle position/i }).press('Enter')
        await expect
            .poll(async () => {
                const m = (await page.getByTestId('stripped-offset').textContent())?.match(
                    /x=(-?\d+)\s+y=(-?\d+)/
                )
                return m ? { x: Number(m[1]), y: Number(m[2]) } : null
            })
            .toEqual({ x: 0, y: 40 })
    })
})
