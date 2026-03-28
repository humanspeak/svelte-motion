import { describe, expect, it } from 'vitest'
import { svelteMotionOptimize } from './vite'

/**
 * Helper to run the Vite plugin transform on a string of code.
 */
const transform = (code: string, id = 'test.svelte'): string | null => {
    const plugin = svelteMotionOptimize()
    const result = (plugin.transform as (code: string, id: string) => { code: string } | null)(
        code,
        id
    )
    return result?.code ?? null
}

describe('svelteMotionOptimize', () => {
    it('returns null for non-svelte files', () => {
        const code = `import { motion } from '@humanspeak/svelte-motion'`
        expect(transform(code, 'test.ts')).toBeNull()
    })

    it('returns null for files in node_modules', () => {
        const code = `<script>import { motion } from '@humanspeak/svelte-motion'</script><motion.div>Hi</motion.div>`
        expect(transform(code, 'node_modules/@humanspeak/docs-kit/dist/Footer.svelte')).toBeNull()
    })

    it('returns null when no svelte-motion import exists', () => {
        const code = `<script>let x = 1</script><div>Hello</div>`
        expect(transform(code, 'test.svelte')).toBeNull()
    })

    it('returns null when motion is imported but no .TAG usage found', () => {
        const code = `<script>import { animate } from '@humanspeak/svelte-motion'</script>`
        expect(transform(code, 'test.svelte')).toBeNull()
    })

    it('transforms a simple motion.div usage', () => {
        const code = `<script>
    import { motion } from '@humanspeak/svelte-motion'
</script>

<motion.div animate={{ opacity: 1 }}>Hello</motion.div>`

        const result = transform(code)
        expect(result).not.toBeNull()
        expect(result).toContain(
            "import SvelteMotionDiv from '@humanspeak/svelte-motion/html/Div.svelte'"
        )
        expect(result).toContain(
            '<SvelteMotionDiv animate={{ opacity: 1 }}>Hello</SvelteMotionDiv>'
        )
        expect(result).not.toContain('motion.div')
        expect(result).not.toContain('import { motion }')
    })

    it('transforms multiple different motion elements', () => {
        const code = `<script>
    import { motion } from '@humanspeak/svelte-motion'
</script>

<motion.div>
    <motion.span>text</motion.span>
    <motion.button onclick={handleClick}>Click</motion.button>
</motion.div>`

        const result = transform(code)
        expect(result).not.toBeNull()
        expect(result).toContain(
            "import SvelteMotionDiv from '@humanspeak/svelte-motion/html/Div.svelte'"
        )
        expect(result).toContain(
            "import SvelteMotionSpan from '@humanspeak/svelte-motion/html/Span.svelte'"
        )
        expect(result).toContain(
            "import SvelteMotionButton from '@humanspeak/svelte-motion/html/Button.svelte'"
        )
        expect(result).toContain('<SvelteMotionDiv>')
        expect(result).toContain('<SvelteMotionSpan>text</SvelteMotionSpan>')
        expect(result).toContain(
            '<SvelteMotionButton onclick={handleClick}>Click</SvelteMotionButton>'
        )
    })

    it('preserves other named imports from svelte-motion', () => {
        const code = `<script>
    import { motion, animate, useSpring } from '@humanspeak/svelte-motion'
</script>

<motion.div animate={{ opacity: 1 }}>Hello</motion.div>`

        const result = transform(code)
        expect(result).not.toBeNull()
        expect(result).toContain("import { animate, useSpring } from '@humanspeak/svelte-motion'")
        expect(result).toContain(
            "import SvelteMotionDiv from '@humanspeak/svelte-motion/html/Div.svelte'"
        )
    })

    it('transforms self-closing motion elements', () => {
        const code = `<script>
    import { motion } from '@humanspeak/svelte-motion'
</script>

<motion.hr />
<motion.img />`

        const result = transform(code)
        expect(result).not.toBeNull()
        expect(result).toContain('<SvelteMotionHr />')
        expect(result).toContain('<SvelteMotionImg />')
    })

    it('handles motion.TAG in script expressions', () => {
        const code = `<script>
    import { motion } from '@humanspeak/svelte-motion'
    const Component = motion.div
</script>

<Component animate={{ opacity: 1 }}>Hello</Component>`

        const result = transform(code)
        expect(result).not.toBeNull()
        expect(result).toContain('const Component = SvelteMotionDiv')
    })

    it('keeps motion import when motion is used as a bare reference', () => {
        const code = `<script>
    import { motion } from '@humanspeak/svelte-motion'
    const allMotion = motion
</script>

<motion.div>Hello</motion.div>`

        const result = transform(code)
        expect(result).not.toBeNull()
        // motion is still used as a value, so keep the import
        expect(result).toContain("import { motion } from '@humanspeak/svelte-motion'")
        // But also add the individual import
        expect(result).toContain(
            "import SvelteMotionDiv from '@humanspeak/svelte-motion/html/Div.svelte'"
        )
    })

    it('handles SVG elements', () => {
        const code = `<script>
    import { motion } from '@humanspeak/svelte-motion'
</script>

<motion.svg>
    <motion.circle cx="50" cy="50" r="40" />
    <motion.path d="M 0 0 L 100 100" />
</motion.svg>`

        const result = transform(code)
        expect(result).not.toBeNull()
        expect(result).toContain(
            "import SvelteMotionSvg from '@humanspeak/svelte-motion/html/Svg.svelte'"
        )
        expect(result).toContain(
            "import SvelteMotionCircle from '@humanspeak/svelte-motion/html/Circle.svelte'"
        )
        expect(result).toContain(
            "import SvelteMotionPath from '@humanspeak/svelte-motion/html/Path.svelte'"
        )
    })

    it('returns the plugin with correct metadata', () => {
        const plugin = svelteMotionOptimize()
        expect(plugin.name).toBe('svelte-motion-optimize')
        expect(plugin.enforce).toBe('pre')
    })
})
