<script lang="ts">
    import { getLayoutGroupContext } from '$lib/components/layoutGroup.context'

    const id = getLayoutGroupContext()
</script>

<div data-testid="layout-group-probe" data-id={id ?? 'none'}></div>
