<script lang="ts">
    let value = $state('a')

    export function swap(): void {
        value = 'b'
    }
</script>

<span data-testid="view-probe">{value}</span>
