import { microtask } from 'motion-dom'
import { flushSync } from 'svelte'
import { describe, expect, it, vi } from 'vitest'

/**
 * Regression guard: `useScroll` waiting for an unresolved `bind:this` ref
 * must not stall motion-dom's page-wide `microtask` batcher. Re-scheduling a
 * `microtask` job from inside a running batch leaves the batcher's
 * `runNextFrame` flag set with no batch queued (motion-dom
 * `frameloop/batcher.ts` processBatch / wake / schedule), so every later
 * `microtask.*` job is silently dropped.
 *
 * Lives in its own file because a stalled batcher is a module singleton and
 * would poison every later test in the same file.
 */

type ScrollCallback = (
    progress: number,
    info: {
        x: { current: number; progress: number }
        y: { current: number; progress: number }
    }
) => void
type ScrollOpts = Record<string, unknown> | undefined

const scrollMock = vi.fn<(cb: ScrollCallback, opts?: ScrollOpts) => () => void>(
    () => () => undefined
)
const supportsScrollTimelineMock = vi.fn(() => false)
const supportsViewTimelineMock = vi.fn(() => false)

vi.mock('motion', () => ({
    scroll: (cb: ScrollCallback, opts?: ScrollOpts) => scrollMock(cb, opts)
}))

vi.mock('motion-dom', async () => {
    const actual = await vi.importActual<typeof import('motion-dom')>('motion-dom')
    return {
        ...actual,
        supportsScrollTimeline: () => supportsScrollTimelineMock(),
        supportsViewTimeline: () => supportsViewTimelineMock()
    }
})

// Import AFTER vi.mock so the hook picks up the mocked exports.
const { useScroll } = await import('./scroll.svelte.js')

const drainMicrotasks = async (ticks = 8) => {
    for (let i = 0; i < ticks; i++) await Promise.resolve()
}

describe('utils/scroll - microtask batcher', () => {
    it('keeps motion-dom microtask jobs running while a ref retries', async () => {
        const ref: { current?: HTMLElement } = {}
        const stop = $effect.root(() => {
            useScroll({ container: () => ref.current })
        })
        try {
            flushSync()

            // Let the retry run at least twice with the ref still missing.
            await drainMicrotasks()

            let laterJobRan = false
            microtask.read(() => {
                laterJobRan = true
            })
            await drainMicrotasks()
            expect(laterJobRan).toBe(true)

            ref.current = document.createElement('div')
            await vi.waitFor(() => expect(scrollMock).toHaveBeenCalledOnce(), { timeout: 200 })
        } finally {
            stop()
        }
    })
})
