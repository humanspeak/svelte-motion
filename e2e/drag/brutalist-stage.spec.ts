import { expect, test } from '@playwright/test'

/**
 * Regression for the FIG-002 'card escapes the dragConstraints box' bug
 * reproduced in `src/routes/tests/drag/brutalist-stage`. With
 * `dragConstraints { left: -200, right: 200, top: -120, bottom: 120 }`,
 * `dragElastic: 0.18`, `dragMomentum: true`, and
 * `dragTransition { bounceStiffness: 360, bounceDamping: 24 }`, dragging
 * hard past a constraint and releasing should settle the card translate
 * back inside the constraint bounds. CSS rotate is disabled in these
 * tests so the assertion targets the raw translate (rotation expands
 * the AABB but doesn't change where the constraint clamps).
 */

const STAGE_PATH = '/tests/drag/brutalist-stage?@isPlaywright=true'
const LEFT = -200
const RIGHT = 200
const TOP = -120
const BOTTOM = 120

const readTranslate = async (page: import('@playwright/test').Page) => {
    return page.evaluate(() => {
        const el = document.querySelector('[data-testid="drag-card"]') as HTMLElement | null
        if (!el) return null
        const t = window.getComputedStyle(el).transform
        // matrix(a, b, c, d, tx, ty)
        const m = t.match(/matrix\(([^)]+)\)/)
        if (!m) return { tx: 0, ty: 0 }
        const parts = m[1].split(',').map((s) => Number.parseFloat(s.trim()))
        return { tx: parts[4] ?? 0, ty: parts[5] ?? 0 }
    })
}

const disableRotate = async (page: import('@playwright/test').Page) => {
    const rotateToggle = page.locator('.knobs input[type="checkbox"]').first()
    if (await rotateToggle.isChecked()) await rotateToggle.click()
}

test.describe('drag/brutalist-stage', () => {
    test('settles within constraint bounds after hard left + down drag', async ({ page }) => {
        await page.goto(STAGE_PATH)
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })
        await disableRotate(page)

        const start = await card.boundingBox()
        if (!start) throw new Error('no card bbox')
        const cx = start.x + start.width / 2
        const cy = start.y + start.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        // Drag well past the (-200, +120) corner with velocity
        for (let i = 1; i <= 20; i++) {
            await page.mouse.move(cx - i * 40, cy + i * 8, { steps: 1 })
        }
        await page.mouse.up()

        // Let the dragTransition spring fully settle. The probe in
        // src/routes/tests/drag/brutalist-stage showed settling by ~700ms;
        // give it 1500ms for CI headroom.
        await page.waitForTimeout(1500)

        const after = await readTranslate(page)
        if (!after) throw new Error('no transform')
        // Allow 1px tolerance — spring may settle at -199.999.
        expect(after.tx).toBeGreaterThanOrEqual(LEFT - 1)
        expect(after.tx).toBeLessThanOrEqual(RIGHT + 1)
        expect(after.ty).toBeGreaterThanOrEqual(TOP - 1)
        expect(after.ty).toBeLessThanOrEqual(BOTTOM + 1)
    })

    test('settles within constraint bounds after hard right + up drag', async ({ page }) => {
        await page.goto(STAGE_PATH)
        const card = page.getByTestId('drag-card')
        await card.waitFor({ state: 'visible' })
        await disableRotate(page)

        const start = await card.boundingBox()
        if (!start) throw new Error('no card bbox')
        const cx = start.x + start.width / 2
        const cy = start.y + start.height / 2

        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let i = 1; i <= 20; i++) {
            await page.mouse.move(cx + i * 40, cy - i * 8, { steps: 1 })
        }
        await page.mouse.up()

        await page.waitForTimeout(1500)

        const after = await readTranslate(page)
        if (!after) throw new Error('no transform')
        expect(after.tx).toBeGreaterThanOrEqual(LEFT - 1)
        expect(after.tx).toBeLessThanOrEqual(RIGHT + 1)
        expect(after.ty).toBeGreaterThanOrEqual(TOP - 1)
        expect(after.ty).toBeLessThanOrEqual(BOTTOM + 1)
    })

    // [KNOWN BUG — motion-dom]
    // With dragMomentum: true (svelte-motion's default), a card that is
    // already past a constraint at release with non-zero velocity continues
    // moving further past the constraint for ~50–120ms before the bounce
    // spring catches it. Probe at release: tx ≈ -308 (elastic-clamped);
    // peak post-release: tx ≈ -325 (17px further past the constraint).
    // The card does eventually settle to tx = -200 by ~700ms (covered by
    // the two tests above), but the brief outward overshoot is the
    // "card visibly outside the box just after I let go" behaviour.
    //
    // Marked test.fail() so CI stays green while the bug is captured.
    // When motion-dom fixes the post-release direction-of-motion, this
    // test will unexpectedly pass and flag the .fail() for removal.
    test.fail(
        'post-release motion never moves further from origin than release position',
        async ({ page }) => {
            // This test catches the momentum-overshoot behavior: when the
            // card is past a constraint at release with non-zero velocity,
            // it should NOT travel further past the constraint before the
            // bounce spring catches it. The expected motion post-release is
            // monotonically toward the origin.
            await page.goto(STAGE_PATH)
            const card = page.getByTestId('drag-card')
            await card.waitFor({ state: 'visible' })
            await disableRotate(page)

            const start = await card.boundingBox()
            if (!start) throw new Error('no card bbox')
            const cx = start.x + start.width / 2
            const cy = start.y + start.height / 2

            await page.mouse.move(cx, cy)
            await page.mouse.down()
            for (let i = 1; i <= 20; i++) {
                await page.mouse.move(cx - i * 40, cy, { steps: 1 })
            }

            // Sample translateX exactly at release, then again at +50ms.
            // releaseTx is the elastic-clamped overdrag position.
            const releaseT = await readTranslate(page)
            if (!releaseT) throw new Error('no release transform')
            await page.mouse.up()

            const samples: number[] = []
            for (const wait of [16, 32, 50, 80, 120]) {
                await page.waitForTimeout(wait)
                const t = await readTranslate(page)
                if (t) samples.push(t.tx)
            }

            // The card is past the left constraint, so translateX is negative.
            // After release, |translateX| should never EXCEED |releaseTx| at any
            // sample point — momentum should not carry the card further past
            // the constraint before the bounce spring engages.
            const releaseAbs = Math.abs(releaseT.tx)
            const maxAbsAfter = Math.max(...samples.map((tx) => Math.abs(tx)))
            // Tolerance of 2px for sub-frame jitter / sub-pixel rounding.
            expect(maxAbsAfter).toBeLessThanOrEqual(releaseAbs + 2)
        }
    )
})
