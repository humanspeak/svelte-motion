<script lang="ts">
    import { AnimatePresence, LayoutGroup, motion, styleString } from '@humanspeak/svelte-motion'

    // Two sibling tab strips share `layoutId="underline"`. Each is
    // wrapped in its own `<LayoutGroup id>` so the underline animation
    // stays scoped — clicking on the right strip doesn't pull the
    // underline from the left strip across the page. Remove the
    // LayoutGroups and the underline will jump between strips on click.

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

<!-- HUMANSPEAK: docs-kit positioning shell — stripped from the published code. -->
<div class="humanspeak-demo-shell">
    <div
        style={styleString(() => ({
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2.5rem',
            padding: '1.5rem',
            background: 'var(--color-background-secondary)',
            borderRadius: 8,
            width: '100%',
            maxWidth: '720px'
        }))}
    >
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
</div>

<style>
    .humanspeak-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 280px;
    }
</style>
