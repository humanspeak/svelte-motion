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

    it('ignores invalid/unknown tags', () => {
        const code = `<script>
    import { motion } from '@humanspeak/svelte-motion'
</script>

<motion.invalidtag>Hello</motion.invalidtag>`

        const result = transform(code)
        expect(result).toBeNull()
    })

    it('does not transform motion.TAG in HTML text or comments', () => {
        const code = `<script>
    import { motion } from '@humanspeak/svelte-motion'
</script>

<!-- Ported from the motion.dev example -->
<motion.div>Hello</motion.div>
<p>See motion.dev for details</p>`

        const result = transform(code)
        expect(result).not.toBeNull()
        // Template tags are transformed
        expect(result).toContain('<SvelteMotionDiv>Hello</SvelteMotionDiv>')
        // "motion.dev" in comments and text is not a valid tag, so no import generated for "dev"
        expect(result).not.toContain('SvelteMotionDev')
    })

    it('preserves motion.TAG text content when TAG is also used as a real template element', () => {
        // Regression: previously `motion.div` literal text in template/markup
        // was clobbered to `SvelteMotionDiv` because the per-tag script-
        // reference replacement on line 355 was applied to the whole post-
        // import file instead of being scoped to <script> blocks.
        const code = `<script>
    import { motion } from '@humanspeak/svelte-motion'
</script>

<motion.div>
    <span class="label">motion.div</span>
    <p>Use motion.div for animations</p>
</motion.div>`

        const result = transform(code)
        expect(result).not.toBeNull()
        // The real template element is rewritten
        expect(result).toContain('<SvelteMotionDiv>')
        expect(result).toContain('</SvelteMotionDiv>')
        // But the literal text 'motion.div' inside <span> / <p> stays put
        expect(result).toContain('>motion.div</span>')
        expect(result).toContain('Use motion.div for animations')
        // And no stray SvelteMotionDiv text leaked into the markup body
        expect(result).not.toContain('>SvelteMotionDiv<')
        expect(result).not.toContain('Use SvelteMotionDiv for animations')
    })

    it('preserves motion.TAG text content when TAG is also used in a script reference', () => {
        // Same bug with a script-side motion.TAG reference: the const
        // assignment should rewrite, the markup text should not.
        const code = `<script>
    import { motion } from '@humanspeak/svelte-motion'
    const Box = motion.div
</script>

<Box>
    <span>You're looking at a motion.div</span>
</Box>`

        const result = transform(code)
        expect(result).not.toBeNull()
        expect(result).toContain('const Box = SvelteMotionDiv')
        expect(result).toContain("You're looking at a motion.div")
        expect(result).not.toContain("You're looking at a SvelteMotionDiv")
    })

    it('still rewrites motion.TAG references that span multiple lines inside <script>', () => {
        // The fix scopes replacement to <script> blocks; make sure that
        // multi-line script content is still fully covered.
        const code = `<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'

    const A = motion.div
    const B = motion.span
    const list = [motion.div, motion.span, motion.button]
</script>

<A><B>hi</B></A>`

        const result = transform(code)
        expect(result).not.toBeNull()
        expect(result).toContain('const A = SvelteMotionDiv')
        expect(result).toContain('const B = SvelteMotionSpan')
        expect(result).toContain(
            'const list = [SvelteMotionDiv, SvelteMotionSpan, SvelteMotionButton]'
        )
    })

    it('rewrites script member expressions but preserves string literals and comments', () => {
        const code = `<script>
    import { motion } from '@humanspeak/svelte-motion'
    const C = motion.div
    const label = "use motion.div in docs"
    const tpl = \`motion.div in template\`
    // motion.div should stay in comments
    /* motion.div should stay in block comments too */
</script>

<C />`

        const result = transform(code)
        expect(result).not.toBeNull()
        expect(result).toContain('const C = SvelteMotionDiv')
        expect(result).toContain('"use motion.div in docs"')
        expect(result).toContain('`motion.div in template`')
        expect(result).toContain('// motion.div should stay in comments')
        expect(result).toContain('/* motion.div should stay in block comments too */')
    })

    it('preserves literals/comments inside TS scripts (lexer fallback path)', () => {
        // <script lang="ts"> bodies typically fail acorn's JS parser
        // because of TS-only syntax; the lexer fallback must still avoid
        // rewriting string/comment occurrences of motion.div.
        const code = `<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'
    const C: typeof motion.div = motion.div
    const label: string = "use motion.div in docs"
    // motion.div should stay in comments
</script>

<C />`

        const result = transform(code)
        expect(result).not.toBeNull()
        expect(result).toContain('= SvelteMotionDiv')
        expect(result).toContain('"use motion.div in docs"')
        expect(result).toContain('// motion.div should stay in comments')
    })

    it('generates single import for duplicate tag usage', () => {
        const code = `<script>
    import { motion } from '@humanspeak/svelte-motion'
</script>

<motion.div>One</motion.div>
<motion.div>Two</motion.div>`

        const result = transform(code)
        expect(result).not.toBeNull()
        const importMatches = result!.match(/import SvelteMotionDiv/g)
        expect(importMatches).toHaveLength(1)
    })

    it('returns the plugin with correct metadata', () => {
        const plugin = svelteMotionOptimize()
        expect(plugin.name).toBe('svelte-motion-optimize')
        expect(plugin.enforce).toBe('pre')
    })
})
