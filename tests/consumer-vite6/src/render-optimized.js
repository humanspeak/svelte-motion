import { render } from 'svelte/server'
import Component from './OptimizedImport.svelte'

export const html = render(Component).body
