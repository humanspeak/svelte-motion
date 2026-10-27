import { render } from 'svelte/server'
import Component from './ReorderSsr.svelte'

export const html = render(Component).body
