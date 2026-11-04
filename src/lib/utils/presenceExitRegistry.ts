import type { PresenceContextProps, VisualElement } from 'motion-dom'

type ParticipantId = Parameters<PresenceContextProps['register']>[0]

/**
 * Coordinates the independent motion exits owned by one PresenceChild.
 *
 * Like upstream PresenceChild, registered IDs track completion, and a cycle
 * completes once every participant is done. A cycle with nothing registered
 * completes when its owner calls `completeIfEmpty()`, as upstream's
 * post-commit effect does (PresenceChild.tsx:104-113 @ v14.7.1).
 *
 * It also remembers the outermost registered motion node, the element
 * `mode="popLayout"` pops out of flow (framer-motion
 * `components/AnimatePresence/PresenceChild.tsx` @ v14.5.0, #2503).
 *
 * @returns Registration, exit-cycle completion, invalidation, and pop-element
 *     lookup operations.
 */
export function createPresenceExitRegistry() {
    const participants = new Map<ParticipantId, { complete: boolean }>()
    let cycle = 0
    let active = false
    let finish: (() => void) | undefined
    let popNode: VisualElement | undefined

    function checkComplete() {
        if (!active) return
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

    /**
     * Register a participant, optionally with its VisualElement.
     *
     * @param id The participant's presence id.
     * @param node The participant's VisualElement, passed by the exit feature.
     * @returns The unregister function.
     */
    function register(id: ParticipantId, node?: VisualElement) {
        const participant = { complete: false }
        participants.set(id, participant)
        // Upstream keeps `node` when `node.parent?.presenceContext?.id !== id`,
        // i.e. its parent motion component belongs to another presence child.
        // svelte-motion's presence context ids are per element, so compare the
        // shared `register` instead: every motion element held by this
        // PresenceChild gets this same function.
        if (node && node.parent?.presenceContext?.register !== register) popNode = node
        return () => {
            if (node && popNode === node) popNode = undefined
            if (participants.get(id) !== participant) return
            participants.delete(id)
            checkComplete()
        }
    }

    return {
        register,
        /**
         * The element of the outermost registered motion node, if any.
         *
         * @returns The element `mode="popLayout"` should pop, or `undefined`.
         */
        getPopElement(): HTMLElement | undefined {
            const current = popNode?.current
            return current instanceof HTMLElement ? current : undefined
        },
        begin(onComplete: () => void) {
            cancel()
            active = true
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
        /**
         * Complete the active cycle if nothing is registered with it, as
         * upstream's post-commit effect does (PresenceChild.tsx:104-113 @
         * v14.7.1). A no-op outside a cycle or while any participant is
         * registered.
         */
        completeIfEmpty() {
            if (active && participants.size === 0) checkComplete()
        },
        cancel
    }
}
