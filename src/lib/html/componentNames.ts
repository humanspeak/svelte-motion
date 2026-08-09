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

/**
 * Tags whose PascalCase name collides with a JS global AND is used verbatim
 * as the component filename (`object` → `Object.svelte`). Renamed in both the
 * filename and the barrel binding.
 */
const GLOBAL_COLLIDING_FILENAMES: Record<string, string> = {
    object: 'HtmlObject',
    map: 'HtmlMap',
    math: 'HtmlMath',
    symbol: 'HtmlSymbol'
}

/**
 * Tags whose PascalCase name collides with a JS global only as a barrel
 * import binding — the underlying file is already non-colliding (`set` →
 * `SetElement.svelte`). Renaming the binding is defensive: a barrel module has
 * no default export, so Vite's boilerplate never references the binding, but
 * keeping a top-level `Set`/`Object`-style identifier shadowing the global is
 * fragile against future tooling changes.
 */
const GLOBAL_COLLIDING_BINDINGS: Record<string, string> = {
    set: 'HtmlSet'
}

/** The safe component/binding identifier for a tag (`object` → `HtmlObject`). */
export const toComponentName = (tag: string): string =>
    GLOBAL_COLLIDING_BINDINGS[tag] ?? GLOBAL_COLLIDING_FILENAMES[tag] ?? toPascalCase(tag)

/** The component filename stem for a tag (`object` → `HtmlObject`, `set` → `SetElement`). */
export const toComponentFileName = (tag: string): string =>
    tag === 'set' ? 'SetElement' : (GLOBAL_COLLIDING_FILENAMES[tag] ?? toPascalCase(tag))

/** The PascalCase form of the tag, i.e. the public barrel export name (`set` → `Set`). */
export const toPublicName = (tag: string): string => toPascalCase(tag)

/**
 * JS globals that a generated component name or filename must never shadow.
 * Svelte names the compiled function after the filename, so a component named
 * `Object`/`Map`/`Math`/`Symbol`/… would shadow the global inside the module
 * and break Vite's SSR export boilerplate (`Object.defineProperty is not a
 * function`). Used by the generator guard (and its test) to fail loudly if a
 * new `html-tags`/`svg-tags` entry would reintroduce a collision.
 */
export const JS_GLOBAL_NAMES = new Set([
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
