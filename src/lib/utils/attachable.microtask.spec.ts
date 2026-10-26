import { microtask } from 'motion-dom'
import { describe, expect, it, vi } from 'vitest'
import { createAttachable } from './attachable.js'

/**
 * Regression guard: retrying an unresolved ref must not stall motion-dom's
 * page-wide `microtask` batcher. Re-scheduling a `microtask` job from inside
 * a running batch leaves the batcher's `runNextFrame` flag set with no batch
 * queued (motion-dom `frameloop/batcher.ts` processBatch / wake / schedule),
 * so every later `microtask.*` job is silently dropped.
 *
 * Lives in its own file because a stalled batcher is a module singleton and
 * would poison every later test in the same file.
 */
const drainMicrotasks = async (ticks = 8) => {
    for (let i = 0; i < ticks; i++) await Promise.resolve()
}

describe('utils/attachable - microtask batcher', () => {
    it('keeps motion-dom microtask jobs running while a ref retries', async () => {
        const ref: { current?: HTMLElement } = {}
        const onAttach = vi.fn()
        const attachable = createAttachable({ refs: { target: () => ref.current }, onAttach })
        const release = attachable.subscribe()

        // Let the retry run at least twice with the ref still missing.
        await drainMicrotasks()

        let laterJobRan = false
        microtask.read(() => {
            laterJobRan = true
        })
        await drainMicrotasks()
        expect(laterJobRan).toBe(true)

        ref.current = document.createElement('div')
        await vi.waitFor(() => expect(onAttach).toHaveBeenCalledOnce(), { timeout: 200 })
        release()
    })
})
