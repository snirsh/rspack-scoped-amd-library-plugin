import { ConcatSource } from 'webpack-sources'
import type { RspackPluginInstance, Compiler as RspackCompiler } from '@rspack/core'

const PLUGIN_NAME = 'ScopedAmdLibraryRspackPlugin'

const getTarget = (compilation: any): string => {
	if (compilation.options.target) {
		const target = Array.isArray(compilation.options.target)
			? compilation.options.target[0]
			: compilation.options.target
		return target.includes('node') ? 'node' : target
	}
	return 'web'
}

const createShadowVariablesString = (scopeArgumentName: string, target: string) => {
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
			throw new Error(`target ${target} not supported by ${PLUGIN_NAME}`)
	}

	return [
		...globalPointers.map((pointer) => `var ${pointer}=${scopeArgumentName};`),
		...globalNamespaces.map(
			(namespace) =>
				`var ${namespace}=(${scopeArgumentName}.${namespace}=${scopeArgumentName}.${namespace}||${scopeArgumentName});`
		),
	].join('')
}

export type ScopedAmdLibraryRspackPluginOptions = {
	scopeDependencyName: string
	requireAsWrapper?: boolean
}

export class ScopedAmdLibraryRspackPlugin implements RspackPluginInstance {
	name = PLUGIN_NAME
	private scopeDependencyName: string
	private requireAsWrapper: boolean

	constructor(options: ScopedAmdLibraryRspackPluginOptions) {
		if (!options?.scopeDependencyName) {
			throw new Error(
				`${PLUGIN_NAME} constructor was called without an option argument with scopeDependencyName property`
			)
		}

		this.scopeDependencyName = options.scopeDependencyName
		this.requireAsWrapper = !!options.requireAsWrapper
	}

	apply(compiler: RspackCompiler) {
		// Ensure AMD library output is configured
		compiler.options.output = compiler.options.output || {}

		if (!compiler.options.output.library) {
			compiler.options.output.library = {
				type: 'amd',
			}
		}

		if (typeof compiler.options.output.library === 'object' && !compiler.options.output.library.type) {
			compiler.options.output.library.type = 'amd'
		}

		// Hook into the compilation process
		compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
			// Use processAssets hook to modify the generated assets
			compilation.hooks.processAssets.tapAsync(
				{
					name: PLUGIN_NAME,
					stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
				},
				(assets, callback) => {
					try {
						const target = getTarget(compilation)

						Object.keys(assets).forEach((assetName) => {
							if (!assetName.endsWith('.js')) return

							const asset = assets[assetName]
							const originalSource = asset.source()

							if (typeof originalSource === 'string') {
								// Check if this looks like an AMD module
								if (originalSource.includes('define(')) {
									const modifiedSource = this.transformAmdModule(originalSource, target)
									assets[assetName] = new ConcatSource(modifiedSource)
								} else if (assetName.includes('bundle.js')) {
									// If it's a main bundle but doesn't have define(), wrap it in AMD format
									// Note: Rspack's aggressive tree-shaking may optimize away unused exports
									const amdWrappedSource = this.wrapInAmdDefine(originalSource, target)
									assets[assetName] = new ConcatSource(amdWrappedSource)
								}
							}
						})

						callback()
					} catch (error) {
						callback(error)
					}
				}
			)
		})
	}

	private transformAmdModule(source: string, target: string): string {
		// Simple approach: find define() calls and inject our scope dependency
		const scopeDependencyArgument = `__SCOPED_AMD_EXTERNAL_MODULE_${this.scopeDependencyName}__`
		const webpackRuntimeShadowVariables = createShadowVariablesString(scopeDependencyArgument, target)

		// Look for define calls with dependencies and function
		// Pattern: define(["dep1", "dep2"], function(dep1, dep2) { ... })
		const defineWithDepsPattern = /define\(\s*(\[[^\]]*\])\s*,\s*function\s*\(([^)]*)\)\s*\{/
		const match = source.match(defineWithDepsPattern)

		if (match) {
			const [fullMatch, depsArrayStr, argsStr] = match

			// Parse the dependencies array
			let depsArray: string[]
			try {
				depsArray = JSON.parse(depsArrayStr)
			} catch {
				// If we can't parse the deps, add our dependency anyway
				depsArray = []
			}

			// Add our scope dependency if not already present
			if (!depsArray.includes(this.scopeDependencyName)) {
				depsArray.push(this.scopeDependencyName)

				// Parse function arguments
				const args = argsStr
					.split(',')
					.map((arg) => arg.trim())
					.filter(Boolean)
				args.push(scopeDependencyArgument)

				// Create the new define call
				const newDepsArray = JSON.stringify(depsArray)
				const newArgs = args.join(', ')
				const newDefine = `define(${newDepsArray}, function(${newArgs}) {\n${webpackRuntimeShadowVariables}\n`

				// Replace the original define
				return source.replace(defineWithDepsPattern, newDefine)
			}
		} else {
			// Handle simpler define patterns: define(function() { ... })
			const simpleFunctionPattern = /define\(\s*function\s*\(\s*\)\s*\{/
			if (simpleFunctionPattern.test(source)) {
				const newDefine = `define([${JSON.stringify(
					this.scopeDependencyName
				)}], function(${scopeDependencyArgument}) {\n${webpackRuntimeShadowVariables}\n`
				return source.replace(simpleFunctionPattern, newDefine)
			}

			// Handle factory pattern: define([], function() { ... })
			const emptyDepsPattern = /define\(\s*\[\s*\]\s*,\s*function\s*\(\s*\)\s*\{/
			if (emptyDepsPattern.test(source)) {
				const newDefine = `define([${JSON.stringify(
					this.scopeDependencyName
				)}], function(${scopeDependencyArgument}) {\n${webpackRuntimeShadowVariables}\n`
				return source.replace(emptyDepsPattern, newDefine)
			}
		}

		// If no patterns matched, return original source
		return source
	}

	private wrapInAmdDefine(source: string, target: string): string {
		const scopeDependencyArgument = `__SCOPED_AMD_EXTERNAL_MODULE_${this.scopeDependencyName}__`
		const webpackRuntimeShadowVariables = createShadowVariablesString(scopeDependencyArgument, target)

		// Get library name from source if possible, or use default
		const libraryName = 'project-name' // This should match webpack's output

		// Clean up the source to ensure proper wrapping
		// Remove trailing semicolons or percent signs that might cause issues
		const cleanSource = source.trim().replace(/[;%]+$/, '')

		// Extract export variables from the source to manually build exports object
		// Look for patterns like: const exportName = someValue
		const exportMatches = cleanSource.match(/const\s+(\w+)\s*=/g) || []
		const exportNames = exportMatches
			.map((match) => {
				const nameMatch = match.match(/const\s+(\w+)\s*=/)
				return nameMatch ? nameMatch[1] : null
			})
			.filter(Boolean)

		// Build the exports object manually
		const exportsBuilder =
			exportNames.length > 0
				? `{ ${exportNames
						.map((name) => `"${name}": typeof ${name} !== 'undefined' ? ${name} : undefined`)
						.join(', ')} }`
				: '{}'

		// Wrap the entire source in AMD define and manually return exports
		return `define("${libraryName}", [${JSON.stringify(
			this.scopeDependencyName
		)}], function(${scopeDependencyArgument}) {
${webpackRuntimeShadowVariables}
${cleanSource};
return typeof __webpack_exports__ !== 'undefined' && Object.keys(__webpack_exports__).length > 0 
	? __webpack_exports__ 
	: ${exportsBuilder};
});`
	}
}
