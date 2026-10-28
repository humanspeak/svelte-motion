import { render } from 'svelte/server'
import Component from './TapSsr.svelte'

export const html = render(Component).body
