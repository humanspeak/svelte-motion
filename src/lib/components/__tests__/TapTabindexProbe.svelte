<script lang="ts">
    import { LazyMotion, domMin, m } from '$lib'

    const noop = () => {}
</script>

<LazyMotion features={domMin}>
    <m.div data-testid="on-tap" onTap={noop}>on tap</m.div>
    <m.div data-testid="on-tap-start" onTapStart={noop}>on tap start</m.div>
    <m.div data-testid="on-tap-cancel" onTapCancel={noop}>on tap cancel</m.div>
    <m.div data-testid="tap-label" whileTap="missing">tap label</m.div>
    <m.button data-testid="tap-button" whileTap={{ scale: 0.9 }}>tap button</m.button>
    <m.div data-testid="tap-explicit" whileTap={{ scale: 0.9 }} tabindex={-1}>tap explicit</m.div>
</LazyMotion>
