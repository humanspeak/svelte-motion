<script lang="ts">
    import { Reorder } from '@humanspeak/svelte-motion'
    import Item from './Item.svelte'

    type TodoItem = {
        id: number
        text: string
        completed: boolean
        color: string
    }

    const COLORS = ['#ff0088', '#dd00ee', '#9911ff', '#1e75f7', '#0cdcf7', '#8df0cc']

    let todos: TodoItem[] = $state([
        { id: 0, text: 'Review project proposal', completed: false, color: COLORS[0] },
        { id: 1, text: 'Update documentation', completed: false, color: COLORS[1] },
        { id: 2, text: 'Schedule team meeting', completed: false, color: COLORS[2] },
        { id: 3, text: 'Test new features', completed: false, color: COLORS[3] },
        { id: 4, text: 'Deploy to staging', completed: false, color: COLORS[4] },
        { id: 5, text: 'Send weekly report', completed: false, color: COLORS[5] },
        { id: 6, text: 'Prepare presentation slides', completed: false, color: COLORS[0] },
        { id: 7, text: 'Review pull requests', completed: false, color: COLORS[1] }
    ])

    // Toggle a todo's completion state. If newly completed, defer the
    // shuffle-to-bottom by 600ms so the strikethrough animation has time
    // to play before the layout swap whisks the row down.
    const toggleTodo = (id: number) => {
        todos = todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
        if (todos.find((t) => t.id === id)?.completed) {
            setTimeout(() => {
                const uncompleted = todos.filter((t) => !t.completed)
                const completed = todos.filter((t) => t.completed)
                todos = [...uncompleted, ...completed]
            }, 600)
        }
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="todo-container">
        <Reorder.Group
            axis="y"
            values={todos}
            onReorder={(next: TodoItem[]) => (todos = next)}
            class="todo-list"
        >
            {#each todos as todo (todo.id)}
                <Item {todo} onToggle={() => toggleTodo(todo.id)} />
            {/each}
        </Reorder.Group>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        width: 100%;
    }

    .todo-container {
        width: 100%;
        max-width: 340px;
        height: 280px;
        overflow: auto;
        padding: 24px;
        background-color: #ffffff;
        border-radius: 16px;
        border: 1px solid #e5e7eb;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
        scrollbar-width: thin;
        scrollbar-color: #d1d5db transparent;
    }

    .todo-container::-webkit-scrollbar {
        width: 6px;
    }

    .todo-container::-webkit-scrollbar-track {
        background: transparent;
    }

    .todo-container::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 3px;
    }

    :global(.todo-list) {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
</style>
