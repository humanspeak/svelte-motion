import { animate, createEffect, frame } from '$lib'

/** A plain JavaScript object whose angle and radius can be animated. */
export type Dial = {
    angle: number
    radius: number
}

/**
 * Binds Motion values to a dial and writes them before the canvas render phase.
 *
 * @returns A custom Motion effect that claims dial-shaped objects.
 */
export const dialEffect = createEffect<Dial>(
    (dial, state, key, value) =>
        state.set(
            key,
            value,
            () => {
                const target = dial as Record<string, number>
                target[key] = state.latest[key] as number
            },
            undefined,
            false
        ),
    {
        test: (subject): subject is Dial =>
            typeof subject === 'object' &&
            subject !== null &&
            'angle' in subject &&
            'radius' in subject,
        read: (dial, key) => (dial as Record<string, number>)[key],
        step: frame.preRender
    }
)

/**
 * Registered once, here at module scope, never from a component.
 *
 * `animate.addEffect()` writes to a process-global registry that dedupes by
 * effect identity and does not reference-count. A component that registered
 * on mount and removed on teardown would unregister the effect for every
 * other component still using it, after which `animate()` silently falls
 * back to the plain-object animator. Owning the effect and its registration
 * in one module makes that impossible.
 */
animate.addEffect(dialEffect)
