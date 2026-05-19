<script lang="ts">
    import { AnimatePresence, LayoutGroup, motion, styleString } from '@humanspeak/svelte-motion'

    // Live demo of <LayoutGroup>. Two tab strips share `layoutId="underline"`.
    // Each strip is wrapped in its own <LayoutGroup id>, so clicking on the
    // right strip does NOT pull the underline from the left strip across
    // the page — the registry key becomes `strip-a::underline` vs
    // `strip-b::underline`, keeping each animation scoped.
    //
    // Remove the two <LayoutGroup> wrappers and the underline will jump
    // between strips when either is clicked — proving the prop's effect.

    let selectedA = $state(0)
    let selectedB = $state(0)

    const tabs = [0, 1, 2] as const

    const underlineStyle = styleString(() => ({
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: 'var(--color-brand-500, royalblue)',
        borderRadius: 2
    }))
</script>

<div
    style={styleString(() => ({
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.5rem',
        background: 'var(--color-background-secondary)',
        borderRadius: 8
    }))}
>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem;">
        <article>
            <header style="margin-bottom: 0.5rem;">
                <strong style="font-size: 0.85rem;">Group A</strong>
            </header>
            <LayoutGroup id="strip-a">
                <div
                    style={styleString(() => ({
                        display: 'flex',
                        gap: 4,
                        justifyContent: 'center',
                        border: '1px dashed var(--color-border, #ccc)',
                        padding: '1rem',
                        borderRadius: 8
                    }))}
                >
                    {#each tabs as id (id)}
                        <button
                            type="button"
                            onclick={() => (selectedA = id)}
                            style={styleString(() => ({
                                position: 'relative',
                                padding: '0.5rem 1.25rem',
                                border: 'none',
                                background: 'transparent',
                                fontWeight: 500,
                                cursor: 'pointer'
                            }))}
                        >
                            Tab {id}
                            <AnimatePresence>
                                {#if selectedA === id}
                                    <motion.div
                                        key="underline"
                                        layoutId="underline"
                                        style={underlineStyle}
                                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                                    ></motion.div>
                                {/if}
                            </AnimatePresence>
                        </button>
                    {/each}
                </div>
            </LayoutGroup>
        </article>

        <article>
            <header style="margin-bottom: 0.5rem;">
                <strong style="font-size: 0.85rem;">Group B</strong>
            </header>
            <LayoutGroup id="strip-b">
                <div
                    style={styleString(() => ({
                        display: 'flex',
                        gap: 4,
                        justifyContent: 'center',
                        border: '1px dashed var(--color-border, #ccc)',
                        padding: '1rem',
                        borderRadius: 8
                    }))}
                >
                    {#each tabs as id (id)}
                        <button
                            type="button"
                            onclick={() => (selectedB = id)}
                            style={styleString(() => ({
                                position: 'relative',
                                padding: '0.5rem 1.25rem',
                                border: 'none',
                                background: 'transparent',
                                fontWeight: 500,
                                cursor: 'pointer'
                            }))}
                        >
                            Tab {id}
                            <AnimatePresence>
                                {#if selectedB === id}
                                    <motion.div
                                        key="underline"
                                        layoutId="underline"
                                        style={underlineStyle}
                                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                                    ></motion.div>
                                {/if}
                            </AnimatePresence>
                        </button>
                    {/each}
                </div>
            </LayoutGroup>
        </article>
    </div>

    <p
        style={styleString(() => ({
            margin: 0,
            fontSize: '0.82rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.55
        }))}
    >
        Both strips share the same <code>layoutId="underline"</code>. Without
        <code>&lt;LayoutGroup&gt;</code> wrapping each strip, clicking a tab on the right would pull
        the underline from the left strip across the page. The group's id (<code>strip-a</code>,
        <code>strip-b</code>) prefixes the layout-id key, keeping each animation scoped.
    </p>
</div>
