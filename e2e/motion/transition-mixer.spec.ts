import { expect, test } from '@playwright/test'

/**
 * Port of upstream motion's
 * `tests/animate/animate.spec.ts` › "transition.mixer mixes values the default
 * mixer can't" @ v14.9.1, against our port of
 * `dev/html/public/playwright/animate/animate-mixer.html`
 * (`transition.mixer`, Motion 14.8).
 *
 * Also covers Motion 14.9.1 writing path data to the `d` attribute rather than
 * `style.d` (upstream 0757359b3) and removing it when unset (upstream
 * f84dcecf6).
 */

const URL = '/tests/motion/transition-mixer?@isPlaywright=true'

test.use({ viewport: { width: 500, height: 900 } })

test('transition.mixer mixes values the default mixer cannot', async ({ page }) => {
    await page.goto(URL)
    await page.waitForTimeout(1000)

    for (const id of ['single', 'sequence']) {
        const path = page.locator(`#${id}`)
        const { d, styleD } = await path.evaluate((element) => ({
            d: element.getAttribute('d'),
            styleD: (element as SVGPathElement).style.getPropertyValue('d')
        }))

        // The square's last corner travels from (90, 90) to (10, 90)
        const points = d!.split(/[ML Z]+/).filter(Boolean)
        expect(points).toHaveLength(8)
        const x = parseFloat(points[6])
        expect(x).toBeLessThan(90)
        expect(x).toBeGreaterThan(10)
        expect(styleD).toBe('')
    }

    // A mixer can't run on WAAPI, so filter animates on the main thread
    const filter = await page.locator('#filter').evaluate((element) => ({
        animations: element.getAnimations().length,
        filter: getComputedStyle(element).filter
    }))
    expect(filter.animations).toBe(0)
    expect(filter.filter).toBe('blur(5px)')

    // Numbers blend as usual, so opacity runs without the mixer
    const opacity = await page
        .locator('#opacity')
        .evaluate((element) => parseFloat(getComputedStyle(element).opacity))
    expect(opacity).toBeGreaterThan(0)
    expect(opacity).toBeLessThan(1)
    expect(
        await page.evaluate(() => (window as unknown as { opacityMixed: boolean }).opacityMixed)
    ).toBe(false)

    // A mixer that declines a color only the browser can blend leaves it to WAAPI
    const oklch = await page.locator('#oklch').evaluate((element) => ({
        animations: element.getAnimations().length,
        color: getComputedStyle(element).backgroundColor
    }))
    expect(oklch.animations).toBe(1)
    expect(oklch.color).not.toBe('oklch(0.7 0.1 200)')
})

test('unsetting path data removes the d attribute', async ({ page }) => {
    await page.goto(URL)
    const path = page.locator('#unset')
    await expect(path).toHaveAttribute('d', 'M10 10L90 10L90 90Z')
    await page.locator('#unset-button').click()
    await expect(path).not.toHaveAttribute('d')
})

test('the opacity box never paints at full opacity before it fades in', async ({ page }) => {
    // Upstream's animate-mixer.html is built in the browser, so the box's
    // first painted frame is already the 0 keyframe. A server-rendered page
    // shows the box with no opacity (like framer-motion's SSR output) until
    // it hydrates, which reads as "on, snaps off, then fades in".
    await page.addInitScript(() => {
        const frames: string[] = []
        ;(window as unknown as { opacityFrames: string[] }).opacityFrames = frames
        const start = performance.now()
        const sample = () => {
            const element = document.getElementById('opacity')
            if (element) frames.push(getComputedStyle(element).opacity)
            if (performance.now() - start < 1500) requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
    })
    await page.goto(URL)
    await page.waitForTimeout(1600)

    const frames = await page.evaluate(
        () => (window as unknown as { opacityFrames: string[] }).opacityFrames
    )
    expect(frames.length).toBeGreaterThan(0)
    expect(frames.filter((opacity) => opacity === '1')).toEqual([])
})
