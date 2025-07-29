export const LIBRARY_TYPE = 'scoped-amd'

export const getTarget = (compilation: any): string => {
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

	return [
		...globalPointers.map((pointer) => `var ${pointer}=${scopeArgumentName};`),
		...globalNamespaces.map(
			(namespace) =>
				`var ${namespace}=(${scopeArgumentName}.${namespace}=${scopeArgumentName}.${namespace}||${scopeArgumentName});`
		),
	].join('')
}

export const validateOptions = (options: ScopedAmdLibraryPluginOptions, pluginName: string) => {
	if (!options?.scopeDependencyName) {
		throw new Error(
			`${pluginName} constructor was called without an option argument with scopeDependencyName property`
		)
	}
}
