// Reexport your entry components here
import Button from './html/Button.svelte'
import Div from './html/Div.svelte'
type MotionComponents = {
    div: typeof Div
    button: typeof Button
}

export const motion: MotionComponents = {
    div: Div,
    button: Button
}

export type { MotionInitial } from './types.js'
