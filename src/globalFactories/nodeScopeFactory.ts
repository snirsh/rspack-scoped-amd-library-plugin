/**
 * Generates the minimal required object for proper node targeted amd scripts built in webpack
 *
 * @param require a function implementing node's require behavior as per https://nodejs.org/api/modules.html#requireid
 */
export const nodeScopeFactory = (require: NodeRequire) => {
	return {
		require,
	}
}
