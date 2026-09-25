import { Reorder } from '@humanspeak/svelte-motion'

type IsAny<T> = 0 extends 1 & T ? true : false
type Assert<T extends true> = T
type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

export type NamespaceIsTyped = Assert<Equal<IsAny<typeof Reorder>, false>>
export type GroupIsTyped = Assert<Equal<IsAny<typeof Reorder.Group>, false>>
export type ItemIsTyped = Assert<Equal<IsAny<typeof Reorder.Item>, false>>

declare function expectType<T>(value: T): void

// This fixture is compiled only. These component calls must never execute.
Reorder.Group(undefined, {
    values: [1, 2, 3],
    onReorder: (next) => {
        expectType<Assert<Equal<typeof next, number[]>>>(true)
        expectType<Assert<Equal<IsAny<(typeof next)[number]>, false>>>(true)
        // @ts-expect-error Numeric values cannot become strings.
        expectType<string[]>(next)
    }
})

type Task = { id: number; title: string }
const tasks: Task[] = [{ id: 1, title: 'First' }]

Reorder.Group(undefined, {
    values: tasks,
    onReorder: (next) => {
        expectType<Assert<Equal<typeof next, Task[]>>>(true)
        expectType<Assert<Equal<IsAny<(typeof next)[number]>, false>>>(true)
        // @ts-expect-error Object values cannot become numbers.
        expectType<number[]>(next)
    }
})

Reorder.Group<number>(undefined, {
    values: [1],
    onReorder: (next) => {
        expectType<Assert<Equal<typeof next, number[]>>>(true)
        expectType<number[]>(next)
    }
})
Reorder.Group<Task>(undefined, {
    values: tasks,
    onReorder: (next) => {
        expectType<Assert<Equal<typeof next, Task[]>>>(true)
        expectType<Task[]>(next)
    }
})
Reorder.Item<number>(undefined, { value: 1 })
Reorder.Item<Task>(undefined, { value: tasks[0] })
Reorder.Item(undefined, { value: 1 })
Reorder.Item(undefined, { value: tasks[0] })

Reorder.Group<number>(undefined, {
    values: [1],
    onReorder: () => {},
    // @ts-expect-error Reorder does not support a z axis.
    axis: 'z'
})
// @ts-expect-error A group requires values.
Reorder.Group<number>(undefined, { onReorder: () => {} })
// @ts-expect-error A group requires an onReorder callback.
Reorder.Group<number>(undefined, { values: [1] })
// @ts-expect-error An item requires a value.
Reorder.Item<number>(undefined, {})
// @ts-expect-error A numeric item cannot accept an object.
Reorder.Item<number>(undefined, { value: tasks[0] })
// @ts-expect-error An object item cannot accept a number.
Reorder.Item<Task>(undefined, { value: 1 })

Reorder.Group<number>(undefined, {
    values: [1],
    // @ts-expect-error A numeric group cannot report string values.
    onReorder: (next: string[]) => expectType<string[]>(next)
})
Reorder.Group<Task>(undefined, {
    values: tasks,
    // @ts-expect-error An object group cannot report numeric values.
    onReorder: (next: number[]) => expectType<number[]>(next)
})
