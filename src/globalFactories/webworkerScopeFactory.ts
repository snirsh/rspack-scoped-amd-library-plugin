import type { LoadFileSync } from '../types'

/**
 * Generates the minimal required object for proper webworker targeted amd scripts built in webpack
 *
 * @param projectRoot a path representing the base route for any relative url in your bundles
 * @param loadFileSync a function that returns file/url content
 */
export const webworkerScopeFactory = (projectRoot: string, loadFileSync: LoadFileSync) => {
	if (!/^https?:/i.test(projectRoot) && !projectRoot.endsWith('/')) {
		throw new Error('non-url projectRoot argument must end with a "/"')
	}

	return {
		location: {
			href: projectRoot,
			toString: () => projectRoot,
		},
		importScripts: (url: string) => eval(loadFileSync(url)),
	}
}
