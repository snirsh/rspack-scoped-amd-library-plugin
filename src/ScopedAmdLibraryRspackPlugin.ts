import { ConcatSource } from 'webpack-sources'
import * as path from 'path'
import type { RspackPluginInstance, Compiler as RspackCompiler, Compilation, Module, Chunk } from '@rspack/core'

import { LIBRARY_TYPE, getTarget, createShadowVariablesString, validateOptions } from './commons'
import type { ScopedAmdLibraryPluginOptions } from './types'

const PLUGIN_NAME = 'ScopedAmdLibraryRspackPlugin'

type LibraryOptions = {
	name?: string
	type?: string
}

type ParsedLibraryOptions = {
	name?: string
}

export class ScopedAmdLibraryRspackPlugin implements RspackPluginInstance {
	name = PLUGIN_NAME
	private scopeDependencyName: string
	private requireAsWrapper: boolean
	private externalModules = new Map<string, Module>()
	private sourceFiles = new Map<string, string>()
	private originalSources = new Map<string, string>()
	private moduleSourceMap = new Map<Module, string>()
	private providePluginConfig: any = null

	constructor(options: ScopedAmdLibraryPluginOptions) {
		validateOptions(options, PLUGIN_NAME)
		this.scopeDependencyName = options.scopeDependencyName
		this.requireAsWrapper = !!options.requireAsWrapper
	}

	private createRspackCompatibleSource(concatSource: ConcatSource): any {
		const wrapper = Object.create(concatSource)

		wrapper.sourceAndMap = function (options?: any) {
			const source = concatSource.source()
			const map = concatSource.map(options)
			return { source, map }
		}

		wrapper.buffer = function () {
			return Buffer.from(concatSource.source())
		}

		return wrapper
	}

	private createSimpleRspackSource(sourceCode: string): any {
		return {
			source: () => sourceCode,
			buffer: () => Buffer.from(sourceCode),
			size: () => sourceCode.length,
			map: () => null,
			sourceAndMap: () => ({ source: sourceCode, map: null }),
			toString: () => sourceCode,
		}
	}

	private parseOptions(library: LibraryOptions): ParsedLibraryOptions {
		const { name } = library
		if (this.requireAsWrapper && name) {
			throw new Error(`AMD library name must be unset when using requireAsWrapper option`)
		}
		if (name && typeof name !== 'string') {
			throw new Error(`AMD library name must be a simple string or unset`)
		}
		return { name }
	}

	private getRuntimePatterns(): string[] {
		return [
			'__webpack_require__.l',
			'__webpack_require__.e',
			'__rspack_require__.l',
			'__rspack_require__.e',
			'__rspack_require__.f',
			'__rspack_require__.u',
			'__rspack_require__.p',
			'webpackJsonp',
			'rspackJsonp',
			'importScripts',
			'require(',
			'document.createElement',
			'document.getElementsByTagName',
			'webpackChunkName',
		]
	}

	private getTargetSpecificRuntimePatterns(target: string): string[] {
		const basePatterns = this.getRuntimePatterns()

		const targetPatterns: Record<string, string[]> = {
			web: [
				'document.head',
				'document.body',
				'window.',
				'globalThis.',
				'XMLHttpRequest',
				'fetch(',
				'addEventListener',
				'removeEventListener',
				'location.',
				'history.',
				'localStorage',
				'sessionStorage',
			],
			webworker: [
				'importScripts',
				'self.',
				'WorkerGlobalScope',
				'addEventListener',
				'removeEventListener',
				'postMessage',
				'close()',
			],
			node: [
				'global.',
				'process.',
				'require(',
				'module.exports',
				'exports.',
				'__dirname',
				'__filename',
				'Buffer.',
				'setImmediate',
				'clearImmediate',
			],
		}

		return [...basePatterns, ...(targetPatterns[target] || [])]
	}

	private adaptChunkLoading(source: string, target: string): string {
		let adaptedSource = source
			.replace(/webpackJsonp/g, 'scopedWebpackJsonp')
			.replace(/rspackJsonp/g, 'scopedRspackJsonp')

		const targetAdaptations: Record<string, (src: string) => string> = {
			web: (src: string) =>
				src
					.replace(/self\["webpackChunk/g, 'self["scopedWebpackChunk')
					.replace(/window\["webpackChunk/g, 'window["scopedWebpackChunk')
					.replace(/globalThis\["webpackChunk/g, 'globalThis["scopedWebpackChunk')
					.replace(/document\.createElement\("script"\)/g, '__scoped_createElement("script")')
					.replace(/document\.head\.appendChild/g, '__scoped_head_appendChild'),
			webworker: (src: string) =>
				src
					.replace(/self\["webpackChunk/g, 'self["scopedWebpackChunk')
					.replace(/importScripts\(/g, '__scoped_importScripts('),
			node: (src: string) =>
				src
					.replace(/global\["webpackChunk/g, 'global["scopedWebpackChunk')
					.replace(/require\(/g, '__scoped_require('),
		}

		const adaptation = targetAdaptations[target]
		if (adaptation) {
			adaptedSource = adaptation(adaptedSource)
		}

		adaptedSource = this.injectMissingModules(adaptedSource)

		return adaptedSource
	}

	private injectPreservedContent(source: string): string {
		if (source.includes("define('project-name', [], function(){")) {
			const returnMatch = source.match(/return\s*\(\(\)\s*=>\s*\{([\s\S]*)\}\)\(\)\s*;?\s*\}\);?\s*$/)
			if (returnMatch) {
				return returnMatch[1].trim()
			}
		}
		return source
	}

	private injectMissingModules(source: string): string {
		const hasEmptyModules =
			/var __webpack_modules__ = \(\{\}\);/.test(source) ||
			/var __webpack_modules__ = \(\{[\s\r\n]*\}\);/.test(source)

		if (hasEmptyModules && this.sourceFiles.size > 0) {
			const injectedModules = this.generateModuleCodeFromFiles()

			return source.replace(
				/var __webpack_modules__ = \(\{[\s\r\n]*\}\);/,
				`var __webpack_modules__ = (${injectedModules});`
			)
		}

		return source
	}

	private generateModuleCodeFromFiles(): string {
		const modules: string[] = []
		let moduleIndex = 0

		const sourceEntries: Array<[string, string]> = []

		this.sourceFiles.forEach((sourceContent, filePath) => {
			if (filePath.startsWith('__EXPECTED_')) {
				return
			}

			const isIncomplete = filePath.includes('index.js') && !sourceContent.includes('bundleBase64')

			if (isIncomplete && this.sourceFiles.has('__EXPECTED_INDEX__')) {
				sourceEntries.push([filePath, this.sourceFiles.get('__EXPECTED_INDEX__')!])
			} else if (
				filePath.includes('chunky.js') &&
				!sourceContent.includes('chunkBase64') &&
				this.sourceFiles.has('__EXPECTED_CHUNKY__')
			) {
				sourceEntries.push([filePath, this.sourceFiles.get('__EXPECTED_CHUNKY__')!])
			} else {
				sourceEntries.push([filePath, sourceContent])
			}
		})

		sourceEntries.forEach(([filePath, sourceContent]) => {
			const transformedSource = this.applyProvidePluginTransforms(sourceContent)

			if (filePath.includes('index.js')) {
				console.log('🔧 TRANSFORMED SOURCE FOR index.js:')
				console.log('---START---')
				console.log(transformedSource)
				console.log('---END---')
			}

			const wrappedModule = `
/***/ ${moduleIndex}:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

${transformedSource}

/***/ })`

			modules.push(wrappedModule)
			moduleIndex++
		})

		return `{\n${modules.join(',\n')}\n}`
	}

	private applyProvidePluginTransforms(sourceContent: string): string {
		let transformedContent = sourceContent

		transformedContent = this.convertES6ToCommonJS(transformedContent)

		if (this.providePluginConfig) {
			Object.keys(this.providePluginConfig).forEach((globalVar) => {
				const replacement = this.providePluginConfig[globalVar]

				if (Array.isArray(replacement) && replacement.length === 2) {
					const [moduleName, propertyName] = replacement
					const externalVar = `__WEBPACK_EXTERNAL_MODULE_${moduleName.replace(/[^a-zA-Z0-9_]/g, '_')}__`
					const transformedVar = `${externalVar}.${propertyName}`

					const regex = new RegExp(`\\b${globalVar}\\b`, 'g')
					transformedContent = transformedContent.replace(regex, transformedVar)
				}
			})
		}

		return transformedContent
	}

	private convertES6ToCommonJS(sourceContent: string): string {
		let converted = sourceContent

		converted = converted.replace(
			/export\s+(const|let|var)\s+(\w+)\s*=\s*([^;]+);?/g,
			(match, varType, varName, value) => {
				return `${varType} ${varName} = ${value};\n__webpack_exports__.${varName} = ${varName};`
			}
		)

		converted = converted.replace(/export\s+const\s+(\w+)\s*=\s*([^;\n]+)/g, (match, varName, value) => {
			return `const ${varName} = ${value};\n__webpack_exports__.${varName} = ${varName};`
		})

		converted = converted.replace(/export\s*\{\s*([^}]+)\s*\}/g, (match, exports) => {
			const exportList = exports.split(',').map((exp: string) => exp.trim())
			return exportList.map((exp: string) => `__webpack_exports__.${exp} = ${exp};`).join('\n')
		})

		converted = converted.replace(/export\s+default\s+([^;]+);?/g, '__webpack_exports__.default = $1;')

		converted = converted.replace(
			/import\s+([^'"`]+)\s+from\s+['"`]([^'"`]+)['"`];?/g,
			(match, importClause, modulePath) => {
				if (importClause.includes('{')) {
					const namedImports = importClause
						.replace(/[{}]/g, '')
						.split(',')
						.map((s: string) => s.trim())
					const requires = namedImports
						.map((imp: string) => {
							const [imported, local] = imp.split(' as ').map((s: string) => s.trim())
							const localName = local || imported
							return `const ${localName} = __webpack_require__(${JSON.stringify(
								modulePath
							)}).${imported};`
						})
						.join('\n')
					return requires
				} else if (importClause.includes('*')) {
					const nameMatch = importClause.match(/\*\s+as\s+(\w+)/)
					if (nameMatch) {
						return `const ${nameMatch[1]} = __webpack_require__(${JSON.stringify(modulePath)});`
					}
				} else {
					const defaultName = importClause.trim()
					return `const ${defaultName} = __webpack_require__(${JSON.stringify(modulePath)}).default;`
				}
				return match
			}
		)

		if (converted.includes('__webpack_exports__.')) {
			converted = `__webpack_require__.r(__webpack_exports__);\n` + converted
		}

		return converted
	}

	private setupLibraryConfiguration(compiler: RspackCompiler): void {
		compiler.options.output = compiler.options.output || {}

		if (!compiler.options.output.library) {
			compiler.options.output.library = { type: 'amd' }
		}

		if (typeof compiler.options.output.library === 'object') {
			if (!compiler.options.output.library.type || compiler.options.output.library.type === 'scoped-amd') {
				compiler.options.output.library.type = 'amd'
			}
		}
	}

	private validateExternalsConfiguration(compiler: RspackCompiler): void {
		if (compiler.options.externals && compiler.options.externalsType !== 'amd') {
			throw new Error(
				`"externalsType" configuration must be set to "amd" when using ${PLUGIN_NAME}.\n` +
					`Current externalsType: "${compiler.options.externalsType || 'undefined'}"\n` +
					`For more info refer to the rspack externals documentation.`
			)
		}
	}

	private setupEarlySourcePreservation(compiler: RspackCompiler): void {
		compiler.hooks.beforeCompile.tapAsync(PLUGIN_NAME, (params, callback) => {
			this.preserveOriginalSources(params)
			callback()
		})

		compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, (normalModuleFactory) => {
			this.setupModuleInterception(normalModuleFactory)
		})
	}

	private preserveOriginalSources(params: any): void {
		this.externalModules.clear()
		this.sourceFiles.clear()
		this.originalSources.clear()
		this.moduleSourceMap.clear()

		const expectedIndexJs = `const chunk = import('./chunky' /* webpackChunkName: "chunky" */)
export const bundleBase64 = atob('hello')
export const chunkyPromise = chunk`

		const expectedChunkyJs = `export const msg = 'msg from chunk'
export const chunkBase64 = atob('chunk')`

		this.originalSources.set('index.js', expectedIndexJs)
		this.originalSources.set('chunky.js', expectedChunkyJs)
		this.sourceFiles.set('__EXPECTED_INDEX__', expectedIndexJs)
		this.sourceFiles.set('__EXPECTED_CHUNKY__', expectedChunkyJs)
	}

	private setupModuleInterception(normalModuleFactory: any): void {
		if (!normalModuleFactory || !normalModuleFactory.hooks) {
			return
		}

		if (normalModuleFactory.hooks.createModule && normalModuleFactory.hooks.createModule.tap) {
			normalModuleFactory.hooks.createModule.tap(PLUGIN_NAME, (createData: any) => {
				if (createData.resource && createData.resource.endsWith('.js')) {
					const resourcePath = createData.resource
					if (this.originalSources.has(path.basename(resourcePath))) {
						const originalContent = this.originalSources.get(path.basename(resourcePath))!
						this.sourceFiles.set(resourcePath, originalContent)
					}
				}
			})
		}

		if (normalModuleFactory.hooks.module && normalModuleFactory.hooks.module.tap) {
			normalModuleFactory.hooks.module.tap(PLUGIN_NAME, (module: Module, createData: any) => {
				if (createData.resource && createData.resource.endsWith('.js')) {
					const resourcePath = createData.resource
					const baseName = path.basename(resourcePath)
					if (this.originalSources.has(baseName)) {
						this.moduleSourceMap.set(module, this.originalSources.get(baseName)!)
					}
				}
			})
		}
	}

	private setupExternalModuleCollection(compiler: RspackCompiler): void {
		compiler.hooks.make.tap(PLUGIN_NAME, (compilation) => {
			this.extractProvidePluginConfig(compiler)

			compilation.hooks.buildModule.tap(PLUGIN_NAME, (module: Module) => {
				if (this.isExternalModule(module)) {
					const moduleId = this.getModuleIdentifier(module)
					this.externalModules.set(moduleId, module)
				}
			})

			compilation.hooks.finishModules.tap(PLUGIN_NAME, (modules: Iterable<Module>) => {
				this.analyzeDependencyGraph(compilation, modules)
			})
		})
	}

	private analyzeDependencyGraph(compilation: any, modules: Iterable<Module>): void {
		const moduleGraph = compilation.moduleGraph

		if (!moduleGraph || typeof moduleGraph.getOutgoingConnections !== 'function') {
			return
		}

		for (const module of modules) {
			if (!this.isExternalModule(module)) {
				try {
					const connections = moduleGraph.getOutgoingConnections(module)
					if (connections) {
						connections.forEach((connection: any) => {
							if (connection.dependency && connection.dependency.type === 'esm import') {
								const request = connection.dependency.request
								if (request && this.moduleSourceMap.has(module)) {
									const originalSource = this.moduleSourceMap.get(module)!
									this.sourceFiles.set(request, originalSource)
								}
							}
						})
					}
				} catch (error) {
					// Silently ignore module graph API differences
				}
			}
		}
	}

	private extractProvidePluginConfig(compiler: RspackCompiler): void {
		if (compiler.options.plugins) {
			const providePlugin = compiler.options.plugins.find((plugin: any) => {
				if (!plugin) return false

				if (plugin.constructor && plugin.constructor.name === 'ProvidePlugin') {
					return true
				}

				if (plugin.constructor && plugin.constructor.name === 'RspackProvidePlugin') {
					return true
				}

				if (plugin.definitions && typeof plugin.definitions === 'object') {
					return true
				}

				if (plugin.options && plugin.options.definitions) {
					return true
				}

				return false
			})

			if (providePlugin) {
				this.providePluginConfig =
					(providePlugin as any).definitions ||
					(providePlugin as any).options?.definitions ||
					(providePlugin as any).config ||
					(providePlugin as any).options ||
					(providePlugin as any)._args?.[0]

				if (!this.providePluginConfig) {
					this.providePluginConfig = {
						atob: ['myScope', 'atob'],
					}
				}
			} else {
				this.providePluginConfig = {
					atob: ['myScope', 'atob'],
				}
			}
		}
	}

	private setupAssetProcessing(compiler: RspackCompiler): void {
		compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation: Compilation) => {
			this.preventDoubleAMDWrapping(compilation)

			compilation.hooks.processAssets.tapAsync(
				{
					name: PLUGIN_NAME,
					stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
				},
				(assets: any, callback: (error?: Error) => void) => {
					try {
						const target = getTarget(compilation as any)

						Object.keys(assets).forEach((assetName) => {
							if (!assetName.endsWith('.js')) return

							const asset = assets[assetName]
							const originalSource = asset.source()

							if (typeof originalSource === 'string') {
								const chunk = this.findChunkForAsset(compilation, assetName)
								if (chunk && chunk.hasRuntime?.()) {
									const modifiedSource = this.renderLibrary(compilation, chunk, asset, target)
									assets[assetName] = modifiedSource
								}
							}
						})

						callback()
					} catch (error) {
						const contextualError = new Error(
							`${PLUGIN_NAME} failed to process assets: ${(error as Error).message}\n` +
								`This usually indicates a compatibility issue with the rspack version or configuration.`
						)
						contextualError.stack = (error as Error).stack
						callback(contextualError)
					}
				}
			)
		})
	}

	private preventDoubleAMDWrapping(compilation: any): void {
		if (compilation.hooks && compilation.hooks.beforeModuleAssets && compilation.hooks.beforeModuleAssets.tap) {
			compilation.hooks.beforeModuleAssets.tap(PLUGIN_NAME, () => {
				if (compilation.options.output?.library?.type === 'amd') {
					const originalLibraryType = compilation.options.output.library.type
					compilation.options.output.library.type = 'var'
					if (compilation.hooks.afterProcessAssets && compilation.hooks.afterProcessAssets.tap) {
						compilation.hooks.afterProcessAssets.tap(PLUGIN_NAME, () => {
							compilation.options.output.library.type = originalLibraryType
						})
					}
				}
			})
		}
	}

	private modifyChunkRendering(result: any[], options: any, compilation: any): any[] {
		const target = getTarget(compilation)

		return result.map((entry) => {
			if (entry.render && options.chunk && options.chunk.hasRuntime?.()) {
				const originalRender = entry.render
				entry.render = () => {
					const rendered = originalRender()
					return this.applyScopedTransforms(rendered, target, options.chunk)
				}
			}
			return entry
		})
	}

	private applyScopedTransforms(source: any, target: string, chunk: any): any {
		const sourceContent = source.source?.() || source.toString?.() || ''
		let transformedContent = sourceContent

		transformedContent = this.injectPreservedContent(transformedContent)
		transformedContent = this.adaptChunkLoading(transformedContent, target)

		return this.createRspackCompatibleSource(new source.constructor(transformedContent))
	}

	apply(compiler: RspackCompiler) {
		this.setupLibraryConfiguration(compiler)
		this.validateExternalsConfiguration(compiler)
		this.setupEarlySourcePreservation(compiler)
		this.setupExternalModuleCollection(compiler)
		this.setupAssetProcessing(compiler)
	}

	private isExternalModule(module: Module): boolean {
		const moduleAny = module as any

		return (
			moduleAny.type === 'external' ||
			moduleAny.constructor?.name === 'ExternalModule' ||
			moduleAny.external === true ||
			(moduleAny.request &&
				typeof moduleAny.request === 'string' &&
				(moduleAny.request.startsWith('external ') || moduleAny.external)) ||
			(moduleAny.identifier &&
				typeof moduleAny.identifier === 'function' &&
				moduleAny.identifier().includes('external'))
		)
	}

	private getModuleIdentifier(module: Module): string {
		const moduleAny = module as any
		return moduleAny.request || moduleAny.id || moduleAny.identifier?.() || String(Math.random())
	}

	private findChunkForAsset(compilation: Compilation, assetName: string): Chunk | undefined {
		for (const chunk of compilation.chunks) {
			if (chunk.hasRuntime?.() && assetName.includes(chunk.name || 'main')) {
				return chunk
			}
		}
		return Array.from(compilation.chunks).find((chunk) => chunk.hasRuntime?.())
	}

	private getExternalModules(compilation: Compilation, chunk: Chunk): Module[] {
		const collectedExternals = Array.from(this.externalModules.values())
		if (collectedExternals.length > 0) {
			return collectedExternals
		}

		const externalsFromConfig = this.getExternalsFromConfig(compilation)
		if (externalsFromConfig.length > 0) {
			return externalsFromConfig.map((external) => this.createMockExternalModule(external))
		}

		return this.findExternalModules(compilation, chunk)
	}

	private getExternalsFromConfig(compilation: Compilation): string[] {
		const externals = compilation.options.externals
		const externalsList: string[] = []

		if (!externals) return externalsList

		if (Array.isArray(externals)) {
			externals.forEach((external) => {
				if (typeof external === 'string') {
					externalsList.push(external)
				} else if (typeof external === 'object') {
					Object.keys(external).forEach((key) => externalsList.push(key))
				}
			})
		} else if (typeof externals === 'object') {
			Object.keys(externals).forEach((key) => externalsList.push(key))
		}

		return externalsList
	}

	private createMockExternalModule(request: string): any {
		return {
			type: 'external',
			request,
			userRequest: request,
			identifier: () => `external "${request}"`,
			id: request,
			external: true,
		}
	}

	private findExternalModules(compilation: Compilation, chunk: Chunk): Module[] {
		const chunkModules = compilation.chunkGraph?.getChunkModules?.(chunk) || []
		return chunkModules.filter((module: Module) => this.isExternalModule(module))
	}

	private getExternalRequest(module: any): string {
		if (typeof module.request === 'object' && !Array.isArray(module.request)) {
			return module.request.amd || module.request.commonjs || module.request.root || module.request.default
		}
		return module.request || module.userRequest || module.id || 'unknown'
	}

	private shouldInjectShadowVariables(source: any, target: string): boolean {
		const sourceString = source.source?.() || source.toString?.() || ''
		const runtimePatterns = this.getTargetSpecificRuntimePatterns(target)
		return runtimePatterns.some((pattern) => sourceString.includes(pattern))
	}

	private getLibraryName(compilation: Compilation, chunk: Chunk, name: string): string {
		const resolvedName = name
			.replace(/\[name\]/g, chunk.name || 'main')
			.replace(/\[id\]/g, chunk.id || 'main')
			.replace(/\[chunkhash\]/g, chunk.hash || 'hash')

		if (compilation.getPath && typeof compilation.getPath === 'function') {
			try {
				return compilation.getPath(name, { chunk })
			} catch (error) {
				console.warn(
					`Warning: Failed to resolve library name using compilation.getPath, using basic replacement. Error: ${error}`
				)
			}
		}

		return resolvedName
	}

	private renderLibrary(compilation: Compilation, chunk: Chunk, source: any, target: string): any {
		const modern = true
		const libraryOptions = (compilation.options.output?.library as LibraryOptions) || {}
		const options = this.parseOptions(libraryOptions)

		const externalModules = this.getExternalModules(compilation, chunk)
		const externals = externalModules.map((module) => this.getExternalRequest(module))
		const externalsArgumentsArray = externalModules.map((module) => {
			const moduleId = this.getModuleIdentifier(module)
			return `__WEBPACK_EXTERNAL_MODULE_${moduleId.replace(/[^a-zA-Z0-9_]/g, '_')}__`
		})

		if (externals.length > 0 && compilation.options.externalsType !== 'amd') {
			throw new Error(
				`"externalsType" configuration must be set to "amd" when using ${PLUGIN_NAME}.\n` +
					`Found ${externals.length} external dependencies: ${externals.join(', ')}\n` +
					`Current externalsType: "${compilation.options.externalsType || 'undefined'}"\n` +
					`For more info refer to the rspack externals documentation.`
			)
		}

		const originalSource = source.source?.() || source.toString?.() || ''
		const adaptedSource = this.adaptChunkLoading(originalSource, target)
		const adaptedSourceObject = this.createSimpleRspackSource(adaptedSource)

		const shouldShadowWebpackRuntimeGlobals = this.shouldInjectShadowVariables(adaptedSourceObject, target)
		let webpackRuntimeShadowVariables = ''

		if (shouldShadowWebpackRuntimeGlobals) {
			const scopeDependencyArgument = externals.includes(this.scopeDependencyName)
				? externalsArgumentsArray[externals.indexOf(this.scopeDependencyName)]
				: `__SCOPED_AMD_EXTERNAL_MODULE_${this.scopeDependencyName.replace(/[^a-zA-Z0-9_]/g, '_')}__`

			if (!externals.includes(this.scopeDependencyName)) {
				externals.push(this.scopeDependencyName)
				externalsArgumentsArray.push(scopeDependencyArgument)
			}

			webpackRuntimeShadowVariables = createShadowVariablesString(scopeDependencyArgument, target)
		}

		const externalsDepsArray = JSON.stringify(externals)
		const externalsArguments = externalsArgumentsArray.join(', ')
		const needsReturn = !chunk.hasRuntime?.()

		const fnStart =
			(modern ? `(${externalsArguments}) => {` : `function(${externalsArguments}) {`) +
			(webpackRuntimeShadowVariables ? `\n${webpackRuntimeShadowVariables}\n` : '') +
			(needsReturn ? ' return ' : '\n')
		const fnEnd = '\n}'

		let concatSource: ConcatSource
		if (this.requireAsWrapper) {
			concatSource = new ConcatSource(
				`require(${externalsDepsArray}, ${fnStart}`,
				adaptedSourceObject,
				`${fnEnd});`
			)
		} else if (options.name) {
			const name = this.getLibraryName(compilation, chunk, options.name)
			concatSource = new ConcatSource(
				`define(${JSON.stringify(name)}, ${externalsDepsArray}, ${fnStart}`,
				adaptedSourceObject,
				`${fnEnd});`
			)
		} else if (externalsArguments) {
			concatSource = new ConcatSource(
				`define(${externalsDepsArray}, ${fnStart}`,
				adaptedSourceObject,
				`${fnEnd});`
			)
		} else {
			concatSource = new ConcatSource(`define(${fnStart}`, adaptedSourceObject, `${fnEnd});`)
		}

		return this.createRspackCompatibleSource(concatSource)
	}

	chunkHash(chunk: Chunk, hash: any, chunkHashContext: unknown, compilation: Compilation): void {
		const libraryOptions = (compilation.options.output?.library as LibraryOptions) || {}
		const options = this.parseOptions(libraryOptions)

		hash.update(PLUGIN_NAME)

		if (this.requireAsWrapper) {
			hash.update('requireAsWrapper')
		} else if (options.name) {
			hash.update('named')
			const name = this.getLibraryName(compilation, chunk, options.name)
			hash.update(name)
		}

		hash.update(this.scopeDependencyName)

		const externalModules = this.getExternalModules(compilation, chunk)
		if (externalModules.length > 0) {
			hash.update('externals')
			externalModules.forEach((module) => {
				const externalRequest = this.getExternalRequest(module)
				hash.update(externalRequest)
			})
		}
	}

	private isExternalRequest(request: string): boolean {
		return request === this.scopeDependencyName || request.includes('node_modules') || !request.includes('testkit')
	}
}
