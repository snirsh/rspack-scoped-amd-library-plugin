import type { Configuration } from 'webpack'
import _ from 'lodash'
import { filePrefix } from './constants'

type CreateConfigParams = Pick<Configuration, 'target' | 'plugins' | 'externals'> & {
	additionalEntryFiles?: Array<string>
}

export const createWebpackConfig = ({
	target,
	plugins,
	externals,
	additionalEntryFiles,
}: CreateConfigParams): Configuration => {
	return {
		cache: false,
		mode: 'production',
		entry: {
			..._(additionalEntryFiles || [])
				.keyBy((file) => file.split('.js')[0])
				.mapValues((v) => `${filePrefix}/${v}`)
				.value(),
			index: `${filePrefix}/index.js`,
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
