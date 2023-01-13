import { LoadFileSync } from '../types'
import path from 'path'

/**
 * Generates the minimal required object for proper node targeted amd scripts built in webpack
 *
 * @param loadFileSync a function that returns file/url content
 * @param currentFileRoute a path representing the current script's url to use as a base route to any upcoming path resolutions
 */
export const nodeScopeFactory = (loadFileSync: LoadFileSync, currentFileRoute: string) => {
	const baseRoute = /(.+)\/.+?$/i.exec(currentFileRoute)![1]
	const requireFn = (src: string) => {
		const modulePath = path.join(baseRoute, src)
		const moduleDir = path.dirname(modulePath)
		const moduleCode = loadFileSync(modulePath)

		const packagedModule = eval(
			['(exports, require, module, __filename, __dirname) => {', moduleCode, '};'].join('\n')
		)
		const module = {
			exports: {},
			children: [],
		}

		// run module
		packagedModule(module.exports, requireFn, module, modulePath, moduleDir)

		return module.exports
	}

	return {
		require: requireFn,
	}
}
