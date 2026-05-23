<script lang="ts">
    import { animate, motion, Reorder, useMotionValue } from '@humanspeak/svelte-motion'

    type TodoItem = {
        id: number
        text: string
        completed: boolean
        color: string
    }

    const { todo, onToggle }: { todo: TodoItem; onToggle: () => void } = $props()

    // Per-item box-shadow MotionValue. Lifted from idle to dragging on
    // drag start, animated back on drag end — gives the row a literal
    // pick-up-the-card depth cue without competing with the layout
    // animation.
    const boxShadow = useMotionValue('0 1px 2px rgba(0,0,0,0.1)')
</script>

<Reorder.Item
    value={todo}
    class="todo-item"
    style="box-shadow: {boxShadow.current}"
    onDragStart={() => animate(boxShadow, '0 7px 24px rgba(0,0,0,0.2)')}
    onDragEnd={() => animate(boxShadow, '0 1px 2px rgba(0,0,0,0.1)')}
>
    <button
        type="button"
        class="todo-checkbox"
        style:border-color={todo.color}
        style:background-color={todo.completed ? todo.color : 'transparent'}
        onclick={(e) => {
            e.stopPropagation()
            onToggle()
        }}
        onpointerdowncapture={(e) => e.stopPropagation()}
        aria-label={todo.completed
            ? `Mark "${todo.text}" incomplete`
            : `Mark "${todo.text}" complete`}
        aria-pressed={todo.completed}
    >
        {#if todo.completed}
            <svg width="10" height="8" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                <path
                    d="M1 5L4.5 8.5L11 1"
                    stroke="white"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
        {/if}
    </button>
    <span class="todo-text-wrapper">
        <motion.span
            animate={{ opacity: todo.completed ? 0.45 : 1 }}
            transition={{ duration: 0.4 }}
            class="todo-text"
        >
            {todo.text}
        </motion.span>
        <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: todo.completed ? 1 : 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            class="todo-strikethrough"
            style="background-color: {todo.color}"
        />
    </span>
</Reorder.Item>

<style>
    :global(.todo-item) {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background-color: #f9fafb;
        border-radius: 10px;
        cursor: grab;
    }

    :global(.todo-item:active) {
        cursor: grabbing;
    }

    .todo-checkbox {
        width: 20px;
        height: 20px;
        border-radius: 6px;
        border-width: 2px;
        border-style: solid;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        transition: background-color 0.2s;
        padding: 0;
    }

    .todo-text-wrapper {
        position: relative;
        display: inline-block;
    }

    :global(.todo-text) {
        font-size: 14px;
        font-weight: 500;
        color: #374151;
        display: inline-block;
    }

    :global(.todo-strikethrough) {
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 1.5px;
        transform-origin: left center;
        border-radius: 1px;
        pointer-events: none;
    }
</style>
