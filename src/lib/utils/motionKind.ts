/**
 * `motion` vs `m` component kinds (Motion 14.7.1).
 *
 * Upstream builds two families of components from one implementation:
 * `motion.*` preloads every feature and ignores `<LazyMotion>`
 * (`render/components/motion/create.ts`), while `m.*` gets its features only
 * from `<LazyMotion>` (`render/components/m/create.ts`). svelte-motion's
 * element wrappers are generated Svelte components, so the `m` family is the
 * same components wrapped to inject an internal kind prop.
 */

/**
 * Which family a motion component belongs to.
 *
 * - `'motion'`: always has every feature and ignores `<LazyMotion>`.
 * - `'m'`: takes its features from the nearest `<LazyMotion>`.
 */
export type MotionKind = 'motion' | 'm'

/**
 * Internal prop that carries a component's {@link MotionKind} to
 * `_MotionContainer.svelte`, which destructures it so it never reaches the DOM.
 */
export const MOTION_KIND_PROP = '__motionKind'

/**
 * Wraps a Svelte 5 component so it always receives extra props.
 *
 * The wrapper passes the component a `Proxy` over the caller's props: the
 * injected keys are added, and every other read, write, `in` check, key
 * listing and delete goes to the original props object, so Svelte's reactive
 * getters, spread props and `bind:` setters keep working on client and
 * server. Caller-supplied values for an injected key are ignored.
 *
 * @param component - The Svelte component to wrap.
 * @param props - Props to inject on every render.
 * @returns A component with the same signature as `component`.
 *
 * @example
 * ```ts
 * const MDiv = withMotionKind(Div, { [MOTION_KIND_PROP]: 'm' })
 * ```
 */
export function withMotionKind<C>(component: C, props: Record<string, unknown>): C {
    const render = component as unknown as (
        anchor: unknown,
        componentProps: Record<PropertyKey, unknown>
    ) => unknown
    const injectedKeys = Object.keys(props)
    const isInjected = (key: PropertyKey): key is string =>
        typeof key === 'string' && Object.prototype.hasOwnProperty.call(props, key)

    const wrapped = (anchor: unknown, componentProps: Record<PropertyKey, unknown> = {}) => {
        const injected = new Proxy(componentProps, {
            get: (target, key) => (isInjected(key) ? props[key] : Reflect.get(target, key)),
            has: (target, key) => isInjected(key) || Reflect.has(target, key),
            set: (target, key, value) => (isInjected(key) ? true : Reflect.set(target, key, value)),
            deleteProperty: (target, key) =>
                isInjected(key) ? true : Reflect.deleteProperty(target, key),
            ownKeys: (target) => {
                const keys = Reflect.ownKeys(target)
                for (const key of injectedKeys) if (!keys.includes(key)) keys.push(key)
                return keys
            },
            getOwnPropertyDescriptor: (target, key) =>
                isInjected(key)
                    ? { value: props[key], enumerable: true, configurable: true, writable: false }
                    : Reflect.getOwnPropertyDescriptor(target, key)
        })
        return render(anchor, injected)
    }

    return wrapped as unknown as C
}

/**
 * Upstream's strict-mode message, verbatim (`motion/index.tsx` `useStrictMode`).
 */
export const LAZY_STRICT_MESSAGE =
    'You have rendered a `motion` component within a `LazyMotion` component. This will break tree shaking. Import and render a `m` component instead'

/**
 * Appended to {@link LAZY_STRICT_MESSAGE} for the main `Reorder`, which renders
 * `motion` components (upstream: `'. For Reorder, import it from "motion/react-m"'`).
 */
export const REORDER_STRICT_HINT = '. For Reorder, import it from "@humanspeak/svelte-motion/m"'

/**
 * Appends upstream's troubleshooting link for the `lazy-strict-mode` code
 * (motion-utils `format-error-message.ts`).
 *
 * @param message - The strict-mode message.
 * @returns The message with the troubleshooting link appended.
 */
export function formatLazyStrictMessage(message: string): string {
    return `${message}. For more information and steps for solving, visit https://motion.dev/troubleshooting/lazy-strict-mode`
}

const warned = new Set<string>()

/**
 * Logs `message` with `console.warn` the first time it is seen, and never
 * again (motion-utils `warn-once.ts`).
 *
 * @param message - The warning to log.
 */
export function warnOnce(message: string): void {
    if (warned.has(message)) return
    console.warn(message)
    warned.add(message)
}

/** @internal Test-only: forget which messages were warned. */
export function resetWarnOnceForTests(): void {
    warned.clear()
}
