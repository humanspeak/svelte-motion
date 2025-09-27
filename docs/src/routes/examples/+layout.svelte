<script lang="ts">
    import Header from '$lib/components/general/Header.svelte'
    import Footer from '$lib/components/general/Footer.svelte'
    import { MotionConfig } from '@humanspeak/svelte-motion'

    const { children } = $props()
</script>

<div class="relative flex min-h-screen flex-col bg-background">
    <Header />
    <MotionConfig transition={{ duration: 0.6 }}>
        {@render children?.()}
    </MotionConfig>
    <Footer />
</div>
