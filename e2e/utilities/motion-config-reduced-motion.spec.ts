import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * `<MotionConfig reducedMotion>` follows Motion: under a reducing policy
 * positional values (transforms, width, height, top/left/…) jump straight to
 * their target while opacity and other values keep animating.
 * Upstream: motion-dom `visual-element-target.ts:150-164` @ v14.14.0.
 */

const ROUTE = '/tests/motion-config-reduced-motion'

type Sample = { id: string; sid: number; tx: number; opacity: number }

const readBoxTransform = (locator: Locator) =>
    locator.evaluate((el) => getComputedStyle(el as HTMLElement).transform)

const waitForAnimationsToFinish = (page: Page) =>
    page.waitForFunction(() => {
        const el = document.querySelector<HTMLElement>('[data-testid="motion-box"]')
        if (!el) return false
        const anims = el.getAnimations()
        if (anims.length > 0 && anims.some((a) => a.playState === 'running')) return false
        return parseFloat(getComputedStyle(el).opacity) > 0.99
    })

/**
 * Every sample recorded for `id`, restricted to the element mounted most
 * recently (a `{#key policy}` remount gets a new `sid`).
 */
const currentSamples = async (page: Page, id: string): Promise<Sample[]> => {
    const all = await allSamples(page, id)
    const sid = Math.max(...all.map((s) => s.sid))
    return all.filter((s) => s.sid === sid)
}

/** Every sample recorded for `id`, from any element that carried it. */
const allSamples = (page: Page, id: string): Promise<Sample[]> =>
    page.evaluate(
        (testId) =>
            ((window as unknown as { __samples: Sample[] }).__samples ?? []).filter(
                (s) => s.id === testId
            ),
        id
    )

const clearSamples = (page: Page) =>
    page.evaluate(() => {
        ;(window as unknown as { __samples: unknown[] }).__samples = []
    })

const isMidFade = (s: Sample) => s.opacity > 0.05 && s.opacity < 0.95

/** Instant transforms: the box is at 200 while still fading, never in between. */
const expectInstantEnter = async (page: Page) => {
    const box = page.getByTestId('motion-box')
    await expect(box).toBeAttached()
    await waitForAnimationsToFinish(page)
    expect(await readBoxTransform(box)).toMatch(/matrix\(1,\s*0,\s*0,\s*1,\s*200/)

    const samples = await currentSamples(page, 'motion-box')
    expect(samples.some((s) => Math.abs(s.tx - 200) < 0.5 && isMidFade(s))).toBe(true)
    expect(samples.filter((s) => s.tx > -190 && s.tx < 190)).toEqual([])
}

/** Tweened transforms: the box reaches 200 through intermediate positions. */
const expectTweenedEnter = async (page: Page) => {
    const box = page.getByTestId('motion-box')
    await expect(box).toBeAttached()
    await waitForAnimationsToFinish(page)
    expect(await readBoxTransform(box)).toMatch(/matrix\(1,\s*0,\s*0,\s*1,\s*200/)

    const samples = await currentSamples(page, 'motion-box')
    expect(samples.some((s) => s.tx > -190 && s.tx < 190)).toBe(true)
}

/** Hide the exit box and return every exit-box sample taken after the click. */
const runExit = async (page: Page): Promise<Sample[]> => {
    await waitForAnimationsToFinish(page)
    await clearSamples(page)
    await page.getByTestId('toggle-exit').click()
    await expect
        .poll(() => page.locator('[data-testid="exit-box"]').count(), { timeout: 10_000 })
        .toBe(0)
    return allSamples(page, 'exit-box')
}

test.describe('MotionConfig.reducedMotion', () => {
    test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        await page.addInitScript(() => {
            const w = window as unknown as { __samples: unknown[] }
            w.__samples = []
            let counter = 0
            const tick = () => {
                const els = document.querySelectorAll<HTMLElement>(
                    '[data-testid="motion-box"], [data-testid="exit-box"]'
                )
                for (const el of els) {
                    const tagged = el as HTMLElement & { __sid?: number }
                    tagged.__sid ??= ++counter
                    const style = getComputedStyle(el)
                    const transform = style.transform
                    w.__samples.push({
                        id: el.dataset.testid,
                        sid: tagged.__sid,
                        tx: transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41,
                        opacity: Number(style.opacity)
                    })
                }
                requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
        })
    })

    test("policy='always' applies transforms instantly while opacity still fades", async ({
        page
    }) => {
        await page.goto(ROUTE)
        await page.getByTestId('policy-always').check()
        await expectInstantEnter(page)
    })

    test("policy='never' lets transforms animate", async ({ page }) => {
        await page.goto(ROUTE)
        await page.getByTestId('policy-never').check()
        await expectTweenedEnter(page)
    })

    test("policy='user' with OS reduce applies transforms instantly", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto(ROUTE)
        await page.getByTestId('policy-user').check()
        await expectInstantEnter(page)
    })

    test("policy='user' with no OS preference tweens transforms", async ({ page }) => {
        await page.goto(ROUTE)
        await page.getByTestId('policy-user').check()
        await expectTweenedEnter(page)
    })

    test("policy='always' exit jumps transforms and fades opacity", async ({ page }) => {
        await page.goto(ROUTE)
        await page.getByTestId('policy-always').check()
        const samples = await runExit(page)
        expect(samples.some((s) => Math.abs(s.tx - 200) < 0.5 && isMidFade(s))).toBe(true)
        expect(samples.filter((s) => s.tx > 10 && s.tx < 190)).toEqual([])
    })

    test("policy='never' exit tweens transforms", async ({ page }) => {
        await page.goto(ROUTE)
        await page.getByTestId('policy-never').check()
        const samples = await runExit(page)
        expect(samples.some((s) => s.tx > 10 && s.tx < 190)).toBe(true)
    })
})
