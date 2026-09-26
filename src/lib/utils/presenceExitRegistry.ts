import type { PresenceContextProps } from 'motion-dom'

type ParticipantId = Parameters<PresenceContextProps['register']>[0]

/**
 * Coordinates the independent motion exits owned by one PresenceChild.
 *
 * Like upstream PresenceChild, registered IDs track completion. Empty manual
 * wrappers intentionally keep their hold until explicitly released.
 *
 * @returns Registration, exit-cycle completion, and invalidation operations.
 */
export function createPresenceExitRegistry() {
    const participants = new Map<ParticipantId, { complete: boolean }>()
    let cycle = 0
    let active = false
    let participated = false
    let finish: (() => void) | undefined

    function checkComplete() {
        if (!active || !participated) return
        for (const participant of participants.values()) {
            if (!participant.complete) return
        }
        const callback = finish
        cancel()
        callback?.()
    }

    function cancel() {
        cycle += 1
        active = false
        finish = undefined
    }

    return {
        register(this: void, id: ParticipantId) {
            const participant = { complete: false }
            participants.set(id, participant)
            if (active) participated = true
            return () => {
                if (participants.get(id) !== participant) return
                participants.delete(id)
                checkComplete()
            }
        },
        begin(onComplete: () => void) {
            cancel()
            active = true
            participated = participants.size > 0
            finish = onComplete
            for (const participant of participants.values()) participant.complete = false
            const version = cycle
            return (id: ParticipantId) => {
                if (!active || version !== cycle) return
                const participant = participants.get(id)
                if (!participant) return
                participant.complete = true
                checkComplete()
            }
        },
        cancel
    }
}
