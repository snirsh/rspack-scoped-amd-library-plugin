import type { ScopedAmdLibraryPluginOptions } from './types'
import type { Compilation } from 'webpack'
import type { Compiler as RspackCompiler } from '@rspack/core'

export const LIBRARY_TYPE = 'scoped-amd'

export const getTarget = (compilation: Compilation | RspackCompiler): string => {
	if (compilation.options.target) {
		const target = Array.isArray(compilation.options.target)
			? compilation.options.target[0]
			: compilation.options.target
		return target.includes('node') ? 'node' : target
	}

	return compilation.options.loader?.target || 'web'
}

export const createShadowVariablesString = (scopeArgumentName: string, target: string) => {
	let globalPointers: Array<string> = []
	let globalNamespaces: Array<string> = []

	switch (target) {
		case 'web':
			globalPointers = ['globalThis', 'window']
			globalNamespaces = ['document']
			break
		case 'webworker':
			globalPointers = ['globalThis']
			globalNamespaces = ['importScripts', 'location']
			break
		case 'node':
			globalNamespaces = ['require']
			break
		default:
			throw new Error(`target ${target} not supported by ScopedAmdLibraryPlugin`)
	}

	// Don't create webpack runtime shadows for now since we're not replacing the calls
	const webpackRuntimeShadows: string[] = [
		// Removed webpack runtime shadowing temporarily
	]

	// Target-specific webpack runtime overrides
	const targetSpecificShadows: string[] = []
	switch (target) {
		case 'web':
			targetSpecificShadows.push(
				`var __scoped_createElement = function(tag) { return ${scopeArgumentName}.document.createElement(tag); };`,
				`var __scoped_head_appendChild = function(element) { return ${scopeArgumentName}.document.head.appendChild(element); };`
			)
			break
		case 'webworker':
			targetSpecificShadows.push(
				`var __scoped_importScripts = function() { return ${scopeArgumentName}.importScripts.apply(${scopeArgumentName}, arguments); };`
			)
			break
		case 'node':
			targetSpecificShadows.push(
				`var __scoped_require = function(id) { return ${scopeArgumentName}.require(id); };`
			)
			break
	}

	return [
		...globalPointers.map((pointer) => `var ${pointer}=${scopeArgumentName};`),
		...globalNamespaces.map(
			(namespace) =>
				`var ${namespace}=(${scopeArgumentName}.${namespace}=${scopeArgumentName}.${namespace}||${scopeArgumentName});`
		),
		...webpackRuntimeShadows,
		...targetSpecificShadows,
	].join('')
}

export const validateOptions = (options: ScopedAmdLibraryPluginOptions, pluginName: string) => {
	if (!options?.scopeDependencyName) {
		throw new Error(
			`${pluginName} constructor was called without an option argument with scopeDependencyName property`
		)
	}
}
