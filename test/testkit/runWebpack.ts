import { getBundler } from './bundlerFactory'
import type { BundlerConfiguration } from './bundlerFactory'
import { FS } from './types'

export const runWebpack = (config: BundlerConfiguration, fs: FS) =>
	new Promise<void>((resolve, reject) => {
		const { bundler, type } = getBundler()
		const compiler = bundler(config)
		compiler.inputFileSystem = fs
		compiler.intermediateFileSystem = fs
		compiler.outputFileSystem = fs

		compiler.run((err: any, stats: any) => {
			compiler.close(() => {})
			if (err) {
				console.error(err.stack || err)
				if (err.details) {
					console.error(err.details)
				}
				reject(err)
				return
			}

			// Handle different stats APIs between webpack and rspack
			let info: any
			if (type === 'rspack') {
				// Rspack stats API might be different
				info = stats || {}
				if (stats && typeof stats.toJson === 'function') {
					info = stats.toJson()
				}
			} else {
				// Webpack stats API
				info = stats!.toJson()
			}

			if (stats && typeof stats.hasErrors === 'function' && stats.hasErrors()) {
				console.error(info.errors)
				reject(info.errors?.[0] || new Error('Compilation failed'))
				return
			}

			if (stats && typeof stats.hasWarnings === 'function' && stats.hasWarnings()) {
				console.warn(info.warnings)
			}
			resolve()
		})
	})
