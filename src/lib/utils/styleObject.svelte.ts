import { stringifyStyleObject } from './styleObject.js'

export type StyleObject = Record<string, string | number>

/**
 * Creates a CSS style string from a style object or factory function.
 *
 * In Svelte 5, template expressions are reactive - when you use `$state` variables
 * in a template, the expression re-evaluates when those values change. This means
 * you can use `styleString` directly in templates and it will update reactively.
 *
 * @example
 * ```svelte
 * <script>
 *   import { styleString } from '@humanspeak/svelte-motion'
 *
 *   let rotate = $state(0)
 *   let opacity = $state(1)
 * </script>
 *
 * <!-- Both forms are reactive in Svelte 5 templates -->
 * <div style={styleString({ rotate, opacity })}>Object form</div>
 * <div style={styleString(() => ({ rotate, opacity }))}>Factory form</div>
 * ```
 *
 * @param input - A style object or a function returning a style object
 * @returns A CSS style string
 */
export function styleString(input: StyleObject | (() => StyleObject)): string {
    const obj = typeof input === 'function' ? input() : input
    return stringifyStyleObject(obj)
}

// Re-export the pure function for backwards compatibility
export { stringifyStyleObject } from './styleObject.js'
