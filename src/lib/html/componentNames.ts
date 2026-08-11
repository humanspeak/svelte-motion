/**
 * Shared HTML/SVG tag → component-name mapping.
 *
 * Consumed by both the component generator (`scripts/generate-html.ts`) and
 * the Vite plugin (`src/lib/vite.ts`) so the two can never drift: the
 * generated `dist/html/*.svelte` filenames always match the import paths the
 * plugin emits for `motion.<tag>`.
 *
 * Background: Svelte names a compiled component function after its filename,
 * so `Object.svelte` compiles to `function Object(...)`, shadowing the JS
 * global inside the module. Vite's SSR export boilerplate then resolves
 * `Object` to the component function and throws
 * `Object.defineProperty is not a function` when the module is evaluated.
 * Component names AND barrel import bindings that collide with a JS global
 * are therefore renamed, while the public API is preserved via
 * `export { HtmlObject as Object }` — `motion.object` and the
 * `MotionComponents` type keys are unaffected.
 */

const toPascalCase = (tag: string): string =>
    tag
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')

type ComponentNameOverride = Readonly<{
    componentName: string
    fileName: string
    publicName: string
}>

/**
 * Exceptional tag names whose generated identifiers or filenames would
 * collide with JavaScript globals. This table is the single source of truth
 * for the safe internal binding, on-disk filename, and stable public export.
 */
const COMPONENT_NAME_OVERRIDES: Readonly<Record<string, ComponentNameOverride>> = {
    map: { componentName: 'HtmlMap', fileName: 'HtmlMap', publicName: 'Map' },
    math: { componentName: 'HtmlMath', fileName: 'HtmlMath', publicName: 'Math' },
    object: { componentName: 'HtmlObject', fileName: 'HtmlObject', publicName: 'Object' },
    set: { componentName: 'HtmlSet', fileName: 'SetElement', publicName: 'Set' },
    symbol: { componentName: 'HtmlSymbol', fileName: 'HtmlSymbol', publicName: 'Symbol' }
}

/**
 * Returns the safe internal component binding for an HTML or SVG tag.
 *
 * @param tag The lowercase HTML or SVG tag name.
 * @returns The internal component identifier, such as `HtmlObject`.
 */
export const toComponentName = (tag: string): string =>
    COMPONENT_NAME_OVERRIDES[tag]?.componentName ?? toPascalCase(tag)

/**
 * Returns the generated component filename stem for an HTML or SVG tag.
 *
 * @param tag The lowercase HTML or SVG tag name.
 * @returns The filename stem without `.svelte`, such as `SetElement`.
 */
export const toComponentFileName = (tag: string): string =>
    COMPONENT_NAME_OVERRIDES[tag]?.fileName ?? toPascalCase(tag)

/**
 * Returns the stable public barrel export name for an HTML or SVG tag.
 *
 * @param tag The lowercase HTML or SVG tag name.
 * @returns The public PascalCase export name, such as `Object`.
 */
export const toPublicName = (tag: string): string =>
    COMPONENT_NAME_OVERRIDES[tag]?.publicName ?? toPascalCase(tag)

/**
 * Returns the barrel export specifier for an HTML or SVG tag.
 *
 * @param tag The lowercase HTML or SVG tag name.
 * @returns A direct or aliased export specifier, such as `HtmlObject as Object`.
 */
export const toExportSpecifier = (tag: string): string => {
    const componentName = toComponentName(tag)
    const publicName = toPublicName(tag)
    return componentName === publicName ? componentName : `${componentName} as ${publicName}`
}

/**
 * Identifiers that generated component bindings and filenames must not use.
 *
 * Svelte names the compiled function after the filename, so a component named
 * `Object`/`Map`/`Math`/`Symbol`/… would shadow the global inside the module
 * and break Vite's SSR export boilerplate (`Object.defineProperty is not a
 * function`). This intentionally conservative guard is not intended to model
 * every global exposed by every JavaScript runtime.
 */
export const FORBIDDEN_GENERATED_IDENTIFIERS: ReadonlySet<string> = new Set([
    'Array',
    'Atomics',
    'BigInt',
    'Boolean',
    'Date',
    'decodeURI',
    'decodeURIComponent',
    'encodeURI',
    'encodeURIComponent',
    'Error',
    'eval',
    'Function',
    'globalThis',
    'Infinity',
    'Intl',
    'isFinite',
    'isNaN',
    'JSON',
    'Map',
    'Math',
    'NaN',
    'Number',
    'Object',
    'parseFloat',
    'parseInt',
    'Promise',
    'Proxy',
    'Reflect',
    'RegExp',
    'Set',
    'String',
    'Symbol',
    'undefined',
    'WeakMap',
    'WeakRef',
    'WeakSet',
    'WebAssembly'
])
