import webpack from 'webpack'
import type { Configuration } from 'webpack'
import { FS } from './types'

export const compileWithWebpack = (webpackConfig: Configuration, fs: FS) =>
	new Promise<void>((resolve, reject) => {
		const compiler = webpack(webpackConfig)
		compiler.inputFileSystem = fs
		compiler.intermediateFileSystem = fs
		compiler.outputFileSystem = fs

		compiler.run((err: any, stats) => {
			compiler.close(() => {})
			if (err) {
				console.error(err.stack || err)
				if (err.details) {
					console.error(err.details)
				}
				reject(err)
			}

			const info = stats!.toJson()

			if (stats!.hasErrors()) {
				console.error(info.errors)
				reject(info.errors![0])
			}

			if (stats!.hasWarnings()) {
				console.warn(info.warnings)
			}
			resolve()
		})
	})
