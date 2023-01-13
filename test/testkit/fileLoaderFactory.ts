import type { LoadFile, LoadFileSync } from '../../src/types'
import { FS } from './types'

export const loadFileFactory = (fs: FS): { loadFileSync: LoadFileSync; loadFile: LoadFile } => {
	const loadFileSync = (filePath: string) => fs.readFileSync(filePath, 'utf-8')

	const loadFile: LoadFile = (filePath: string): Promise<string> => {
		return new Promise((resolve, reject) => {
			fs.readFile(filePath, 'utf-8', (err: any, data: any) => {
				err ? reject(err) : resolve(data)
			})
		})
	}

	return {
		loadFile,
		loadFileSync,
	}
}
