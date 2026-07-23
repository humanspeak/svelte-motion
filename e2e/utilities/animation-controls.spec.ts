import { expect, test } from '@playwright/test'

test.describe('useAnimationControls', () => {
    const gotoReady = async (page: import('@playwright/test').Page) => {
        await page.goto('/tests/animation-controls')
        await expect(page.getByTestId('stage')).toHaveAttribute('data-hydrated', 'true')
    }

    const readCardState = async (page: import('@playwright/test').Page) =>
        page.getByTestId('card').evaluate((el) => {
            const style = getComputedStyle(el)
            const matrix =
                style.transform === 'none'
                    ? new DOMMatrixReadOnly()
                    : new DOMMatrixReadOnly(style.transform)
            return {
                text: el.textContent ?? '',
                transform: style.transform,
                x: matrix.m41
            }
        })

    test('starts coordinated subscribers and completes the sequence', async ({ page }) => {
        await gotoReady(page)

        await expect(page.getByTestId('label')).toHaveText('idle')

        await page.getByTestId('start').click()
        await expect(page.getByTestId('label')).toHaveText('complete', { timeout: 4000 })
        await expect(page.getByTestId('run-count')).toHaveText('runs: 1')

        const cardTransform = await page
            .getByTestId('card')
            .evaluate((el) => getComputedStyle(el).transform)
        expect(cardTransform === 'none' || cardTransform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true)
    })

    test('does not flash back to rest between chained controls animations', async ({ page }) => {
        await gotoReady(page)

        const framesPromise = page.evaluate(
            async () =>
                await new Promise<Array<{ x: number; label: string }>>((resolve) => {
                    const card = document.querySelector<HTMLElement>('[data-testid="card"]')
                    const frames: Array<{ x: number; label: string }> = []
                    const label = document.querySelector<HTMLElement>('[data-testid="label"]')
                    const started = performance.now()

                    const readX = () => {
                        if (!card) return 0
                        const style = getComputedStyle(card)
                        const matrix =
                            style.transform === 'none'
                                ? new DOMMatrixReadOnly()
                                : new DOMMatrixReadOnly(style.transform)
                        return matrix.m41
                    }

                    const tick = () => {
                        frames.push({
                            x: readX(),
                            label: label?.textContent ?? ''
                        })

                        if (performance.now() - started < 1200) {
                            requestAnimationFrame(tick)
                        } else {
                            resolve(frames)
                        }
                    }

                    requestAnimationFrame(tick)
                })
        )

        await page.getByTestId('start').click()
        const confirmingFrames = await framesPromise

        const xFrames = confirmingFrames.map((frame) => frame.x)
        const peak = Math.max(...xFrames)
        const peakIndex = xFrames.findIndex((x) => x === peak)
        const afterPeak = xFrames.slice(peakIndex)

        expect(peak).toBeGreaterThan(50)
        expect(Math.min(...afterPeak.slice(-10))).toBeLessThan(5)

        for (let i = 0; i < afterPeak.length - 1; i += 1) {
            if (afterPeak[i] >= 20) continue
            const laterMax = Math.max(...afterPeak.slice(i + 1))
            expect(laterMax).toBeLessThan(30)
        }
    })

    test('set jumps subscribers to their final variant state', async ({ page }) => {
        await gotoReady(page)

        await page.getByTestId('set').click()
        await expect(page.getByTestId('label')).toHaveText('complete')
        await expect(page.getByTestId('run-count')).toHaveText('runs: 1')
    })

    test('reset returns subscribers to idle after a run', async ({ page }) => {
        await gotoReady(page)

        await page.getByTestId('start').click()
        await expect(page.getByTestId('label')).toHaveText('complete', { timeout: 4000 })

        await page.getByTestId('reset').click()
        await expect(page.getByTestId('label')).toHaveText('idle')
    })

    test('initial variant remains stable before controls run', async ({ page }) => {
        await gotoReady(page)

        await page.waitForTimeout(500)

        const orb = await page.getByTestId('orb').evaluate((el) => {
            const style = getComputedStyle(el)
            const matrix =
                style.transform === 'none'
                    ? new DOMMatrixReadOnly()
                    : new DOMMatrixReadOnly(style.transform)

            return {
                opacity: Number(style.opacity),
                scaleX: matrix.a,
                scaleY: matrix.d
            }
        })

        expect(orb.opacity).toBeCloseTo(0.45, 2)
        expect(orb.scaleX).toBeCloseTo(0.9, 2)
        expect(orb.scaleY).toBeCloseTo(0.9, 2)
    })

    test('stop freezes active subscribers mid-sequence', async ({ page }) => {
        await gotoReady(page)

        await page.getByTestId('start').click()
        await expect
            .poll(async () => (await readCardState(page)).x, { timeout: 3000 })
            .toBeGreaterThan(5)

        await page.getByTestId('stop').click()
        await expect(page.getByTestId('label')).toHaveText('stopped')

        const stopped = await readCardState(page)
        await page.waitForTimeout(900)
        const later = await readCardState(page)

        expect(later.text).toContain('stopped')
        expect(Math.abs(later.x - stopped.x)).toBeLessThan(2)
    })
})

test('holds a non-neutral variant transform after the sequence settles', async ({ page }) => {
    await page.goto('/tests/animation-controls?@isPlaywright=true')
    await page.getByTestId('beam').waitFor({ state: 'visible' })
    await page.waitForTimeout(800)

    const readScaleX = () =>
        page.getByTestId('beam').evaluate((el) => {
            const t = getComputedStyle(el).transform
            const match = t.match(/matrix\(([^,]+),/)
            return match ? Number(match[1]) : 1
        })

    await page.getByTestId('start').click()
    await expect(page.getByTestId('label')).toHaveText('complete', { timeout: 4000 })

    // The success variant ends at scaleX 0.66 — it must HOLD there, not
    // snap back to identity when the settle path rewrites inline styles.
    await page.waitForTimeout(400)
    const settled = await readScaleX()
    expect(Math.abs(settled - 0.66), `settled scaleX: ${settled}`).toBeLessThan(0.02)
})

test.describe('stop() freezes the mid-flight value across a reactive flush', () => {
    const gotoBeam = async (page: import('@playwright/test').Page) => {
        await page.goto('/tests/animation-controls?@isPlaywright=true')
        await page.getByTestId('beam').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
    }

    // DOMMatrixReadOnly parses both `matrix(...)` and the `matrix3d(...)` a
    // pure-WAAPI (GPU-promoted) transform emits; `.a` is scaleX and `.m41` is
    // translateX for the non-rotated card/beam.
    const readBeamScaleX = (page: import('@playwright/test').Page) =>
        page.getByTestId('beam').evaluate((el) => {
            const t = getComputedStyle(el).transform
            return t === 'none' ? 1 : new DOMMatrixReadOnly(t).a
        })

    const readCardX = (page: import('@playwright/test').Page) =>
        page.getByTestId('card').evaluate((el) => {
            const t = getComputedStyle(el).transform
            return t === 'none' ? 0 : new DOMMatrixReadOnly(t).m41
        })

    test('holds mid-flight scaleX after a completed start, then a reactive poke', async ({
        page
    }) => {
        await gotoBeam(page)

        // Complete a start so lastAnimationControlsTarget holds a NON-neutral
        // target (success → scaleX 0.66). This is the stale value the buggy
        // settle state would snap back to.
        await page.getByTestId('start').click()
        await expect(page.getByTestId('label')).toHaveText('complete', { timeout: 4000 })

        // Interrupt a fresh slow start mid-flight (launch → scaleX 1 over 2s).
        await page.getByTestId('start-slow').click()
        await page.waitForTimeout(500)
        await page.getByTestId('stop').click()

        // commitStyles must have frozen the DOM at a mid value strictly
        // between the completed target (0.66) and the slow endpoint (1).
        const frozen = await readBeamScaleX(page)
        expect(frozen, `frozen scaleX: ${frozen}`).toBeGreaterThan(0.7)
        expect(frozen, `frozen scaleX: ${frozen}`).toBeLessThan(0.97)

        // A benign reactive style change (outline color) forces a
        // renderedInlineStyle recompute. Buggy code rewrites the transform from
        // the stale settle state → snaps back to 0.66.
        await page.getByTestId('poke').click()
        await page.waitForTimeout(100)
        const afterPoke = await readBeamScaleX(page)
        expect(
            Math.abs(afterPoke - frozen),
            `frozen: ${frozen}, afterPoke: ${afterPoke}`
        ).toBeLessThan(0.02)
    })

    test('holds mid-flight translateX when the FIRST-ever start is interrupted', async ({
        page
    }) => {
        // Uses the card (translateX): its idle x (0) equals its base, so a
        // first-ever start still drives a visible mid-flight value — unlike the
        // beam, whose non-neutral idle scaleX is a separate first-start concern.
        await gotoBeam(page)

        // No prior completed start: lastAnimationControlsTarget is empty, so
        // buggy code reverts the card to base (x 0) on the reactive flush.
        await page.getByTestId('start-slow').click()
        await page.waitForTimeout(500)
        await page.getByTestId('stop').click()

        // Frozen mid-flight, strictly between base (0) and the launch endpoint (64).
        const frozen = await readCardX(page)
        expect(frozen, `frozen x: ${frozen}`).toBeGreaterThan(5)
        expect(frozen, `frozen x: ${frozen}`).toBeLessThan(60)

        await page.getByTestId('poke').click()
        await page.waitForTimeout(100)
        const afterPoke = await readCardX(page)
        expect(
            Math.abs(afterPoke - frozen),
            `frozen: ${frozen}, afterPoke: ${afterPoke}`
        ).toBeLessThan(2)
    })

    test('idle stop (nothing in flight) leaves the resting variant untouched', async ({ page }) => {
        await gotoBeam(page)

        // Beam rests at the idle variant (scaleX 0.16). Stopping with nothing
        // running must not force a settle that rewrites it.
        const before = await readBeamScaleX(page)
        expect(before, `idle scaleX: ${before}`).toBeCloseTo(0.16, 2)

        await page.getByTestId('stop').click()
        await page.getByTestId('poke').click()
        await page.waitForTimeout(100)

        const after = await readBeamScaleX(page)
        expect(after, `idle scaleX after stop+poke: ${after}`).toBeCloseTo(0.16, 2)
    })
})

test.describe('detaching controls clears their settle state (last-writer-wins parity)', () => {
    const gotoBeam = async (page: import('@playwright/test').Page) => {
        await page.goto('/tests/animation-controls?@isPlaywright=true')
        await page.getByTestId('beam').waitFor({ state: 'visible' })
        await page.waitForTimeout(300)
    }

    const readBeamScaleX = (page: import('@playwright/test').Page) =>
        page.getByTestId('beam').evaluate((el) => {
            const t = getComputedStyle(el).transform
            return t === 'none' ? 1 : new DOMMatrixReadOnly(t).a
        })

    test('re-attaching idle controls after a declarative swap does not resurrect the stale target', async ({
        page
    }) => {
        await gotoBeam(page)

        // 1. Run the controls sequence; it settles the beam at the success
        //    variant (scaleX 0.66). This is the stale imperative target that a
        //    never-cleared settle state would later resurrect.
        await page.getByTestId('start').click()
        await expect(page.getByTestId('label')).toHaveText('complete', { timeout: 4000 })
        await expect
            .poll(async () => await readBeamScaleX(page), { timeout: 4000 })
            .toBeCloseTo(0.66, 1)

        // 2. Detach controls: swap the beam to a declarative `{ scaleX: 1 }`.
        //    A declarative animation legitimately moves the beam to scaleX 1.
        //    Let it fully SETTLE at 1 before swapping back — the bug only shows
        //    once the declarative writer has committed the new value (polling to
        //    the first ≈1 frame can catch a transient mid-animation reading).
        await page.getByTestId('toggle-beam-source').click()
        await expect
            .poll(async () => await readBeamScaleX(page), { timeout: 4000 })
            .toBeCloseTo(1, 1)
        await page.waitForTimeout(500)
        expect(await readBeamScaleX(page), 'declarative settled scaleX').toBeCloseTo(1, 1)

        // 3. Re-attach the SAME controls object with NO new command.
        await page.getByTestId('toggle-beam-source').click()
        await page.waitForTimeout(300)

        // 4. Upstream is last-writer-wins per motion value: an idle re-attached
        //    controls object resurrects nothing, so the beam holds the value the
        //    last (declarative) writer left — scaleX 1. Buggy code re-renders the
        //    stale `lastAnimationControlsTarget` and snaps back to 0.66.
        const afterReattach = await readBeamScaleX(page)
        expect(
            Math.abs(afterReattach - 1),
            `after re-attach scaleX: ${afterReattach}`
        ).toBeLessThan(0.05)
    })

    test('a completed start holds its settle value across an unrelated re-render (no over-eager clear)', async ({
        page
    }) => {
        await gotoBeam(page)

        // Controls stay attached the whole time. A completed start settles the
        // beam at the success variant (scaleX 0.66).
        await page.getByTestId('start').click()
        await expect(page.getByTestId('label')).toHaveText('complete', { timeout: 4000 })
        await expect
            .poll(async () => await readBeamScaleX(page), { timeout: 4000 })
            .toBeCloseTo(0.66, 1)

        // A benign reactive flush (poke) must NOT clear the still-attached
        // controls' settle state — clearing on every effect re-run instead of
        // only on detach would regress the hold and snap the beam off 0.66.
        await page.getByTestId('poke').click()
        await page.waitForTimeout(100)
        const afterPoke = await readBeamScaleX(page)
        expect(afterPoke, `scaleX after poke: ${afterPoke}`).toBeCloseTo(0.66, 1)
    })
})
