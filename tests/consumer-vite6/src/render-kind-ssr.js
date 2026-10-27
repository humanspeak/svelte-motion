import { render } from 'svelte/server'
import Component from './KindSsr.svelte'

export const html = render(Component).body
