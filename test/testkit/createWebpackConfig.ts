import { ProvidePlugin } from 'webpack'
import type { Configuration } from 'webpack'
import _ from 'lodash'
import ScopedAmdLibraryPlugin from '../../src/ScopedAmdLibraryPlugin'
import { filePrefix } from './constants'

type CreateConfigParams = {
	target: 'web' | 'webworker' | 'node' | string
	scopeDependencyName: string
	additionalEntryFiles: Array<string>
}

export const createWebpackConfig = ({
	target = 'web',
	scopeDependencyName = 'fakeGlobal',
	additionalEntryFiles = [],
}: Partial<CreateConfigParams> = {}): Configuration => {
	return {
		mode: 'production',
		entry: {
			..._(additionalEntryFiles)
				.keyBy((file) => file.split('.js')[0])
				.mapValues((v) => `${filePrefix}/${v}`)
				.value(),
			index: `${filePrefix}/index.js`,
		},
		target: [target, 'es5'],
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
		plugins: [
			new ProvidePlugin({
				window: scopeDependencyName,
				document: [scopeDependencyName, 'document'],
			}),
			new ScopedAmdLibraryPlugin({ scopeDependencyName }),
		],
		externalsType: 'amd',
		externals: [
			{
				[scopeDependencyName]: scopeDependencyName,
			},
		],
	}
}
