<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'
</script>

<!-- dk-strip: positioning shell — docs-kit's `.dk-ex-body` flex column
     gives its direct child `flex: 1 1 auto`, so this wrapper grows to
     fill the example panel and pushes the footer strip to the bottom of
     the sheet. The motion card then centers within. Stripped from the
     published manifest by `demoManifestPlugin`'s `stripComments` +
     `stripWrappers` so readers see only the lesson code below. -->
<div class="dk-demo-shell">
    <motion.div
        whileHover={{ scale: 1.06, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.25)' }}
        whileTap={{ scale: 0.96 }}
        style={styleString(() => ({
            width: '200px',
            height: '120px',
            borderRadius: 16,
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer'
        }))}
    >
        <span>hover or tap me</span>
        <small style="opacity: 0.75; font-weight: 400;">whileHover={`{{...}}`}</small>
    </motion.div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 240px;
    }
</style>
