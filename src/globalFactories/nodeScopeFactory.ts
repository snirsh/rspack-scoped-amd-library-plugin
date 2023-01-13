import { LoadFileSync } from '../types'
import path from 'path'

/**
 * Generates the minimal required object for proper node targeted amd scripts built in webpack
 *
 * @param projectRoot a path representing the base route for any relative url in your bundles
 * @param loadFileSync a function that returns file/url content
 */
export const nodeScopeFactory = (projectRoot: string, loadFileSync: LoadFileSync) => {
	if (!/^https?:/i.test(projectRoot) && !projectRoot.endsWith('/')) {
		throw new Error('non-url projectRoot argument must end with a "/"')
	}

	const requireFn = (src: string) => {
		const modulePath = path.join(projectRoot, src)
		const moduleDir = path.dirname(modulePath)
		const moduleCode = loadFileSync(modulePath)

		const packagedModule = eval(
			['(function runModule(exports, require, module, __filename, __dirname) {', moduleCode, '});'].join('\n')
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
