<script lang="ts">
    /**
     * One row of the #2024 fixture. Port of upstream `issue-2024.tsx`'s
     * `Item`: a `Reorder.Item` with its own `y` MotionValue and the page's
     * `dragConstraints`.
     *
     * @prop item The value this row represents (also its label and id suffix).
     * @prop constraints The `dragConstraints` the page selected (ref, object or none).
     *
     * Every change of `constraints` after mount bumps
     * `window.__constraintsChanges`, so the spec can prove that
     * `window.rebindConstraints()` really reached the items.
     */
    import { Reorder, useMotionValue, type DragConstraints } from '$lib'

    let { item, constraints }: { item: number; constraints: DragConstraints | undefined } = $props()

    const y = useMotionValue(0)

    type CountWindow = Window & { __constraintsChanges?: number }
    let seen = false
    $effect(() => {
        void constraints
        if (!seen) {
            seen = true
            return
        }
        const w = window as CountWindow
        w.__constraintsChanges = (w.__constraintsChanges ?? 0) + 1
    })
</script>

<Reorder.Item
    value={item}
    id="item-{item}"
    data-testid="item-{item}"
    dragConstraints={constraints}
    style={{
        y,
        position: 'relative',
        height: 60,
        marginBottom: 10,
        borderRadius: 10,
        background: 'white',
        listStyle: 'none',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 20
    }}
>
    {item}
</Reorder.Item>
