import { expect, test } from '@playwright/test'
import { isIdleDelta, parseProjectionDelta as parseDelta } from '../_helpers/projection'

/**
 * Projection foundation (#379) — flat sibling-swap event stream.
 *
 * Two `<motion.div layout>` boxes (80px tall, 16px gap → ~96px between
 * their row origins). Clicking "swap" reverses their order in a `$state`
 * array; the existing FLIP layout animation runs and each box's
 * `ProjectionNode` fires `onProjectionUpdate` with the delta between its
 * pre- and post-swap layout box. The page renders each box's last delta
 * into a `<pre>`, so we assert on the projection payload directly rather
 * than scraping mid-animation transforms.
 *
 * Expected: one box reports Δy ≈ +96, the other Δy ≈ -96, both with
 * `changed=true` and Δx ≈ 0. Swapping again flips the signs.
 */

const ROW_GAP_MIN = 88 // box height (80) + gap (16) leaves a comfortable lower bound
const ROW_GAP_MAX = 104

test.describe('projection/sibling-swap', () => {
    test('each box emits a didUpdate with the opposite-signed row delta', async ({ page }) => {
        await page.goto('/tests/projection/sibling-swap?@isPlaywright=true')

        const d0 = page.getByTestId('delta-0')
        const d1 = page.getByTestId('delta-1')
        await d0.waitFor({ state: 'visible' })

        // Before the first swap, layout is idle. Depending on scheduling,
        // the page might still show "no event yet" or an initial unchanged
        // zero-delta projection callback.
        await expect.poll(async () => isIdleDelta(await d0.textContent())).toBe(true)
        await expect.poll(async () => isIdleDelta(await d1.textContent())).toBe(true)

        await page.getByTestId('swap').click()

        // Both boxes must report a real layout change.
        await expect(d0).toContainText('changed=true')
        await expect(d1).toContainText('changed=true')

        const a = parseDelta(await d0.textContent())
        const b = parseDelta(await d1.textContent())
        expect(a, 'delta-0 should parse').not.toBeNull()
        expect(b, 'delta-1 should parse').not.toBeNull()
        if (!a || !b) throw new Error('unparseable delta')

        // Pure vertical swap — no horizontal travel.
        expect(Math.abs(a.dx)).toBeLessThan(2)
        expect(Math.abs(b.dx)).toBeLessThan(2)

        // Each box moves ~one row; the two move in opposite directions
        // and by (approximately) the same magnitude.
        expect(Math.abs(a.dy)).toBeGreaterThan(ROW_GAP_MIN)
        expect(Math.abs(a.dy)).toBeLessThan(ROW_GAP_MAX)
        expect(Math.abs(b.dy)).toBeGreaterThan(ROW_GAP_MIN)
        expect(Math.abs(b.dy)).toBeLessThan(ROW_GAP_MAX)
        expect(Math.abs(a.dy)).toBeCloseTo(Math.abs(b.dy), 0)
        expect(Math.sign(a.dy)).toBe(-Math.sign(b.dy))

        // Swapping back flips box A's vertical direction.
        const firstSign = Math.sign(a.dy)
        await page.getByTestId('swap').click()
        await expect
            .poll(async () => {
                const next = parseDelta(await d0.textContent())
                return next && next.changed ? Math.sign(next.dy) : 0
            })
            .toBe(-firstSign)
    })

    test('renders both boxes, the swap control, and per-box readouts', async ({ page }) => {
        await page.goto('/tests/projection/sibling-swap?@isPlaywright=true')

        await expect(page.getByTestId('projection-sibling-swap')).toBeVisible()
        await expect(page.getByTestId('swap')).toBeVisible()
        await expect(page.getByTestId('delta-0')).toBeVisible()
        await expect(page.getByTestId('delta-1')).toBeVisible()
    })

    test('swap control is discoverable by role and keyboard-operable', async ({ page }) => {
        await page.goto('/tests/projection/sibling-swap?@isPlaywright=true')

        // Discoverable through an accessible (role + name) query, not just testid.
        const swap = page.getByRole('button', { name: /swap order/i })
        await expect(swap).toBeVisible()

        // Focusable (in the tab order — native <button>, no tabindex=-1).
        await swap.focus()
        await expect(swap).toBeFocused()

        // Keyboard activation triggers the swap and updates both readouts.
        await swap.press('Enter')
        await expect(page.getByTestId('delta-0')).toContainText('changed=true')
        await expect(page.getByTestId('delta-1')).toContainText('changed=true')
    })
})
