<!--
  @component
  Animated shadcn Button component powered by svelte-motion.

  Drop-in replacement for the standard shadcn button with spring-based
  press feedback (whileTap) and optional hover lift. Supports all standard
  button variants and sizes, plus link mode via href.

  Set `animated={false}` to disable motion and get vanilla shadcn behavior.
-->
<script lang="ts" module>
    import { cn, type WithElementRef } from '$lib/shadcn/utils'
    import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements'
    import { type VariantProps, tv } from 'tailwind-variants'

    export const buttonVariants = tv({
        base: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs',
                destructive:
                    'bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 text-white shadow-xs',
                outline:
                    'bg-background hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 border shadow-xs',
                secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-xs',
                ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
                link: 'text-primary underline-offset-4 hover:underline'
            },
            size: {
                default: 'h-9 px-4 py-2 has-[>svg]:px-3',
                sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
                lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
                icon: 'size-9',
                'icon-sm': 'size-8',
                'icon-lg': 'size-10'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'default'
        }
    })

    export type ButtonVariant = VariantProps<typeof buttonVariants>['variant']
    export type ButtonSize = VariantProps<typeof buttonVariants>['size']
    export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
        WithElementRef<HTMLAnchorAttributes> & {
            variant?: ButtonVariant
            size?: ButtonSize
            /** Set to false to disable motion animations (vanilla shadcn behavior). */
            animated?: boolean
        }
</script>

<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'

    let {
        class: className,
        variant = 'default',
        size = 'default',
        ref = $bindable(null),
        href = undefined,
        type = 'button',
        disabled,
        animated = true,
        style: styleProp,
        children,
        ...restProps
    }: ButtonProps = $props()

    // Coerce style from string|null|undefined to string|undefined for motion compatibility
    const motionStyle = $derived(styleProp ?? undefined)

    // Spring transition for snappy, natural rebound
    const springTransition = { type: 'spring' as const, stiffness: 400, damping: 25 }

    // Per-variant tap scale
    const getTapScale = () => {
        if (!animated) return undefined
        if (size === 'icon' || size === 'icon-sm' || size === 'icon-lg') {
            return { scale: 0.9 }
        }
        return { scale: 0.97 }
    }

    // Per-variant hover effect
    const getHoverEffect = () => {
        if (!animated) return undefined
        if (size === 'icon' || size === 'icon-sm' || size === 'icon-lg') {
            return { scale: 1.08 }
        }
        if (variant === 'link') {
            return { scale: 1.03 }
        }
        return { y: -1 }
    }
</script>

{#if href}
    {#if animated}
        <motion.a
            bind:ref
            data-slot="button"
            class={cn(buttonVariants({ variant, size }), className)}
            style={motionStyle}
            href={disabled ? undefined : href}
            aria-disabled={disabled}
            role={disabled ? 'link' : undefined}
            tabindex={disabled ? -1 : undefined}
            whileTap={getTapScale()}
            whileHover={getHoverEffect()}
            transition={springTransition}
            {...restProps}
        >
            {@render children?.()}
        </motion.a>
    {:else}
        <a
            bind:this={ref}
            data-slot="button"
            class={cn(buttonVariants({ variant, size }), className)}
            style={styleProp}
            href={disabled ? undefined : href}
            aria-disabled={disabled}
            role={disabled ? 'link' : undefined}
            tabindex={disabled ? -1 : undefined}
            {...restProps}
        >
            {@render children?.()}
        </a>
    {/if}
{:else if animated}
    <motion.button
        bind:ref
        data-slot="button"
        class={cn(buttonVariants({ variant, size }), className)}
        style={motionStyle}
        {type}
        {disabled}
        whileTap={getTapScale()}
        whileHover={getHoverEffect()}
        transition={springTransition}
        {...restProps}
    >
        {@render children?.()}
    </motion.button>
{:else}
    <button
        bind:this={ref}
        data-slot="button"
        class={cn(buttonVariants({ variant, size }), className)}
        style={styleProp}
        {type}
        {disabled}
        {...restProps}
    >
        {@render children?.()}
    </button>
{/if}
