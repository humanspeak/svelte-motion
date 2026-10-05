<script lang="ts">
    import { motionValue } from 'motion-dom'
    import MotionBr from '../Br.svelte'
    import MotionSpan from '../Span.svelte'
    import MotionText from '../Text.svelte'

    let { appear = false } = $props<{ appear?: boolean }>()
    const value = motionValue('value')
    const space = ' '
    const paddedWord = ' a '
    const gap = '  '
    const newline = '\n'
    const animation = $derived(
        appear
            ? { initial: { opacity: 0.2 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
            : {}
    )
</script>

<div data-testid="single"><MotionSpan {...animation}>a</MotionSpan></div>
<div data-testid="adjacent">
    <MotionSpan {...animation}>a</MotionSpan><MotionSpan {...animation}>b</MotionSpan>
</div>
<div data-testid="graphemes">
    <MotionSpan {...animation}>👩‍💻</MotionSpan>{space}<MotionSpan {...animation}>é</MotionSpan>
</div>
<div data-testid="authored">
    <MotionSpan {...animation}>{paddedWord}</MotionSpan>{gap}<MotionSpan {...animation}
        >b</MotionSpan
    >{newline}
</div>
<div data-testid="value"><MotionSpan {...animation} children={value} /></div>
<svg><g data-testid="svg"><MotionText {...animation}>svg</MotionText></g></svg>
<div data-testid="void"><MotionBr {...animation} /></div>
<button onclick={() => value.set('updated')}>Update value</button>
