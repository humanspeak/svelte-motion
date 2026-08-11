import { render } from 'svelte/server'
import Component from './RootImport.svelte'

export const html = render(Component).body
