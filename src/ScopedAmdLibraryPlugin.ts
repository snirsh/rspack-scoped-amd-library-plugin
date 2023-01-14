import { ConcatSource } from 'webpack-sources'
import ExternalModule from 'webpack/lib/ExternalModule'
import Template from 'webpack/lib/Template'
import AbstractLibraryPlugin, { LibraryContext } from 'webpack/lib/library/AbstractLibraryPlugin'
import EnableLibraryPlugin from 'webpack/lib/library/EnableLibraryPlugin'
import LoadScriptRuntimeModule from 'webpack/lib/runtime/LoadScriptRuntimeModule'
import RequireChunkLoadingRuntimeModule from 'webpack/lib/node/RequireChunkLoadingRuntimeModule'
import ImportScriptsChunkLoadingRuntimeModule from 'webpack/lib/webworker/ImportScriptsChunkLoadingRuntimeModule'
import ExportPropertyTemplatePlugin from 'webpack/lib/library/ExportPropertyLibraryPlugin'

import type { LibraryOptions, Compiler, Compilation } from 'webpack'
import type { Source } from 'webpack-sources'
import type { RenderContext } from 'webpack/lib/javascript/JavascriptModulesPlugin'
import type { Hash } from 'webpack/lib/util/Hash'
import type { Chunk } from 'webpack/lib/library/Chunk'

const PLUGIN_NAME = 'ScopedAmdLibraryPlugin'
const LIBRARY_TYPE = 'scoped-amd'

const getTarget = (compilation: Compilation): string => {
	if (compilation.options.target) {
		const target = Array.isArray(compilation.options.target)
			? compilation.options.target[0]
			: compilation.options.target
		return target.includes('node') ? 'node' : target
	}

	return compilation.options.loader?.target || 'web'
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
			throw new Error(`target ${target} not suppoerted by ${PLUGIN_NAME}`)
	}

	return [
		...globalPointers.map((pointer) => `const ${pointer}=${scopeArgumentName};`),
		...globalNamespaces.map(
			(namespace) =>
				`const ${namespace}=(${scopeArgumentName}.${namespace}=${scopeArgumentName}.${namespace}||${scopeArgumentName});`
		),
	].join('')
}

export type ScopedAmdLibraryPluginOptions = {
	scopeDependencyName: string
	requireAsWrapper?: boolean
}

export class ScopedAmdLibraryPlugin extends AbstractLibraryPlugin {
	constructor(options: ScopedAmdLibraryPluginOptions) {
		super({
			pluginName: PLUGIN_NAME,
			type: LIBRARY_TYPE,
		})

		if (!options?.scopeDependencyName) {
			throw new Error(
				`${PLUGIN_NAME} constructor was called without an option argument with scopeDependencyName property`
			)
		}

		this.scopeDependencyName = options.scopeDependencyName
		this.requireAsWrapper = !!options.requireAsWrapper
	}

	parseOptions(library: LibraryOptions) {
		const { name } = library
		if (this.requireAsWrapper) {
			if (name) {
				throw new Error(`AMD library name must be unset. ${AbstractLibraryPlugin.COMMON_LIBRARY_NAME_MESSAGE}`)
			}
		} else {
			if (name && typeof name !== 'string') {
				throw new Error(
					`AMD library name must be a simple string or unset. ${AbstractLibraryPlugin.COMMON_LIBRARY_NAME_MESSAGE}`
				)
			}
		}
		return {
			name,
		}
	}

	apply(compiler: Compiler) {
		EnableLibraryPlugin.setEnabled(compiler, LIBRARY_TYPE)
		// apply ExportPropertyTemplatePlugin plugin, just like what will happen if library type would be "amd"
		// https://github.com/webpack/webpack/blob/main/lib/library/EnableLibraryPlugin.js#L195
		new ExportPropertyTemplatePlugin({
			type: LIBRARY_TYPE,
			nsObjectUsed: true,
		}).apply(compiler)
		super.apply(compiler)
	}

	render(
		source: Source,
		{ chunkGraph, chunk, runtimeTemplate }: typeof RenderContext,
		{ options, compilation }: typeof LibraryContext
	) {
		const modern = runtimeTemplate.supportsArrowFunction()
		const chunkModules = chunkGraph.getChunkModules(chunk)
		const modules = chunkModules.filter((m: unknown) => m instanceof ExternalModule)

		const target = getTarget(compilation)

		const shouldShadowWebpackRuntimeGlobals = !!chunkModules.find((m: unknown) => {
			return (
				m instanceof LoadScriptRuntimeModule ||
				m instanceof RequireChunkLoadingRuntimeModule ||
				m instanceof ImportScriptsChunkLoadingRuntimeModule
			)
		})

		const externals = /** @type {ExternalModule[]} */ modules

		const externalsDeps = externals.map((m: any) =>
			typeof m.request === 'object' && !Array.isArray(m.request) ? m.request.amd : m.request
		)

		const externalsArgumentsArray = externals.map(
			(m: any) => `__WEBPACK_EXTERNAL_MODULE_${Template.toIdentifier(`${chunkGraph.getModuleId(m)}`)}__`
		)

		if (externalsDeps.length > 0 && compilation.options.externalsType !== 'amd') {
			// if not set to amd, ExternalsPlugin does not properly collect dependency by its argument name
			throw new Error(
				`"externalsType" configuration must be set to "amd" when using ${PLUGIN_NAME}\nFor more info refer to the documentation https://webpack.js.org/configuration/externals/#externalstype`
			)
		}

		let webpackRuntimeShadowVariables = ''
		if (shouldShadowWebpackRuntimeGlobals) {
			// if scopeDependencyName dependency already in externalDeps reuse it
			if (externalsDeps.includes(this.scopeDependencyName)) {
				const scopeDependencyArgument = externalsArgumentsArray[externalsDeps.indexOf(this.scopeDependencyName)]
				webpackRuntimeShadowVariables = createShadowVariablesString(scopeDependencyArgument, target)
			} else {
				const scopeDependencyArgument = `__SCOPED_AMD_EXTERNAL_MODULE_${this.scopeDependencyName}__`

				// add module dependency
				externalsDeps.push(this.scopeDependencyName)
				externalsArgumentsArray.push(scopeDependencyArgument)
				webpackRuntimeShadowVariables = createShadowVariablesString(scopeDependencyArgument, target)
			}
		}

		const externalsDepsArray = JSON.stringify(externalsDeps)
		const externalsArguments = externalsArgumentsArray.join(', ')

		const iife = runtimeTemplate.isIIFE()
		const fnStart =
			(modern ? `(${externalsArguments}) => {` : `function(${externalsArguments}) {`) +
			(webpackRuntimeShadowVariables ? `\n${webpackRuntimeShadowVariables}\n` : '') +
			(iife || !chunk.hasRuntime() ? ' return ' : '\n')
		const fnEnd = iife ? ';\n}' : '\n}'

		if (this.requireAsWrapper) {
			return new ConcatSource(`require(${externalsDepsArray}, ${fnStart}`, source, `${fnEnd});`)
		} else if (options.name) {
			const name = compilation.getPath(options.name, {
				chunk,
			})

			return new ConcatSource(
				`define(${JSON.stringify(name)}, ${externalsDepsArray}, ${fnStart}`,
				source,
				`${fnEnd});`
			)
		} else if (externalsArguments) {
			return new ConcatSource(`define(${externalsDepsArray}, ${fnStart}`, source, `${fnEnd});`)
		} else {
			return new ConcatSource(`define(${fnStart}`, source, `${fnEnd});`)
		}
	}

	chunkHash(
		chunk: typeof Chunk,
		hash: typeof Hash,
		chunkHashContext: unknown,
		{ options, compilation }: typeof LibraryContext
	): void {
		hash.update(PLUGIN_NAME)
		if (this.requireAsWrapper) {
			hash.update('requireAsWrapper')
		} else if (options.name) {
			hash.update('named')
			const name = compilation.getPath(options.name, {
				chunk,
			})
			hash.update(name)
		}
	}
}
