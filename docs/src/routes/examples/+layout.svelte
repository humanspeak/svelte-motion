<script lang="ts">
    import Header from '$lib/components/general/Header.svelte'
    import Footer from '$lib/components/general/Footer.svelte'

    const { children } = $props()
</script>

<div class="relative flex min-h-screen flex-col bg-background">
    <Header />
    {@render children?.()}
    <Footer />
</div>
