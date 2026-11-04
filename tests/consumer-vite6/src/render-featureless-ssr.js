import { render } from 'svelte/server'
import Component from './FeaturelessSsr.svelte'

export const html = render(Component).body
