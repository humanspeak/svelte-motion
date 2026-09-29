import { expect, test, type Page } from '@playwright/test'

const URL = '/tests/animate-presence/clone-parent-styles?@isPlaywright=true'

type Look = {
    backgroundColor: string
    borderTopLeftRadius: string
    color: string
    fontWeight: string
}

/** Properties only the `.cards > .card` trap rule would set (never the live card). */
type Trap = {
    boxShadow: string
    letterSpacing: string
}

type Sample = {
    look: Look
    trap: Trap
    opacity: number
    /** Whether the topmost hit at the clone's center is the clone (or inside it). */
    hitsClone: boolean
}

type ExitRecord = {
    live: Look
    liveTrap: Trap
    samples: Sample[]
}

/**
 * Remove a card and sample its exit clone on every animation frame until the
 * clone is gone. The live card's look is read immediately before the click.
 */
const recordExit = async (page: Page, cardTestId: string, triggerTestId: string) =>
    page.evaluate(
        ({ cardTestId, triggerTestId }) =>
            new Promise<ExitRecord>((resolve, reject) => {
                const readLook = (element: Element): Look => {
                    const style = getComputedStyle(element)
                    return {
                        backgroundColor: style.backgroundColor,
                        borderTopLeftRadius: style.borderTopLeftRadius,
                        color: style.color,
                        fontWeight: style.fontWeight
                    }
                }
                const readTrap = (element: Element): Trap => {
                    const style = getComputedStyle(element)
                    return { boxShadow: style.boxShadow, letterSpacing: style.letterSpacing }
                }

                const card = document.querySelector(
                    `[data-testid="${cardTestId}"]:not([data-clone])`
                )
                const trigger = document.querySelector<HTMLElement>(
                    `[data-testid="${triggerTestId}"]`
                )
                if (!card || !trigger) {
                    reject(new Error('card or trigger missing'))
                    return
                }

                const live = readLook(card)
                const liveTrap = readTrap(card)
                const samples: Sample[] = []
                let seenClone = false
                const started = performance.now()

                const tick = () => {
                    const clone = document.querySelector<HTMLElement>(
                        `[data-clone="true"][data-testid="${cardTestId}"]`
                    )
                    if (clone) {
                        seenClone = true
                        const rect = clone.getBoundingClientRect()
                        // The clone is inert + pointer-events: none, which hit
                        // testing skips. Lift both for the probe only, so
                        // elementFromPoint reports what is painted on top.
                        const { pointerEvents } = clone.style
                        const wasInert = clone.inert
                        clone.style.pointerEvents = 'auto'
                        clone.inert = false
                        const hit = document.elementFromPoint(
                            rect.left + rect.width / 2,
                            rect.top + rect.height / 2
                        )
                        clone.style.pointerEvents = pointerEvents
                        clone.inert = wasInert
                        samples.push({
                            look: readLook(clone),
                            trap: readTrap(clone),
                            opacity: Number(getComputedStyle(clone).opacity),
                            hitsClone: !!hit && clone.contains(hit)
                        })
                    } else if (seenClone) {
                        resolve({ live, liveTrap, samples })
                        return
                    }
                    if (performance.now() - started > 5000) {
                        reject(new Error(`exit clone for ${cardTestId} never finished`))
                        return
                    }
                    requestAnimationFrame(tick)
                }

                trigger.click()
                requestAnimationFrame(tick)
            }),
        { cardTestId, triggerTestId }
    )

const expectCloneKeepsLook = (record: ExitRecord) => {
    expect(record.samples.length).toBeGreaterThan(10)

    record.samples.forEach((sample, frame) => {
        expect(sample.look, `clone look on frame ${frame}`).toEqual(record.live)
        if (sample.opacity > 0.1) {
            expect(sample.hitsClone, `clone painted on top on frame ${frame}`).toBe(true)
        }
    })
}

/**
 * `.cards > .card` never matches a live card (AnimatePresence's
 * `display: contents` container sits in between), so the clone must not
 * pick it up either.
 */
const expectCloneAvoidsTrap = (record: ExitRecord) => {
    expect(record.liveTrap).toEqual({ boxShadow: 'none', letterSpacing: 'normal' })
    record.samples.forEach((sample, frame) => {
        expect(sample.trap, `clone .cards > .card styling on frame ${frame}`).toEqual(
            record.liveTrap
        )
    })
}

const waitForCardsEntered = (page: Page) =>
    page.waitForFunction(() => {
        const cards = document.querySelectorAll('[data-card]:not([data-clone])')
        return (
            cards.length > 0 &&
            Array.from(cards).every((card) => Number(getComputedStyle(card).opacity) === 1)
        )
    })

type ReentryFrame = {
    /** Solo-card nodes (live or clone) painted with opacity > 0.05. */
    visible: number
    /** Opacity of the topmost visible solo-card node (0 when none). */
    opacity: number
}

/**
 * Hide the solo card, show it again `showAfterMs` later, and sample every
 * animation frame until the card is settled again.
 */
const recordReentry = async (page: Page, showAfterMs: number) =>
    page.evaluate(
        (showAfterMs) =>
            new Promise<ReentryFrame[]>((resolve) => {
                const toggle = document.querySelector<HTMLElement>('[data-testid="toggle-solo"]')!
                const frames: ReentryFrame[] = []
                const started = performance.now()
                let shown = false
                const tick = () => {
                    const nodes = Array.from(
                        document.querySelectorAll<HTMLElement>('[data-testid="card-solo"]')
                    )
                    const opacities = nodes
                        .map((node) => Number(getComputedStyle(node).opacity))
                        .filter((opacity) => opacity > 0.05)
                    frames.push({
                        visible: opacities.length,
                        opacity: opacities.length ? Math.max(...opacities) : 0
                    })
                    const elapsed = performance.now() - started
                    if (!shown && elapsed >= showAfterMs) {
                        shown = true
                        toggle.click()
                    }
                    if (elapsed > showAfterMs + 2200) {
                        resolve(frames)
                        return
                    }
                    requestAnimationFrame(tick)
                }
                toggle.click()
                requestAnimationFrame(tick)
            }),
        showAfterMs
    )

test.describe('AnimatePresence exit clone keeps parent-dependent styles', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(URL)
        await expect(page.getByTestId('card-a')).toBeVisible()
        await expect(page.getByTestId('card-solo')).toBeVisible()
        // The cards fade in (initial opacity 0 → 1); start from settled cards.
        await waitForCardsEntered(page)
    })

    test('keyed {#each} Card A keeps its :first-child featured look', async ({ page }) => {
        const record = await recordExit(page, 'card-a', 'remove-a')
        expect(record.live.backgroundColor).toBe('rgb(43, 89, 195)')
        expect(record.live.borderTopLeftRadius).toBe('24px')
        expectCloneKeepsLook(record)
        expectCloneAvoidsTrap(record)
    })

    test('keyed {#each} Card B keeps its descendant-selector look', async ({ page }) => {
        const record = await recordExit(page, 'card-b', 'remove-b')
        expect(record.live.backgroundColor).toBe('rgb(255, 99, 71)')
        expect(record.live.borderTopLeftRadius).toBe('12px')
        expectCloneKeepsLook(record)
    })

    test('{#if} solo card keeps its :first-child look', async ({ page }) => {
        const record = await recordExit(page, 'card-solo', 'toggle-solo')
        expect(record.live.backgroundColor).toBe('rgb(255, 99, 71)')
        expect(record.live.fontWeight).toBe('600')
        expectCloneKeepsLook(record)
    })

    test('Card B exits with the look it had at removal, after Card A left', async ({ page }) => {
        // Card A's exit finishes; Card B becomes :first-child and turns blue.
        await recordExit(page, 'card-a', 'remove-a')
        await page.waitForTimeout(500)

        const record = await recordExit(page, 'card-b', 'remove-b')
        expect(record.live.backgroundColor).toBe('rgb(43, 89, 195)')
        expect(record.live.borderTopLeftRadius).toBe('24px')
        expectCloneKeepsLook(record)
    })

    test('{#if} solo card re-shown mid-exit fades back in from where it was', async ({ page }) => {
        const frames = await recordReentry(page, 500)
        const opacities = frames.map((frame) => frame.opacity)

        // The exit really was underway, and the card really came back.
        expect(Math.min(...opacities)).toBeLessThan(0.9)
        expect(opacities[opacities.length - 1]).toBe(1)

        frames.forEach((frame, index) => {
            expect(frame.visible, `visible solo cards on frame ${index}`).toBeLessThanOrEqual(1)
            if (index > 0) {
                const jump = Math.abs(frame.opacity - frames[index - 1].opacity)
                expect(jump, `opacity jump into frame ${index}`).toBeLessThanOrEqual(0.15)
            }
        })
    })
})
