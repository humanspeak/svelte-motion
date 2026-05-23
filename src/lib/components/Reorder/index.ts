import type { Component } from 'svelte'
import ReorderGroupImpl from './ReorderGroup.svelte'
import ReorderItemImpl from './ReorderItem.svelte'

/**
 * Namespaced API matching framer-motion's `<Reorder.Group>` /
 * `<Reorder.Item>`. Svelte 5 supports `<Foo.Bar>` syntax when `Foo` is
 * an import-time object with component properties.
 *
 * ```svelte
 * <script>
 *   import { Reorder } from '@humanspeak/svelte-motion'
 *   let items = $state([0, 1, 2])
 * </script>
 *
 * <Reorder.Group axis="y" values={items} onReorder={(next) => (items = next)}>
 *   {#each items as item (item)}
 *     <Reorder.Item value={item}>{item}</Reorder.Item>
 *   {/each}
 * </Reorder.Group>
 * ```
 *
 * The namespace properties are typed as `Component<any>` because Svelte's
 * generated component type (`$$IsomorphicComponent`) can't be re-exported
 * through an object literal — the type-system gap is documented at
 * https://github.com/sveltejs/svelte/issues/13355. For full prop type
 * checking, import the components directly:
 *
 * ```ts
 * import { ReorderGroup, ReorderItem } from '@humanspeak/svelte-motion'
 * ```
 */
export const Reorder: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Group: Component<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Item: Component<any>
} = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Group: ReorderGroupImpl as unknown as Component<any>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Item: ReorderItemImpl as unknown as Component<any>
}

export type { ItemData, ReorderContext } from './context.js'
export { default as ReorderGroup } from './ReorderGroup.svelte'
export { default as ReorderItem } from './ReorderItem.svelte'
