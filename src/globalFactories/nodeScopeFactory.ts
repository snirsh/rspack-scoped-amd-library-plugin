import type { LoadFileSync } from '../types'
import { joinPath, dirname } from './pathUtils'
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

	// Preserve the original require function for webpack chunk loading
	const originalRequire = require

	const requireFn = (src: string) => {
		// If it's a webpack chunk (relative path starting with ./), use original require
		if (typeof src === 'string' && src.startsWith('./')) {
			// Resolve the relative path to absolute based on the project root directory
			const basePath = projectRoot.replace(/\/$/, '') // Remove trailing slash
			const absolutePath = path.resolve(basePath, src)
			return originalRequire(absolutePath)
		}

		// Otherwise use the original scoped require logic
		const modulePath = joinPath(projectRoot, src)
		const moduleDir = dirname(modulePath)
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
