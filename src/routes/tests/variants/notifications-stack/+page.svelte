<script lang="ts">
    import { motion, stringifyStyleObject, type Variants } from '$lib'
    import HeaderComponent from './HeaderComponent.svelte'
    import NotificationItem from './NotificationItem.svelte'

    const N_NOTIFICATIONS = 3

    let isOpen = $state(false)

    const stackVariants: Variants = {
        open: {
            y: 20,
            scale: 0.9,
            cursor: 'pointer'
        },
        closed: {
            y: 0,
            scale: 1,
            cursor: 'default'
        }
    }
</script>

<div class="flex min-h-screen items-center justify-center p-8">
    <div class="demo-container">
        <h1 class="mb-8 text-center text-3xl font-bold">Notifications Stack with Variants</h1>

        <p class="mb-8 text-center text-gray-600">
            Click the stack to expand/collapse. Each notification uses variants with different
            delays.
        </p>

        <motion.div
            data-testid="stack-container"
            style={stringifyStyleObject({
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '300px'
            })}
            variants={stackVariants}
            initial={false}
            animate={isOpen ? 'open' : 'closed'}
            transition={{
                type: 'spring',
                mass: 0.7
            }}
        >
            <HeaderComponent {isOpen} onClose={() => (isOpen = false)} />

            <!-- trunk-ignore(eslint/@typescript-eslint/no-unused-vars) -->
            {#each Array.from({ length: N_NOTIFICATIONS }) as _, i (i)}
                <NotificationItem index={i} onclick={() => (isOpen = !isOpen)} />
            {/each}
        </motion.div>

        <div class="mt-8 text-center text-sm text-gray-500">
            State: <span class="font-mono font-bold">{isOpen ? 'open' : 'closed'}</span>
        </div>
    </div>
</div>

<style>
    .demo-container {
        max-width: 600px;
        width: 100%;
    }
</style>
