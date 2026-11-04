import { expect, test, type Page } from '@playwright/test'

/**
 * Changing the speed of an accelerated transform animation, or pausing and
 * playing it, keeps it on the compositor without a jump.
 *
 * Port of the three tests at `tests/animate/independent-transforms-handoff.spec.ts:201-316`
 * @ `v14.7.1` ("speed changes stay on the compositor without a jump", "speed
 * changes after pause() and play() don't jump", "pause() and play() stay on
 * the compositor without a jump"), with `tolerance`, `timeOf` and
 * `expectSteady` verbatim, against
 * `src/routes/tests/independent-transforms/speed-change/+page.svelte`. Each
 * runs on a plain element (`#a`, as upstream) and on a svelte-motion
 * `motion.div` (`#m`).
 *
 * All six `recordFrames` tests are guards, not red-first regressions: two of
 * the three upstream tests already existed at v14.6.0; the second test's
 * fixes (`b58283208`, `dc23e95f8`) are WebKit-only and this repo runs
 * Chromium only; and `getComputedStyle` read in `postRender` reports the
 * main-thread sampled value, so it can't see `ccdd9da35`'s compositor flash.
 *
 * The screencast tests check `ccdd9da35` (speed changes use
 * `updatePlaybackRate()`: setting `playbackRate` + `startTime` restarted a
 * compositor animation, which could paint the underlying value for a frame)
 * against the compositor's actual output, via a CDP screencast.
 */

interface Frame {
    t: number
    ts: number
    x: number
    y: number
    scale: number
    rotate: number
    count: number
}

type SpeedWindow = Window & {
    Motion: {
        animate: (
            element: Element,
            keyframes: Record<string, number>,
            options: Record<string, unknown>
        ) => { speed: number; pause: () => void; play: () => void }
    }
    wait: (ms: number) => Promise<void>
    recordFrames: (element: Element, ms: number) => Promise<Frame[]>
    ready: boolean
}

/**
 * Rounding and timing differences allow up to this many px of difference
 * per frame.
 */
const tolerance = 2.5

/**
 * When a frame shows the element: the compositor samples WAAPI animations
 * at the frame's timeline time, and JS animations sample at Motion's frame
 * timestamp, which is later when the main thread is busy.
 */
const timeOf = (frame: Frame) => (frame.count ? frame.t : frame.ts)

/**
 * Every frame moves at speed (px per ms), within tolerance.
 */
function expectSteady(frames: Frame[], speed: number, key: 'x' | 'y' = 'x') {
    for (let i = 1; i < frames.length; i++) {
        const dt = timeOf(frames[i]) - timeOf(frames[i - 1])
        const dx = frames[i][key] - frames[i - 1][key]
        expect(
            Math.abs(dx - speed * dt),
            `frame ${i}: moved ${dx.toFixed(2)}px in ${dt.toFixed(1)}ms`
        ).toBeLessThan(tolerance)
    }
}

const elements = [
    { id: 'a', name: 'plain element' },
    { id: 'm', name: 'motion component' }
]

test.describe('independent transforms: speed changes and pause/play', () => {
    test.use({ viewport: { width: 1000, height: 500 } })

    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/independent-transforms/speed-change?@isPlaywright=true')
        await page.waitForFunction(() => (window as unknown as SpeedWindow).ready)
    })

    for (const { id, name } of elements) {
        test(`speed changes stay on the compositor without a jump (${name})`, async ({ page }) => {
            const frames = await page.evaluate(async (id) => {
                const w = window as unknown as SpeedWindow
                const element = document.getElementById(id)!
                const { animate } = w.Motion
                const animation = animate(element, { x: 600 }, { duration: 3, ease: 'linear' })
                await w.wait(300)
                const recording = w.recordFrames(element, 800)
                await w.wait(400)
                animation.speed = 2
                return recording
            }, id)

            expect(frames.every((f) => f.count === 1)).toBe(true)
            const changed = frames.findIndex(
                (f, i) => i && (f.x - frames[i - 1].x) / (f.t - frames[i - 1].t) > 0.3
            )
            expect(changed).toBeGreaterThan(2)
            expectSteady(frames.slice(0, changed), 0.2)
            expectSteady(frames.slice(changed), 0.4)
            // The frame it changed in moved between the two speeds.
            const dt = frames[changed].t - frames[changed - 1].t
            const dx = frames[changed].x - frames[changed - 1].x
            expect(dx).toBeGreaterThan(0.2 * dt - tolerance)
            expect(dx).toBeLessThan(0.4 * dt + tolerance)
        })

        test(`speed changes after pause() and play() don't jump (${name})`, async ({ page }) => {
            const frames = await page.evaluate(async (id) => {
                const w = window as unknown as SpeedWindow
                const element = document.getElementById(id)!
                const { animate } = w.Motion
                const animation = animate(element, { x: 600 }, { duration: 3, ease: 'linear' })
                await w.wait(200)
                animation.pause()
                await w.wait(100)
                animation.play()
                await w.wait(100)
                const recording = w.recordFrames(element, 800)
                await w.wait(400)
                animation.speed = 2
                return recording
            }, id)

            expect(frames.every((f) => f.count === 1)).toBe(true)
            const changed = frames.findIndex(
                (f, i) => i && (f.x - frames[i - 1].x) / (f.t - frames[i - 1].t) > 0.3
            )
            expect(changed).toBeGreaterThan(2)
            expectSteady(frames.slice(0, changed), 0.2)
            expectSteady(frames.slice(changed), 0.4)
            const dt = frames[changed].t - frames[changed - 1].t
            const dx = frames[changed].x - frames[changed - 1].x
            expect(dx).toBeGreaterThan(0.2 * dt - tolerance)
            expect(dx).toBeLessThan(0.4 * dt + tolerance)
        })

        test(`pause() and play() stay on the compositor without a jump (${name})`, async ({
            page
        }) => {
            const frames = await page.evaluate(async (id) => {
                const w = window as unknown as SpeedWindow
                const element = document.getElementById(id)!
                const { animate } = w.Motion
                const animation = animate(element, { x: 600 }, { duration: 3, ease: 'linear' })
                await w.wait(300)
                const recording = w.recordFrames(element, 1000)
                await w.wait(300)
                animation.pause()
                await w.wait(300)
                animation.play()
                return recording
            }, id)

            expect(frames.every((f) => f.count === 1)).toBe(true)
            const paused = frames.findIndex((f, i) => i && Math.abs(f.x - frames[i - 1].x) < 0.01)
            const resumed = frames.findIndex((f, i) => i > paused && f.x - frames[i - 1].x > 0.01)
            expect(paused).toBeGreaterThan(2)
            expect(resumed).toBeGreaterThan(paused + 5)

            /**
             * pause() and play() happen between frames, so the frames they
             * happen in move part of a frame's distance.
             */
            const expectPartial = (i: number) => {
                const dx = frames[i].x - frames[i - 1].x
                expect(dx).toBeGreaterThanOrEqual(-0.01)
                expect(dx).toBeLessThan(0.2 * (frames[i].t - frames[i - 1].t) + tolerance)
            }
            expectSteady(frames.slice(0, paused - 1), 0.2)
            expectPartial(paused - 1)
            expectSteady(frames.slice(paused - 1, resumed), 0)
            expectPartial(resumed)
            expectSteady(frames.slice(resumed), 0.2)
        })

        test(`a speed change paints no flash (screencast) (${name})`, async ({ page }) => {
            const edges = await screencastSpeedChange(page, id)
            test.info().annotations.push({
                type: `painted left edges (#${id})`,
                description: edges.map((edge) => edge.toFixed(0)).join(',')
            })

            expect(edges.length).toBeGreaterThanOrEqual(20)
            for (let i = 1; i < edges.length; i++) {
                expect(
                    edges[i - 1] - edges[i],
                    `frame ${i}: left edge ${edges[i - 1]} -> ${edges[i]}`
                ).toBeLessThanOrEqual(2)
            }
            for (let i = 3; i < edges.length; i++) {
                expect(edges[i], `frame ${i}: left edge ${edges[i]}`).toBeGreaterThanOrEqual(5)
            }
        })
    }
})

type ScreencastFrame = { data: string; metadata: { deviceWidth: number; timestamp?: number } }

/**
 * Runs upstream's speed-change scenario on `#id` under a CDP screencast and
 * returns the element's painted left edge (CSS px) in every delivered frame,
 * or -1 where no box-coloured pixel was found on its row.
 */
async function screencastSpeedChange(page: Page, id: string): Promise<number[]> {
    const cdp = await page.context().newCDPSession(page)
    const shots: ScreencastFrame[] = []
    cdp.on('Page.screencastFrame', (event) => {
        shots.push({ data: event.data, metadata: event.metadata })
        void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {})
    })

    const centre = await page.evaluate((id) => {
        const rect = document.getElementById(id)!.getBoundingClientRect()
        return rect.top + rect.height / 2
    }, id)

    await cdp.send('Page.startScreencast', {
        format: 'png',
        everyNthFrame: 1,
        maxWidth: 1000,
        maxHeight: 500
    })
    await page.evaluate(async (id) => {
        const w = window as unknown as SpeedWindow
        const element = document.getElementById(id)!
        const animation = w.Motion.animate(element, { x: 600 }, { duration: 3, ease: 'linear' })
        await w.wait(700)
        animation.speed = 2
        await w.wait(500)
    }, id)
    await cdp.send('Page.stopScreencast')
    await cdp.detach()
    // Judge frames in capture order (the compositor's timestamp), not delivery order.
    shots.sort((a, b) => (a.metadata.timestamp ?? 0) - (b.metadata.timestamp ?? 0))
    const first = shots[0]?.metadata.timestamp ?? 0
    test.info().annotations.push({
        type: `screencast frame times (ms, #${id})`,
        description: shots
            .map((shot) => (((shot.metadata.timestamp ?? 0) - first) * 1000).toFixed(0))
            .join(',')
    })

    return page.evaluate(
        async ({ shots, centre }) => {
            const target = [0x00, 0x77, 0xff]
            const edges: number[] = []
            for (const { data, metadata } of shots) {
                const blob = await (await fetch('data:image/png;base64,' + data)).blob()
                const bitmap = await createImageBitmap(blob)
                const canvas = document.createElement('canvas')
                canvas.width = bitmap.width
                canvas.height = bitmap.height
                const context = canvas.getContext('2d')!
                context.drawImage(bitmap, 0, 0)
                const scale = bitmap.width / metadata.deviceWidth
                const row = Math.min(bitmap.height - 1, Math.round(centre * scale))
                const pixels = context.getImageData(0, row, bitmap.width, 1).data
                let edge = -1
                for (let x = 0; x < bitmap.width; x++) {
                    const matches = target.every(
                        (channel, c) => Math.abs(pixels[x * 4 + c] - channel) <= 30
                    )
                    if (matches) {
                        edge = x / scale
                        break
                    }
                }
                edges.push(edge)
            }
            return edges
        },
        { shots, centre }
    )
}
