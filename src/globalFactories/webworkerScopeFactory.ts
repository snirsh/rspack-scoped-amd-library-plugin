import { LoadFileSync } from '../types'

/**
 * Generates the minimal required object for proper webworker targeted amd scripts built in webpack
 *
 * @param loadFileSync a function that returns file/url content
 * @param href a path representing the webworker's script url
 */
export const webworkerScopeFactory = (loadFileSync: LoadFileSync, href: string) => {
	const importScripts = (url: string) => eval(loadFileSync(url))

	return {
		location: {
			href,
			toString: () => href,
		},
		importScripts,
	}
}
