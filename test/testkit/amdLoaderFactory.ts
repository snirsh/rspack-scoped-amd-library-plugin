import { LoadFile } from '../../src/types'

declare global {
	// eslint-disable-next-line no-var
	var define: any
}

type ModuleFactory = {
	(...args: any): any
	moduleDependenciesIds?: Array<string>
}

const AmdLoaderFactory = (loadFile: LoadFile) => {
	const scriptsCache: { [url: string]: ModuleFactory } = {}

	const resolveDeps = ({
		url,
		moduleDependenciesIds,
		dependencies,
	}: {
		url: string
		moduleDependenciesIds: Array<string>
		dependencies: Record<string, unknown>
	}): Array<unknown> => {
		return moduleDependenciesIds.map((id: string) => {
			if (!(id in dependencies)) {
				throw new Error(`Module "${url}" dependency "${id}" is missing from provided dependencies map`)
			}
			return dependencies[id]
		})
	}

	return {
		loadModule: async (url: string, dependencies = {}) => {
			if (scriptsCache[url]) {
				const deps = resolveDeps({
					url,
					dependencies,
					moduleDependenciesIds: scriptsCache[url].moduleDependenciesIds || [],
				})
				return scriptsCache[url](...deps)
			}

			let originalDefineValue: any
			let moduleFactory: ModuleFactory = () => {}
			let moduleInstance = null

			const defineAmdGlobals = () => {
				originalDefineValue = globalThis.define

				globalThis.define = (
					nameOrDependenciesIds: string | Array<string>,
					dependenciesIdsOrFactory: Array<string> | Function,
					factory: Function | undefined
				) => {
					const isNamedDefine = typeof nameOrDependenciesIds === 'string'
					// const moduleName = isNamedDefine ? args[0] : null
					const moduleDependenciesIds = ((isNamedDefine ? dependenciesIdsOrFactory : nameOrDependenciesIds) ||
						[]) as Array<string>
					const amdModuleFactory = (isNamedDefine ? factory : dependenciesIdsOrFactory) as ModuleFactory
					// save factory for caching
					moduleFactory = amdModuleFactory
					// save moduleDependenciesIds to use it when moduleFactory is cached.
					moduleFactory.moduleDependenciesIds = moduleDependenciesIds
					moduleInstance = amdModuleFactory(...resolveDeps({ url, moduleDependenciesIds, dependencies }))
				}
				globalThis.define.amd = true
			}

			const cleanupAmdGlobals = () => {
				delete globalThis.define
				if (typeof originalDefineValue !== 'undefined') {
					globalThis.define = originalDefineValue
				}
			}

			const fetchModule = async (moduleUrl: string) => {
				const code = await loadFile(moduleUrl)
				defineAmdGlobals()
				// eslint-disable-next-line no-eval
				eval(code)
				cleanupAmdGlobals()
			}

			try {
				await fetchModule(url)
			} catch {
				await fetchModule(url) // retry
			}

			scriptsCache[url] = moduleFactory

			return moduleInstance
		},
	}
}

export default AmdLoaderFactory
