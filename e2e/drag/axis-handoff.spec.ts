import { expect, test, type Page } from '@playwright/test'

/**
 * Axis OWNERSHIP handoffs at drag start and release — the two Codex findings on
 * PR #459, both verified as real port gaps against
 * `~/Github/motion/packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`.
 */

const URL = '/tests/drag/axis-handoff?@isPlaywright=true'

const readTranslate = (page: Page, testId: string) =>
    page.evaluate((id) => {
        const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
        if (!element) return { x: 0, y: 0, scale: 1 }
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
        return { x: matrix.m41, y: matrix.m42, scale: Math.hypot(matrix.a, matrix.b) }
    }, testId)

test.describe('drag/axis-handoff', () => {
    test('the pointer wins over a foreign x animation already in flight', async ({ page }) => {
        await page.goto(URL)
        const card = page.getByTestId('foreign-x-card')
        await card.waitFor({ state: 'visible' })

        // Start a 6s linear animation to x: 520, then grab it mid-flight.
        await page.getByTestId('start-foreign').click()
        await expect
            .poll(async () => (await readTranslate(page, 'foreign-x-card')).x)
            .toBeGreaterThan(40)

        const box = await card.boundingBox()
        if (!box) throw new Error('no bbox')
        const cy = box.y + box.height / 2
        let pointerX = box.x + box.width / 2
        await page.mouse.move(pointerX, cy)
        await page.mouse.down()

        // Drag LEFT, against the animation, in steps — sampling the gap between
        // the pointer and the card after each one. A drag that owns the axis
        // keeps that gap constant; an animation still writing x drags the card
        // away from the pointer.
        const drift: number[] = []
        const grabbed = await readTranslate(page, 'foreign-x-card')
        const grabOffset = grabbed.x - pointerX
        try {
            for (let step = 0; step < 6; step++) {
                pointerX -= 25
                await page.mouse.move(pointerX, cy)
                await page.waitForTimeout(90)
                const live = await readTranslate(page, 'foreign-x-card')
                drift.push(live.x - pointerX - grabOffset)
            }
        } finally {
            await page.mouse.up()
        }

        const worst = Math.max(...drift.map((value) => Math.abs(value)))
        expect(
            worst,
            `card drifted ${worst.toFixed(1)}px from the pointer — samples: ${drift
                .map((value) => value.toFixed(1))
                .join(', ')}`
        ).toBeLessThan(12)
    })

    test('whileDrag on the dragged axis does not cancel the release glide', async ({ page }) => {
        await page.goto(URL)
        const card = page.getByTestId('whiledrag-axis-card')
        await card.waitFor({ state: 'visible' })

        const box = await card.boundingBox()
        if (!box) throw new Error('no bbox')
        const cx = box.x + box.width / 2
        const cy = box.y + box.height / 2

        // Fling downward: `whileDrag` lifts `y` by -14 while held, so the
        // release pits the whileDrag restore against the y momentum.
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let step = 1; step <= 6; step++) {
            await page.mouse.move(cx, cy + step * 18)
        }
        await page.mouse.up()

        const samples: Array<{ x: number; y: number; scale: number }> = []
        for (let frame = 0; frame < 14; frame++) {
            samples.push(await readTranslate(page, 'whiledrag-axis-card'))
            await page.waitForTimeout(45)
        }

        // (i) momentum owns `y` after release: travel keeps INCREASING across the
        // first samples and the card settles down-range at its bottom constraint.
        // Today the whileDrag restore's `value.start()` cancels the y inertia and
        // y collapses home instead (measured: -12, 84, 44, 17, 3, -1, -2, …).
        const trace = samples.map((sample) => sample.y.toFixed(0)).join(', ')
        expect(samples[1].y, `y did not glide onward — trace: ${trace}`).toBeGreaterThan(
            samples[0].y
        )
        expect(samples[2].y, `y did not glide onward — trace: ${trace}`).toBeGreaterThan(
            samples[1].y
        )
        const settledY = samples[samples.length - 1].y
        expect(settledY, `y settled at ${settledY.toFixed(1)}px — trace: ${trace}`).toBeGreaterThan(
            60
        )

        // (ii) the non-axis whileDrag key still restores.
        await expect
            .poll(async () => (await readTranslate(page, 'whiledrag-axis-card')).scale, {
                timeout: 3000
            })
            .toBeCloseTo(1, 1)

        // (iii) the release reports completion exactly once.
        await expect
            .poll(async () => card.getAttribute('data-transition-ends'), { timeout: 4000 })
            .toBe('1')
        await page.waitForTimeout(600)
        expect(await card.getAttribute('data-transition-ends')).toBe('1')
    })

    test('a foreign retarget mid-glide takes over cleanly and the dead release cleans up', async ({
        page
    }) => {
        await page.goto(URL)
        const card = page.getByTestId('foreign-retarget-card')
        await card.waitFor({ state: 'visible' })
        await card.scrollIntoViewIfNeeded()

        const box = await card.boundingBox()
        if (!box) throw new Error('no bbox')
        const cy = box.y + box.height / 2
        const cx = box.x + box.width / 2

        // Fling right, then retarget x while the glide is still running.
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        for (let step = 1; step <= 6; step++) {
            await page.mouse.move(cx + step * 26, cy)
        }
        await page.mouse.up()
        await page.waitForTimeout(120)
        const gliding = await readTranslate(page, 'foreign-retarget-card')
        await page.getByTestId('retarget').click()

        // The release's cleanup only ran from natural completion or our own
        // `stopInertia`, so a foreign takeover left `stopInertia` armed and
        // pointing at the dead release. Cancelling the (already finished) drag
        // then runs that stale closure — `value.stop()` on an axis the gesture no
        // longer owns — freezing whoever took it over. THIS is the observable
        // "cleanup did not run".
        await page.waitForTimeout(150)
        const beforeCancel = await readTranslate(page, 'foreign-retarget-card')
        await page.getByTestId('cancel-inertia').click()

        // The retarget wins: x arrives at 420 and stays there.
        await expect
            .poll(async () => (await readTranslate(page, 'foreign-retarget-card')).x, {
                timeout: 3000
            })
            .toBeCloseTo(420, -1)
        expect(gliding.x).toBeLessThan(420)
        const settled = await readTranslate(page, 'foreign-retarget-card')
        expect(
            settled.x,
            `x froze at ${settled.x.toFixed(1)}px (was ${beforeCancel.x.toFixed(1)}px when the finished drag was cancelled) instead of reaching its 420px target`
        ).toBeGreaterThan(beforeCancel.x + 5)

        // `onDragTransitionEnd` must NOT fire for an interrupted release. Upstream
        // resolves it from `Promise.all(momentumAnimations).then(onDragTransitionEnd)`
        // (`VisualElementDragControls.ts:511`) and a stopped animation never
        // settles that promise — motion-dom's `JSAnimation.stop()` calls `onStop`,
        // not `onComplete` (`animation/JSAnimation.mjs:44-54`), and
        // `MotionValue.start()` only resolves from `onComplete`
        // (`value/index.mjs:260-274`). So upstream SKIPS it, and so do we.
        expect(await card.getAttribute('data-transition-ends')).toBe('0')

        // The interrupted release must not leave the gesture holding the axis:
        // a subsequent drag starts from where the card actually is and moves
        // with the pointer, one-to-one.
        const afterBox = await card.boundingBox()
        if (!afterBox) throw new Error('no bbox after retarget')
        const beforeSecondDrag = await readTranslate(page, 'foreign-retarget-card')
        await page.mouse.move(afterBox.x + afterBox.width / 2, afterBox.y + afterBox.height / 2)
        await page.mouse.down()
        await page.mouse.move(
            afterBox.x + afterBox.width / 2 - 60,
            afterBox.y + afterBox.height / 2,
            { steps: 6 }
        )
        const dragged = await readTranslate(page, 'foreign-retarget-card')
        await page.mouse.up()

        const moved = dragged.x - beforeSecondDrag.x
        expect(
            moved,
            `second drag moved ${moved.toFixed(1)}px for a 60px pointer move (origin corrupted if this is off)`
        ).toBeGreaterThan(-70)
        expect(moved).toBeLessThan(-50)
    })
})
