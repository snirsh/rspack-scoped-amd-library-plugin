import type { FilesContent, FS } from './types'
import { filePrefix, useInMemoryFileSystem } from './constants'
import MemoryFS from 'memory-fs'
import nodeFS from 'fs'

export const prepareFileSystem = (files: FilesContent): FS => {
	const fs = useInMemoryFileSystem ? new MemoryFS() : nodeFS

	// Stage source files for webpack
	if (filePrefix) {
		// MemoryFS does not support mkdirSync recursive option, so we must create the directory path manually
		filePrefix.split('/').reduce<string>((path, pathFragment) => {
			const nextPath = `${path}/${pathFragment}`
			if (!fs.existsSync(nextPath)) {
				fs.mkdirSync(nextPath)
			}
			return nextPath
		}, '')
	}

	// clear previous compilation staged files
	fs.readdirSync(filePrefix).forEach((file) => {
		const fullPath = `${filePrefix}/${file}`
		if (fs.statSync(fullPath).isFile()) {
			fs.unlinkSync(fullPath)
		}
	})

	Object.entries(files).forEach(([fileName, content]) => {
		fs.writeFileSync(`${filePrefix}/${fileName}`, content.trim(), 'utf-8')
	})

	return fs as FS
}
