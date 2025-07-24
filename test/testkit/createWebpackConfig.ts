import type { Configuration } from 'webpack'
import type { RspackOptions } from '@rspack/core'
import _ from 'lodash'
import { filePrefix } from './constants'
import path from 'path'

type BundlerConfiguration = Configuration | RspackOptions

type CreateConfigParams = Pick<BundlerConfiguration, 'target' | 'plugins' | 'externals'> & {
	additionalEntryFiles?: Array<string>
}

export const createWebpackConfig = ({ target, plugins, externals, additionalEntryFiles }: CreateConfigParams): any => {
	// Create relative paths for rspack compatibility
	const createEntryPath = (filename: string) => {
		return path.resolve(filePrefix, filename)
	}

	return {
		cache: false,
		mode: 'production',
		entry: {
			..._(additionalEntryFiles || [])
				.keyBy((file) => file.split('.js')[0])
				.mapValues((v) => createEntryPath(v))
				.value(),
			index: createEntryPath('index.js'),
		},
		target,
		output: {
			filename: '[name].bundle.js',
			chunkFilename: '[name].chunk.js',
			path: `${filePrefix}/dist`,
			clean: true,
			library: {
				type: 'scoped-amd',
				name: 'project-name',
			},
		},
		optimization: {
			minimize: false,
			splitChunks: {
				minSize: 1,
				chunks: 'all',
			},
		},
		plugins,
		externalsType: 'amd',
		externals,
	}
}
