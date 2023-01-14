export const dirname = (path: string): string => {
	return /(.+)\/.+$/.exec(path)?.[1] || '.'
}

export const joinPath = (base: string, path: string): string => {
	let allowStepBack = true
	const mergedPath = base.split('/').filter((segment, index) => index === 0 || segment)
	path.split('/').forEach((segment, index, arr) => {
		if (!segment && index < arr.length - 1) {
			return
		}
		if (segment === '.') {
			if (index > 0) {
				throw new Error('Invalid path ' + path)
			}
			return
		}
		if (segment === '..') {
			if (!allowStepBack) {
				throw new Error('Invalid path ' + path)
			}
			mergedPath.pop()
			return
		}
		allowStepBack = false
		mergedPath.push(segment)
	})

	return mergedPath.join('/')
}
