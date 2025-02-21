// Reexport your entry components here
import Div from './html/Div.svelte'

type MotionComponents = {
    div: typeof Div
}

export const motion: MotionComponents = {
    div: Div
}

export type { MotionInitial } from './types.js'
