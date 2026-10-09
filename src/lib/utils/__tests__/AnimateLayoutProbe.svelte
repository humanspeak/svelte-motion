<script lang="ts">
    let expanded = $state(false)

    export function expand(): void {
        expanded = true
    }
</script>

<div data-layout data-testid="layout-probe" data-expanded={expanded}></div>
