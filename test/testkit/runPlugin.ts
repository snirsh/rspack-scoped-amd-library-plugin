import AmdLoaderFactory from './amdLoaderFactory'

import type { LoadFile, LoadFileSync } from '../../src/types'
import { loadFileFactory } from './fileLoaderFactory'
import { skipCompilation, useInMemoryFileSystem } from './constants'
import { createWebpackConfig } from './createWebpackConfig'
import { compileWithWebpack } from './compileWithWebpack'
import { FilesContent } from './types'
import { prepareFileSystem } from './prepareFileSystem'

type ModuleInfo = {
	load: (dependencies?: any) => Promise<any>
	code: string
	fullFilePath: string
}
type ModuleLoaders = { [filePath: string]: ModuleInfo }

type RunPluginResult = {
	modules: ModuleLoaders
	loadFile: LoadFile
	loadFileSync: LoadFileSync
}

export const runPlugin = async (
	files: FilesContent,
	webpackConfig = createWebpackConfig()
): Promise<RunPluginResult> => {
	if (!('index.js' in files)) {
		throw new Error('"index.js" file must be provided')
	}

	const fs = prepareFileSystem(files)

	const { loadFile, loadFileSync } = loadFileFactory(fs)
	const amdLoader = AmdLoaderFactory(loadFile)

	if (useInMemoryFileSystem || !skipCompilation) {
		console.log('Compiling source code')
		await compileWithWebpack(webpackConfig, fs)
	} else {
		console.log('skipping compilation')
	}

	const outputFiles: Array<string> = fs.readdirSync(webpackConfig.output!.path!)

	const modules = outputFiles.reduce<ModuleLoaders>((loaders, filePath) => {
		const fullFilePath = `${webpackConfig.output!.path}/${filePath}`
		const load = (dependencies = {}) => amdLoader.loadModule(fullFilePath, dependencies)
		const code = fs.readFileSync(fullFilePath, 'utf-8')

		loaders[filePath] = {
			fullFilePath,
			load,
			code,
		}
		return loaders
	}, {})
	return {
		modules,
		loadFile,
		loadFileSync,
	}
}
