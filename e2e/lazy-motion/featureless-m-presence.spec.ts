import { expect, test, type Page } from '@playwright/test'

// Plan 016 (Motion parity). Upstream (Motion 14.7.1) a child registers with
// its `PresenceChild` from the exit feature (`motion/features/animation/exit.ts:73-83`),
// which needs a VisualElement. A featureless `m` never registers, so when it is
// removed `PresenceChild` completes at once (`PresenceChild.tsx:104-113`): it
// leaves on the next frame, with no clone, and holds no `mode="wait"` sibling.
//
// Every probe reads the DOM on each painted frame (an in-page
// `requestAnimationFrame` loop) and the spec asserts on every record.

type PresenceFrame = {
    /** Elements with the leaver's `data-testid` (live or clone). */
    leaver: number
    /** Painted clones of the control (opacity above 0). */
    controlClone: number
}

/** Clicks `toggle-exit`, then records the exit card on each of the next `frames` frames. */
const exitFrames = (page: Page, frames: number) =>
    page.evaluate(
        (frames) =>
            new Promise<PresenceFrame[]>((resolve) => {
                const out: PresenceFrame[] = []
                const step = () => {
                    const clones = Array.from(
                        document.querySelectorAll<HTMLElement>(
                            '[data-testid="exit-control"][data-clone="true"]'
                        )
                    )
                    out.push({
                        leaver: document.querySelectorAll('[data-testid="exit-bare"]').length,
                        controlClone: clones.filter((el) => {
                            const style = getComputedStyle(el)
                            return style.visibility !== 'hidden' && Number(style.opacity) > 0
                        }).length
                    })
                    if (out.length >= frames) resolve(out)
                    else requestAnimationFrame(step)
                }
                document.querySelector<HTMLElement>('[data-testid="toggle-exit"]')!.click()
                requestAnimationFrame(step)
            }),
        frames
    )

type WaitFrame = { old: number; present: boolean; display: string; opacity: number }

/**
 * Clicks `swap-enter`, then records `wait-old` / `wait-new` on every frame,
 * until 90 frames after `wait-old` is gone (or 2 s pass without that).
 */
const waitEnterFrames = (page: Page) =>
    page.evaluate(
        () =>
            new Promise<WaitFrame[]>((resolve) => {
                const out: WaitFrame[] = []
                let after = -1
                const start = performance.now()
                const step = () => {
                    const old = document.querySelectorAll('[data-testid="wait-old"]').length
                    const next = document.querySelector<HTMLElement>('[data-testid="wait-new"]')
                    const style = next ? getComputedStyle(next) : null
                    out.push({
                        old,
                        present: !!next,
                        display: style?.display ?? '',
                        opacity: style ? Number(style.opacity) : -1
                    })
                    if (after < 0 && old === 0) after = 0
                    if (after >= 0) after++
                    if (after > 90 || (after < 0 && performance.now() - start > 2000)) resolve(out)
                    else requestAnimationFrame(step)
                }
                document.querySelector<HTMLElement>('[data-testid="swap-enter"]')!.click()
                requestAnimationFrame(step)
            })
    )

const show = (frames: unknown[]) => JSON.stringify(frames)

type OwnedFrame = {
    /** Elements with the bare owned leaver's `data-testid`. */
    bare: number
    /** Whether the owned control is painted (in the DOM, visible, opacity above 0). */
    control: boolean
}

/** Clicks `toggle-owned`, then records the owned-exit card on each of the next `frames` frames. */
const ownedFrames = (page: Page, frames: number) =>
    page.evaluate(
        (frames) =>
            new Promise<OwnedFrame[]>((resolve) => {
                const out: OwnedFrame[] = []
                const step = () => {
                    const control = document.querySelector<HTMLElement>(
                        '[data-testid="owned-control"]'
                    )
                    const style = control ? getComputedStyle(control) : null
                    out.push({
                        bare: document.querySelectorAll('[data-testid="owned-bare"]').length,
                        control:
                            !!style && style.visibility !== 'hidden' && Number(style.opacity) > 0
                    })
                    if (out.length >= frames) resolve(out)
                    else requestAnimationFrame(step)
                }
                document.querySelector<HTMLElement>('[data-testid="toggle-owned"]')!.click()
                requestAnimationFrame(step)
            }),
        frames
    )

test.describe('LazyMotion: featureless m in AnimatePresence', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/lazy-motion/featureless-m-presence?@isPlaywright=true')
        await page.waitForFunction(() => window.MotionIsMounted === true)
        // Let the control boxes finish entering.
        await page.waitForTimeout(800)
    })

    test('a featureless m with exit leaves at once', async ({ page }) => {
        const frames = await exitFrames(page, 30)
        expect(
            frames.every((frame) => frame.leaver === 0),
            show(frames)
        ).toBe(true)
    })

    test('the control m exits with a clone', async ({ page }) => {
        const frames = await exitFrames(page, 30)
        expect(
            frames.filter((frame) => frame.controlClone > 0).length,
            show(frames)
        ).toBeGreaterThanOrEqual(3)
    })

    test('wait mode reveals a featureless entrant', async ({ page }) => {
        const frames = await waitEnterFrames(page)
        const gone = frames.findIndex((frame) => frame.old === 0)
        expect(gone, show(frames)).toBeGreaterThanOrEqual(0)
        const after = frames.slice(gone)
        expect(after.length, show(frames)).toBeGreaterThan(30)
        expect(
            after.every((frame) => frame.present && frame.display !== 'none'),
            show(after)
        ).toBe(true)
    })

    test('a featureless entrant stays at initial', async ({ page }) => {
        const frames = await waitEnterFrames(page)
        const revealed = frames.findIndex(
            (frame) => frame.old === 0 && frame.present && frame.display !== 'none'
        )
        expect(revealed, show(frames)).toBeGreaterThanOrEqual(0)
        const after = frames.slice(revealed, revealed + 60)
        expect(after.length, show(frames)).toBeGreaterThanOrEqual(60)
        expect(
            after.every((frame) => Math.abs(frame.opacity - 0.4) < 0.01),
            show(after)
        ).toBe(true)
    })

    test("a featureless leaver doesn't hold the next child", async ({ page }) => {
        const frames = await page.evaluate(
            () =>
                new Promise<{ old: number; present: boolean; display: string }[]>((resolve) => {
                    const out: { old: number; present: boolean; display: string }[] = []
                    const step = () => {
                        const next = document.querySelector<HTMLElement>(
                            '[data-testid="leave-new"]'
                        )
                        out.push({
                            old: document.querySelectorAll('[data-testid="leave-old"]').length,
                            present: !!next,
                            display: next ? getComputedStyle(next).display : ''
                        })
                        if (out.length >= 10) resolve(out)
                        else requestAnimationFrame(step)
                    }
                    document.querySelector<HTMLElement>('[data-testid="swap-leave"]')!.click()
                    requestAnimationFrame(step)
                })
        )
        const [first] = frames
        expect(first.old, show(frames)).toBe(0)
        expect(first.present, show(frames)).toBe(true)
        expect(first.display, show(frames)).not.toBe('none')
    })

    // Plan 017. The owned form (`present` + `child`): nothing registers for
    // the bare `m`, so its PresenceChild completes at once
    // (`PresenceChild.tsx:104-113`).
    test('an owned featureless m leaves at once', async ({ page }) => {
        const frames = await ownedFrames(page, 30)
        expect(
            frames.every((frame) => frame.bare === 0),
            show(frames)
        ).toBe(true)
        expect(frames.filter((frame) => frame.control).length, show(frames)).toBeGreaterThanOrEqual(
            3
        )
        await expect(page.getByTestId('owned-bare-completions')).toHaveText('1')
    })
})
